// ═══════════════════════════════════════════════════════════
// Slide 01 — LIGA (live mini-leaderboard hero).
//
// Top → bottom:
//   1. (Header rendered by index.tsx, not here)
//   2. Headline "Liga gravity. / Realne trasy. / Realne czasy."
//      where line 3 is accent green
//   3. Sub copy
//   4. Trail context line "BIKE PARK SŁOTWINY · DZIDA · ● RED"
//   5. Scope tabs DZIŚ / WEEKEND / SEZON (last active)
//   6. Podium row 01 GOLD (height 64)
//   7. Podium row 02 SILVER (height 56)
//   8. Podium row 03 BRONZE (height 56)
//   9. Bottom band "SEZON 01 · LIVE / Bike Park Słotwiny · twoja góra"
//
// Pagination dots + CTA live in index.tsx so they stay locked
// at the same Y across all three slides.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '../components/LiveDot';

export const SlideLiga = memo(function SlideLiga() {
  return (
    <View style={styles.container}>
      <Headline />
      <SubCopy />
      <TrailContext />
      <ScopeTabs />
      <PodiumRowGold />
      <PodiumRowSilver />
      <PodiumRowBronze />
      <View style={styles.spacer} />
      <LiveBand />
    </View>
  );
});

function Headline() {
  return (
    <View style={styles.headlineBlock}>
      <Text style={styles.headlineLine}>Liga gravity.</Text>
      <Text style={styles.headlineLine}>Realne trasy.</Text>
      <Text style={[styles.headlineLine, styles.headlineAccent]}>Realne czasy.</Text>
    </View>
  );
}

function SubCopy() {
  return (
    <View style={styles.subBlock}>
      <Text style={styles.subPrimary}>Twoja góra zamienia się w grę wyścigową.</Text>
      <Text style={styles.subSecondary}>Mierz. Ścigaj się. Wbijaj na tablicę.</Text>
    </View>
  );
}

function TrailContext() {
  return (
    <View style={styles.trailRow}>
      <Text style={styles.trailLabel}>BIKE PARK SŁOTWINY · DZIDA</Text>
      <View style={styles.redPill}>
        <View style={styles.redDot} />
        <Text style={styles.redLabel}>RED</Text>
      </View>
    </View>
  );
}

function ScopeTabs() {
  return (
    <View style={styles.tabsRow}>
      <Tab label="DZIŚ" width={92} />
      <Tab label="WEEKEND" width={112} />
      <Tab label="SEZON" width={92} active />
    </View>
  );
}

function Tab({ label, width, active }: { label: string; width: number; active?: boolean }) {
  return (
    <View
      style={[
        styles.tab,
        { width },
        active ? styles.tabActive : styles.tabInactive,
      ]}
    >
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : styles.tabLabelInactive]}>
        {label}
      </Text>
    </View>
  );
}

function PodiumRowGold() {
  return (
    <View style={[styles.podiumRow, styles.goldRow]}>
      <View style={[styles.accentBar, { backgroundColor: colors.gold, width: 4 }]} />
      <Text style={[styles.position, { color: colors.gold, fontSize: 28 }]}>01</Text>
      <View style={[styles.avatar, { borderColor: colors.gold }]}>
        <Text style={[styles.avatarInitials, { color: colors.gold }]}>KZ</Text>
      </View>
      <View style={styles.nameMeta}>
        <Text style={styles.riderName}>Kamil Z.</Text>
        <Text style={[styles.riderTag, { color: colors.gold }]}>PIONIER</Text>
      </View>
      <View style={styles.timeStack}>
        <Text style={[styles.timeLabel, { color: 'rgba(255, 210, 63, 0.6)' }]}>REKORD</Text>
        <Text style={[styles.timeValue, { color: colors.gold, fontSize: 20 }]}>02:13.41</Text>
      </View>
    </View>
  );
}

