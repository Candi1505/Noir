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

assert.equal(
  LivePredictorEngine.isReady(),
  false,
  "An empty event shell must not be reported as ready."
);

const chestConfig = {
  gold: ["gold_chest", "gold_chest_bonus", 30],
  platinum: ["platinum_chest", "platinum_chest_bonus", 30],
  draconic: ["dragfrag_chest_tier3", "dragfrag_chest_tier3_bonus", 30],
  freedom: ["freedom_chest", "freedom_chest_bonus", 15],
  arcane: ["arcane_chest", "arcane_chest_bonus", 15],
  super_sigil: ["sigil_chest", "Legendary_sigil_drop", 30]
};

const event = {
  schema: "noir-live-event-v1",
  event: "Chest correctness regression",
  ready: true,
  readyChestCount: 6,
  chests: {},
  decks: {},
  drops: {},
  deckIndices: {}
};

for (const [chestType, [mainKey, bonusKey, cadence]] of Object.entries(chestConfig)) {
  const regularRewards = Array.from({ length: 7 }, (_, index) => ({
    id: `${chestType}-regular-${index + 1}`,
    name: `${chestType} regular ${index + 1}`,
    amount: index + 1
  }));
  const bonusRewards = Array.from({ length: 3 }, (_, index) => ({
    id: `${chestType}-bonus-${index + 1}`,
    name: `${chestType} bonus ${index + 1}`,
    amount: (index + 1) * 10
  }));

  event.chests[chestType] = {
    found: true,
    key: mainKey,
    deck: regularRewards.map((_, index) => index),
    deckLength: regularRewards.length,
    bonusEvery: cadence
  };
  event.decks[mainKey] = regularRewards.map((_, index) => index);
  event.decks[bonusKey] = bonusRewards.map((_, index) => index);
  event.drops[mainKey] = regularRewards;
  event.drops[bonusKey] = bonusRewards;
}

LivePredictorEngine.publishEventData(event);
assert.equal(LivePredictorEngine.isReady(), true);

for (const [chestType, [, , cadence]] of Object.entries(chestConfig)) {
  LivePredictorEngine.setPlayerIdentity(`due-now-${chestType}`);
  LivePredictorEngine.resetHistory(chestType);
  LivePredictorEngine.setBonusProgress(chestType, cadence - 1, { silent: true });

  const regularReward = LivePredictorEngine
    .getRewards(chestType)
    .find(reward => reward.code === `${chestType}-regular-1`);

  assert.ok(regularReward, `${chestType}: regular reward fixture is missing.`);
  LivePredictorEngine.recordReward(chestType, { reward: regularReward.raw });

  assert.equal(
    LivePredictorEngine.getBonusProgress(chestType),
    cadence,
    `${chestType}: recording the boundary chest must make the bonus due now.`
  );

  const dueNow = LivePredictorEngine.predictUpcoming(5, chestType)[0];
  assert.equal(dueNow?.isBonus, true, `${chestType}: due bonus was skipped.`);
  assert.equal(dueNow?.bonusAfterRegularChest, 0);
  assert.equal(
    dueNow?.exactBonusReward,
    false,
    `${chestType}: an unanchored bonus deck must not guess an exact reward.`
  );
  assert.equal(dueNow?.name, `${LivePredictorEngine.getChestLabel(chestType)} Bonus Chest`);
  assert.equal(dueNow?.amount, null);

  assert.throws(
    () => LivePredictorEngine.recordReward(chestType, {
      reward: regularReward.raw,
      quantity: 10
    }),
    /Record each chest reward separately/,
    `${chestType}: bulk repetition could poison the solver.`
  );

  const bonusReward = LivePredictorEngine
    .getRewards(chestType)
    .find(reward => reward.code === `${chestType}-bonus-1`);

  assert.ok(bonusReward, `${chestType}: bonus reward fixture is missing.`);
  LivePredictorEngine.recordReward(chestType, {
    reward: bonusReward.raw,
    isBonus: true
  });
  LivePredictorEngine.setBonusProgress(chestType, cadence, { silent: true });

  const anchored = LivePredictorEngine.predictUpcoming(5, chestType)[0];
  assert.equal(anchored?.isBonus, true);
  assert.equal(
    anchored?.exactBonusReward,
    true,
    `${chestType}: a uniquely anchored bonus deck should expose the exact reward.`
  );
}

LivePredictorEngine.setPlayerIdentity("amount-override-player");
LivePredictorEngine.resetHistory("gold");
const amountReward = LivePredictorEngine
  .getRewards("gold")
  .find(reward => reward.code === "gold-regular-1");

LivePredictorEngine.recordReward("gold", {
  reward: amountReward.raw,
  amount: 777
});

const amountObservation = LivePredictorEngine.getObservations("gold")[0];
assert.equal(amountObservation.amount, 777);
assert.equal(amountObservation.matchValue.amount, 777);
assert.match(amountObservation.displayValue, /777$/);

vm.runInThisContext(
  fs.readFileSync("chest-drop-rates.js", "utf8"),
  { filename: "chest-drop-rates.js" }
);
vm.runInThisContext(
  fs.readFileSync("noir-chest-tools.js", "utf8"),
  { filename: "noir-chest-tools.js" }
);

