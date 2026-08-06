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

function buildIndependentPlatinumSequence(limit = 200) {
  const mainDeckKey = "platinum_chest";
  const mainDeck = event.decks[mainDeckKey] || [];
  const mainDrops = event.drops[mainDeckKey] || [];
  const poolCursors = {};
  const sequence = [];
  const mainStart = Math.min(17, Math.max(0, mainDeck.length - 1));

  for (let offset = 0; offset < limit; offset += 1) {
    const mainValue =
      mainDeck[(mainStart + offset) % mainDeck.length];
    const poolKey = mainDrops[mainValue]?.id;
    const poolDeck = event.decks[poolKey] || [];
    const poolDrops = event.drops[poolKey] || [];
    const poolCursor = poolCursors[poolKey] || 0;
    const poolValue = poolDeck[poolCursor % poolDeck.length];
    const definition = poolDrops[poolValue];

    if (!poolKey || !poolDeck.length || !definition) {
      throw new Error("The Platinum nested deck could not build a test sequence.");
    }

    sequence.push({
      code: definition.id,
      amount: Number(definition.mu)
    });
    poolCursors[poolKey] = poolCursor + 1;
  }

  return sequence;
}

const sequence = buildIndependentPlatinumSequence();

function findReward(code, amount) {
  const matches = LivePredictorEngine
    .getRewards("platinum")
    .filter(reward =>
      reward.code === code &&
      Number(reward.amount) === amount
    );

  if (!matches.length) {
    throw new Error(`Missing reward option: ${code} ${amount}`);
  }

  return matches[0];
}

LivePredictorEngine.setPlayerIdentity("player-a");
LivePredictorEngine.resetHistory("platinum");

let playerASolution = null;
let recordedSequence = [];

for (const entry of sequence) {
  const reward = findReward(entry.code, entry.amount);
  LivePredictorEngine.recordReward("platinum", {
    reward: reward.raw
  });

  playerASolution = LivePredictorEngine.solvePosition("platinum");
  recordedSequence.push(entry);

  if (!playerASolution.matched) {
    throw new Error(
      `Player A stopped matching after ${entry.code} ${entry.amount}: ${playerASolution.message}`
    );
  }

  if (playerASolution.solved) {
    break;
  }
}

if (!playerASolution?.solved) {
  throw new Error(
    "Player A did not solve its independent Platinum position within 200 rewards."
  );
}

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

const firstReward = findReward(
  recordedSequence[0].code,
  recordedSequence[0].amount
);
LivePredictorEngine.recordReward("platinum", {
  reward: firstReward.raw
});

if (LivePredictorEngine.getObservations("platinum").length !== 1) {
  throw new Error("Player B could not save independent progress.");
}

LivePredictorEngine.setPlayerIdentity("player-a");

if (
  LivePredictorEngine.getObservations("platinum").length !==
  recordedSequence.length
) {
  throw new Error("Player A progress was not restored after account switch.");
}

console.log(JSON.stringify({
  event: event.event,
  poisonedPublishedCursors: Object.keys(event.deckIndices).length,
  playerA: {
    observations: recordedSequence.length,
    matched: playerASolution.matched,
    confidence: playerASolution.confidence,
    predictions: playerAPredictions.length
  },
  playerB: {
    observations: 1
  }
}, null, 2));
