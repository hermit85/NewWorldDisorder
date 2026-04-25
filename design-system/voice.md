# Voice & Tone

NWD speaks like a race director, not a brand. Short. Imperative. No apologies, no hype, no emoji.

## The 6 voice tokens

### `voice.cta`
**CAPS · 1-2 words · imperative**

Buttons, primary calls to action.

✓ `WEJDŹ` · `ARM` · `WYŚLIJ KOD` · `ZACZYNAM` · `ROZUMIEM`
✗ `Wejdź teraz` · `Click here` · `Continue?` · `OK, got it!`

### `voice.status`
**CAPS · 1 word · state**

Pills, badges, system readouts.

✓ `LIVE` · `ARMED` · `VERIFIED` · `PENDING` · `DNF` · `READY`
✗ `Currently live` · `Armed (riding for ranking)` · `OK!`

### `voice.label`
**CAPS · 1-3 words · meta**

Section kickers, field labels, navigation, metadata headers.

✓ `STATUS` · `BIKE PARK` · `RIDER` · `GATE 03/07` · `SEZON 01`
✗ `Status:` · `Your bike park` · `Rider info`

### `voice.title`
**Sentence case · ≤8 words · declarative**

Screen titles, modal headers. Punchy. Two short sentences > one long.

✓ `Twoja góra. Twój czas.` · `Liczą się tylko czyste zjazdy.` · `Trenuj bez presji.`
✗ `Welcome to your dashboard!` · `Are you ready to start?` · titles ending in question marks

### `voice.body`
**Sentence case · ≤30 words · instructional**

Paragraph copy, descriptions, help text.

✓ `Startuj z bramki, finiszuj na końcu. Tylko czyste przejazdy trafiają na tablicę.`
✗ explanatory paragraphs longer than 2 sentences in mobile UI

### `voice.acronym`
**CAPS · ≤4 letters · shorthand**

Race jargon. Riders already know these. Don't translate.

✓ `PB` · `DNF` · `DSQ` · `GPS` · `KOM` · `DH` · `XC`

---

## Forbidden phrases

These break the voice. Replace on sight.

| ✗ Don't | ✓ Do |
|---|---|
| `Czy chciałbyś rozpocząć?` | `START` |
| `Świetnie!` / `Brawo!` | (silence — the time speaks) |
| `Niestety, coś poszło nie tak` | `RUN INVALID` + reason |
| `Ups...` / `Hej!` | (no greeter copy) |
| `Click here to continue` | `DALEJ` |
| `Are you sure?` | `PORZUĆ?` (and confirm-button copy is the action: `PORZUĆ`) |
| 🎉 / 🏆 / 🔥 in UI | `<IconGlyph>` from icon set |
| Pełne zdania w CTA | 1-2 word imperative |

---

## Polish vs English

**Default UI language: Polish.** Riders and bike-park staff speak Polish.

**Acronyms stay English** because the global racing scene uses them: `PB`, `DNF`, `DSQ`, `KOM`, `DH`, `GPS`. Don't translate.

**Race-game lingo can be English** when no clean Polish equivalent exists: `ARM`, `LIVE`, `VERIFIED`, `READY`. Same reason — global racing vocabulary.

**Paragraph copy stays Polish.** No mixing inside sentences.

---

## Tone of error states

Errors are facts, not apologies. State what happened, what to do next, in that order.

✓ `BRAK GPS · Wyjdź na otwartą przestrzeń.`
✓ `LINIA PRZERWANA · Trasa nie zaliczona. Spróbuj ponownie.`
✗ `Niestety, nie udało się zarejestrować Twojego przejazdu...`

---

## Numbers

- Race times: `02:14.83` (zero-pad MM, always centiseconds)
- Deltas: `−1.42` or `+0.38` (proper minus, two decimals)
- Distance: `2.4 km` (one decimal, lowercase unit)
- Vertical: `380 m` (no decimal, lowercase)
- Speed: `52 km/h` (lowercase)
- Position: `07` (always zero-pad to 2 digits in lists; standalone hero can be `7`)
