import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGIN = "https://candi1505.github.io";
const PUBLIC_APP_URL = "https://candi1505.github.io/Noir/";
const WAR_DRAGONS_ORIGIN = "https://api-dot-pgdragonsong.appspot.com";
const HANDOFF_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const REQUESTED_SCOPES = ["atlas.read", "player.public.read"];

type JsonRecord = Record<string, unknown>;

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
  body: JsonRecord,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function redirectToApp(key: string, value: string) {
  const target = new URL(PUBLIC_APP_URL);
  target.hash = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  return new Response(null, {
    status: 303,
    headers: {
      location: target.toString(),
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

function readKeySet(name: string, legacyName: string) {
  const keySet = Deno.env.get(name);
  if (keySet) {
    try {
      const parsed = JSON.parse(keySet) as Record<string, string>;
      if (typeof parsed.default === "string" && parsed.default) {
        return parsed.default;
      }
      const first = Object.values(parsed)
        .find(value => typeof value === "string" && value.length > 0);
      if (first) return first;
    } catch {
      // Fall through to the legacy key during the Supabase key migration.
    }
  }
  return Deno.env.get(legacyName) || "";
}

function publishableKey() {
  return readKeySet("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
}

function secretKey() {
  return readKeySet("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
}

async function authenticatedUserId(
  authorization: string,
  supabaseUrl: string,
  key: string,
) {
  if (!authorization.startsWith("Bearer ")) return "";
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: key },
  });
  if (!response.ok) return "";
  const user = await response.json() as { id?: unknown };
  return typeof user.id === "string" ? user.id : "";
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function encryptionKey() {
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
    ["encrypt"],
  );
}

async function encryptApiKey(apiKey: string, playerId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(playerId),
    },
    await encryptionKey(),
    new TextEncoder().encode(apiKey),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

function serviceHeaders(prefer = "") {
  const key = secretKey();
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

async function serviceRequest(path: string, init: RequestInit = {}) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...serviceHeaders(),
      ...(init.headers || {}),
    },
  });
}

function multiPlayerConfigured() {
  return Deno.env.get("WAR_DRAGONS_MULTI_PLAYER_ENABLED") === "true" &&
    Boolean(Deno.env.get("WAR_DRAGONS_CLIENT_ID")) &&
    Boolean(Deno.env.get("WAR_DRAGONS_CLIENT_SECRET")) &&
    Boolean(Deno.env.get("WAR_DRAGONS_TOKEN_ENCRYPTION_KEY")) &&
    Boolean(secretKey());
}

async function connectionFor(userId: string) {
  const query = new URLSearchParams({
    select: "player_id,scopes,connected_at,last_verified_at",
    user_id: `eq.${userId}`,
    revoked_at: "is.null",
    limit: "1",
  });
  const response = await serviceRequest(
    `war_dragons_connections?${query.toString()}`,
  );
  if (!response.ok) throw new Error("connection-read-failed");
  const rows = await response.json() as Array<{
    player_id?: unknown;
    scopes?: unknown;
    connected_at?: unknown;
    last_verified_at?: unknown;
  }>;
  return rows[0] || null;
}

async function handleStatus(origin: string | null, userId: string) {
  let connection = null;
  try {
    connection = await connectionFor(userId);
  } catch {
    return json(origin, 503, {
      ok: false,
      message: "The secure connection store is not ready yet.",
    });
  }

  const configured = multiPlayerConfigured();
  return json(origin, 200, {
    ok: true,
    connected: Boolean(connection),
    readyToAuthorise: configured,
    reviewStatus: configured ? "ready" : "pending_review",
    playerId: connection?.player_id || null,
    scopes: Array.isArray(connection?.scopes) ? connection.scopes : [],
    connectedAt: connection?.connected_at || null,
    lastVerifiedAt: connection?.last_verified_at || null,
  });
}

function handleBegin(origin: string | null) {
  if (!multiPlayerConfigured()) {
    return json(origin, 409, {
      ok: false,
      code: "pending_review",
      message: "War Dragons multi-player access is awaiting approval.",
    });
  }

  const authorizeUrl = new URL(`${WAR_DRAGONS_ORIGIN}/api/authorize`);
  authorizeUrl.searchParams.set(
    "client_id",
    Deno.env.get("WAR_DRAGONS_CLIENT_ID") || "",
  );
  authorizeUrl.searchParams.set("scopes", REQUESTED_SCOPES.join(","));
  return json(origin, 200, {
    ok: true,
    authorizeUrl: authorizeUrl.toString(),
  });
}

