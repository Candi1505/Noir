-- NOIR • I ZI invite-only access
-- Run once in the Supabase SQL editor before deploying the matching app code.

begin;

alter table public.profiles
  add column if not exists access_approved boolean not null default false;

create or replace function public.is_noir_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and (
        access_approved is true or
        is_admin is true or
        lower(coalesce(role, '')) = 'admin'
      )
  );
$$;

revoke all on function public.is_noir_member() from public;
grant execute on function public.is_noir_member() to authenticated;

alter table public.predictors enable row level security;

-- Remove the old anonymous predictor access completely.
drop policy if exists "Public can read active Noir predictors"
  on public.predictors;
revoke all on table public.predictors from anon;

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
set search_path = public
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

revoke all on function public.protect_noir_access_fields() from public;

-- Lets a signed-in Noir administrator approve an Auth user by email.
create or replace function public.approve_noir_member(
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public, auth
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
      'No profile found. The invited player must sign in once before approval.';
  end if;
end;
$$;

revoke all on function public.approve_noir_member(text) from public;
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
