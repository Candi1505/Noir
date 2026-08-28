const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const commandSource = fs.readFileSync("onyx-command.js", "utf8");
const seasonSource = fs.readFileSync("onyx-season-data.js", "utf8");
const riderDataSource = fs.readFileSync("onyx-rider-intelligence-data.js", "utf8");
const baseSource = fs.readFileSync("onyx-base-command.js", "utf8");
const fortificationSource = fs.readFileSync("onyx-fortification-command.js", "utf8");
const warDragonsApiSource = fs.readFileSync("onyx-war-dragons-api.js", "utf8");
const warDragonsAuthSource = fs.readFileSync("onyx-war-dragons-auth.js", "utf8");
const commandCss = fs.readFileSync("onyx-command.css", "utf8");
const chestToolsSource = fs.readFileSync("noir-chest-tools.js", "utf8");
const livePredictorSource = fs.readFileSync("live-predictor-ui.js", "utf8");
const towerBridgeSource = fs.readFileSync("onyx-tower-inventory-bridge.js", "utf8");
const profileSql = fs.readFileSync("supabase/onyx_command_profile_state.sql", "utf8");
const databaseSource = fs.readFileSync("database.js", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");

assert.match(html, /<title>Onyx Command/);
assert.match(gitignore, /\*\.har\.zip/);
assert.equal((html.match(/class="onyx-command-card /g) || []).length, 6);
assert.equal((html.match(/class="navigation-button/g) || []).length, 3);
assert.doesNotMatch(html, /<script[^>]+base-planner\.js/);
assert.doesNotMatch(html, /<script[^>]+src="(?:base-adviser-catalog|predictor-ui|predictor-upload|noir-help|live-deck-inspector)\.js/);
assert.match(commandSource, /max="40"/);
assert.match(seasonSource, /Brickscale[\s\S]+19503/);
assert.match(seasonSource, /Charged Volt Tower[\s\S]+38800/);
assert.match(seasonSource, /logicalNodeCount: 558/);
assert.match(seasonSource, /preMythicKeyCount: 25/);
assert.equal((seasonSource.match(/slug: "/g) || []).length, 12);
assert.match(commandSource, /Wave 1/);
assert.match(commandSource, /planSeasonRoute/);
assert.match(commandSource, /Branch Explorer/);
assert.match(commandSource, /Current sigils/);
assert.match(commandSource, /Checkpoint detail needed/);
assert.doesNotMatch(
  seasonSource,
  /"(?:sessionToken|cookie|email|playerId|request|response|headers?)"\s*:/i
);
assert.doesNotMatch(
  html + commandSource + seasonSource + chestToolsSource + livePredictorSource + fortificationSource + warDragonsApiSource + warDragonsAuthSource,
  /\p{Extended_Pictographic}/u,
  "The Onyx mobile shell must use its SVG icon system instead of emoji."
);
assert.match(
  html,
  /live-predictor-ui\.js\?v=20260828-first-run-1/
);
assert.match(html, /onyx-tower-inventory-bridge\.js\?v=20260828-audit-2/);
assert.match(html, /database\.js\?v=20260828-audit-2/);
assert.match(html, /har-event-adapter\.js\?v=20260828-audit-2/);
assert.match(html, /live-predictor-engine\.js\?v=20260828-first-run-1/);
assert.match(html, /chest-drop-rates\.js\?v=20260828-audit-2/);
assert.match(html, /chest-planner\.js\?v=20260828-audit-2/);
assert.match(html, /noir-chest-tools\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-fortification-command\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-base-command\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-season-data\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-rider-intelligence-data\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-atlas-command\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-war-dragons-api\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-war-dragons-auth\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-command\.js\?v=20260828-audit-2/);
assert.doesNotMatch(commandSource, /Private source boundary/);
assert.match(html, /onyx-command\.css\?v=20260828-audit-2/);
assert.match(html, /onyx-atlas-command\.css\?v=20260828-audit-2/);
assert.match(html, /onyx-atlas-castle-hunter\.css\?v=20260828-audit-2/);
assert.match(html, /onyx-atlas-castle-hunter-core\.js\?v=20260828-audit-2/);
assert.match(html, /onyx-atlas-castle-hunter\.js\?v=20260828-audit-2/);
assert.match(commandSource, /window\.OnyxAtlasCommand\?\.open\?\.\("hunter"\)/);
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
assert.match(baseSource, /name: "Gateway"[^\n]+zone: "lower-right"[^\n]+x: 321[^\n]+y: 340/);
assert.match(baseSource, /name: "Ember Bend"[^\n]+zone: "lower-right"[^\n]+x: 445[^\n]+y: 260/);
assert.match(baseSource, /name: "Northglass Bend"[^\n]+zone: "upper-right"[^\n]+x: 338[^\n]+y: 140/);
assert.match(baseSource, /name: "Command Crown"[^\n]+zone: "left-run"[^\n]+x: 134[^\n]+y: 78/);
assert.match(commandCss, /--island-floor:/);
assert.match(commandCss, /\.obc-shell \.obc-tabs \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
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
assert.match(baseSource, /BASE SUPPORT NETWORK/);
assert.match(baseSource, /data-obc-tab="merge"/);
assert.match(baseSource, /data-obc-tab="fortification"/);
assert.match(baseSource, /Tower Merge Intelligence/);
assert.match(baseSource, /MERGE_TRANSFER_RATE = 0\.45/);
assert.match(baseSource, /WD preview result level/);
assert.match(baseSource, /Every figure is an estimate until WD shows the preview/);
assert.match(baseSource, /Base screenshot board/);
assert.match(baseSource, /This device only/);
assert.match(baseSource, /REFERENCE_STORAGE_PREFIX = "onyxBaseReferenceV1"/);
assert.doesNotMatch(baseSource, /verified NOIR model/);
assert.match(fortificationSource, /FORTIFICATION COMMAND/);
assert.match(fortificationSource, /Upgrade on route/);
assert.match(fortificationSource, /Reserve for merge/);
assert.match(fortificationSource, /Reserve for transform/);
assert.match(fortificationSource, /Estimate only/);
assert.match(fortificationSource, /exact published tower XP/);
assert.doesNotMatch(fortificationSource, /type="file"|\.importHar\s*\(|JSON\.parse\(await file\.text/);
assert.match(baseSource, /Monument loadout/);
assert.match(baseSource, /Riverwatch Perch/);
assert.match(baseSource, /Seagazer Perch/);
assert.match(baseSource, /Stonespear Perch/);
assert.match(baseSource, /Rider gear/);
assert.match(baseSource, /Only verified building HP and attack modifiers/);
assert.match(commandSource, /Rider command graph ready/);
assert.match(commandSource, /EXPLAINABLE MATCHING/);
assert.match(commandSource, /Onyx fit score/);
assert.match(commandSource, /not an in-game stat/);
assert.match(commandSource, /mutually exclusive skill-path choices/);
assert.match(commandCss, /\.onyx-rider-match-card\.lead/);
assert.doesNotMatch(
  riderDataSource,
  /sessionToken|pocket_id|support_id|cookie|authorization|signature|playerId|guild|email/i
);
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
assert.doesNotMatch(baseSource, /obcPrivateInventoryFile|obcOpenPrivateImport|importPrivateInventory/);
assert.doesNotMatch(baseSource, /JSON\.parse\(await file\.text\(\)\)|\.importHar\s*\(/);
assert.match(baseSource, /Published tower catalogue ready/);
assert.match(baseSource, /Each player records their own inventory and island layout manually/);
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
assert.match(profileSql, /jsonb_array_length\(candidate -> 'slots'\) <> 40/);
assert.match(profileSql, /is_valid_onyx_command_preferences/);
assert.match(profileSql, /misfitrise-wave-1/);
assert.match(profileSql, /'Patchmaw', 'Smirkle'/);
assert.match(profileSql, /"charged-volt-tower": 6/);
assert.match(profileSql, /currentSigils/);
assert.match(profileSql, /top_level\.key not in \('version', 'name', 'slots', 'perches', 'updatedAt'\)/);
assert.match(profileSql, /'type', 'level', 'notes', 'rune', 'glyph', 'relic'/);
assert.match(profileSql, /jsonb_array_length\(candidate -> 'perches'\) <> 3/);
assert.match(profileSql, /'head', 'chest', 'gloves', 'pants'/);
assert.match(profileSql, /octet_length\(candidate::text\) <= 65536/);
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
vm.runInContext(fs.readFileSync("base-adviser-catalog-monuments.js", "utf8"), sandbox);
vm.runInContext(fs.readFileSync("base-adviser-catalog-people.js", "utf8"), sandbox);
vm.runInContext(riderDataSource, sandbox);
vm.runInContext(fortificationSource, sandbox);
vm.runInContext(baseSource, sandbox);
vm.runInContext(seasonSource, sandbox);
vm.runInContext(commandSource, sandbox);

const riderData = JSON.parse(JSON.stringify(sandbox.OnyxRiderIntelligenceData));
assert.equal(riderData.riderCount, 71);
assert.equal(riderData.skillNodeCount, 1952);
assert.equal(riderData.gearRecordCount, 2847);
assert.equal(riderData.profiles.length, 71);
assert.ok(riderData.profiles.every(profile => profile.name && profile.skillNodes > 0));
const hunterControlMatches = JSON.parse(JSON.stringify(sandbox.OnyxCommand.scoreRiderProfiles({
  mission: "flight",
  dragonClass: "hunter",
  priority: "control"
})));
assert.ok(hunterControlMatches.length >= 40);
assert.ok(hunterControlMatches[0].score >= hunterControlMatches[1].score);
assert.ok(hunterControlMatches[0].components.some(component => ["rage", "ammo", "spell"].includes(component.bucket)));
const baseMatches = JSON.parse(JSON.stringify(sandbox.OnyxCommand.scoreRiderProfiles({
  mission: "base",
  dragonClass: "hunter",
  priority: "endurance"
})));
assert.ok(baseMatches.length > 0);
assert.ok(baseMatches[0].components.some(component => component.bucket === "baseHealth"));
assert.ok(baseMatches.some(match => match.defensive));

const zeroRoute = JSON.parse(JSON.stringify(sandbox.OnyxCommand.planSeasonRoute()));
assert.equal(zeroRoute.claimedKeys, 0);
assert.equal(zeroRoute.plannedKeys, 20);
assert.equal(zeroRoute.additionalSigils, 90803);
assert.deepEqual(
  zeroRoute.selection.map(item => [item.branch, item.addedKeys, item.sigils]),
  [
    ["Brickscale", 6, 19503],
    ["Mission Bonus", 1, 6600],
    ["Base Boost", 6, 19500],
    ["Charged Volt Tower", 6, 38800],
    ["Cosmic Orrery", 1, 6400]
  ]
);

const progressedRoute = JSON.parse(JSON.stringify(sandbox.OnyxCommand.planSeasonRoute({
  branchKeys: {
    "brickscale": 6,
    "mission-bonus": 1,
    "base-boost": 6,
    "charged-volt-tower": 6,
    "cosmic-orrery": 0,
    "bloodstone": 0
  }
})));
assert.equal(progressedRoute.claimedKeys, 19);
assert.equal(progressedRoute.additionalKeys, 1);
assert.equal(progressedRoute.additionalSigils, 6400);
assert.deepEqual(progressedRoute.selection.map(item => item.branch), ["Cosmic Orrery"]);

const savedSeasonState = JSON.parse(JSON.stringify(sandbox.OnyxCommand.normaliseCommandState({
  currentKeys: 23,
  currentSigils: 45678,
  mythicChoice: "Smirkle",
  branchKeys: { "brickscale": 99, "bloodstone": 2, unknown: 4 }
})));
assert.equal(savedSeasonState.version, 2);
assert.equal(savedSeasonState.currentSigils, 45678);
assert.equal(savedSeasonState.mythicChoice, "Smirkle");
assert.equal(savedSeasonState.branchKeys.brickscale, 6);
assert.equal(savedSeasonState.branchKeys.bloodstone, 2);
assert.equal("unknown" in savedSeasonState.branchKeys, false);

const blankLayout = sandbox.OnyxBaseCommand.createLayout("Test Base");
assert.equal(blankLayout.name, "Test Base");
assert.equal(blankLayout.version, 2);
assert.equal(blankLayout.slots.length, 40);
assert.equal(blankLayout.slots.every(slot => slot === null), true);
assert.equal(blankLayout.perches.length, 3);
assert.equal(blankLayout.perches[1].name, "Seagazer Perch");
assert.equal(sandbox.OnyxBaseCommand.getTowerRecord("Archer Tower", 1).level, 1);
assert.equal(sandbox.OnyxBaseCommand.getTowerRecord("Archer Tower", 999), null);

const blankFort = JSON.parse(JSON.stringify(sandbox.OnyxFortificationCommand.blankDraft()));
assert.equal(blankFort.currentPlayerLevel, 600);
assert.equal(blankFort.targetPlayerLevel, 601);
assert.equal(blankFort.inventory.length, 0);
assert.ok(sandbox.OnyxFortificationCommand.playerXpForLevel(601) > 1959262);

const fortRoute = JSON.parse(JSON.stringify(sandbox.OnyxFortificationCommand.planFortification({
  currentPlayerLevel: 600,
  targetPlayerLevel: 601,
  currentProgressXp: 0,
  maximumTowerLevel: 250,
  inventory: [
    { id: "route", type: "Archer Tower", level: 1, quantity: 1, location: "base", action: "upgrade" },
    { id: "merge", type: "Cosmic Orrery", level: 230, quantity: 2, location: "storage", action: "merge" },
    { id: "transform", type: "Crystal Howitzer", level: 230, quantity: 1, location: "storage", action: "transform" }
  ]
})));
assert.equal(fortRoute.reached, true);
assert.equal(fortRoute.simulatedPlayerLevel, 601);
assert.ok(fortRoute.route.length > 0);
assert.equal(fortRoute.route.every(step => step.type === "Archer Tower"), true);
assert.equal(fortRoute.reserved.merge, 2);
assert.equal(fortRoute.reserved.transform, 1);

const heldFortRoute = sandbox.OnyxFortificationCommand.planFortification({
  currentPlayerLevel: 600,
  targetPlayerLevel: 601,
  maximumTowerLevel: 250,
  inventory: [{ id: "held", type: "Archer Tower", level: 1, quantity: 4, action: "hold" }]
});
assert.equal(heldFortRoute.ok, false);
assert.equal(heldFortRoute.route.length, 0);
assert.equal(heldFortRoute.reserved.hold, 4);

const mergeEstimate = JSON.parse(JSON.stringify(sandbox.OnyxBaseCommand.estimateMerge({
  destinationType: "Crystal Howitzer",
  destinationLevel: 230,
  sourceType: "Cosmic Orrery",
  sourceLevel: 230,
  quantity: 1,
  maximumTowerLevel: 250,
  previewResultLevel: ""
})));
assert.equal(mergeEstimate.ok, true);
assert.equal(mergeEstimate.transferRate, 0.45);
assert.equal(mergeEstimate.resultSource, "model");
assert.equal(mergeEstimate.resultLevel, 250);
assert.equal(mergeEstimate.levelsGained, 20);
assert.equal(mergeEstimate.xpDebt, 18181791);

const previewMerge = JSON.parse(JSON.stringify(sandbox.OnyxBaseCommand.estimateMerge({
  destinationType: "Crystal Howitzer",
  destinationLevel: 230,
  sourceType: "Cosmic Orrery",
  sourceLevel: 230,
  quantity: 1,
  maximumTowerLevel: 250,
  previewResultLevel: 245
})));
assert.equal(previewMerge.resultSource, "wd-preview");
assert.equal(previewMerge.modelResultLevel, 250);
assert.equal(previewMerge.resultLevel, 245);
assert.equal(previewMerge.xpDebt, 18733201);

const quantityMerge = JSON.parse(JSON.stringify(sandbox.OnyxBaseCommand.estimateMerge({
  destinationType: "Crystal Howitzer",
  destinationLevel: 230,
  sourceType: "Cosmic Orrery",
  sourceLevel: 230,
  quantity: 2,
  maximumTowerLevel: 250,
  previewResultLevel: ""
})));
assert.equal(quantityMerge.ok, true);
assert.equal(quantityMerge.sourceXp, mergeEstimate.sourceXp * 2);
assert.equal(quantityMerge.transferredValue, mergeEstimate.transferredValue * 2);

const cappedMerge = JSON.parse(JSON.stringify(sandbox.OnyxBaseCommand.estimateMerge({
  destinationType: "Crystal Howitzer",
  destinationLevel: 230,
  sourceType: "Cosmic Orrery",
  sourceLevel: 230,
  quantity: 1,
  maximumTowerLevel: 233,
  previewResultLevel: ""
})));
assert.equal(cappedMerge.ok, true);
assert.equal(cappedMerge.resultLevel, 233);
assert.equal(cappedMerge.capped, true);
assert.equal(cappedMerge.xpDebt, 20056585);

assert.equal(
  sandbox.OnyxBaseCommand.estimateMerge({
    destinationType: "Crystal Howitzer",
    destinationLevel: 230,
    sourceType: "Cosmic Orrery",
    sourceLevel: 230,
    quantity: 1,
    maximumTowerLevel: 250,
    previewResultLevel: 229
  }).ok,
  false
);
assert.equal(
  sandbox.OnyxBaseCommand.estimateMerge({
    destinationType: "Crystal Howitzer",
    destinationLevel: 999,
    sourceType: "Cosmic Orrery",
    sourceLevel: 230,
    quantity: 1,
    maximumTowerLevel: 999
  }).ok,
  false
);

blankLayout.slots[5] = {
  type: "Archer Tower",
  level: 100,
  notes: "",
  glyph: { name: "Common Archer Attack Glyph", level: 2 }
};
const monumentEstimate = sandbox.OnyxBaseCommand.estimateLayout(blankLayout);
assert.ok(monumentEstimate.total.monumentGain > 0);
assert.ok(monumentEstimate.total.value > monumentEstimate.total.baseValue);

blankLayout.perches[1] = {
  ...blankLayout.perches[1],
  level: 30,
  dragonName: "Aevros",
  riderName: "Freeda",
  towerBonus: "tower-health-15",
  skills: [{ name: "Increase Archer Tower's HP", level: 5 }]
};
const perchEstimate = sandbox.OnyxBaseCommand.estimateLayout(blankLayout);
assert.ok(perchEstimate.total.riderGain > 0);
assert.ok(perchEstimate.total.perchGain > 0);

blankLayout.slots[0] = { type: "Archer Tower", level: 1, notes: "" };
blankLayout.slots[5] = { type: "Manual Future Tower", level: 301, notes: "Kept manually" };
const estimate = JSON.parse(JSON.stringify(sandbox.OnyxBaseCommand.estimateLayout(blankLayout)));
assert.deepEqual(estimate.total, {
  value: 8,
  baseValue: 8,
  monumentGain: 0,
  riderGain: 0,
  perchGain: 0,
  placed: 2,
  known: 1,
  unavailable: 1
});
assert.deepEqual(estimate.islands[0], {
  value: 8,
  baseValue: 8,
  monumentGain: 0,
  riderGain: 0,
  perchGain: 0,
  placed: 1,
  known: 1,
  unavailable: 0
});
assert.deepEqual(estimate.islands[1], {
  value: 0,
  baseValue: 0,
  monumentGain: 0,
  riderGain: 0,
  perchGain: 0,
  placed: 1,
  known: 0,
  unavailable: 1
});
assert.equal(sandbox.OnyxBaseCommand.estimateLayout({ name: "Bad", slots: [] }), null);

console.log("Onyx tactical map, estimate boundaries and profile isolation checks passed.");
