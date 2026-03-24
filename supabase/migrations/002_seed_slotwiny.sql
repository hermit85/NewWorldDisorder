-- ═══════════════════════════════════════════════════════════
-- Seed: Słotwiny Arena — Season 01
-- Official trail data from Grupa Pingwina
-- ═══════════════════════════════════════════════════════════

-- Spot
insert into public.spots (id, slug, name, description, region, is_official, is_active, season_label)
values (
  'slotwiny-arena',
  'slotwiny-arena',
  'Słotwiny Arena',
  'Season 01 — Krynica-Zdrój. Official gravity playground by Grupa Pingwina. Four race trails from flow to full send.',
  'Krynica-Zdrój',
  true,
  true,
  'SEASON 01'
) on conflict (id) do nothing;

-- Trails
insert into public.trails (id, spot_id, official_name, short_name, game_label, difficulty, trail_type, distance_m, avg_grade_pct, elevation_drop_m, description, game_flavor, is_race_trail, is_active, sort_order)
values
  ('galgan-niebieska', 'slotwiny-arena', 'Gałgan Niebieska', 'Gałgan', 'THE WARM-UP', 'easy', 'flow', 2700, 7.5, 203,
   'Machine-built blue trail with tables, berms, rollers and wood features. Safe progression for all levels.',
   'Smooth berms. Big tables. Build your speed.', true, true, 1),

  ('dookola-swiata-zielona', 'slotwiny-arena', 'Dookoła Świata Zielona', 'Dookoła Świata', 'WORLD TOUR', 'easy', 'flow', 3100, 5, 155,
   'Machine-built green flow trail with S/M obstacles. Tables, berms, rollers and wood features throughout. Designed for safe progression.',
   'The long way down. Flow state guaranteed.', true, true, 2),

  ('kometa-niebieska', 'slotwiny-arena', 'Kometa Niebieska', 'Kometa', 'COMET LINE', 'medium', 'flow', 2300, 8, 184,
   'Machine-built blue trail with intermediate features. Berms and rollers define the rhythm. S/M obstacles throughout.',
   'Find the rhythm. Carry the speed. Hit the line.', true, true, 3),

  ('dzida-czerwona', 'slotwiny-arena', 'Dzida Czerwona', 'Dzida', 'THE SPEAR', 'hard', 'tech', 1500, 11, 165,
   'Advanced natural trail. Fast and technical with gaps, rocks, roots. Alternate lines and bypasses on bigger features.',
   'Raw. Fast. No forgiveness. Prove yourself.', true, true, 4)
on conflict (id) do nothing;

-- Achievements
insert into public.achievements (id, slug, name, description, icon, xp_reward)
values
  ('ach-first-blood',    'first-blood',     'First Blood',      'Complete your first valid run',          '🩸', 50),
  ('ach-top-10',         'top-10-entry',    'Top 10 Entry',     'Enter the top 10 on any trail',         '🔟', 200),
  ('ach-weekend-warrior','weekend-warrior',  'Weekend Warrior',  'Complete 5 runs in one weekend',        '⚔️', 100),
  ('ach-double-pb',      'double-pb',        'Double PB',        'Set 2 PBs in one session',              '🏆', 150),
  ('ach-trail-hunter',   'trail-hunter',     'Trail Hunter',     'Complete a ranked run on every trail',   '🗺️', 200),
  ('ach-slotwiny-local', 'slotwiny-local',   'Słotwiny Local',  'Complete 20 runs at Słotwiny Arena',    '🏠', 300),
  ('ach-gravity-addict', 'gravity-addict',   'Gravity Addict',  'Complete 50 total runs',                '🎯', 500)
on conflict (id) do nothing;

-- Challenges (current weekend example)
insert into public.challenges (id, spot_id, trail_id, type, name, description, starts_at, ends_at, reward_xp, is_active)
values
  ('ch-weekend-dzida', 'slotwiny-arena', 'dzida-czerwona', 'fastest_time',
   'Weekend Heat: Dzida',
   'Post the fastest verified time on Dzida Czerwona this weekend',
   now(), now() + interval '7 days', 200, true),

  ('ch-3-runs-today', 'slotwiny-arena', null, 'run_count',
   'Triple Threat',
   'Complete 3 valid runs today on any trail',
   now(), now() + interval '1 day', 75, true),

  ('ch-pb-hunt', 'slotwiny-arena', null, 'pb_improvement',
   'PB Hunt',
   'Beat any personal best this week',
   now(), now() + interval '7 days', 100, true)
on conflict (id) do nothing;
