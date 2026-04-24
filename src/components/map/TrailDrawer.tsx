import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailColor } from '@/theme/map';
import { Trail, Challenge } from '@/data/types';

// Trail stats from the real backend hook — only what the backend actually provides
interface TrailStats {
  pbMs?: number | null;
  position?: number | null;
}
import { isChallengeActive } from '@/systems/challenges';
import { formatTimeShort, copy } from '@/content/copy';
import { tapLight, tapMedium } from '@/systems/haptics';

// ── Start readiness ──
export type ReadinessLevel = 'no_gps' | 'outside_venue' | 'too_far' | 'approaching' | 'at_start' | 'ready';

export type GpsQuality = 'excellent' | 'good' | 'weak' | 'none';

export interface StartReadiness {
  level: ReadinessLevel;
  distanceM: number | null;
  gpsQuality: GpsQuality;
}

const READINESS_CONFIG: Record<ReadinessLevel, { label: string; color: string }> = {
  no_gps:        { label: 'SZUKAM GPS…',            color: 'rgba(255, 255, 255, 0.25)' },
  outside_venue: { label: 'POZA BIKE PARKIEM',      color: 'rgba(255, 255, 255, 0.25)' },
  too_far:       { label: 'IDŹ DO STARTU',          color: 'rgba(255, 255, 255, 0.35)' },
  approaching: { label: 'PRAWIE NA MIEJSCU',      color: '#FF9500' },
  at_start:    { label: 'W STREFIE STARTU',       color: '#00C8FF' },
  ready:       { label: 'GOTOWY',                  color: '#00FF88' },
};

const GPS_QUALITY_CONFIG: Record<GpsQuality, { label: string; bars: number; color: string }> = {
  excellent: { label: 'GPS ●●●', bars: 3, color: '#00FF88' },
  good:      { label: 'GPS ●●○', bars: 2, color: '#FF9500' },
  weak:      { label: 'GPS ●○○', bars: 1, color: '#FF3B30' },
  none:      { label: 'GPS ○○○', bars: 0, color: 'rgba(255,255,255,0.20)' },
};

