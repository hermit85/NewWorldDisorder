import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailColor } from '@/theme/map';
import { slotwinyTrails } from '@/data/seed/slotwinyOfficial';
import { mockTrails } from '@/data/mock/trails';
import { formatTimeShort } from '@/content/copy';
import { getRank } from '@/systems/ranks';
import { PeriodType } from '@/data/types';
import { useAuthContext } from '@/hooks/AuthContext';
import { useLeaderboard } from '@/hooks/useBackend';

const SCOPES: { key: PeriodType; label: string }[] = [
  { key: 'day', label: 'DZIŚ' },
  { key: 'weekend', label: 'WEEKEND' },
  { key: 'all_time', label: 'SEZON' },
];

// Medal colors — gold, silver, bronze
const MEDAL = {
  1: { color: colors.gold, bg: 'rgba(255, 215, 0, 0.08)', border: 'rgba(255, 215, 0, 0.25)', label: '🥇' },
  2: { color: '#C0C0C0', bg: 'rgba(192, 192, 192, 0.06)', border: 'rgba(192, 192, 192, 0.20)', label: '🥈' },
  3: { color: '#CD7F32', bg: 'rgba(205, 127, 50, 0.06)', border: 'rgba(205, 127, 50, 0.20)', label: '🥉' },
} as Record<number, { color: string; bg: string; border: string; label: string }>;

