// ═══════════════════════════════════════════════════════════
// Production-copy guard.
//
// Reads the four (tabs) screen files (and a few production
// branches we touch) at test time, strips comments and string
// literals that exist only to negate the lie (test-style assert
// strings), and asserts no banned copy is left in any active
// JSX render path.
//
// "Banned" meaning: copy that previously surfaced to the rider
// as a falsehood (Beta, PIONEER SLOT WOLNY, JEDŹ JAKO PIONIER,
// "0 trasy", "0 aktywne") and would re-introduce a regression
// if anyone re-typed it into a Text component by hand.
// ═══════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..', '..');

const SCREENS_TO_CHECK = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/spots.tsx',
  'app/(tabs)/leaderboard.tsx',
  'app/(tabs)/profile.tsx',
];

/** Strip line comments (// ...) and block comments. The test uses
 *  this so a code comment explaining "we used to show 'PIONEER SLOT
 *  WOLNY'" doesn't trip the guard. We don't try to be a real lexer
 *  — these are app screen files where comments are well-behaved. */
function stripComments(source: string): string {
  // Remove block comments first (greedy via dot-all wouldn't work
  // without `s` flag; use a non-greedy with `[\s\S]`).
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then remove single-line comments. Don't touch URL https:// — we
  // only strip when the // starts the trimmed line OR follows a
  // whitespace boundary that isn't a colon.
  const noLine = noBlock.replace(/(^|[\s;{}()])\/\/[^\n]*/gm, '$1');
  return noLine;
}

const BANNED_LITERALS = [
  'PIONEER SLOT WOLNY',
  'JEDŹ JAKO PIONIER',
  '0 trasy',
  '0 aktywne',
];

describe('production copy guard', () => {
  describe.each(SCREENS_TO_CHECK)('%s', (relPath) => {
    const source = readFileSync(join(REPO_ROOT, relPath), 'utf8');
    const code = stripComments(source);

    test.each(BANNED_LITERALS)(
      'must not contain %j outside comments',
      (banned) => {
        expect(code).not.toContain(banned);
      },
    );

    test('must not contain a stand-alone "Beta" string in JSX', () => {
      // Match Beta as a whole word in user-facing text, NOT as part
      // of "useBetaFlow" / "beta_version" / similar identifiers. The
      // simplest signal: a quoted string equal to "Beta" / 'Beta' /
      // a Text node containing >Beta<.
      expect(code).not.toMatch(/['"`]Beta['"`]/);
      expect(code).not.toMatch(/>\s*Beta\s*</);
      // "Sezon 01 · Beta" was a literal. Pin its absence too.
      expect(code).not.toMatch(/Sezon\s*0?1\s*·\s*Beta/);
    });
  });
});
