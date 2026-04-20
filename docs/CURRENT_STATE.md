# CURRENT_STATE.md

Snapshot of the New World Disorder mobile app as of 2026-04-20. Branch: `main`.

---

## 1. Folder structure

```
app/
├── (tabs)/
│   ├── _layout.tsx
│   ├── history.tsx
│   ├── index.tsx
│   ├── leaderboard.tsx
│   └── profile.tsx
├── auth/
│   └── index.tsx
├── help/
│   └── index.tsx
├── onboarding/
│   └── index.tsx
├── run/
│   ├── active.tsx
│   └── result.tsx
├── settings/
│   └── delete-account.tsx
├── spot/
│   └── [id].tsx
├── trail/
│   └── [id].tsx
├── +not-found.tsx
├── _layout.tsx
└── index.tsx

src/
├── components/
│   ├── dev/DebugDrawer.tsx
│   ├── map/ (ArenaMap, ArenaMapCustom, ArenaMapWeb, TrailDrawer, TrailMarkers, TruthMap)
│   ├── result/ (10 Result* cards)
│   ├── run/ (DebugOverlay, ReadinessPanel)
│   ├── ui/ (EmptyState, StatusBanner)
│   └── RiderAvatar.tsx
├── constants/legal.ts
├── constants.ts
├── content/copy.ts
├── data/
│   ├── mock/ (achievements, challenges, leaderboard, resultScenarios, spots, trails, user, userTrailStats, verificationScenarios)
│   ├── seed/ (index, slotwinyLore, slotwinyMap, slotwinyOfficial)
│   ├── venues/ (index, kasina, slotwiny)
│   ├── types.ts
│   ├── venueConfig.ts
│   └── verificationTypes.ts
├── features/
│   └── run/ (antiCheat, debug, gates, geometry, index, quality, types, useRunGateEngine)
├── hooks/
│   ├── AuthContext.tsx
│   ├── useAuth.ts
│   ├── useBackend.ts
│   ├── useBetaFlow.ts
│   ├── useRefresh.ts
│   └── useVenueContext.ts
├── lib/
│   ├── api.ts
│   ├── database.types.ts
│   └── supabase.ts
├── services/
│   ├── accountDeletion.ts
│   ├── avatar.ts
│   └── moderation.ts
├── systems/
│   ├── achievements.ts, buildTruthMap.ts, challenges.ts, debugEvents.ts, gps.ts,
│   ├── haptics.ts, leagueMovement.ts, ranks.ts, realVerification.ts, retrySubmit.ts,
│   ├── runFinalization.ts, runStore.ts, runSubmit.ts, saveQueue.ts, testMode.ts,
│   ├── traceCapture.ts, useRealRun.ts, venueDetection.ts, verification.ts, xp.ts
├── theme/ (colors, index, map, motion, spacing, typography)
└── utils/geoToSvg.ts

supabase/
├── functions/
│   └── delete-account/index.ts
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_seed_slotwiny.sql
    ├── 003_progression_hardening.sql
    ├── 004_atomic_profile_runs.sql
    └── 005_account_deletion_cascade.sql

docs/
└── sprint-24-pretest-audit.md
```

---

## 2. Screens (app/ folder)

