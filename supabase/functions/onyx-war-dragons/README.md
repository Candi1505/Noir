# Onyx War Dragons gateway

This Edge Function signs read-only War Dragons API requests without exposing
a player API key or the application client secret to the public GitHub Pages
client. It prefers the signed-in player's encrypted connection and preserves
the original owner-only key as a temporary migration fallback.

## Required project secrets

- `WAR_DRAGONS_API_KEY`
- `WAR_DRAGONS_CLIENT_SECRET`
- `WAR_DRAGONS_OWNER_USER_ID` — the Supabase Auth UUID allowed to use the
  owner fallback API key
- `WAR_DRAGONS_TOKEN_ENCRYPTION_KEY` — the same server-only encryption secret
  used by `onyx-war-dragons-oauth`

Do not put secret values in this repository, browser storage, application
logs, screenshots, or support messages.

Run `supabase/war_dragons_multi_player_oauth.sql` before deploying this
function. It installs the server-only encrypted connection store and the
atomic, per-user Atlas critical-request pacing claim used across all Edge
Function instances.

## Request contract

The caller must have a valid Supabase user session and send:

```json
{
  "resource": "profile"
}
```

`profile` maps to the official read-only
`/api/v1/player/public/my_profile` endpoint. The Atlas client also uses the
allowlisted `atlasMacro`, `atlasInfo` and `atlasCritical` resources. Critical
requests accept at most 100 canonical castle coordinates and are durably
paced to one claim per signed-in user per second before the upstream request.

Deploy with Supabase JWT verification enabled. The handler validates the
Supabase session, loads only that user's encrypted connection and never sends
the decrypted API key to the browser.
