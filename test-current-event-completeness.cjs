const fs = require("fs");
const vm = require("vm");

const storage = new Map();
global.window = global;
global.document = { addEventListener() {} };
global.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
global.addEventListener = () => {};
global.dispatchEvent = () => true;
global.CustomEvent = class CustomEvent {};
global.atob = value => Buffer.from(value, "base64").toString("binary");

for (const file of [
  "event-parser.js",
  "har-event-adapter.js",
  "js/har-gacha-parser.js",
  "live-predictor-engine.js"
]) {
  vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file });
}

const harPath = process.argv[2];
if (!harPath) throw new Error("Provide the current event HAR path.");

const harText = fs.readFileSync(harPath, "utf8");
const event = EventParser.parse(harText);
const captured = HarGachaParser.parse(harText);
const chestTypes = ["gold", "platinum", "draconic", "freedom", "arcane", "super_sigil"];
const availableOpeningTypes = ["gold", "platinum", "draconic", "arcane"];

if (event.readyChestCount !== chestTypes.length || !event.ready) {
  throw new Error(`Expected ${chestTypes.length} ready chests; found ${event.readyChestCount}.`);
}

if (captured.unknownSpinTypes.length) {
  throw new Error(`Unlabelled captured chest types: ${captured.unknownSpinTypes.join(", ")}`);
}

const capturedOpeningTypes = [...new Set(
  captured.openings
    .filter(opening => !opening.isBonus)
    .map(opening => opening.parentChestKey || opening.chestKey)
)].sort();

if (
  JSON.stringify(capturedOpeningTypes) !==
  JSON.stringify([...availableOpeningTypes].sort())
) {
  throw new Error(
    `Expected one opening from each available chest (${availableOpeningTypes.join(", ")}); found ${capturedOpeningTypes.join(", ")}.`
  );
}

if (captured.totalRegularChestsOpened !== availableOpeningTypes.length) {
  throw new Error(
    `Expected ${availableOpeningTypes.length} captured openings; found ${captured.totalRegularChestsOpened}.`
  );
}

const capturedPlatinumSigil = captured.openings
  .find(opening => opening.parentChestKey === "platinum")
  ?.rewards.find(reward => reward.id === "misfitriseSigil");

if (
  capturedPlatinumSigil?.name !== "Misfitrise Sigil" ||
  capturedPlatinumSigil?.knownName !== true
) {
  throw new Error("The captured Platinum reward was not labelled Misfitrise Sigil.");
}

for (const chestType of chestTypes) {
  const chest = event.chests?.[chestType];
  if (!chest?.found || !chest.deckLength || chest.warnings?.length) {
    throw new Error(`${chestType} is incomplete: ${JSON.stringify(chest?.warnings || [])}`);
  }
}

LivePredictorEngine.publishEventData(event);

const technicalNamePattern =
  /(?:consumable|^e\d+q\d+|^chest\d+$|crystal(?:dark|earth|fire|ice|wind)gemstone|innerfire\d*|foodpack_?\d*)/i;
const catalogueSizes = {};

for (const chestType of chestTypes) {
  const rewards = LivePredictorEngine.getRewards(chestType);
  catalogueSizes[chestType] = rewards.length;

  if (!rewards.length) throw new Error(`${chestType} has no selectable rewards.`);

  for (const reward of rewards) {
    if (!reward.name || technicalNamePattern.test(reward.name) || reward.name === reward.code) {
      throw new Error(`${chestType} exposes a technical reward name: ${reward.name || reward.code}`);
    }
  }

  const owner = `capture-owner-${chestType}`;
  const other = `independent-player-${chestType}`;
  LivePredictorEngine.setPlayerIdentity(owner);
  LivePredictorEngine.resetHistory(chestType);
  const first = rewards[0];
  LivePredictorEngine.recordReward(chestType, { reward: first.raw });

  LivePredictorEngine.setPlayerIdentity(other);
  if (LivePredictorEngine.getObservations(chestType).length !== 0) {
    throw new Error(`${chestType} leaked the capture owner's history to another player.`);
  }
  if (LivePredictorEngine.predictUpcoming(5, chestType).length !== 0) {
    throw new Error(`${chestType} gave a new player account-specific predictions.`);
  }
}

const sharedJson = JSON.stringify({
  event: event.event,
  chests: event.chests,
  decks: event.decks,
  drops: event.drops
});

for (const privateMarker of [
  "player_id", "session_token", "pocket_id", "deck_indices", "sourceEntryIndex"
]) {
  if (sharedJson.toLowerCase().includes(privateMarker.toLowerCase())) {
    throw new Error(`Shared event output contains private marker: ${privateMarker}`);
  }
}

console.log(JSON.stringify({
  event: event.event,
  readyChests: event.readyChestCount,
  catalogueSizes,
  selectableRewardVariations: Object.values(catalogueSizes).reduce((a, b) => a + b, 0),
  capturedOpeningRequests: captured.requestCount,
  capturedOpeningTypes,
  unknownCapturedSpinTypes: captured.unknownSpinTypes,
  playerIsolation: "passed",
  technicalRewardNames: "none"
}, null, 2));