async function handleComplete(
  origin: string | null,
  userId: string,
  handoffToken: unknown,
) {
  if (typeof handoffToken !== "string" || handoffToken.length < 32) {
    return json(origin, 400, {
      ok: false,
      message: "That War Dragons authorisation handoff is invalid.",
    });
  }

  const response = await serviceRequest("rpc/claim_war_dragons_handoff", {
    method: "POST",
    headers: serviceHeaders("return=representation"),
    body: JSON.stringify({
      p_token_hash: await sha256Hex(handoffToken),
      p_user_id: userId,
    }),
  });
  if (!response.ok) {
    return json(origin, 409, {
      ok: false,
      message: "This War Dragons account is already linked or the handoff expired.",
    });
  }
  const rows = await response.json() as Array<{ player_id?: unknown }>;
  if (!rows.length || typeof rows[0].player_id !== "string") {
    return json(origin, 410, {
      ok: false,
      message: "That War Dragons authorisation has expired or was already used.",
    });
  }
  return json(origin, 200, {
    ok: true,
    connected: true,
    playerId: rows[0].player_id,
  });
}

async function handleDisconnect(origin: string | null, userId: string) {
  const query = new URLSearchParams({ user_id: `eq.${userId}` });
  const response = await serviceRequest(
    `war_dragons_connections?${query.toString()}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    return json(origin, 503, {
      ok: false,
      message: "Onyx could not remove this connection yet.",
    });
  }
  return json(origin, 200, {
    ok: true,
    connected: false,
    message: "The encrypted War Dragons key was removed from Onyx.",
  });
}

async function retrievePlayerApiKey(authCode: string) {
  const retrieveUrl = new URL(`${WAR_DRAGONS_ORIGIN}/api/dev/retrieve_token`);
  retrieveUrl.searchParams.set("auth_code", authCode);
  retrieveUrl.searchParams.set(
    "client_id",
    Deno.env.get("WAR_DRAGONS_CLIENT_ID") || "",
  );
  retrieveUrl.searchParams.set(
    "client_secret",
    Deno.env.get("WAR_DRAGONS_CLIENT_SECRET") || "",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(retrieveUrl, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    const payload = await response.json() as { api_key?: unknown };
    const value = typeof payload.api_key === "string" ? payload.api_key : "";
    return value.length >= 8 && value.length <= 4096 && !/[\u0000-\u001f]/.test(value)
      ? value
      : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function handleCallback(request: Request) {
  if (!multiPlayerConfigured()) {
    return redirectToApp("wd-connect-error", "pending-review");
  }
  const url = new URL(request.url);
  const authCode = (url.searchParams.get("auth_code") || "").trim();
  const playerId = (url.searchParams.get("player_id") || "").trim();
  if (
    authCode.length < 8 || authCode.length > 4096 ||
    playerId.length < 1 || playerId.length > 160 ||
    /[\u0000-\u001f]/.test(authCode + playerId)
  ) {
    return redirectToApp("wd-connect-error", "invalid-response");
  }

  const apiKey = await retrievePlayerApiKey(authCode);
  if (!apiKey) return redirectToApp("wd-connect-error", "exchange-failed");

  try {
    const encrypted = await encryptApiKey(apiKey, playerId);
    const handoff = bytesToBase64(
      crypto.getRandomValues(new Uint8Array(32)),
    ).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const response = await serviceRequest("war_dragons_authorization_handoffs", {
      method: "POST",
      body: JSON.stringify({
        token_hash: await sha256Hex(handoff),
        player_id: playerId,
        api_key_ciphertext: encrypted.ciphertext,
        api_key_iv: encrypted.iv,
        scopes: REQUESTED_SCOPES,
        expires_at: new Date(Date.now() + HANDOFF_TTL_MS).toISOString(),
      }),
    });
    if (!response.ok) {
      return redirectToApp("wd-connect-error", "handoff-failed");
    }
    return redirectToApp("wd-connect", handoff);
  } catch {
    return redirectToApp("wd-connect-error", "secure-store-failed");
  }
}

Deno.serve(async request => {
  if (request.method === "GET") return handleCallback(request);

  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (origin !== ALLOWED_ORIGIN) {
      return json(origin, 403, { ok: false, message: "Onyx only." });
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST" || origin !== ALLOWED_ORIGIN) {
    return json(origin, 403, {
      ok: false,
      message: "War Dragons authorisation is available from Onyx only.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publicKey = publishableKey();
  if (!supabaseUrl || !publicKey || !secretKey()) {
    return json(origin, 503, {
      ok: false,
      message: "The secure connection service is not configured yet.",
    });
  }
  const userId = await authenticatedUserId(
    request.headers.get("authorization") || "",
    supabaseUrl,
    publicKey,
  );
  if (!userId) {
    return json(origin, 401, {
      ok: false,
      message: "Sign in to Onyx Command first.",
    });
  }

  let body: JsonRecord;
  try {
    body = await request.json();
  } catch {
    return json(origin, 400, { ok: false, message: "Choose a valid action." });
  }

  if (body.action === "status") return handleStatus(origin, userId);
  if (body.action === "begin") return handleBegin(origin);
  if (body.action === "complete") {
    return handleComplete(origin, userId, body.handoffToken);
  }
  if (body.action === "disconnect") return handleDisconnect(origin, userId);
  return json(origin, 400, { ok: false, message: "That action is not available." });
});
