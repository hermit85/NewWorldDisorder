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
import * as Haptics from 'expo-haptics';
import { Btn, PageTitle, Pill, SectionHead, TopBar } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { useCreateTrail, useSpot, useSpotTrails } from '@/hooks/useBackend';
import type { CreateTrailSuggestion, SpotTrailSummary } from '@/lib/api';
import { pickRunDestination } from '@/features/run/pickRunDestination';
import { notifySuccess, notifyWarning, tapLight, tapMedium } from '@/systems/haptics';
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

// Step 0 = ADR-012 Phase 1.4 listing of existing trails ("Czy ta trasa
// już istnieje?"). Steps 1–3 are the legacy info / educator / summary
// flow that fires only after the rider says "to inna trasa, jadę pierwszy".
type Step = 0 | 1 | 2 | 3;

type Submission =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'duplicate_hard'; existing: CreateTrailSuggestion }
  | { kind: 'duplicate_soft'; suggestions: CreateTrailSuggestion[] }
  | { kind: 'error'; message: string };

export default function NewTrailScreen() {
  const { spotId: rawSpotId } = useLocalSearchParams<{ spotId?: string }>();
  const spotId = rawSpotId ?? '';
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { submit } = useCreateTrail();
  const { spot, status: spotStatus } = useSpot(spotId || null);

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [trailType, setTrailType] = useState<TrailType | null>(null);
  const [submission, setSubmission] = useState<Submission>({ kind: 'idle' });
  const [nameError, setNameError] = useState<string | null>(null);
  // ADR-012 Phase 1.4: rider re-confirms "to inna trasa" after the
  // Smart Suggest dialog. The next submit call passes forceCreate=true
  // so the duplicate_base_key check is bypassed (hard normalized_name
  // unique stays enforced server-side).
  const [forceNextCreate, setForceNextCreate] = useState(false);

  const { trails: existingTrails, loading: existingLoading } = useSpotTrails(spotId || null);

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

    const result = await submit({
      spotId,
      name: trimmed,
      difficulty,
      trailType,
      forceCreate: forceNextCreate,
    });
    // forceCreate is single-use; clear it for any subsequent edit
    // cycle. If the call still failed (different reason), the rider
    // explicitly re-acknowledges the soft warn before the next try.
    if (forceNextCreate) setForceNextCreate(false);

    if (result.ok) {
      notifySuccess();
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

    if (result.code === 'duplicate_name_in_spot' && 'existing' in result) {
      // Hard normalized_name collision — surface the existing trail
      // so the rider can route straight to it.
      setSubmission({ kind: 'duplicate_hard', existing: result.existing });
      return;
    }

    if (result.code === 'name_suggests_existing' && 'suggestions' in result) {
      // Soft duplicate_base_key warn — Smart Suggest dialog with
      // "OTWÓRZ" / "TO INNA TRASA" / "WRÓĆ I POPRAW".
      setSubmission({ kind: 'duplicate_soft', suggestions: result.suggestions });
      return;
    }

    if (
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
  }, [canAdvanceStep1, difficulty, trailType, spotId, trimmed, submit, router, forceNextCreate]);

  const handleConfirmDifferentTrail = useCallback(() => {
    // Rider clicked "TO NAPRAWDĘ INNA TRASA" in the Smart Suggest
    // dialog. Set force flag and re-fire submit. We do NOT reset
    // submission to 'idle' first because handleStart will do it
    // immediately ('submitting'); jumping to idle would briefly
    // render Step 3 again.
    setForceNextCreate(true);
    void handleStart();
  }, [handleStart]);

  const handleOpenExistingTrail = useCallback(
    (trailId: string) => {
      tapLight();
      router.replace({ pathname: '/trail/[id]', params: { id: trailId } });
    },
    [router],
  );

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
          <TopBar
            onBack={() => router.back()}
            trailing={step > 0 ? <StepDots step={step} /> : null}
          />
          <PageTitle
            title={step === 0 ? 'Trasy w tym parku' : 'Dodaj trasę'}
            subtitle={
              step === 0
                ? 'Wybierz istniejącą trasę albo dodaj nową, jeśli jej nie ma na liście.'
                : null
            }
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {submission.kind === 'submitting' ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.cardTitle}>Tworzę trasę…</Text>
            </View>
          ) : submission.kind === 'duplicate_hard' ? (
            <HardDuplicateCard
              existing={submission.existing}
              onOpen={() => handleOpenExistingTrail(submission.existing.trailId)}
              onBackToEdit={() => {
                setSubmission({ kind: 'idle' });
                setStep(1);
              }}
            />
          ) : submission.kind === 'duplicate_soft' ? (
            <SmartSuggestCard
              suggestions={submission.suggestions}
              onOpen={(trailId) => handleOpenExistingTrail(trailId)}
              onConfirmDifferent={handleConfirmDifferentTrail}
              onBackToEdit={() => {
                setSubmission({ kind: 'idle' });
                setStep(1);
              }}
            />
          ) : submission.kind === 'error' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nie udało się</Text>
              <Text style={styles.cardBody}>{submission.message}</Text>
              <Btn variant="primary" onPress={() => setSubmission({ kind: 'idle' })}>
                Spróbuj ponownie
              </Btn>
            </View>
          ) : step === 0 ? (
            <Step0Existing
              trails={existingTrails}
              loading={existingLoading}
              onRideExisting={handleOpenExistingTrail}
            />
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
            {step === 0 ? (
              <Btn variant="primary" onPress={() => setStep(1)}>
                + Dodaj nową trasę
              </Btn>
            ) : step === 1 ? (
              <Btn variant="primary" disabled={!canAdvanceStep1} onPress={() => setStep(2)}>
                Dalej
              </Btn>
            ) : step === 2 ? (
              <Btn variant="primary" onPress={() => setStep(3)}>Dalej</Btn>
            ) : (
              <Btn variant="primary" onPress={handleStart}>Zacznij zjazd</Btn>
            )}
            {step > 0 ? (
              <Pressable
                onPress={() => setStep((s) => (s === 1 ? 0 : (s - 1)) as Step)}
                hitSlop={8}
                style={styles.backStep}
              >
                <Text style={styles.backStepLabel}>
                  {step === 1 ? '← Wróć do listy' : `← Krok ${step - 1}`}
                </Text>
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
        {DIFFICULTY_OPTIONS.map((d) => {
          const active = d.key === difficulty;
          return (
            <Pressable
              key={d.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onDifficulty(d.key);
              }}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {d.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>TYP TRASY</Text>
      <View style={styles.pills}>
        {TRAIL_TYPE_OPTIONS.map((t) => {
          const active = t.key === trailType;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onTrailType(t.key);
              }}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {t.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
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

// ─── ADR-012 Phase 1.4 — Step 0 listing + duplicate dialogs ───

function Step0Existing({
  trails,
  loading,
  onRideExisting,
}: {
  trails: SpotTrailSummary[];
  loading: boolean;
  onRideExisting: (trailId: string) => void;
}) {
  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.cardBody}>Ładuję trasy w tym parku…</Text>
      </View>
    );
  }

  if (trails.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pionierski park</Text>
        <Text style={styles.cardBody}>
          Nikt jeszcze nie dodał tu trasy. Dodaj pierwszą — będziesz Pionierem.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <SectionHead label="Trasy w tym parku" count={trails.length} />
      {trails.map((t) => (
        <ExistingTrailCard key={t.trailId} trail={t} onRide={() => onRideExisting(t.trailId)} />
      ))}
    </View>
  );
}

function ExistingTrailCard({
  trail,
  onRide,
}: {
  trail: SpotTrailSummary;
  onRide: () => void;
}) {
  // Trust tier dictates the Pill state. Provisional trails (most
  // post-pioneer rows) read 'pending'; verified reads 'verified'.
  // Disputed reads 'invalid'. Anything else stays neutral.
  const pillState =
    trail.trustTier === 'verified'
      ? 'verified'
      : trail.trustTier === 'disputed'
      ? 'invalid'
      : trail.trustTier === 'provisional'
      ? 'pending'
      : 'neutral';
  const pillLabel =
    trail.trustTier === 'verified'
      ? 'Zweryfikowana'
      : trail.trustTier === 'disputed'
      ? 'Spór'
      : trail.trustTier === 'provisional'
      ? 'Próbna'
      : 'Draft';

  const difficultyLabel =
    DIFFICULTY_OPTIONS.find((d) => d.key === trail.difficulty)?.label ?? trail.difficulty;
  const typeLabel =
    TRAIL_TYPE_OPTIONS.find((t) => t.key === trail.trailType)?.label ?? trail.trailType;

  return (
    <View style={styles.card}>
      <View style={styles.existingHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{trail.officialName}</Text>
        <Pill state={pillState} size="sm">{pillLabel}</Pill>
      </View>
      <Text style={styles.cardBody}>
        {difficultyLabel} · {typeLabel}
        {trail.runsContributed > 0 ? ` · ${trail.runsContributed} zjazdów` : ''}
        {trail.pioneerUsername ? ` · Pionier: ${trail.pioneerUsername}` : ''}
      </Text>
      <View style={styles.existingActions}>
        <View style={{ flex: 1 }}>
          <Btn variant="primary" onPress={onRide}>Jedź</Btn>
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Btn variant="ghost" disabled onPress={() => undefined}>
            Popraw linię
          </Btn>
        </View>
      </View>
    </View>
  );
}

function HardDuplicateCard({
  existing,
  onOpen,
  onBackToEdit,
}: {
  existing: CreateTrailSuggestion;
  onOpen: () => void;
  onBackToEdit: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Ta trasa już istnieje</Text>
      <Text style={styles.cardBody}>
        W tym parku jest już «{existing.officialName}». Możesz na nią wskoczyć
        zamiast tworzyć nową.
      </Text>
      <Btn variant="primary" onPress={onOpen}>
        Otwórz {existing.officialName}
      </Btn>
      <View style={{ height: 8 }} />
      <Btn variant="ghost" onPress={onBackToEdit}>
        Wróć i popraw nazwę
      </Btn>
    </View>
  );
}

function SmartSuggestCard({
  suggestions,
  onOpen,
  onConfirmDifferent,
  onBackToEdit,
}: {
  suggestions: CreateTrailSuggestion[];
  onOpen: (trailId: string) => void;
  onConfirmDifferent: () => void;
  onBackToEdit: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Wygląda jak istniejąca trasa</Text>
      <Text style={styles.cardBody}>
        W tym parku jest już:
      </Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        {suggestions.map((s) => (
          <Pressable
            key={s.trailId}
            onPress={() => onOpen(s.trailId)}
            style={({ pressed }) => [
              styles.suggestionRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.suggestionName} numberOfLines={1}>
              {s.officialName}
            </Text>
            <Text style={styles.suggestionAction}>OTWÓRZ →</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ height: 14 }} />
      <Btn variant="ghost" onPress={onConfirmDifferent}>
        To naprawdę inna trasa
      </Btn>
      <View style={{ height: 8 }} />
      <Btn variant="ghost" onPress={onBackToEdit}>
        Wróć i popraw nazwę
      </Btn>
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
    gap: 8,
  },
  filter: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  filterLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: colors.bg,
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
  existingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  existingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 12,
  },
  suggestionName: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 16,
    flex: 1,
  },
  suggestionAction: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
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
