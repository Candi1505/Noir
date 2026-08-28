-- Onyx Command atomic six-chest event publishing and predictor lockdown
--
-- Apply after the profile/access migrations. This is intentionally the last
-- predictor migration: it removes every browser write/TRUNCATE privilege,
-- exposes only the five safe read columns and makes the one atomic admin RPC
-- the sole publishing path.

begin;

alter table public.predictors
drop constraint if exists predictors_chest_type_check;

alter table public.predictors
add constraint predictors_chest_type_check
check (
  chest_type = any (
    array[
      'gold'::text,
      'platinum'::text,
      'draconic'::text,
      'freedom'::text,
      'arcane'::text,
      'super_sigil'::text
    ]
  )
);

-- Repair historic duplicates before enforcing one active row per chest.
with ranked_active as (
  select
    id,
    pg_catalog.row_number() over (
      partition by chest_type
      order by uploaded_at desc nulls last, id desc
    ) as active_rank
  from public.predictors
  where active is true
)
update public.predictors as predictor
set active = false
from ranked_active
where predictor.id = ranked_active.id
  and ranked_active.active_rank > 1;

create unique index if not exists predictors_one_active_per_chest_uidx
on public.predictors (chest_type)
where active is true;

-- RLS cannot protect TRUNCATE, so browser roles receive no table-level
-- privileges at all. Approved members get only the columns used by the app;
-- uploaded_by and active remain server-only.
revoke all privileges
on table public.predictors
from anon, authenticated;

revoke all privileges
on table public.predictors
from public;

revoke all privileges (
  id,
  chest_type,
  version,
  predictor_data,
  uploaded_by,
  uploaded_at,
  active
) on table public.predictors from anon, authenticated;

revoke all privileges (
  id,
  chest_type,
  version,
  predictor_data,
  uploaded_by,
  uploaded_at,
  active
) on table public.predictors from public;

grant select (
  id,
  chest_type,
  version,
  predictor_data,
  uploaded_at
) on table public.predictors to authenticated;

-- Legacy row-write policies are unnecessary once publishing is RPC-only.
drop policy if exists "Noir admins insert predictors"
  on public.predictors;
drop policy if exists "Noir admins update predictors"
  on public.predictors;
drop policy if exists "Noir admins delete predictors"
  on public.predictors;

-- Keep the authorization helper pinned to fully-qualified objects. The
-- browser may ask whether it is an admin, but cannot choose the identity.
create or replace function public.is_noir_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and (
        is_admin is true or
        pg_catalog.lower(coalesce(role, '')) = 'admin'
      )
  );
$$;

revoke all
on function public.is_noir_admin()
from public, anon, authenticated;

grant execute
on function public.is_noir_admin()
to authenticated;

-- The recursive validator lives outside the exposed public schema. It rejects
-- capture URLs, request/response data, credentials, player identifiers and
-- every known per-player deck cursor wherever a parser might nest them.
create schema if not exists onyx_private;

revoke all
on schema onyx_private
from public, anon, authenticated;

