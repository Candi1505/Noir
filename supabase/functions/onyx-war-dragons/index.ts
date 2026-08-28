import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://onyx-command-preview.bh8wyphfrm.chatgpt.site",
  "https://candi1505.github.io",
];
const WAR_DRAGONS_ORIGIN = "https://api-dot-pgdragonsong.appspot.com";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_UPSTREAM_BYTES = 25 * 1024 * 1024;
const MAX_CASTLES_PER_REQUEST = 100;
const MAX_CASTLE_ID_LENGTH = 64;
const MACRO_CACHE_MS = 60_000;
const CRITICAL_INTERVAL_MS = 1_000;
const CASTLE_ID_PATTERN = /^[1-9][0-9]*-A[0-9]+-[0-9]+$/;

const RESOURCE_SCOPES = Object.freeze({
  profile: "player.public.read",
  atlasMacro: "atlas.read",
  atlasInfo: "atlas.read",
  atlasCritical: "atlas.read",
});

type ResourceName = keyof typeof RESOURCE_SCOPES;
type JsonRecord = Record<string, unknown>;
type PlayerConnection = {
  player_id: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  scopes: string[];
};
type MacroCacheEntry = {
  expiresAt: number;
  value: JsonRecord;
};

const macroCache = new Map<string, MacroCacheEntry>();

