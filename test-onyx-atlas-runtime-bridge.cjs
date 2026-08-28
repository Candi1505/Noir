const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const coreSource = fs.readFileSync("onyx-atlas-castle-hunter-core.js", "utf8");
const hunterSource = fs.readFileSync("onyx-atlas-castle-hunter.js", "utf8");
const commandSource = fs.readFileSync("onyx-atlas-command.js", "utf8");

assert.match(
  hunterSource,
  /snapshot = prepared;[\s\S]*?syncAtlasCommandSnapshot\(prepared\)/,
  "An imported or restored Hunter snapshot must update Atlas Command."
);
assert.match(
  hunterSource,
  /snapshot = Core\.mergeOfficialMacro\(snapshot, macro\);[\s\S]*?syncAtlasCommandSnapshot\(snapshot\)/,
  "An official macro refresh must update Atlas Command."
);
assert.match(
  hunterSource,
  /snapshot = Core\.mergeOfficialCritical\(snapshot, live\);[\s\S]*?syncAtlasCommandSnapshot\(snapshot\)/,
  "Every successful live critical batch must update Atlas Command."
);
assert.match(
  commandSource,
  /activeMode === "live" \? "#oacLiveCastle" : "#oacCastle"/,
  "Live castle jumps must focus the live-card identifier."
);
assert.doesNotMatch(
  commandSource,
  /!liveConnection\.connected\s*\?\s*renderLiveLockedState\(\)/,
  "A verified imported snapshot must render even before the official account link is active."
);

const sandbox = {
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Set,
  Map,
  String,
  Number,
  Boolean,
  RegExp,
  Intl,
  document: {},
  addEventListener() {},
  OnyxAtlasCommand: { setLiveSnapshot() {} }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreSource, sandbox);
vm.runInContext(hunterSource, sandbox);

const now = 10_000;
const snapshot = JSON.parse(JSON.stringify(sandbox.OnyxAtlasCastleHunter.toCommandSnapshot({
  schemaVersion: 2,
  capturedAt: 9_000,
  lastLiveAt: 9_900,
  records: [
    {
      coordinate: "42-A1-1",
      name: "Open Keep",
      ownerTeam: "Team One",
      regionName: "North",
      tier: 5,
      guards: 12345,
      source: "official",
      shield: { state: "down", observedAt: now, endAt: null }
    },
    {
      coordinate: "42-A1-2",
      tier: 4,
      shield: { state: "cooldown", observedAt: now, endAt: now + 600 }
    },
    {
      coordinate: "42-A1-3",
      tier: 3,
      shield: { state: "active", observedAt: now, endAt: now + 3600 }
    },
    {
      coordinate: "42-A1-4",
      tier: 2,
      shield: { state: "active", observedAt: now, endAt: now + 10_000 }
    },
    {
      coordinate: "42-A1-5",
      tier: 2,
      shield: { state: "down", observedAt: now - 601, endAt: null }
    },
    {
      coordinate: "42-A1-6",
      tier: 2,
      shield: { state: "active", observedAt: now, endAt: now - 1 }
    }
  ]
}, now)));

assert.equal(snapshot.source, "Mixed Atlas sources");
assert.equal(snapshot.fetchedAt, new Date(9_900 * 1000).toISOString());
assert.equal(snapshot.castles.length, 6);
assert.equal(snapshot.castles[0].shieldState, "vulnerable");
assert.equal(snapshot.castles[0].attackable, false);
assert.equal(snapshot.castles[0].troops, 12345);
assert.equal(snapshot.castles[0].source, "War Dragons API");
assert.equal(snapshot.castles[1].name, "42-A1-2");
assert.equal(snapshot.castles[1].troops, null);
assert.equal(snapshot.castles[1].shieldState, "cooldown");
assert.equal(snapshot.castles[1].cooldownEndsAt, new Date((now + 600) * 1000).toISOString());
assert.equal(snapshot.castles[1].shieldEndsAt, null);
assert.equal(snapshot.castles[2].shieldState, "dropping");
assert.equal(snapshot.castles[2].shieldEndsAt, new Date((now + 3600) * 1000).toISOString());
assert.equal(snapshot.castles[3].shieldState, "shielded");
assert.equal(snapshot.castles[4].shieldState, "unknown");
assert.equal(snapshot.castles[4].attackable, false);
assert.equal(snapshot.castles[5].shieldState, "unknown");

const imported = JSON.parse(JSON.stringify(sandbox.OnyxAtlasCastleHunter.toCommandSnapshot({
  capturedAt: 8_000,
  records: [{
    coordinate: "42-A2-1",
    tier: 3,
    shield: { state: "unknown", observedAt: null, endAt: null }
  }]
}, 8_000)));
assert.equal(imported.source, "Atlas capture");
assert.equal(imported.fetchedAt, new Date(8_000 * 1000).toISOString());
assert.equal(imported.castles[0].source, "Atlas capture");

console.log("Onyx Atlas Hunter-to-Command runtime bridge checks passed.");