function PodiumRowSilver() {
  return (
    <View style={[styles.podiumRow, styles.silverRow, { height: 56, marginTop: 8 }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.silver, width: 3 }]} />
      <Text style={[styles.position, { color: colors.silver, fontSize: 22 }]}>02</Text>
      <View style={[styles.avatar, styles.avatarSm, { borderColor: colors.silver }]}>
        <Text style={[styles.avatarInitials, styles.avatarInitialsSm, { color: colors.silver }]}>MP</Text>
      </View>
      <View style={styles.nameMeta}>
        <Text style={styles.riderName}>Mateusz P.</Text>
      </View>
      <Text style={[styles.timeValue, { color: colors.textPrimary, fontSize: 16 }]}>02:13.95</Text>
      <Text style={styles.delta}>+0.54</Text>
    </View>
  );
}

function PodiumRowBronze() {
  return (
    <View style={[styles.podiumRow, styles.bronzeRow, { height: 56, marginTop: 8 }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.bronze, width: 3 }]} />
      <Text style={[styles.position, { color: colors.bronze, fontSize: 22 }]}>03</Text>
      <View style={[styles.avatar, styles.avatarSm, { borderColor: colors.bronze }]}>
        <Text style={[styles.avatarInitials, styles.avatarInitialsSm, { color: colors.bronze }]}>JW</Text>
      </View>
      <View style={styles.nameMeta}>
        <Text style={styles.riderName}>Jan W.</Text>
      </View>
      <Text style={[styles.timeValue, { color: colors.textPrimary, fontSize: 16 }]}>02:14.20</Text>
      <Text style={styles.delta}>+0.79</Text>
    </View>
  );
}

function LiveBand() {
  return (
    <View style={styles.liveBand}>
      <View style={styles.liveBandTopRow}>
        <LiveDot size={3} />
        <Text style={styles.liveBandLabel}>SEZON 01 · LIVE</Text>
      </View>
      <Text style={styles.liveBandSub}>Bike Park Słotwiny · twoja góra</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
  },
  spacer: {
    flex: 1,
    minHeight: 8,
  },
  // ── Headline ─────────────────────────────────────────
  headlineBlock: {
    gap: 0,
  },
  headlineLine: {
    fontFamily: fonts.racing,
    fontSize: 36,
    lineHeight: 40,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headlineAccent: {
    color: colors.accent,
  },
  // ── Sub copy ─────────────────────────────────────────
  subBlock: {
    marginTop: 20,
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
  // ── Trail context ────────────────────────────────────
  trailRow: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trailLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 2.5,
    color: colors.textTertiary,
  },
  redPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  redDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.danger,
  },
  redLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.danger,
  },
  // ── Scope tabs ───────────────────────────────────────
  tabsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
    height: 32,
  },
  tab: {
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  tabLabelActive: {
    color: colors.accentInk,
  },
  tabLabelInactive: {
    color: colors.textTertiary,
  },
  // ── Podium rows ──────────────────────────────────────
  podiumRow: {
    height: 64,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 14,
    gap: 12,
    overflow: 'hidden',
  },
  goldRow: {
    borderWidth: 1,
    borderColor: 'rgba(255, 210, 63, 0.4)',
  },
  silverRow: {
    borderWidth: 1,
    borderColor: 'rgba(201, 209, 214, 0.3)',
  },
  bronzeRow: {
    borderWidth: 1,
    borderColor: 'rgba(224, 138, 92, 0.3)',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    borderRadius: 2,
  },
  position: {
    fontFamily: fonts.racing,
    minWidth: 30,
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSm: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  avatarInitials: {
    fontFamily: fonts.racing,
    fontSize: 13,
  },
  avatarInitialsSm: {
    fontSize: 11,
  },
  nameMeta: {
    flex: 1,
    gap: 2,
  },
  riderName: {
    fontFamily: fonts.racing,
    fontSize: 15,
    color: colors.textPrimary,
  },
  riderTag: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  timeStack: {
    alignItems: 'flex-end',
    gap: 2,
  },
  timeLabel: {
    fontFamily: fonts.mono,
    fontSize: 7,
    letterSpacing: 1.2,
  },
  timeValue: {
    fontFamily: fonts.racing,
    fontVariant: ['tabular-nums'],
  },
  delta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.warn,
    fontVariant: ['tabular-nums'],
  },
  // ── Bottom live band ─────────────────────────────────
  liveBand: {
    height: 44,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.2)',
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 2,
  },
  liveBandTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveBandLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  liveBandSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
