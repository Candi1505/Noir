-- Noir Chest Companion cloud predictor security
-- Run once in the Supabase SQL editor.

alter table public.profiles
  add column if not exists role text not null default 'player',
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_noir_admin()
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
        is_admin is true or
        lower(coalesce(role, '')) = 'admin'
      )
  );
$$;

revoke all on function public.is_noir_admin() from public;
grant execute on function public.is_noir_admin() to authenticated;

alter table public.predictors enable row level security;

drop policy if exists "Noir players read active predictors"
  on public.predictors;
create policy "Noir players read active predictors"
  on public.predictors
  for select
  to authenticated
  using (active is true);

drop policy if exists "Noir admins insert predictors"
  on public.predictors;
create policy "Noir admins insert predictors"
  on public.predictors
  for insert
  to authenticated
  with check (
    public.is_noir_admin() and
    uploaded_by = auth.uid()
  );

drop policy if exists "Noir admins update predictors"
  on public.predictors;
create policy "Noir admins update predictors"
  on public.predictors
  for update
  to authenticated
  using (public.is_noir_admin())
  with check (public.is_noir_admin());

drop policy if exists "Noir admins delete predictors"
  on public.predictors;
create policy "Noir admins delete predictors"
  on public.predictors
  for delete
  to authenticated
  using (public.is_noir_admin());

-- Prevent browser clients from promoting themselves.
revoke update (role, is_admin)
  on public.profiles
  from anon, authenticated;

-- After creating Candice's email/password user in Supabase Auth,
-- replace the email below and run this statement once:
-- update public.profiles
-- set role = 'admin', is_admin = true
-- where user_id = (
--   select id from auth.users
--   where email = 'YOUR_ADMIN_EMAIL'
-- );

