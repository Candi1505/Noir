const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = file =>
  fs.readFileSync(file, "utf8");

const html = read("index.html");
const app = read("app.js");
const database = read("database.js");
const publisher = read(
  "admin-event-publisher.js"
);
const access = read("access-control.js");
const sql = read(
  "supabase/invite_only_access.sql"
);
const robots = read("robots.txt");

assert.match(
  html,
  /id="accessGate"/,
  "Private sign-in gate must exist."
);
assert.match(
  html,
  /noindex, nofollow, noarchive/,
  "Search engines must receive no-index instructions."
);
assert.doesNotMatch(
  html,
  /Create (?:player )?account/i,
  "Public account creation must not be offered."
);
assert.doesNotMatch(
  database,
  /\.signUp\s*\(/,
  "The browser must not call public sign-up."
);
assert.match(
  database,
  /profile\?\.access_approved === true/,
  "Database access must require explicit approval."
);
assert.match(
  app,
  /if \(!player\?\.isApproved\)/,
  "Startup must reject an unapproved account."
);
assert.doesNotMatch(
  app,
  /opening (?:in )?device mode/i,
  "Cloud failure must not bypass private access."
);
assert.doesNotMatch(
  publisher,
  /Guest Access|showingSignUp|signUpMember/,
  "Settings must not expose guest or sign-up paths."
);
assert.match(
  access,
  /if \(!access\.isApproved\)/,
  "The sign-in gate must verify approval."
);
assert.match(
  sql,
  /revoke all on table public\.predictors from anon/i,
  "Anonymous predictor privileges must be revoked."
);
assert.match(
  sql,
  /public\.is_noir_member\(\)/,
  "Predictor RLS must require approved membership."
);
assert.match(
  sql,
  /protect_noir_access_fields/,
  "Approval fields must be protected from self-promotion."
);
assert.equal(
  robots.trim(),
  "User-agent: *\nDisallow: /",
  "robots.txt must discourage indexing."
);

console.log(
  "Invite-only access checks passed."
);
