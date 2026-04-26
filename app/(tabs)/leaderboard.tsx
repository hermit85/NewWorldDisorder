// ═══════════════════════════════════════════════════════════
// /(tabs)/leaderboard — TablicaScreen Landing (Phase 1)
//
// Two states gated on `useUserRunCount`:
//
//   Stan A — STANDARD (count > 0)
//     Per-bike-park sections sorted MAX(run.created_at) DESC.
//     Each section renders trail rows with rank pill + PB
//     (when rider has time) or "JEDŹ →" CTA (when no time).
//     Two dashed mityagacje cards at the bottom of the list.
//
//   Stan B — ŚWIEŻY (count === 0)
//     "Tablica zapełni się sama." hint card, two LARGER
//     dashed mityagacje cards (centered, more padding), and a
//     "PRZEJDŹ DO SPOTÓW" outline CTA fallback.
//
// Anti-drift (per cc_prompt_tablica_phase1_final):
//   - NO Słotwiny seed default
//   - NO TODAY'S DRAMA / activity ticker
//   - NO podium 2-1-3 swap
//   - NO trail label klikalny (no trail switcher in row)
//   - NO curator chip / banner
//   - NO pagination counter "01" watermark
//   - NO line chart / sparkline / elevation profile
//   - NO NWDHeader (this is a tab screen, not a wizard)
//   - NO English placeholders (DRAMA / BETA / TODAY)
//
// Tap a trail row → push to /trail/[id]/ranking (RankingScreen).
//
// Scaffolding — Commit 1. Content lands in commits 2-5.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUserRunCount } from '@/hooks/useUserRunCount';

export default function TablicaScreen() {
  const { profile } = useAuthContext();
  const { isFresh, status } = useUserRunCount(profile?.id);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.miniLabelRow}>
          <LiveDot size={6} color={colors.accent} mode="pulse" />
          <Text style={styles.miniLabel}>TABLICA</Text>
        </View>
        <Text style={styles.headline}>TABLICA</Text>
        <Text style={styles.sub}>
          {status === 'loading'
            ? 'Ładowanie…'
            : isFresh
              ? 'Pusta. Zacznij sezon.'
              : 'Twoje wyniki w lidze'}
        </Text>
      </View>

      {/* Content scaffolding — Stan A and Stan B render in commits 2-3. */}
      <View style={styles.contentPlaceholder}>
        <Text style={styles.placeholderHint}>
          {status === 'loading'
            ? 'Wczytuję twój sezon…'
            : isFresh
              ? '[Stan B placeholder — content w commit 3]'
              : '[Stan A placeholder — content w commit 2]'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
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
  contentPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 1.6,
  },
});
