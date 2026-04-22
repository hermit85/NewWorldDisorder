// ═══════════════════════════════════════════════════════════
// /run/[id] — DB-backed run detail route.
//
// Exists primarily as the orphan-safe entry point for runs
// whose parent trail or spot has been cascade-deleted. Loads
// the run by id, looks up the trail, and either:
//   - trail still exists -> redirect to /run/result (the
//     existing rich celebration screen keyed off runSessionId)
//   - trail missing      -> render RunArchivedState with a
//     guaranteed-visible back-to-home CTA.
// The back button in the header is ALWAYS visible (never
// gated on can-go-back) so a deep link + stale trail can't
// lock the rider in a dead-end screen.
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { GlowButton } from '@/components/ui/GlowButton';
import { RunArchivedState } from '@/components/run/RunArchivedState';
import { useRun, useTrail } from '@/hooks/useBackend';
import { chunk9Colors, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

export default function RunDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string }>();
  const runId = rawId ?? null;
  const router = useRouter();
  const navigation = useNavigation();

  const { run, status: runStatus } = useRun(runId);
  const { trail, status: trailStatus } = useTrail(run?.trail_id ?? null);

  // If the trail still exists, delegate to the richer /run/result
  // screen. This route exists primarily for orphan handling; the
  // redirect keeps the happy path single-screen.
  useEffect(() => {
    if (run && trailStatus === 'ok' && trail) {
      router.replace({
        pathname: '/run/result',
        params: { runId: run.id, trailId: trail.id, trailName: trail.name },
      });
    }
  }, [run, trail, trailStatus, router]);

  function handleBack() {
    Haptics.selectionAsync().catch(() => undefined);
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  }

  const showArchived = run && (trailStatus === 'empty' || trailStatus === 'error' || !trail);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={handleBack}
          hitSlop={16}
          style={styles.backButton}
        >
          <Text style={styles.backLabel}>←</Text>
        </Pressable>
      </View>

      {runStatus === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={chunk9Colors.accent.emerald} />
        </View>
      ) : runStatus === 'error' || !runId ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Nie znaleziono zjazdu</Text>
          <Text style={styles.body}>Link może być nieaktualny.</Text>
          <GlowButton label="Wróć na home" variant="primary" onPress={() => router.replace('/')} />
        </View>
      ) : showArchived && run ? (
        <RunArchivedState runId={run.id} durationMs={run.duration_ms} />
      ) : (
        /* Redirect useEffect fires on the next render; show a spinner
           in the interim to avoid a frame of empty screen. */
        <View style={styles.centered}>
          <ActivityIndicator color={chunk9Colors.accent.emerald} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: chunk9Colors.bg.base },
  header: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingVertical: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chunk9Colors.bg.surface,
  },
  backLabel: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    marginTop: -2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    gap: 12,
  },
  title: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    textAlign: 'center',
  },
  body: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    textAlign: 'center',
  },
});
