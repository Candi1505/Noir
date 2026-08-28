const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("onyx-war-dragons-auth.js", "utf8");

function createHarness() {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const timers = new Map();
  const invocations = [];
  let nextTimer = 1;
  let userId = null;

  const location = {
    href: "https://candi1505.github.io/Noir/#wd-connect=opaque-handoff",
    hash: "#wd-connect=opaque-handoff",
    assign() {}
  };

  function on(name, handler) {
    if (!windowListeners.has(name)) windowListeners.set(name, new Set());
    windowListeners.get(name).add(handler);
  }

  function off(name, handler) {
    windowListeners.get(name)?.delete(handler);
  }

  const sandbox = {
    console,
    URL,
    URLSearchParams,
    location,
    history: {
      replaceState(_state, _title, url) {
        location.href = String(url);
        location.hash = new URL(location.href).hash;
      }
    },
    document: {
      readyState: "loading",
      addEventListener(name, handler) { documentListeners.set(name, handler); }
    },
    addEventListener: on,
    removeEventListener: off,
    dispatchEvent() { return true; },
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options?.detail; }
    },
    OnyxCommandCore: { getCurrentUserId: () => userId },
    chestSupabase: {
      functions: {
        async invoke(name, options) {
          invocations.push({ name, action: options.body.action });
          if (options.body.action === "complete") {
            return { data: { ok: true, playerId: "wd-player" }, error: null };
          }
          return { data: { ok: true }, error: null };
        }
      }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  return {
    auth: sandbox.OnyxWarDragonsAuth,
    invocations,
    location,
    timers,
    setUserId(value) { userId = value; },
    emit(name, detail = {}) {
      [...(windowListeners.get(name) || [])].forEach(handler => handler({ type: name, detail }));
    },
    listenerCount(name) { return windowListeners.get(name)?.size || 0; },
    fireTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach(callback => callback());
    }
  };
}

(async () => {
  const ready = createHarness();
  const firstInstall = ready.auth.install();
  const secondInstall = ready.auth.install();
  const directFinish = ready.auth.finishReturn();
  assert.equal(firstInstall, secondInstall, "Repeated installation must share one finite task.");

  await Promise.resolve();
  assert.equal(ready.invocations.length, 0, "The handoff must not run before the player session exists.");
  assert.equal(ready.listenerCount("onyx:player-ready"), 1, "Only one player-ready listener is permitted.");
  assert.equal(ready.timers.size, 1, "The player-ready wait must have one bounded timeout.");

  ready.setUserId("onyx-user-one");
  ready.emit("onyx:player-ready", { userId: "onyx-user-one" });
  ready.emit("onyx:player-ready", { userId: "onyx-user-one" });
  await Promise.all([firstInstall, secondInstall, directFinish]);

  assert.deepEqual(ready.invocations.map(call => call.action), ["complete"]);
  assert.equal(ready.listenerCount("onyx:player-ready"), 0, "The listener must be removed after success.");
  assert.equal(ready.timers.size, 0, "The timeout must be cleared after success.");
  assert.equal(ready.location.hash, "", "A consumed handoff must be removed from the address.");
  assert.equal(ready.auth.getStatus().connected, true);
  assert.equal(await ready.auth.finishReturn(), false);
  assert.equal(ready.invocations.length, 1, "A cleared handoff cannot be completed twice.");

  const timedOut = createHarness();
  const timeoutInstall = timedOut.auth.install();
  await Promise.resolve();
  timedOut.fireTimers();
  await timeoutInstall;
  assert.equal(timedOut.invocations.length, 0, "Timeout must not invoke completion without a player.");
  assert.equal(timedOut.listenerCount("onyx:player-ready"), 0, "Timeout must remove its listener.");
  assert.equal(timedOut.timers.size, 0);
  assert.match(timedOut.location.hash, /wd-connect=/, "An unconsumed handoff remains available for a reload retry.");
  assert.equal(timedOut.auth.getStatus().phase, "error");

  console.log("Onyx War Dragons OAuth player-ready race checks passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