export default function LeaderboardScreen() {
  const params = useLocalSearchParams<{ trailId?: string; scope?: string }>();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>(
    (params.scope as PeriodType) || 'all_time',
  );
  const [selectedTrailId, setSelectedTrailId] = useState(
    params.trailId && mockTrails.some(t => t.id === params.trailId)
      ? params.trailId
      : 'dzida-czerwona',
  );
  const { profile } = useAuthContext();

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (params.trailId && mockTrails.some(t => t.id === params.trailId)) {
      setSelectedTrailId(params.trailId);
    }
    if (params.scope && ['day', 'weekend', 'all_time'].includes(params.scope)) {
      setSelectedPeriod(params.scope as PeriodType);
    }
  }, [params.trailId, params.scope]);

  const { entries, loading, error: lbError, refresh } = useLeaderboard(
    selectedTrailId,
    selectedPeriod,
    profile?.id,
  );

  // Animate board in when data loads
  useEffect(() => {
    if (!loading && entries.length > 0) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, entries.length, selectedTrailId, selectedPeriod]);

  const trailScrollRef = useRef<ScrollView>(null);
  const chipLayoutsRef = useRef<Map<string, { x: number; width: number }>>(new Map());

  const handleTrailSelect = useCallback((trailId: string) => {
    setSelectedTrailId(trailId);
    const layout = chipLayoutsRef.current.get(trailId);
    if (layout && trailScrollRef.current) {
      const screenW = Dimensions.get('window').width;
      const scrollTo = Math.max(0, layout.x - (screenW / 2) + (layout.width / 2));
      trailScrollRef.current.scrollTo({ x: scrollTo, animated: true });
    }
  }, []);

  const selectedTrail = mockTrails.find((t) => t.id === selectedTrailId);
  const selectedOfficial = slotwinyTrails.find((o) => o.id === selectedTrailId);
  const diffColor = selectedTrail ? getTrailColor(selectedOfficial?.colorClass, selectedTrail.difficulty) : colors.accent;

  const myEntry = entries.find((e) => e.isCurrentUser);
  const myPos = myEntry?.currentPosition ?? 0;
  const totalEntries = entries.length;

  const rivalAbove = myEntry
    ? entries.find((e) => e.currentPosition === myPos - 1)
    : null;
  const rivalBelow = myEntry
    ? entries.find((e) => e.currentPosition === myPos + 1)
    : null;

  const tierLabel = myPos === 0 ? null
    : myPos <= 3 ? 'PODIUM'
    : myPos <= 10 ? 'TOP 10'
    : 'CHASING';
  const placesToNextTier = myPos === 0 ? 0
    : myPos <= 3 ? 0
    : myPos <= 10 ? myPos - 3
    : myPos - 10;

  const podium = entries.filter((e) => e.currentPosition <= 3);
  const rest = entries.filter((e) => e.currentPosition > 3);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>TABLICA WYNIKÓW</Text>
          <Text style={styles.subtitle}>OFICJALNE CZASY</Text>
        </View>

        {/* Scope tabs */}
        <View style={styles.scopeRow}>
          {SCOPES.map(s => (
            <Pressable
              key={s.key}
              style={[styles.scopeTab, selectedPeriod === s.key && styles.scopeTabActive]}
              onPress={() => setSelectedPeriod(s.key)}
            >
              <Text style={[styles.scopeTabText, selectedPeriod === s.key && styles.scopeTabTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Trail selector */}
        <ScrollView
          ref={trailScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.trailSelector}
          contentContainerStyle={styles.trailSelectorContent}
        >
          {mockTrails.map((trail) => {
            const isActive = selectedTrailId === trail.id;
            const tOfficial = slotwinyTrails.find((o) => o.id === trail.id);
            const tColor = getTrailColor(tOfficial?.colorClass, trail.difficulty);
            return (
              <Pressable
                key={trail.id}
                style={[
                  styles.trailChip,
                  isActive && { borderColor: tColor, backgroundColor: tColor + '20', borderWidth: 1.5 },
                ]}
                onPress={() => handleTrailSelect(trail.id)}
                onLayout={(e) => {
                  chipLayoutsRef.current.set(trail.id, {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  });
                }}
              >
                <View style={[styles.trailChipDot, { backgroundColor: tColor }]} />
                <Text
                  style={[styles.trailChipText, isActive && { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {trail.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        )}

        {/* Error state */}
        {!loading && lbError && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>NIE UDAŁO SIĘ ZAŁADOWAĆ</Text>
            <Text style={styles.emptyDesc}>Tablica wyników jest teraz niedostępna.</Text>
            <Pressable style={styles.retryBtn} onPress={refresh}>
              <Text style={styles.retryText}>PONÓW</Text>
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {!loading && !lbError && entries.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyLine}>—</Text>
            <Text style={styles.emptyTitle}>TABLICA PUSTA</Text>
            <Text style={styles.emptyDesc}>Postaw pierwszy czas na {selectedTrail?.name ?? 'tej trasie'}.</Text>
          </View>
        )}

        {/* ═══ BOARD CONTENT — animated in ═══ */}
        {!loading && !lbError && entries.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ═══ PODIUM — top 3 ═══ */}
            {podium.length > 0 && (
              <View style={styles.podiumSection}>
                {podium.map((entry) => {
                  const rank = getRank(entry.rankId);
                  const isUser = entry.isCurrentUser;
                  const pos = entry.currentPosition;
                  const medal = MEDAL[pos];

                  return (
                    <View
                      key={entry.userId}
                      style={[
                        styles.podiumCard,
                        medal && { borderColor: medal.border, backgroundColor: medal.bg },
                        isUser && styles.podiumUser,
                      ]}
                    >
                      {/* Position + medal */}
                      <View style={styles.podiumPosRow}>
                        <Text style={[
                          styles.podiumPos,
                          medal && { color: medal.color },
                          pos === 1 && { fontSize: 30 },
                        ]}>
                          {pos}
                        </Text>
                      </View>

                      {/* Info */}
                      <View style={styles.podiumInfo}>
                        <View style={styles.podiumNameRow}>
                          <Text style={[styles.podiumRankIcon, { color: rank.color }]}>{rank.icon}</Text>
                          <Text style={[
                            styles.podiumName,
                            isUser && { color: colors.accent },
                          ]} numberOfLines={1}>
                            {entry.username}
                          </Text>
                          {isUser && <Text style={styles.youTag}>TY</Text>}
                        </View>
                        <Text style={[
                          styles.podiumTime,
                          medal && { color: medal.color },
                        ]}>
                          {formatTimeShort(entry.bestDurationMs)}
                        </Text>
                      </View>

                      {/* Delta */}
                      {entry.delta > 0 && (
                        <View style={styles.podiumDelta}>
                          <Text style={styles.podiumDeltaText}>↑{entry.delta}</Text>
                        </View>
                      )}
                      {entry.delta === 0 && entry.isCurrentUser && (
                        <View style={[styles.podiumDelta, { backgroundColor: colors.accentDim }]}>
                          <Text style={[styles.podiumDeltaText, { color: colors.accent }]}>NOWY</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* ═══ PODIUM / REST SEPARATOR ═══ */}
            {podium.length > 0 && rest.length > 0 && (
              <View style={styles.podiumSeparator}>
                <View style={styles.podiumSepLine} />
                <Text style={styles.podiumSepText}>RANKING</Text>
                <View style={styles.podiumSepLine} />
              </View>
            )}

            {/* ═══ RIDER STATUS CARD — your position (if not on podium) ═══ */}
            {myEntry && myPos > 3 && (
              <View style={styles.riderStatusCard}>
                <View style={styles.riderStatusMain}>
                  <Text style={styles.riderStatusPos}>#{myPos}</Text>
                  <View style={styles.riderStatusRight}>
                    {tierLabel && (
                      <Text style={[
                        styles.riderStatusTier,
                        tierLabel === 'TOP 10' && { color: colors.accent },
                      ]}>
                        {tierLabel}
                      </Text>
                    )}
                    {myEntry.delta > 0 && (
                      <Text style={styles.riderStatusDelta}>↑{myEntry.delta} {myEntry.delta === 1 ? 'POZYCJA' : myEntry.delta < 5 ? 'POZYCJE' : 'POZYCJI'}</Text>
                    )}
                    {myEntry.delta < 0 && (
                      <Text style={[styles.riderStatusDelta, { color: colors.red }]}>
                        ↓{Math.abs(myEntry.delta)} {Math.abs(myEntry.delta) === 1 ? 'POZYCJA' : Math.abs(myEntry.delta) < 5 ? 'POZYCJE' : 'POZYCJI'}
                      </Text>
                    )}
                  </View>
                </View>

                {rivalAbove && (
                  <View style={styles.riderGapRow}>
                    <Text style={styles.riderGapLabel}>
                      #{rivalAbove.currentPosition} {rivalAbove.username}
                    </Text>
                    <Text style={styles.riderGapValue}>
                      {((myEntry.bestDurationMs - rivalAbove.bestDurationMs) / 1000).toFixed(1)}s przed Tobą
                    </Text>
                  </View>
                )}

                {placesToNextTier > 0 && placesToNextTier <= 5 && (
                  <Text style={styles.riderAmbition}>
                    {placesToNextTier === 1 ? '1 pozycja' : `${placesToNextTier} pozycji`} do {myPos > 10 ? 'TOP 10' : 'podium'}
                  </Text>
                )}
              </View>
            )}

            {/* ═══ REST OF BOARD — positions 4+ ═══ */}
            {rest.length > 0 && (
              <View style={styles.boardSection}>
                {rest.map((entry) => {
                  const rank = getRank(entry.rankId);
                  const isUser = entry.isCurrentUser;
                  const isRivalAbove = rivalAbove?.userId === entry.userId;
                  const isRivalBelow = rivalBelow?.userId === entry.userId;

                  return (
                    <View
                      key={entry.userId}
                      style={[
                        styles.entry,
                        isUser && styles.entryUser,
                        (isRivalAbove || isRivalBelow) && styles.entryRival,
                      ]}
                    >
                      {/* User accent bar */}
                      {isUser && <View style={styles.entryAccentBar} />}

                      <View style={styles.positionCol}>
                        <Text style={[
                          styles.position,
                          isUser && { color: colors.accent },
                          isRivalAbove && { color: colors.orange },
                        ]}>
                          {entry.currentPosition}
                        </Text>
                      </View>

                      <View style={styles.deltaCol}>
                        {entry.delta > 0 && <Text style={styles.deltaUp}>↑{entry.delta}</Text>}
                        {entry.delta < 0 && <Text style={styles.deltaDown}>↓{Math.abs(entry.delta)}</Text>}
                        {entry.delta === 0 && <Text style={styles.deltaFlat}>—</Text>}
                      </View>

                      <View style={styles.riderCol}>
                        <View style={styles.riderRow}>
                          <Text style={[styles.rankIcon, { color: rank.color }]}>{rank.icon}</Text>
                          <Text
                            style={[
                              styles.riderName,
                              isUser && { color: colors.accent },
                              isRivalAbove && { color: colors.orange },
                            ]}
                            numberOfLines={1}
                          >
                            {entry.username}
                          </Text>
                          {isUser && <Text style={styles.youTag}>TY</Text>}
                          {isRivalAbove && <Text style={styles.rivalTag}>CEL</Text>}
                        </View>
                      </View>

                      <View style={styles.timeCol}>
                        <Text style={[styles.time, isUser && { color: colors.accent }]}>
                          {formatTimeShort(entry.bestDurationMs)}
                        </Text>
                        {entry.gapToLeader > 0 && (
                          <Text style={styles.gap}>+{(entry.gapToLeader / 1000).toFixed(1)}s</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Board footer */}
            <View style={styles.boardFooter}>
              <Text style={styles.boardFooterText}>
                {totalEntries} {totalEntries === 1 ? 'RIDER' : 'RIDERÓW'} · {selectedTrail?.name?.toUpperCase() ?? 'TRASA'} · {SCOPES.find(s => s.key === selectedPeriod)?.label ?? 'SEZON'}
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  // Header
  titleRow: { marginBottom: spacing.sm },
  title: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: colors.textPrimary, letterSpacing: 4 },
  subtitle: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, marginTop: spacing.xxs, fontSize: 9 },

  // Scope tabs
  scopeRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  scopeTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.sm, backgroundColor: 'transparent' },
  scopeTabActive: { backgroundColor: colors.accent },
  scopeTabText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 9 },
  scopeTabTextActive: { color: colors.bg, fontFamily: 'Inter_700Bold' },

  // Trail selector
  trailSelector: { marginBottom: spacing.xl, marginHorizontal: -spacing.lg },
  trailSelectorContent: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingRight: spacing.xxxl },
  trailChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  trailChipDot: { width: 6, height: 6, borderRadius: 3 },
  trailChipText: { ...typography.bodySmall, color: colors.textTertiary, fontFamily: 'Inter_600SemiBold', fontSize: 13, maxWidth: 160 },

  // Loading / Empty
  loadingWrap: { paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.huge, gap: spacing.sm },
  emptyLine: { fontFamily: 'Orbitron_700Bold', fontSize: 24, color: colors.textTertiary, letterSpacing: 8, marginBottom: spacing.xs },
  emptyTitle: { ...typography.label, color: colors.textTertiary, letterSpacing: 4, fontSize: 12 },
  emptyDesc: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  retryText: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 2 },

  // ═══ PODIUM ═══
  podiumSection: { gap: spacing.sm, marginBottom: spacing.md },
  podiumCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radii.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  podiumUser: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  podiumPosRow: { width: 44, alignItems: 'center' },
  podiumPos: { fontFamily: 'Orbitron_700Bold', fontSize: 24, color: colors.textSecondary },
  podiumInfo: { flex: 1, marginLeft: spacing.md },
  podiumNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  podiumRankIcon: { fontSize: 12 },
  podiumName: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_700Bold', fontSize: 15 },
  podiumTime: { fontFamily: 'Orbitron_700Bold', fontSize: 17, color: colors.textSecondary, marginTop: spacing.xxs, letterSpacing: 1 },
  podiumDelta: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  podiumDeltaText: { ...typography.labelSmall, color: colors.accent },

  // Podium / rest separator
  podiumSeparator: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md },
  podiumSepLine: { flex: 1, height: 1, backgroundColor: colors.border },
  podiumSepText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, fontSize: 8 },

  // ═══ RIDER STATUS CARD ═══
  riderStatusCard: {
    backgroundColor: colors.bgCard, borderRadius: radii.lg,
    padding: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.accent,
  },
  riderStatusMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  riderStatusPos: { fontFamily: 'Orbitron_700Bold', fontSize: 32, color: colors.accent },
  riderStatusRight: { alignItems: 'flex-end', gap: spacing.xxs },
  riderStatusTier: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3 },
  riderStatusDelta: { ...typography.labelSmall, color: colors.accent, letterSpacing: 1 },
  riderGapRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  riderGapLabel: { ...typography.bodySmall, color: colors.orange, fontFamily: 'Inter_600SemiBold' },
  riderGapValue: { ...typography.labelSmall, color: colors.orange, letterSpacing: 1 },
  riderAmbition: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, marginTop: spacing.sm, textAlign: 'center' },

  // ═══ BOARD (pos 4+) ═══
  boardSection: { },
  entry: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  entryUser: {
    backgroundColor: colors.accentDim, borderRadius: radii.sm,
    borderBottomWidth: 0, marginVertical: spacing.xxs,
    overflow: 'hidden',
  },
  entryAccentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: colors.accent, borderTopLeftRadius: radii.sm, borderBottomLeftRadius: radii.sm,
  },
  entryRival: { backgroundColor: 'rgba(255, 149, 0, 0.06)' },
  positionCol: { width: 36 },
  position: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.textTertiary },
  deltaCol: { width: 36, alignItems: 'center' },
  deltaUp: { ...typography.labelSmall, color: colors.accent },
  deltaDown: { ...typography.labelSmall, color: colors.red },
  deltaFlat: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 8 },
  riderCol: { flex: 1 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rankIcon: { fontSize: 12 },
  riderName: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  youTag: {
    ...typography.labelSmall, color: colors.accent,
    fontSize: 7, letterSpacing: 2, marginLeft: spacing.xs,
    backgroundColor: colors.accentDim, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },
  rivalTag: {
    ...typography.labelSmall, color: colors.orange,
    fontSize: 7, letterSpacing: 2, marginLeft: spacing.xs,
  },
  timeCol: { alignItems: 'flex-end' },
  time: { ...typography.timeSmall, color: colors.textSecondary, fontSize: 15 },
  gap: { ...typography.labelSmall, color: colors.textTertiary, marginTop: spacing.xxs, fontSize: 9 },

  // Board footer
  boardFooter: { alignItems: 'center', paddingVertical: spacing.xl },
  boardFooterText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, fontSize: 8 },
});
