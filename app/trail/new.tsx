// ═══════════════════════════════════════════════════════════
// /trail/new — 3-step Pioneer onboarding flow.
//
// Step 1: Info       — name + difficulty + trail_type.
// Step 2: Educator   — "Pionierujesz" copy block per handoff.
// Step 3: Calibrate  — create_trail then replace() to the
//                      canonical Pioneer recording route
//                      (/run/recording) via pickRunDestination.
//                      The freshly-created trail always starts
//                      in calibration_status='draft' so the
//                      helper unconditionally picks /run/recording;
//                      no pioneer flag needed.
//
// DB enum kept as-is per Blocker 2 decision (easy|medium|hard|expert
// × downhill|flow|tech|jump). Earlier handoff copy confused trail
// types (FLOW, TECH) with difficulty — we follow the DB shape.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GlowButton } from '@/components/ui/GlowButton';
import { FilterPill } from '@/components/ui/FilterPill';
import { useAuthContext } from '@/hooks/AuthContext';
import { useCreateTrail, useSpot } from '@/hooks/useBackend';
import { pickRunDestination } from '@/features/run/pickRunDestination';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type TrailType = 'downhill' | 'flow' | 'tech' | 'jump';

const DIFFICULTY_OPTIONS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Średni' },
  { key: 'hard', label: 'Trudny' },
  { key: 'expert', label: 'Expert' },
];

const TRAIL_TYPE_OPTIONS: { key: TrailType; label: string }[] = [
  { key: 'downhill', label: 'DH' },
  { key: 'flow', label: 'Flow' },
  { key: 'tech', label: 'Techniczny' },
  { key: 'jump', label: 'Jump' },
];

const NAME_MIN = 3;
const NAME_MAX = 60;

type Step = 1 | 2 | 3;

type Submission =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export default function NewTrailScreen() {
  const { spotId: rawSpotId } = useLocalSearchParams<{ spotId?: string }>();
  const spotId = rawSpotId ?? '';
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { submit } = useCreateTrail();
  const { spot, status: spotStatus } = useSpot(spotId || null);

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [trailType, setTrailType] = useState<TrailType | null>(null);
  const [submission, setSubmission] = useState<Submission>({ kind: 'idle' });
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }
    if (!spotId) {
      Alert.alert('Brak bike parku', 'Spróbuj ponownie z ekranu bike parku.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    // Bike park doesn't exist in DB (deleted / bad deep-link).
    // A pending park is fine — migration 20260423180000 lets the
    // submitter pioneer their own pending park, and RLS guarantees
    // that if we could fetch it we're either the submitter or a
    // curator. The RPC still guards the non-submitter / rejected
    // edge cases server-side.
    if (spotStatus === 'empty' || spotStatus === 'error') {
      Alert.alert(
        'Bike park nie dostępny',
        'Ten bike park został usunięty albo nie istnieje. Wybierz inny z listy.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/spots') }],
      );
      return;
    }
  }, [isAuthenticated, spotId, spotStatus, spot, router]);

  const trimmed = name.trim();
  const nameValid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
  const canAdvanceStep1 = nameValid && difficulty !== null && trailType !== null;

  const handleStart = useCallback(async () => {
    if (!canAdvanceStep1 || !difficulty || !trailType) return;
    tapMedium();
    setSubmission({ kind: 'submitting' });
    setNameError(null);

    const result = await submit({ spotId, name: trimmed, difficulty, trailType });

    if (result.ok) {
      notifySuccess();
      // Delegate the routing decision to pickRunDestination so the
      // educator flow and the spot/[id].tsx trail-card CTA can never
      // drift. A freshly-created trail is always calibration='draft'
      // -> /run/recording; the helper also keeps us honest if the
      // DB trigger ever stamps something different.
      router.replace(
        pickRunDestination({
          trailId: result.data.trailId,
          spotId,
          trailName: trimmed,
          calibrationStatus: 'draft',
          geometryMissing: true,
        }),
      );
      return;
    }

    notifyWarning();
    const message = result.message ?? 'Nie udało się utworzyć trasy';

    if (
      result.code === 'duplicate_name_in_spot' ||
      result.code === 'name_too_short' ||
      result.code === 'name_too_long'
    ) {
      setNameError(message);
      setSubmission({ kind: 'idle' });
      setStep(1);
      return;
    }
    if (result.code === 'spot_not_active') {
      Alert.alert('Bike park nieaktywny', message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
      setSubmission({ kind: 'idle' });
      return;
    }
    setSubmission({ kind: 'error', message });
  }, [canAdvanceStep1, difficulty, trailType, spotId, trimmed, submit, router]);

  // Render-path auth gate (Codex round 2 P2.2): the useEffect above
  // queues a router.replace('/auth') for anon riders, but the screen
  // still mounts + renders the trail form for one tick before the
  // replace lands. Skip the render entirely for anon so there's no
  // flash and no wasted mount/fetch cycle.
  if (!isAuthenticated) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Wróć">
            <Text style={styles.backLabel}>← Wróć</Text>
          </Pressable>
          <Text style={styles.title}>Dodaj trasę</Text>
          <StepDots step={step} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {submission.kind === 'submitting' ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.cardTitle}>Tworzę trasę…</Text>
            </View>
          ) : submission.kind === 'error' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nie udało się</Text>
              <Text style={styles.cardBody}>{submission.message}</Text>
              <GlowButton
                label="Spróbuj ponownie"
                variant="primary"
                onPress={() => setSubmission({ kind: 'idle' })}
              />
            </View>
          ) : step === 1 ? (
            <Step1
              name={name}
              onNameChange={(v) => { setName(v); if (nameError) setNameError(null); }}
              nameError={nameError}
              difficulty={difficulty}
              onDifficulty={setDifficulty}
              trailType={trailType}
              onTrailType={setTrailType}
            />
          ) : step === 2 ? (
            <Step2Educator name={trimmed} />
          ) : (
            <Step3Summary
              name={trimmed}
              difficulty={difficulty}
              trailType={trailType}
            />
          )}
        </ScrollView>

        {submission.kind === 'idle' ? (
          <View style={styles.footer}>
            {step === 1 ? (
              <GlowButton
                label="Dalej"
                variant="primary"
                disabled={!canAdvanceStep1}
                onPress={() => setStep(2)}
              />
            ) : step === 2 ? (
              <GlowButton label="Dalej" variant="primary" onPress={() => setStep(3)} />
            ) : (
              <GlowButton label="Zacznij zjazd" variant="primary" onPress={handleStart} />
            )}
            {step > 1 ? (
              <Pressable onPress={() => setStep((s) => (s - 1) as Step)} hitSlop={8} style={styles.backStep}>
                <Text style={styles.backStepLabel}>← Krok {step - 1}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3].map((n) => (
        <View key={n} style={[styles.dot, n === step && styles.dotActive]} />
      ))}
    </View>
  );
}

