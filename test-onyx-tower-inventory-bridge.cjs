const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { TextDecoder } = require("node:util");

const dispatched = [];

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const sandbox = {
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Set,
  Map,
  WeakSet,
  String,
  Number,
  Boolean,
  RegExp,
  structuredClone,
  Uint8Array,
  TextDecoder,
  CustomEvent: TestCustomEvent,
  atob(value) {
    return Buffer.from(value, "base64").toString("binary");
  },
  dispatchEvent(event) {
    dispatched.push(event);
    return true;
  }
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync("base-adviser-catalog-towers.js", "utf8"),
  sandbox
);
vm.runInContext(
  fs.readFileSync("onyx-tower-inventory-bridge.js", "utf8"),
  sandbox
);

const bridge = sandbox.OnyxTowerInventoryBridge;
assert.ok(bridge);

function response(payload, options = {}) {
  const text = JSON.stringify(payload);
  return {
    request: {
      url: options.url || "https://private.invalid/account?token=do-not-copy"
    },
    response: {
      content: options.base64
        ? {
            text: Buffer.from(text, "utf8").toString("base64"),
            encoding: "base64"
          }
        : { text }
    }
  };
}

const smallerEarlierSnapshot = {
  inventory: [
    {
      towerType: "Archer Tower",
      towerLevel: 1,
      isStored: false
    }
  ]
};

const strongestSnapshot = {
  accountId: "player-secret",
  authToken: "capture-secret",
  inventory: [
    {
      towerType: "Archer Tower",
      towerLevel: 1,
      isStored: false,
      towerId: "private-tower-id",
      islandIndex: 7,
      slotIndex: 4,
      coordinates: { x: 42, y: 19 }
    },
    {
      building_type: "elementalFlakDark",
      building_level: "2",
      storage_state: "stored",
      quantity: "2"
    },
    {
      entityType: "tower",
      name: "Crystal Howitzer",
      level: 3,
      location: "active"
    },
    {
      towerType: "Unknown Thing",
      level: 1,
      stored: true
    },
    {
      towerType: "Archer Tower",
      level: 999,
      stored: true
    },
    {
      towerType: "Archer Tower",
      level: 1,
      stored: true,
      placed: true
    },
    {
      type: "Archer Tower",
      level: 1,
      stored: true
    }
  ]
};

const laterButSmallerSnapshot = {
  inventory: [
    {
      tower: "Cosmic Orrery",
      level: 4,
      location: "storage"
    }
  ]
};

const har = {
  log: {
    entries: [
      response(smallerEarlierSnapshot),
      response(strongestSnapshot, { base64: true }),
      response(laterButSmallerSnapshot),
      {
        response: {
          content: { text: "<html>not JSON</html>" }
        }
      }
    ]
  }
};

const extracted = bridge.extract(har);
const plainExtracted = JSON.parse(JSON.stringify(extracted));

assert.equal(plainExtracted.ready, true);
assert.equal(plainExtracted.records.length, 3);
assert.equal(plainExtracted.diagnostics.selectedQuantity, 4);
assert.equal(plainExtracted.diagnostics.candidateSnapshots, 3);
assert.deepEqual(
  plainExtracted.records,
  [
    {
      type: "Archer Tower",
      level: 1,
      location: "base",
      quantity: 1,
      evidence: "catalogue-row-and-explicit-location"
    },
    {
      type: "Crystal Howitzer",
      level: 3,
      location: "base",
      quantity: 1,
      evidence: "catalogue-row-and-explicit-location"
    },
    {
      type: "Dark Flak Tower",
      level: 2,
      location: "storage",
      quantity: 2,
      evidence: "catalogue-row-and-explicit-location"
    }
  ]
);

const serialised = JSON.stringify(plainExtracted);
for (const forbidden of [
  "player-secret",
  "capture-secret",
  "private-tower-id",
  "private.invalid",
  "islandIndex",
  "slotIndex",
  "coordinates"
]) {
  assert.equal(serialised.includes(forbidden), false);
}

for (const record of plainExtracted.records) {
  assert.deepEqual(
    Object.keys(record).sort(),
    ["evidence", "level", "location", "quantity", "type"]
  );
}

let subscriberSnapshot = null;
const unsubscribe = bridge.subscribe(snapshot => {
  subscriberSnapshot = snapshot;
});

const imported = bridge.importHar(har);
assert.equal(imported.records.length, 3);
assert.equal(subscriberSnapshot.records.length, 3);
assert.equal(dispatched.at(-1).type, bridge.eventName);
assert.equal(dispatched.at(-1).detail.records.length, 3);

imported.records[0].quantity = 999;
assert.equal(bridge.getSnapshot().records[0].quantity, 1);

const workerSnapshot = bridge.importSnapshot(
  plainExtracted
);
assert.equal(workerSnapshot.records.length, 3);
assert.equal(
  workerSnapshot.diagnostics.selectedQuantity,
  4
);
assert.equal(
  JSON.stringify(workerSnapshot)
    .includes("private"),
  false
);
assert.throws(
  () => bridge.importSnapshot({
    records: [
      {
        type: "Unknown private tower",
        level: 1,
        location: "base",
        quantity: 1
      }
    ]
  }),
  /snapshot is invalid/i
);

unsubscribe();
bridge.clear();
assert.equal(bridge.getSnapshot(), null);
assert.equal(dispatched.at(-1).type, bridge.clearEventName);
assert.equal(dispatched.at(-1).detail, null);

/* The existing private event import hands the parsed capture to the bridge. */
sandbox.EventParser = {
  parse(rawText) {
    return JSON.parse(rawText);
  }
};
vm.runInContext(
  fs.readFileSync("har-event-adapter.js", "utf8"),
  sandbox
);
const integratedHar = {
  log: {
    entries: [
      ...har.log.entries,
      response(
        {
          spend_breeding_tokens: {
            gacha: {
              params: {
                deck_indices: {},
                decks: {},
                spin_types: []
              }
            }
          }
        },
        { url: "https://private.invalid/ext/dragonsong/event/about_v2" }
      )
    ]
  }
};
sandbox.EventParser.parse(JSON.stringify(integratedHar));
assert.equal(bridge.getSnapshot().records.length, 3);

assert.throws(
  () => bridge.extract({ entries: [] }),
  /parsed private capture/i
);

const source = fs.readFileSync(
  "onyx-tower-inventory-bridge.js",
  "utf8"
);
assert.doesNotMatch(
  source,
  /localStorage|sessionStorage|indexedDB|XMLHttpRequest|\bfetch\s*\(/
);
assert.doesNotMatch(
  source,
  /entry\?\.request|entry\.request|request\?\.url|request\.url/
);

console.log("Onyx tower inventory bridge tests passed.");
