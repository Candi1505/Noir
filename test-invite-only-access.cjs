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
const openSignupSql = read(
  "supabase/open_email_signup.sql"
);
const profileInsertLockdown = read(
  "supabase/profile_insert_lockdown.sql"
);
const registrationFunction = read(
  "supabase/functions/noir-register/index.ts"
);
const robots = read("robots.txt");

assert.match(
  html,
  /id="accessGate"/,
  "Authenticated sign-in gate must exist."
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
assert.doesNotMatch(
  access,
  /inviteSetupRequested|beginInvitedAccountSetup|[?&]invite=1/,
  "Open registration must not retain an invitation-only setup path."
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
assert.doesNotMatch(
  app,
  /isInviteSetupRequested/,
  "Application startup must not depend on invitation links."
);
assert.match(
  html,
  /noindex, nofollow, noarchive/,
  "Search engines must receive no-index instructions."
);
assert.match(
  html,
  /Create (?:player )?account/i,
  "Email/password account creation must be offered."
);
assert.match(
  database,
  /\.invoke\([\s\S]*?"noir-register"/,
  "The browser must call NOIR's controlled registration endpoint."
);
assert.doesNotMatch(
  database,
  /\.auth\s*\.signUp\s*\(/,
  "The browser must not depend on invitation or confirmation email limits."
);
assert.match(
  access,
  /signUpMember/,
  "The authenticated gate must submit new player accounts."
);
assert.match(
  access,
  /password !== confirmation/,
  "The account form must verify matching passwords."
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
  "Blocked accounts must still be rejected."
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
  database,
  /from\(["']profiles["']\)[\s\S]{0,300}\.insert\(/,
  "A browser must never create its own security-sensitive first profile row."
);
assert.match(
  profileInsertLockdown,
  /revoke insert on table public\.profiles[\s\S]*?from public, anon, authenticated/i,
  "Browser roles must not have table-level profile INSERT access."
);
assert.match(
  profileInsertLockdown,
  /before insert on public\.profiles[\s\S]*?protect_noir_profile_insert/i,
  "A defensive first-profile trigger must guard any future INSERT grant."
);
for (const forcedValue of [
  /new\.role := 'player'/i,
  /new\.is_admin := false/i,
  /new\.access_approved := false/i
]) {
  assert.match(
    profileInsertLockdown,
    forcedValue,
    `Missing malicious initial-profile protection: ${forcedValue}`
  );
}
assert.doesNotMatch(
  openSignupSql,
  /update public\.profiles\s+set access_approved = true\s+where access_approved is false/i,
  "Existing non-admin profiles must not be approved in bulk."
);
assert.match(
  openSignupSql,
  /after insert on auth\.users/i,
  "Only newly created Auth users should enter the open registration path."
);
assert.match(
  openSignupSql,
  /coalesce\(new\.is_anonymous, false\) is true/i,
  "Anonymous users must not be approved."
);
assert.match(
  openSignupSql,
  /'player'[\s\S]*?false[\s\S]*?true/i,
  "New accounts must be player-only, non-admin and approved."
);
assert.match(
  openSignupSql,
  /revoke all on function public\.register_new_noir_player\(\)[\s\S]*?from public, anon, authenticated/i,
  "The registration trigger function must not be callable by browsers."
);
assert.match(
  openSignupSql,
  /create table if not exists public\.noir_registration_attempts/i,
  "Public registration must have a server-side rate-limit ledger."
);
assert.match(
  openSignupSql,
  /grant execute on function public\.claim_noir_registration\(text\)[\s\S]*?to service_role/i,
  "Only the server role may claim a registration attempt."
);
assert.match(
  openSignupSql,
  /pg_advisory_xact_lock/i,
  "Concurrent registration attempts must be counted atomically."
);
assert.match(
  registrationFunction,
  /const allowedOrigin = "https:\/\/candi1505\.github\.io"/,
  "Registration must be restricted to NOIR's live origin."
);
assert.match(
  registrationFunction,
  /SUPABASE_SERVICE_ROLE_KEY/,
  "Account creation must stay inside the server function."
);
assert.doesNotMatch(
  registrationFunction,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  "The server function must not contain a hard-coded Supabase key."
);
assert.match(
  registrationFunction,
  /email_confirm: true/,
  "New accounts must work without consuming confirmation emails."
);
assert.equal(
  robots.trim(),
  "User-agent: *\nDisallow: /",
  "robots.txt must discourage indexing."
);

console.log(
  "Authenticated email/password access checks passed."
);
