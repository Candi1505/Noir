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
global.CustomEvent = class CustomEvent {};

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
  event: "Nested bonus safety regression",
  ready: true,
  chests: {
    platinum: {
      found: true,
      key: "platinum_chest",
      deck: [0, 1],
      deckLength: 2,
      bonusEvery: 30
    }
  },
  decks: {
    platinum_chest: [0, 1],
    epic_plat_items: [0, 1],
    legendary_plat_items: [0, 1],
    platinum_chest_bonus: [0]
  },
  drops: {
    platinum_chest: [
      { id: "epic_plat_items" },
      { id: "legendary_plat_items" }
    ],
    epic_plat_items: [
      reward("E0", 10),
      reward("E1", 11)
    ],
    legendary_plat_items: [
      reward("L0", 20),
      reward("L1", 21)
    ],
    platinum_chest_bonus: [
      { id: "legendary_plat_items" }
    ]
  },
  deckIndices: {}
});

LivePredictorEngine.setPlayerIdentity(
  "nested-bonus-safety"
);
LivePredictorEngine.resetHistory("platinum");

const catalogue =
  LivePredictorEngine.getRewards("platinum");
const byCode = code => {
  const found = catalogue.find(
    entry => entry.code === code
  );
  assert.ok(found, `Missing synthetic reward ${code}.`);
  return found;
};
const record = (code, isBonus = false) =>
  LivePredictorEngine.recordReward("platinum", {
    reward: byCode(code).raw,
    isBonus
  });

record("E0");
record("L0");
record("L1", true);
record("E1");
record("L0");

const solution =
  LivePredictorEngine.solvePosition("platinum");

assert.equal(
  solution.solved,
  true,
  "The fixture must fully solve the regular and shared pool cursors."
);

LivePredictorEngine.setBonusProgress(
  "platinum",
  30,
  { silent: true }
);

const predictedBonus =
  LivePredictorEngine.predictUpcoming(
    3,
    "platinum"
  )[0];

assert.equal(predictedBonus?.isBonus, true);
assert.equal(
  predictedBonus?.exactBonusReward,
  false,
  "A separate nested bonus root must stay generic until its own root cursor can be solved safely."
);
assert.equal(
  predictedBonus?.code,
  "platinum_bonus"
);

console.log(JSON.stringify({
  solved: solution.solved,
  bonus: predictedBonus.code,
  exact: predictedBonus.exactBonusReward
}, null, 2));
