-- Chunk 10: GPS health audit + KPI views
-- No new tables. Extends verification_summary JSON shape (no DDL for that).
-- Adds index for KPI queries + 2 views for monitoring.

COMMENT ON COLUMN runs.verification_summary IS
  'JSONB. Core verification fields (status, acceptedVia, corridor, checkpoints). Chunk 10 extends with gpsHealth nested: totalSamples, samplesPerSec, avgAccuracyM, backgroundDurationSec, backgroundSampleRatio, waitedForAccuracySec, timeToArmedSec';

CREATE INDEX IF NOT EXISTS idx_runs_verification_status_started
  ON runs(verification_status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_runs_mode_started
  ON runs(mode, started_at DESC)
  WHERE mode = 'ranked';

-- Daily KPI view for GPS health monitoring
CREATE OR REPLACE VIEW run_kpi_daily AS
SELECT
  date_trunc('day', started_at) as day,
  mode,
  verification_status,
  COUNT(*) as run_count,
  ROUND(AVG(duration_ms)::numeric / 1000, 1) as avg_duration_sec,
  ROUND(AVG((verification_summary->'gpsHealth'->>'avgAccuracyM')::float)::numeric, 1) as avg_gps_accuracy_m,
  ROUND(AVG((verification_summary->'gpsHealth'->>'samplesPerSec')::float)::numeric, 2) as avg_samples_per_sec,
  ROUND(AVG((verification_summary->'gpsHealth'->>'timeToArmedSec')::float)::numeric, 1) as avg_time_to_armed_sec,
  ROUND(AVG((verification_summary->'gpsHealth'->>'backgroundSampleRatio')::float)::numeric, 2) as avg_bg_sample_ratio
FROM runs
WHERE verification_summary IS NOT NULL
GROUP BY day, mode, verification_status
ORDER BY day DESC, mode, verification_status;

COMMENT ON VIEW run_kpi_daily IS
  'Daily aggregation of GPS health + run stats. Source of truth for Verified Pass Rate and GPS quality KPIs.';

-- Weekly pass rate KPI (THE core metric per spec v3)
CREATE OR REPLACE VIEW verified_pass_rate_weekly AS
SELECT
  date_trunc('week', started_at) as week,
  mode,
  COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_runs,
  COUNT(*) FILTER (WHERE verification_status IN ('outside_start_gate', 'outside_finish_gate', 'missing_checkpoint', 'outside_corridor')) as rejected_runs,
  COUNT(*) as total_runs,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE verification_status = 'verified') / NULLIF(COUNT(*), 0),
    1
  ) as pass_rate_pct
FROM runs
WHERE mode = 'ranked'
  AND started_at > now() - interval '90 days'
GROUP BY week, mode
ORDER BY week DESC, mode;

COMMENT ON VIEW verified_pass_rate_weekly IS
  'Weekly verified pass rate for ranked runs. MVP target: >=75%. Growth target: >=85%. This is the single most important trust metric.';
