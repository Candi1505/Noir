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
global.atob = value =>
  Buffer.from(value, "base64").toString("binary");

for (const file of [
  "event-parser.js",
  "har-event-adapter.js",
  "js/har-gacha-parser.js",
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

const harText = fs.readFileSync(harPath, "utf8");
const event = EventParser.parse(harText);
const captured = HarGachaParser.parse(harText);

LivePredictorEngine.publishEventData(event);

const catalogues = Object.fromEntries(
  ["gold", "platinum", "draconic", "freedom", "arcane"]
    .map(chestType => [
      chestType,
      LivePredictorEngine.getRewards(chestType)
    ])
);

const expectedScreenshotRewards = {
  platinum: [
    ["12 Hr Speedup", 15],
    ["Wind Crafting Gemstones", 1000],
    ["Elemental Embers", 600],
    ["Urbanflare Sigil", 500],
    ["Egg Tokens", 1200],
    ["3 Hr Speedup", 40],
    ["12 Hr Speedup", 30]
  ],
  gold: [
    ["Inner Fire", 6],
    ["Inner Fire", 20],
    ["Energy Packs", 15],
    ["Urbanflare Sigil", 225],
    ["3 Hr Speedup", 50]
  ]
};

for (const [chestType, expectedRewards] of
  Object.entries(expectedScreenshotRewards)) {
  for (const [name, amount] of expectedRewards) {
    const present = catalogues[chestType].some(
      reward =>
        reward.name === name &&
        Number(reward.amount) === amount
    );

    if (!present) {
      throw new Error(
        `${chestType} is missing the in-game reward label: ${name} ${amount}`
      );
    }
  }
}

// Lax's first four visible Platinum results must remain a valid sequence for
// the freshly published Archipelago deck. This catches stale-event and nested
// reward matching regressions without borrowing the capture owner's cursor.
LivePredictorEngine.setPlayerIdentity("lax-archipelago-regression");
LivePredictorEngine.resetHistory("platinum");

for (const [name, amount] of
  expectedScreenshotRewards.platinum.slice(0, 4)) {
  const reward = catalogues.platinum.find(
    option =>
      option.name === name &&
      Number(option.amount) === amount
  );

  LivePredictorEngine.recordReward("platinum", {
    reward: reward.raw
  });

  const solution =
    LivePredictorEngine.solvePosition("platinum");

  if (!solution.matched || solution.candidateCount < 1) {
    throw new Error(
      `Lax's Platinum sequence stopped matching after ${name} ${amount}.`
    );
  }
}

const laxPlatinumSolution =
  LivePredictorEngine.solvePosition("platinum");

const technicalNamePattern =
  /consumable|^e\d+q\d+|crystal(?:dark|earth|fire|ice|wind)gemstone|innerfire\d*|^chest\d+$/i;

for (const [chestType, rewards] of Object.entries(catalogues)) {
  for (const reward of rewards) {
    if (
      technicalNamePattern.test(reward.name) ||
      reward.name === reward.code
    ) {
      throw new Error(
        `${chestType} exposes a technical reward name: ${reward.name}`
      );
    }
  }
}

const capturedNames = captured.openings
  .flatMap(opening => opening.rewards || [])
  .map(reward => reward.name);

for (const name of capturedNames) {
  if (technicalNamePattern.test(name)) {
    throw new Error(
      `Captured opening exposes a technical reward name: ${name}`
    );
  }
}

for (const expectedName of [
  "Inner Fire",
  "Elemental Embers",
  "Freedom Chests",
  "Special Event Chests"
]) {
  if (!capturedNames.includes(expectedName)) {
    throw new Error(
      `Captured openings are missing the friendly name: ${expectedName}`
    );
  }
}

const uiSource = fs.readFileSync("live-predictor-ui.js", "utf8");

for (const alias of [
  "inner fire",
  "inner fires",
  "innerfire",
  "wind crafting gemstones"
]) {
  if (!uiSource.includes(`"${alias}"`)) {
    throw new Error(`Reward search alias is missing: ${alias}`);
  }
}

console.log(JSON.stringify({
  event: event.event,
  chestCatalogueSizes: Object.fromEntries(
    Object.entries(catalogues).map(
      ([chestType, rewards]) => [chestType, rewards.length]
    )
  ),
  screenshotRewardsVerified:
    Object.values(expectedScreenshotRewards)
      .flat().length,
  laxPlatinumVisibleSequence: {
    matched: laxPlatinumSolution.matched,
    observations: 4,
    candidateCount: laxPlatinumSolution.candidateCount
  },
  capturedOpeningNames: capturedNames
}, null, 2));
