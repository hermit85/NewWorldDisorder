// ═══════════════════════════════════════════════════════════
// HeadToHeadCard — slide-up modal that appears when the rider
// taps a leaderboard row. Frames the rivalry: you vs them, the
// time delta, optional last-battle context.
//
// Sprint 2 ships a minimal-data version: rivals' avatar + tag,
// the gap, and a "WYZWIJ" CTA placeholder. Real backend battle
// history (last N runs vs each other) lights up later when the
// schema lands.
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface HeadToHeadCardProps {
  visible: boolean;
  onClose: () => void;
  /** Your avatar (left side). */
  selfAvatar: React.ReactNode;
  selfTag: string;
  selfTimeMs: number | null;
  /** Rival avatar (right side). */
  rivalAvatar: React.ReactNode;
  rivalTag: string;
  rivalTimeMs: number;
  rivalPosition: number;
  /** Optional: trail context for the gap. */
  trailName?: string;
  /** Optional: callback for "WYZWIJ" — null hides the CTA. */
  onChallenge?: () => void;
}

function formatGap(deltaMs: number): string {
  const sign = deltaMs >= 0 ? '+' : '−';
  const abs = Math.abs(deltaMs);
  const seconds = (abs / 1000).toFixed(2);
  return `${sign}${seconds}s`;
}

export function HeadToHeadCard({
  visible,
  onClose,
  selfAvatar,
  selfTag,
  selfTimeMs,
  rivalAvatar,
  rivalTag,
  rivalTimeMs,
  rivalPosition,
  trailName,
  onChallenge,
}: HeadToHeadCardProps) {
  const translateY = useSharedValue(400);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      translateY.value = withTiming(400, {
        duration: 200,
        easing: Easing.in(Easing.cubic),
      });
    }
  }, [visible, translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const gapText = selfTimeMs != null
    ? formatGap(selfTimeMs - rivalTimeMs)
    : null;
  const isAhead = selfTimeMs != null && selfTimeMs < rivalTimeMs;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        translateY.value = withTiming(400, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      }}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[styles.sheet, sheetStyle]}
          // Keep tap inside sheet from closing it.
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handle} />

          <Text style={styles.kicker}>HEAD TO HEAD</Text>
          {trailName ? (
            <Text style={styles.trailLine}>{trailName.toUpperCase()}</Text>
          ) : null}

          <View style={styles.battleRow}>
            {/* Self */}
            <View style={styles.side}>
              <View style={styles.avatarSlot}>{selfAvatar}</View>
              <Text style={styles.tag} numberOfLines={1}>
                @{selfTag}
              </Text>
              <Text style={styles.timeText}>
                {selfTimeMs != null
                  ? formatTime(selfTimeMs)
                  : 'BRAK PB'}
              </Text>
            </View>

            <View style={styles.gapBlock}>
              <Text style={styles.vsLabel}>VS</Text>
              {gapText ? (
                <Text
                  style={[
                    styles.gapText,
                    { color: isAhead ? colors.accent : colors.danger },
                  ]}
                >
                  {gapText}
                </Text>
              ) : null}
            </View>

            {/* Rival */}
            <View style={styles.side}>
              <View style={styles.avatarSlot}>{rivalAvatar}</View>
              <Text style={styles.tag} numberOfLines={1}>
                @{rivalTag}
              </Text>
              <Text style={[styles.timeText, styles.rivalTime]}>
                {formatTime(rivalTimeMs)}
              </Text>
              <Text style={styles.rivalPos}>#{rivalPosition}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            {onChallenge ? (
              <Pressable
                style={styles.challengeBtn}
                onPress={() => {
                  onChallenge();
                  onClose();
                }}
              >
                <Text style={styles.challengeText}>WYZWIJ</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>ZAMKNIJ</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 10, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.borderHot,
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textTertiary,
    marginBottom: 8,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  trailLine: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  battleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  avatarSlot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  timeText: {
    fontFamily: fonts.racing,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rivalTime: {
    color: colors.accent,
  },
  rivalPos: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 1.6,
  },
  gapBlock: {
    width: 80,
    alignItems: 'center',
    gap: 4,
  },
  vsLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  gapText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentInk,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
  closeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
});
