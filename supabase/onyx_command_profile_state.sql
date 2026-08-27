-- Onyx Command player-owned season preferences and manual base layouts.
-- Raw HAR captures must never be stored in these fields.

begin;

alter table public.profiles
  add column if not exists onyx_command_preferences jsonb
  not null
  default '{"version":1,"currentKeys":null}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_onyx_command_preferences_valid;

alter table public.profiles
  add constraint profiles_onyx_command_preferences_valid
  check (
    jsonb_typeof(onyx_command_preferences) = 'object'
    and onyx_command_preferences @> '{"version":1}'::jsonb
    and case jsonb_typeof(onyx_command_preferences -> 'currentKeys')
      when 'null' then true
      when 'number' then
        (onyx_command_preferences ->> 'currentKeys')::numeric between 0 and 40
        and (onyx_command_preferences ->> 'currentKeys')::numeric =
          trunc((onyx_command_preferences ->> 'currentKeys')::numeric)
      else false
    end
    and octet_length(onyx_command_preferences::text) <= 4096
  );

create table if not exists public.player_base_layouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_valid_onyx_base_layout(candidate jsonb)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
declare
  layout_version integer;
  slot jsonb;
  monument jsonb;
  perch jsonb;
  skill jsonb;
  gear jsonb;
  gear_item jsonb;
  field_name text;
  perch_index integer := 0;
  expected_perch_names text[] := array[
    'Riverwatch Perch',
    'Seagazer Perch',
    'Stonespear Perch'
  ];
  gear_slots text[] := array[
    'head', 'chest', 'gloves', 'pants',
    'boots', 'weapons', 'shield', 'rings'
  ];
