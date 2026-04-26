// ═══════════════════════════════════════════════════════════
// Slide 03 — PROGRESS (rank + achievements + streak overview).
//
// Top → bottom:
//   1. Eyebrow 'PROGRESS' + animated LiveDot
//   2. Headline 'Każdy zjazd / buduje rider tag.' (line 2 accent)
//   3. Sub copy 'XP. Levele. Rangi. Pasy. / Wszystko zostaje na zawsze.'
//   4. Rank card: gradient bar | RankBadge | RANGA · CHALLENGER |
//      DO LVL 8 · 240/400 + progress bar
//   5. Achievement row: bronze 'First Blood' | gold 'Local Hero' | locked 'Top 10'
//   6. StreakCard (7 days, 7 dots, last ARMED)
//   7. Closing band 'RANGA NIE RESETUJE SIĘ / Co zdobędziesz — masz na zawsze.'
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '../_components/LiveDot';
import { AchievementCard } from '../_graphics/AchievementCard';
import { RankBadge } from '../_graphics/RankBadge';
import { StreakCard } from '../_graphics/StreakCard';

const RANK_PROGRESS = 240 / 400;

export const SlideProgress = memo(function SlideProgress() {
  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>PROGRESS</Text>
        <LiveDot size={5} />
      </View>

      <View style={styles.headlineBlock}>
        <Text style={styles.headlineLine}>Każdy zjazd</Text>
        <Text style={[styles.headlineLine, styles.headlineAccent]}>buduje rider tag.</Text>
      </View>

      <View style={styles.subBlock}>
        <Text style={styles.subPrimary}>XP. Levele. Rangi. Pasy.</Text>
        <Text style={styles.subSecondary}>Wszystko zostaje na zawsze.</Text>
      </View>

      <RankCard />
      <AchievementRow />
      <View style={styles.streakWrap}>
        <StreakCard days={7} totalDays={7} />
      </View>
      <ClosingBand />
    </View>
  );
});

function RankCard() {
  return (
    <View style={styles.rankCard}>
      {/* Left edge accent gradient bar 4px */}
      <View style={styles.rankAccentBar}>
        <Svg width={4} height="100%">
          <Defs>
            <LinearGradient id="rankBar" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={colors.accent} />
              <Stop offset="100%" stopColor={colors.accentDeep} />
            </LinearGradient>
          </Defs>
          <Rect width={4} height="100%" fill="url(#rankBar)" />
        </Svg>
      </View>

      <RankBadge level={7} size={44} />

      <View style={styles.rankCol}>
        <Text style={styles.smallLabel}>RANGA</Text>
        <Text style={styles.rankName}>CHALLENGER</Text>
      </View>

      <View style={styles.rankRight}>
        <Text style={[styles.smallLabel, styles.rankRightLabel]}>DO LVL 8</Text>
        <Text style={styles.rankXp}>240 / 400</Text>
      </View>

      <View style={styles.progressBarTrack}>
        <Svg width="100%" height={6} style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="rankProgress" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.accent} />
              <Stop offset="100%" stopColor={colors.accentDeep} />
            </LinearGradient>
          </Defs>
          <Rect width={`${RANK_PROGRESS * 100}%`} height={6} rx={3} fill="url(#rankProgress)" />
        </Svg>
      </View>
    </View>
  );
}

function AchievementRow() {
  return (
    <View style={styles.achievementRow}>
      <AchievementCard tier="bronze" name="First Blood" />
      <AchievementCard tier="gold" name="Local Hero" />
      <AchievementCard tier="locked" name="Top 10" progress="12 / 50" />
    </View>
  );
}

function ClosingBand() {
  return (
    <View style={styles.closingBand}>
      <Text style={styles.closingLabel}>RANGA NIE RESETUJE SIĘ</Text>
      <Text style={styles.closingBody}>Co zdobędziesz — masz na zawsze.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 14,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
  },
  headlineBlock: {
    marginTop: -4,
  },
  headlineLine: {
    fontFamily: fonts.racing,
    fontSize: 30,
    lineHeight: 34,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headlineAccent: {
    color: colors.accent,
  },
  subBlock: {
    gap: 4,
  },
  subPrimary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  subSecondary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  // ── Rank card ───────────────────────────────────────
  rankCard: {
    height: 84,
    borderRadius: 12,
    backgroundColor: colors.panel,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  rankAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  rankCol: {
    flex: 1,
    gap: 2,
  },
  smallLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.textTertiary,
  },
  rankRightLabel: {
    textAlign: 'right',
  },
  rankName: {
    fontFamily: fonts.racing,
    fontSize: 18,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  rankRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rankXp: {
    fontFamily: fonts.racing,
    fontSize: 16,
    lineHeight: 18,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    position: 'absolute',
    left: 16,
    right: 14,
    bottom: 12,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  // ── Achievement row ─────────────────────────────────
  achievementRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  // ── Streak ──────────────────────────────────────────
  streakWrap: {
    // wrapper kept for layout symmetry with other cards
  },
  // ── Closing band ────────────────────────────────────
  closingBand: {
    height: 44,
    backgroundColor: colors.panel,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 2,
  },
  closingLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  closingBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
