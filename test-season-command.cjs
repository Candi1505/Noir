const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("season-command-data.js", "utf8");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const { season, cheapestRoute } = context.window.OnyxSeasonData;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(season.capturedKeyCount === 25, "Expected 25 capture-verified Wave 1 keys.");

const fromZero = cheapestRoute(20, {});
assert(fromZero.possible, "The verified Wave 1 data should support a 20-key route.");
assert(fromZero.cost === 90803, `Expected the cheapest 20-key route to cost 90,803, received ${fromZero.cost}.`);
assert(fromZero.finalKeys === 20, "The cheapest route should finish on exactly 20 keys.");

const progressed = cheapestRoute(20, {
  brickscale: 6,
  "mission-bonus": 1,
  "base-boost": 6,
  "charged-volt": 1
});
assert(progressed.currentKeys === 14, "Expected the supplied branch progress to total 14 keys.");
assert(progressed.additionalKeys >= 6, "The route should add at least the six missing keys.");
assert(progressed.finalKeys >= 20, "The progressed route should reach the mythic target.");

const complete = cheapestRoute(20, {
  brickscale: 6,
  "mission-bonus": 2,
  "base-boost": 6,
  "charged-volt": 6
});
assert(complete.cost === 0, "A commander already holding 20 verified keys should need no more sigils.");

console.log(JSON.stringify({
  capturedKeys: season.capturedKeyCount,
  cheapest20KeyCost: fromZero.cost,
  progressedRouteCost: progressed.cost,
  status: "PASS"
}, null, 2));
