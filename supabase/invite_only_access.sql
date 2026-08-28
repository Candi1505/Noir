-- NOIR • I ZI authenticated member access
-- Historical filename retained so deployed migration references remain stable.

begin;

alter table public.profiles
  add column if not exists access_approved boolean not null default false;

create or replace function public.is_noir_member()
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
        access_approved is true or
        is_admin is true or
        pg_catalog.lower(coalesce(role, '')) = 'admin'
      )
  );
$$;

revoke all on function public.is_noir_member()
  from public, anon, authenticated;
grant execute on function public.is_noir_member() to authenticated;

alter table public.predictors enable row level security;

-- Remove the old anonymous predictor access completely.
drop policy if exists "Public can read active Noir predictors"
  on public.predictors;
revoke all on table public.predictors from anon;
revoke all privileges on table public.predictors from authenticated;
revoke all privileges on table public.predictors from public;
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

-- Approved authenticated members may read only active, sanitised predictors.
grant select (
  id,
  chest_type,
  version,
  predictor_data,
  uploaded_at
) on table public.predictors to authenticated;

drop policy if exists "Noir players read active predictors"
  on public.predictors;
create policy "Noir players read active predictors"
  on public.predictors
  for select
  to authenticated
  using (
    active is true and
    public.is_noir_member()
  );

-- An authenticated browser must never be able to approve or promote itself.
create or replace function public.protect_noir_access_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_noir_admin()
     and (
       new.access_approved is distinct from old.access_approved or
       new.is_admin is distinct from old.is_admin or
       new.role is distinct from old.role
     )
  then
    raise exception 'Noir access fields may only be changed by an administrator';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_noir_access_fields
  on public.profiles;
create trigger protect_noir_access_fields
before update on public.profiles
for each row
execute function public.protect_noir_access_fields();

revoke all on function public.protect_noir_access_fields()
  from public, anon, authenticated;

-- Account profiles are provisioned only by the controlled registration
-- service. Browsers cannot create a first row and choose privileged fields.
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

-- Lets a signed-in Noir administrator approve an Auth user by email.
create or replace function public.approve_noir_member(
  p_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_noir_admin() then
    raise exception 'Administrator access required';
  end if;

  update public.profiles as profile
  set access_approved = true
  from auth.users as auth_user
  where profile.user_id = auth_user.id
    and lower(auth_user.email) =
      lower(trim(p_email));

  if not found then
    raise exception
      'No profile found for that player account.';
  end if;
end;
$$;

revoke all on function public.approve_noir_member(text)
  from public, anon, authenticated;
grant execute on function public.approve_noir_member(text)
  to authenticated;

commit;

-- To approve a friend manually in the SQL editor after their first sign-in:
--
-- update public.profiles
-- set access_approved = true
-- where user_id = (
--   select id
--   from auth.users
--   where lower(email) = lower('FRIEND_EMAIL_HERE')
-- );
