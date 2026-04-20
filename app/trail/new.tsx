// ═══════════════════════════════════════════════════════════
// Dodaj trasę — create-trail form for a given spot.
// Game-HUD polish pass: kicker label, difficulty pills with
// semantic colours, type chips with glyphs + short labels,
// "ROZPOCZNIJ KALIBRACJĘ" as commitment-tier CTA.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { spacing, radii } from '@/theme/spacing';
import { hudColors, hudTypography, hudShadows } from '@/theme/gameHud';
import { useAuthContext } from '@/hooks/AuthContext';
import { useCreateTrail } from '@/hooks/useBackend';
import { tapMedium, notifySuccess, notifyWarning } from '@/systems/haptics';

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type TrailType = 'downhill' | 'flow' | 'tech' | 'jump';

interface DifficultyOption {
  key: Difficulty;
  label: string;
  color: string;
}
interface TrailTypeOption {
  key: TrailType;
  label: string;
  sub: string;
  glyph: string;
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { key: 'easy',   label: 'EASY',   color: hudColors.diffEasy   },
  { key: 'medium', label: 'MED',    color: hudColors.diffMedium },
  { key: 'hard',   label: 'HARD',   color: hudColors.diffHard   },
  { key: 'expert', label: 'EXP',    color: hudColors.diffExpert },
];

const TRAIL_TYPE_OPTIONS: TrailTypeOption[] = [
  { key: 'downhill', label: 'DH',   sub: 'downhill', glyph: '▲' },
  { key: 'flow',     label: 'FLOW', sub: 'flow',     glyph: '∿' },
  { key: 'tech',     label: 'TECH', sub: 'tech',     glyph: '⚡' },
  { key: 'jump',     label: 'JUMP', sub: 'jump',     glyph: '⇗' },
];

const NAME_MIN = 3;
const NAME_MAX = 60;

const TERRAIN_GRADIENT: readonly [string, string, string] = [
  hudColors.terrainHigh,
  hudColors.terrainMid,
  hudColors.terrainDark,
];

type Screen =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string }
  | { kind: 'success' };

