const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createStorage(seed = {}) {
  const values = new Map(
    Object.entries(seed).map(([key, value]) => [key, String(value)])
  );

  return {
    values,
    api: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    }
  };
}

function loadInto(context, file) {
  vm.runInContext(
    fs.readFileSync(file, "utf8"),
    context,
    { filename: file }
  );
}

async function main() {
  const oldUnscopedState = JSON.stringify({
    activeChest: "gold",
    observations: {
      gold: [{ displayValue: "PRIVATE PLAYER REWARD" }]
    }
  });
  const oldEventCache = JSON.stringify({
    data: { privateDeckCursor: 847 },
    sourceFile: { name: "candice-private-capture.har" }
  });
  const engineStorage = createStorage({
    chestCompanionLivePredictor: oldUnscopedState,
    chestCompanionPublishedEvent: oldEventCache,
    "chestCompanionLivePredictor:player-a": JSON.stringify({
      activeChest: "gold",
      observations: { gold: [{ displayValue: "PLAYER A" }] }
    })
  });
  const listeners = new Map();
  const engineSandbox = {
    console: {
      info() {}, warn() {}, error() {}
    },
    localStorage: engineStorage.api,
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById() { return null; }
    },
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach(handler => handler(event));
      return true;
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    }
  };
  engineSandbox.window = engineSandbox;
  const engineContext = vm.createContext(engineSandbox);

  loadInto(engineContext, "live-predictor-engine.js");

  assert.equal(
    engineStorage.values.has("chestCompanionLivePredictor"),
    false,
    "Ambiguous pre-account progress must be discarded."
  );
  assert.equal(
    engineStorage.values.has("chestCompanionPublishedEvent"),
    false,
    "The old browser-wide parsed-event cache must be discarded."
  );
  assert.equal(
    engineStorage.values.has("chestCompanionLivePredictor:player-a"),
    true,
    "Account-scoped history must be preserved."
  );

  engineSandbox.LivePredictorEngine.setPlayerIdentity("player-b");
  assert.equal(
    engineSandbox.LivePredictorEngine.getObservations("gold").length,
    0,
    "A new player must never inherit the ambiguous legacy history."
  );

  const localEvent = {
    schema: "noir-live-event-v1",
    event: "Private HAR import",
    chests: {},
    decks: {}
  };
  engineSandbox.currentEventData = localEvent;
  engineSandbox.currentEventSourceFile = {
    name: "candice-private-capture.har"
  };
  engineStorage.api.setItem(
    "chestCompanionPublishedEvent",
    oldEventCache
  );
  engineSandbox.dispatchEvent(
    new engineSandbox.CustomEvent("noir:event-imported", {
      detail: {
        eventData: localEvent,
        sourceFile: engineSandbox.currentEventSourceFile,
        cloud: false
      }
    })
  );
  assert.equal(
    engineStorage.values.has("chestCompanionPublishedEvent"),
    false,
    "A local HAR import must not persist its parsed data or filename."
  );

  const cloudEvent = {
    schema: "noir-live-event-v1",
    event: "Shared cloud event",
    chests: {},
    decks: {}
  };
  engineSandbox.currentEventData = cloudEvent;
  engineSandbox.currentEventSourceFile = null;
  engineStorage.api.setItem(
    "chestCompanionPublishedEvent",
    JSON.stringify({ data: cloudEvent })
  );
  engineSandbox.dispatchEvent(
    new engineSandbox.CustomEvent("noir:event-imported", {
      detail: {
        eventData: cloudEvent,
        sourceFile: null,
        cloud: true
      }
    })
  );
  assert.equal(
    engineStorage.values.has("chestCompanionPublishedEvent"),
    false,
    "Cloud decks may load for the page but must not recreate the browser-wide cache."
  );
  assert.equal(
    engineSandbox.LivePredictorEngine.getEventData().event,
    "Shared cloud event",
    "Retiring local persistence must not stop the current cloud deck loading."
  );

  engineStorage.api.setItem(
    "noirChestToolsVerification",
    JSON.stringify({ gold: { recorded: 12 } })
  );
  loadInto(engineContext, "noir-chest-tools.js");
  engineSandbox.NoirChestTools.getVerificationSummary();
  assert.equal(
    engineStorage.values.has("noirChestToolsVerification"),
    false,
    "Derived verification must stay in memory rather than a shared key."
  );

  const signOutStorage = createStorage({
    chestCompanionPublishedEvent: oldEventCache,
    chestCompanionLiveEventData: "private-event",
    chestCompanionLiveGachaData: "private-history",
    noirChestToolsVerification: "private-summary",
    "chestCompanionLivePredictor:player-a": "account-scoped-history"
  });
  const signOutListeners = new Map();
  let resolveDatabaseSignOut;
  let reloadCount = 0;
  let importPrivacyCleared = false;
  let doubleArmoryRemoved = false;
  const engineCalls = [];
  const closedTools = [];
  const bodyClasses = new Set(["onyx-modal-open"]);
  const elements = new Map();
  const signOutButton = {
    addEventListener(name, handler) {
      signOutListeners.set(name, handler);
    }
  };
  elements.set("accessGateSignOut", signOutButton);
  elements.set("accessGatePassword", {
    value: "not-kept",
    addEventListener() {}
  });
  elements.set("appShell", {
    classList: { add(value) { this.value = value; } }
  });
  elements.set("noirDoubleArmoryOverlay", {
    remove() { doubleArmoryRemoved = true; }
  });

  const signOutSandbox = {
    console: { info() {}, warn() {}, error() {} },
    URL,
    localStorage: signOutStorage.api,
    location: {
      href: "https://example.test/onyx/",
      reload() { reloadCount += 1; }
    },
    history: { replaceState() {} },
    document: {
      readyState: "complete",
      title: "Onyx",
      body: {
        style: { overflow: "hidden" },
        classList: {
          remove(value) { bodyClasses.delete(value); }
        }
      },
      getElementById(id) { return elements.get(id) || null; },
      addEventListener() {}
    },
    ChestDatabase: {
      signOutAdmin() {
        return new Promise(resolve => {
          resolveDatabaseSignOut = resolve;
        });
      }
    },
    LivePredictorEngine: {
      clearPublishedEventData() { engineCalls.push("clear-event"); },
      setPlayerIdentity(identity) { engineCalls.push(`identity:${identity}`); }
    },
    OnyxEventImportPrivacy: {
      clearPrivateImport() { importPrivacyCleared = true; }
    }
  };
  [
    "LivePredictorUI",
    "ChestPredictorUI",
    "NoirChestTools",
    "ChestPlanner",
    "ChestDropRates",
    "NoirBasePlanner",
    "OnyxBaseCommand",
    "OnyxAtlasCommand",
    "OnyxCommand"
  ].forEach(name => {
    signOutSandbox[name] = {
      close() { closedTools.push(name); }
    };
  });
  signOutSandbox.currentEventData = { private: true };
  signOutSandbox.currentGachaData = { private: true };
  signOutSandbox.currentEventSourceFile = { name: "private.har" };
  signOutSandbox.ChestCompanionPublishedEvent = { private: true };
  signOutSandbox.ChestCompanionLastImport = { private: true };
  signOutSandbox.window = signOutSandbox;
  const signOutContext = vm.createContext(signOutSandbox);

  loadInto(signOutContext, "access-control.js");

  const pendingSignOut = signOutListeners.get("click")();

  assert.equal(importPrivacyCleared, true);
  assert.equal(doubleArmoryRemoved, true);
  assert.ok(closedTools.includes("LivePredictorUI"));
  assert.deepEqual(engineCalls, ["clear-event", "identity:guest"]);
  assert.equal(signOutSandbox.currentEventData, null);
  assert.equal(signOutSandbox.currentGachaData, null);
  assert.equal(signOutSandbox.currentEventSourceFile, null);
  assert.equal(signOutSandbox.ChestCompanionPublishedEvent, null);
  assert.equal("ChestCompanionLastImport" in signOutSandbox, false);
  assert.equal(
    signOutStorage.values.has("chestCompanionPublishedEvent"),
    false
  );
  assert.equal(
    signOutStorage.values.has("chestCompanionLiveEventData"),
    false
  );
  assert.equal(
    signOutStorage.values.has("chestCompanionLiveGachaData"),
    false
  );
  assert.equal(
    signOutStorage.values.has("noirChestToolsVerification"),
    false
  );
  assert.equal(
    signOutStorage.values.get("chestCompanionLivePredictor:player-a"),
    "account-scoped-history",
    "Immediate sign-out cleanup must preserve account-scoped history."
  );
  assert.equal(reloadCount, 0, "Cleanup must happen before the async sign-out finishes.");

  await Promise.resolve();
  resolveDatabaseSignOut();
  await pendingSignOut;
  assert.equal(reloadCount, 1);

  console.log("HAR privacy boundary and synchronous sign-out tests passed.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
