// ═══════════════════════════════════════════════════════════
// /__dev/approach-preview — screenshot fixture for ApproachView
//
// Motivation: tapping through the ranked-run flow in the iOS Simulator
// is fussy and the simulator offers no control over GPS accuracy or
// heading, so reproducing all five ApproachState variants through the
// real flow for screenshot duty is unreliable. This dev-only route
// renders ApproachView directly against a hand-crafted state object so
// we can capture screenshots deterministically.
//
// Dev-only: component returns null in production (!__DEV__). Also lives
// under app/__dev so the Expo router group is visibly gated.
//
// Query: ?state=far|near|on_line_ready|wrong_side|gps_unsure
// ═══════════════════════════════════════════════════════════

import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ApproachView } from '@/components/run/ApproachView';
import type { ApproachState } from '@/features/run/approachNavigator';
import { colors } from '@/theme/colors';

// Local alias keeps the stylesheet body unchanged. Dev-only screen.
const chunk9Colors = {
  bg: { base: colors.bg },
} as const;

type Variant = 'far' | 'near' | 'on_line_ready' | 'wrong_side' | 'gps_unsure';

const FIXTURES: Record<Variant, {
  state: ApproachState;
  accuracy: number;
  velocity: number;
  heading: number | null;
}> = {
  far: {
    state: { kind: 'far', distanceM: 48, bearingToStart: 195 },
    accuracy: 4,
    velocity: 1.4,
    heading: 182,
  },
  near: {
    state: { kind: 'near', distanceM: 14, bearingToStart: 195, headingDeltaDeg: 22 },
    accuracy: 4,
    velocity: 1.2,
    heading: 173,
  },
  on_line_ready: {
    state: { kind: 'on_line_ready', accuracyM: 4 },
    accuracy: 4,
    velocity: 0.1,
    heading: 180,
  },
  wrong_side: {
    state: { kind: 'wrong_side', bearingExpected: 180, headingActual: 15 },
    accuracy: 4,
    velocity: 0.2,
    heading: 15,
  },
  gps_unsure: {
    state: { kind: 'gps_unsure', accuracyM: 14 },
    accuracy: 14,
    velocity: 0.0,
    heading: null,
  },
};

export default function ApproachPreview() {
  if (!__DEV__) return null;

  const router = useRouter();
  const params = useLocalSearchParams<{ state?: string; variant?: string; armed?: string }>();
  const variant = (params.state ?? 'far') as Variant;
  const fixture = FIXTURES[variant] ?? FIXTURES.far;
  // Chunk 10.1 B2 — ?variant=production hides the dev telemetry so we
  // can screenshot the simplified production layout. Default ('dev')
  // keeps all readouts for debugging.
  const approachVariant = params.variant === 'production' ? 'production' : 'dev';

  // Chunk 10.2 dead-end audit: previously onBack was a noop, leaving
  // the rider stuck on this route with no tab bar and no back button.
  // Now wires to router.back() with a replace-to-root fallback.
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Chunk 10.1 mini-map: production's ApproachView takes startPoint +
  // userPosition from the live gate config / GPS fix. The preview
  // fixture didn't pass either, so the map was silently empty.
  // Fake coords around Słotwiny so the map renders and we can verify
  // the marker + region-padding behaviour at screenshot time.
  const startPoint = { latitude: 49.6182, longitude: 20.4048 };
  const userPosition = { latitude: 49.6186, longitude: 20.4052 };

  // B21 preview wiring. `?armed=1` lets us screenshot the post-arm
  // copy ("UZBROJONY / Schowaj telefon i jedź") without going through
  // the real state machine. Default is pre-arm so the UZBRÓJ CTA is
  // what gets captured on the normal preview URL.
  const armed = params.variant === 'armed' || params.armed === '1';

  return (
    <SafeAreaView style={styles.container}>
      <ApproachView
        trailName="Parkowa"
        mode="ranked"
        state={fixture.state}
        userAccuracyM={fixture.accuracy}
        userVelocityMps={fixture.velocity}
        userHeading={fixture.heading}
        startPoint={startPoint}
        userPosition={userPosition}
        onArm={() => undefined}
        armed={armed}
        onBack={handleBack}
        variant={approachVariant}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: chunk9Colors.bg.base },
});