function Step1({
  name,
  onNameChange,
  nameError,
  difficulty,
  onDifficulty,
  trailType,
  onTrailType,
}: {
  name: string;
  onNameChange: (v: string) => void;
  nameError: string | null;
  difficulty: Difficulty | null;
  onDifficulty: (d: Difficulty) => void;
  trailType: TrailType | null;
  onTrailType: (t: TrailType) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>NAZWA TRASY</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={onNameChange}
        placeholder="np. Parkowa, Kopa DH"
        placeholderTextColor={colors.textTertiary}
        maxLength={NAME_MAX}
        autoFocus
      />
      {nameError ? <Text style={styles.errorText}>{nameError}</Text> : (
        <Text style={styles.hint}>{name.trim().length}/{NAME_MAX}</Text>
      )}

      <Text style={[styles.label, { marginTop: 20 }]}>POZIOM</Text>
      <View style={styles.pills}>
        {DIFFICULTY_OPTIONS.map((d) => (
          <FilterPill key={d.key} label={d.label} active={d.key === difficulty} onPress={() => onDifficulty(d.key)} />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>TYP TRASY</Text>
      <View style={styles.pills}>
        {TRAIL_TYPE_OPTIONS.map((t) => (
          <FilterPill key={t.key} label={t.label} active={t.key === trailType} onPress={() => onTrailType(t.key)} />
        ))}
      </View>
    </View>
  );
}

function Step2Educator({ name }: { name: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Pionierujesz.</Text>
      <Text style={styles.educatorBody}>
        Twój pierwszy zjazd zdefiniuje geometrię trasy{name ? ` «${name}»` : ''}.
      </Text>
      <Text style={styles.educatorBody}>
        Kolejni riderzy będą ścigać się po twojej linii.
      </Text>
      <View style={styles.educatorList}>
        <EducatorStep n={1} label="Telefon do kieszeni" />
        <EducatorStep n={2} label="Zjedź raz" />
        <EducatorStep n={3} label="Ranking gotowy" />
      </View>
    </View>
  );
}

function EducatorStep({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.educatorStep}>
      <Text style={styles.educatorStepIndex}>{n}</Text>
      <Text style={styles.educatorStepLabel}>{label}</Text>
    </View>
  );
}

function Step3Summary({
  name,
  difficulty,
  trailType,
}: {
  name: string;
  difficulty: Difficulty | null;
  trailType: TrailType | null;
}) {
  const difficultyLabel = DIFFICULTY_OPTIONS.find((d) => d.key === difficulty)?.label ?? '';
  const typeLabel = TRAIL_TYPE_OPTIONS.find((t) => t.key === trailType)?.label ?? '';
  return (
    <View style={styles.card}>
      <Text style={styles.label}>NAZWA</Text>
      <Text style={styles.value}>{name}</Text>
      <Text style={[styles.label, { marginTop: 16 }]}>POZIOM · TYP</Text>
      <Text style={styles.value}>{difficultyLabel} · {typeLabel}</Text>
      <Text style={[styles.label, { marginTop: 20 }]}>CO SIĘ TERAZ STANIE</Text>
      <Text style={styles.cardBody}>
        Aktywuję GPS i ekran zjazdu. Po przejechaniu trasa zostanie zapisana
        jako «W walidacji». Drugi rider ją potwierdzi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.pad,
    paddingVertical: spacing.lg,
    gap: 12,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  backLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.accent },
  scroll: {
    paddingHorizontal: spacing.pad,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: 8,
  },
  cardTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
    fontSize: 16,
  },
  hint: {
    ...typography.label,
    color: colors.textTertiary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  errorText: {
    ...typography.body,
    color: '#FF4D6D',
    marginTop: 4,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  educatorBody: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  educatorList: {
    marginTop: 12,
    gap: 10,
  },
  educatorStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  educatorStepIndex: {
    ...typography.title,
    color: colors.accent,
    width: 28,
    textAlign: 'center',
  },
  educatorStepLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: spacing.pad,
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  backStep: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  backStepLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
