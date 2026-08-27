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

  await database.saveOnyxCommandState({ currentKeys: 23 });
  assert.deepEqual(operations.at(-1).filters, [["user_id", "player-one"]]);
  assert.equal(operations.at(-1).payload.onyx_command_preferences.currentKeys, 23);

  await assert.rejects(
    database.saveOnyxCommandState({ currentKeys: 41 }),
    /0 to 40/
  );

  const layout = {
    version: 1,
    name: "Main Base",
    slots: Array.from({ length: 40 }, () => null)
  };
  await database.saveOnyxBaseLayout(layout);
  assert.equal(operations.at(-1).table, "player_base_layouts");
  assert.equal(operations.at(-1).action, "upsert");
  assert.equal(operations.at(-1).payload.user_id, "player-one");
  assert.equal(operations.at(-1).payload.layout.slots.length, 40);

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
