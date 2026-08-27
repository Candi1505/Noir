const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const source = fs.readFileSync("onyx-atlas-command.js", "utf8");
const css = fs.readFileSync("onyx-atlas-command.css", "utf8");
const commandSource = fs.readFileSync("onyx-command.js", "utf8");

assert.match(html, /onyx-atlas-command\.css\?v=20260828-atlas-command-1/);
assert.match(html, /onyx-atlas-command\.js\?v=20260828-atlas-command-1/);
assert.ok(
  html.indexOf("onyx-atlas-command.js") < html.indexOf("onyx-command.js"),
  "Atlas Command must load before the dashboard routes to it."
);
assert.match(commandSource, /if \(command === "atlas"\)[\s\S]*?OnyxAtlasCommand/);
assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource/);
assert.doesNotMatch(source, /client[_-]?secret|api[_-]?key|authorization\s*:/i);
assert.doesNotMatch(source, /sessionToken|cookie|pocket_id|support_id|password/i);
assert.doesNotMatch(source + css, /\p{Extended_Pictographic}/u);
assert.match(source, /FICTIONAL DEMO INTELLIGENCE/);
assert.match(source, /No player or team data is shown/);
assert.match(source, /PRIVATE MANUAL SNAPSHOT/);
assert.match(source, /Nothing is connected/);
assert.match(source, /does not infer an opponent’s plans/);
assert.match(source, /Onyx is not inferring hostile intent/);
assert.match(source, /Official Atlas connection/);
assert.match(source, /Not registered/);
assert.match(source, /secure server-side connection/);
assert.match(source, /atlas\.read/);
assert.match(source, /player\.public\.read/);
assert.match(source, /Save snapshot/);
assert.match(source, /Reset changes/);
assert.match(source, /Clear manual snapshot/);
assert.match(source, /Battle ledger/);
assert.match(source, /Castle watchboard/);
assert.match(source, /Contribution board/);
assert.match(source, /TACTICAL NETWORK/);
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
    removeEventListener() {}
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
    { id: "one unsafe", name: "  Rook  ", troops: 250, status: "support", unknown: "drop" },
    { name: "", troops: 900 }
  ],
  castles: [
    { id: "C 1", name: "Ember", troops: 500, fleets: 3, shieldHours: 1.27, status: "watch" }
  ],
  battles: [
    { opponent: "Ash", destruction: 130, side: "invalid", result: "loss", shipsLost: -4 }
  ],
  forbidden: "drop"
})));

assert.equal(normalised.version, 1);
assert.equal(normalised.team.name, "Night Guard");
assert.equal(normalised.team.totalTroops, 0);
assert.equal(normalised.team.monthlyGold, 1200);
assert.equal(normalised.team.monthlyMaterials, null);
assert.equal(normalised.team.monthlyShips, 9999999);
assert.equal(normalised.members.length, 1);
assert.equal(normalised.members[0].id, "one-unsafe");
assert.equal(normalised.members[0].status, "support");
assert.equal(normalised.castles[0].shieldHours, 1.3);
assert.equal(normalised.battles[0].destruction, 100);
assert.equal(normalised.battles[0].side, "defence");
assert.equal(normalised.battles[0].shipsLost, 0);
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

console.log("Onyx Atlas Command regression checks passed.");
