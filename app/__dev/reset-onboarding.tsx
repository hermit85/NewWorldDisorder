// ═══════════════════════════════════════════════════════════
// /__dev/reset-onboarding — clears the onboarding done/gate flags
// in AsyncStorage and bounces to root. Lets us walk-test the v8
// onboarding repeatedly during polish without bumping CURRENT_BETA.
//
// Dev-only. Returns null in production.
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBetaFlow } from '@/hooks/useBetaFlow';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export default function ResetOnboardingScreen() {
  if (!__DEV__) return null;

  const router = useRouter();
  const { resetOnboarding } = useBetaFlow();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await resetOnboarding();
      if (cancelled) return;
      router.replace('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [resetOnboarding, router]);

  return (
    <View style={styles.root}>
      <Text style={styles.text}>Resetting onboarding…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.textSecondary,
  },
});
