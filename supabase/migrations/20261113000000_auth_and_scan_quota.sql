-- ecriture.ai: per-account lifetime scan allowance and optional global daily cap.
-- Run this migration in the Supabase SQL Editor or through the Supabase CLI.

create table if not exists public.profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    plan text not null default 'free',
    -- NULL means use FREE_SCAN_LIMIT from the backend. Set an explicit value
    -- here later for paid/custom plans without changing the quota functions.
    scan_limit integer null check (scan_limit is null or scan_limit >= 0),
    scans_used integer not null default 0 check (scans_used >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.scan_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    created_at timestamptz not null default now(),
    status text not null check (status in ('reserved', 'completed', 'refunded')),
    global_counted boolean not null default false,
    characters integer null check (characters is null or characters >= 0)
);

create index if not exists scan_log_user_created_idx
    on public.scan_log (user_id, created_at desc);

create table if not exists public.global_daily_usage (
    usage_date date primary key,
    scans_used integer not null default 0 check (scans_used >= 0),
    updated_at timestamptz not null default now()
);

-- Automatically provision a profile when Supabase Auth creates a user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_ecriture_profile on auth.users;
create trigger on_auth_user_created_ecriture_profile
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Return usage for the authenticated user. The backend invokes this with the
-- service-role key only; browser clients cannot call this function directly.
create or replace function public.get_scan_usage(
    p_user_id uuid,
    p_default_scan_limit integer
)
returns table (
    plan text,
    scans_used integer,
    scan_limit integer,
    scans_remaining integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_plan text;
    v_used integer;
    v_limit integer;
begin
    insert into public.profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select p.plan, p.scans_used, coalesce(p.scan_limit, greatest(0, p_default_scan_limit))
      into v_plan, v_used, v_limit
      from public.profiles p
     where p.user_id = p_user_id;

    return query select v_plan, v_used, v_limit, greatest(0, v_limit - v_used);
end;
$$;

-- Reserve a scan atomically. Row locking prevents simultaneous requests from
-- exceeding a user's allowance. The optional global cap is a circuit breaker.
create or replace function public.reserve_scan(
    p_user_id uuid,
    p_default_scan_limit integer,
    p_global_daily_limit integer default 0
)
returns table (
    allowed boolean,
    reason text,
    plan text,
    scans_used integer,
    scan_limit integer,
    scans_remaining integer,
    reservation_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_plan text;
    v_used integer;
    v_limit integer;
    v_global_used integer;
    v_today date := (now() at time zone 'utc')::date;
begin
    insert into public.profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

    select p.plan, p.scans_used, coalesce(p.scan_limit, greatest(0, p_default_scan_limit))
      into v_plan, v_used, v_limit
      from public.profiles p
     where p.user_id = p_user_id
     for update;

    if v_used >= v_limit then
        allowed := false;
        reason := 'user_quota_exceeded';
        plan := v_plan;
        scans_used := v_used;
        scan_limit := v_limit;
        scans_remaining := 0;
        reservation_id := null;
        return next;
        return;
    end if;

    if greatest(0, p_global_daily_limit) > 0 then
        insert into public.global_daily_usage (usage_date, scans_used)
        values (v_today, 0)
        on conflict (usage_date) do nothing;

        update public.global_daily_usage g
           set scans_used = g.scans_used + 1,
               updated_at = now()
         where g.usage_date = v_today
           and g.scans_used < p_global_daily_limit
        returning g.scans_used into v_global_used;

        if not found then
            allowed := false;
            reason := 'global_daily_limit';
            plan := v_plan;
            scans_used := v_used;
            scan_limit := v_limit;
            scans_remaining := greatest(0, v_limit - v_used);
            reservation_id := null;
            return next;
            return;
        end if;
    end if;

    update public.profiles p
       set scans_used = p.scans_used + 1,
           updated_at = now()
     where p.user_id = p_user_id
    returning p.scans_used into v_used;

    insert into public.scan_log (user_id, status, global_counted)
    values (p_user_id, 'reserved', greatest(0, p_global_daily_limit) > 0)
    returning id into reservation_id;

    allowed := true;
    reason := 'reserved';
    plan := v_plan;
    scans_used := v_used;
    scan_limit := v_limit;
    scans_remaining := greatest(0, v_limit - v_used);
    return next;
end;
$$;

create or replace function public.finish_scan(
    p_reservation_id uuid,
    p_characters integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_updated integer;
begin
    update public.scan_log
       set status = 'completed',
           characters = greatest(0, p_characters)
     where id = p_reservation_id
       and status = 'reserved';
    get diagnostics v_updated = row_count;
    return v_updated = 1;
end;
$$;

-- Refund only an outstanding reservation. Its original UTC date is used to
-- reverse the global circuit-breaker count, even if a long request crosses midnight.
create or replace function public.refund_scan(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_user_id uuid;
    v_created_at timestamptz;
    v_global_counted boolean;
    v_updated integer;
    v_usage_date date;
begin
    select s.user_id, s.created_at, s.global_counted
      into v_user_id, v_created_at, v_global_counted
      from public.scan_log s
     where s.id = p_reservation_id
       and s.status = 'reserved'
     for update;

    if not found then
        return false;
    end if;

    update public.profiles
       set scans_used = greatest(0, scans_used - 1),
           updated_at = now()
     where user_id = v_user_id;

    if v_global_counted then
        v_usage_date := (v_created_at at time zone 'utc')::date;
        update public.global_daily_usage
           set scans_used = greatest(0, scans_used - 1),
               updated_at = now()
         where usage_date = v_usage_date;
    end if;

    update public.scan_log
       set status = 'refunded'
     where id = p_reservation_id
       and status = 'reserved';
    get diagnostics v_updated = row_count;
    return v_updated = 1;
end;
$$;

-- No direct browser writes to usage data. The backend's service-role RPC calls
-- are the only supported quota mutation path.
alter table public.profiles enable row level security;
alter table public.scan_log enable row level security;
alter table public.global_daily_usage enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.scan_log from anon, authenticated;
revoke all on public.global_daily_usage from anon, authenticated;
grant all on public.profiles to service_role;
grant all on public.scan_log to service_role;
grant all on public.global_daily_usage to service_role;

revoke all on function public.get_scan_usage(uuid, integer) from public, anon, authenticated;
revoke all on function public.reserve_scan(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.finish_scan(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_scan(uuid) from public, anon, authenticated;
grant execute on function public.get_scan_usage(uuid, integer) to service_role;
grant execute on function public.reserve_scan(uuid, integer, integer) to service_role;
grant execute on function public.finish_scan(uuid, integer) to service_role;
grant execute on function public.refund_scan(uuid) to service_role;
