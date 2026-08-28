const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const browserSource = fs.readFileSync("onyx-war-dragons-auth.js", "utf8");
const oauthSource = fs.readFileSync("supabase/functions/onyx-war-dragons-oauth/index.ts", "utf8");
const gatewaySource = fs.readFileSync("supabase/functions/onyx-war-dragons/index.ts", "utf8");
const sql = fs.readFileSync("supabase/war_dragons_multi_player_oauth.sql", "utf8");

assert.match(html, /onyx-war-dragons-auth\.js\?v=20260828-player-oauth-1/);
assert.ok(
  html.indexOf("onyx-war-dragons-api.js") < html.indexOf("onyx-war-dragons-auth.js")
  && html.indexOf("onyx-war-dragons-auth.js") < html.indexOf("onyx-atlas-command.js"),
  "The War Dragons clients must load before Atlas Command."
);

assert.doesNotMatch(browserSource, /localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(browserSource, /console\.(?:log|warn|error)|document\.cookie/);
assert.doesNotMatch(browserSource, /client[_-]?secret|api[_-]?key|service[_-]?role/i);
assert.doesNotMatch(browserSource, /\p{Extended_Pictographic}/u);
assert.match(browserSource, /FUNCTION_NAME = "onyx-war-dragons-oauth"/);
assert.match(browserSource, /beginAuthorization/);
assert.match(browserSource, /finishReturn/);
assert.match(browserSource, /disconnect/);
assert.match(browserSource, /api-dot-pgdragonsong\\\.appspot\\\.com/);

assert.match(oauthSource, /WAR_DRAGONS_MULTI_PLAYER_ENABLED/);
assert.match(oauthSource, /WAR_DRAGONS_TOKEN_ENCRYPTION_KEY/);
assert.match(oauthSource, /AES-GCM/);
assert.match(oauthSource, /crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
assert.match(oauthSource, /sha256Hex\(handoff\)/);
assert.match(oauthSource, /retrieve_token/);
assert.match(oauthSource, /player\.public\.read/);
assert.match(oauthSource, /atlas\.read/);
assert.doesNotMatch(oauthSource, /console\.(?:log|warn|error)/);
assert.doesNotMatch(oauthSource, /return json\([\s\S]{0,240}\bapi(?:Key|_key)\s*:/i);

assert.match(gatewaySource, /loadPlayerConnection/);
assert.match(gatewaySource, /decryptApiKey/);
assert.match(gatewaySource, /AES-GCM/);
assert.match(gatewaySource, /Authorise your War Dragons account/);
assert.doesNotMatch(gatewaySource, /return json\([\s\S]{0,240}\bapi(?:Key|_key)\s*:/i);

assert.match(sql, /create table if not exists public\.war_dragons_connections/i);
assert.match(sql, /create table if not exists public\.war_dragons_authorization_handoffs/i);
assert.match(sql, /enable row level security/gi);
assert.match(sql, /revoke all on table public\.war_dragons_connections[\s\S]*?from public, anon, authenticated/i);
assert.match(sql, /revoke all on table public\.war_dragons_authorization_handoffs[\s\S]*?from public, anon, authenticated/i);
assert.match(sql, /grant[\s\S]*?to service_role/i);
assert.match(sql, /claim_war_dragons_handoff/);
assert.match(sql, /for update/);
assert.match(sql, /consumed_at is null/);
assert.doesNotMatch(sql, /\bapi_key\s+(?:text|varchar|jsonb)/i);
assert.doesNotMatch(sql, /create policy/i);

const listeners = new Map();
const invocations = [];
let assignedUrl = "";
const location = {
  href: "https://candi1505.github.io/Noir/",
  hash: "",
  assign(value) { assignedUrl = value; }
};
const sandbox = {
  window: null,
  document: {
    readyState: "loading",
    addEventListener(name, handler) { listeners.set(name, handler); }
  },
  location,
  history: { replaceState() {} },
  URL,
  URLSearchParams,
  CustomEvent: class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  },
  dispatchEvent() { return true; },
  OnyxCommandCore: { getCurrentUserId: () => "user-one" },
  chestSupabase: {
    functions: {
      async invoke(name, options) {
        invocations.push({ name, options });
        if (options.body.action === "status") {
          return { data: { ok: true, connected: false, readyToAuthorise: true, reviewStatus: "ready" }, error: null };
        }
        if (options.body.action === "begin") {
          return {
            data: {
              ok: true,
              authorizeUrl: "https://api-dot-pgdragonsong.appspot.com/api/authorize?client_id=public-id&scopes=atlas.read%2Cplayer.public.read"
            },
            error: null
          };
        }
        return { data: { ok: true }, error: null };
      }
    }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(browserSource, sandbox);

(async () => {
  const auth = sandbox.OnyxWarDragonsAuth;
  assert.ok(auth);
  const status = await auth.refreshStatus();
  assert.equal(status.phase, "ready");
  assert.equal(status.connected, false);
  assert.equal(await auth.beginAuthorization(), true);
  assert.match(assignedUrl, /^https:\/\/api-dot-pgdragonsong\.appspot\.com\/api\/authorize\?/);
  assert.deepEqual(invocations.map(call => call.options.body.action), ["status", "begin"]);
  assert.ok(invocations.every(call => call.name === "onyx-war-dragons-oauth"));
  console.log("Onyx multi-player War Dragons authorisation security checks passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
