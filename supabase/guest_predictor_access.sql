-- Noir guest predictor access
--
-- Guests may read only the sanitised columns used by the live predictor and
-- only from currently active rows. Existing administrator write policies are
-- unchanged; anon receives no INSERT, UPDATE, or DELETE privileges.

begin;

alter table public.predictors enable row level security;

revoke all on table public.predictors from anon;

grant select (
  id,
  chest_type,
  version,
  predictor_data,
  uploaded_at
) on table public.predictors to anon;

drop policy if exists "Public can read active Noir predictors"
  on public.predictors;

create policy "Public can read active Noir predictors"
  on public.predictors
  for select
  to anon
  using (active = true);

commit;