| File | Route | Description | Status |
|---|---|---|---|
| [app/index.tsx](app/index.tsx) | `/` | Bootstrap: env check → onboarding gate → tabs. Hard-stops in production if Supabase is misconfigured. | DONE |
| [app/_layout.tsx](app/_layout.tsx) | — | Root stack layout; fonts, AuthProvider, error boundary, debug drawer (dev only). | DONE |
| [app/+not-found.tsx](app/+not-found.tsx) | `*` | Catch-all, redirects to `/`. | DONE |
| [app/onboarding/index.tsx](app/onboarding/index.tsx) | `/onboarding` | 3-slide racing-game intro + GPS permission gate. | DONE |
| [app/auth/index.tsx](app/auth/index.tsx) | `/auth` | Email OTP sign-in (email → code → create profile steps). | DONE |
| [app/(tabs)/_layout.tsx](app/(tabs)/_layout.tsx) | — | Bottom tab bar with animated labels + hidden 5-tap debug toggle. | DONE |
| [app/(tabs)/index.tsx](app/(tabs)/index.tsx) | `/(tabs)` | Home — league lobby: venue, rider status, entry to board. | DONE |
| [app/(tabs)/history.tsx](app/(tabs)/history.tsx) | `/(tabs)/history` | "Moje Zjazdy" — list of finalized runs with save status. | DONE |
| [app/(tabs)/leaderboard.tsx](app/(tabs)/leaderboard.tsx) | `/(tabs)/leaderboard` | Leaderboard per trail × period (day/weekend/all-time). | DONE |
| [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) | `/(tabs)/profile` | Profile: avatar, XP/rank, achievements, settings entries. | DONE |
| [app/run/active.tsx](app/run/active.tsx) | `/run/active` | Active run: GPS lifecycle, gate engine, stop/finalize. | DONE |
| [app/run/result.tsx](app/run/result.tsx) | `/run/result` | Post-run result screen; subscribes to runStore for live save state. | DONE |
| [app/spot/[id].tsx](app/spot/[id].tsx) | `/spot/:id` | Spot detail: arena map, trail list, challenges. | DONE |
| [app/trail/[id].tsx](app/trail/[id].tsx) | `/trail/:id` | Trail detail: position, rival, target gap, leaderboard slice. | DONE |
| [app/settings/delete-account.tsx](app/settings/delete-account.tsx) | `/settings/delete-account` | App Store 5.1.1(v) delete-account flow. | DONE |
| [app/help/index.tsx](app/help/index.tsx) | `/help` | FAQ + legal/support links. | DONE |

No dedicated `settings/` index screen yet — settings entries live inside profile.

---

## 3. Components, hooks, services

### `src/components/`
- [RiderAvatar.tsx](src/components/RiderAvatar.tsx) — avatar image with initials fallback (profile, leaderboard, result).
- [dev/DebugDrawer.tsx](src/components/dev/DebugDrawer.tsx) — dev-only drawer: venue state, run state, recent events, sim controls.
- [map/ArenaMap.tsx](src/components/map/ArenaMap.tsx) — v1 native branded race surface (dark terrain + glow trails).
- [map/ArenaMapCustom.tsx](src/components/map/ArenaMapCustom.tsx) — custom SVG replacement for Apple Maps; no tiles.
- [map/ArenaMapWeb.tsx](src/components/map/ArenaMapWeb.tsx) — web stylized fallback map.
- [map/TrailDrawer.tsx](src/components/map/TrailDrawer.tsx) — bottom drawer with trail info + start readiness.
- [map/TrailMarkers.tsx](src/components/map/TrailMarkers.tsx) — native `react-native-maps` trail markers.
- [map/TruthMap.tsx](src/components/map/TruthMap.tsx) — verification recap: official line vs rider line.
- [result/ResultAchievementUnlock.tsx](src/components/result/ResultAchievementUnlock.tsx) — achievement unlock banner.
- [result/ResultChallengeProgress.tsx](src/components/result/ResultChallengeProgress.tsx) — challenge increment readout.
- [result/ResultGapCard.tsx](src/components/result/ResultGapCard.tsx) — gap to target position.
- [result/ResultPBBadge.tsx](src/components/result/ResultPBBadge.tsx) — personal-best badge.
- [result/ResultRankDelta.tsx](src/components/result/ResultRankDelta.tsx) — leaderboard position change.
- [result/ResultRankUp.tsx](src/components/result/ResultRankUp.tsx) — rank-up celebration card.
- [result/ResultTimeCard.tsx](src/components/result/ResultTimeCard.tsx) — hero run time display.
- [result/ResultVerificationStatus.tsx](src/components/result/ResultVerificationStatus.tsx) — ranked/practice verification reason.
- [result/ResultXpMeter.tsx](src/components/result/ResultXpMeter.tsx) — XP gained meter.
- [result/RunAgainCTA.tsx](src/components/result/RunAgainCTA.tsx) — "run again" CTA pressable.
- [run/DebugOverlay.tsx](src/components/run/DebugOverlay.tsx) — field-test telemetry overlay (triple-tap toggle).
- [run/ReadinessPanel.tsx](src/components/run/ReadinessPanel.tsx) — pre-run readiness (GPS/gate proximity).
- [ui/EmptyState.tsx](src/components/ui/EmptyState.tsx) — generic first-use / empty-data surface.
- [ui/StatusBanner.tsx](src/components/ui/StatusBanner.tsx) — top-of-screen info/warning/error banner.

