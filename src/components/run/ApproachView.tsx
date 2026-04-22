// ═══════════════════════════════════════════════════════════
// ApproachView — Chunk 10 pre-run guidance screen
//
// Renders the five states produced by computeApproachState into a
// layout that a rider can read at a glance while walking to the start
// line. Deliberately text-first: the information a rider needs (how
// far, which way, can I start?) is legible without heavy map chrome.
//
// Spec: docs/nwd-architecture-spec-v3-amendment.md §2.2
// Copy anchor: keep strings terse and honest. "GPS słaby" beats
// "za linią" when accuracy is actually the problem.
// ═══════════════════════════════════════════════════════════

import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ApproachState } from '@/features/run/approachNavigator';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

// ── Props ──

export interface ApproachViewProps {
  trailName: string;
  mode: 'ranked' | 'training';
  state: ApproachState;
  /** Raw user accuracy in meters (for footer strength badge). */
  userAccuracyM: number;
  /** Raw user speed in m/s (for footer telemetry). */
  userVelocityMps: number;
  /** Raw user heading [0,360) or null (for footer telemetry). */
  userHeading: number | null;
  onBack?: () => void;
}

// ── GPS strength helper ──

function gpsStrengthLabel(accuracyM: number): { dots: string; label: string } {
  if (accuracyM <= 5) return { dots: '●●●', label: 'DOBRY' };
  if (accuracyM <= 10) return { dots: '●●○', label: 'ŚREDNI' };
  return { dots: '●○○', label: 'SŁABY' };
}

function formatAccuracy(accuracyM: number): string {
  return `±${accuracyM.toFixed(0)}m`;
}

function formatVelocity(v: number): string {
  return `${v.toFixed(1)} m/s`;
}

function formatBearing(b: number | null): string {
  return b == null ? '—' : `${b.toFixed(0)}°`;
}

// ── Sub-components per state ──

function FarContent({ distanceM, relativeArrowDeg }: { distanceM: number; relativeArrowDeg: number }) {
  return (
    <View style={styles.stateCenter}>
      <View style={[styles.arrowWrap, { transform: [{ rotate: `${relativeArrowDeg}deg` }] }]}>
        <Text style={styles.arrowGlyph}>↑</Text>
      </View>
      <Text style={styles.bigDistance}>{Math.round(distanceM)}m</Text>
      <Text style={styles.stateLabel}>DO STARTU</Text>
      <Text style={styles.stateHint}>Idź w kierunku strzałki.</Text>
    </View>
  );
}

function NearContent({
  distanceM,
  headingDeltaDeg,
  relativeArrowDeg,
}: {
  distanceM: number;
  headingDeltaDeg: number;
  relativeArrowDeg: number;
}) {
  const approachHint =
    headingDeltaDeg > 90 ? 'Obejdź — podejdź z kierunku trasy.' : 'Podejdź z kierunku trasy.';
  return (
    <View style={styles.stateCenter}>
      <View style={[styles.arrowWrap, { transform: [{ rotate: `${relativeArrowDeg}deg` }] }]}>
        <Text style={styles.arrowGlyph}>↑</Text>
      </View>
      <Text style={styles.bigDistance}>{Math.round(distanceM)}m</Text>
      <Text style={styles.stateLabel}>DO LINII</Text>
      <Text style={styles.stateHint}>{approachHint}</Text>
    </View>
  );
}

function OnLineReadyContent({ accuracyM }: { accuracyM: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.55, { duration: 1200 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.stateCenter}>
      <Animated.View style={[styles.armedDot, pulseStyle]} />
      <Text style={styles.readyTitle}>GOTOWY</Text>
      <Text style={styles.readyAccuracy}>±{accuracyM.toFixed(0)}m</Text>
      <Text style={styles.stateHint}>
        W punkcie startowym. Rusz kiedy gotowy — timer wystartuje sam.
      </Text>
    </View>
  );
}

function WrongSideContent({
  bearingExpected,
  headingActual,
  relativeArrowDeg,
}: {
  bearingExpected: number;
  headingActual: number;
  relativeArrowDeg: number;
}) {
  return (
    <View style={styles.stateCenter}>
      <View style={[styles.arrowWrap, { transform: [{ rotate: `${relativeArrowDeg}deg` }] }]}>
        <Text style={styles.arrowGlyph}>↑</Text>
      </View>
      <Text style={styles.wrongSideTitle}>OBRÓĆ SIĘ</Text>
      <Text style={styles.stateHint}>Rusz w kierunku trasy.</Text>
      <Text style={styles.stateMeta}>
        Zgodnie z trasą: {Math.round(bearingExpected)}° · Ty: {Math.round(headingActual)}°
      </Text>
    </View>
  );
}

function GpsUnsureContent({ accuracyM }: { accuracyM: number }) {
  return (
    <View style={styles.stateCenter}>
      <Text style={styles.gpsUnsureDots}>●○○</Text>
      <Text style={styles.gpsUnsureTitle}>GPS SŁABY</Text>
      <Text style={styles.stateHint}>Wyjdź na otwarte niebo. Poczekaj aż sygnał się ustabilizuje.</Text>
      <Text style={styles.stateMeta}>Dokładność: ±{accuracyM.toFixed(0)}m</Text>
    </View>
  );
}

