# Onyx War Dragons gateway

This Edge Function signs read-only War Dragons API requests without exposing
the application's API key or client secret to the public GitHub Pages client.

## Required project secrets

- `WAR_DRAGONS_API_KEY`
- `WAR_DRAGONS_CLIENT_SECRET`
- `WAR_DRAGONS_OWNER_USER_ID` — the Supabase Auth UUID allowed to use the
  owner API key

Do not put secret values in this repository, browser storage, application
logs, screenshots, or support messages.

## Request contract

The caller must have a valid Supabase user session and send:

```json
{
  "resource": "profile"
}
```

`profile` maps to the official read-only
`/api/v1/player/public/my_profile` endpoint. Add further resources only after
their official routes and response shapes have been verified.

Deploy with Supabase JWT verification enabled. The handler also validates the
authenticated user ID against `WAR_DRAGONS_OWNER_USER_ID` before signing an
upstream request.