### `src/hooks/`
- [AuthContext.tsx](src/hooks/AuthContext.tsx) — React context wrapping `useAuth`.
- [useAuth.ts](src/hooks/useAuth.ts) — Supabase session + profile state machine (OTP sign-in).
- [useBackend.ts](src/hooks/useBackend.ts) — typed loading/data/error states for backend reads; mock fallback only when Supabase not configured.
- [useBetaFlow.ts](src/hooks/useBetaFlow.ts) — onboarding/auth routing flags via AsyncStorage.
- [useRefresh.ts](src/hooks/useRefresh.ts) — global refresh counter to re-fetch after saves.
- [useVenueContext.ts](src/hooks/useVenueContext.ts) — reactive venue + start-zone detection polling GPS.

### `src/services/`
- [accountDeletion.ts](src/services/accountDeletion.ts) — calls `delete-account` Edge Function.
- [avatar.ts](src/services/avatar.ts) — image pick, compress, upload to Supabase Storage; update profile.
- [moderation.ts](src/services/moderation.ts) — username validation + rider-reporting mailto flow.

### `src/lib/`
- [api.ts](src/lib/api.ts) — Supabase read/write surface used by `useBackend`.
- [database.types.ts](src/lib/database.types.ts) — manual TypeScript mirror of Supabase schema.
- [supabase.ts](src/lib/supabase.ts) — single Supabase client; session persistence + deep link auth callback.

---

## 4. Database schema

All tables are in the `public` schema with RLS enabled.

### `profiles`
| Column | Type | NN | Default |
|---|---|---|---|
| id | uuid PK | ✓ | — (FK → `auth.users.id` ON DELETE CASCADE) |
| username | text UNIQUE | ✓ | — |
| display_name | text | ✓ | `''` |
| avatar_url | text | — | — |
| rank_id | text | ✓ | `'rookie'` |
| xp | integer | ✓ | `0` |
| total_runs | integer | ✓ | `0` |
| total_pbs | integer | ✓ | `0` |
| best_position | integer | — | — |
| favorite_trail_id | text | — | — |
| created_at / updated_at | timestamptz | ✓ | `now()` |

RLS: `SELECT` all; `UPDATE`/`INSERT` own (`auth.uid() = id`).

### `spots`
| Column | Type | NN | Default |
|---|---|---|---|
| id | text PK | ✓ | — |
| slug | text UNIQUE | ✓ | — |
| name | text | ✓ | — |
| description | text | ✓ | `''` |
| region | text | ✓ | `''` |
| is_official | boolean | ✓ | `false` |
| is_active | boolean | ✓ | `true` |
| season_label | text | ✓ | `'SEASON 01'` |
| created_at | timestamptz | ✓ | `now()` |

RLS: `SELECT` all.

### `trails`
| Column | Type | NN | Default |
|---|---|---|---|
| id | text PK | ✓ | — |
| spot_id | text | ✓ | FK → `spots.id` |
| official_name | text | ✓ | — |
| short_name | text | ✓ | — |
| game_label | text | ✓ | `''` |
| difficulty | text | ✓ | `'easy'` |
| trail_type | text | ✓ | `'flow'` |
| distance_m | integer | ✓ | `0` |
| avg_grade_pct | real | ✓ | `0` |
| elevation_drop_m | integer | ✓ | `0` |
| description | text | ✓ | `''` |
| game_flavor | text | ✓ | `''` |
| is_race_trail | boolean | ✓ | `true` |
| is_active | boolean | ✓ | `true` |
| sort_order | integer | ✓ | `0` |
| created_at | timestamptz | ✓ | `now()` |

RLS: `SELECT` all.

### `runs`
| Column | Type | NN | Default |
|---|---|---|---|
| id | uuid PK | ✓ | `uuid_generate_v4()` |
| user_id | uuid | ✓ | FK → `profiles.id` ON DELETE CASCADE (mig 005) |
| spot_id | text | ✓ | FK → `spots.id` |
| trail_id | text | ✓ | FK → `trails.id` |
| mode | text CHECK (`ranked`/`practice`) | ✓ | `'practice'` |
| started_at / finished_at | timestamptz | ✓ | — |
| duration_ms | integer | ✓ | — |
| verification_status | text | ✓ | `'pending'` |
| verification_summary | jsonb | — | — |
| gps_trace | jsonb | — | — |
| is_pb | boolean | ✓ | `false` |
| xp_awarded | integer | ✓ | `0` |
| counted_in_leaderboard | boolean | ✓ | `false` |
| created_at | timestamptz | ✓ | `now()` |

