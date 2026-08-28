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

const regularRewards = [
  {
    id: "gold-regular-only",
    code: "gold-regular-only",
    name: "Gold Regular Only",
    amount: 10
  },
  {
    id: "gold-shared",
    code: "gold-shared",
    name: "Gold Shared Reward",
    amount: 20
  }
];

const goldBonusRewards = [
  {
    id: "gold-bonus-only",
    code: "gold-bonus-only",
    name: "Gold Bonus Only",
    amount: 30
  },
  regularRewards[1]
];

const unrelatedDraconicBonusRewards = [
  {
    id: "draconic-bonus-only",
    code: "draconic-bonus-only",
    name: "Draconic Bonus Only",
    amount: 999
  }
];

const event = {
  schema: "noir-live-event-v1",
  event: "Fresh-player sequence guard regression",
  ready: true,
  readyChestCount: 1,
  chests: {
    gold: {
      found: true,
      key: "gold_chest",
      deck: [0, 1],
      deckLength: 2,
      bonusEvery: 30
    }
  },
  decks: {
    gold_chest: [0, 1],
    legendary_items: [0, 1],
    dragfrag_chest_tier3_bonus: [0]
  },
  drops: {
    gold_chest: regularRewards,
    legendary_items: goldBonusRewards,
    dragfrag_chest_tier3_bonus:
      unrelatedDraconicBonusRewards
  },
  deckIndices: {},
  spinTypes: [
    {
      id: "gold_regular_spin",
      credit_spin_currency: "chest4",
      drops: {
        default: {
          gold_chest: 1
        }
      }
    },
    {
      id: "gold_bonus_claim",
      costOptions: {
        chest4: 1
      },
      drops: {
        default: {
          legendary_items: 1
        }
      }
    }
  ]
};

LivePredictorEngine.publishEventData(event);

const catalogue =
  LivePredictorEngine.getRewards("gold");
const byCode = code =>
  catalogue.find(reward => reward.code === code);

const regularOnly = byCode("gold-regular-only");
const bonusOnly = byCode("gold-bonus-only");
const shared = byCode("gold-shared");

assert.ok(regularOnly, "Gold regular reward is missing.");
assert.ok(bonusOnly, "Configured Gold bonus reward is missing.");
assert.ok(shared, "Reward shared by both Gold pools is missing.");
assert.equal(
  byCode("draconic-bonus-only"),
  undefined,
  "Gold must not borrow an unrelated Draconic bonus deck."
);

assert.deepEqual(
  {
    regularEligible: regularOnly.regularEligible,
    bonusEligible: regularOnly.bonusEligible
  },
  {
    regularEligible: true,
    bonusEligible: false
  },
  "A regular-only reward must not be offered as a Gold bonus reward."
);
assert.deepEqual(
  {
    regularEligible: bonusOnly.regularEligible,
    bonusEligible: bonusOnly.bonusEligible
  },
  {
    regularEligible: false,
    bonusEligible: true
  },
  "A bonus-only reward must not be offered as a regular Gold reward."
);
assert.deepEqual(
  {
    regularEligible: shared.regularEligible,
    bonusEligible: shared.bonusEligible
  },
  {
    regularEligible: true,
    bonusEligible: true
  },
  "A reward present in both pools must remain eligible in both modes."
);

LivePredictorEngine.setPlayerIdentity(
  "fresh-player-sequence-guard"
);
LivePredictorEngine.resetHistory("gold");
LivePredictorEngine.setBonusProgress(
  "gold",
  5,
  { silent: true }
);

LivePredictorEngine.recordReward("gold", {
  reward: regularOnly.raw
});

const observationsBefore =
  LivePredictorEngine.getObservations("gold");
const bonusProgressBefore =
  LivePredictorEngine.getBonusProgress("gold");

let mismatchError = null;

try {
  LivePredictorEngine.recordReward("gold", {
    reward: bonusOnly.raw
  });
} catch (error) {
  mismatchError = error;
}

assert.ok(
  mismatchError,
  "An impossible regular observation must be rejected."
);
assert.equal(
  mismatchError.code,
  "NO_SEQUENCE_MATCH",
  "The recorder must expose the sequence-mismatch error code."
);
assert.match(
  mismatchError.message,
  /not saved/i,
  "The rejection must tell the player that the bad reward was not saved."
);
assert.deepEqual(
  LivePredictorEngine.getObservations("gold"),
  observationsBefore,
  "Rejected input must leave the player's observation history unchanged."
);
assert.equal(
  LivePredictorEngine.getBonusProgress("gold"),
  bonusProgressBefore,
  "Rejected input must also restore the player's bonus progress."
);

const transactionalGuardResult = {
  observations:
    LivePredictorEngine.getObservations("gold").length,
  bonusProgress:
    LivePredictorEngine.getBonusProgress("gold")
};

LivePredictorEngine.setPlayerIdentity(
  "fresh-player-first-bonus-guard"
);
LivePredictorEngine.resetHistory("gold");

assert.throws(
  () => LivePredictorEngine.recordReward("gold", {
    reward: regularOnly.raw,
    isBonus: true
  }),
  error =>
    error?.code === "NO_SEQUENCE_MATCH" &&
    /not saved/i.test(error.message),
  "An impossible first bonus reward must be rejected immediately."
);
assert.equal(
  LivePredictorEngine.getObservations("gold").length,
  0,
  "A rejected first bonus must not create player history."
);

console.log(JSON.stringify({
  goldCatalogue: catalogue.map(reward => ({
    code: reward.code,
    regularEligible: reward.regularEligible,
    bonusEligible: reward.bonusEligible
  })),
  observationsAfterRejectedInput:
    transactionalGuardResult.observations,
  bonusProgressAfterRejectedInput:
    transactionalGuardResult.bonusProgress,
  firstBonusRejectedWithoutHistory:
    LivePredictorEngine.getObservations("gold").length === 0,
  rejectionCode: mismatchError.code
}, null, 2));
