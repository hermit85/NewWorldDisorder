// ─────────────────────────────────────────────────────────────
// FeedbackSheet — TestFlight bug/idea/praise sink.
//
// Bottom-sheet modal. Rider picks a type chip, types a message,
// taps WYŚLIJ FEEDBACK. Caller passes optional `context` so the
// debug payload carries trail/run/save-status info — that's how
// "running into a problem on Prezydencka after 4 stuck zjazdy"
// shows up usefully in Studio without the rider repeating it.
//
// If the Supabase insert fails, we surface the error inline AND
// offer a mailto fallback so the report doesn't get lost.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import * as api from '@/lib/api';
import { LEGAL } from '@/constants/legal';
import { notifySuccess, notifyWarning, tapLight } from '@/systems/haptics';

export interface FeedbackContext {
  /** Logged-in rider id. Required — we never send anonymous reports. */
  userId: string;
  /** Screen where the rider opened feedback ("result", "ja", etc.). */
  screen?: string;
  /** Optional trail context surfaced from the calling screen. */
  trailId?: string | null;
  trailName?: string | null;
  /** Optional run context. */
  runId?: string | null;
  saveStatus?: string | null;
  rejectionReason?: string | null;
  /** Optional GPS quality bag — point counts, accuracy buckets. */
  gpsSummary?: Record<string, unknown> | null;
}

export interface FeedbackSheetProps {
  visible: boolean;
  onClose: () => void;
  context: FeedbackContext;
}

const TYPE_CHIPS: Array<{ id: api.FeedbackType; label: string }> = [
  { id: 'bug',     label: 'Problem' },
  { id: 'unclear', label: 'Niejasne' },
  { id: 'idea',    label: 'Pomysł' },
  { id: 'praise',  label: 'Działało OK' },
];

export function FeedbackSheet({ visible, onClose, context }: FeedbackSheetProps) {
  const [type, setType] = useState<api.FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; copy: string } | null>(null);

  function handleClose() {
    if (submitting) return;
    setMessage('');
    setDone(null);
    setType('bug');
    onClose();
  }

  async function handleSubmit() {
    if (submitting) return;
    if (message.trim().length === 0) return;
    tapLight();
    setSubmitting(true);
    setDone(null);
    const res = await api.submitFeedback(context.userId, {
      type,
      message,
      screen: context.screen,
      trailId: context.trailId ?? null,
      runId: context.runId ?? null,
      appVersion: collectAppVersion(),
      deviceInfo: collectDeviceInfo(),
      debugPayload: collectDebugPayload(context),
    });
    setSubmitting(false);
    if (res.ok) {
      notifySuccess();
      setDone({ ok: true, copy: 'Wysłane. Dzięki za sygnał.' });
      setMessage('');
      // Auto-close after a short pause so the rider sees the confirm.
      setTimeout(() => {
        if (!submitting) onClose();
      }, 1400);
    } else {
      notifyWarning();
      setDone({
        ok: false,
        copy: `Nie udało się wysłać (${res.code}). Spróbuj jeszcze raz albo użyj e-maila.`,
      });
    }
  }

  function handleMailtoFallback() {
    const subject = `[NWD] Feedback · ${type}`;
    const body = [
      message.trim(),
      '',
      '---',
      `screen: ${context.screen ?? '?'}`,
      `trail: ${context.trailName ?? '-'} (${context.trailId ?? '-'})`,
      `run: ${context.runId ?? '-'}`,
      `saveStatus: ${context.saveStatus ?? '-'}`,
      `rejection: ${context.rejectionReason ?? '-'}`,
      `appVersion: ${collectAppVersion()}`,
      `device: ${Platform.OS} ${Platform.Version}`,
    ].join('\n');
    const url = `mailto:${LEGAL.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => undefined);
  }

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
            <Text style={styles.label}>FEEDBACK</Text>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <View style={styles.chipRow}>
                {TYPE_CHIPS.map((chip) => {
                  const active = type === chip.id;
                  return (
                    <Pressable
                      key={chip.id}
                      onPress={() => setType(chip.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Co się stało?</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Opisz krótko — kontekst trasy / zjazdu doklejamy automatycznie."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={5}
                editable={!submitting}
                style={styles.textarea}
              />

              {context.trailName || context.runId ? (
                <Text style={styles.contextLine}>
                  Kontekst: {context.trailName ?? '—'}
                  {context.runId ? ` · run ${context.runId.slice(0, 8)}` : ''}
                  {context.saveStatus ? ` · ${context.saveStatus}` : ''}
                </Text>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={submitting || message.trim().length === 0}
                style={({ pressed }) => [
                  styles.cta,
                  message.trim().length === 0 && styles.ctaDisabled,
                  pressed && message.trim().length > 0 && styles.ctaPressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.accentInk} />
                ) : (
                  <Text style={styles.ctaLabel}>WYŚLIJ FEEDBACK</Text>
                )}
              </Pressable>

              {done ? (
                <View style={styles.doneWrap}>
                  <Text style={[styles.doneCopy, !done.ok && styles.doneCopyError]}>
                    {done.copy}
                  </Text>
                  {!done.ok ? (
                    <Pressable onPress={handleMailtoFallback} style={styles.mailLink}>
                      <Text style={styles.mailLabel}>WYŚLIJ E-MAILEM →</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function collectAppVersion(): string {
  const cfg = Constants.expoConfig;
  const v = cfg?.version ?? '0.0.0';
  const ios = (cfg as { ios?: { buildNumber?: string } } | null)?.ios?.buildNumber;
  return ios ? `${v} (${ios})` : v;
}

function collectDeviceInfo(): Record<string, unknown> {
  return {
    platform: Platform.OS,
    osVersion: Platform.Version,
    isPad: Platform.OS === 'ios' ? (Platform as any).isPad ?? false : false,
  };
}

function collectDebugPayload(ctx: FeedbackContext): Record<string, unknown> {
  return {
    screen: ctx.screen,
    trailId: ctx.trailId,
    trailName: ctx.trailName,
    runId: ctx.runId,
    saveStatus: ctx.saveStatus,
    rejectionReason: ctx.rejectionReason,
    gpsSummary: ctx.gpsSummary,
  };
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: { backgroundColor: 'transparent' },
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
    color: colors.accent,
    letterSpacing: 2.4,
    paddingVertical: 4,
  },
  body: {
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.6,
  },
  chipLabelActive: {
    color: colors.accentInk,
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  textarea: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  contextLine: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  cta: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  ctaDisabled: {
    backgroundColor: colors.accentDim,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    fontFamily: fonts.racing,
    fontSize: 13,
    fontWeight: '800',
    color: colors.accentInk,
    letterSpacing: 2.5,
  },
  doneWrap: {
    gap: 8,
    marginTop: 4,
  },
  doneCopy: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
  },
  doneCopyError: {
    color: colors.danger,
  },
  mailLink: {
    paddingVertical: 8,
  },
  mailLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
  },
});
