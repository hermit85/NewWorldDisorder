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
  // 5 clear user-facing categories:
  // ZALICZONY — verified, in league
  // TRENING — practice mode, not ranked
  // SŁABY SYGNAŁ — weak GPS, saved but not ranked
  // OCZEKUJE — still pending verification/save
  // NIEZALICZONY — failed verification (shortcut, off-route, etc.)

  if (run.mode === 'practice') {
    return { text: 'TRENING', color: colors.blue, icon: '○' };
  }

  const v = run.verification;
  if (!v || v.status === 'pending') {
    return { text: 'OCZEKUJE', color: colors.gold, icon: '…' };
  }

  if (v.isLeaderboardEligible) {
    return { text: 'ZALICZONY', color: colors.accent, icon: '✓' };
  }

  if (v.status === 'weak_signal') {
    return { text: 'SŁABY SYGNAŁ', color: colors.orange, icon: '!' };
  }

  // All other non-eligible: shortcut, off-route, missing checkpoint, etc.
  if (v.status === 'shortcut_detected' || v.status === 'invalid_route' ||
      v.status === 'outside_start_gate' || v.status === 'outside_finish_gate' ||
      v.status === 'missing_checkpoint') {
    return { text: 'NIEZALICZONY', color: colors.red, icon: '✕' };
  }

  return { text: 'ZAPISANY', color: colors.textTertiary, icon: '—' };
}

function getSaveIndicator(status: SaveStatus): { text: string; color: string } | null {
  switch (status) {
    case 'saving':
      return { text: 'Zapisuję…', color: colors.accent };
    case 'queued':
      return { text: 'W kolejce', color: colors.gold };
    case 'failed':
      return { text: 'Zapis nieudany · otwórz aby ponowić', color: colors.orange };
    case 'offline':
      return { text: 'Zapisano lokalnie · wyślę online', color: colors.textTertiary };
    default:
      return null;
  }
}

// ── Run Item ──

function RunItem({ run, onPress }: { run: FinalizedRun; onPress: () => void }) {
  const status = getRunStatus(run);
  const saveIndicator = getSaveIndicator(run.saveStatus);
  const isPb = run.backendResult?.isPb === true;
  const previousBestMs = run.backendResult?.previousBestMs ?? null;
  const pbDeltaMs = isPb && previousBestMs ? previousBestMs - run.durationMs : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.runItem,
        pressed && styles.runItemPressed,
      ]}
    >
      {/* Left: trail info */}
      <View style={styles.runItemLeft}>
        <View style={styles.runItemHeader}>
          <Text style={styles.runTrailName} numberOfLines={1}>
            {run.trailName}
          </Text>
          {isPb && (
            <View style={styles.pbBadge}>
              <Text style={styles.pbBadgeText}>PB</Text>
              {pbDeltaMs && pbDeltaMs > 0 && (
                <Text style={styles.pbDeltaSmall}>
                  −{(pbDeltaMs / 1000).toFixed(1)}s
                </Text>
              )}
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
        <Text style={[
          styles.runTime,
          isPb && { color: colors.accent },
        ]}>
          {formatDuration(run.durationMs)}
        </Text>
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
      <Text style={styles.emptyTitle}>Jeszcze bez zjazdów</Text>
      <Text style={styles.emptyBody}>
        Wybierz trasę i jedź. Twoje wyniki pojawią się tutaj.
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
        runSessionId: run.sessionId,
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
          {runs.length > 0 ? `${runs.length} ${runs.length === 1 ? 'zjazd' : runs.length < 5 ? 'zjazdy' : 'zjazdów'}` : ''}
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
    flexDirection: 'row',
    alignItems: 'center',
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
  pbDeltaSmall: {
    fontFamily: fonts.racing,
    fontSize: 8,
    color: colors.accent,
    opacity: 0.7,
    marginLeft: 4,
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
