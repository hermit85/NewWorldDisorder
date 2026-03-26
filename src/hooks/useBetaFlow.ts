// ═══════════════════════════════════════════════════════════
// Beta Flow — manages first-launch, onboarding, auth routing
// Ensures testers go through the right sequence
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  onboardingDone: 'nwd_onboarding_done',
  betaVersion: 'nwd_beta_version',
};

// Bump this to force re-onboarding after onboarding content changes.
// 0.3.0 = pre-Sprint 26A old onboarding
// 0.4.0 = Sprint 26A+ race game intro rewrite
const CURRENT_BETA = '0.4.0';

export function useBetaFlow() {
  const [state, setState] = useState<{
    loading: boolean;
    needsOnboarding: boolean;
    isFirstLaunch: boolean;
  }>({ loading: true, needsOnboarding: false, isFirstLaunch: false });

  useEffect(() => {
    checkState();
  }, []);

  const checkState = async () => {
    try {
      const [onboardingDone, betaVersion] = await Promise.all([
        AsyncStorage.getItem(KEYS.onboardingDone),
        AsyncStorage.getItem(KEYS.betaVersion),
      ]);

      const isFirstLaunch = !betaVersion;
      const needsOnboarding = !onboardingDone || betaVersion !== CURRENT_BETA;

      if (__DEV__) {
        console.log('[NWD:betaFlow]', { onboardingDone, betaVersion, CURRENT_BETA, needsOnboarding, isFirstLaunch });
      }

      setState({ loading: false, needsOnboarding, isFirstLaunch });
    } catch {
      setState({ loading: false, needsOnboarding: true, isFirstLaunch: true });
    }
  };

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.onboardingDone, 'true');
    await AsyncStorage.setItem(KEYS.betaVersion, CURRENT_BETA);
    setState((s) => ({ ...s, needsOnboarding: false }));
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(KEYS.onboardingDone);
    setState((s) => ({ ...s, needsOnboarding: true }));
  }, []);

  return { ...state, completeOnboarding, resetOnboarding };
}
