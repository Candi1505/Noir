-- Conservative global castle_info budget: one request per 61 seconds.
create table if not exists public.war_dragons_info_rate_limit (
  singleton boolean primary key default true check (singleton),
  claimed_at timestamptz not null
);
alter table public.war_dragons_info_rate_limit enable row level security;
revoke all on public.war_dragons_info_rate_limit from public, anon, authenticated;
grant select, insert, update on public.war_dragons_info_rate_limit to service_role;
create or replace function public.claim_war_dragons_info_request()
returns integer language plpgsql security invoker set search_path = pg_catalog as $$
declare last_claim timestamptz; now_time timestamptz;
begin
  insert into public.war_dragons_info_rate_limit values (true, '-infinity')
  on conflict do nothing;
  select claimed_at into last_claim from public.war_dragons_info_rate_limit
  where singleton = true for update;
  now_time := clock_timestamp();
  if last_claim + interval '61 seconds' > now_time then
    return ceil(extract(epoch from (last_claim + interval '61 seconds' - now_time)) * 1000)::integer;
  end if;
  update public.war_dragons_info_rate_limit set claimed_at = now_time where singleton = true;
  return 0;
end;
$$;
revoke all on function public.claim_war_dragons_info_request() from public, anon, authenticated;
grant execute on function public.claim_war_dragons_info_request() to service_role;
