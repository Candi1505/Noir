Excellent—Supabase security is now installed successfully ✅

Before creating your admin account, we need update the testing branch with the two schema corrections discovered today.

First download the corrected application file:

database.js

Then on GitHub:

Make sure the branch is beta-har-fix-clean.
Click Add file → Upload files → choose your files.
Select the newly downloaded database.js.
Confirm the displayed filename is exactly database.js.
Commit message:
Match existing Supabase schema
Commit directly to beta-har-fix-clean.

Tell me when that corrected file is committed.

isnt it already ther?

There is already a database.js, but it’s the version from before we discovered your real Supabase columns.

The corrected version changes:

profiles.id → profiles.user_id
Text predictor versions → integer versions

So yes, we need upload the new database.js to replace the existing one on beta-har-fix-clean. GitHub will recognise it as an update, not create a duplicate.

where is the new dadtbase.js

Download the new corrected file here:

database.js

It should appear in your laptop’s Downloads folder as:

database.js

Then upload that file to beta-har-fix-clean, replacing the existing GitHub version.

ok i changed it
Worked for 11s

The corrected database.js is now an exact match ✅

We also need replace the repository’s SQL file so future setup instructions remain correct.

Use the corrected SQL file you just successfully ran—or download it again:

noir-live-predictors.sql

Upload it to beta-har-fix-clean exactly as before, replacing the root file named:

noir-live-predictors.sql

Commit message:

Correct Supabase profile key

Tell me when it’s committed.

noir-live-predictors.sql
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

noir-live-predictors.sql
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
