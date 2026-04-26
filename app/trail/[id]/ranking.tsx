// ═══════════════════════════════════════════════════════════
// /trail/[id]/ranking — RankingScreen sub-screen (Tablica Phase 1)
//
// Reusable from (tabs)/leaderboard tap-into-trail AND from
// future Spot/Trail detail "Tablica" buttons. Expects the trail
// id route param + reads scoped leaderboard via fetch_scoped_leaderboard.
//
// Phase 1 scaffolding — content in commit 4.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export default function RankingScreen() {
  const { id: trailId } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>RANKING</Text>
        <Text style={styles.placeholderHint}>
          {trailId ? `trailId: ${trailId}` : 'NO TRAIL'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderTitle: {
    fontFamily: fonts.racing,
    fontSize: 44,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  placeholderHint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
});
