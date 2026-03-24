// ═══════════════════════════════════════════════════════════
// Onboarding — game rules + beta context + location permission
// Feels like entering a league, not reading a manual
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { requestLocationPermission } from '@/systems/gps';
import { useBetaFlow } from '@/hooks/useBetaFlow';

interface OnboardingStep {
  tag: string;
  title: string;
  body: string;
  icon: string;
}

const steps: OnboardingStep[] = [
  {
    tag: 'THE GAME',
    title: 'Ride real trails.\nEnter the league.',
    body: 'NWD turns real downhill trails into a competitive racing game. Your mountain. Your time. Your rank.',
    icon: '⛰️',
  },
  {
    tag: 'THE ARENA',
    title: 'Choose your line\nfrom the map.',
    body: 'Each trail is a race line. Tap to select. Check the stats. Hit Start Run.',
    icon: '🗺️',
  },
  {
    tag: 'RANKED RUNS',
    title: 'Only verified\nruns count.',
    body: 'Start at the gate. Stay on line. Finish strong. The system checks your route — only clean runs enter the board.',
    icon: '✓',
  },
  {
    tag: 'PRACTICE',
    title: 'Practice anything.\nRank what\'s trusted.',
    body: 'Weak signal? Wrong gate? No problem — ride practice. Your time still matters to you. Just not to the league.',
    icon: '○',
  },
  {
    tag: 'CLOSED BETA',
    title: 'You\'re early.\nHelp us build this.',
    body: 'This is a closed test build. GPS and verification are still improving. Your runs and feedback shape the league. Ride hard, report issues, own the board.',
    icon: '🔒',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useBetaFlow();
  const [step, setStep] = useState(0);
  const [permissionAsked, setPermissionAsked] = useState(false);

  const isLastContentStep = step === steps.length - 1;
  const isPermissionStep = step === steps.length;

  const handleFinish = useCallback(async () => {
    await completeOnboarding();
    router.replace('/(tabs)');
  }, [completeOnboarding, router]);

  const handleNext = useCallback(async () => {
    if (isPermissionStep) {
      await handleFinish();
      return;
    }
    if (isLastContentStep) {
      setStep(steps.length); // permission step
      return;
    }
    setStep((s) => s + 1);
  }, [step, isLastContentStep, isPermissionStep, handleFinish]);

  const handleRequestPermission = useCallback(async () => {
    await requestLocationPermission();
    setPermissionAsked(true);
  }, []);

  const currentStep = steps[step];
  const totalSteps = steps.length + 1;

  // Permission screen
  if (isPermissionStep) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.tag}>LOCATION</Text>
          <Text style={styles.stepIcon}>📍</Text>
          <Text style={styles.title}>We need your{'\n'}location.</Text>
          <Text style={styles.body}>
            NWD uses GPS to track your runs, verify your route, and detect start/finish gates. Without location, only practice mode works.
          </Text>

          {!permissionAsked ? (
            <Pressable style={styles.permBtn} onPress={handleRequestPermission}>
              <Text style={styles.permBtnText}>ALLOW LOCATION</Text>
            </Pressable>
          ) : (
            <View style={styles.permGranted}>
              <Text style={styles.permGrantedText}>✓ LOCATION ENABLED</Text>
            </View>
          )}

          <Pressable style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>
              {permissionAsked ? 'ENTER THE LEAGUE' : 'SKIP FOR NOW'}
            </Text>
          </Pressable>
        </View>
        <ProgressDots total={totalSteps} current={step} />
      </SafeAreaView>
    );
  }

  // Content steps
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.tag}>{currentStep.tag}</Text>
        <Text style={styles.stepIcon}>{currentStep.icon}</Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>
      </View>

      <View style={styles.footer}>
        <ProgressDots total={totalSteps} current={step} />

        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {isLastContentStep ? 'ALMOST THERE' : 'NEXT'}
          </Text>
        </Pressable>

        {step === 0 && (
          <Pressable style={styles.skipBtn} onPress={handleFinish}>
            <Text style={styles.skipText}>SKIP — I KNOW THE RULES</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            i < current && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  tag: {
    ...typography.labelSmall,
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: spacing.lg,
  },
  stepIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 40,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  dotDone: {
    backgroundColor: colors.textTertiary,
  },
  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  nextBtnText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 3,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  permBtn: {
    backgroundColor: colors.blue,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  permBtnText: {
    ...typography.cta,
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  permGranted: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  permGrantedText: {
    ...typography.cta,
    color: colors.accent,
    letterSpacing: 2,
  },
});