create or replace function onyx_private.predictor_payload_is_safe(
  p_value jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  item record;
  normalised_key text;
begin
  if p_value is null then
    return true;
  end if;

  if pg_catalog.jsonb_typeof(p_value) = 'object' then
    for item in
      select object_item.key, object_item.value
      from pg_catalog.jsonb_each(p_value)
        as object_item(key, value)
    loop
      normalised_key := pg_catalog.regexp_replace(
        pg_catalog.lower(item.key),
        '[^a-z0-9]',
        '',
        'g'
      );

      if normalised_key = any (
        array[
          'authorization',
          'bearer',
          'bearertoken',
          'cookie',
          'cookies',
          'setcookie',
          'header',
          'headers',
          'url',
          'email',
          'password',
          'secret',
          'clientsecret',
          'private',
          'privatekey',
          'apikey',
          'credential',
          'credentials',
          'confirmationtoken',
          'authorisationcode',
          'authorizationcode',
          'session',
          'sessionid',
          'sessiontoken',
          'accesstoken',
          'refreshtoken',
          'idtoken',
          'token',
          'pgid',
          'user',
          'userid',
          'player',
          'playerid',
          'profile',
          'deckindices',
          'index',
          'foundindex',
          'sourceindex',
          'currentvalue',
          'openedsincebonus',
          'chestsuntilbonus',
          'nextchestisbonus',
          'warnings'
        ]
      ) or
      normalised_key like 'source%' or
      normalised_key like 'request%' or
      normalised_key like 'response%' or
      normalised_key like 'credential%' or
      normalised_key like 'player%'
      then
        return false;
      end if;

      if not onyx_private.predictor_payload_is_safe(item.value) then
        return false;
      end if;
    end loop;
  elsif pg_catalog.jsonb_typeof(p_value) = 'array' then
    for item in
      select array_item.value
      from pg_catalog.jsonb_array_elements(p_value)
        as array_item(value)
    loop
      if not onyx_private.predictor_payload_is_safe(item.value) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

revoke all
on function onyx_private.predictor_payload_is_safe(jsonb)
from public, anon, authenticated;

-- Recreate the RPC because its old SETOF predictors return type exposed
-- uploaded_by. The replacement returns only a receipt for each inserted row.
drop function if exists public.publish_noir_event(bigint, jsonb);

create function public.publish_noir_event(
  p_version bigint,
  p_predictors jsonb
)
returns table (
  chest_type text,
  published_version bigint,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  predictor jsonb;
  predictor_data jsonb;
  event_data jsonb;
  canonical_event_data jsonb;
  predictor_chest_type text;
  required_chest_type text;
  required_deck_key text;
  chest_data jsonb;
  object_key_count integer;
  available_count integer;
  available_distinct_count integer;
  allowed_chest_types constant text[] :=
    array['gold', 'platinum', 'draconic', 'freedom', 'arcane', 'super_sigil'];
  allowed_predictor_keys constant text[] :=
    array['chest_type', 'predictor_data'];
  allowed_predictor_data_keys constant text[] :=
    array['schema', 'chestType', 'eventData'];
  allowed_event_keys constant text[] :=
    array[
      'schema',
      'event',
      'importedAt',
      'publishedAt',
      'ready',
      'readyChestCount',
      'availabilityKnown',
      'availableChestTypes',
      'availableChestCount',
      'chests',
      'decks',
      'drops',
      'spinTypes',
      'doubleArmory'
    ];
begin
  if auth.uid() is null or public.is_noir_admin() is not true then
    raise exception 'Administrator access is required to publish predictor data';
  end if;

  -- Serialize each complete six-chest swap. The unique index remains the
  -- invariant; this lock prevents concurrent deactivate/insert interleaving.
  perform pg_catalog.pg_advisory_xact_lock(684136690796888243);

  if p_version is null or p_version <= 0 then
    raise exception 'A valid predictor version is required';
  end if;

  if p_predictors is null or
     pg_catalog.jsonb_typeof(p_predictors) <> 'array' or
     pg_catalog.jsonb_array_length(p_predictors) <>
       pg_catalog.array_length(allowed_chest_types, 1)
  then
    raise exception 'Exactly six predictor records are required';
  end if;

  if pg_catalog.octet_length(p_predictors::text) > 10485760 then
    raise exception 'The predictor event payload is too large';
  end if;

  -- Validate the complete request before changing any active rows.
  for predictor in
    select array_item.value
    from pg_catalog.jsonb_array_elements(p_predictors)
      as array_item(value)
  loop
    if pg_catalog.jsonb_typeof(predictor) <> 'object' then
      raise exception 'Every predictor record must be an object';
    end if;

    select pg_catalog.count(*)::integer
    into object_key_count
    from pg_catalog.jsonb_object_keys(predictor);

    if object_key_count <>
         pg_catalog.array_length(allowed_predictor_keys, 1) or
       predictor - allowed_predictor_keys <> '{}'::jsonb
    then
      raise exception 'Predictor records contain missing or unsupported fields';
    end if;

    predictor_chest_type := pg_catalog.lower(
      pg_catalog.btrim(
        coalesce(predictor ->> 'chest_type', '')
      )
    );

    if not (predictor_chest_type = any(allowed_chest_types)) then
      raise exception 'Unsupported chest type: %', predictor_chest_type;
    end if;

    predictor_data := predictor -> 'predictor_data';

    if pg_catalog.jsonb_typeof(predictor_data) <> 'object' then
      raise exception 'Predictor data is missing for %', predictor_chest_type;
    end if;

    select pg_catalog.count(*)::integer
    into object_key_count
    from pg_catalog.jsonb_object_keys(predictor_data);

    if object_key_count <>
         pg_catalog.array_length(allowed_predictor_data_keys, 1) or
       predictor_data - allowed_predictor_data_keys <> '{}'::jsonb or
       coalesce(predictor_data ->> 'schema', '') <>
         'noir-live-event-v1' or
       pg_catalog.lower(
         coalesce(predictor_data ->> 'chestType', '')
       ) <> predictor_chest_type
    then
      raise exception 'Invalid predictor envelope for %', predictor_chest_type;
    end if;

    event_data := predictor_data -> 'eventData';

    if pg_catalog.jsonb_typeof(event_data) <> 'object' then
      raise exception 'Event data is missing for %', predictor_chest_type;
    end if;

    select pg_catalog.count(*)::integer
    into object_key_count
    from pg_catalog.jsonb_object_keys(event_data);

    if object_key_count <>
         pg_catalog.array_length(allowed_event_keys, 1) or
       event_data - allowed_event_keys <> '{}'::jsonb or
       coalesce(event_data ->> 'schema', '') <>
         'noir-live-event-v1' or
       pg_catalog.jsonb_typeof(event_data -> 'event') <> 'string' or
       pg_catalog.char_length(pg_catalog.btrim(event_data ->> 'event'))
         not between 1 and 160 or
       pg_catalog.jsonb_typeof(event_data -> 'importedAt') <> 'string' or
       pg_catalog.jsonb_typeof(event_data -> 'publishedAt') <> 'string' or
       coalesce(event_data -> 'ready', 'false'::jsonb) <>
         'true'::jsonb or
       coalesce(event_data ->> 'readyChestCount', '') <> '6' or
       coalesce(event_data -> 'availabilityKnown', 'false'::jsonb) <>
         'true'::jsonb
    then
      raise exception 'The shared event is not a complete ready event';
    end if;

    if canonical_event_data is null then
      canonical_event_data := event_data;
    elsif event_data <> canonical_event_data then
      raise exception 'Every predictor must contain the same event and version';
    end if;

    if not onyx_private.predictor_payload_is_safe(event_data) then
      raise exception 'Private capture or player data is not allowed in shared predictors';
    end if;
  end loop;

  if (
    select pg_catalog.count(*) <>
      pg_catalog.count(
        distinct pg_catalog.lower(
          pg_catalog.btrim(array_item.value ->> 'chest_type')
        )
      )
    from pg_catalog.jsonb_array_elements(p_predictors)
      as array_item(value)
  ) then
    raise exception 'Duplicate chest types are not allowed';
  end if;

  -- Six unique values drawn from a six-item allowlist is the exact expected
  -- chest set. Validate the common event structure once more in detail.
  event_data := canonical_event_data;

  if pg_catalog.jsonb_typeof(event_data -> 'availableChestTypes') <> 'array' or
     pg_catalog.jsonb_typeof(event_data -> 'availableChestCount') <> 'number'
  then
    raise exception 'Current chest availability is invalid';
  end if;

  select
    (pg_catalog.count(*) filter (
      where pg_catalog.lower(pg_catalog.btrim(available_chest_type.value)) =
        any(allowed_chest_types)
    ))::integer,
    pg_catalog.count(
      distinct pg_catalog.lower(
        pg_catalog.btrim(available_chest_type.value)
      )
    )::integer
  into available_count, available_distinct_count
  from pg_catalog.jsonb_array_elements_text(
    event_data -> 'availableChestTypes'
  ) as available_chest_type(value);

  if available_count <>
       pg_catalog.jsonb_array_length(event_data -> 'availableChestTypes') or
     available_count <> available_distinct_count or
     coalesce(event_data ->> 'availableChestCount', '') <>
       available_count::text
  then
    raise exception 'Current chest availability is invalid';
  end if;

  if pg_catalog.jsonb_typeof(event_data -> 'chests') <> 'object' then
    raise exception 'The shared event chest map is invalid';
  end if;

  select pg_catalog.count(*)::integer
  into object_key_count
  from pg_catalog.jsonb_object_keys(event_data -> 'chests');

  if object_key_count <>
       pg_catalog.array_length(allowed_chest_types, 1) or
     (event_data -> 'chests') - allowed_chest_types <> '{}'::jsonb
  then
    raise exception 'The shared event must contain exactly six chest decks';
  end if;

  foreach required_chest_type in array allowed_chest_types
  loop
    chest_data := event_data #> array['chests', required_chest_type];
    required_deck_key := case required_chest_type
      when 'gold' then 'gold_chest'
      when 'platinum' then 'platinum_chest'
      when 'draconic' then 'dragfrag_chest_tier3'
      when 'freedom' then 'freedom_chest'
      when 'arcane' then 'arcane_chest'
      when 'super_sigil' then 'sigil_chest'
      else null
    end;

    if pg_catalog.jsonb_typeof(chest_data) <> 'object' or
       coalesce(chest_data ->> 'key', '') <>
         required_deck_key or
       pg_catalog.jsonb_typeof(chest_data -> 'label') <> 'string' or
       pg_catalog.char_length(pg_catalog.btrim(chest_data ->> 'label')) < 1 or
       coalesce(chest_data -> 'found', 'false'::jsonb) <>
         'true'::jsonb or
       pg_catalog.jsonb_typeof(chest_data -> 'deck') <> 'array' or
       pg_catalog.jsonb_array_length(chest_data -> 'deck') < 1 or
       coalesce(chest_data ->> 'deckLength', '') <>
         pg_catalog.jsonb_array_length(chest_data -> 'deck')::text or
       pg_catalog.jsonb_typeof(chest_data -> 'available') <> 'boolean' or
       (chest_data ->> 'available')::boolean is distinct from
         (required_chest_type = any (
           array(
             select pg_catalog.lower(pg_catalog.btrim(value))
             from pg_catalog.jsonb_array_elements_text(
               event_data -> 'availableChestTypes'
             ) as available_chest_type(value)
           )
         ))
    then
      raise exception 'The shared % chest deck is invalid', required_chest_type;
    end if;
  end loop;

  if pg_catalog.jsonb_typeof(event_data -> 'decks') <> 'object' or
     pg_catalog.jsonb_typeof(event_data -> 'drops') <> 'object' or
     pg_catalog.jsonb_typeof(event_data -> 'spinTypes') <> 'array' or
     pg_catalog.jsonb_typeof(event_data -> 'doubleArmory') <> 'object' or
     coalesce(
       pg_catalog.jsonb_typeof(event_data #> '{doubleArmory,detected}'),
       'missing'
     ) <>
       'boolean' or
     coalesce(
       pg_catalog.jsonb_typeof(event_data #> '{doubleArmory,ready}'),
       'missing'
     ) <>
       'boolean' or
     coalesce(
       pg_catalog.jsonb_typeof(event_data #> '{doubleArmory,sides}'),
       'missing'
     ) <> 'object'
  then
    raise exception 'The shared deck, drop or Double Armory data is invalid';
  end if;

  if not exists (
       select 1
       from pg_catalog.jsonb_object_keys(event_data -> 'decks')
     ) or
     not exists (
       select 1
       from pg_catalog.jsonb_object_keys(event_data -> 'drops')
     ) or
     exists (
       select 1
       from pg_catalog.jsonb_each(event_data -> 'decks') as deck(key, value)
       where pg_catalog.jsonb_typeof(deck.value) <> 'array'
     ) or
     exists (
       select 1
       from pg_catalog.jsonb_each(event_data -> 'drops') as drop_pool(key, value)
       where pg_catalog.jsonb_typeof(drop_pool.value) <> 'array'
     )
  then
    raise exception 'Shared decks and drops must be non-empty array maps';
  end if;

  if auth.uid() is null or public.is_noir_admin() is not true then
    raise exception 'Administrator access changed before publishing completed';
  end if;

  update public.predictors
  set active = false
  where active is true;

  return query
  with inserted as (
    insert into public.predictors as target (
      chest_type,
      version,
      predictor_data,
      uploaded_by,
      uploaded_at,
      active
    )
    select
      pg_catalog.lower(pg_catalog.btrim(array_item.value ->> 'chest_type')),
      p_version,
      array_item.value -> 'predictor_data',
      auth.uid(),
      pg_catalog.now(),
      true
    from pg_catalog.jsonb_array_elements(p_predictors)
      as array_item(value)
    returning
      target.chest_type,
      target.version,
      target.uploaded_at
  )
  select
    inserted.chest_type::text,
    inserted.version::bigint,
    inserted.uploaded_at::timestamptz
  from inserted;
end;
$$;

revoke all
on function public.publish_noir_event(bigint, jsonb)
from public, anon, authenticated;

grant execute
on function public.publish_noir_event(bigint, jsonb)
to authenticated;

-- The old one-chest RPC can no longer be used by a browser. Revoke every
-- overload without assuming which historic signature is present.
do $$
declare
  legacy_function record;
begin
  for legacy_function in
    select procedure.oid::pg_catalog.regprocedure as identity
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'publish_noir_predictor'
  loop
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated',
      legacy_function.identity
    );
  end loop;
end;
$$;

commit;
