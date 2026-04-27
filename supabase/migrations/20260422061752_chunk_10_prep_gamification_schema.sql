-- Chunk 10 prep: gamification schema additions
-- Adds: streak tracking on profiles, beat_events cache, xp_events audit, trail_flags community moderation
-- No breaking changes; no existing code reads these yet.

-- 1. Streak columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_ride_at timestamptz,
  ADD COLUMN IF NOT EXISTS streak_grace_expires_at timestamptz;

COMMENT ON COLUMN profiles.streak_days IS 'Current consecutive days with at least 1 verified or practice run.';
COMMENT ON COLUMN profiles.streak_last_ride_at IS 'Timestamp of most recent run that extended the streak.';
COMMENT ON COLUMN profiles.streak_grace_expires_at IS 'When the grace window to keep streak alive expires. NULL when streak already fresh for current day.';

-- 2. beat_events — denormalized cache for "Pobito Cię" hero card
CREATE TABLE IF NOT EXISTS beat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id text NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  beaten_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beater_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  beaten_duration_ms integer NOT NULL,
  beater_duration_ms integer NOT NULL,
  delta_ms integer NOT NULL,
  beaten_previous_position integer NOT NULL,
  beaten_new_position integer NOT NULL,
  run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_beat_events_beaten_unseen
  ON beat_events(beaten_user_id, created_at DESC)
  WHERE seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_beat_events_trail_recent
  ON beat_events(trail_id, created_at DESC);

COMMENT ON TABLE beat_events IS 'Denormalized cache of rank drops. Written by trigger on leaderboard_entries update. Drives hero Pobito Cie card.';
COMMENT ON COLUMN beat_events.delta_ms IS 'How much faster beater was: beaten_duration_ms - beater_duration_ms.';
COMMENT ON COLUMN beat_events.seen_at IS 'When the beaten user saw this in-app. NULL = unseen = shown in hero card.';

-- 3. xp_events — audit trail for all XP awards
CREATE TABLE IF NOT EXISTS xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN (
    'run_verified',
    'run_pb',
    'beat_rival',
    'challenge_completed',
    'achievement_unlocked',
    'streak_milestone',
    'pioneer_bonus'
  )),
  amount integer NOT NULL,
  related_run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
  related_trail_id text REFERENCES trails(id) ON DELETE SET NULL,
  related_challenge_id text REFERENCES challenges(id) ON DELETE SET NULL,
  related_achievement_id text REFERENCES achievements(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_created
  ON xp_events(user_id, created_at DESC);

COMMENT ON TABLE xp_events IS 'Immutable audit log of every XP award. profiles.xp is the running sum.';

-- 4. trail_flags — community moderation (built for future, ready now)
CREATE TABLE IF NOT EXISTS trail_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id text NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  flagged_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'duplicate',
    'wrong_geometry',
    'illegal',
    'unsafe',
    'other'
  )),
  notes text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolution text CHECK (resolution IN ('upheld', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trail_id, flagged_by)
);

CREATE INDEX IF NOT EXISTS idx_trail_flags_unresolved
  ON trail_flags(trail_id, created_at DESC)
  WHERE resolved_at IS NULL;

COMMENT ON TABLE trail_flags IS 'Community-reported trail issues. 3+ unresolved flags on same trail triggers admin review in app.';
COMMENT ON COLUMN trail_flags.resolved_by IS 'Admin who resolved the flag. NULL = pending.';

-- RLS enablement for new tables
ALTER TABLE beat_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trail_flags ENABLE ROW LEVEL SECURITY;

-- Policy: users read only their own beat_events and xp_events
CREATE POLICY "users read own beat_events"
  ON beat_events FOR SELECT
  USING (auth.uid() = beaten_user_id OR auth.uid() = beater_user_id);

CREATE POLICY "users read own xp_events"
  ON xp_events FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: authenticated users can insert trail_flags for themselves
CREATE POLICY "users flag trails as themselves"
  ON trail_flags FOR INSERT
  WITH CHECK (auth.uid() = flagged_by);

CREATE POLICY "users read trail_flags they created"
  ON trail_flags FOR SELECT
  USING (auth.uid() = flagged_by);

-- Service role bypasses RLS; no policy needed for admin/background jobs