Indexes: `idx_runs_user(user_id)`, `idx_runs_trail(trail_id)`, `idx_runs_leaderboard(trail_id, counted_in_leaderboard, duration_ms)`.
RLS: `SELECT` all; `INSERT`/`UPDATE` own.

### `leaderboard_entries`
| Column | Type | NN | Default |
|---|---|---|---|
| id | uuid PK | ✓ | `uuid_generate_v4()` |
| user_id | uuid | ✓ | FK → `profiles.id` ON DELETE CASCADE (mig 005) |
| trail_id | text | ✓ | FK → `trails.id` |
| period_type | text CHECK (`day`/`weekend`/`all_time`) | ✓ | `'all_time'` |
| best_duration_ms | integer | ✓ | — |
| rank_position | integer | ✓ | `0` |
| previous_position | integer | — | — |
| run_id | uuid | ✓ | FK → `runs.id` ON DELETE CASCADE (mig 005) |
| updated_at | timestamptz | ✓ | `now()` |

UNIQUE `(user_id, trail_id, period_type)`.
Index: `idx_leaderboard_trail_period(trail_id, period_type, rank_position)`.
RLS: `SELECT` all; `INSERT`/`UPDATE` own.

### `challenges`
| Column | Type | NN | Default |
|---|---|---|---|
| id | text PK | ✓ | — |
| spot_id | text | ✓ | FK → `spots.id` |
| trail_id | text | — | FK → `trails.id` (nullable) |
| type, name | text | ✓ | — |
| description | text | ✓ | `''` |
| starts_at / ends_at | timestamptz | ✓ | — |
| reward_xp | integer | ✓ | `0` |
| is_active | boolean | ✓ | `true` |
| created_at | timestamptz | ✓ | `now()` |

RLS: `SELECT` all.

### `challenge_progress`
| Column | Type | NN | Default |
|---|---|---|---|
| id | uuid PK | ✓ | `uuid_generate_v4()` |
| user_id | uuid | ✓ | FK → `profiles.id` ON DELETE CASCADE (mig 005) |
| challenge_id | text | ✓ | FK → `challenges.id` |
| current_value | integer | ✓ | `0` |
| completed | boolean | ✓ | `false` |
| completed_at | timestamptz | — | — |

UNIQUE `(user_id, challenge_id)`.
RLS: `SELECT`/`INSERT`/`UPDATE` own.

### `achievements`
| Column | Type | NN | Default |
|---|---|---|---|
| id | text PK | ✓ | — |
| slug | text UNIQUE | ✓ | — |
| name | text | ✓ | — |
| description | text | ✓ | `''` |
| icon | text | ✓ | `'🏆'` |
| xp_reward | integer | ✓ | `0` |
| created_at | timestamptz | ✓ | `now()` |

RLS: `SELECT` all.

### `user_achievements`
| Column | Type | NN | Default |
|---|---|---|---|
| id | uuid PK | ✓ | `uuid_generate_v4()` |
| user_id | uuid | ✓ | FK → `profiles.id` ON DELETE CASCADE (mig 005) |
| achievement_id | text | ✓ | FK → `achievements.id` |
| unlocked_at | timestamptz | ✓ | `now()` |

UNIQUE `(user_id, achievement_id)`.
RLS: `SELECT` all; `INSERT` own.

