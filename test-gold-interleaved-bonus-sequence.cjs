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
global.atob = value =>
  Buffer.from(value, "base64").toString("binary");

for (const file of [
  "event-parser.js",
  "har-event-adapter.js",
  "live-predictor-engine.js"
]) {
  vm.runInThisContext(
    fs.readFileSync(file, "utf8"),
    { filename: file }
  );
}

const harPath = process.argv[2];

if (!harPath) {
  throw new Error("Provide the current event HAR path.");
}

const event = EventParser.parse(
  fs.readFileSync(harPath, "utf8")
);

LivePredictorEngine.publishEventData(event, {
  sourceFile: "gold-interleaved-bonus-regression.har"
});
LivePredictorEngine.setPlayerIdentity(
  "gold-interleaved-bonus-regression"
);
LivePredictorEngine.resetHistory("gold");

const catalogue =
  LivePredictorEngine.getRewards("gold");

const sequence = [
  {
    name: "1.4M Lumber Packs",
    amount: 1,
    isBonus: false
  },
  {
    name: "Fire Shards",
    amount: 3000,
    isBonus: true
  },
  {
    name: "Black Pearls",
    amount: 300,
    isBonus: false
  },
  {
    name: "Dragon HP Boost",
    amount: 25,
    isBonus: false
  },
  {
    name: "1.4M Lumber Packs",
    amount: 1,
    isBonus: false
  }
];

function findReward({ name, amount, isBonus }) {
  const reward = catalogue.find(option =>
    option.name === name &&
    Number(option.amount) === amount &&
    (
      isBonus
        ? option.bonusEligible
        : option.regularEligible
    )
  );

  assert.ok(
    reward,
    `Gold catalogue is missing ${name} x${amount} in ${
      isBonus ? "bonus" : "regular"
    } mode.`
  );

  return reward;
}

const acceptance = [];

for (const entry of sequence) {
  const reward = findReward(entry);
  const observationCountBefore =
    LivePredictorEngine.getObservations("gold").length;

  assert.doesNotThrow(
    () => LivePredictorEngine.recordReward("gold", {
      reward: reward.raw,
      isBonus: entry.isBonus
    }),
    `${entry.name} x${entry.amount} must be accepted as ${
      entry.isBonus ? "a bonus" : "a regular"
    } Gold reward.`
  );

  assert.equal(
    LivePredictorEngine.getObservations("gold").length,
    observationCountBefore + 1,
    "Every accepted Gold reward must be recorded exactly once."
  );

  const partialSolution =
    LivePredictorEngine.solvePosition("gold");

  assert.equal(
    partialSolution.matched,
    true,
    `Gold sequence stopped matching after ${entry.name} x${entry.amount}.`
  );

  acceptance.push({
    name: entry.name,
    amount: entry.amount,
    isBonus: entry.isBonus,
    candidates: partialSolution.candidateCount
  });
}

const solution =
  LivePredictorEngine.solvePosition("gold");
const expectedCandidates = [
  2,
  5,
  28,
  35,
  66,
  80,
  84,
  87
];

assert.equal(
  solution.matched,
  true,
  "The complete interleaved Gold sequence must match the current deck."
);
assert.deepEqual(
  [...solution.candidates].sort((first, second) => first - second),
  expectedCandidates,
  "The complete interleaved Gold sequence located the wrong main-deck candidates."
);
assert.equal(
  solution.independentCandidates.length,
  expectedCandidates.length,
  "Every main-deck candidate must retain its nested-pool state."
);

const legendaryDeckLength =
  event.decks?.legendary_items?.length;
const epicDeckLength =
  event.decks?.epic_items?.length;

assert.ok(
  legendaryDeckLength > 3,
  "The HAR is missing the current legendary_items pool."
);
assert.ok(
  epicDeckLength > 2,
  "The HAR is missing the current epic_items pool."
);

for (const candidate of solution.independentCandidates) {
  assert.deepEqual(
    candidate.poolStarts.legendary_items,
    [0],
    `Main candidate ${candidate.mainStart} has the wrong legendary pool start.`
  );
  assert.deepEqual(
    candidate.poolStarts.epic_items,
    [0],
    `Main candidate ${candidate.mainStart} has the wrong epic pool start.`
  );

  const legendaryObservations =
    candidate.observationsByPool.legendary_items;
  const epicObservations =
    candidate.observationsByPool.epic_items;

  assert.deepEqual(
    legendaryObservations.map(observation => ({
      name: observation.name,
      amount: observation.amount,
      isBonus: observation.isBonus
    })),
    [
      {
        name: "1.4M Lumber Packs",
        amount: 1,
        isBonus: false
      },
      {
        name: "Fire Shards",
        amount: 3000,
        isBonus: true
      },
      {
        name: "1.4M Lumber Packs",
        amount: 1,
        isBonus: false
      }
    ],
    "The Gold bonus must advance the shared legendary pool between regular rewards."
  );

  assert.deepEqual(
    epicObservations.map(observation => ({
      name: observation.name,
      amount: observation.amount,
      isBonus: observation.isBonus
    })),
    [
      {
        name: "Black Pearls",
        amount: 300,
        isBonus: false
      },
      {
        name: "Dragon HP Boost",
        amount: 25,
        isBonus: false
      }
    ],
    "The regular Epic observations must keep their own independent pool cursor."
  );

  const legendaryNextCursors =
    candidate.poolStarts.legendary_items.map(start =>
      (
        start +
        legendaryObservations.length
      ) % legendaryDeckLength
    );
  const epicNextCursors =
    candidate.poolStarts.epic_items.map(start =>
      (
        start +
        epicObservations.length
      ) % epicDeckLength
    );

  assert.deepEqual(
    legendaryNextCursors,
    [3],
    "The legendary cursor must advance three places, including the bonus Fire Shards."
  );
  assert.deepEqual(
    epicNextCursors,
    [2],
    "The Epic cursor must advance only for its two regular rewards."
  );
}

console.log(JSON.stringify({
  event: event.event,
  acceptedSequence: acceptance,
  candidates: [...solution.candidates]
    .sort((first, second) => first - second),
  poolCursors: {
    legendary_items: 3,
    epic_items: 2
  }
}, null, 2));
