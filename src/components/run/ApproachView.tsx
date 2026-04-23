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

import { memo, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
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

export type LatLng = { latitude: number; longitude: number };

export interface ApproachViewProps {
  trailName: string;
  mode: 'ranked' | 'training';
  state: ApproachState;
  /** Raw user accuracy in meters (for footer strength badge). */
  userAccuracyM: number;
  /** Raw user speed in m/s. Only rendered in 'dev' variant. */
  userVelocityMps: number;
  /** Raw user heading [0,360) or null. Only rendered in 'dev' variant. */
  userHeading: number | null;
  /** Start gate coordinates. When set together with userPosition a mini
   *  map renders above the state content so the rider can see where the
   *  line is rather than relying on compass + distance alone. */
  startPoint?: LatLng | null;
  /** Rider's current position — rendered as the second marker on the map. */
  userPosition?: LatLng | null;
  onBack?: () => void;
  /**
   * 'production' (default) hides technical readouts per Chunk 10.1 B2 —
   * the rider gets a single GPS-strength footer. 'dev' keeps the full
   * telemetry for the screenshot preview route and future debug HUD.
   */
  variant?: 'production' | 'dev';
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

function OnLineReadyContent({
  accuracyM,
  mode,
}: {
  accuracyM: number;
  mode: 'ranked' | 'training';
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.55, { duration: 1200 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // D1+D2: gate engine auto-starts the timer in both ranked and training
  // modes (running_practice is now a first-class phase too). Tap is
  // retained in training as a manual fallback when the gate doesn't
  // trigger, and that's still useful hint copy — but the default promise
  // is "it will start itself".
  const hint =
    mode === 'ranked'
      ? 'W punkcie startowym. Rusz kiedy gotowy — timer wystartuje sam.'
      : 'W punkcie startowym. Timer wystartuje sam — dotknij jeśli nie zareaguje.';

  return (
    <View style={styles.stateCenter}>
      <Animated.View style={[styles.armedDot, pulseStyle]} />
      <Text style={styles.readyTitle}>GOTOWY</Text>
      <Text style={styles.readyAccuracy}>±{accuracyM.toFixed(0)}m</Text>
      <Text style={styles.stateHint}>{hint}</Text>
    </View>
  );
}

// ── Start-point mini map ──
//
// Small non-interactive map rendered above the state content so the rider
// can see *where* the start line is rather than navigating by compass +
// distance alone. Centered on the midpoint of start ↔ user with a region
// padded to the larger of the two axes plus a 2× margin, so both markers
// stay comfortably inside the viewport no matter the approach direction.

const MIN_LATITUDE_DELTA = 0.0015; // ≈ 160m at 49° lat — tight enough for on-line state
const MAP_PADDING_FACTOR = 2.4;

function StartPointMap({
  startPoint,
  userPosition,
}: {
  startPoint: LatLng;
  userPosition: LatLng | null;
}) {
  const region = useMemo(() => {
    if (!userPosition) {
      return {
        latitude: startPoint.latitude,
        longitude: startPoint.longitude,
        latitudeDelta: MIN_LATITUDE_DELTA,
        longitudeDelta: MIN_LATITUDE_DELTA,
      };
    }
    const midLat = (startPoint.latitude + userPosition.latitude) / 2;
    const midLng = (startPoint.longitude + userPosition.longitude) / 2;
    const latSpan = Math.abs(startPoint.latitude - userPosition.latitude);
    const lngSpan = Math.abs(startPoint.longitude - userPosition.longitude);
    const latitudeDelta = Math.max(MIN_LATITUDE_DELTA, latSpan * MAP_PADDING_FACTOR);
    const longitudeDelta = Math.max(MIN_LATITUDE_DELTA, lngSpan * MAP_PADDING_FACTOR);
    return { latitude: midLat, longitude: midLng, latitudeDelta, longitudeDelta };
  }, [startPoint, userPosition]);

  return (
    <View style={styles.mapWrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        pointerEvents="none"
        liteMode={Platform.OS === 'android'}
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={startPoint}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.startMarker}>
            <Text style={styles.startMarkerText}>S</Text>
          </View>
        </Marker>
        {userPosition ? (
          <Marker
            coordinate={userPosition}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.userMarkerOuter}>
              <View style={styles.userMarkerInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

function WrongSideContent({
  bearingExpected,
  headingActual,
  relativeArrowDeg,
  showTelemetry,
}: {
  bearingExpected: number;
  headingActual: number;
  relativeArrowDeg: number;
  showTelemetry: boolean;
}) {
  return (
    <View style={styles.stateCenter}>
      <View style={[styles.arrowWrap, { transform: [{ rotate: `${relativeArrowDeg}deg` }] }]}>
        <Text style={styles.arrowGlyph}>↑</Text>
      </View>
      <Text style={styles.wrongSideTitle}>OBRÓĆ SIĘ</Text>
      <Text style={styles.stateHint}>Rusz w kierunku trasy.</Text>
      {showTelemetry ? (
        <Text style={styles.stateMeta}>
          Zgodnie z trasą: {Math.round(bearingExpected)}° · Ty: {Math.round(headingActual)}°
        </Text>
      ) : null}
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
  startPoint,
  userPosition,
  onBack,
  variant = 'production',
}: ApproachViewProps) {
  const showTelemetry = variant === 'dev';
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
      {/* Header — B2: drop the TRENING badge. RANKING is the only
          mode that signals "this counts" so only it earns pill chrome;
          training mode is implicit from the absence of the badge. */}
      <View style={styles.header}>
        <Text style={styles.trailName} numberOfLines={1}>
          {trailName}
        </Text>
        {mode === 'ranked' ? (
          <View style={[styles.modeBadge, styles.modeBadgeRanked]}>
            <Text style={[styles.modeBadgeText, styles.modeBadgeTextRanked]}>RANKING</Text>
          </View>
        ) : null}
      </View>

      {/* Start-point map — renders only when we have a start gate + at
          least a user fix. Sits above the state content so "where am I
          vs. where's the line" is visible at a glance. Web falls back
          to nothing because react-native-maps has no web target. */}
      {startPoint && Platform.OS !== 'web' ? (
        <StartPointMap startPoint={startPoint} userPosition={userPosition ?? null} />
      ) : null}

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
        {state.kind === 'on_line_ready' && (
          <OnLineReadyContent accuracyM={state.accuracyM} mode={mode} />
        )}
        {state.kind === 'wrong_side' && (
          <WrongSideContent
            bearingExpected={state.bearingExpected}
            headingActual={state.headingActual}
            relativeArrowDeg={relativeArrowDeg}
            showTelemetry={showTelemetry}
          />
        )}
        {state.kind === 'gps_unsure' && <GpsUnsureContent accuracyM={state.accuracyM} />}
      </View>

      {/* Footer — B2: production collapses to dots + accuracy only.
          Spec v3 §2.2 closed with "●●● ±4M footer minimal". Velocity
          + heading stay in the dev preview for diagnostic use. */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerDots}>{strength.dots}</Text>
          <Text style={styles.footerLabel}>{formatAccuracy(userAccuracyM)}</Text>
        </View>
        {showTelemetry ? (
          <View style={styles.footerRow}>
            <Text style={styles.footerMeta}>
              GPS · {strength.label} · {formatVelocity(userVelocityMps)} · {formatBearing(userHeading)}
            </Text>
          </View>
        ) : null}
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
  mapWrap: {
    height: 180,
    borderRadius: chunk9Radii.card,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    overflow: 'hidden',
  },
  startMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: chunk9Colors.accent.emerald,
    borderWidth: 2,
    borderColor: chunk9Colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startMarkerText: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.bg.base,
    fontWeight: '700',
  },
  userMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(80, 140, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4A9EFF',
    borderWidth: 2,
    borderColor: chunk9Colors.bg.base,
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
