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
global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

vm.runInThisContext(
  fs.readFileSync("live-predictor-engine.js", "utf8"),
  { filename: "live-predictor-engine.js" }
);

const chestConfig = {
  gold: ["gold_chest", "gold_chest_bonus", 30],
  platinum: ["platinum_chest", "platinum_chest_bonus", 30],
  draconic: ["dragfrag_chest_tier3", "dragfrag_chest_tier3_bonus", 30],
  freedom: ["freedom_chest", "freedom_chest_bonus", 15],
  arcane: ["arcane_chest", "arcane_chest_bonus", 15]
};

const event = {
  schema: "noir-live-event-v1",
  event: "Player isolation regression",
  ready: true,
  readyChestCount: 5,
  chests: {},
  decks: {},
  drops: {},
  deckIndices: {}
};

for (const [chestType, [mainKey, bonusKey, cadence]] of
  Object.entries(chestConfig)) {
  const regularRewards = Array.from({ length: 7 }, (_, index) => ({
    name: `${chestType}-regular-${index + 1}`,
    amount: index + 1
  }));
  const bonusRewards = Array.from({ length: 3 }, (_, index) => ({
    name: `${chestType}-bonus-${index + 1}`,
    amount: (index + 1) * 10
  }));
  const regularDeck = regularRewards.map((_, index) => index);
  const bonusDeck = bonusRewards.map((_, index) => index);

  event.chests[chestType] = {
    found: true,
    key: mainKey,
    deck: regularDeck,
    deckLength: regularDeck.length,
    bonusEvery: cadence
  };
  event.decks[mainKey] = regularDeck;
  event.decks[bonusKey] = bonusDeck;
  event.drops[mainKey] = regularRewards;
  event.drops[bonusKey] = bonusRewards;
}

LivePredictorEngine.publishEventData(event);

const report = {};

for (const [chestType, [, , cadence]] of Object.entries(chestConfig)) {
  const captureOwner = `capture-owner-${chestType}`;
  const freshPlayer = `fresh-player-${chestType}`;

  LivePredictorEngine.setPlayerIdentity(captureOwner);
  LivePredictorEngine.resetHistory(chestType);
  LivePredictorEngine.setBonusProgress(
    chestType,
    cadence - 2,
    { silent: true }
  );

  const regularReward = LivePredictorEngine
    .getRewards(chestType)
    .find(reward =>
      reward.name.toLowerCase().includes(`${chestType} regular 1`)
    );

  if (!regularReward) {
    throw new Error(`${chestType}: regular reward is missing`);
  }

  LivePredictorEngine.recordReward(chestType, {
    reward: regularReward.raw
  });

  const ownerSolution = LivePredictorEngine.solvePosition(chestType);
  const ownerPredictions = LivePredictorEngine.predictUpcoming(5, chestType);

  if (!ownerSolution.solved || ownerSolution.confidence !== 100) {
    throw new Error(`${chestType}: capture owner did not solve independently`);
  }

  if (!ownerPredictions.some(prediction => prediction.isBonus)) {
    throw new Error(`${chestType}: due bonus was not inserted`);
  }

  LivePredictorEngine.setPlayerIdentity(freshPlayer);

  if (LivePredictorEngine.getObservations(chestType).length !== 0) {
    throw new Error(`${chestType}: observations leaked to a fresh player`);
  }

  if (LivePredictorEngine.predictUpcoming(5, chestType).length !== 0) {
    throw new Error(`${chestType}: a fresh player inherited predictions`);
  }

  LivePredictorEngine.setPlayerIdentity(captureOwner);

  if (LivePredictorEngine.getObservations(chestType).length !== 1) {
    throw new Error(`${chestType}: capture-owner progress was not restored`);
  }

  report[chestType] = {
    captureOwnerSolved: true,
    freshPlayerStartedEmpty: true,
    progressRestoredAfterAccountSwitch: true,
    bonusEvery: cadence
  };
}

console.log(JSON.stringify(report, null, 2));
