// ═══════════════════════════════════════════════════════════
// Bootstrap — root entry point for nwd:/// and cold launch
// Resolves: onboarding → tabs routing before anything renders
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { useBetaFlow } from '@/hooks/useBetaFlow';

export default function BootstrapScreen() {
  const router = useRouter();
  const { needsOnboarding, loading } = useBetaFlow();

  useEffect(() => {
    if (loading) return;

    const target = needsOnboarding ? '/onboarding' : '/(tabs)';
    if (__DEV__) {
      console.log('[NWD:bootstrap]', { needsOnboarding, target });
    }
    router.replace(target);
  }, [loading, needsOnboarding]);

  // Dark blank screen while resolving — no flash
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
