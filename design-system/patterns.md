# Patterns

How the system composes. The atoms are tokens + components. The patterns below are the canonical way to assemble them for the most-reused UI flows.

---

## Pattern 1 — Race-state pattern

The single most-used pattern. Every screen that involves a run uses it.

A "run state" surface = badge + color + animation, applied consistently:

```tsx
function RunStateBadge({ state }: { state: RunState }) {
  const map = {
    training:  { label: 'TRENING',  state: 'training' },
    armed:     { label: 'ARMED',    state: 'armed' },
    verified:  { label: 'VERIFIED', state: 'verified' },
    pending:   { label: 'PENDING',  state: 'pending' },
    invalid:   { label: 'DNF',      state: 'invalid' },
  };
  const m = map[state];
  return <Pill state={m.state} dot>{m.label}</Pill>;
}
```

**Application rules**

- Wherever you show a run summary (leaderboard row, profile, history), include this badge.
- Whenever a row IS in armed state, it gets `elevation.e4` (rowHot + borderHot + glowSoft) AND the armed pill.
- Pending state is transient (max 5 sec). After validation, transition to verified or invalid.

---

## Pattern 2 — Run flow states

Linear pipeline. 6 ordered screens. Each one has a single primary action.

```
1. READY CHECK    →  GPS lock, gate visible. CTA: ARM
2. APPROACH       →  Riding to gate. Telemetry. CTA: (none, auto)
3. RECORDING      →  Through the gate, timer rolling. CTA: (none, auto stop)
4. REVIEW         →  Replay summary. CTA: SUBMIT or DISCARD
5. RESULT         →  Verified + leaderboard delta. CTA: WRÓĆ DO TRASY
6. REJECTED       →  Invalid + reason. CTA: SPRÓBUJ JESZCZE RAZ
```

**State color thread**

| screen | dominant state |
|---|---|
| ready check | `pending` (validating GPS) → `armed` (ready to ride) |
| approach | `armed` (fast pulse, urgency) |
| recording | `armed` (locked) |
| review | `pending` (validating run) |
| result | `verified` (accent everywhere) |
| rejected | `invalid` (red borders, dim accent) |

This thread is THE narrative. The accent color literally tells you where in the flow you are.

---

## Pattern 3 — Leaderboard

Stack of `LeaderboardRow` components.

**Structure**

```
[HEADER row]   POS  RIDER             TIME      Δ
[ROW × N]
[YOUR ROW]     ← always pinned, gets e4 + glowSoft + state.armed border
[FOOTER]       sezon · liczba przejazdów
```

**Rules**

- Top 3 positions get `gold/silver/bronze` color on the position number only — not full row.
- Your own row is ALWAYS visible — pinned to bottom of viewport if scrolled out of natural position.
- Delta column: green for negative (faster), red for positive (slower), `--nwd-text-muted` for self vs PB.

---

## Pattern 4 — HUD chrome

Game-feel achieved by **layering** chrome primitives over content. Apply selectively — too much HUD = noise.

**Standard HUD-frame screen layout**

```
┌─[corner-bracket]─────────────[corner-bracket]─┐
│ [SystemText: STATUS · SLOT 03/07]   [● LIVE]  │
│                                                │
│            [main content]                      │
│                                                │
│ [RaceNumber: 03 — opacity 0.04, watermark]    │
│                                                │
│ [SystemText: BIKE PARK]    [SystemText: 4G]   │
└─[corner-bracket]─────────────[corner-bracket]─┘
[ScanLines overlay — opacity 0.05, full surface]
```

**When to use full HUD frame**

- Run flow screens (ready, approach, recording) — yes
- Onboarding — yes
- Leaderboard hero / season stats — yes
- Settings, profile edit, auth — no (too much chrome for utility screens)

---

## Pattern 5 — Empty states

No data ≠ apology. State the void as a fact, then offer the action.

```
[Big mono label]   BRAK DANYCH
[Body]             Nie masz jeszcze przejazdów w tej lidze.
[CTA]              ARM PIERWSZY PRZEJAZD
```

- Empty state title: `.nwd-label`, `--nwd-text-muted`
- Body: `.nwd-body`, `--nwd-text-muted`
- CTA: full Btn primary

Never use illustrations of empty boxes, sad faces, or "Looking for something?" copy.

---

## Pattern 6 — Validation feedback

Live during recording. After review.

**During recording (overlay top of screen)**

```
[Pill state=pending dot] WALIDUJEMY · GPS OK · LINIA OK · GATE 03/07
```

Each item flips green individually as it confirms. If any flips red, the run is killed and we jump to REJECTED with the reason as title.

**After review**

```
HudPanel title="VALIDATION"
  ├─ GPS LOCK    [✓ OK]
  ├─ START GATE  [✓ OK]
  ├─ ON LINE     [✓ OK]
  └─ FINISH      [✓ OK]
```

All four ✓ = verified. Any ✗ = invalid + that row in `--nwd-state-invalid`.

---

## Pattern 7 — Density modes

`density: compact | regular | spacious` is a user preference, not a designer choice. The system honors it through `--nwd-space-*` derived values.

Default to `regular`. Compact is for power users with many runs/spots. Spacious is for accessibility / large-text environments.

The design system primitives all read padding from CSS vars — flipping density requires no component changes.

---

## Wiring it all up

A typical screen composition:

```tsx
<Screen palette="acid" density="regular">
  <HudFrame corners scanLines raceNumber="03" systemText={{tl: 'SLOT 03/07', tr: '● LIVE', bl: 'BIKE PARK', br: '4G'}}>
    <Stack gap="lg">
      <Stack gap="xs">
        <span className="nwd-label">SEZON 01</span>
        <h1 className="nwd-title">Słotwiny Arena</h1>
      </Stack>

      <HudPanel title="TWOJA POZYCJA" status={<Pill state="armed" dot>ARMED</Pill>}>
        <RaceTime value="02:14.83" size="hero" delta="−1.42 PB" dimMs />
      </HudPanel>

      <Stack gap="xs">
        <LeaderboardRow position={1} rider="Kamil Z." time="02:13.41" delta="−2.84" />
        <LeaderboardRow position={7} rider="Ty" time="02:14.83" delta="−1.42" self />
      </Stack>

      <Btn variant="primary" size="lg" icon="lock">ARM</Btn>
    </Stack>
  </HudFrame>
</Screen>
```

Everything is tokens or components. No hex codes. No magic numbers. No ad-hoc styles.