function configuredOrigins() {
  const configured = (Deno.env.get("ONYX_ALLOWED_ORIGINS") || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isAllowedOrigin(origin: string | null) {
  return Boolean(origin && configuredOrigins().has(origin));
}

function corsHeaders(origin: string | null) {
  return {
    ...(isAllowedOrigin(origin)
      ? { "access-control-allow-origin": origin as string }
      : {}),
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
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      ...extraHeaders,
      "content-type": "application/json; charset=utf-8",
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
      // Fall through while Supabase completes its key migration.
    }
  }
  return Deno.env.get(legacyName) || "";
}

function readPublishableKey() {
  return readKeySet("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
}

function readSecretKey() {
  return readKeySet("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
}

function serviceHeaders(serviceKey: string, contentType = false) {
  return {
    apikey: serviceKey,
    ...(!serviceKey.startsWith("sb_secret_")
      ? { authorization: `Bearer ${serviceKey}` }
      : {}),
    ...(contentType ? { "content-type": "application/json" } : {}),
  };
}

async function authenticatedUserId(
  authorization: string,
  supabaseUrl: string,
  publishableKey: string,
) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { authorization, apikey: publishableKey },
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

async function loadPlayerConnection(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  const query = new URLSearchParams({
    select: "player_id,api_key_ciphertext,api_key_iv,scopes",
    user_id: `eq.${userId}`,
    revoked_at: "is.null",
    limit: "1",
  });
  const response = await fetch(
    `${supabaseUrl}/rest/v1/war_dragons_connections?${query.toString()}`,
    { headers: serviceHeaders(serviceKey) },
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
      headers: serviceHeaders(serviceKey, true),
      body: JSON.stringify({
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  ).catch(() => undefined);
}

function isResourceName(value: unknown): value is ResourceName {
  return typeof value === "string" && Object.hasOwn(RESOURCE_SCOPES, value);
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integer(value: unknown) {
  const number = finite(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function safeTeamName(value: unknown) {
  return typeof value === "string" && value.length <= 120 ? value : null;
}

function isSafeCastleId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= MAX_CASTLE_ID_LENGTH &&
    CASTLE_ID_PATTERN.test(value)
  );
}

function safeCastleIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CASTLES_PER_REQUEST) {
    return null;
  }
  if (!value.every(isSafeCastleId)) return null;
  const ids = [...new Set(value)];
  if (ids.length < 1 || ids.length > MAX_CASTLES_PER_REQUEST) return null;
  return ids;
}

function safeRealmName(value: unknown) {
  const realm = String(value || "").trim();
  return /^[A-Za-z0-9_ -]{1,120}$/.test(realm) ? realm : "";
}

function trimMacroCache() {
  const now = Date.now();
  for (const [key, entry] of macroCache) {
    if (entry.expiresAt <= now) macroCache.delete(key);
  }
  while (macroCache.size > 20) {
    const oldest = macroCache.keys().next().value;
    if (typeof oldest !== "string") break;
    macroCache.delete(oldest);
  }
}

async function claimCriticalRequest(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
) {
  if (!supabaseUrl || !serviceKey) throw new Error("rate-limit-not-configured");
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/claim_war_dragons_critical_request`,
    {
      method: "POST",
      headers: serviceHeaders(serviceKey, true),
      body: JSON.stringify({
        p_user_id: userId,
        p_interval_ms: CRITICAL_INTERVAL_MS,
      }),
    },
  );
  if (!response.ok) throw new Error("rate-limit-claim-failed");

  const payload = await response.json() as unknown;
  const rawValue = Array.isArray(payload) ? payload[0] : payload;
  const retryAfterMs = integer(rawValue);
  if (
    retryAfterMs === null ||
    retryAfterMs < 0 ||
    retryAfterMs > CRITICAL_INTERVAL_MS
  ) {
    throw new Error("rate-limit-response-invalid");
  }
  return retryAfterMs;
}

async function upstreamJson(
  path: string,
  apiKey: string,
  clientSecret: string,
  query: URLSearchParams = new URLSearchParams(),
) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sha256Hex(`${clientSecret}:${apiKey}:${timestamp}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = new URL(path, WAR_DRAGONS_ORIGIN);
  query.forEach((value, key) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-WarDragons-APIKey": apiKey,
        "X-WarDragons-Request-Timestamp": timestamp,
        "X-WarDragons-Signature": signature,
        accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false as const, status: response.status, data: null };
    }
    if (text.length > MAX_UPSTREAM_BYTES) throw new Error("upstream-too-large");
    return {
      ok: true as const,
      status: response.status,
      data: JSON.parse(text) as unknown,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitiseMacro(castlePayload: unknown, teamPayload: unknown) {
  const castles = (castlePayload as JsonRecord)?.castles;
  const teams = (teamPayload as JsonRecord)?.teams;
  if (!castles || typeof castles !== "object" || !teams || typeof teams !== "object") {
    throw new Error("invalid-macro-response");
  }

  const teamMap = new Map<string, { apr: number | null; atlasRank: number | null }>();
  Object.entries(teams as JsonRecord).slice(0, 50_000).forEach(([name, raw]) => {
    if (!safeTeamName(name) || !raw || typeof raw !== "object") return;
    const value = raw as JsonRecord;
    const apr = integer(value.power_rank);
    const atlasRank = integer(value.rank);
    teamMap.set(name, {
      apr: apr !== null && apr >= 0 ? apr : null,
      atlasRank: atlasRank !== null && atlasRank >= 0 ? atlasRank : null,
    });
  });

  const records: JsonRecord[] = [];
  Object.entries(castles as JsonRecord).slice(0, 50_000).forEach(([coordinate, raw]) => {
    if (!isSafeCastleId(coordinate) || !raw || typeof raw !== "object") return;
    const value = raw as JsonRecord;
    const ownerTeam = safeTeamName(value.owner_team);
    const team = ownerTeam ? teamMap.get(ownerTeam) : null;
    const rawLevel = integer(value.level);
    records.push({
      coordinate,
      ownerTeam,
      rawLevel: rawLevel !== null && rawLevel >= 0 && rawLevel <= 4 ? rawLevel : null,
      apr: team?.apr ?? null,
      atlasRank: team?.atlasRank ?? null,
    });
  });

  return {
    records,
    updatedAt: Math.max(
      finite((castlePayload as JsonRecord)?.update_ts) || 0,
      finite((teamPayload as JsonRecord)?.update_ts) || 0,
    ) || null,
  };
}

function sanitiseFort(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const fort = value as JsonRecord;
  return {
    level: integer(fort.level),
    upgradeEpoch: finite(fort.upgrade_epoch),
    shieldTurnedOn: fort.shield_turned_on === true,
    shieldTimeTs: finite(fort.shield_time_ts),
    shieldShipsLost: finite(fort.shield_ships_lost),
  };
}

function sanitiseCritical(payload: unknown, castleIds: string[], observedAt: number) {
  if (!payload || typeof payload !== "object") throw new Error("invalid-critical-response");
  const source = payload as JsonRecord;
  return castleIds.map(coordinate => {
    const raw = source[coordinate];
    if (!raw || typeof raw !== "object") {
      return { coordinate, available: false, observedAt };
    }
    const value = raw as JsonRecord;
    const fleets = value.fleets && typeof value.fleets === "object"
      ? Object.values(value.fleets as JsonRecord)
      : [];
    let guards: number | null = null;
    let guardTotal = 0;
    let sawGarrison = false;
    fleets.slice(0, 1000).forEach(rawFleet => {
      if (!rawFleet || typeof rawFleet !== "object") return;
      const fleet = rawFleet as JsonRecord;
      if (fleet.dtype !== "garrison") return;
      const troops = finite(fleet.total_troops);
      if (troops === null || troops < 0) return;
      sawGarrison = true;
      guardTotal += troops;
    });
    if (sawGarrison) guards = guardTotal;
    return {
      coordinate,
      available: true,
      observedAt,
      ownerTeam: safeTeamName(value.owner_team),
      fort: sanitiseFort(value.fort),
      guards,
      fleetCount: fleets.length,
    };
  });
}

function sanitiseInfo(payload: unknown, castleIds: string[], observedAt: number) {
  if (!payload || typeof payload !== "object") throw new Error("invalid-info-response");
  const source = payload as JsonRecord;
  return castleIds.map(coordinate => {
    const raw = source[coordinate];
    if (!raw || typeof raw !== "object") {
      return { coordinate, available: false, observedAt };
    }
    const value = raw as JsonRecord;
    const infra = value.infra && typeof value.infra === "object"
      ? value.infra as JsonRecord
      : null;
    return {
      coordinate,
      available: true,
      observedAt,
      ownerTeam: safeTeamName(value.owner_team),
      name: typeof value.custom_name === "string" && value.custom_name.length <= 120
        ? value.custom_name
        : "",
      rawLevel: integer(value.level),
      infrastructure: infra ? {
        sourceUpdatedAt: finite(infra.epoch_updated),
        onlineEpoch: finite(infra.online_epoch),
        upkeepEpoch: infra.upkeep_epoch === null ? null : finite(infra.upkeep_epoch),
      } : null,
      fort: sanitiseFort(infra?.fort),
    };
  });
}

async function handleProfile(apiKey: string, clientSecret: string) {
  const upstream = await upstreamJson(
    "/api/v1/player/public/my_profile",
    apiKey,
    clientSecret,
  );
  if (!upstream.ok) return { ok: false as const, status: upstream.status };
  return { ok: true as const, data: upstream.data };
}

async function handleAtlasMacro(
  userId: string,
  apiKey: string,
  clientSecret: string,
  body: JsonRecord,
) {
  const kingdomId = integer(body.kingdomId);
  const realmName = safeRealmName(body.realmName);
  if (kingdomId === null || kingdomId < 1 || kingdomId > 1_000_000 || !realmName) {
    return { ok: false as const, status: 400, code: "invalid-atlas-map" };
  }

  trimMacroCache();
  const cacheKey = `${userId}:${kingdomId}:${realmName}`;
  const cached = macroCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true as const, data: cached.value, cached: true };
  }

  const query = new URLSearchParams({
    k_id: String(kingdomId),
    realm_name: realmName,
  });
  const [castles, teams] = await Promise.all([
    upstreamJson(
      "/api/v1/atlas/castles/metadata/macro",
      apiKey,
      clientSecret,
      query,
    ),
    upstreamJson(
      "/api/v1/atlas/teams/metadata/macro",
      apiKey,
      clientSecret,
      query,
    ),
  ]);
  if (!castles.ok || !teams.ok) {
    return {
      ok: false as const,
      status: castles.ok ? teams.status : castles.status,
      code: "atlas-macro-unavailable",
    };
  }
  const value = sanitiseMacro(castles.data, teams.data) as unknown as JsonRecord;
  macroCache.set(cacheKey, { expiresAt: Date.now() + MACRO_CACHE_MS, value });
  trimMacroCache();
  return { ok: true as const, data: value, cached: false };
}

async function handleAtlasCastleBatch(
  resource: "atlasInfo" | "atlasCritical",
  userId: string,
  apiKey: string,
  clientSecret: string,
  supabaseUrl: string,
  serviceKey: string,
  body: JsonRecord,
) {
  const castleIds = safeCastleIds(body.castleIds);
  if (!castleIds) {
    return { ok: false as const, status: 400, code: "invalid-castle-ids" };
  }

  if (resource === "atlasCritical") {
    const retryAfterMs = await claimCriticalRequest(
      userId,
      supabaseUrl,
      serviceKey,
    );
    if (retryAfterMs > 0) {
      return {
        ok: false as const,
        status: 429,
        code: "rate-limited",
        retryAfterMs,
      };
    }
  }

  const query = new URLSearchParams({ cont_ids: JSON.stringify(castleIds) });
  const path = resource === "atlasCritical"
    ? "/api/v2/castle_critical"
    : "/api/v2/castle_info";
  const upstream = await upstreamJson(path, apiKey, clientSecret, query);
  if (!upstream.ok) {
    return { ok: false as const, status: upstream.status, code: "atlas-live-unavailable" };
  }
  const observedAt = Date.now() / 1000;
  return {
    ok: true as const,
    data: {
      records: resource === "atlasCritical"
        ? sanitiseCritical(upstream.data, castleIds, observedAt)
        : sanitiseInfo(upstream.data, castleIds, observedAt),
      observedAt,
    },
  };
}

Deno.serve(async request => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return json(origin, 403, { ok: false, message: "Onyx only." });
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST" || !isAllowedOrigin(origin)) {
    return json(origin, 403, {
      ok: false,
      message: "War Dragons intelligence is available from Onyx only.",
    });
  }

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json(origin, 401, { ok: false, message: "Sign in to Onyx Command first." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = readPublishableKey();
  const serviceKey = readSecretKey();
  const ownerUserId = Deno.env.get("WAR_DRAGONS_OWNER_USER_ID") || "";
  const ownerApiKey = Deno.env.get("WAR_DRAGONS_API_KEY") || "";
  const clientSecret = Deno.env.get("WAR_DRAGONS_CLIENT_SECRET") || "";
  if (!supabaseUrl || !publishableKey || !clientSecret) {
    return json(origin, 503, {
      ok: false,
      code: "pending_review",
      message: "War Dragons API access is awaiting approval.",
    });
  }

  const userId = await authenticatedUserId(authorization, supabaseUrl, publishableKey);
  if (!userId) {
    return json(origin, 401, { ok: false, message: "Sign in to Onyx Command first." });
  }

  let body: JsonRecord;
  try {
    body = await request.json();
  } catch {
    return json(origin, 400, { ok: false, message: "Choose a valid War Dragons resource." });
  }
  if (!isResourceName(body.resource)) {
    return json(origin, 400, { ok: false, message: "That War Dragons resource is not available." });
  }

  let apiKey = "";
  let scopes: string[] = [];
  let encryptedConnection = false;
  if (serviceKey && Deno.env.get("WAR_DRAGONS_TOKEN_ENCRYPTION_KEY")) {
    try {
      const connection = await loadPlayerConnection(userId, supabaseUrl, serviceKey);
      if (connection) {
        apiKey = await decryptApiKey(
          connection.api_key_ciphertext,
          connection.api_key_iv,
          connection.player_id,
        );
        scopes = Array.isArray(connection.scopes) ? connection.scopes : [];
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

  if (!apiKey && userId === ownerUserId && ownerApiKey) {
    apiKey = ownerApiKey;
    scopes = ["atlas.read", "player.public.read"];
  }
  if (!apiKey) {
    return json(origin, 403, {
      ok: false,
      code: "authorisation_required",
      message: "Authorise your War Dragons account in Atlas Command first.",
    });
  }
  const requiredScope = RESOURCE_SCOPES[body.resource];
  if (!scopes.includes(requiredScope)) {
    return json(origin, 403, {
      ok: false,
      code: "scope_required",
      message: `This connection does not include ${requiredScope}.`,
    });
  }

  try {
    let result:
      | Awaited<ReturnType<typeof handleProfile>>
      | Awaited<ReturnType<typeof handleAtlasMacro>>
      | Awaited<ReturnType<typeof handleAtlasCastleBatch>>;
    if (body.resource === "profile") {
      result = await handleProfile(apiKey, clientSecret);
    } else if (body.resource === "atlasMacro") {
      result = await handleAtlasMacro(userId, apiKey, clientSecret, body);
    } else {
      result = await handleAtlasCastleBatch(
        body.resource,
        userId,
        apiKey,
        clientSecret,
        supabaseUrl,
        serviceKey,
        body,
      );
    }

    if (!result.ok) {
      const status = result.status === 429
        ? 429
        : result.status >= 400 && result.status < 500
          ? result.status
          : 502;
      const retryAfterMs = "retryAfterMs" in result ? result.retryAfterMs : 0;
      return json(
        origin,
        status,
        {
          ok: false,
          code: "code" in result ? result.code : "upstream-unavailable",
          message: status === 429
            ? "Live Atlas is pacing requests to the official limit."
            : "War Dragons did not return this intelligence.",
          ...(retryAfterMs ? { retryAfterMs } : {}),
        },
        retryAfterMs
          ? { "retry-after": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) }
          : {},
      );
    }

    if (encryptedConnection) {
      await markConnectionVerified(userId, supabaseUrl, serviceKey);
    }
    return json(origin, 200, {
      ok: true,
      resource: body.resource,
      source: "War Dragons Public API",
      fetchedAt: new Date().toISOString(),
      ...(body.resource === "atlasMacro" && "cached" in result
        ? { cached: result.cached }
        : {}),
      data: result.data,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return json(origin, timedOut ? 504 : 502, {
      ok: false,
      message: timedOut
        ? "War Dragons took too long to respond."
        : "War Dragons intelligence is temporarily unavailable.",
    });
  }
});
