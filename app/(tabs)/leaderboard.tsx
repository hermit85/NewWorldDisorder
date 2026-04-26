// ═══════════════════════════════════════════════════════════
// /(tabs)/leaderboard — TablicaScreen Landing (Phase 1)
//
// Two states gated on `useUserRunCount`:
//
//   Stan A — STANDARD (count > 0)
//     Per-bike-park sections sorted MAX(run.created_at) DESC.
//     Trail rows: rank pill + PB if rider has time, else
//     "JEDŹ →" CTA. Two dashed mityagacje at the bottom.
//
//   Stan B — ŚWIEŻY (count === 0) — content w commit 3
//
// Anti-drift (per cc_prompt_tablica_phase1_final):
// NO Słotwiny seed · NO drama ticker · NO podium 2-1-3 swap ·
// NO trail switcher · NO curator chip · NO pagination watermark ·
// NO line/sparkline · NO NWDHeader · NO English placeholders.
//
// Tap any trail row → push /trail/[id]/ranking (RankingScreen).
// ═══════════════════════════════════════════════════════════

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUserRunCount } from '@/hooks/useUserRunCount';
import {
  useTablicaSections,
  type TablicaTrailRow,
} from '@/hooks/useTablicaSections';
import { formatTimeMs } from '@/utils/time';
import type { Difficulty } from '@/data/types';

// Bike-park standard difficulty palette (per Q3 in spec) — NOT the
// theme.map S0-S5 set. Black uses dark fill with 1px white stroke
// for visibility on the dark background.
const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: '#22C55E',
  medium: '#3B82F6',
  hard: '#FF4757',
  expert: '#0E1517',
  pro: '#0E1517',
};

const isBlackDiff = (d: Difficulty) => d === 'expert' || d === 'pro';

function trailWord(n: number): string {
  if (n === 1) return 'TRASA';
  if (n < 5) return 'TRASY';
  return 'TRAS';
}

function zjazdWord(n: number): string {
  if (n === 1) return 'ZJAZD';
  if (n < 5) return 'ZJAZDY';
  return 'ZJAZDÓW';
}

// Top-3 medal tone for the rank pill — gold / silver / bronze.
// 4-10 = accent. 11+ = dimmed white.
function rankTone(position: number): {
  bg: string;
  border: string;
  text: string;
  numeric: string;
  pbColor: string;
  pbLabel: string;
} {
  if (position === 1) {
    return {
      bg: 'rgba(255, 210, 63, 0.12)',
      border: 'rgba(255, 210, 63, 0.5)',
      text: 'rgba(255, 210, 63, 0.7)',
      numeric: colors.gold,
      pbColor: colors.gold,
      pbLabel: 'REKORD',
    };
  }
  if (position === 2) {
    return {
      bg: 'rgba(201, 209, 214, 0.10)',
      border: 'rgba(201, 209, 214, 0.4)',
      text: 'rgba(201, 209, 214, 0.7)',
      numeric: colors.silver,
      pbColor: colors.textPrimary,
      pbLabel: 'PB',
    };
  }
  if (position === 3) {
    return {
      bg: 'rgba(224, 138, 92, 0.10)',
      border: 'rgba(224, 138, 92, 0.4)',
      text: 'rgba(224, 138, 92, 0.7)',
      numeric: colors.bronze,
      pbColor: colors.textPrimary,
      pbLabel: 'PB',
    };
  }
  if (position <= 10) {
    return {
      bg: 'rgba(0, 255, 135, 0.10)',
      border: 'rgba(0, 255, 135, 0.4)',
      text: 'rgba(0, 255, 135, 0.6)',
      numeric: colors.accent,
      pbColor: colors.textPrimary,
      pbLabel: 'PB',
    };
  }
  return {
    bg: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.15)',
    text: 'rgba(242, 244, 243, 0.4)',
    numeric: 'rgba(242, 244, 243, 0.6)',
    pbColor: colors.textPrimary,
    pbLabel: 'PB',
  };
}

function TrailRow({
  row,
  onPress,
}: {
  row: TablicaTrailRow;
  onPress: () => void;
}) {
  const { trail, userPbMs, userPosition, userRunCount } = row;
  const hasTime = userPbMs != null && userPosition != null;
  const diffColor = DIFFICULTY_COLOR[trail.difficulty];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View
        style={[
          styles.diffDot,
          { backgroundColor: diffColor },
          isBlackDiff(trail.difficulty) && styles.diffDotBlack,
        ]}
      />

      <View style={styles.rowMain}>
        <Text
          style={[styles.trailName, !hasTime && styles.trailNameDim]}
          numberOfLines={1}
        >
          {trail.name}
        </Text>
        <Text style={styles.runCount} numberOfLines={1}>
          {userRunCount} {zjazdWord(userRunCount)}
        </Text>
      </View>

      {hasTime ? (
        <RankPillWithPb position={userPosition!} pbMs={userPbMs!} />
      ) : (
        <View style={styles.jedzCta}>
          <Text style={styles.jedzText}>JEDŹ →</Text>
        </View>
      )}
    </Pressable>
  );
}

