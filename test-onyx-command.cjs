const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const commandSource = fs.readFileSync("onyx-command.js", "utf8");
const baseSource = fs.readFileSync("onyx-base-command.js", "utf8");
const commandCss = fs.readFileSync("onyx-command.css", "utf8");
const chestToolsSource = fs.readFileSync("noir-chest-tools.js", "utf8");
const livePredictorSource = fs.readFileSync("live-predictor-ui.js", "utf8");
const towerBridgeSource = fs.readFileSync("onyx-tower-inventory-bridge.js", "utf8");
const profileSql = fs.readFileSync("supabase/onyx_command_profile_state.sql", "utf8");
const databaseSource = fs.readFileSync("database.js", "utf8");

assert.match(html, /<title>Onyx Command/);
assert.equal((html.match(/class="onyx-command-card /g) || []).length, 6);
assert.equal((html.match(/class="navigation-button/g) || []).length, 3);
assert.doesNotMatch(html, /<script[^>]+base-planner\.js/);
assert.match(commandSource, /max="40"/);
assert.match(commandSource, /Brickscale[\s\S]+19503/);
assert.match(commandSource, /Charged Volt Tower[\s\S]+38800/);
assert.match(commandSource, /90,803 sigils/);
assert.match(commandSource, /Wave 1/);
assert.doesNotMatch(
  html + commandSource + chestToolsSource + livePredictorSource,
  /\p{Extended_Pictographic}/u,
  "The Onyx mobile shell must use its SVG icon system instead of emoji."
);
assert.match(
  html,
  /live-predictor-ui\.js\?v=20260827-onyx-predictor-1/
);
assert.match(html, /onyx-tower-inventory-bridge\.js\?v=20260827-base-command-1/);
assert.match(html, /onyx-base-command\.js\?v=20260827-clean-route-1/);
assert.match(html, /onyx-command\.css\?v=20260827-clean-route-1/);
assert.match(livePredictorSource, /ONYX COMMAND · CHEST INTELLIGENCE/);
assert.match(livePredictorSource, /aria-pressed/);
assert.match(livePredictorSource, /data-lp-chest-type/);
assert.match(livePredictorSource, /lp-active-glint/);
assert.match(livePredictorSource, /prefers-reduced-motion/);
assert.doesNotMatch(livePredictorSource, /gold:\s*["']G["']/);

assert.match(baseSource, /TACTICAL MAP REQUIRED/);
assert.match(baseSource, /Array\.from\(\{ length: TOTAL_SLOTS \}, \(\) => null\)/);
assert.match(baseSource, /const MAP_WIDTH = 760/);
assert.match(baseSource, /const MAP_HEIGHT = 500/);
assert.doesNotMatch(baseSource, /class="base-zone/);
assert.match(baseSource, /class="route-segment lower-right-run"/);
assert.match(baseSource, /class="route-segment upper-right-run"/);
assert.match(baseSource, /class="route-segment left-run"/);
assert.match(baseSource, /marker-end="url\(#obcRouteArrow\)"/);
assert.match(baseSource, /zone: "left-run"/);
assert.match(baseSource, /zone: "upper-right"/);
assert.match(baseSource, /zone: "lower-right"/);
assert.equal((baseSource.match(/zone: "left-run"/g) || []).length, 3);
assert.equal((baseSource.match(/zone: "upper-right"/g) || []).length, 3);
assert.equal((baseSource.match(/zone: "lower-right"/g) || []).length, 2);
assert.match(baseSource, /name: "Gateway"[^\n]+zone: "lower-right"[^\n]+x: 530/);
assert.match(baseSource, /name: "Command Crown"[^\n]+zone: "left-run"[^\n]+x: 116/);
assert.match(baseSource, /form: "bend-left"/);
assert.match(baseSource, /form: "bend-right"/);
assert.match(baseSource, /obc-island-axis/);
assert.match(baseSource, /DEFENCE ROUTE SCHEMATIC/);
assert.match(baseSource, /Dragon flight path/);
assert.doesNotMatch(baseSource, /obc-island-ridge/);
assert.match(commandCss, /\.obc-spot-field \.spot-1 \{ left: 27%; top: 31%; \}/);
assert.match(commandCss, /\.obc-spot-field \.spot-4 \{ left: 73%; top: 69%; \}/);
assert.match(commandCss, /\.obc-spot-field \.spot-5 \{ left: 50%; top: 50%; \}/);
assert.match(commandCss, /\.obc-occupancy i:nth-child\(5\)[^}]+translate\(-50%, -50%\)/);
assert.match(baseSource, /Estimated tower DP/);
assert.match(baseSource, /Estimated island DP/);
assert.match(baseSource, /Estimated total base DP/);
assert.match(baseSource, /DP SANDBOX/);
assert.match(baseSource, /BASE ADVISOR LOCKED/);
assert.match(baseSource, /Move mode active/);
assert.match(baseSource, /Swap towers/);
assert.doesNotMatch(baseSource, /Math\.pow|closestRow|nearest(?:Level|Row)|defensivePower\s*=/i);
assert.doesNotMatch(baseSource, /dragstart|dragover|drop\s*\(|draggable/i);
assert.doesNotMatch(baseSource, /War Dragons artwork|terrain|dragon artwork/i);
const intelSection = html.match(/<section id="intelView"[\s\S]*?<!-- ======================================\s+HISTORY VIEW/)[0];
assert.doesNotMatch(intelSection, /\bHAR\b|captur|sanitis|labelled by source/i);
assert.doesNotMatch(commandSource, /\bHAR\b|captur|sanitis/i);
assert.doesNotMatch(baseSource, /(?:Upload|Import|Open|Choose|Review)[^"\n<]{0,40}\bHAR\b/i);
assert.match(baseSource, /id="obcPrivateInventoryFile"/);
assert.match(baseSource, /JSON\.parse\(await file\.text\(\)\)/);
assert.match(baseSource, /role="tablist"/);
assert.match(baseSource, /aria-selected=/);
assert.match(baseSource, /prefersReducedMotion\(\) \? "auto" : "smooth"/);
assert.match(baseSource, /!overlay\.contains\(document\.activeElement\)/);
assert.match(baseSource, /openedForUser !== currentUser/);
assert.match(baseSource, /OnyxTowerInventoryBridge\?\.clear\?\.\(\)/);
assert.match(baseSource, /placedCount\(record\.type, record\.level, excludedSlot\) - earlierQuantity/);
assert.match(baseSource, /syncDraftIndicators\(overlay\)/);
const deleteFlow = baseSource.match(/#obcDeleteLayout[\s\S]*?#obcGoToBuilder/)[0];
assert.ok(
  deleteFlow.indexOf("await saver.call") < deleteFlow.indexOf("layout = null"),
  "A profile-backed layout must not disappear locally before cloud deletion succeeds."
);
assert.match(deleteFlow, /layout was kept because Onyx could not delete the profile copy/);
assert.match(profileSql, /jsonb_array_length\(candidate -> 'slots'\) = 40/);
assert.match(profileSql, /top_level\.key not in \('version', 'name', 'slots', 'updatedAt'\)/);
assert.match(profileSql, /slot_field\.key not in \('type', 'level', 'notes'\)/);
assert.match(profileSql, /octet_length\(candidate::text\) <= 32768/);
assert.match(profileSql, /alter table public\.player_base_layouts enable row level security/i);
assert.match(profileSql, /revoke all on table public\.player_base_layouts from anon, authenticated/i);
assert.match(profileSql, /\(select auth\.uid\(\)\) = user_id/g);
assert.match(databaseSource, /\.from\("player_base_layouts"\)/);
assert.match(databaseSource, /\.eq\("user_id", user\.id\)/);
assert.match(databaseSource, /updated_at: cleanLayout\.updatedAt/);
assert.doesNotMatch(towerBridgeSource, /localStorage|sessionStorage|indexedDB|XMLHttpRequest|\bfetch\s*\(/);

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
    getItem: () => null,
    setItem() {},
    removeItem() {}
  },
  document: {
    readyState: "loading",
    addEventListener() {}
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("base-adviser-catalog-towers.js", "utf8"), sandbox);
vm.runInContext(baseSource, sandbox);

const blankLayout = sandbox.OnyxBaseCommand.createLayout("Test Base");
assert.equal(blankLayout.name, "Test Base");
assert.equal(blankLayout.slots.length, 40);
assert.equal(blankLayout.slots.every(slot => slot === null), true);
assert.equal(sandbox.OnyxBaseCommand.getTowerRecord("Archer Tower", 1).level, 1);
assert.equal(sandbox.OnyxBaseCommand.getTowerRecord("Archer Tower", 999), null);

blankLayout.slots[0] = { type: "Archer Tower", level: 1, notes: "" };
blankLayout.slots[5] = { type: "Manual Future Tower", level: 301, notes: "Kept manually" };
const estimate = JSON.parse(JSON.stringify(sandbox.OnyxBaseCommand.estimateLayout(blankLayout)));
assert.deepEqual(estimate.total, {
  value: 8,
  placed: 2,
  known: 1,
  unavailable: 1
});
assert.deepEqual(estimate.islands[0], {
  value: 8,
  placed: 1,
  known: 1,
  unavailable: 0
});
assert.deepEqual(estimate.islands[1], {
  value: 0,
  placed: 1,
  known: 0,
  unavailable: 1
});
assert.equal(sandbox.OnyxBaseCommand.estimateLayout({ name: "Bad", slots: [] }), null);

console.log("Onyx tactical map, estimate boundaries and profile isolation checks passed.");
