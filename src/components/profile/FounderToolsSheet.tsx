// ─────────────────────────────────────────────────────────────
// FounderToolsSheet — destructive test-data tools, founder-only.
//
// Shown via JA → MENU → "Founder tools" (entry rendered only
// when useFounderStatus().isFounder is true). Inside:
//   1. Live preview of what RESET will wipe.
//   2. RESET text confirmation — user types literal "RESET" to
//      arm the destructive button.
//   3. After success: triggerRefresh() so every subscribed hook
//      re-pulls its data and the UI flips to fresh-rider state.
//
// Server-side authorisation is the source of truth — this
// component just hides the menu entry and asks for confirmation.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import * as api from '@/lib/api';
import { useTestDataPreview } from '@/hooks/useFounderTools';
import { triggerRefresh } from '@/hooks/useRefresh';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';

export interface FounderToolsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const CONFIRM_TOKEN = 'RESET';

export function FounderToolsSheet({ visible, onClose }: FounderToolsSheetProps) {
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [doneCopy, setDoneCopy] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const { preview, loading, error } = useTestDataPreview({
    enabled: visible,
    refreshKey: previewKey,
  });

  function handleClose() {
    if (running) return;
    setConfirmText('');
    setDoneCopy(null);
    onClose();
  }

  async function handleReset() {
    if (running) return;
    if (confirmText !== CONFIRM_TOKEN) return;
    setRunning(true);
    setDoneCopy(null);
    const res = await api.resetMyTestData();
    setRunning(false);
    if (res.ok) {
      tapMedium();
      notifySuccess();
      const d = res.data;
      setDoneCopy(
        `Dane testowe wyczyszczone. Usunięto: ${d.runs} zjazdów, ${d.leaderboardEntries} wpisów tablicy, ${d.challengeProgress} wyzwań, ${d.achievements} pasów.`,
      );
      setConfirmText('');
      // Refresh every subscribed hook so the UI flips immediately.
      triggerRefresh();
      // Re-pull preview so the next-time-open numbers are fresh.
      setPreviewKey((k) => k + 1);
    } else {
      notifyWarning();
      setDoneCopy(`Błąd: ${res.code}${'message' in res && res.message ? ` — ${res.message}` : ''}`);
    }
  }

  const armed = confirmText === CONFIRM_TOKEN && !running;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.scrim} onPress={handleClose}>
        <Pressable onPress={() => {}} style={styles.sheetWrap}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.label}>FOUNDER TOOLS</Text>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.title}>Reset moich danych testowych</Text>
              <Text style={styles.warning}>
                Operacja usuwa Twoje zjazdy, rekordy i wyzwania bezpowrotnie.
                Konto zostaje. Inne osoby nie tracą nic.
              </Text>

              <View style={styles.previewCard}>
                <Text style={styles.previewKicker}>DO USUNIĘCIA</Text>
                {loading && !preview ? (
                  <ActivityIndicator color={colors.accent} />
                ) : error ? (
                  <Text style={styles.previewError}>
                    Nie udało się pobrać podglądu ({error}).
                  </Text>
                ) : preview ? (
                  <View style={styles.previewRows}>
                    <PreviewRow label="Zjazdy" value={preview.runs} />
                    <PreviewRow label="Wpisy tablicy" value={preview.leaderboardEntries} />
                    <PreviewRow label="Wyzwania" value={preview.challengeProgress} />
                    <PreviewRow label="Pasy" value={preview.achievements} />
                    <PreviewRow
                      label="Trasy pioniera"
                      value={preview.pioneerTrails}
                      footnote="(NIE usuwane — kasuj osobno)"
                    />
                  </View>
                ) : null}
              </View>

              <Text style={styles.confirmLabel}>
                Napisz {CONFIRM_TOKEN} żeby potwierdzić:
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder={CONFIRM_TOKEN}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!running}
                style={[
                  styles.input,
                  armed && styles.inputArmed,
                ]}
              />

              <Pressable
                onPress={handleReset}
                disabled={!armed}
                style={({ pressed }) => [
                  styles.cta,
                  armed ? styles.ctaArmed : styles.ctaDisabled,
                  pressed && armed && styles.ctaPressed,
                ]}
              >
                {running ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={[styles.ctaLabel, !armed && styles.ctaLabelDisabled]}>
                    {armed ? 'WYCZYŚĆ DANE' : `WPISZ ${CONFIRM_TOKEN}`}
                  </Text>
                )}
              </Pressable>

              {doneCopy ? (
                <Text style={styles.done}>{doneCopy}</Text>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PreviewRow({
  label,
  value,
  footnote,
}: {
  label: string;
  value: number;
  footnote?: string;
}) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewRowLabel}>{label}</Text>
      <Text
        style={[
          styles.previewRowValue,
          value === 0 && styles.previewRowValueZero,
        ]}
      >
        {value}
      </Text>
      {footnote ? (
        <Text style={styles.previewFootnote}>{footnote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMid,
    marginBottom: 8,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 2.4,
    paddingVertical: 4,
  },
  body: {
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  title: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  warning: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  previewCard: {
    backgroundColor: 'rgba(255, 71, 87, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  previewKicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 2,
  },
  previewError: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  previewRows: {
    gap: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  previewRowLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  previewRowValue: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 0.5,
  },
  previewRowValueZero: {
    color: colors.textTertiary,
  },
  previewFootnote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    flexBasis: '100%',
    marginTop: 2,
  },
  confirmLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  input: {
    fontFamily: fonts.racing,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  inputArmed: {
    borderColor: colors.danger,
  },
  cta: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaArmed: {
    backgroundColor: colors.danger,
  },
  ctaDisabled: {
    backgroundColor: 'rgba(255, 71, 87, 0.18)',
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    fontFamily: fonts.racing,
    fontSize: 13,
    fontWeight: '800',
    color: colors.bg,
    letterSpacing: 2.5,
  },
  ctaLabelDisabled: {
    color: 'rgba(255, 71, 87, 0.65)',
  },
  done: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    marginTop: 4,
  },
});
