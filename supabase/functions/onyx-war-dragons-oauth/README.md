# Onyx War Dragons multi-player authorisation

This function implements the documented War Dragons community application
flow without returning a player API key to the GitHub Pages client.

Deploy this function with JWT verification disabled because War Dragons calls
the `GET` callback without a Supabase session. Every browser `POST` action is
still authenticated inside the handler against Supabase Auth.

## Registered War Dragons auth URL

`https://prjixwuvyhiqzoekoadj.supabase.co/functions/v1/onyx-war-dragons-oauth`

## Required secrets

- `WAR_DRAGONS_CLIENT_ID`
- `WAR_DRAGONS_CLIENT_SECRET`
- `WAR_DRAGONS_TOKEN_ENCRYPTION_KEY` — at least 24 random characters
- `WAR_DRAGONS_MULTI_PLAYER_ENABLED=true` — set only after approval

Supabase provides the project URL and publishable/secret keys to the function.
Never put the client secret, encryption key or a player API key in GitHub,
browser storage, logs, screenshots or support messages.

## Browser actions

- `status` — safe connection metadata only
- `begin` — returns the official War Dragons authorisation URL
- `complete` — consumes a short-lived one-time handoff after callback
- `disconnect` — removes the encrypted player key from Onyx

Run `supabase/war_dragons_multi_player_oauth.sql` before enabling the function.
