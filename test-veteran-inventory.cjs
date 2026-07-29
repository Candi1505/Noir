const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = new Map();
const sandbox = {
  console,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Set,
  String,
  Number,
  Boolean,
  RegExp,
  Intl,
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  document: {
    readyState: "loading",
    addEventListener() {},
  },
  alert() {},
  confirm: () => true,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("base-adviser-catalog-towers.js", "utf8"), sandbox);
vm.runInContext(fs.readFileSync("base-planner.js", "utf8"), sandbox);

const planner = sandbox.NoirBasePlanner;
const imported = planner.parseInventoryRows([
  ["Tower,Level,Stored?"],
  ["Crystal Howitzer,230,No"],
  ["Cosmic Orrery,230,No"],
  ["Electro Flak,155,Yes"],
  ["Ballista Tower,165,Yes"],
  ["Electro Flak,155,Yes"],
  ["Unknown Thing,10,Yes"],
]);

assert.equal(imported.entries.reduce((sum, item) => sum + item.quantity, 0), 5);
assert.equal(imported.rejected.length, 1);
assert.deepEqual(
  JSON.parse(JSON.stringify(imported.entries.find(item => item.type === "Electro-Flak Tower"))),
  {
    type: "Electro-Flak Tower",
    level: 155,
    location: "storage",
    action: "upgrade",
    quantity: 2,
  },
);
assert.equal(
  imported.entries.find(item => item.type === "Crystal Howitzer").location,
  "base",
);

const projection = planner.fortPlan({
  currentLevel: 871,
  targetLevel: 872,
  currentXp: 0,
  maximumTowerLevel: 233,
  storedTowers: [
    { type: "Crystal Howitzer", level: 230, quantity: 1, location: "base", action: "upgrade" },
    { type: "Cosmic Orrery", level: 230, quantity: 1, location: "base", action: "hold" },
  ],
  mergePlans: [],
});
assert.equal(projection.route.every(step => step.type === "Crystal Howitzer"), true);

if (process.env.EFF_INVENTORY_ROWS) {
  const realRows = JSON.parse(fs.readFileSync(process.env.EFF_INVENTORY_ROWS, "utf8"));
  const realImport = planner.parseInventoryRows(realRows);
  assert.equal(realImport.entries.reduce((sum, item) => sum + item.quantity, 0), 194);
  assert.equal(realImport.entries.filter(item => item.location === "base").reduce((sum, item) => sum + item.quantity, 0), 36);
  assert.equal(realImport.entries.filter(item => item.location === "storage").reduce((sum, item) => sum + item.quantity, 0), 158);
  assert.equal(realImport.rejected.length, 0);
}

console.log("Veteran inventory tests passed.");
