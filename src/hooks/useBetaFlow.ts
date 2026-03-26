// ═══════════════════════════════════════════════════════════
// Beta Flow — manages first-launch, onboarding, auth routing
// Ensures testers go through the right sequence
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  onboardingDone: 'nwd_onboarding_done',
  gateCompleted: 'nwd_gate_completed',
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
      const [onboardingDone, gateCompleted, betaVersion] = await Promise.all([
        AsyncStorage.getItem(KEYS.onboardingDone),
        AsyncStorage.getItem(KEYS.gateCompleted),
        AsyncStorage.getItem(KEYS.betaVersion),
      ]);

      const isFirstLaunch = !betaVersion;
      // Both slides AND gate must be completed for onboarding to be done
      const needsOnboarding = !onboardingDone || !gateCompleted || betaVersion !== CURRENT_BETA;

      if (__DEV__) {
        console.log('[NWD:betaFlow]', { onboardingDone, betaVersion, CURRENT_BETA, needsOnboarding, isFirstLaunch });
      }

      setState({ loading: false, needsOnboarding, isFirstLaunch });
    } catch {
      setState({ loading: false, needsOnboarding: true, isFirstLaunch: true });
    }
  };

  /** Mark slides as viewed (before GPS gate) — NOT full completion */
  const completeSlidesOnly = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.onboardingDone, 'true');
  }, []);

  /** Mark full onboarding done (after GPS gate dismiss/accept) */
  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.onboardingDone, 'true');
    await AsyncStorage.setItem(KEYS.gateCompleted, 'true');
    await AsyncStorage.setItem(KEYS.betaVersion, CURRENT_BETA);
    setState((s) => ({ ...s, needsOnboarding: false }));
  }, []);

  const resetOnboarding = useCallback(async () => {
    await AsyncStorage.removeItem(KEYS.onboardingDone);
    await AsyncStorage.removeItem(KEYS.gateCompleted);
    setState((s) => ({ ...s, needsOnboarding: true }));
  }, []);

  return { ...state, completeSlidesOnly, completeOnboarding, resetOnboarding };
}
