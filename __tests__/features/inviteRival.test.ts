// ═══════════════════════════════════════════════════════════
// buildInviteShare — pin the share-payload copy variants.
//
// Two flavours: leader copy (claims the throne) and chaser copy
// (challenges the recipient to beat the time). Both must include
// trail name + formatted time + a link, since some share targets
// strip URLs unless they're in the body too.
// ═══════════════════════════════════════════════════════════

import {
  buildInviteShare,
  buildInviteSchemeUrl,
} from '@/features/share/inviteRival';

describe('buildInviteShare', () => {
  test('leader copy: claims the throne, includes trail + time + url', () => {
    const p = buildInviteShare({
      trailName: 'Prezydencka',
      timeMs: 81_000,
      isLeader: true,
      spotId: 'spot-wwa',
      trailId: 'trail-prezydencka',
    });
    expect(p.message).toContain('Prezydencka');
    expect(p.message).toContain('1:21.0');
    expect(p.message.toLowerCase()).toContain('należy do mnie');
    expect(p.message).toContain('https://newworlddisorder.app');
    expect(p.url).toContain('spotId=spot-wwa');
    expect(p.url).toContain('trailId=trail-prezydencka');
  });

  test('chaser copy: challenges the recipient to beat the time', () => {
    const p = buildInviteShare({
      trailName: 'Prezydencka',
      timeMs: 81_000,
    });
    expect(p.message).toContain('Pobij mój czas');
    expect(p.message).toContain('1:21.0');
    expect(p.message.toLowerCase()).not.toContain('należy do mnie');
  });

  test('payload always includes trail name and time (regression invariant)', () => {
    const p = buildInviteShare({
      trailName: 'Czarna',
      timeMs: 90_500,
      isLeader: true,
    });
    expect(p.message).toContain('Czarna');
    expect(p.message).toContain('1:30.5');
  });

  test('title carries trail (uppercased) + time for share-target previews', () => {
    const p = buildInviteShare({
      trailName: 'Prezydencka',
      timeMs: 81_000,
    });
    expect(p.title).toContain('PREZYDENCKA');
    expect(p.title).toContain('1:21.0');
  });

  test('omits unknown fields from URL without breaking the link', () => {
    const p = buildInviteShare({
      trailName: 'Prezydencka',
      timeMs: 81_000,
    });
    expect(p.url.startsWith('https://newworlddisorder.app/challenge')).toBe(true);
    // No spotId / trailId set — URL still has time and is well-formed.
    expect(p.url).toContain('time=81000');
  });

  test('buildInviteSchemeUrl returns nwd:// fallback for sharing into the app', () => {
    const url = buildInviteSchemeUrl({
      trailName: 'X',
      timeMs: 81_000,
      spotId: 's',
      trailId: 't',
    });
    expect(url.startsWith('nwd://challenge')).toBe(true);
    expect(url).toContain('spotId=s');
    expect(url).toContain('trailId=t');
    expect(url).toContain('time=81000');
  });
});
