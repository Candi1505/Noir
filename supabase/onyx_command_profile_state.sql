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
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select
    jsonb_typeof(candidate) = 'object'
    and candidate @> '{"version":1}'::jsonb
    and not exists (
      select 1
      from jsonb_object_keys(candidate) as top_level(key)
      where top_level.key not in ('version', 'name', 'slots', 'updatedAt')
    )
    and case
      when jsonb_typeof(candidate -> 'name') = 'string'
        then char_length(candidate ->> 'name') between 1 and 60
      else false
    end
    and case
      when not (candidate ? 'updatedAt') then true
      when jsonb_typeof(candidate -> 'updatedAt') = 'string'
        then char_length(candidate ->> 'updatedAt') between 1 and 64
      else false
    end
    and case
      when jsonb_typeof(candidate -> 'slots') = 'array' then
        jsonb_array_length(candidate -> 'slots') = 40
        and not exists (
          select 1
          from jsonb_array_elements(candidate -> 'slots') as entry(slot)
          where case jsonb_typeof(slot)
            when 'null' then false
            when 'object' then not (
              not exists (
                select 1
                from jsonb_object_keys(slot) as slot_field(key)
                where slot_field.key not in ('type', 'level', 'notes')
              )
              and jsonb_typeof(slot -> 'type') = 'string'
              and char_length(slot ->> 'type') between 1 and 80
              and case
                when jsonb_typeof(slot -> 'level') = 'number' then
                  (slot ->> 'level')::numeric between 1 and 999
                  and (slot ->> 'level')::numeric = trunc((slot ->> 'level')::numeric)
                else false
              end
              and case
                when not (slot ? 'notes') then true
                when jsonb_typeof(slot -> 'notes') = 'string'
                  then char_length(slot ->> 'notes') <= 250
                else false
              end
            )
            else true
          end
        )
      else false
    end
    and octet_length(candidate::text) <= 32768;
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
