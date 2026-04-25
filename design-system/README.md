# NWD Design System v1.0

Canonical source for app visual tokens. The HTML in this folder is the
"truth" — everything in `src/theme/` derives from it.

## Files

- **`NWD Design System.html`** — full design spec (13 sections: foundations,
  color, typography, elevation, motion, components, chrome, icons, track
  lines, voice, patterns, tokens index, handoff). Open in any browser.
- **`tokens.jsx`** — palette / type-pair / density tokens from the original
  prototype. Source of truth for the three palettes (Acid / Forge / Arctic).
- **`ui.jsx`** — primitive component shapes (Btn, Card, Pill, StatBox,
  SectionHead, PageTitle, TopBar, TabBar, GridBg, PulseDot). Reference for
  RN component shape, not for direct copy.
- **`HANDOFF.md`** — original Claude Design handoff README.

## Where the tokens live in code

| Design system     | Code                                          |
| ----------------- | --------------------------------------------- |
| Color palette     | `src/theme/colors.ts`                         |
| Race state map    | `src/theme/colors.ts` → `raceState`           |
| Typography scale  | `src/theme/typography.ts`                     |
| Motion tokens     | `src/theme/motion.ts`                         |
| Glow / shadows    | `src/theme/motion.ts` → `glows`               |
| Spacing / radii   | `src/theme/spacing.ts`                        |

## Non-negotiables (§ 13)

- Numbers are tabular-nums — race times never jitter.
- Race state owns color — accent never used as decoration.
- Reduced motion is honored — every animation gated.
- No light mode — produkt to night-of-race energy.
- No emoji in UI — IconGlyph only.
- CTA = CAPS + imperative — "ARM" not "Click here".

## When updating tokens

1. Edit the HTML if the design intent is changing.
2. Mirror the change in the relevant `src/theme/*.ts` file.
3. Search for hardcoded hex values that may need migrating:
   `rg "#[0-9A-Fa-f]{6}" src/ app/ --type ts --type tsx`.
4. Run `npx tsc --noEmit` and `npm test` — both should stay green.

## Three palettes

Only **Acid** is shipped. Forge (orange) and Arctic (blue) are reserved for
future seasonal swaps — keep `tokens.jsx` updated if you add a new palette
so future palette switches are a one-line change in `colors.ts`.
