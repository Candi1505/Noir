const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function createElement() {
  const classes = new Set(["hidden"]);
  const listeners = {};

  return {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const enabled = force === undefined
          ? !classes.has(name)
          : force;
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      }
    },
    dataset: {},
    disabled: false,
    textContent: "",
    value: "",
    addEventListener(name, handler) {
      listeners[name] = handler;
    },
    focus() {},
    listeners
  };
}

function createTimerHarness() {
  const timers = [];
  const cleared = [];

  return {
    timers,
    cleared,
    setTimeout(callback, delay) {
      const id = timers.length + 1;
      timers.push({ id, callback, delay });
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
    }
  };
}

async function checkAccessGateSignOut() {
  const ids = [
    "loadingScreen",
    "appShell",
    "accessGate",
    "accessGateMessage",
    "accessGateCredentials",
    "accessGateRecovery",
    "accessGateSignOut",
    "accessGateEmail",
    "accessGatePassword",
    "accessGateSignIn",
    "accessGateSignUpFields",
    "accessGateSignUp",
    "accessGateBackToSignIn",
    "accessGateResetPassword"
  ];
  const elements = Object.fromEntries(
    ids.map(id => [id, createElement()])
  );
  const timers = createTimerHarness();
  const warnings = [];
  let reloads = 0;
  let remoteCalls = 0;
  let importCleared = false;
  const removedAuthKeys = [];
  const localSignOutScopes = [];

  const sandbox = {
    console: {
      info() {},
      error() {},
      warn(message) { warnings.push(message); }
    },
    localStorage: {
      removeItem(key) {
        removedAuthKeys.push(key);
      }
    },
    document: {
      readyState: "complete",
      body: {
        style: { overflow: "hidden" },
        classList: { remove() {} }
      },
      getElementById(id) {
        return elements[id] || null;
      },
      addEventListener() {}
    },
    location: {
      href: "https://example.test/onyx/",
      reload() { reloads += 1; }
    },
    history: { replaceState() {} },
    ChestDatabase: {
      signOutAdmin() {
        remoteCalls += 1;
        return new Promise(() => {});
      }
    },
    chestSupabase: {
      auth: {
        signOut(options) {
          localSignOutScopes.push(
            options?.scope
          );
          return new Promise(() => {});
        }
      }
    },
    OnyxEventImportPrivacy: {
      clearPrivateImport() {
        importCleared = true;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type) { this.type = type; }
    },
    dispatchEvent() {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.currentEventData = { private: true };

  vm.runInNewContext(
    fs.readFileSync("access-control.js", "utf8"),
    sandbox,
    { filename: "access-control.js" }
  );

  const pending =
    elements.accessGateSignOut
      .listeners.click();

  assert.equal(importCleared, true);
  assert.equal(
    sandbox.currentEventData,
    null,
    "Private in-memory data must clear before the remote request settles."
  );
  assert.equal(
    elements.appShell.classList
      .contains("hidden"),
    true,
    "The authenticated shell must lock immediately."
  );
  assert.equal(
    elements.accessGate.classList
      .contains("hidden"),
    false,
    "A visible sign-out boundary must replace the private shell."
  );
  assert.match(
    elements.accessGateMessage.textContent,
    /Signing out securely/
  );
  assert.equal(
    elements.accessGateSignOut.disabled,
    true
  );
  assert.equal(timers.timers.length, 1);
  assert.equal(
    timers.timers[0].delay,
    5000,
    "Remote sign-out must have a short, bounded deadline."
  );

  await Promise.resolve();
  assert.equal(remoteCalls, 1);
  assert.equal(reloads, 0);
  timers.timers[0].callback();
  await pending;

  assert.equal(reloads, 1);
  assert.deepEqual(timers.cleared, [1]);
  assert.deepEqual(
    localSignOutScopes,
    ["local"],
    "A timed-out global logout must request Supabase local-scope sign-out."
  );
  assert.ok(
    removedAuthKeys.includes(
      "sb-prjixwuvyhiqzoekoadj-auth-token"
    ),
    "A timed-out global logout must deterministically remove the persisted session."
  );
  assert.ok(
    warnings.some(message =>
      /timed out/.test(message)
    )
  );
}

async function checkPublisherSignOut() {
  const ids = [
    "adminLoginPanel",
    "adminSignedInPanel",
    "playerSignedInPanel",
    "passwordRecoveryPanel",
    "adminDataControls",
    "importEventDataButton",
    "eventAccessEyebrow",
    "eventAccessTitle",
    "eventAccessDescription",
    "eventImportBadge",
    "adminAccessStatus",
    "adminSignOutButton",
    "playerSignOutButton",
    "accessGateSignOut",
    "appShell"
  ];
  const elements = Object.fromEntries(
    ids.map(id => [id, createElement()])
  );
  const listeners = new Map();
  const timers = createTimerHarness();
  const warnings = [];
  const boundaryCalls = [];
  let cleanupCalls = 0;
  let forcedLocalClears = 0;
  let reloads = 0;

  const sandbox = {
    console: {
      info() {},
      error() {},
      warn(message) { warnings.push(message); }
    },
    document: {
      readyState: "complete",
      getElementById(id) {
        return elements[id] || null;
      },
      addEventListener() {}
    },
    location: {
      reload() { reloads += 1; }
    },
    ChestDatabase: {
      async getCurrentAccess() {
        return {
          user: { email: "admin@example.test" },
          profile: {},
          isAdmin: true,
          isApproved: true
        };
      },
      signOutAdmin() {
        return new Promise(() => {});
      }
    },
    NoirAccessControl: {
      clearPrivateClientState() {
        cleanupCalls += 1;
        sandbox.dispatchEvent(
          new sandbox.CustomEvent(
            "noir:signout-started"
          )
        );
      },
      show(options) {
        boundaryCalls.push(options);
      },
      forceLocalSessionClear() {
        forcedLocalClears += 1;
      }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || [])
        .forEach(handler => handler(event));
    },
    alert() {},
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  };
  sandbox.window = sandbox;

  vm.runInNewContext(
    fs.readFileSync(
      "admin-event-publisher.js",
      "utf8"
    ),
    sandbox,
    { filename: "admin-event-publisher.js" }
  );

  const pending =
    elements.adminSignOutButton
      .listeners.click();

  assert.equal(
    cleanupCalls,
    1,
    "Publisher sign-out must synchronously invoke the full private cleanup."
  );
  assert.equal(boundaryCalls.length, 1);
  assert.match(
    boundaryCalls[0].message,
    /Signing out securely/
  );
  assert.equal(
    elements.adminSignOutButton.disabled,
    true
  );
  assert.equal(
    elements.playerSignOutButton.disabled,
    true
  );
  assert.equal(timers.timers.length, 1);
  assert.equal(timers.timers[0].delay, 5000);

  timers.timers[0].callback();
  await pending;

  assert.equal(reloads, 1);
  assert.deepEqual(timers.cleared, [1]);
  assert.equal(
    forcedLocalClears,
    1,
    "Publisher timeout must fail closed by clearing the local Supabase session."
  );
  assert.ok(
    warnings.some(message =>
      /timed out/.test(message)
    )
  );
}

Promise.resolve()
  .then(checkAccessGateSignOut)
  .then(checkPublisherSignOut)
  .then(() => {
    console.log(
      "Bounded sign-out and locked-boundary regression tests passed."
    );
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
