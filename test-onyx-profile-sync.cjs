const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const operations = [];
let currentUserId = "player-one";

class Query {
  constructor(table) {
    this.table = table;
    this.payload = null;
    this.filters = [];
    this.action = "select";
  }

  select(columns) {
    this.columns = columns;
    return this;
  }

  update(payload) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload) {
    this.action = "upsert";
    this.payload = payload;
    return this;
  }

  delete() {
    this.action = "delete";
    return this;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  async maybeSingle() {
    operations.push(this.snapshot());
    return { data: null, error: null };
  }

  async single() {
    operations.push(this.snapshot());
    return {
      data: {
        onyx_command_preferences: this.payload?.onyx_command_preferences,
        layout: this.payload?.layout
      },
      error: null
    };
  }

  then(resolve) {
    operations.push(this.snapshot());
    return Promise.resolve({ data: null, error: null }).then(resolve);
  }

  snapshot() {
    return {
      table: this.table,
      action: this.action,
      payload: this.payload,
      filters: this.filters
    };
  }
}

const sandbox = {
  console,
  window: {
    chestSupabase: {
      auth: {
        async getUser() {
          return { data: { user: { id: currentUserId } }, error: null };
        }
      },
      from(table) {
        return new Query(table);
      }
    }
  }
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("database.js", "utf8"), sandbox);

(async () => {
  const database = sandbox.window.ChestDatabase;

  await database.saveOnyxCommandState({
    currentKeys: 23,
    currentSigils: 45678,
    mythicChoice: "Smirkle",
    branchKeys: {
      "brickscale": 6,
      "mission-bonus": 1,
      "base-boost": 6,
      "charged-volt-tower": 6,
      "cosmic-orrery": 1,
      "bloodstone": 0
    },
    rawSourceFile: "never persist"
  });
  assert.deepEqual(operations.at(-1).filters, [["user_id", "player-one"]]);
  const seasonPreferences = operations.at(-1).payload.onyx_command_preferences;
  assert.equal(seasonPreferences.version, 2);
  assert.equal(seasonPreferences.currentKeys, 23);
  assert.equal(seasonPreferences.currentSigils, 45678);
  assert.equal(seasonPreferences.seasonRelease, "misfitrise-wave-1");
  assert.equal(seasonPreferences.seasonTarget, 20);
  assert.equal(seasonPreferences.mythicChoice, "Smirkle");
  assert.equal(seasonPreferences.branchKeys["charged-volt-tower"], 6);
  assert.equal("rawSourceFile" in seasonPreferences, false);

  await assert.rejects(
    database.saveOnyxCommandState({ currentKeys: 41 }),
    /0 to 40/
  );
  await assert.rejects(
    database.saveOnyxCommandState({ currentKeys: 1, currentSigils: 100000001 }),
    /100,000,000/
  );
  await assert.rejects(
    database.saveOnyxCommandState({
      currentKeys: 1,
      branchKeys: { "brickscale": 7 }
    }),
    /brickscale/
  );

  const layout = {
    version: 2,
    name: "Main Base",
    rawHar: { log: { entries: [{ request: { headers: ["never persist"] } }] } },
    slots: Array.from({ length: 40 }, () => null),
    perches: ["Riverwatch Perch", "Seagazer Perch", "Stonespear Perch"].map(name => ({
      name,
      level: 0,
      dragonName: "",
      dragonClass: "",
      dragonTier: "",
      dragonLevel: 0,
      riderName: "",
      riderLevel: 0,
      elementalResistance: "",
      towerBonus: "",
      specialBonus: "",
      skills: [],
      gear: Object.fromEntries(["head", "chest", "gloves", "pants", "boots", "weapons", "shield", "rings"].map(slot => [slot, null]))
    }))
  };
  layout.slots[0] = {
    type: "Manual Future Tower",
    level: 301,
    notes: "Manual evidence only",
    requestHeaders: "never persist",
    rune: { name: "My verified rune", level: 4 },
    glyph: null,
    relic: { name: "My verified relic", level: 2 }
  };
  layout.perches[0] = {
    ...layout.perches[0],
    capturedPayload: "never persist",
    level: 30,
    dragonName: "Aevros",
    dragonClass: "Warrior",
    dragonTier: "Mythic · Tier 4",
    dragonLevel: 100,
    riderName: "Freeda",
    riderLevel: 50,
    towerBonus: "tower-health-15",
    skills: [{ name: "Increase Archer Tower's HP", level: 5 }],
    gear: {
      ...layout.perches[0].gear,
      head: { name: "Glamorous Defender Helm", rarity: "Legendary", level: 10 }
    }
  };
  await database.saveOnyxBaseLayout(layout);
  assert.equal(operations.at(-1).table, "player_base_layouts");
  assert.equal(operations.at(-1).action, "upsert");
  assert.equal(operations.at(-1).payload.user_id, "player-one");
  assert.equal(operations.at(-1).payload.layout.slots.length, 40);
  assert.equal(operations.at(-1).payload.layout.slots[0].type, "Manual Future Tower");
  assert.equal(operations.at(-1).payload.layout.slots[0].level, 301);
  assert.equal(operations.at(-1).payload.layout.version, 2);
  assert.equal(operations.at(-1).payload.layout.slots[0].rune.name, "My verified rune");
  assert.equal(operations.at(-1).payload.layout.perches.length, 3);
  assert.equal(operations.at(-1).payload.layout.perches[0].riderName, "Freeda");
  assert.equal(operations.at(-1).payload.layout.perches[0].skills[0].level, 5);
  assert.equal(operations.at(-1).payload.layout.perches[0].gear.head.level, 10);
  assert.equal("rawHar" in operations.at(-1).payload.layout, false);
  assert.equal("requestHeaders" in operations.at(-1).payload.layout.slots[0], false);
  assert.equal("capturedPayload" in operations.at(-1).payload.layout.perches[0], false);
  assert.match(operations.at(-1).payload.updated_at, /^\d{4}-\d{2}-\d{2}T/);

  const legacyLayout = {
    version: 1,
    name: "Legacy Base",
    slots: Array.from({ length: 40 }, () => null)
  };
  legacyLayout.slots[0] = { type: "Archer Tower", level: 100, notes: "Kept" };
  await database.saveOnyxBaseLayout(legacyLayout);
  assert.equal(operations.at(-1).payload.layout.version, 2);
  assert.equal(operations.at(-1).payload.layout.slots[0].type, "Archer Tower");
  assert.equal(operations.at(-1).payload.layout.perches.length, 3);
  assert.equal(operations.at(-1).payload.layout.perches[0].name, "Riverwatch Perch");

  currentUserId = "player-two";
  await database.saveOnyxBaseLayout(null);
  assert.equal(operations.at(-1).action, "delete");
  assert.deepEqual(operations.at(-1).filters, [["user_id", "player-two"]]);

  await assert.rejects(
    database.saveOnyxBaseLayout({ name: "Bad", slots: [] }),
    /exactly 40 slots/
  );

  console.log("Onyx account-scoped profile sync checks passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
