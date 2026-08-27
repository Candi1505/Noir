const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const commandSource = fs.readFileSync("onyx-command.js", "utf8");
const baseSource = fs.readFileSync("onyx-base-command.js", "utf8");
const chestToolsSource = fs.readFileSync("noir-chest-tools.js", "utf8");
const profileSql = fs.readFileSync("supabase/onyx_command_profile_state.sql", "utf8");
const databaseSource = fs.readFileSync("database.js", "utf8");

assert.match(html, /<title>Onyx Command/);
assert.equal((html.match(/class="onyx-command-card /g) || []).length, 6);
assert.equal((html.match(/class="navigation-button/g) || []).length, 3);
assert.doesNotMatch(html, /<script[^>]+base-planner\.js/);
assert.match(commandSource, /max="40"/);
assert.match(commandSource, /Brickscale[\s\S]+19503/);
assert.match(commandSource, /Charged Volt Tower[\s\S]+38800/);
assert.match(commandSource, /90,803 sigils/);
assert.match(commandSource, /Wave 1/);
assert.doesNotMatch(
  html + commandSource + chestToolsSource,
  /\p{Extended_Pictographic}/u,
  "The Onyx mobile shell must use its SVG icon system instead of emoji."
);

assert.match(baseSource, /YOUR LAYOUT IS NOT IN THE HAR/);
assert.match(baseSource, /Array\.from\(\{ length: TOTAL_SLOTS \}, \(\) => null\)/);
assert.doesNotMatch(baseSource, /Math\.pow|defensivePower\s*=|estimatedDp/i);
assert.match(profileSql, /jsonb_array_length\(candidate -> 'slots'\) = 40/);
assert.match(profileSql, /alter table public\.player_base_layouts enable row level security/i);
assert.match(profileSql, /revoke all on table public\.player_base_layouts from anon, authenticated/i);
assert.match(profileSql, /\(select auth\.uid\(\)\) = user_id/g);
assert.match(databaseSource, /\.from\("player_base_layouts"\)/);
assert.match(databaseSource, /\.eq\("user_id", user\.id\)/);

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
    getItem: () => null,
    setItem() {},
    removeItem() {}
  },
  document: {
    readyState: "loading",
    addEventListener() {}
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("base-adviser-catalog-towers.js", "utf8"), sandbox);
vm.runInContext(baseSource, sandbox);

const blankLayout = sandbox.OnyxBaseCommand.createLayout("Test Base");
assert.equal(blankLayout.name, "Test Base");
assert.equal(blankLayout.slots.length, 40);
assert.equal(blankLayout.slots.every(slot => slot === null), true);
assert.equal(sandbox.OnyxBaseCommand.getTowerRecord("Archer Tower", 1).level, 1);
assert.equal(sandbox.OnyxBaseCommand.getTowerRecord("Archer Tower", 999), null);

console.log("Onyx shell, evidence boundaries and profile isolation checks passed.");
