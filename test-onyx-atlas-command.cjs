const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const source = fs.readFileSync("onyx-atlas-command.js", "utf8");
const css = fs.readFileSync("onyx-atlas-command.css", "utf8");
const commandSource = fs.readFileSync("onyx-command.js", "utf8");
const hunterSource = fs.readFileSync("onyx-atlas-castle-hunter.js", "utf8");
const hunterCss = fs.readFileSync("onyx-atlas-castle-hunter.css", "utf8");
const hunterCore = fs.readFileSync("onyx-atlas-castle-hunter-core.js", "utf8");
const hunterWorker = fs.readFileSync("onyx-atlas-har-worker.js", "utf8");

assert.match(html, /onyx-atlas-command\.css\?v=20260828-atlas-live-1/);
assert.match(html, /onyx-atlas-command\.js\?v=20260828-castle-hunter-1/);
assert.match(html, /onyx-war-dragons-auth\.js\?v=20260828-player-oauth-1/);
assert.match(html, /onyx-atlas-castle-hunter\.css\?v=20260828-production-1/);
assert.match(html, /onyx-atlas-castle-hunter-core\.js\?v=20260828-production-1/);
assert.match(html, /onyx-atlas-castle-hunter\.js\?v=20260828-production-1/);
assert.ok(
  html.indexOf("onyx-atlas-command.js") < html.indexOf("onyx-command.js"),
  "Atlas Command must load before the dashboard routes to it."
);
assert.ok(
  html.indexOf("onyx-war-dragons-auth.js") < html.indexOf("onyx-atlas-command.js"),
  "The secure player-authorisation client must load before Atlas Command."
);
assert.match(commandSource, /if \(command === "atlas"\)[\s\S]*?OnyxAtlasCommand/);
assert.match(commandSource, /OnyxAtlasCommand\?\.open\?\.\("hunter"\)/);
assert.match(source, /\["hunter", "castle", "Hunter"\]/);
assert.match(source, /OnyxAtlasCastleHunter\?\.mount/);
assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(source, /client[_-]?secret|api[_-]?key|authorization\s*:/i);
assert.doesNotMatch(source, /sessionToken|cookie|pocket_id|support_id|password/i);
assert.doesNotMatch(source + css, /\p{Extended_Pictographic}/u);
assert.doesNotMatch(hunterSource + hunterCss + hunterCore + hunterWorker, /\p{Extended_Pictographic}/u);
assert.match(hunterSource, /ATLAS CASTLE HUNTER/);
assert.match(hunterSource, /APR minimum/);
assert.match(hunterSource, /Critical gates/);
assert.match(hunterSource, /data-atlas-tier checked/);
assert.match(hunterSource, /Copy coordinates/);
assert.match(hunterSource, /LIVE_BATCH_SIZE = 100/);
assert.match(hunterWorker, /Only an allowlisted/);
assert.match(hunterWorker, /onyx-atlas-castle-hunter-core\.js\?v=20260828-production-1/);
assert.doesNotMatch(hunterSource, /WAR_DRAGONS_(?:API_KEY|CLIENT_SECRET)|client_secret/i);
assert.match(source, /FICTIONAL DEMO INTELLIGENCE/);
assert.match(source, /No player or team data is shown/);
assert.match(source, /PRIVATE MANUAL SNAPSHOT/);
assert.match(source, /Nothing is connected/);
assert.match(source, /does not infer an opponent’s plans/);
assert.match(source, /Onyx is not inferring hostile intent/);
assert.match(source, /Official Atlas connection/);
assert.match(source, /LIVE ATLAS FOUNDATION/);
assert.match(source, /PLAYER-AUTHORISED LINK/);
assert.match(source, /Approval pending/);
assert.match(source, /Vulnerable now/);
assert.match(source, /Shield cooldown/);
assert.match(source, /Shield dropping soon/);
assert.match(source, /Onyx will not infer a missing shield state/);
assert.match(source, /Missing timing remains missing/);
assert.match(source, /atlas\.read/);
assert.match(source, /player\.public\.read/);
assert.match(source, /Save snapshot/);
assert.match(source, /Reset changes/);
assert.match(source, /Clear manual snapshot/);
assert.match(source, /Battle ledger/);
assert.match(source, /Castle watchboard/);
assert.match(source, /Contribution board/);
assert.match(source, /TACTICAL NETWORK/);
assert.match(source, /Glory won/);
assert.match(source, /Prims lost/);
assert.match(source, /PRIMS DEFEATED/);
assert.doesNotMatch(source, />XP won</);
assert.doesNotMatch(source, />Ships lost</);
assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(60px, 1fr\)\)/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.doesNotMatch(source, /dragstart|dragover|draggable|drop\s*\(/i);

const storage = new Map();
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
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  document: {
    readyState: "loading",
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return null; }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const command = sandbox.OnyxAtlasCommand;
assert.ok(command);

const demo = JSON.parse(JSON.stringify(command.getDemoState()));
assert.equal(demo.team.name, "Obsidian Watch");
assert.equal(demo.members.length, 5);
assert.equal(demo.castles.length, 3);
assert.equal(demo.battles.length, 3);
assert.equal(demo.updatedAt, "Synthetic scenario");
assert.ok(demo.castles.every(castle => castle.id.startsWith("DEMO-")));

const normalised = JSON.parse(JSON.stringify(command.normaliseManualState({
  version: 900,
  team: {
    name: "  Night   Guard  ",
    alliance: " Accord ",
    totalTroops: -50,
    monthlyGold: "1200",
    monthlyMaterials: "not-a-number",
    monthlyShips: 999999999,
    eventScore: 3400,
    hiddenSecret: "must disappear"
  },
  members: [
    { id: "one unsafe", name: "  Rook  ", troops: 250, ships: 17, status: "support", unknown: "drop" },
    { name: "", troops: 900 }
  ],
  castles: [
    { id: "C 1", name: "Ember", troops: 500, fleets: 3, shieldHours: 1.27, status: "watch" }
  ],
  battles: [
    { opponent: "Ash", destruction: 130, side: "invalid", result: "loss", xp: 85, shipsLost: -4 }
  ],
  forbidden: "drop"
})));

assert.equal(normalised.version, 1);
assert.equal(normalised.team.name, "Night Guard");
assert.equal(normalised.team.totalTroops, 0);
assert.equal(normalised.team.monthlyGold, 1200);
assert.equal(normalised.team.monthlyMaterials, null);
assert.equal(normalised.team.monthlyPrims, 9999999);
assert.equal(normalised.members.length, 1);
assert.equal(normalised.members[0].id, "one-unsafe");
assert.equal(normalised.members[0].status, "support");
assert.equal(normalised.members[0].prims, 17);
assert.equal(normalised.castles[0].shieldHours, 1.3);
assert.equal(normalised.battles[0].destruction, 100);
assert.equal(normalised.battles[0].side, "defence");
assert.equal(normalised.battles[0].glory, 85);
assert.equal(normalised.battles[0].primsLost, 0);
assert.equal("forbidden" in normalised, false);
assert.equal("hiddenSecret" in normalised.team, false);
assert.equal("unknown" in normalised.members[0], false);

const alerts = JSON.parse(JSON.stringify(command.deriveAlerts(normalised)));
assert.ok(alerts.some(alert => /shield window/.test(alert.title)));
assert.ok(alerts.some(alert => /on watch/.test(alert.title)));
assert.ok(alerts.some(alert => /marked for support/.test(alert.title)));
assert.ok(alerts.some(alert => /not inferring hostile intent/.test(alert.detail)));

const exposed = JSON.parse(JSON.stringify(command.deriveAlerts({
  castles: [{ name: "Crown", troops: 700, shieldHours: 0, status: "clear" }]
})));
assert.equal(exposed.length, 1);
assert.match(exposed[0].title, /recorded unshielded/);

const emptyCondition = JSON.parse(JSON.stringify(command.commandCondition({})));
assert.equal(emptyCondition.label, "Awaiting intel");
const alertCondition = JSON.parse(JSON.stringify(command.commandCondition({
  castles: [{ name: "Crown", status: "contested" }]
})));
assert.equal(alertCondition.label, "Action watch");

const live = JSON.parse(JSON.stringify(command.setLiveSnapshot({
  fetchedAt: "2026-08-28T10:15:00.000Z",
  castles: [
    {
      id: " ATLAS/one ",
      name: "  Night   Gate  ",
      owner: "Ember Team",
      region: "North",
      level: 7,
      troops: "123456",
      fleets: 9,
      shieldState: "cooldown",
      cooldownEndsAt: "2026-08-28T11:15:00.000Z",
      attackable: false,
      source: "War Dragons API",
      rawApiKey: "must disappear"
    },
    { name: "Veil", shieldState: "invented", attackable: true },
    { name: "" }
  ],
  privateResponse: "drop"
})));
assert.equal(live.castles.length, 2);
assert.equal(live.castles[0].id, "ATLAS-one");
assert.equal(live.castles[0].name, "Night Gate");
assert.equal(live.castles[0].troops, 123456);
assert.equal(live.castles[0].shieldState, "cooldown");
assert.equal(live.castles[0].source, "War Dragons API");
assert.equal(live.castles[1].shieldState, "unknown");
assert.equal("rawApiKey" in live.castles[0], false);
assert.equal("privateResponse" in live, false);

console.log("Onyx Atlas Command regression checks passed.");
