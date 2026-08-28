-- Secure, per-player War Dragons authorisation for Onyx Command.
--
-- War Dragons API keys are encrypted by the Edge Function before they reach
-- Postgres. Browser roles receive no table privileges and no RLS policies.

begin;

create table if not exists public.war_dragons_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_id text not null,
  api_key_ciphertext text not null,
  api_key_iv text not null,
  scopes text[] not null default array['atlas.read', 'player.public.read']::text[],
  connected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint war_dragons_connections_player_id_valid
    check (
      char_length(player_id) between 1 and 160
      and player_id !~ '[[:cntrl:]]'
    ),
  constraint war_dragons_connections_ciphertext_valid
    check (char_length(api_key_ciphertext) between 16 and 8192),
  constraint war_dragons_connections_iv_valid
    check (char_length(api_key_iv) between 12 and 128),
  constraint war_dragons_connections_scopes_valid
    check (
      cardinality(scopes) between 1 and 2
      and scopes <@ array['atlas.read', 'player.public.read']::text[]
    )
);

create unique index if not exists war_dragons_connections_active_player_uidx
  on public.war_dragons_connections (player_id)
  where revoked_at is null;

create table if not exists public.war_dragons_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint war_dragons_oauth_states_hash_valid
    check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint war_dragons_oauth_states_expiry_valid
    check (expires_at > created_at and expires_at <= created_at + interval '20 minutes')
);

create unique index if not exists war_dragons_oauth_states_active_user_uidx
  on public.war_dragons_oauth_states (user_id)
  where consumed_at is null;

create table if not exists public.war_dragons_authorization_handoffs (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id text not null,
  api_key_ciphertext text not null,
  api_key_iv text not null,
  scopes text[] not null default array['atlas.read', 'player.public.read']::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint war_dragons_handoffs_hash_valid
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint war_dragons_handoffs_player_id_valid
    check (
      char_length(player_id) between 1 and 160
      and player_id !~ '[[:cntrl:]]'
    ),
  constraint war_dragons_handoffs_ciphertext_valid
    check (char_length(api_key_ciphertext) between 16 and 8192),
  constraint war_dragons_handoffs_iv_valid
    check (char_length(api_key_iv) between 12 and 128),
  constraint war_dragons_handoffs_scopes_valid
    check (
      cardinality(scopes) between 1 and 2
      and scopes <@ array['atlas.read', 'player.public.read']::text[]
    ),
  constraint war_dragons_handoffs_expiry_valid
    check (expires_at > created_at and expires_at <= created_at + interval '20 minutes')
);

-- Existing pre-state handoffs are intentionally invalidated instead of being
-- allowed to attach to a different signed-in Onyx account.
alter table public.war_dragons_authorization_handoffs
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
delete from public.war_dragons_authorization_handoffs where user_id is null;
alter table public.war_dragons_authorization_handoffs
  alter column user_id set not null;

create index if not exists war_dragons_authorization_handoffs_user_idx
  on public.war_dragons_authorization_handoffs (user_id);

create table if not exists public.war_dragons_critical_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_claimed_at timestamptz not null default 'epoch',
  updated_at timestamptz not null default now()
);

alter table public.war_dragons_connections enable row level security;
alter table public.war_dragons_oauth_states enable row level security;
alter table public.war_dragons_authorization_handoffs enable row level security;
alter table public.war_dragons_critical_rate_limits enable row level security;

revoke all on table public.war_dragons_connections
  from public, anon, authenticated;
revoke all on table public.war_dragons_oauth_states
  from public, anon, authenticated;
revoke all on table public.war_dragons_authorization_handoffs
  from public, anon, authenticated;
revoke all on table public.war_dragons_critical_rate_limits
  from public, anon, authenticated;

grant select, insert, update, delete on table public.war_dragons_connections
  to service_role;
grant select, insert, update, delete on table public.war_dragons_oauth_states
  to service_role;
grant select, insert, update, delete on table public.war_dragons_authorization_handoffs
  to service_role;
grant select, insert, update, delete on table public.war_dragons_critical_rate_limits
  to service_role;

