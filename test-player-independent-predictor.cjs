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

// Deliberately poison every captured cursor. Player results must not change.
event.deckIndices = Object.fromEntries(
  Object.keys(event.decks || {}).map(key => [key, 987654321])
);

LivePredictorEngine.publishEventData(event, {
  sourceFile: "player-independent-test.har"
});

const sequence = [
  ["Elemental Embers", 4000],
  ["Elemental Embers", 600],
  ["Urbanflare Sigils", 200],
  ["Ice Shards", 2500],
  ["Egg Tokens", 2800],
  ["12-Hour Speedups", 15],
  ["12-Hour Speedups", 100, true],
  ["Egg Tokens", 2800],
  ["Ice Shards", 2500]
];

function findReward(name, amount) {
  const matches = LivePredictorEngine
    .getRewards("platinum")
    .filter(reward =>
      reward.name.toLowerCase() === name.toLowerCase() &&
      Number(reward.amount) === amount
    );

  if (!matches.length) {
    throw new Error(`Missing reward option: ${name} ${amount}`);
  }

  return matches[0];
}

LivePredictorEngine.setPlayerIdentity("player-a");
LivePredictorEngine.resetHistory("platinum");

for (const [name, amount, isBonus = false] of sequence) {
  const reward = findReward(name, amount);
  LivePredictorEngine.recordReward("platinum", {
    reward: reward.raw,
    isBonus
  });

  const solution = LivePredictorEngine.solvePosition("platinum");
  if (!solution.matched) {
    throw new Error(
      `Player A stopped matching after ${name} ${amount}: ${solution.message}`
    );
  }
}

const playerASolution =
  LivePredictorEngine.solvePosition("platinum");
const playerAPredictions =
  LivePredictorEngine.predictUpcoming(20, "platinum");

if (!playerAPredictions.length) {
  throw new Error(
    "Player A matched Platinum but received no predictions."
  );
}

LivePredictorEngine.setPlayerIdentity("player-b");

if (LivePredictorEngine.getObservations("platinum").length) {
  throw new Error("Player A history leaked into Player B.");
}

const firstReward = findReward(...sequence[0]);
LivePredictorEngine.recordReward("platinum", {
  reward: firstReward.raw
});

if (LivePredictorEngine.getObservations("platinum").length !== 1) {
  throw new Error("Player B could not save independent progress.");
}

LivePredictorEngine.setPlayerIdentity("player-a");

if (
  LivePredictorEngine.getObservations("platinum").length !==
  sequence.length
) {
  throw new Error("Player A progress was not restored after account switch.");
}

console.log(JSON.stringify({
  event: event.event,
  poisonedPublishedCursors: Object.keys(event.deckIndices).length,
  playerA: {
    observations: sequence.length,
    matched: playerASolution.matched,
    confidence: playerASolution.confidence,
    predictions: playerAPredictions.length
  },
  playerB: {
    observations: 1
  }
}, null, 2));