### Postgres functions (RPC)
- `upsert_leaderboard_entry(user_id, trail_id, period_type, duration_ms, run_id)` — atomic best-time upsert + recomputes all `rank_position` rows for `(trail_id, period_type)`; returns `{position, previous_position, delta, is_new_best}`. Security definer.
- `increment_profile_xp(user_id, xp_to_add)` — atomic XP bump + rank recompute (rookie/rider/sender/ripper/charger/legend thresholds).
- `unlock_achievement_with_xp(user_id, achievement_id)` — idempotent unlock + XP reward; also updates rank (note: this function uses an older rank vocabulary `hunter/slayer/apex/legend` that disagrees with `increment_profile_xp`'s `sender/ripper/charger/legend` — see §8).
- `increment_profile_runs(user_id, is_pb)` — atomic `total_runs` + optional `total_pbs` increment.

No Postgres triggers are defined. All `updated_at` writes are done from the RPC/app layer.

### Seeded data
Migration `002_seed_slotwiny.sql` inserts the `slotwiny-arena` spot and its four Season-01 trails (`galgan-niebieska`, `dookola-swiata-zielona`, `kometa-niebieska`, …) — race content bootstrap only.

---

## 5. Edge Functions

### `supabase/functions/delete-account/index.ts`
- **What it does**: POST endpoint that verifies the caller's JWT, wipes avatar storage under `avatars/{userId}/`, explicitly cascades dependent rows (leaderboard_entries → challenge_progress → user_achievements → runs → profiles) and finally calls `auth.admin.deleteUser(userId)`. Defense in depth on top of migration 005's FK cascades.
- **Input**: `POST` with `Authorization: Bearer <jwt>`. No body.
- **Output**: `200 {status:"deleted", userId}` / `401 unauthenticated` / `405` / `500 delete_failed`.
- **Invoked from**: client only — [src/services/accountDeletion.ts](src/services/accountDeletion.ts), triggered by [app/settings/delete-account.tsx](app/settings/delete-account.tsx). Not called from triggers or cron.

No other Edge Functions or cron jobs exist.

---

## 6. Auth flow

- **Providers**: Supabase email **OTP (6-digit code)** only — `signInWithOtp({ email, shouldCreateUser: true })` without `emailRedirectTo`, so the email template is code-only. Magic-link deep-link handling exists in [src/lib/supabase.ts](src/lib/supabase.ts) as a secondary fallback but isn't the primary UX.
- **Email verification**: implicit — the OTP code itself verifies the email. No separate confirmation step.
- **Profile creation**: two-phase. After `verifyOtp` succeeds, `useAuth` queries `profiles` by `auth.uid()`. If `PGRST116` (no row), state moves to `needs_profile`; the auth screen shows the "create profile" step; [useAuth.createProfile](src/hooks/useAuth.ts:219) `INSERT`s into `profiles` with the chosen lowercased username + display name. Only then does state transition to `authenticated`. There is no DB-side trigger that auto-creates a profile — the client must insert it.
- No OAuth providers, no Apple/Google sign-in, no password login.

---

## 7. Feature status matrix

| Feature | Status | Files | Notes |
|---|---|---|---|
| Rejestracja email | DONE | [app/auth/index.tsx](app/auth/index.tsx), [src/hooks/useAuth.ts](src/hooks/useAuth.ts) | OTP code; `shouldCreateUser: true`. |
| Logowanie email | DONE | same as above | OTP code-only flow. |
| Profil użytkownika (avatar, nickname) | DONE | [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx), [src/services/avatar.ts](src/services/avatar.ts), [src/components/RiderAvatar.tsx](src/components/RiderAvatar.tsx) | Pick → compress → upload to `avatars` bucket. |
| Przeglądanie parków | DONE | [app/(tabs)/index.tsx](app/(tabs)/index.tsx), [app/spot/[id].tsx](app/spot/[id].tsx), [src/data/venues](src/data/venues) | Slotwiny seeded; Kasina in venue config. |
| Przeglądanie tras w parku | DONE | [app/spot/[id].tsx](app/spot/[id].tsx), [app/trail/[id].tsx](app/trail/[id].tsx) | Arena map + trail drawer. |
| Start runu (GPS activation) | DONE | [app/run/active.tsx](app/run/active.tsx), [src/systems/useRealRun.ts](src/systems/useRealRun.ts), [src/systems/gps.ts](src/systems/gps.ts) | Readiness gate + foreground tracking. |
| Stop runu (save track) | DONE | [src/systems/runFinalization.ts](src/systems/runFinalization.ts), [src/systems/runSubmit.ts](src/systems/runSubmit.ts), [src/systems/saveQueue.ts](src/systems/saveQueue.ts) | Finalize → submit → offline queue fallback. |
| Historia własnych runów | DONE | [app/(tabs)/history.tsx](app/(tabs)/history.tsx), [src/systems/runStore.ts](src/systems/runStore.ts) | Local-first via runStore + AsyncStorage. |
| Leaderboard per trasa | DONE | [app/(tabs)/leaderboard.tsx](app/(tabs)/leaderboard.tsx), [app/trail/[id].tsx](app/trail/[id].tsx), RPC `upsert_leaderboard_entry` | Day / Weekend / All-time periods. |
| Season standings | WIP | [supabase/migrations/002_seed_slotwiny.sql](supabase/migrations/002_seed_slotwiny.sql), `spots.season_label` | Only a `season_label` column; no season-aggregated board UI. |
| Ghost rider / rival display | WIP | [app/trail/[id].tsx](app/trail/[id].tsx) | Rival/target gap shown on trail screen; no real-time "ghost trace" overlay during runs. |
| Subscription / paywall | NOT_STARTED | — | No IAP, RevenueCat, or paywall code anywhere. |
| Settings | WIP | [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx), [app/settings/delete-account.tsx](app/settings/delete-account.tsx) | No dedicated settings index; entries sit in profile tab. |
| Delete account | DONE | [app/settings/delete-account.tsx](app/settings/delete-account.tsx), [supabase/functions/delete-account/index.ts](supabase/functions/delete-account/index.ts), migration 005 | App Store 5.1.1(v)–compliant. |
| Privacy / terms pages | DONE (external) | [src/constants/legal.ts](src/constants/legal.ts), [app/help/index.tsx](app/help/index.tsx) | Linked out, not in-app rendered pages. |

Status definitions: **DONE** = feature works end-to-end in production path; **WIP** = partially implemented or UI-only; **STUB** = placeholder; **NOT_STARTED** = no code.

---

## 8. Known issues / TODOs

### Code TODOs
- [src/services/accountDeletion.ts:18](src/services/accountDeletion.ts) — "BACKEND TODO" header block describing required Edge Function contract (tracking note, not a pending action; function is deployed).
- [src/systems/runSubmit.ts:238](src/systems/runSubmit.ts) — `TODO: filter by venue-specific run count when backend supports per-venue aggregation`.

No `FIXME`, `HACK`, or `XXX` markers exist in the TS/SQL source.

### Schema / logic inconsistencies
- `unlock_achievement_with_xp` (mig 003) recomputes `rank_id` using the legacy vocabulary `hunter / slayer / apex / legend`, while `increment_profile_xp` (same migration) uses the current `rider / sender / ripper / charger / legend` set. If an achievement unlock ever fires for a user near a rank boundary, it will overwrite their rank with a stale label. Worth a follow-up migration to reconcile — see commit `a66ad3f` which formalized the MTB rank names.

### Documentation
- [docs/sprint-24-pretest-audit.md](docs/sprint-24-pretest-audit.md) is the only other doc; it predates the current state.

---

## 9. External dependencies

Runtime deps of note (from [package.json](package.json)); standard React/Expo/TypeScript plumbing omitted.

| Package | Used for |
|---|---|
| `@supabase/supabase-js` | Backend client (auth, RLS queries, RPC, storage). |
| `@react-native-async-storage/async-storage` | Session persistence, runStore cold cache, onboarding flags. |
| `expo-router` | File-based routing under `app/`. |
| `expo-location` | Foreground GPS for `useRealRun` and venue detection. |
| `expo-haptics` | Tactile feedback in [src/systems/haptics.ts](src/systems/haptics.ts). |
| `expo-image-picker` | Avatar pick flow. |
| `expo-image-manipulator` | Avatar compression pipeline (resize 600 px → JPEG 70%). |
| `expo-file-system` | Reading picked image bytes before upload. |
| `expo-linear-gradient` | UI gradient surfaces (cards, banners). |
| `expo-linking` | Deep-link handling for Supabase magic-link fallback. |
| `expo-font` + `@expo-google-fonts/orbitron` + `@expo-google-fonts/inter` | Brand typography (Orbitron for display, Inter for body). |
| `expo-constants` | Env exposure for Supabase URL/anon key via `expo-constants` `expoConfig.extra`. |
| `react-native-maps` | Native map tiles + markers for `TrailMarkers`. |
| `react-native-svg` | Custom arena map, result badges, UI glyphs. |
| `react-native-reanimated` | Tab bar animation, result screen transitions. |
| `react-native-gesture-handler` | Drawer + pressable gesture backends. |
| `react-native-worklets` / `-core` | Required by reanimated 4 runtime. |
| `react-native-safe-area-context` | Notch/home-indicator insets. |
| `react-native-url-polyfill` | Required by supabase-js under React Native. |
| `base64-arraybuffer` | Avatar upload: base64 → bytes for Supabase Storage. |
| `react-native-web` | Web build path (used for the `/spot/[id]` web fallback map). |