export default function NewTrailScreen() {
  const { spotId: rawSpotId } = useLocalSearchParams<{ spotId?: string }>();
  const spotId = rawSpotId ?? '';
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { submit } = useCreateTrail();

  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [trailType, setTrailType] = useState<TrailType>('flow');
  const [screen, setScreen] = useState<Screen>({ kind: 'idle' });
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
    }
  }, [isAuthenticated, spotId, router]);

  const trimmed = name.trim();
  const nameValid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;
  const canSubmit = nameValid && difficulty !== null && screen.kind !== 'submitting';

  const handleSelectDifficulty = useCallback((key: Difficulty) => {
    Haptics.selectionAsync();
    setDifficulty(key);
  }, []);

  const handleSelectTrailType = useCallback((key: TrailType) => {
    Haptics.selectionAsync();
    setTrailType(key);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !difficulty) return;

    tapMedium();
    setScreen({ kind: 'submitting' });
    setNameError(null);

    const result = await submit({ spotId, name: trimmed, difficulty, trailType });

    if (result.ok) {
      notifySuccess();
      setScreen({ kind: 'success' });
      router.replace(`/trail/${result.data.trailId}`);
      return;
    }

    notifyWarning();
    const message = result.message ?? 'Nie udało się utworzyć trasy';

    if (result.code === 'duplicate_name_in_spot' ||
        result.code === 'name_too_short' ||
        result.code === 'name_too_long') {
      setNameError(message);
      setScreen({ kind: 'idle' });
      return;
    }
    if (result.code === 'spot_not_active') {
      Alert.alert('Bike park nieaktywny', message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
      setScreen({ kind: 'idle' });
      return;
    }
    setScreen({ kind: 'error', message });
  }, [canSubmit, difficulty, spotId, trimmed, trailType, submit, router]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={TERRAIN_GRADIENT}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={16}>
              <Text style={styles.backLabel}>← WRÓĆ</Text>
            </Pressable>

            <View style={styles.kickerRow}>
              <Text style={styles.kickerGlyph}>⟣</Text>
              <Text style={styles.kickerText}>TWORZYSZ NOWĄ TRASĘ</Text>
            </View>
            <Text style={styles.subtitle}>
              Nazwij ją. Wybierz poziom.{'\n'}Zostań pierwszym Pionierem.
            </Text>

            {/* NAZWA section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NAZWA</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (nameError) setNameError(null);
                }}
                placeholder="np. Gałgan Niebieska"
                placeholderTextColor={hudColors.textMuted}
                maxLength={NAME_MAX}
                autoFocus
                editable={screen.kind !== 'submitting'}
              />
              <View style={styles.inputFooter}>
                {nameError ? (
                  <Text style={styles.inlineError} numberOfLines={2}>{nameError}</Text>
                ) : (
                  <Text style={styles.hint}>{trimmed.length}/{NAME_MAX}</Text>
                )}
              </View>
            </View>

            <View style={styles.separator} />

            {/* TRUDNOŚĆ section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TRUDNOŚĆ</Text>
              <View style={styles.segmentRow}>
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const selected = difficulty === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.diffSegment,
                        selected && {
                          borderColor: opt.color,
                          backgroundColor: `${opt.color}1A`,
                        },
                      ]}
                      onPress={() => handleSelectDifficulty(opt.key)}
                      disabled={screen.kind === 'submitting'}
                    >
                      <View style={[styles.diffDot, { backgroundColor: opt.color }]} />
                      <Text
                        style={[
                          styles.diffLabel,
                          { color: selected ? opt.color : hudColors.textMuted },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.separator} />

            {/* TYP section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TYP (OPCJONALNIE)</Text>
              <View style={styles.segmentRow}>
                {TRAIL_TYPE_OPTIONS.map((opt) => {
                  const selected = trailType === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      style={[
                        styles.typeSegment,
                        selected && styles.typeSegmentActive,
                      ]}
                      onPress={() => handleSelectTrailType(opt.key)}
                      disabled={screen.kind === 'submitting'}
                    >
                      <Text
                        style={[
                          styles.typeGlyph,
                          { color: selected ? hudColors.gpsStrong : hudColors.textMuted },
                        ]}
                      >
                        {opt.glyph}
                      </Text>
                      <Text
                        style={[
                          styles.typeLabel,
                          { color: selected ? hudColors.timerPrimary : hudColors.textMuted },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.typeSub}>{opt.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {screen.kind === 'error' && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{screen.message}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submitCta,
                !canSubmit && styles.submitCtaDisabled,
                canSubmit && hudShadows.glowGreen,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              {screen.kind === 'submitting' ? (
                <ActivityIndicator color={hudColors.terrainDark} />
              ) : (
                <Text style={styles.submitLabel}>ROZPOCZNIJ KALIBRACJĘ</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hudColors.terrainDark },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },

  back: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backLabel: { ...hudTypography.labelSmall, color: hudColors.textMuted, letterSpacing: 3 },

  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  kickerGlyph: { color: hudColors.gpsStrong, fontSize: 16 },
  kickerText: { ...hudTypography.label, color: hudColors.gpsStrong, fontSize: 12 },

  subtitle: {
    color: hudColors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  section: { paddingVertical: spacing.md },
  separator: {
    height: 1,
    backgroundColor: 'rgba(232, 255, 240, 0.08)',
    marginVertical: spacing.xs,
  },
  sectionLabel: {
    ...hudTypography.label,
    color: hudColors.textMuted,
    marginBottom: spacing.sm,
    fontSize: 10,
  },

  input: {
    backgroundColor: 'rgba(232, 255, 240, 0.04)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 240, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: hudColors.timerPrimary,
    ...hudTypography.input,
  },
  inputFooter: { marginTop: spacing.xs, minHeight: 18, alignItems: 'flex-end' },
  hint: { color: hudColors.textMuted, fontSize: 11, letterSpacing: 1 },
  inlineError: { color: hudColors.gpsWeak, fontSize: 12, alignSelf: 'flex-start' },

  segmentRow: { flexDirection: 'row', gap: spacing.xs },

  // Difficulty pills
  diffSegment: {
    flex: 1,
    minHeight: 52,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 255, 240, 0.1)',
    backgroundColor: 'rgba(232, 255, 240, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffLabel: { ...hudTypography.label, fontSize: 12, letterSpacing: 2 },

  // Trail type chips
  typeSegment: {
    flex: 1,
    minHeight: 72,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 255, 240, 0.1)',
    backgroundColor: 'rgba(232, 255, 240, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSegmentActive: {
    borderColor: hudColors.gpsStrong,
    backgroundColor: 'rgba(0, 255, 140, 0.08)',
  },
  // No explicit fontFamily — system font has wider Unicode coverage
  // (Orbitron lacks glyphs like ⚙ / ∿).
  typeGlyph: { fontSize: 22, marginBottom: 2 },
  typeLabel: { ...hudTypography.label, fontSize: 11, letterSpacing: 1.5 },
  typeSub: { color: hudColors.textMuted, fontSize: 8, letterSpacing: 1, marginTop: 1 },

  errorBanner: {
    backgroundColor: hudColors.actionDangerBg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: hudColors.gpsWeak,
    marginTop: spacing.md,
  },
  errorBannerText: { color: hudColors.gpsWeak, fontSize: 13, lineHeight: 18 },

  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(232, 255, 240, 0.08)',
  },
  submitCta: {
    backgroundColor: hudColors.actionPrimary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  submitCtaDisabled: { opacity: 0.3 },
  submitLabel: {
    ...hudTypography.action,
    fontSize: 16,
    color: hudColors.terrainDark,
    letterSpacing: 3,
  },
});
