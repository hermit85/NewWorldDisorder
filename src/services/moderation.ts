// ═══════════════════════════════════════════════════════════
// Moderation — username validation + user/content reporting
//
// App Store Guideline 1.2 (UGC) requires:
//   - A method to filter objectionable content (here: a
//     username blocklist + character constraints)
//   - A mechanism for users to flag objectionable content or
//     abusive users (here: a "Report rider" action that opens
//     mail to support with the rider's username/id pre-filled)
//
// This is intentionally minimal. The shared validator is the
// single source of truth used by the sign-up screen and any
// future username-edit flow.
// ═══════════════════════════════════════════════════════════

import { Linking, Alert } from 'react-native';
import { LEGAL } from '@/constants/legal';

// ── Username rules ──────────────────────────────────────────
//
// Allowed characters: lowercase a-z, digits, dot, dash,
// underscore. Length 3..20. Must contain at least one letter
// or digit (no "..." / "---" only).
//
// Reserved names that impersonate the platform, staff, or
// system roles are rejected to prevent confusion and abuse.
const RESERVED_USERNAMES = new Set<string>([
  'admin', 'administrator', 'mod', 'moderator', 'support',
  'help', 'staff', 'team', 'official', 'system', 'root',
  'nwd', 'nwdisorder', 'newworlddisorder', 'anonymous',
  'null', 'undefined', 'me', 'you', 'user', 'guest',
  'owner', 'developer', 'apple', 'appstore',
]);

// Minimal profanity blocklist — covers the most obvious slurs
// in PL/EN without trying to be a content moderation engine.
// We match as substrings (case-insensitive) so leetspeak
// variants like "fuck1" still trip the filter.
const PROFANITY_FRAGMENTS: readonly string[] = [
  'fuck', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'fag',
  'retard', 'rape', 'kill', 'nazi', 'hitler', 'hitle',
  // Polish — most common slurs / impersonation bait
  'kurwa', 'chuj', 'pierdol', 'jeban', 'jebac', 'spierda',
  'pedal', 'cipa', 'huj', 'pizda',
];

export type UsernameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Validate a username for sign-up / edit.
 * Returns the normalized (lowercased, trimmed) value on success.
 */
export function validateUsername(raw: string): UsernameValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Wpisz nazwę' };
  }
  const normalized = trimmed.toLowerCase();

  if (normalized.length < 3) {
    return { ok: false, reason: 'Minimum 3 znaki' };
  }
  if (normalized.length > 20) {
    return { ok: false, reason: 'Maksimum 20 znaków' };
  }
  if (!/^[a-z0-9_.\-]+$/.test(normalized)) {
    return { ok: false, reason: 'Tylko litery, cyfry, kropki, myślniki' };
  }
  if (!/[a-z0-9]/.test(normalized)) {
    return { ok: false, reason: 'Musi zawierać literę lub cyfrę' };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return { ok: false, reason: 'Ta nazwa jest zarezerwowana' };
  }
  for (const fragment of PROFANITY_FRAGMENTS) {
    if (normalized.includes(fragment)) {
      return { ok: false, reason: 'Wybierz inną nazwę' };
    }
  }
  return { ok: true, normalized };
}

// ── Reporting ───────────────────────────────────────────────

export type ReportContext = {
  /** Profile id of the rider being reported, if known. */
  userId?: string;
  /** Username being reported. */
  username: string;
  /** Optional context (trail, leaderboard, etc.) for the body. */
  surface?: string;
};

/**
 * Open the in-app report flow for a user. Currently routes to
 * the support inbox with a pre-filled message. We deliberately
 * use mailto rather than a server endpoint so the report is
 * traceable, replyable, and works offline.
 */
export function reportRider(ctx: ReportContext) {
  Alert.alert(
    'Zgłoś ridera',
    `Wyślemy wiadomość do ${LEGAL.supportEmail} z prośbą o sprawdzenie konta „${ctx.username}". Sprawdzimy zgłoszenie w ciągu 24h.`,
    [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyślij zgłoszenie',
        style: 'destructive',
        onPress: () => {
          const subject = encodeURIComponent(`Zgłoszenie ridera: ${ctx.username}`);
          const lines = [
            `Zgłaszany rider: ${ctx.username}`,
            ctx.userId ? `ID: ${ctx.userId}` : null,
            ctx.surface ? `Miejsce: ${ctx.surface}` : null,
            '',
            'Powód zgłoszenia (opisz krótko):',
            '',
          ].filter(Boolean);
          const body = encodeURIComponent(lines.join('\n'));
          Linking.openURL(`mailto:${LEGAL.supportEmail}?subject=${subject}&body=${body}`);
        },
      },
    ],
  );
}