begin
  if jsonb_typeof(candidate) <> 'object'
    or jsonb_typeof(candidate -> 'version') <> 'number'
    or (candidate ->> 'version') not in ('1', '2')
  then
    return false;
  end if;

  layout_version := (candidate ->> 'version')::integer;

  if exists (
    select 1
    from jsonb_object_keys(candidate) as top_level(key)
    where top_level.key not in ('version', 'name', 'slots', 'perches', 'updatedAt')
  )
    or jsonb_typeof(candidate -> 'name') <> 'string'
    or char_length(candidate ->> 'name') not between 1 and 60
    or (
      candidate ? 'updatedAt'
      and (
        jsonb_typeof(candidate -> 'updatedAt') <> 'string'
        or char_length(candidate ->> 'updatedAt') not between 1 and 64
      )
    )
    or jsonb_typeof(candidate -> 'slots') <> 'array'
    or jsonb_array_length(candidate -> 'slots') <> 40
  then
    return false;
  end if;

  for slot in select value from jsonb_array_elements(candidate -> 'slots') loop
    if jsonb_typeof(slot) = 'null' then
      continue;
    end if;
    if jsonb_typeof(slot) <> 'object'
      or exists (
        select 1
        from jsonb_object_keys(slot) as slot_field(key)
        where slot_field.key not in (
          'type', 'level', 'notes', 'rune', 'glyph', 'relic'
        )
      )
      or (
        layout_version = 1
        and (slot ? 'rune' or slot ? 'glyph' or slot ? 'relic')
      )
      or jsonb_typeof(slot -> 'type') <> 'string'
      or char_length(slot ->> 'type') not between 1 and 80
      or jsonb_typeof(slot -> 'level') <> 'number'
    then
      return false;
    end if;
    if (slot ->> 'level')::numeric not between 1 and 999
      or (slot ->> 'level')::numeric <> trunc((slot ->> 'level')::numeric)
      or (
        slot ? 'notes'
        and (
          jsonb_typeof(slot -> 'notes') <> 'string'
          or char_length(slot ->> 'notes') > 250
        )
      )
    then
      return false;
    end if;

    foreach field_name in array array['rune', 'glyph', 'relic'] loop
      if not (slot ? field_name) or jsonb_typeof(slot -> field_name) = 'null' then
        continue;
      end if;
      monument := slot -> field_name;
      if jsonb_typeof(monument) <> 'object'
        or exists (
          select 1 from jsonb_object_keys(monument) as item_field(key)
          where item_field.key not in ('name', 'level')
        )
        or jsonb_typeof(monument -> 'name') <> 'string'
        or char_length(monument ->> 'name') not between 1 and 120
        or jsonb_typeof(monument -> 'level') <> 'number'
      then
        return false;
      end if;
      if (monument ->> 'level')::numeric not between 1 and 99
        or (monument ->> 'level')::numeric <> trunc((monument ->> 'level')::numeric)
      then
        return false;
      end if;
    end loop;
  end loop;

  if layout_version = 1 then
    return not (candidate ? 'perches') and octet_length(candidate::text) <= 32768;
  end if;

  if jsonb_typeof(candidate -> 'perches') <> 'array'
    or jsonb_array_length(candidate -> 'perches') <> 3
  then
    return false;
  end if;

  for perch in select value from jsonb_array_elements(candidate -> 'perches') loop
    perch_index := perch_index + 1;
    if jsonb_typeof(perch) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(perch) as perch_field(key)
        where perch_field.key not in (
          'name', 'level', 'dragonName', 'dragonClass', 'dragonTier',
          'dragonLevel', 'riderName', 'riderLevel', 'elementalResistance',
          'towerBonus', 'specialBonus', 'skills', 'gear'
        )
      )
      or jsonb_typeof(perch -> 'name') <> 'string'
      or perch ->> 'name' <> expected_perch_names[perch_index]
    then
      return false;
    end if;

    foreach field_name in array array[
      'dragonName', 'dragonClass', 'dragonTier', 'riderName',
      'elementalResistance', 'towerBonus', 'specialBonus'
    ] loop
      if jsonb_typeof(perch -> field_name) <> 'string'
        or char_length(perch ->> field_name) > (case field_name
          when 'dragonName' then 120
          when 'dragonClass' then 40
          when 'dragonTier' then 80
          when 'riderName' then 120
          else 40
        end)
      then
        return false;
      end if;
    end loop;

    foreach field_name in array array['level', 'dragonLevel', 'riderLevel'] loop
      if jsonb_typeof(perch -> field_name) <> 'number' then
        return false;
      end if;
      if (perch ->> field_name)::numeric not between 0 and 999
        or (perch ->> field_name)::numeric <> trunc((perch ->> field_name)::numeric)
      then
        return false;
      end if;
    end loop;

    if jsonb_typeof(perch -> 'skills') <> 'array'
      or jsonb_array_length(perch -> 'skills') > 32
    then
      return false;
    end if;
    for skill in select value from jsonb_array_elements(perch -> 'skills') loop
      if jsonb_typeof(skill) <> 'object'
        or exists (
          select 1 from jsonb_object_keys(skill) as skill_field(key)
          where skill_field.key not in ('name', 'level')
        )
        or jsonb_typeof(skill -> 'name') <> 'string'
        or char_length(skill ->> 'name') not between 1 and 120
        or jsonb_typeof(skill -> 'level') <> 'number'
      then
        return false;
      end if;
      if (skill ->> 'level')::numeric not between 1 and 99
        or (skill ->> 'level')::numeric <> trunc((skill ->> 'level')::numeric)
      then
        return false;
      end if;
    end loop;

    gear := perch -> 'gear';
    if jsonb_typeof(gear) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(gear) as gear_field(key)
        where not (gear_field.key = any(gear_slots))
      )
      or exists (
        select 1 from unnest(gear_slots) as required_slot(key)
        where not (gear ? required_slot.key)
      )
    then
      return false;
    end if;
    foreach field_name in array gear_slots loop
      gear_item := gear -> field_name;
      if jsonb_typeof(gear_item) = 'null' then
        continue;
      end if;
      if jsonb_typeof(gear_item) <> 'object'
        or exists (
          select 1 from jsonb_object_keys(gear_item) as gear_item_field(key)
          where gear_item_field.key not in ('name', 'rarity', 'level')
        )
        or jsonb_typeof(gear_item -> 'name') <> 'string'
        or char_length(gear_item ->> 'name') not between 1 and 120
        or jsonb_typeof(gear_item -> 'rarity') <> 'string'
        or char_length(gear_item ->> 'rarity') > 32
        or jsonb_typeof(gear_item -> 'level') <> 'number'
      then
        return false;
      end if;
      if (gear_item ->> 'level')::numeric not between 0 and 99
        or (gear_item ->> 'level')::numeric <> trunc((gear_item ->> 'level')::numeric)
      then
        return false;
      end if;
    end loop;
  end loop;

  return octet_length(candidate::text) <= 65536;
exception
  when others then
    return false;
end;
$$;

revoke all on function public.is_valid_onyx_base_layout(jsonb) from public, anon;
grant execute on function public.is_valid_onyx_base_layout(jsonb)
  to authenticated, service_role;

alter table public.player_base_layouts
  alter column layout drop default,
  drop constraint if exists player_base_layouts_layout_object,
  drop constraint if exists player_base_layouts_layout_size,
  drop constraint if exists player_base_layouts_layout_valid;

alter table public.player_base_layouts
  add constraint player_base_layouts_layout_valid
  check (public.is_valid_onyx_base_layout(layout));

alter table public.profiles enable row level security;
alter table public.player_base_layouts enable row level security;

revoke all on table public.profiles from anon;
revoke delete, truncate, trigger, references
  on table public.profiles from authenticated;
grant select (onyx_command_preferences),
      update (onyx_command_preferences)
  on table public.profiles to authenticated;

revoke all on table public.player_base_layouts from anon, authenticated;
grant select, insert, update, delete
  on table public.player_base_layouts to authenticated;

drop policy if exists "Players can view own base layout"
  on public.player_base_layouts;
create policy "Players can view own base layout"
  on public.player_base_layouts
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Players can create own base layout"
  on public.player_base_layouts;
create policy "Players can create own base layout"
  on public.player_base_layouts
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Players can update own base layout"
  on public.player_base_layouts;
create policy "Players can update own base layout"
  on public.player_base_layouts
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Players can delete own base layout"
  on public.player_base_layouts;
create policy "Players can delete own base layout"
  on public.player_base_layouts
  for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

commit;
