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

import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet } from 'react-native';
import { ApproachView } from '@/components/run/ApproachView';
import type { ApproachState } from '@/features/run/approachNavigator';
import { chunk9Colors } from '@/theme/chunk9';

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

  const params = useLocalSearchParams<{ state?: string; variant?: string }>();
  const variant = (params.state ?? 'far') as Variant;
  const fixture = FIXTURES[variant] ?? FIXTURES.far;
  // Chunk 10.1 B2 — ?variant=production hides the dev telemetry so we
  // can screenshot the simplified production layout. Default ('dev')
  // keeps all readouts for debugging.
  const approachVariant = params.variant === 'production' ? 'production' : 'dev';

  return (
    <SafeAreaView style={styles.container}>
      <ApproachView
        trailName="Parkowa"
        mode="ranked"
        state={fixture.state}
        userAccuracyM={fixture.accuracy}
        userVelocityMps={fixture.velocity}
        userHeading={fixture.heading}
        onBack={() => undefined}
        variant={approachVariant}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: chunk9Colors.bg.base },
});