const superSigilBudget = NoirChestTools.calculateChestBudget(8000, "super_sigil");
assert.deepEqual(superSigilBudget, {
  openings: 14,
  tenPacks: 1,
  singles: 4,
  spent: 7500,
  remaining: 500
});

LivePredictorEngine.setPlayerIdentity("summary-player");
for (const chestType of Object.keys(chestConfig)) {
  LivePredictorEngine.resetHistory(chestType);
  const firstReward = LivePredictorEngine
    .getRewards(chestType)
    .find(reward => reward.code === `${chestType}-regular-1`);
  LivePredictorEngine.recordReward(chestType, {
    reward: firstReward.raw,
    amount: firstReward.amount
  });
}

const verification = NoirChestTools.getVerificationSummary();
assert.equal(
  Object.values(verification).filter(item => item.solved).length,
  6,
  "The private verification summary must use all six live solver statuses."
);
assert.equal(
  storage.has("noirChestToolsVerification"),
  false,
  "Derived player verification must not be stored in a browser-wide key."
);

const currentAvailabilityEvent =
  structuredClone(event);
currentAvailabilityEvent.availabilityKnown =
  true;
currentAvailabilityEvent.availableChestTypes = [
  "gold",
  "platinum",
  "draconic",
  "arcane"
];
currentAvailabilityEvent.availableChestCount =
  4;

for (const chestType of Object.keys(chestConfig)) {
  currentAvailabilityEvent.chests[
    chestType
  ].available =
    currentAvailabilityEvent
      .availableChestTypes
      .includes(chestType);
}

LivePredictorEngine.publishEventData(
  currentAvailabilityEvent
);
LivePredictorEngine.setActiveChest("freedom");

const availabilityStatus =
  LivePredictorEngine.getStatus();

assert.deepEqual(
  ChestDropRates.getCurrentChestTypes(
    currentAvailabilityEvent
  ),
  [
    "gold",
    "platinum",
    "draconic",
    "arcane"
  ],
  "Drop Rates must offer only chests in the current live menu."
);
assert.deepEqual(
  NoirChestTools.getCurrentChestOrder(
    currentAvailabilityEvent
  ),
  [
    "gold",
    "platinum",
    "draconic",
    "arcane"
  ],
  "Player tools must offer only chests in the current live menu."
);

assert.deepEqual(
  availabilityStatus.chests.map(
    chest => chest.chestType
  ),
  [
    "gold",
    "platinum",
    "draconic",
    "arcane"
  ],
  "Dormant chest decks must remain supported without being offered as live."
);
assert.equal(
  availabilityStatus.allChests.length,
  6
);
assert.equal(
  availabilityStatus.readyChestCount,
  4
);
assert.equal(
  availabilityStatus.activeChest,
  "gold",
  "A saved dormant chest must fall back to the first current chest."
);
assert.equal(
  LivePredictorEngine
    .getChestStatus("freedom")
    .available,
  false
);

const noActiveChestEvent =
  structuredClone(event);
noActiveChestEvent.availabilityKnown = true;
noActiveChestEvent.availableChestTypes = [];
noActiveChestEvent.availableChestCount = 0;

assert.deepEqual(
  NoirChestTools.getCurrentChestOrder(
    noActiveChestEvent
  ),
  [],
  "A known empty chest menu must stay empty instead of falling back to Gold."
);
assert.deepEqual(
  NoirChestTools.calculateChestBudget(
    8000,
    null
  ),
  {
    openings: 0,
    tenPacks: 0,
    singles: 0,
    spent: 0,
    remaining: 8000
  },
  "No active chest must not silently use Gold pricing."
);

const noActiveReport =
  NoirChestTools.inspectEvent({
    eventData: noActiveChestEvent,
    rates:
      ChestDropRates.calculateAllRates(
        noActiveChestEvent
      )
  });

assert.equal(noActiveReport.ready, false);
assert.equal(
  noActiveReport.noActiveChests,
  true
);
assert.deepEqual(
  Object.keys(noActiveReport.chests),
  [],
  "Dormant decks must not appear as failed readiness checks when no chest is active."
);

const uiSource = fs.readFileSync("live-predictor-ui.js", "utf8");
assert.doesNotMatch(uiSource, /<option value="10">/);
assert.match(uiSource, /id="lpRewardQuantity"[\s\S]*?type="hidden"[\s\S]*?value="1"/);

const plannerSource = fs.readFileSync("chest-planner.js", "utf8");
assert.match(plannerSource, /"super_sigil"/);
assert.match(plannerSource, /super_sigil:\s*\{ label: "Super Sigil"/);
assert.match(plannerSource, /getCurrentChestOrder\(\)/);

const toolsSource = fs.readFileSync("noir-chest-tools.js", "utf8");
assert.match(toolsSource, /getCurrentChestOrder/);
assert.match(toolsSource, /currentChestOrder\.map\(type/);

const commandSource = fs.readFileSync("onyx-command.js", "utf8");
assert.match(commandSource, /currentEventChests\(\)/);
assert.match(commandSource, /status\.availableChestTypes/);

console.log("Chest correctness tests passed for all six predictors.");