interface Props {
  trail: Trail;
  stats: TrailStats | undefined;
  challenges?: Challenge[];
  readiness?: StartReadiness;
  rankingEnabled?: boolean;
  colorClass?: string;
  onShowStart?: () => void;
  onShowRider?: () => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function TrailDrawer({ trail, stats, challenges = [], readiness, rankingEnabled = true, colorClass, onShowStart, onShowRider, onClose }: Props) {
  const router = useRouter();
  const diffColor = getTrailColor(colorClass, trail.difficulty);
  // Filter to challenges relevant to this trail (or spot-wide), and still active
  const trailChallenges = challenges.filter(
    (c) => (c.trailId === trail.id || c.trailId === null) && isChallengeActive(c)
  );
  const activeChallenge = trailChallenges[0];

  const handleStartRun = () => {
    tapMedium();
    router.push({
      pathname: '/run/active',
      params: { trailId: trail.id, trailName: trail.name },
    });
  };

  const handleViewTrail = () => {
    tapLight();
    router.push(`/trail/${trail.id}`);
  };

  // Compact mode: when readiness is active and user isn't at start yet
  const isCompact = readiness != null && readiness.level !== 'ready' && readiness.level !== 'at_start';

  // CTA per-state: honest, actionable, zero false promises
  // When rankingEnabled=false, all runs are training — CTA reflects that
  const ctaConfig = (() => {
    if (!rankingEnabled) {
      // Training-only venue: always show training CTA, never promise ranking
      if (readiness?.level === 'no_gps') {
        return { text: 'CZEKAM NA GPS…', color: 'rgba(255,255,255,0.05)', textColor: 'rgba(255,255,255,0.20)', enabled: false };
      }
      return { text: 'JEDŹ TRENINGOWO', color: 'rgba(0, 200, 255, 0.15)', textColor: '#00C8FF', enabled: true };
    }

    switch (readiness?.level) {
      case 'ready':
        return { text: 'START', color: '#00FF88', textColor: colors.bg, enabled: true };
      case 'at_start':
        return { text: 'ROZPOCZNIJ ZJAZD', color: colors.accent, textColor: colors.bg, enabled: true };
      case 'approaching':
        return { text: 'JEDŹ BEZ WERYFIKACJI', color: 'rgba(255,255,255,0.14)', textColor: 'rgba(255,255,255,0.65)', enabled: true };
      case 'too_far':
        return { text: 'JEDŹ BEZ WERYFIKACJI', color: 'rgba(255,255,255,0.10)', textColor: 'rgba(255,255,255,0.50)', enabled: true };
      case 'outside_venue':
        return { text: 'JEDŹ BEZ WERYFIKACJI', color: 'rgba(255,255,255,0.08)', textColor: 'rgba(255,255,255,0.40)', enabled: true };
      case 'no_gps':
        return { text: 'CZEKAM NA GPS…', color: 'rgba(255,255,255,0.05)', textColor: 'rgba(255,255,255,0.20)', enabled: false };
      default:
        return { text: copy.startRun.toUpperCase(), color: colors.accent, textColor: colors.bg, enabled: true };
    }
  })();

  return (
    <View style={styles.container}>
      {/* Accent color strip at top */}
      <View style={[styles.accentStrip, { backgroundColor: diffColor }]} />

      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Trail header — compact: inline with badges */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Otwórz trasę ${trail.name}`}
              onPress={handleViewTrail}
            >
              <Text style={[styles.trailName, isCompact && styles.trailNameCompact]}>{trail.name}</Text>
            </Pressable>
            <View style={[styles.diffBadge, { borderColor: diffColor }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>
                {trail.difficulty.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats row — compact: single line */}
      <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
        <Text style={styles.statInline}>{trail.distanceM}m</Text>
        <Text style={styles.statDot}>·</Text>
        <Text style={styles.statInline}>↓{trail.elevationDropM}m</Text>
        {stats?.pbMs && (
          <>
            <Text style={styles.statDot}>·</Text>
            <Text style={[styles.statInline, { color: colors.accent }]}>PB {formatTimeShort(stats.pbMs)}</Text>
          </>
        )}
        {stats?.position && (
          <>
            <Text style={styles.statDot}>·</Text>
            <Text style={styles.statInline}>#{stats.position}</Text>
          </>
        )}
      </View>

      {/* Active challenge — only when not compact */}
      {!isCompact && activeChallenge && (
        <View style={styles.challengeRow}>
          <Text style={styles.challengeIcon}>⚡</Text>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeName}>{activeChallenge.name}</Text>
            <View style={styles.challengeBar}>
              <View
                style={[
                  styles.challengeBarFill,
                  {
                    width: `${(activeChallenge.currentProgress / activeChallenge.targetProgress) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Start readiness indicator ── */}
      {readiness && (
        <View style={styles.readinessRow}>
          <View style={[styles.readinessDot, { backgroundColor: READINESS_CONFIG[readiness.level].color }]} />
          <Text style={[styles.readinessLabel, { color: READINESS_CONFIG[readiness.level].color }]}>
            {READINESS_CONFIG[readiness.level].label}
          </Text>
          {readiness.distanceM != null && readiness.level !== 'at_start' && readiness.level !== 'ready' && readiness.level !== 'no_gps' && readiness.level !== 'outside_venue' && (
            <Text style={styles.readinessDistance}>
              {readiness.distanceM} M
            </Text>
          )}
          {/* GPS quality + find-start inline */}
          <View style={styles.readinessActions}>
            {readiness.level !== 'ready' && readiness.level !== 'no_gps' && onShowStart && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Znajdź start"
                style={({ pressed }) => [styles.inlineActionBtn, pressed && styles.inlineActionBtnPressed]}
                onPress={() => { tapLight(); onShowStart(); }}
              >
                <Text style={styles.inlineActionText}>ZNAJDŹ START</Text>
              </Pressable>
            )}
            <Text style={[styles.gpsQuality, { color: GPS_QUALITY_CONFIG[readiness.gpsQuality].color }]}>
              {GPS_QUALITY_CONFIG[readiness.gpsQuality].label}
            </Text>
          </View>
        </View>
      )}

      {/* CTA */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaConfig.text}
        style={[
          styles.startBtn,
          { backgroundColor: ctaConfig.color },
        ]}
        onPress={handleStartRun}
        disabled={!ctaConfig.enabled}
      >
        <Text style={[
          styles.startBtnText,
          { color: ctaConfig.textColor },
        ]}>{ctaConfig.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 18, 0.94)',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: 32,
    paddingTop: spacing.xs,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    borderRadius: 1,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  // ── Header ──
  header: {
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  diffBadge: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  diffText: {
    ...typography.labelSmall,
    fontSize: 8,
  },
  trailName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  trailNameCompact: {
    fontSize: 16,
  },
  // ── Stats ──
  statsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
  },
  statsRowCompact: {
    marginBottom: 6,
  },
  statInline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.50)',
  },
  statDot: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.20)',
  },
  // ── Challenge ──
  challengeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  challengeIcon: {
    fontSize: 14,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  challengeBar: {
    height: 2,
    backgroundColor: colors.bg,
    borderRadius: 1,
    overflow: 'hidden' as const,
  },
  challengeBarFill: {
    height: '100%' as const,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
  // ── Readiness ──
  readinessRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radii.sm,
  },
  readinessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  readinessLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 8,
    letterSpacing: 1.5,
  },
  readinessDistance: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.40)',
  },
  readinessActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginLeft: 'auto' as const,
  },
  inlineActionBtn: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  inlineActionBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  inlineActionText: {
    fontFamily: 'Rajdhani_400Regular',
    fontSize: 7,
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 2,
  },
  gpsQuality: {
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    letterSpacing: 0.3,
  },
  // ── CTA ──
  startBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing.sm,
  },
  startBtnText: {
    ...typography.cta,
    fontSize: 12,
    letterSpacing: 3,
  },
});
