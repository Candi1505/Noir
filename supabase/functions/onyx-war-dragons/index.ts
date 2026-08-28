import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://candi1505.github.io";
const WAR_DRAGONS_ORIGIN =
  "https://api-dot-pgdragonsong.appspot.com";
const REQUEST_TIMEOUT_MS = 12_000;

const RESOURCE_PATHS = Object.freeze({
  profile: "/api/v1/player/public/my_profile",
});

type ResourceName = keyof typeof RESOURCE_PATHS;

function corsHeaders(origin: string | null) {
  return {
    "access-control-allow-origin":
      origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "cache-control": "no-store",
    "vary": "origin",
  };
}

function json(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function readPublishableKey() {
  const keySet = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (keySet) {
    try {
      const parsed = JSON.parse(keySet) as Record<string, string>;
      if (parsed.default) return parsed.default;

      const firstKey = Object.values(parsed)
        .find(value => typeof value === "string" && value.length > 0);
      if (firstKey) return firstKey;
    } catch {
      // Fall through to the legacy key while Supabase completes its key migration.
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

function readSecretKey() {
  const keySet = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (keySet) {
    try {
      const parsed = JSON.parse(keySet) as Record<string, string>;
      if (parsed.default) return parsed.default;

      const firstKey = Object.values(parsed)
        .find(value => typeof value === "string" && value.length > 0);
      if (firstKey) return firstKey;
    } catch {
      // Fall through to the legacy key during the Supabase key migration.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

async function authenticatedUserId(
  authorization: string,
  supabaseUrl: string,
  publishableKey: string,
) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      authorization,
      apikey: publishableKey,
    },
  });

  if (!response.ok) return "";

  const user = await response.json() as { id?: unknown };
  return typeof user.id === "string" ? user.id : "";
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function tokenEncryptionKey() {
  const secret = Deno.env.get("WAR_DRAGONS_TOKEN_ENCRYPTION_KEY") || "";
  if (secret.length < 24) throw new Error("encryption-not-configured");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

async function decryptApiKey(
  ciphertext: string,
  iv: string,
  playerId: string,
) {
  const cleartext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(iv),
      additionalData: new TextEncoder().encode(playerId),
    },
    await tokenEncryptionKey(),
    base64ToBytes(ciphertext),
  );
  const value = new TextDecoder().decode(cleartext);
  if (value.length < 8 || value.length > 4096 || /[\u0000-\u001f]/.test(value)) {
    throw new Error("invalid-api-key");
  }
  return value;
}

type PlayerConnection = {
  player_id: string;
  api_key_ciphertext: string;
  api_key_iv: string;
};

async function loadPlayerConnection(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  const query = new URLSearchParams({
    select: "player_id,api_key_ciphertext,api_key_iv",
    user_id: `eq.${userId}`,
    revoked_at: "is.null",
    limit: "1",
  });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/war_dragons_connections?${query.toString()}`,
    {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    },
  );
  if (!response.ok) throw new Error("connection-read-failed");
  const rows = await response.json() as PlayerConnection[];
  return rows[0] || null;
}

async function markConnectionVerified(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  if (!serviceKey) return;
  const query = new URLSearchParams({ user_id: `eq.${userId}` });
  await fetch(
    `${supabaseUrl}/rest/v1/war_dragons_connections?${query.toString()}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  ).catch(() => undefined);
}

function isResourceName(value: unknown): value is ResourceName {
  return typeof value === "string" &&
    Object.hasOwn(RESOURCE_PATHS, value);
}

Deno.serve(async request => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) {
      return json(origin, 403, {
        ok: false,
        message: "War Dragons intelligence is available from Onyx only.",
      });
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (request.method !== "POST" || origin !== ALLOWED_ORIGIN) {
    return json(origin, 403, {
      ok: false,
      message: "War Dragons intelligence is available from Onyx only.",
    });
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json(origin, 401, {
      ok: false,
      message: "Sign in to Onyx Command first.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = readPublishableKey();
  const serviceKey = readSecretKey();
  const ownerUserId = Deno.env.get("WAR_DRAGONS_OWNER_USER_ID") || "";
  const ownerApiKey = Deno.env.get("WAR_DRAGONS_API_KEY") || "";
  const clientSecret =
    Deno.env.get("WAR_DRAGONS_CLIENT_SECRET") || "";

  if (
    !supabaseUrl ||
    !publishableKey ||
    !clientSecret
  ) {
    return json(origin, 503, {
      ok: false,
      message: "War Dragons intelligence is not configured yet.",
    });
  }

  const userId = await authenticatedUserId(
    authorization,
    supabaseUrl,
    publishableKey,
  );

  if (!userId) {
    return json(origin, 401, {
      ok: false,
      message: "Sign in to Onyx Command first.",
    });
  }

  let apiKey = "";
  let encryptedConnection = false;
  if (serviceKey && Deno.env.get("WAR_DRAGONS_TOKEN_ENCRYPTION_KEY")) {
    try {
      const connection = await loadPlayerConnection(
        userId,
        supabaseUrl,
        serviceKey,
      );
      if (connection) {
        apiKey = await decryptApiKey(
          connection.api_key_ciphertext,
          connection.api_key_iv,
          connection.player_id,
        );
        encryptedConnection = true;
      }
    } catch {
      if (userId !== ownerUserId || !ownerApiKey) {
        return json(origin, 503, {
          ok: false,
          message: "The secure War Dragons connection could not be opened.",
        });
      }
    }
  }

  if (!apiKey && userId === ownerUserId) apiKey = ownerApiKey;
  if (!apiKey) {
    return json(origin, 403, {
      ok: false,
      message: "Authorise your War Dragons account in Atlas Command first.",
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(origin, 400, {
      ok: false,
      message: "Choose a valid War Dragons resource.",
    });
  }

  if (!isResourceName(body.resource)) {
    return json(origin, 400, {
      ok: false,
      message: "That War Dragons resource is not available.",
    });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sha256Hex(
    `${clientSecret}:${apiKey}:${timestamp}`,
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const upstream = await fetch(
      `${WAR_DRAGONS_ORIGIN}${RESOURCE_PATHS[body.resource]}`,
      {
        method: "GET",
        headers: {
          "X-WarDragons-APIKey": apiKey,
          "X-WarDragons-Request-Timestamp": timestamp,
          "X-WarDragons-Signature": signature,
          accept: "application/json",
        },
        signal: controller.signal,
      },
    );
    const responseText = await upstream.text();

    if (!upstream.ok) {
      return json(origin, 502, {
        ok: false,
        message: "War Dragons did not return this intelligence.",
        upstreamStatus: upstream.status,
      });
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      return json(origin, 502, {
        ok: false,
        message: "War Dragons returned an unexpected response.",
      });
    }

    if (encryptedConnection) {
      await markConnectionVerified(userId, supabaseUrl, serviceKey);
    }

    return json(origin, 200, {
      ok: true,
      resource: body.resource,
      source: "War Dragons API",
      fetchedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException &&
      error.name === "AbortError";

    return json(origin, 504, {
      ok: false,
      message: timedOut
        ? "War Dragons took too long to respond."
        : "War Dragons intelligence is temporarily unavailable.",
    });
  } finally {
    clearTimeout(timeout);
  }
});