create or replace function public.claim_war_dragons_oauth_state(
  p_state_hash text
)
returns table (
  user_id uuid
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  oauth_state public.war_dragons_oauth_states%rowtype;
  consumed_time timestamptz := clock_timestamp();
begin
  if p_state_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select *
  into oauth_state
  from public.war_dragons_oauth_states
  where state_hash = p_state_hash
    and consumed_at is null
    and expires_at > clock_timestamp()
  for update;

  if not found then
    return;
  end if;

  update public.war_dragons_oauth_states
  set consumed_at = consumed_time
  where state_hash = p_state_hash;

  return query select oauth_state.user_id;
end;
$$;

create or replace function public.claim_war_dragons_handoff(
  p_token_hash text,
  p_user_id uuid
)
returns table (
  player_id text,
  connected_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  handoff public.war_dragons_authorization_handoffs%rowtype;
  connection_time timestamptz := clock_timestamp();
begin
  if p_user_id is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select *
  into handoff
  from public.war_dragons_authorization_handoffs
  where token_hash = p_token_hash
    and user_id = p_user_id
    and consumed_at is null
    and expires_at > clock_timestamp()
  for update;

  if not found then
    return;
  end if;

  insert into public.war_dragons_connections (
    user_id,
    player_id,
    api_key_ciphertext,
    api_key_iv,
    scopes,
    connected_at,
    last_verified_at,
    revoked_at,
    updated_at
  ) values (
    p_user_id,
    handoff.player_id,
    handoff.api_key_ciphertext,
    handoff.api_key_iv,
    handoff.scopes,
    connection_time,
    null,
    null,
    connection_time
  )
  on conflict (user_id) do update set
    player_id = excluded.player_id,
    api_key_ciphertext = excluded.api_key_ciphertext,
    api_key_iv = excluded.api_key_iv,
    scopes = excluded.scopes,
    connected_at = excluded.connected_at,
    last_verified_at = null,
    revoked_at = null,
    updated_at = excluded.updated_at;

  update public.war_dragons_authorization_handoffs
  set consumed_at = connection_time
  where token_hash = p_token_hash;

  return query
  select handoff.player_id, connection_time;
end;
$$;

revoke all on function public.claim_war_dragons_handoff(text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_war_dragons_handoff(text, uuid)
  to service_role;

revoke all on function public.claim_war_dragons_oauth_state(text)
  from public, anon, authenticated;
grant execute on function public.claim_war_dragons_oauth_state(text)
  to service_role;

create or replace function public.claim_war_dragons_critical_request(
  p_user_id uuid,
  p_interval_ms integer default 1000
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  rate_interval_ms integer := greatest(
    100,
    least(coalesce(p_interval_ms, 1000), 60000)
  );
  previous_claim timestamptz;
  claim_time timestamptz := clock_timestamp();
  remaining_ms integer;
begin
  if p_user_id is null then
    return rate_interval_ms;
  end if;

  insert into public.war_dragons_critical_rate_limits (
    user_id,
    last_claimed_at,
    updated_at
  ) values (
    p_user_id,
    claim_time - interval '1 millisecond' * rate_interval_ms,
    claim_time
  )
  on conflict (user_id) do nothing;

  select last_claimed_at
  into previous_claim
  from public.war_dragons_critical_rate_limits
  where user_id = p_user_id
  for update;

  if not found then
    return rate_interval_ms;
  end if;

  claim_time := clock_timestamp();
  if previous_claim + interval '1 millisecond' * rate_interval_ms > claim_time then
    remaining_ms := ceil(extract(epoch from (
      previous_claim + interval '1 millisecond' * rate_interval_ms - claim_time
    )) * 1000)::integer;
    return least(rate_interval_ms, greatest(1, remaining_ms));
  end if;

  update public.war_dragons_critical_rate_limits
  set last_claimed_at = claim_time,
      updated_at = claim_time
  where user_id = p_user_id;

  return 0;
end;
$$;

revoke all on function public.claim_war_dragons_critical_request(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_war_dragons_critical_request(uuid, integer)
  to service_role;

comment on table public.war_dragons_connections is
  'Server-only encrypted War Dragons API connections. Never expose through the browser.';
comment on table public.war_dragons_oauth_states is
  'Server-only, one-time OAuth state bound to the initiating signed-in Onyx user.';
comment on table public.war_dragons_authorization_handoffs is
  'Short-lived encrypted handoffs claimable only by the initiating signed-in Onyx user.';
comment on table public.war_dragons_critical_rate_limits is
  'Server-only durable pacing state for official Atlas critical requests.';

commit;
