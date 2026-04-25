// ─────────────────────────────────────────────────────────────
// TrailRow — Bike Park Hub list row
//
// Replaces the per-trail "card" surface inside the bike park
// view. Layout matches design-system/Bike Park Hub.html § STATE A:
//
//   [4px diff stripe] [name + diff pill]   [PB time]
//                     [meta · status pulse] [rank]
//
// Self trail (last ridden by user) gets a left accent stripe +
// soft glow gradient pulled from `raceState.armed`. All other
// rows are flat — separators are 1px hairlines on the bottom.
//
// Status pulse:
//   OPEN    accent + 1.6s pulse
//   WET     warn + 1.6s pulse
//   CLOSED  danger solid (no pulse)
// ─────────────────────────────────────────────────────────────
import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatTimeShort } from '@/content/copy';
import type { BikeParkTrailCardData } from '@/lib/api';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { motion } from '@/theme/motion';
import {
  DifficultyPill,
  resolveDifficultyTone,
  type DifficultyTone,
} from './DifficultyPill';

type TrailRowProps = BikeParkTrailCardData & {
  onPress?: () => void;
};

const DIFF_STRIPE_COLOR: Record<DifficultyTone, string> = {
  green: colors.diffGreen,
  blue: colors.diffBlue,
  red: colors.diffRed,
  black: colors.textPrimary,
};

type StatusKind = 'open' | 'wet' | 'closed';

/**
 * Map a trail's calibration / state to the Bike Park Hub status
 * indicator shown next to distance/drop in the meta row.
 *
 * - calibrating / fresh_pending_second_run → "VALIDATING" (warn pulse,
 *   visually equivalent to "WET" — system is unsure)
 * - everything else → "OPEN" (accent pulse)
 *
 * Note: there's no live "wet" / "closed" data source today, so the
 * mapping focuses on calibration confidence. Future sensor work can
 * extend this without changing the row layout.
 */
function resolveStatus(calibrationStatus?: string | null): { kind: StatusKind; label: string } {
  const c = (calibrationStatus ?? '').toLowerCase();
  if (c === 'calibrating' || c === 'fresh_pending_second_run') {
    return { kind: 'wet', label: 'WALIDACJA' };
  }
  if (c === 'locked') {
    return { kind: 'closed', label: 'ZAMKNIĘTA' };
  }
  return { kind: 'open', label: 'OPEN' };
}

const STATUS_COLOR: Record<StatusKind, string> = {
  open: colors.accent,
  wet: colors.warn,
  closed: colors.danger,
};

function PulseDot({ color, animate }: { color: string; animate: boolean }) {
  const opacity = useRef(new Animated.Value(animate ? 0.4 : 1)).current;

  useEffect(() => {
    if (!animate) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, opacity]);

  return (
    <Animated.View
      style={[
        styles.statusDot,
        { backgroundColor: color, opacity },
      ]}
    />
  );
}

export const TrailRow = memo(function TrailRow({
  trail,
  state,
  userData,
  calibrationStatus,
  onPress,
}: TrailRowProps) {
  const tone = resolveDifficultyTone(trail.difficulty, trail.type);
  const status = resolveStatus(calibrationStatus);
  const isSelf = !!userData.lastRanAt; // last-ridden gets the accent stripe
  const isBeaten = state === 'beaten';
  const distanceKm = (trail.distanceM / 1000).toFixed(1);
  // Drop is not surfaced separately on the trail card data — synthesize
  // a placeholder until BikeParkTrailCardData carries elevation. For
  // now use distance as a proxy "M" label so the meta row keeps two
  // numeric anchors.
  const dropM: number | null = null;

  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress?.();
  }, [onPress]);

  const a11y = [
    `Trasa ${trail.name}`,
    `${tone.toUpperCase()} difficulty`,
    `${distanceKm} km`,
    status.label,
    userData.pbMs ? `Twój PB ${formatTimeShort(userData.pbMs)}` : 'Brak PB',
    userData.position ? `pozycja #${userData.position}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        (isSelf || isBeaten) && styles.rowSelf,
        pressed && styles.rowPressed,
      ]}
    >
      {/* 4px difficulty stripe — full row height */}
      <View
        style={[styles.diffStripe, { backgroundColor: DIFF_STRIPE_COLOR[tone] }]}
      />

      {/* Self / beaten gets an accent left rail with soft glow */}
      {(isSelf || isBeaten) && <View style={styles.selfRail} />}

      <View style={styles.main}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {trail.name}
          </Text>
          <DifficultyPill tone={tone} />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            <Text style={styles.metaNumber}>{distanceKm}</Text>
            <Text style={styles.metaUnit}> KM</Text>
          </Text>
          {dropM !== null && (
            <Text style={styles.metaText}>
              <Text style={styles.metaNumber}>{dropM}</Text>
              <Text style={styles.metaUnit}> M ↓</Text>
            </Text>
          )}
          <View style={styles.statusGroup}>
            <PulseDot
              color={STATUS_COLOR[status.kind]}
              animate={status.kind !== 'closed'}
            />
            <Text style={[styles.statusText, { color: STATUS_COLOR[status.kind] }]}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.right}>
        {userData.pbMs ? (
          <>
            <Text style={styles.pbLabel}>
              {userData.position ? `PB · #${userData.position}` : 'PB'}
            </Text>
            <Text style={styles.pbTime}>{formatTimeShort(userData.pbMs)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.pbLabel}>BRAK PB</Text>
            <Text style={[styles.pbTime, styles.pbTimeMuted]}>—:—.—</Text>
          </>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  rowSelf: {
    // Soft accent gradient left → transparent. RN doesn't do native
    // CSS-style gradients without expo-linear-gradient, so we use a
    // tinted background as a flat approximation that still reads as
    // "this is your row."
    backgroundColor: 'rgba(0, 255, 135, 0.04)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  diffStripe: {
    width: 4,
    alignSelf: 'stretch',
  },
  selfRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  main: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  name: {
    ...typography.lead,
    fontSize: 15,
    lineHeight: 16,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0,
    fontWeight: '700',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'nowrap',
  },
  metaText: {
    ...typography.micro,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metaNumber: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  metaUnit: {
    color: colors.textSecondary,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    ...typography.micro,
    fontSize: 8,
    letterSpacing: 1.28, // 0.16em @ 8px
    fontWeight: '800',
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 86,
  },
  pbLabel: {
    ...typography.micro,
    fontSize: 8,
    letterSpacing: 1.28,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  pbTime: {
    ...typography.lead,
    fontSize: 16,
    lineHeight: 16,
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pbTimeMuted: {
    color: colors.textTertiary,
  },
});

// motion token referenced for documentation; row uses local 1.6s pulse
// to match the design's pulseDot keyframe (faster than pulseArmed
// because the dot is small and high-contrast — eye picks it up sooner).
void motion;
