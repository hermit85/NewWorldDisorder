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
import { GlowButton } from '@/components/ui/GlowButton';
import { FilterPill } from '@/components/ui/FilterPill';
import { findVoivodeship, VOIVODESHIPS } from '@/data/voivodeships';
import { useAuthContext } from '@/hooks/AuthContext';
import { triggerRefresh } from '@/hooks/useRefresh';
import { submitSpotWithQueue } from '@/services/spotSubmission';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

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
          <Pressable onPress={() => router.back()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Wróć">
            <Text style={styles.backLabel}>← Wróć</Text>
          </Pressable>
          <Text style={styles.title}>Dodaj bike park</Text>
          <StepDots step={step} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {submission.kind === 'submitting' ? (
            <View style={styles.card}>
              <ActivityIndicator color={chunk9Colors.accent.emerald} />
              <Text style={styles.cardTitle}>Wysyłam…</Text>
            </View>
          ) : submission.kind === 'success' ? (
            <SuccessCard
              name={trimmedName}
              queued={submission.queued}
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
              <GlowButton
                label="Dalej"
                variant="primary"
                disabled={!canAdvanceStep1}
                onPress={() => setStep(2)}
              />
            ) : step === 2 ? (
              <View style={styles.footerRow}>
                <GlowButton label="Pomiń" variant="secondary" onPress={() => setStep(3)} />
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <GlowButton label="Dalej" variant="primary" onPress={() => setStep(3)} />
                </View>
              </View>
            ) : (
              <GlowButton label="Zgłoś bike park" variant="primary" onPress={handleSubmit} />
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
        placeholderTextColor={chunk9Colors.text.tertiary}
        maxLength={NAME_MAX}
        autoFocus
      />
      <Text style={styles.hint}>{trimmed.length}/{NAME_MAX}</Text>

      <Text style={[styles.label, { marginTop: 20 }]}>WOJEWÓDZTWO</Text>
      <View style={styles.pills}>
        {VOIVODESHIPS.map((v) => (
          <FilterPill
            key={v.id}
            label={v.label}
            active={v.id === regionId}
            onPress={() => onRegionChange(v.id)}
          />
        ))}
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
        placeholderTextColor={chunk9Colors.text.tertiary}
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
  onContinue,
}: {
  name: string;
  queued: boolean;
  onContinue: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Zgłoszono «{name}»</Text>
      <Text style={styles.cardBody}>
        {queued
          ? 'Zapisałem lokalnie. Wyślę, gdy wróci sieć.'
          : 'Sprawdzimy w 24h. Dostaniesz notyfikację, gdy będzie zatwierdzony.'}
      </Text>
      <GlowButton label="Wróć do listy" variant="primary" onPress={onContinue} />
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
          <GlowButton label="Otwórz istniejący" variant="primary" onPress={onOpenExisting} />
        </>
      ) : null}
      <View style={{ height: 8 }} />
      <GlowButton label="Popraw dane" variant="secondary" onPress={onDismiss} />
    </View>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Nie udało się</Text>
      <Text style={styles.cardBody}>{message}. Spróbuj ponownie za chwilę.</Text>
      <GlowButton label="Wróć" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: chunk9Colors.bg.base },
  header: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingVertical: chunk9Spacing.sectionVertical,
    gap: 12,
  },
  title: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  backLabel: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: chunk9Colors.bg.hairline,
  },
  dotActive: {
    backgroundColor: chunk9Colors.accent.emerald,
  },
  scroll: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: chunk9Colors.bg.surface,
    borderRadius: chunk9Radii.card,
    padding: chunk9Spacing.cardPadding,
    gap: 8,
  },
  cardTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    fontSize: 22,
    lineHeight: 28,
  },
  cardBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  label: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.secondary,
    marginBottom: 6,
  },
  value: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.primary,
    fontSize: 16,
    lineHeight: 22,
  },
  descValue: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.primary,
  },
  input: {
    backgroundColor: chunk9Colors.bg.base,
    borderRadius: chunk9Radii.button,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: chunk9Colors.text.primary,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    ...chunk9Typography.body13,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hint: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  locationLine: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  footer: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.base,
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
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
});
