// ═══════════════════════════════════════════════════════════
// /spot/new — 3-step bike-park submission flow.
//
// Step 1: Name + voivodeship picker (required).
// Step 2: Short description (optional, skippable, 280 chars).
// Step 3: Confirm. Uses regional-capital coords as placeholder
//         per spec v1.1 §1 + handoff A4 — exact coordinates
//         resolve after the first Pioneer run snaps geometry.
//
// submit_spot signature extended in migration chunk_10_1_extend_
// submit_spot_region_description; the wrapper forwards p_region
// and p_description with '' defaults so older callers still work.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Btn, PageTitle, TopBar } from '@/components/nwd';
import { findVoivodeship, VOIVODESHIPS } from '@/data/voivodeships';
import { useAuthContext } from '@/hooks/AuthContext';
import { triggerRefresh } from '@/hooks/useRefresh';
import { submitSpotWithQueue } from '@/services/spotSubmission';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

const NAME_MIN = 3;
const NAME_MAX = 50;
const DESCRIPTION_MAX = 280;

type Step = 1 | 2 | 3;

type Submission =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; spotId: string | null; queued: boolean }
  | { kind: 'duplicate'; nearSpotId: string; nearSpotName: string; distanceM: number }
  | { kind: 'error'; message: string };

export default function NewSpotScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submission, setSubmission] = useState<Submission>({ kind: 'idle' });

  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, router]);

  const trimmedName = name.trim();
  const canAdvanceStep1 = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX && regionId !== null;
  const voivodeship = regionId ? findVoivodeship(regionId) : null;

  async function handleSubmit() {
    if (!voivodeship) return;
    tapMedium();
    setSubmission({ kind: 'submitting' });
    const res = await submitSpotWithQueue({
      name: trimmedName,
      lat: voivodeship.lat,
      lng: voivodeship.lng,
      region: voivodeship.id,
      description: description.trim(),
    });

    if (res.ok) {
      notifySuccess();
      triggerRefresh();
      setSubmission({ kind: 'success', spotId: res.spotId, queued: res.queued });
      return;
    }

    if (res.code === 'duplicate_nearby') {
      notifyWarning();
      setSubmission({
        kind: 'duplicate',
        nearSpotId: (res.extra?.nearSpotId as string) ?? '',
        nearSpotName: (res.extra?.nearSpotName as string) ?? '',
        distanceM: (res.extra?.distanceM as number) ?? 0,
      });
      return;
    }

    notifyWarning();
    setSubmission({ kind: 'error', message: res.code === 'rpc_error' ? 'Nie udało się wysłać' : res.code });
  }

  function handleReset() {
    setSubmission({ kind: 'idle' });
  }

  function handleClose() {
    router.replace('/(tabs)/spots');
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TopBar
            onBack={() => router.back()}
            trailing={<StepDots step={step} />}
          />
          <PageTitle title="Dodaj bike park" />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {submission.kind === 'submitting' ? (
            <View style={styles.card}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.cardTitle}>Wysyłam…</Text>
            </View>
          ) : submission.kind === 'success' ? (
            <SuccessCard
              name={trimmedName}
              queued={submission.queued}
              spotId={submission.spotId}
              onAddTrail={(spotId) =>
                router.replace({ pathname: '/trail/new', params: { spotId } })
              }
              onContinue={handleClose}
            />
          ) : submission.kind === 'duplicate' ? (
            <DuplicateCard
              nearSpotId={submission.nearSpotId}
              nearSpotName={submission.nearSpotName}
              distanceM={submission.distanceM}
              onOpenExisting={() => router.replace(`/spot/${submission.nearSpotId}`)}
              onDismiss={handleReset}
            />
          ) : submission.kind === 'error' ? (
            <ErrorCard message={submission.message} onRetry={handleReset} />
          ) : step === 1 ? (
            <Step1
              name={name}
              onNameChange={setName}
              regionId={regionId}
              onRegionChange={setRegionId}
            />
          ) : step === 2 ? (
            <Step2 description={description} onChange={setDescription} />
          ) : (
            <Step3
              name={trimmedName}
              regionLabel={voivodeship ? `${voivodeship.label} (${voivodeship.capital})` : ''}
              description={description.trim()}
            />
          )}
        </ScrollView>

        {submission.kind === 'idle' ? (
          <View style={styles.footer}>
            {step === 1 ? (
              <Btn variant="primary" disabled={!canAdvanceStep1} onPress={() => setStep(2)}>
                Dalej
              </Btn>
            ) : step === 2 ? (
              <View style={styles.footerRow}>
                <View style={{ flex: 1 }}>
                  <Btn variant="ghost" onPress={() => setStep(3)}>Pomiń</Btn>
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Btn variant="primary" onPress={() => setStep(3)}>Dalej</Btn>
                </View>
              </View>
            ) : (
              <Btn variant="primary" onPress={handleSubmit}>Zgłoś bike park</Btn>
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
  regionId,
  onRegionChange,
}: {
  name: string;
  onNameChange: (v: string) => void;
  regionId: string | null;
  onRegionChange: (id: string) => void;
}) {
  const trimmed = name.trim();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>NAZWA</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={onNameChange}
        placeholder="np. Las Lipowy"
        placeholderTextColor={colors.textTertiary}
        maxLength={NAME_MAX}
        autoFocus
      />
      <Text style={styles.hint}>{trimmed.length}/{NAME_MAX}</Text>

      <Text style={[styles.label, { marginTop: 20 }]}>WOJEWÓDZTWO</Text>
      <View style={styles.pills}>
        {VOIVODESHIPS.map((v) => {
          const active = v.id === regionId;
          return (
            <Pressable
              key={v.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onRegionChange(v.id);
              }}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {v.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Step2({ description, onChange }: { description: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Opis (opcjonalnie)</Text>
      <Text style={styles.cardBody}>Krótko — charakter terenu, nawierzchnia, kto tam jeździ.</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={onChange}
        placeholder="Wpisz opis…"
        placeholderTextColor={colors.textTertiary}
        maxLength={DESCRIPTION_MAX}
        multiline
        numberOfLines={4}
      />
      <Text style={styles.hint}>{description.length}/{DESCRIPTION_MAX}</Text>
    </View>
  );
}

function Step3({
  name,
  regionLabel,
  description,
}: {
  name: string;
  regionLabel: string;
  description: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>NAZWA</Text>
      <Text style={styles.value}>{name}</Text>

      <Text style={[styles.label, { marginTop: 16 }]}>WOJEWÓDZTWO</Text>
      <Text style={styles.value}>{regionLabel}</Text>

      {description ? (
        <>
          <Text style={[styles.label, { marginTop: 16 }]}>OPIS</Text>
          <Text style={styles.descValue}>{description}</Text>
        </>
      ) : null}

      <Text style={[styles.label, { marginTop: 20 }]}>LOKALIZACJA</Text>
      <Text style={styles.locationLine}>
        Orientacyjna — stolica województwa. Dokładne koordynaty ustalą się
        po pierwszym zjeździe Pioniera.
      </Text>
    </View>
  );
}

function SuccessCard({
  name,
  queued,
  spotId,
  onAddTrail,
  onContinue,
}: {
  name: string;
  queued: boolean;
  spotId: string | null;
  onAddTrail: (spotId: string) => void;
  onContinue: () => void;
}) {
  // Pioneer self-active flow (migration 20260423180000): once the
  // park is submitted, the submitter can create the first trail
  // immediately and ride it — the successful pioneer run is what
  // flips the park to `active` and publishes it to the league.
  // Queued (offline) path still falls back to "we'll send it when
  // you're back online"; the trail handoff happens on the next app
  // launch once the queued submission lands a real spotId.
  const canChainToTrail = !queued && spotId !== null;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Park wrzucony «{name}»</Text>
      <Text style={styles.cardBody}>
        {queued
          ? 'Zapisałem lokalnie. Wyślę, gdy wróci sieć. Potem dorzucisz pierwszą trasę.'
          : 'Teraz dorzuć pierwszą trasę i pojedź ją jako pionier — twój czysty zjazd aktywuje park w lidze.'}
      </Text>
      {canChainToTrail ? (
        <Btn variant="primary" onPress={() => onAddTrail(spotId!)}>
          Dodaj pierwszą trasę
        </Btn>
      ) : (
        <Btn variant="primary" onPress={onContinue}>Wróć do listy</Btn>
      )}
    </View>
  );
}

function DuplicateCard({
  nearSpotId,
  nearSpotName,
  distanceM,
  onOpenExisting,
  onDismiss,
}: {
  nearSpotId: string;
  nearSpotName: string;
  distanceM: number;
  onOpenExisting: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Podobny bike park już jest</Text>
      <Text style={styles.cardBody}>
        «{nearSpotName}» — {distanceM} m od podanej lokalizacji.
      </Text>
      {nearSpotId ? (
        <>
          <View style={{ height: 8 }} />
          <Btn variant="primary" onPress={onOpenExisting}>Otwórz istniejący</Btn>
        </>
      ) : null}
      <View style={{ height: 8 }} />
      <Btn variant="ghost" onPress={onDismiss}>Popraw dane</Btn>
    </View>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Nie udało się</Text>
      <Text style={styles.cardBody}>{message}. Spróbuj ponownie za chwilę.</Text>
      <Btn variant="ghost" onPress={onRetry}>Wróć</Btn>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.pad,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
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
    fontSize: 22,
    lineHeight: 28,
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
  descValue: {
    ...typography.body,
    color: colors.textPrimary,
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
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.label,
    color: colors.textTertiary,
    alignSelf: 'flex-end',
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
  locationLine: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    paddingHorizontal: spacing.pad,
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
