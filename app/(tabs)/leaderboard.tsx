import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { mockLeaderboard } from '@/data/mock/leaderboard';
import { mockTrails } from '@/data/mock/trails';
import { formatTimeShort } from '@/content/copy';
import { copy } from '@/content/copy';
import { getRank } from '@/systems/ranks';
import { PeriodType } from '@/data/types';

const periods: { key: PeriodType; label: string }[] = [
  { key: 'day', label: copy.today },
  { key: 'weekend', label: copy.weekend },
  { key: 'all_time', label: copy.allTime },
];

export default function LeaderboardScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('all_time');
  const [selectedTrailId, setSelectedTrailId] = useState('dzida-czerwona');

  // For prototype, show same data regardless of period
  const entries = mockLeaderboard
    .filter((e) => e.trailId === selectedTrailId || selectedTrailId === 'all')
    .sort((a, b) => a.currentPosition - b.currentPosition);

  const selectedTrail = mockTrails.find((t) => t.id === selectedTrailId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>LEADERBOARD</Text>
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>✓ VERIFIED LEAGUE</Text>
          </View>
        </View>

        {/* Trail selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.trailSelector}
          contentContainerStyle={styles.trailSelectorContent}
        >
          {mockTrails.map((trail) => (
            <Pressable
              key={trail.id}
              style={[
                styles.trailChip,
                selectedTrailId === trail.id && styles.trailChipActive,
              ]}
              onPress={() => setSelectedTrailId(trail.id)}
            >
              <Text
                style={[
                  styles.trailChipText,
                  selectedTrailId === trail.id && styles.trailChipTextActive,
                ]}
              >
                {trail.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Period tabs */}
        <View style={styles.periodTabs}>
          {periods.map((p) => (
            <Pressable
              key={p.key}
              style={[
                styles.periodTab,
                selectedPeriod === p.key && styles.periodTabActive,
              ]}
              onPress={() => setSelectedPeriod(p.key)}
            >
              <Text
                style={[
                  styles.periodTabText,
                  selectedPeriod === p.key && styles.periodTabTextActive,
                ]}
              >
                {p.label.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Leaderboard entries */}
        {entries.map((entry, index) => {
          const rank = getRank(entry.rankId);
          const isTop3 = entry.currentPosition <= 3;
          const isUser = entry.isCurrentUser;

          return (
            <View
              key={entry.userId}
              style={[
                styles.entry,
                isUser && styles.entryUser,
                isTop3 && styles.entryTop3,
              ]}
            >
              {/* Position */}
              <View style={styles.positionCol}>
                <Text
                  style={[
                    styles.position,
                    isTop3 && { color: colors.gold },
                    isUser && { color: colors.accent },
                  ]}
                >
                  {entry.currentPosition}
                </Text>
              </View>

              {/* Delta arrow */}
              <View style={styles.deltaCol}>
                {entry.delta > 0 && (
                  <Text style={styles.deltaUp}>↑{entry.delta}</Text>
                )}
                {entry.delta < 0 && (
                  <Text style={styles.deltaDown}>↓{Math.abs(entry.delta)}</Text>
                )}
                {entry.delta === 0 && (
                  <Text style={styles.deltaFlat}>—</Text>
                )}
              </View>

              {/* Rider info */}
              <View style={styles.riderCol}>
                <View style={styles.riderRow}>
                  <Text style={[styles.rankIcon, { color: rank.color }]}>
                    {rank.icon}
                  </Text>
                  <Text
                    style={[
                      styles.riderName,
                      isUser && { color: colors.accent },
                    ]}
                  >
                    {entry.username}
                  </Text>
                </View>
              </View>

              {/* Time */}
              <View style={styles.timeCol}>
                <Text
                  style={[
                    styles.time,
                    isTop3 && { color: colors.textPrimary },
                  ]}
                >
                  {formatTimeShort(entry.bestDurationMs)}
                </Text>
                {entry.gapToLeader > 0 && (
                  <Text style={styles.gap}>
                    +{(entry.gapToLeader / 1000).toFixed(1)}s
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 4,
  },
  verifiedBadge: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  verifiedText: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 1,
  },
  trailSelector: {
    marginBottom: spacing.lg,
  },
  trailSelectorContent: {
    gap: spacing.sm,
  },
  trailChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  trailChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  trailChipText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontFamily: 'Inter_600SemiBold',
  },
  trailChipTextActive: {
    color: colors.accent,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  periodTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.bgCard,
  },
  periodTabActive: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodTabText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  periodTabTextActive: {
    color: colors.textPrimary,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryUser: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    borderBottomWidth: 0,
    marginVertical: spacing.xxs,
  },
  entryTop3: {
    borderBottomColor: colors.goldDim,
  },
  positionCol: {
    width: 36,
  },
  position: {
    ...typography.positionLarge,
    color: colors.textSecondary,
    fontSize: 20,
  },
  deltaCol: {
    width: 36,
    alignItems: 'center',
  },
  deltaUp: {
    ...typography.labelSmall,
    color: colors.accent,
  },
  deltaDown: {
    ...typography.labelSmall,
    color: colors.red,
  },
  deltaFlat: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  riderCol: {
    flex: 1,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rankIcon: {
    fontSize: 12,
  },
  riderName: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  timeCol: {
    alignItems: 'flex-end',
  },
  time: {
    ...typography.timeSmall,
    color: colors.textSecondary,
  },
  gap: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
});
