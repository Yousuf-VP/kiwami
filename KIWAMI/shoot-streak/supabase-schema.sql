-- DODGE CORE player accounts and cloud progression
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- The browser uses only the public anon key. Never expose a service_role key.

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'PLAYER',
  total_xp bigint not null default 0 check (total_xp >= 0),
  cash_balance bigint not null default 0 check (cash_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

-- Grant only the browser operations the game actually needs.
revoke all on table public.player_profiles from anon, authenticated;
grant select, update on table public.player_profiles to authenticated;

drop policy if exists "Players can read their own profile" on public.player_profiles;
create policy "Players can read their own profile"
on public.player_profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Players can update their own profile" on public.player_profiles;
create policy "Players can update their own profile"
on public.player_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.create_dodge_core_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_profiles (id, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), 'PLAYER')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_dodge_core on auth.users;
create trigger on_auth_user_created_dodge_core
after insert on auth.users
for each row execute procedure public.create_dodge_core_profile();

create or replace function public.set_dodge_core_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dodge_core_profile_updated_at on public.player_profiles;
create trigger set_dodge_core_profile_updated_at
before update on public.player_profiles
for each row execute procedure public.set_dodge_core_updated_at();

-- Note: RLS prevents users from reading or writing other players' rows.
-- Client-submitted XP is not tamper-proof; competitive leaderboards need
-- server-validated score submissions before trusting progression.


-- GLOBAL LEADERBOARD SETUP
-- This section is intentionally included so one SQL run configures both
-- player progression and public leaderboard RPCs. It is safe to re-run.

-- KIWAMI DODGE CORE global leaderboard
-- Run this migration in Supabase Dashboard > SQL Editor after the existing
-- DODGE CORE player profile schema has been installed.
--
-- IMPORTANT: this RPC protects table writes and validates basic run consistency,
-- but browser-submitted score/time pairs are not cryptographic proof of gameplay.
-- A fully cheat-resistant leaderboard requires server-authoritative simulation
-- or independently verifiable run telemetry.

create table if not exists public.dodge_core_best_scores (
  player_id uuid primary key references public.player_profiles(id) on delete cascade,
  best_score integer not null default 0 check (best_score >= 0),
  best_survival_ms bigint not null default 0 check (best_survival_ms >= 0),
  difficulty text not null default 'medium'
    check (difficulty in ('easy','medium','hard','extreme','master')),
  achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dodge_core_best_scores enable row level security;
revoke all on table public.dodge_core_best_scores from anon, authenticated;
grant select on table public.dodge_core_best_scores to authenticated;

drop policy if exists "Players can read their own best score" on public.dodge_core_best_scores;
create policy "Players can read their own best score"
on public.dodge_core_best_scores for select
to authenticated
using (auth.uid() = player_id);

create index if not exists dodge_core_best_scores_rank_idx
on public.dodge_core_best_scores (best_score desc, best_survival_ms desc, achieved_at asc);

create or replace function public.submit_dodge_core_score(
  p_score integer,
  p_survival_ms bigint,
  p_difficulty text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player uuid := auth.uid();
  v_expected_score integer;
begin
  if v_player is null then
    raise exception 'Sign in is required to submit a global score.';
  end if;
  if p_score is null or p_survival_ms is null or p_score < 0 or p_survival_ms < 0 then
    raise exception 'Invalid score submission.';
  end if;
  if p_difficulty not in ('easy','medium','hard','extreme','master') then
    raise exception 'Invalid difficulty.';
  end if;

  -- DODGE CORE currently awards 10 score per second of survival.
  v_expected_score := floor(p_survival_ms::numeric / 100)::integer;
  if abs(p_score - v_expected_score) > 1 then
    raise exception 'Score and survival time do not match the current scoring rules.';
  end if;

  insert into public.dodge_core_best_scores (
    player_id, best_score, best_survival_ms, difficulty, achieved_at, updated_at
  ) values (
    v_player, p_score, p_survival_ms, p_difficulty, now(), now()
  )
  on conflict (player_id) do update set
    best_score = excluded.best_score,
    best_survival_ms = excluded.best_survival_ms,
    difficulty = excluded.difficulty,
    achieved_at = excluded.achieved_at,
    updated_at = now()
  where
    excluded.best_score > public.dodge_core_best_scores.best_score
    or (
      excluded.best_score = public.dodge_core_best_scores.best_score
      and excluded.best_survival_ms > public.dodge_core_best_scores.best_survival_ms
    );

  return true;
end;
$$;

create or replace function public.get_dodge_core_leaderboard(
  p_metric text default 'score',
  p_limit integer default 100
)
returns table (
  rank_position bigint,
  username text,
  best_score integer,
  survival_ms bigint,
  player_level integer,
  total_xp bigint,
  achieved_at timestamptz,
  is_current_player boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_metric text := lower(coalesce(p_metric, 'score'));
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
  v_player uuid := auth.uid();
begin
  if v_metric not in ('score','level','xp') then
    raise exception 'Unsupported leaderboard category.';
  end if;

  return query
  with ranked as (
    select
      p.id as player_id,
      p.username,
      coalesce(s.best_score, 0)::integer as score_value,
      coalesce(s.best_survival_ms, 0)::bigint as survival_value,
      floor(sqrt(greatest(p.total_xp, 0)::numeric / 100))::integer as level_value,
      p.total_xp::bigint as xp_value,
      s.achieved_at,
      row_number() over (
        order by
          case when v_metric = 'score' then coalesce(s.best_score, 0)::numeric end desc,
          case when v_metric = 'level' then floor(sqrt(greatest(p.total_xp, 0)::numeric / 100)) end desc,
          case when v_metric = 'xp' then p.total_xp::numeric end desc,
          coalesce(s.best_score, 0) desc,
          coalesce(s.best_survival_ms, 0) desc,
          s.achieved_at asc nulls last,
          p.created_at asc
      ) as rank_value
    from public.player_profiles p
    left join public.dodge_core_best_scores s on s.player_id = p.id
  )
  select
    r.rank_value,
    r.username,
    r.score_value,
    r.survival_value,
    r.level_value,
    r.xp_value,
    r.achieved_at,
    (r.player_id = v_player)
  from ranked r
  where r.rank_value <= v_limit or r.player_id = v_player
  order by r.rank_value;
end;
$$;

revoke all on function public.submit_dodge_core_score(integer,bigint,text) from public, anon;
grant execute on function public.submit_dodge_core_score(integer,bigint,text) to authenticated;
revoke all on function public.get_dodge_core_leaderboard(text,integer) from public;
grant execute on function public.get_dodge_core_leaderboard(text,integer) to anon, authenticated;
