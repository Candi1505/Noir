const fs = require("fs");
const vm = require("vm");

const stored = new Map();
const dispatched = [];

global.window = global;
global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
global.dispatchEvent = event => {
  dispatched.push(event);
  return true;
};
global.localStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, String(value))
};

const privateFields = {
  index: 91,
  foundIndex: 91,
  sourceIndex: 91,
  currentValue: 4,
  openedSinceBonus: 12,
  chestsUntilBonus: 3,
  nextChestIsBonus: false
};

global.ChestDatabase = {
  async getActivePredictors() {
    return [
      {
        id: "gold-record",
        chest_type: "gold",
        version: 1,
        uploaded_at: "2026-08-06T00:00:00.000Z",
        predictor_data: {
          schema: "noir-live-event-v1",
          chestType: "gold",
          eventData: {
            schema: "noir-live-event-v1",
            event: "Gauntlet",
            publishedAt: "2026-08-06T00:00:00.000Z",
            sourceFile: "private.har",
            fileName: "private.har",
            deckIndices: { gold_chest: 91 },
            chests: {
              gold: {
                found: true,
                deck: [0, 1, 2],
                ...privateFields
              }
            },
            decks: { gold_chest: [0, 1, 2] },
            drops: {}
          }
        }
      }
    ];
  }
};

vm.runInThisContext(
  fs.readFileSync("predictor-cloud.js", "utf8"),
  { filename: "predictor-cloud.js" }
);

ChestPredictorCloud.load()
  .then(() => {
    const event = global.currentEventData;

    if (!event || event.chests.gold.deck.length !== 3) {
      throw new Error("The shared event deck did not load.");
    }

    if (Object.keys(event.deckIndices).length !== 0) {
      throw new Error("Captured deck indices reached the player session.");
    }

    if (event.sourceFile || event.fileName || event.filename) {
      throw new Error("Private upload metadata reached the player session.");
    }

    Object.keys(privateFields).forEach(field => {
      if (field in event.chests.gold) {
        throw new Error(`Captured chest field reached the player: ${field}`);
      }
    });

    const imported = dispatched.find(
      event => event.type === "noir:event-imported"
    );

    if (!imported || imported.detail.sourceFile !== null) {
      throw new Error("The cloud event did not dispatch safely.");
    }

    console.log("Cloud player event sanitisation passed.");
  });
