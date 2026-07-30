-- NOIR • I ZI atomic five-chest event publishing
--
-- Run this once in Supabase SQL Editor before publishing an Arcane event.
-- It validates every predictor first, then replaces all supplied chest
-- records in one transaction. If any chest fails, none are changed.

begin;

create or replace function public.publish_noir_event(
  p_version bigint,
  p_predictors jsonb
)
returns setof public.predictors
language plpgsql
security definer
set search_path = public
as $$
declare
  predictor jsonb;
  predictor_chest_type text;
  allowed_chest_types constant text[] :=
    array['gold', 'platinum', 'draconic', 'freedom', 'arcane'];
begin
  if auth.uid() is null or not public.is_noir_admin() then
    raise exception 'Administrator access is required to publish predictor data';
  end if;

  if p_version is null or p_version <= 0 then
    raise exception 'A valid predictor version is required';
  end if;

  if jsonb_typeof(p_predictors) <> 'array'
     or jsonb_array_length(p_predictors) = 0
     or jsonb_array_length(p_predictors) > array_length(allowed_chest_types, 1) then
    raise exception 'Between one and five predictor records are required';
  end if;

  -- Validate the whole request before changing any active rows.
  for predictor in
    select value
    from jsonb_array_elements(p_predictors)
  loop
    predictor_chest_type :=
      lower(trim(coalesce(predictor ->> 'chest_type', '')));

    if not (predictor_chest_type = any(allowed_chest_types)) then
      raise exception 'Unsupported chest type: %', predictor_chest_type;
    end if;

    if jsonb_typeof(predictor -> 'predictor_data') <> 'object' then
      raise exception 'Predictor data is missing for %', predictor_chest_type;
    end if;

    if predictor #>> '{predictor_data,schema}' <> 'noir-live-event-v1' then
      raise exception 'Invalid predictor schema for %', predictor_chest_type;
    end if;
  end loop;

  if (
    select count(*) <> count(distinct lower(trim(value ->> 'chest_type')))
    from jsonb_array_elements(p_predictors)
  ) then
    raise exception 'Duplicate chest types are not allowed';
  end if;

  update public.predictors
  set active = false
  where active is true
    and chest_type in (
      select lower(trim(value ->> 'chest_type'))
      from jsonb_array_elements(p_predictors)
    );

  return query
  insert into public.predictors (
    chest_type,
    version,
    predictor_data,
    uploaded_by,
    uploaded_at,
    active
  )
  select
    lower(trim(value ->> 'chest_type')),
    p_version,
    value -> 'predictor_data',
    auth.uid(),
    now(),
    true
  from jsonb_array_elements(p_predictors)
  returning *;
end;
$$;

revoke all
on function public.publish_noir_event(bigint, jsonb)
from public;

grant execute
on function public.publish_noir_event(bigint, jsonb)
to authenticated;

commit;
