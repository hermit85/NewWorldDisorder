// ═══════════════════════════════════════════════════════════
// Bootstrap — root entry point for nwd:/// and cold launch
// Resolves: env check → onboarding → tabs
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useNavigationContainerRef } from 'expo-router';
import { useBetaFlow } from '@/hooks/useBetaFlow';
import { useAuthContext } from '@/hooks/AuthContext';
import { isProductionMisconfigured } from '@/hooks/useBackend';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export default function BootstrapScreen() {
  const router = useRouter();
  const rootNav = useNavigationContainerRef();
  const { needsOnboarding, loading: betaLoading } = useBetaFlow();
  const { isAuthenticated, isLoading: authLoading } = useAuthContext();

  useEffect(() => {
    // Production without env vars = hard stop, don't enter app
    if (isProductionMisconfigured) return;
    // Wait for both gates: onboarding-version check AND Supabase
    // session resolution. Routing on partial state would land an
    // onboarded-but-signed-out rider in /(tabs) for one render and
    // rely on per-screen redirects to kick them out — that's the
    // failure mode that produced the build-47 boot crash chain.
    if (betaLoading || authLoading) return;

    const navigate = () => {
      let target: string;
      if (needsOnboarding) target = '/onboarding';
      else if (!isAuthenticated) target = '/auth';
      else target = '/(tabs)';
      if (__DEV__) {
        console.log('[NWD:bootstrap]', { needsOnboarding, isAuthenticated, target });
      }
      router.replace(target);
    };

    if (rootNav?.isReady()) {
      navigate();
    } else {
      const interval = setInterval(() => {
        if (rootNav?.isReady()) {
          clearInterval(interval);
          navigate();
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [betaLoading, authLoading, needsOnboarding, isAuthenticated]);

  // Production misconfig: blocking error surface
  if (isProductionMisconfigured) {
    return (
      <View style={blockStyles.container}>
        <Text style={blockStyles.title}>NWD</Text>
        <Text style={blockStyles.message}>
          Logowanie jest chwilowo niedostępne.{'\n'}Spróbuj ponownie później.
        </Text>
      </View>
    );
  }

  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}

const blockStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  title: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: 8,
    marginBottom: spacing.xl,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
