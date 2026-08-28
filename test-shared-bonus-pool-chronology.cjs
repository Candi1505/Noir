const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();

global.window = global;
global.document = {
  readyState: "loading",
  addEventListener() {},
  getElementById() {
    return null;
  }
};
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

const reward = (code, amount) => ({
  id: code,
  code,
  name: code,
  mu: amount
});

LivePredictorEngine.publishEventData({
  event: "Shared bonus pool chronology regression",
  ready: true,
  chests: {
    gold: {
      found: true,
      key: "gold_chest",
      deck: [0, 1, 0],
      deckLength: 3,
      bonusEvery: 30
    }
  },
  decks: {
    gold_chest: [0, 1, 0],
    epic_items: [0, 1, 2],
    legendary_items: [0, 1, 2, 3]
  },
  drops: {
    gold_chest: [
      { id: "epic_items" },
      { id: "legendary_items" }
    ],
    epic_items: [
      reward("E0", 10),
      reward("E1", 11),
      reward("E2", 12)
    ],
    legendary_items: [
      reward("A", 20),
      reward("B", 21),
      reward("C", 22),
      reward("D", 23)
    ]
  },
  deckIndices: {},
  spinTypes: [
    {
      credit_spin_currency: "chest4",
      drops: { default: { gold_chest: 1 } }
    },
    {
      costOptions: { chest4: 1 },
      drops: { default: { legendary_items: 1 } }
    }
  ]
});

LivePredictorEngine.setPlayerIdentity(
  "shared-bonus-pool-chronology"
);
LivePredictorEngine.resetHistory("gold");

const catalogue = LivePredictorEngine.getRewards("gold");
const byCode = code => {
  const found = catalogue.find(entry => entry.code === code);
  assert.ok(found, `Missing synthetic reward ${code}.`);
  return found;
};
const record = (code, isBonus = false) =>
  LivePredictorEngine.recordReward("gold", {
    reward: byCode(code).raw,
    isBonus
  });

record("E0");
record("A");
record("B", true);
record("E1");

const solution = LivePredictorEngine.solvePosition("gold");
assert.equal(solution.solved, true);
assert.equal(
  solution.currentIndex,
  2,
  "A bonus claim must not advance the Gold root-deck cursor."
);

LivePredictorEngine.setBonusProgress("gold", 30, {
  silent: true
});

const predictions =
  LivePredictorEngine.predictUpcoming(3, "gold");
const predictedBonus = predictions[0];
const predictedRegular = predictions.filter(
  entry => !entry.isBonus
);

assert.equal(predictedBonus.isBonus, true);
assert.equal(
  predictedBonus.code,
  "C",
  "The upcoming Gold bonus must take the next Legendary pool entry."
);
assert.deepEqual(
  predictedRegular.slice(0, 2).map(entry => entry.code),
  ["E2", "D"],
  "After bonus C consumes the shared pool, the next regular Legendary draw must advance to D."
);

LivePredictorEngine.setPlayerIdentity(
  "shared-bonus-pool-ambiguous"
);
LivePredictorEngine.resetHistory("gold");

record("E0");
record("E1");

const ambiguousSolution =
  LivePredictorEngine.solvePosition("gold");
assert.equal(
  ambiguousSolution.candidateCount,
  1,
  "The synthetic root-deck position should be unique."
);
assert.equal(
  ambiguousSolution.solved,
  false,
  "An unseen shared Legendary pool must remain unresolved."
);
assert.ok(
  ambiguousSolution.independentCandidates[0]
    .poolStarts.legendary_items.length > 1,
  "The shared bonus-pool cursor should have multiple possible positions."
);

LivePredictorEngine.setBonusProgress("gold", 30, {
  silent: true
});

const ambiguousBonus =
  LivePredictorEngine.predictUpcoming(3, "gold")[0];
assert.equal(ambiguousBonus.isBonus, true);
assert.equal(
  ambiguousBonus.exactBonusReward,
  false,
  "An unresolved direct shared-pool cursor must not produce an exact bonus reward."
);
assert.equal(
  ambiguousBonus.code,
  "gold_bonus",
  "An unresolved direct shared pool must stay generic instead of falling through to bonus-only matching."
);

console.log(JSON.stringify({
  mainCurrent: solution.currentIndex,
  bonus: predictedBonus.code,
  nextRegular: predictedRegular.slice(0, 2).map(entry => entry.code),
  ambiguousBonus: {
    code: ambiguousBonus.code,
    exact: ambiguousBonus.exactBonusReward
  }
}, null, 2));