function RankPillWithPb({ position, pbMs }: { position: number; pbMs: number }) {
  const tone = rankTone(position);
  return (
    <View style={styles.rankWrap}>
      <View
        style={[
          styles.rankPill,
          { backgroundColor: tone.bg, borderColor: tone.border },
        ]}
      >
        <Text style={[styles.rankTy, { color: tone.text }]}>TY</Text>
        <Text style={[styles.rankNum, { color: tone.numeric }]}>
          #{position}
        </Text>
      </View>
      <View style={styles.pbBlock}>
        <Text style={[styles.pbLabel, position === 1 && { color: 'rgba(255, 210, 63, 0.6)' }]}>
          {tone.pbLabel}
        </Text>
        <Text style={[styles.pbTime, { color: tone.pbColor }]}>
          {formatTimeMs(pbMs)}
        </Text>
      </View>
    </View>
  );
}

export default function TablicaScreen() {
  const router = useRouter();
  const { profile } = useAuthContext();
  const { count, isFresh, status: countStatus } = useUserRunCount(profile?.id);
  const { sections, status: sectionsStatus } = useTablicaSections(profile?.id);

  const totalTrails = sections.reduce((sum, s) => sum + s.trails.length, 0);
  const totalParks = sections.length;

  const isLoading = countStatus === 'loading' || sectionsStatus === 'loading';

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header — same shape both states */}
        <View style={styles.header}>
          <View style={styles.miniLabelRow}>
            <LiveDot size={6} color={colors.accent} mode="pulse" />
            <Text style={styles.miniLabel}>TABLICA</Text>
          </View>
          <Text style={styles.headline}>TABLICA</Text>
          <Text style={styles.sub}>
            {isLoading
              ? 'Ładowanie…'
              : isFresh || (count != null && count > 0 && totalParks === 0)
                ? 'Pusta. Zacznij sezon.'
                : `Twoje ${totalTrails} ${trailWord(totalTrails).toLowerCase()} · ${totalParks} bike park${totalParks === 1 ? '' : 'i'}`}
          </Text>
        </View>

        {/* Stan A — content present */}
        {!isLoading && sections.length > 0 ? (
          <View style={styles.body}>
            {sections.map((section) => (
              <View key={section.spot.id} style={styles.section}>
                <Text style={styles.sectionHeader}>
                  {section.spot.name.toUpperCase()} · {section.trails.length}{' '}
                  {trailWord(section.trails.length)}
                </Text>
                <View style={styles.sectionRows}>
                  {section.trails.map((row) => (
                    <TrailRow
                      key={row.trail.id}
                      row={row}
                      onPress={() =>
                        router.push({
                          pathname: '/trail/[id]/ranking',
                          params: { id: row.trail.id },
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ))}

            {/* 2 dashed mityagacje — subtle versions on Stan A */}
            <View style={styles.mitigationsWrap}>
              <Pressable
                style={[styles.mitigation, styles.mitigationAccent]}
                onPress={() => router.push('/(tabs)/spots')}
              >
                <Text style={styles.mitigationCopy}>Brak twojego bike parku?</Text>
                <Text style={styles.mitigationCtaAccent}>+ DODAJ W SPOTACH →</Text>
              </Pressable>
              <Pressable
                style={[styles.mitigation, styles.mitigationWarn]}
                onPress={() => router.push('/(tabs)/spots')}
              >
                <Text style={styles.mitigationCopy}>Brak twojej trasy w bike parku?</Text>
                <Text style={styles.mitigationCtaWarn}>+ ZOSTAŃ PIONIEREM →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Stan B — fresh rider (count === 0 OR no aggregated sections) */}
        {!isLoading && sections.length === 0 ? (
          <View style={styles.freshBody}>
            {/* Hint card — "Jak to działa" tutorial without
                pretending the rider has data they don't */}
            <View style={styles.hintCard}>
              <Text style={styles.hintKicker}>JAK TO DZIAŁA</Text>
              <Text style={styles.hintLine}>Tablica zapełni się sama.</Text>
              <Text style={styles.hintLine}>Pierwszy zjazd = pierwsza pozycja.</Text>
            </View>

            {/* 2 LARGER mityagacje — primary surfaces in fresh state */}
            <View style={styles.freshMitigations}>
              <Pressable
                style={[styles.bigMitigation, styles.bigMitigationAccent]}
                onPress={() => router.push('/(tabs)/spots')}
              >
                <View style={styles.bigMitigationBody}>
                  <Text style={[styles.bigMitigationKicker, { color: 'rgba(0, 255, 135, 0.7)' }]}>
                    MASZ SWÓJ BIKE PARK?
                  </Text>
                  <Text style={styles.bigMitigationLine}>Dodaj go w Spotach.</Text>
                  <Text style={styles.bigMitigationSub}>Pioneer slot lifetime.</Text>
                </View>
                <Text style={[styles.bigMitigationArrow, { color: colors.accent }]}>→</Text>
              </Pressable>

              <Pressable
                style={[styles.bigMitigation, styles.bigMitigationWarn]}
                onPress={() => router.push('/(tabs)/spots')}
              >
                <View style={styles.bigMitigationBody}>
                  <Text style={[styles.bigMitigationKicker, { color: 'rgba(255, 176, 32, 0.8)' }]}>
                    PARK JEST, BRAK TWOJEJ TRASY?
                  </Text>
                  <Text style={styles.bigMitigationLine}>Zostań pionierem.</Text>
                  <Text style={styles.bigMitigationSub}>
                    Pierwszy czas zabezpiecza twoje miejsce.
                  </Text>
                </View>
                <Text style={[styles.bigMitigationArrow, { color: colors.warn }]}>→</Text>
              </Pressable>
            </View>

            {/* Separator + alt path */}
            <View style={styles.lubBlock}>
              <Text style={styles.lubSeparator}>— LUB —</Text>
              <Text style={styles.lubLine}>Zjedź dowolną trasę z apki.</Text>
              <Text style={styles.lubLine}>Tablica zapełni się automatycznie.</Text>
            </View>

            {/* Outline fallback CTA */}
            <Pressable
              style={styles.outlineCta}
              onPress={() => router.push('/(tabs)/spots')}
            >
              <Text style={styles.outlineCtaText}>PRZEJDŹ DO SPOTÓW →</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: 80,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 8,
  },
  miniLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  miniLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.racing,
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(242, 244, 243, 0.5)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 4,
  },
  sectionRows: {
    gap: 6,
  },

  // Trail row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 14,
    backgroundColor: '#13181A',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2, // sharp HUD
    gap: 14,
  },
  rowPressed: {
    backgroundColor: 'rgba(0, 255, 135, 0.06)',
    borderColor: colors.borderHot,
  },
  diffDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  diffDotBlack: {
    borderWidth: 1,
    borderColor: '#F2F4F3',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trailName: {
    fontFamily: fonts.racing,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trailNameDim: {
    color: 'rgba(242, 244, 243, 0.7)',
  },
  runCount: {
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(242, 244, 243, 0.4)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Right slot — rank pill + PB OR JEDŹ CTA
  rankWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankPill: {
    width: 50,
    height: 28,
    borderRadius: 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    paddingVertical: 1,
  },
  rankTy: {
    fontFamily: fonts.mono,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rankNum: {
    fontFamily: fonts.racing,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 14,
  },
  pbBlock: {
    alignItems: 'flex-end',
    width: 56,
  },
  pbLabel: {
    fontFamily: fonts.mono,
    fontSize: 7,
    fontWeight: '700',
    color: 'rgba(242, 244, 243, 0.4)',
    letterSpacing: 1.2,
  },
  pbTime: {
    fontFamily: fonts.racing,
    fontSize: 12,
    fontWeight: '800',
  },

  jedzCta: {
    width: 118,
    height: 28,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 255, 135, 0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jedzText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.5,
  },

  // Mityagacje — subtle dashed cards
  mitigationsWrap: {
    gap: 10,
    marginTop: 18,
  },
  mitigation: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 2,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  mitigationAccent: {
    backgroundColor: 'rgba(0, 255, 135, 0.04)',
    borderColor: 'rgba(0, 255, 135, 0.25)',
  },
  mitigationWarn: {
    backgroundColor: 'rgba(255, 176, 32, 0.04)',
    borderColor: 'rgba(255, 176, 32, 0.25)',
  },
  mitigationCopy: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(242, 244, 243, 0.7)',
    textAlign: 'center',
  },
  mitigationCtaAccent: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    textAlign: 'center',
  },
  mitigationCtaWarn: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '800',
    color: colors.warn,
    textAlign: 'center',
  },

  // Stan B — fresh rider styles
  freshBody: {
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 18,
  },
  hintCard: {
    height: 80,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#13181A',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    gap: 4,
    justifyContent: 'center',
  },
  hintKicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(242, 244, 243, 0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hintLine: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(242, 244, 243, 0.85)',
  },
  freshMitigations: {
    gap: 12,
  },
  bigMitigation: {
    height: 68,
    borderRadius: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigMitigationAccent: {
    backgroundColor: 'rgba(0, 255, 135, 0.06)',
    borderColor: 'rgba(0, 255, 135, 0.4)',
  },
  bigMitigationWarn: {
    backgroundColor: 'rgba(255, 176, 32, 0.06)',
    borderColor: 'rgba(255, 176, 32, 0.4)',
  },
  bigMitigationBody: {
    flex: 1,
    gap: 2,
  },
  bigMitigationKicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bigMitigationLine: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(242, 244, 243, 0.85)',
  },
  bigMitigationSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(242, 244, 243, 0.5)',
  },
  bigMitigationArrow: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 12,
  },
  lubBlock: {
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  lubSeparator: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(242, 244, 243, 0.32)',
    letterSpacing: 2,
  },
  lubLine: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(242, 244, 243, 0.55)',
    textAlign: 'center',
  },
  outlineCta: {
    height: 40,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.4)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  outlineCtaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
});
