-- ═══════════════════════════════════════════════════════════
-- New World Disorder — Initial database schema
-- Run this in Supabase SQL Editor to set up all tables
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null default '',
  avatar_url text,
  rank_id text not null default 'rookie',
  xp integer not null default 0,
  total_runs integer not null default 0,
  total_pbs integer not null default 0,
  best_position integer,
  favorite_trail_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read all profiles"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ─── SPOTS ──────────────────────────────────────────────────

create table public.spots (
  id text primary key,
  slug text unique not null,
  name text not null,
  description text not null default '',
  region text not null default '',
  is_official boolean not null default false,
  is_active boolean not null default true,
  season_label text not null default 'SEASON 01',
  created_at timestamptz not null default now()
);

alter table public.spots enable row level security;

create policy "Anyone can read spots"
  on public.spots for select using (true);

-- ─── TRAILS ─────────────────────────────────────────────────

create table public.trails (
  id text primary key,
  spot_id text not null references public.spots(id),
  official_name text not null,
  short_name text not null,
  game_label text not null default '',
  difficulty text not null default 'easy',
  trail_type text not null default 'flow',
  distance_m integer not null default 0,
  avg_grade_pct real not null default 0,
  elevation_drop_m integer not null default 0,
  description text not null default '',
  game_flavor text not null default '',
  is_race_trail boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.trails enable row level security;

create policy "Anyone can read trails"
  on public.trails for select using (true);

-- ─── RUNS ───────────────────────────────────────────────────

create table public.runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  spot_id text not null references public.spots(id),
  trail_id text not null references public.trails(id),
  mode text not null default 'practice' check (mode in ('ranked', 'practice')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  duration_ms integer not null,
  verification_status text not null default 'pending',
  verification_summary jsonb,
  gps_trace jsonb,
  is_pb boolean not null default false,
  xp_awarded integer not null default 0,
  counted_in_leaderboard boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_runs_user on public.runs(user_id);
create index idx_runs_trail on public.runs(trail_id);
create index idx_runs_leaderboard on public.runs(trail_id, counted_in_leaderboard, duration_ms);

alter table public.runs enable row level security;

create policy "Users can read all runs"
  on public.runs for select using (true);

create policy "Users can insert own runs"
  on public.runs for insert with check (auth.uid() = user_id);

create policy "Users can update own runs"
  on public.runs for update using (auth.uid() = user_id);

-- ─── LEADERBOARD ENTRIES ────────────────────────────────────

create table public.leaderboard_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  trail_id text not null references public.trails(id),
  period_type text not null default 'all_time' check (period_type in ('day', 'weekend', 'all_time')),
  best_duration_ms integer not null,
  rank_position integer not null default 0,
  previous_position integer,
  run_id uuid not null references public.runs(id),
  updated_at timestamptz not null default now(),
  unique (user_id, trail_id, period_type)
);

create index idx_leaderboard_trail_period on public.leaderboard_entries(trail_id, period_type, rank_position);

alter table public.leaderboard_entries enable row level security;

create policy "Anyone can read leaderboard"
  on public.leaderboard_entries for select using (true);

create policy "Users can upsert own leaderboard entries"
  on public.leaderboard_entries for insert with check (auth.uid() = user_id);

create policy "Users can update own leaderboard entries"
  on public.leaderboard_entries for update using (auth.uid() = user_id);

-- ─── CHALLENGES ─────────────────────────────────────────────

create table public.challenges (
  id text primary key,
  spot_id text not null references public.spots(id),
  trail_id text references public.trails(id),
  type text not null,
  name text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reward_xp integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

create policy "Anyone can read challenges"
  on public.challenges for select using (true);

-- ─── CHALLENGE PROGRESS ─────────────────────────────────────

create table public.challenge_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  challenge_id text not null references public.challenges(id),
  current_value integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (user_id, challenge_id)
);

alter table public.challenge_progress enable row level security;

create policy "Users can read own challenge progress"
  on public.challenge_progress for select using (auth.uid() = user_id);

create policy "Users can insert own challenge progress"
  on public.challenge_progress for insert with check (auth.uid() = user_id);

create policy "Users can update own challenge progress"
  on public.challenge_progress for update using (auth.uid() = user_id);

-- ─── ACHIEVEMENTS ───────────────────────────────────────────

create table public.achievements (
  id text primary key,
  slug text unique not null,
  name text not null,
  description text not null default '',
  icon text not null default '🏆',
  xp_reward integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.achievements enable row level security;

create policy "Anyone can read achievements"
  on public.achievements for select using (true);

-- ─── USER ACHIEVEMENTS ──────────────────────────────────────

create table public.user_achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  achievement_id text not null references public.achievements(id),
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "Users can read all user achievements"
  on public.user_achievements for select using (true);

create policy "Users can insert own achievements"
  on public.user_achievements for insert with check (auth.uid() = user_id);

-- ─── LEADERBOARD UPSERT FUNCTION ────────────────────────────
-- Atomically insert or update a leaderboard entry,
-- then recompute rank positions for the trail+period.

create or replace function public.upsert_leaderboard_entry(
  p_user_id uuid,
  p_trail_id text,
  p_period_type text,
  p_duration_ms integer,
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_existing_ms integer;
  v_new_position integer;
  v_old_position integer;
begin
  -- Check if user already has an entry
  select best_duration_ms, rank_position
  into v_existing_ms, v_old_position
  from public.leaderboard_entries
  where user_id = p_user_id
    and trail_id = p_trail_id
    and period_type = p_period_type;

  -- Only update if new time is better (or no entry exists)
  if v_existing_ms is null or p_duration_ms < v_existing_ms then
    insert into public.leaderboard_entries (user_id, trail_id, period_type, best_duration_ms, run_id, previous_position, updated_at)
    values (p_user_id, p_trail_id, p_period_type, p_duration_ms, p_run_id, v_old_position, now())
    on conflict (user_id, trail_id, period_type) do update set
      best_duration_ms = excluded.best_duration_ms,
      run_id = excluded.run_id,
      previous_position = leaderboard_entries.rank_position,
      updated_at = now();
  end if;

  -- Recompute rank positions for this trail+period
  with ranked as (
    select id, row_number() over (order by best_duration_ms asc) as new_rank
    from public.leaderboard_entries
    where trail_id = p_trail_id and period_type = p_period_type
  )
  update public.leaderboard_entries le
  set rank_position = ranked.new_rank
  from ranked
  where le.id = ranked.id;

  -- Get the user's new position
  select rank_position into v_new_position
  from public.leaderboard_entries
  where user_id = p_user_id
    and trail_id = p_trail_id
    and period_type = p_period_type;

  return jsonb_build_object(
    'position', v_new_position,
    'previous_position', v_old_position,
    'delta', coalesce(v_old_position, v_new_position + 1) - v_new_position,
    'is_new_best', v_existing_ms is null or p_duration_ms < v_existing_ms
  );
end;
$$;
