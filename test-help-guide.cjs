const assert = require("node:assert/strict");
const fs = require("node:fs");

const command = fs.readFileSync(
  "onyx-command.js",
  "utf8"
);
const html = fs.readFileSync(
  "index.html",
  "utf8"
);

assert.match(command, /"help"/);
assert.match(command, /function renderHelp\(\)/);
assert.match(command, /data-onyx-command="help"/);
assert.doesNotMatch(command, /onyx-help-intro/);
assert.doesNotMatch(command, /experienced players/);
assert.match(command, /Getting started/);
assert.match(command, /Season Command/);
assert.match(command, /Chest Command/);
assert.match(command, /Base & Towers/);
assert.match(command, /Rider Intelligence/);
assert.match(command, /Atlas Command/);
assert.match(command, /Calculators/);
assert.match(command, /Your data & privacy/);
assert.match(
  command,
  /mailto:noirchestcompanion@gmail\.com\?subject=Onyx%20Command%20Support/
);
assert.match(html, /data-command="help"/);
assert.match(html, /Email noirchestcompanion@gmail\.com/);
assert.match(
  html,
  /onyx-command\.css\?v=20260828-audit-2/
);
assert.match(
  html,
  /onyx-command\.js\?v=20260828-help-tidy-1/
);

console.log("Onyx in-app help guide checks passed.");
