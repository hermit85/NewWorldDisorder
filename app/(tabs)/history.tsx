// ═══════════════════════════════════════════════════════════
// Moje Zjazdy — Run History Tab
// Premium gravity racing history, not a fitness log.
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { fonts } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import {
  getAllFinalizedRuns,
  subscribeFinalizedRun,
  type FinalizedRun,
  type SaveStatus,
} from '@/systems/runStore';

// ── Helpers ──

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 10);
  if (min > 0) {
    return `${min}:${sec.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`;
  }
  return `${sec}.${frac.toString().padStart(2, '0')}`;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Przed chwilą';
  if (mins < 60) return `${mins} min temu`;
  if (hours < 24) return `${hours}h temu`;
  if (days === 1) return 'Wczoraj';
  if (days < 7) return `${days} dni temu`;

  const d = new Date(timestamp);
  return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

type RunStatusLabel = {
  text: string;
  color: string;
  icon: string;
};

function getRunStatus(run: FinalizedRun): RunStatusLabel {
  if (run.mode === 'practice') {
    return { text: 'TRENING', color: colors.blue, icon: '◇' };
  }

  if (run.verification?.isLeaderboardEligible) {
    const tierLabel =
      run.qualityTier === 'perfect' ? 'OFICJALNY' :
      run.qualityTier === 'valid' ? 'OFICJALNY' :
      run.qualityTier === 'rough' ? 'ZAPISANY' :
      'OFICJALNY';
    const tierColor =
      run.qualityTier === 'perfect' ? colors.accent :
      run.qualityTier === 'valid' ? colors.accent :
      run.qualityTier === 'rough' ? colors.orange :
      colors.accent;
    return { text: tierLabel, color: tierColor, icon: '▲' };
  }

  return { text: 'ZAPISANY', color: colors.textTertiary, icon: '—' };
}

function getSaveIndicator(status: SaveStatus): { text: string; color: string } | null {
  switch (status) {
    case 'queued':
    case 'saving':
      return { text: 'Zapisywanie…', color: colors.orange };
    case 'failed':
      return { text: 'Zapis nieudany', color: colors.red };
    case 'offline':
      return { text: 'Offline', color: colors.textTertiary };
    default:
      return null;
  }
}

// ── Run Item ──

function RunItem({ run, onPress }: { run: FinalizedRun; onPress: () => void }) {
  const status = getRunStatus(run);
  const saveIndicator = getSaveIndicator(run.saveStatus);
  const isPb = run.backendResult?.isPb === true;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.runItem,
        pressed && styles.runItemPressed,
      ]}
    >
      {/* Left: trail color dot + info */}
      <View style={styles.runItemLeft}>
        <View style={styles.runItemHeader}>
          <Text style={styles.runTrailName} numberOfLines={1}>
            {run.trailName}
          </Text>
          {isPb && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbBadgeText}>PB</Text>
            </View>
          )}
        </View>

        <View style={styles.runItemMeta}>
          <Text style={[styles.statusBadge, { color: status.color }]}>
            {status.icon} {status.text}
          </Text>
          <Text style={styles.runDate}>{relativeTime(run.startedAt)}</Text>
        </View>

        {saveIndicator && (
          <Text style={[styles.saveStatus, { color: saveIndicator.color }]}>
            {saveIndicator.text}
          </Text>
        )}
      </View>

      {/* Right: time */}
      <View style={styles.runItemRight}>
        <Text style={styles.runTime}>{formatDuration(run.durationMs)}</Text>
        {run.backendResult?.leaderboardResult?.position && (
          <Text style={styles.runPosition}>
            #{run.backendResult.leaderboardResult.position}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ── Empty State ──

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⛰️</Text>
      <Text style={styles.emptyTitle}>Brak zjazdów</Text>
      <Text style={styles.emptyBody}>
        Twoje przejazdy pojawią się tutaj po pierwszym runie.
      </Text>
    </View>
  );
}

// ── Main Screen ──

export default function HistoryScreen() {
  const [runs, setRuns] = useState<FinalizedRun[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadRuns = useCallback(() => {
    const all = getAllFinalizedRuns();
    setRuns(all);
  }, []);

  useEffect(() => {
    loadRuns();
    const unsub = subscribeFinalizedRun(() => {
      loadRuns();
    });
    return unsub;
  }, [loadRuns]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRuns();
    setRefreshing(false);
  }, [loadRuns]);

  const handleRunPress = useCallback((run: FinalizedRun) => {
    router.push({
      pathname: '/run/result',
      params: {
        sessionId: run.sessionId,
        trailId: run.trailId,
        trailName: run.trailName,
      },
    });
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>MOJE ZJAZDY</Text>
        <Text style={styles.headerCount}>
          {runs.length > 0 ? `${runs.length} ${runs.length === 1 ? 'run' : 'runów'}` : ''}
        </Text>
      </View>

      {/* Run List */}
      <FlatList
        data={runs}
        keyExtractor={(item) => item.sessionId}
        renderItem={({ item }) => (
          <RunItem run={item} onPress={() => handleRunPress(item)} />
        )}
        ListEmptyComponent={EmptyState}
        contentContainerStyle={[
          styles.listContent,
          runs.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontSize: 14,
    letterSpacing: 3,
  },
  headerCount: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },

  // Run Item
  runItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  runItemPressed: {
    opacity: 0.6,
  },
  runItemLeft: {
    flex: 1,
    marginRight: spacing.lg,
  },
  runItemRight: {
    alignItems: 'flex-end',
  },
  runItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  runTrailName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  pbBadge: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pbBadgeText: {
    fontFamily: fonts.racing,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1,
  },
  runItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusBadge: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  runDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textTertiary,
  },
  saveStatus: {
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: spacing.xs,
  },

  // Time
  runTime: {
    fontFamily: fonts.racing,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  runPosition: {
    fontFamily: fonts.racing,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
