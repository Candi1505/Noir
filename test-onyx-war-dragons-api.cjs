const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("onyx-command.css", "utf8");
const source = fs.readFileSync("onyx-war-dragons-api.js", "utf8");
const authSource = fs.readFileSync("onyx-war-dragons-auth.js", "utf8");
const appSource = fs.readFileSync("app.js", "utf8");

assert.match(html, /id="onyxWdApiTest"/);
assert.match(html, /id="onyxWdShapeOutput"/);
assert.match(html, /id="onyxWdProfilePanel"/);
assert.match(html, /id="onyxWdApplyProfile"/);
assert.match(html, /onyx-war-dragons-api\.js\?v=20260828-castle-hunter-1/);
assert.match(html, /onyx-war-dragons-auth\.js\?v=20260828-player-oauth-1/);
assert.match(html, /onyx-command\.css\?v=20260828-war-dragons-profile-3/);
assert.match(css, /\.onyx-api-link/);
assert.match(css, /\.onyx-wd-dossier/);
assert.match(css, /\.onyx-wd-metric-grid/);
assert.match(source, /FUNCTION_NAME = "onyx-war-dragons"/);
assert.match(source, /PROFILE_RESOURCE = "profile"/);
assert.match(source, /client\.functions\.invoke/);
assert.match(source, /body: \{ resource: PROFILE_RESOURCE \}/);
assert.match(source, /function atlasMacro/);
assert.match(source, /function atlasCritical/);
assert.match(source, /function atlasInfo/);
assert.doesNotMatch(source, /localStorage|sessionStorage|console\.(?:log|warn|error)/);
assert.doesNotMatch(source, /\.innerHTML\s*=/);
assert.doesNotMatch(source, /WAR_DRAGONS_(?:API_KEY|CLIENT_SECRET)/);
assert.doesNotMatch(source, /\p{Extended_Pictographic}/u);
assert.doesNotMatch(authSource, /localStorage|sessionStorage|console\.(?:log|warn|error)/);
assert.doesNotMatch(authSource, /WAR_DRAGONS_(?:API_KEY|CLIENT_SECRET)|client_secret/);
assert.match(authSource, /FUNCTION_NAME = "onyx-war-dragons-oauth"/);
assert.match(appSource, /async function applyOfficialProfile/);
assert.match(appSource, /applyOfficialProfile,/);

const sandbox = {
  window: null,
  document: {
    readyState: "loading",
    addEventListener() {},
    getElementById() { return null; }
  },
  navigator: {},
  CustomEvent: class CustomEvent {},
  setTimeout() {},
  clearTimeout() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const shape = sandbox.OnyxWarDragonsAPI.describeShape({
  player: {
    name: "Private player value",
    level: 999,
    enabled: true
  },
  castles: [{ id: "private-id", glory: 1234 }],
  "1234567890123456": { value: "private-map-value" }
});

assert.match(shape, /^\$: object/m);
assert.match(shape, /\$\.player\.name: string/);
assert.match(shape, /\$\.player\.level: integer/);
assert.match(shape, /\$\.castles: array/);
assert.match(shape, /\$\.castles\[\]\.glory: integer/);
assert.match(shape, /\$\.\[dynamic-key\]: object/);
assert.doesNotMatch(shape, /Private player value|private-id|private-map-value|1234|999/);

let invocation = null;
let appliedIdentity = null;
sandbox.OnyxCommandCore = {
  getCurrentUserId: () => "owner-user",
  async applyOfficialProfile(identity) {
    appliedIdentity = identity;
    return "cloud";
  }
};
sandbox.chestSupabase = {
  functions: {
    async invoke(name, options) {
      invocation = { name, options };
      if (options.body.resource === "atlasCritical") {
        return {
          data: {
            ok: true,
            resource: "atlasCritical",
            data: { observedAt: 1787875200, records: [] }
          },
          error: null
        };
      }
      return {
        data: {
          ok: true,
          resource: "profile",
          fetchedAt: "2026-08-28T00:00:00.000Z",
          data: {
            name: "Verified Commander",
            guild_name: "Onyx Guild",
            guild_pos: "Officer",
            online: true,
            xp: 403,
            defense_power: 295000000,
            roster_power: 412000000,
            "attack_win_%": "88%",
            "defense_win_%": "74%",
            battle: { attacks: { n: 50, won: 44 } },
            elos: { overall: 2100, attack: 2200, defense: 2000 },
            activeness: { label: "Active", level: 4, score: 98.5 },
            epochs: { last_seen: 1787875200 },
            trophies: { lifetime: 123456, weekly: 789 },
            top_dragons: [{ id: "private-roster-id", attack_power: 987654321 }]
          }
        },
        error: null
      };
    }
  }
};
sandbox.dispatchEvent = () => true;

(async () => {
  const profile = await sandbox.OnyxWarDragonsAPI.verifyProfile();
  assert.equal(invocation.name, "onyx-war-dragons");
  assert.equal(invocation.options.body.resource, "profile");
  assert.equal(profile.xp, 403);
  assert.equal(sandbox.OnyxWarDragonsAPI.getProfile().xp, 403);
  const mapped = sandbox.OnyxWarDragonsAPI.getMappedProfile();
  assert.equal(mapped.name, "Verified Commander");
  assert.equal(mapped.guildName, "Onyx Guild");
  assert.equal(mapped.playerXp, 403);
  assert.doesNotMatch(source, /"Player level"/);
  assert.equal(mapped.defencePower, 295000000);
  assert.equal(mapped.attacksWon, 44);
  assert.equal(mapped.topDragons[0].attackPower, 987654321);
  assert.equal(await sandbox.OnyxWarDragonsAPI.applyVerifiedIdentity(), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(appliedIdentity)),
    { nickname: "Verified Commander", alliance_name: "Onyx Guild" }
  );
  const critical = await sandbox.OnyxWarDragonsAPI.atlasCritical(["42-A1-1"]);
  assert.equal(invocation.options.body.resource, "atlasCritical");
  assert.deepEqual(invocation.options.body.castleIds, ["42-A1-1"]);
  assert.equal(critical.observedAt, 1787875200);
  console.log("Onyx official API link privacy and response-shape checks passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