// ── Main component ──

export const ApproachView = memo(function ApproachView({
  trailName,
  mode,
  state,
  userAccuracyM,
  userVelocityMps,
  userHeading,
  onBack,
}: ApproachViewProps) {
  // Haptic transitions — fire exactly once per state change into/out of
  // on_line_ready so the rider feels the "armed" moment and the "armed
  // lost" warning without constant vibration.
  const prevKindRef = useRef<ApproachState['kind'] | null>(null);
  useEffect(() => {
    const prev = prevKindRef.current;
    if (prev !== state.kind) {
      if (state.kind === 'on_line_ready' && prev !== null) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } else if (prev === 'on_line_ready' && state.kind !== 'on_line_ready') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      }
      prevKindRef.current = state.kind;
    }
  }, [state.kind]);

  const strength = gpsStrengthLabel(userAccuracyM);

  // Relative arrow direction: if we have user heading, rotate the arrow
  // glyph so it points at the absolute bearing-to-start from the rider's
  // current facing. Without heading we just use the absolute bearing
  // (north-up).
  const bearingForArrow =
    state.kind === 'far' || state.kind === 'near'
      ? state.bearingToStart
      : state.kind === 'wrong_side'
        ? state.bearingExpected
        : 0;
  const relativeArrowDeg = userHeading != null ? bearingForArrow - userHeading : bearingForArrow;

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onBack?.();
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.trailName} numberOfLines={1}>
          {trailName}
        </Text>
        <View style={[styles.modeBadge, mode === 'ranked' && styles.modeBadgeRanked]}>
          <Text
            style={[styles.modeBadgeText, mode === 'ranked' && styles.modeBadgeTextRanked]}
          >
            {mode === 'ranked' ? 'RANKING' : 'TRENING'}
          </Text>
        </View>
      </View>

      {/* State-specific body */}
      <View style={styles.body}>
        {state.kind === 'far' && (
          <FarContent distanceM={state.distanceM} relativeArrowDeg={relativeArrowDeg} />
        )}
        {state.kind === 'near' && (
          <NearContent
            distanceM={state.distanceM}
            headingDeltaDeg={state.headingDeltaDeg}
            relativeArrowDeg={relativeArrowDeg}
          />
        )}
        {state.kind === 'on_line_ready' && <OnLineReadyContent accuracyM={state.accuracyM} />}
        {state.kind === 'wrong_side' && (
          <WrongSideContent
            bearingExpected={state.bearingExpected}
            headingActual={state.headingActual}
            relativeArrowDeg={relativeArrowDeg}
          />
        )}
        {state.kind === 'gps_unsure' && <GpsUnsureContent accuracyM={state.accuracyM} />}
      </View>

      {/* Footer telemetry */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerDots}>{strength.dots}</Text>
          <Text style={styles.footerLabel}>GPS · {strength.label} · {formatAccuracy(userAccuracyM)}</Text>
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.footerMeta}>
            {formatVelocity(userVelocityMps)} · {formatBearing(userHeading)}
          </Text>
        </View>
      </View>

      {/* Back button */}
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Text style={styles.backLabel}>WRÓĆ</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

// ── Styles ──

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: chunk9Colors.bg.base,
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingTop: chunk9Spacing.sectionVertical,
    paddingBottom: chunk9Spacing.sectionVertical,
    gap: chunk9Spacing.sectionVertical,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: chunk9Spacing.cardChildGap,
  },
  trailName: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    flex: 1,
  },
  modeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
  },
  modeBadgeRanked: {
    // Emerald instance #1 (only when ranked mode)
    borderColor: chunk9Colors.accent.emerald,
  },
  modeBadgeText: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  modeBadgeTextRanked: {
    color: chunk9Colors.accent.emerald,
  },
  body: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  stateCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: chunk9Spacing.cardChildGap,
  },
  arrowWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlyph: {
    ...chunk9Typography.display56,
    color: chunk9Colors.text.primary,
    textAlign: 'center',
  },
  bigDistance: {
    ...chunk9Typography.display56,
    color: chunk9Colors.text.primary,
  },
  stateLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.secondary,
  },
  stateHint: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  stateMeta: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
    textAlign: 'center',
  },
  armedDot: {
    // Emerald instance #2 — only lives here when on_line_ready
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: chunk9Colors.accent.emerald,
  },
  readyTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.accent.emerald,
  },
  readyAccuracy: {
    ...chunk9Typography.stat19,
    color: chunk9Colors.text.primary,
  },
  wrongSideTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  gpsUnsureDots: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.tertiary,
  },
  gpsUnsureTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  footer: {
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: chunk9Colors.bg.hairline,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerDots: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
  },
  footerLabel: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  footerMeta: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
  },
  backButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  backLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.secondary,
  },
});
