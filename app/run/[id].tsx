// ═══════════════════════════════════════════════════════════
// /run/[id] — DB-backed run detail route.
//
// Exists primarily as the orphan-safe entry point for runs whose
// parent trail or spot has been cascade-deleted. Loads the run by
// id, looks up the trail, and either:
//   - trail still exists -> redirect to /run/result (the existing
//     rich celebration screen keyed off runSessionId)
//   - trail missing      -> render RunArchivedState with a
//     guaranteed-visible back-to-home CTA.
// The back button in the header is ALWAYS visible (never gated on
// can-go-back) so a deep link + stale trail can't lock the rider
// in a dead-end screen.
//
// Migrated to canonical design system: TopBar atom + Btn ghost +
// canonical tokens (colors / typography / spacing).
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Btn, TopBar } from '@/components/nwd';
import { RunArchivedState } from '@/components/run/RunArchivedState';
import { useRun, useTrail } from '@/hooks/useBackend';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function RunDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const runId = rawId ?? null;
  const router = useRouter();
  const navigation = useNavigation();

  const { run, status: runStatus } = useRun(runId);
  const { trail, status: trailStatus } = useTrail(run?.trail_id ?? null);

  useEffect(() => {
    if (run && trailStatus === 'ok' && trail) {
      router.replace({
        pathname: '/run/result',
        params: { runId: run.id, trailId: trail.id, trailName: trail.name },
      });
    }
  }, [run, trail, trailStatus, router]);

  function handleBack() {
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  }

  const showArchived = run && (trailStatus === 'empty' || trailStatus === 'error' || !trail);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TopBar onBack={handleBack} title="Zjazd" />
      </View>

      {runStatus === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : runStatus === 'error' || !runId ? (
        <View style={styles.centered}>
          <Text style={styles.title}>NIE ZNALEZIONO ZJAZDU</Text>
          <Text style={styles.body}>Link może być nieaktualny.</Text>
          <Btn variant="primary" size="md" fullWidth={false} onPress={() => router.replace('/')}>
            Wróć na home
          </Btn>
        </View>
      ) : showArchived && run ? (
        <RunArchivedState runId={run.id} durationMs={run.duration_ms} />
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.pad,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pad,
    gap: 14,
  },
  title: {
    ...typography.label,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
