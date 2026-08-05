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
  /id="accessGateRecovery"/,
  "Password recovery must be reachable from the private gate."
);
assert.match(
  access,
  /event === "PASSWORD_RECOVERY"/,
  "The private gate must handle Supabase password-recovery links."
);
assert.match(
  access,
  /searchParams\.get\("invite"\) === "1"/,
  "The private gate must recognise an invited account setup link."
);
assert.match(
  access,
  /event === "SIGNED_IN"/,
  "An invited user's authenticated link must open password setup."
);
assert.match(
  access,
  /updateMemberPassword\(password\)/,
  "The private gate must save the recovered password."
);
assert.match(
  app,
  /isPasswordRecoveryActive/,
  "Startup must not cover the active recovery form with the app shell."
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
assert.doesNotMatch(
  sql,
  /update public\.profiles\s+set access_approved = true\s+where access_approved is false/i,
  "Existing non-admin profiles must not be approved in bulk."
);
assert.equal(
  robots.trim(),
  "User-agent: *\nDisallow: /",
  "robots.txt must discourage indexing."
);

console.log(
  "Invite-only access checks passed."
);
