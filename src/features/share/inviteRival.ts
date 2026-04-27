// ─────────────────────────────────────────────────────────────
// Invite Rival — share-payload derivation.
//
// Builds the message + URL that goes into React Native's Share
// API when the rider taps "ZAPROŚ RYWALA". Pure function so the
// copy variants are unit-testable.
//
// NWD framing: invite is NOT generic. It challenges the recipient
// to beat a specific trail time. When the rider holds #1 the copy
// claims the throne; otherwise it points at the time to beat.
// ─────────────────────────────────────────────────────────────

import { formatTimeShort } from '@/content/copy';

export interface InvitePayload {
  /** First line — title shown by some share targets. */
  title: string;
  /** Body of the share message. Includes the URL. */
  message: string;
  /** Deep-link URL targeting the trail. Sharing apps surface this
   *  separately when supported. */
  url: string;
}

export interface InviteContext {
  trailName: string;
  /** PB / time being challenged, in milliseconds. */
  timeMs: number;
  /** When set, the rider is the current #1 — copy claims the throne. */
  isLeader?: boolean;
  /** Optional spot id — included in the deep link so the receiver
   *  lands on the exact arena, not just the trail. */
  spotId?: string;
  /** Optional trail id — included in the deep link. */
  trailId?: string;
  /** Optional rider tag for the title line. */
  riderTag?: string;
}

const APP_LANDING_URL = 'https://newworlddisorder.app';

export function buildInviteShare(ctx: InviteContext): InvitePayload {
  const trail = ctx.trailName.toUpperCase();
  const time = formatTimeShort(ctx.timeMs);

  const message = ctx.isLeader
    ? `${ctx.trailName} należy do mnie: ${time}.\nOdbierz mi #1 w NWD.`
    : `Pobij mój czas: ${ctx.trailName} · ${time}.\nNWD czeka.`;

  const url = buildDeepLink(ctx);

  return {
    title: `NWD · ${trail} · ${time}`,
    message: `${message}\n${url}`,
    url,
  };
}

function buildDeepLink(ctx: InviteContext): string {
  // App scheme deep links don't open from messengers that strip
  // unknown schemes, so we use an https landing fallback that the
  // app's universal link config can later catch. For now the URL
  // is a placeholder — the feature must NOT block on perfect deep
  // linking (per spec).
  const params = new URLSearchParams();
  if (ctx.spotId) params.set('spotId', ctx.spotId);
  if (ctx.trailId) params.set('trailId', ctx.trailId);
  if (ctx.timeMs) params.set('time', String(ctx.timeMs));
  const qs = params.toString();
  return `${APP_LANDING_URL}/challenge${qs ? `?${qs}` : ''}`;
}

/** Mirror of buildDeepLink for the in-app `nwd://` scheme — useful
 *  when a sharing surface accepts custom schemes (e.g. iOS pasted
 *  into Safari → app handles `nwd://`). Some share targets strip
 *  this so we send the https URL primarily. */
export function buildInviteSchemeUrl(ctx: InviteContext): string {
  const params = new URLSearchParams();
  if (ctx.spotId) params.set('spotId', ctx.spotId);
  if (ctx.trailId) params.set('trailId', ctx.trailId);
  if (ctx.timeMs) params.set('time', String(ctx.timeMs));
  const qs = params.toString();
  return `nwd://challenge${qs ? `?${qs}` : ''}`;
}
