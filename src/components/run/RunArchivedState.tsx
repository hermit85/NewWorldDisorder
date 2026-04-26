// ═══════════════════════════════════════════════════════════
// RunArchivedState — rendered on /run/[id] when the run row
// exists in DB but its parent trail (or the trail's spot) no
// longer does. Keeps the rider's finish time visible and
// offers a clean escape back to home.
//
// Chunk 10.1 Track C-G fix. The bug was that tapping an
// orphaned run from history opened a screen with no back
// button and no tab bar — the only way out was to force-kill
// the app. This component is the graceful fallback.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GlowButton } from '@/components/ui/GlowButton';
import { colors } from '@/theme/colors';
import { spacing, radii } from '@/theme/spacing';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return min > 0
    ? `${min}:${sec.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`
    : `${sec}.${frac.toString().padStart(2, '0')}`;
}

export const RunArchivedState = memo(function RunArchivedState({
  durationMs,
}: {
  runId?: string;
  durationMs: number;
}) {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.kicker}>ZJAZD ZARCHIWIZOWANY</Text>
        <Text style={styles.time}>{formatDuration(durationMs)}</Text>
        <Text style={styles.body}>
          Trasa lub bike park został usunięty. Twój wynik został zapisany.
        </Text>
        <View style={styles.ctaWrap}>
          <GlowButton label="Wróć na home" variant="primary" onPress={() => router.replace('/')} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pad,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  kicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.86,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  time: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 56,
    lineHeight: 68,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19.5,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});
