-- Onyx Command initial-profile privilege lockdown

begin;

revoke insert on table public.profiles
  from public, anon, authenticated;

do $$
declare
  profile_column record;
begin
  for profile_column in
    select attribute.attname as column_name
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.profiles'::pg_catalog.regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
  loop
    execute pg_catalog.format(
      'revoke insert (%I) on table public.profiles from public, anon, authenticated',
      profile_column.column_name
    );
  end loop;
end;
$$;

create or replace function public.protect_noir_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.user_id is distinct from auth.uid() then
      raise exception 'A player profile must belong to the signed-in account';
    end if;

    new.role := 'player';
    new.is_admin := false;
    new.access_approved := false;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_noir_profile_insert
  on public.profiles;
create trigger protect_noir_profile_insert
before insert on public.profiles
for each row
execute function public.protect_noir_profile_insert();

revoke all on function public.protect_noir_profile_insert()
  from public, anon, authenticated;

commit;
