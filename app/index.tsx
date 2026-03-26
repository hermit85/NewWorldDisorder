// ═══════════════════════════════════════════════════════════
// Bootstrap — root entry point for nwd:/// and cold launch
// Resolves: onboarding → tabs routing before anything renders
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useNavigationContainerRef } from 'expo-router';
import { useBetaFlow } from '@/hooks/useBetaFlow';

export default function BootstrapScreen() {
  const router = useRouter();
  const rootNav = useNavigationContainerRef();
  const { needsOnboarding, loading } = useBetaFlow();

  useEffect(() => {
    if (loading) return;

    // Wait for navigation container to be ready before routing
    const navigate = () => {
      const target = needsOnboarding ? '/onboarding' : '/(tabs)';
      if (__DEV__) {
        console.log('[NWD:bootstrap]', { needsOnboarding, target, navReady: rootNav?.isReady() });
      }
      router.replace(target);
    };

    if (rootNav?.isReady()) {
      navigate();
    } else {
      // Poll until ready (usually resolves in <100ms)
      const interval = setInterval(() => {
        if (rootNav?.isReady()) {
          clearInterval(interval);
          navigate();
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [loading, needsOnboarding]);

  return <View style={{ flex: 1, backgroundColor: '#0A0A0F' }} />;
}
