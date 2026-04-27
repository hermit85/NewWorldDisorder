// ─────────────────────────────────────────────────────────────
// FounderToolsSheet — destructive test-data tools, founder-only.
//
// Shown via JA → MENU → "Founder tools" (entry rendered only
// when useFounderStatus().isFounder is true). Inside:
//   1. Live preview of what RESET will wipe.
//   2. RESET text confirmation — user types literal "RESET" to
//      arm the destructive button. Enter on the keyboard fires
//      it too (keyboard otherwise covers the CTA).
//   3. After success: triggerRefresh() so every subscribed hook
//      re-pulls its data and the UI flips to fresh-rider state.
//   4. God-mode lists: every spot + every pioneer trail in the
//      DB, with per-row delete. Founder uses these to clean up
//      test-garbage left by anyone (own or other riders').
//
// Server-side authorisation is the source of truth — this
// component just hides the menu entry and asks for confirmation.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
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
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import * as api from '@/lib/api';
import {
  useTestDataPreview,
  useAllSpotsForFounder,
  useAllTrailsForFounder,
  useAllUsersForFounder,
} from '@/hooks/useFounderTools';
import { triggerRefresh } from '@/hooks/useRefresh';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';
import { IconGlyph } from '@/components/nwd/IconGlyph';

export interface FounderToolsSheetProps {
  visible: boolean;
  onClose: () => void;
  currentUserId: string | null;
}

const CONFIRM_TOKEN = 'RESET';

export function FounderToolsSheet({ visible, onClose, currentUserId }: FounderToolsSheetProps) {
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [doneCopy, setDoneCopy] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [godKey, setGodKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { preview, loading, error } = useTestDataPreview({
    enabled: visible,
    refreshKey: previewKey,
  });

  const { rows: spots, loading: spotsLoading, error: spotsError } = useAllSpotsForFounder({
    enabled: visible,
    currentUserId,
    refreshKey: godKey,
  });

  const { rows: trails, loading: trailsLoading, error: trailsError } = useAllTrailsForFounder({
    enabled: visible,
    currentUserId,
    refreshKey: godKey,
  });

  const { rows: users, loading: usersLoading, error: usersError } = useAllUsersForFounder({
    enabled: visible,
    currentUserId,
    refreshKey: godKey,
  });

  // Soft close: respects in-flight ops, used by scrim tap.
  function handleClose() {
    if (running || busyId) return;
    setConfirmText('');
    setDoneCopy(null);
    onClose();
  }

  // Hard close: bound to the X button. Always closes, even if a
  // server op is mid-flight. The op will still complete on the
  // server; the client just won't see the response. This is the
  // user's escape hatch — it must never be blockable, otherwise a
  // crashed/hung handler could trap the rider in the sheet.
  function handleForceClose() {
    setRunning(false);
    setBusyId(null);
    setConfirmText('');
    setDoneCopy(null);
    onClose();
  }

  async function handleReset() {
    if (running) return;
    if (confirmText !== CONFIRM_TOKEN) return;
    setRunning(true);
    setDoneCopy(null);
    try {
      const res = await api.resetMyTestData();
      if (res.ok) {
        tapMedium();
        notifySuccess();
        const d = res.data;
        setDoneCopy(
          `Dane testowe wyczyszczone. Usunięto: ${d.runs} zjazdów, ${d.leaderboardEntries} wpisów tablicy, ${d.challengeProgress} wyzwań, ${d.achievements} pasów.`,
        );
        setConfirmText('');
        triggerRefresh();
        setPreviewKey((k) => k + 1);
        setGodKey((k) => k + 1);
      } else {
        notifyWarning();
        setDoneCopy(`Błąd: ${res.code}${'message' in res && res.message ? ` — ${res.message}` : ''}`);
      }
    } catch (e: any) {
      // Catch-all so a thrown promise never traps the user with
      // running=true and a blocked close handler.
      notifyWarning();
      setDoneCopy(`Błąd nieoczekiwany: ${e?.message ?? String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  async function performSpotDelete(spot: api.FounderSpotRow, archive: boolean) {
    setBusyId(spot.spotId);
    try {
      const res = await api.deleteTestSpot(spot.spotId, { archiveIfBlocked: archive });
      if (res.ok) {
        tapMedium();
        notifySuccess();
        const verb = res.data.mode === 'archived' ? 'Zarchiwizowano' : 'Usunięto';
        setDoneCopy(`${verb} bike park "${spot.name}".`);
        triggerRefresh();
        setGodKey((k) => k + 1);
        setPreviewKey((k) => k + 1);
      } else {
        notifyWarning();
        if (res.code === 'has_foreign_runs') {
          Alert.alert(
            'Park ma cudze runy',
            `${res.message ?? 'Inni riderzy mają tu zjazdy.'}\n\nMogę zamiast usuwać — zarchiwizować (status → rejected, znika z list).`,
            [
              { text: 'Anuluj', style: 'cancel' },
              {
                text: 'ARCHIWIZUJ',
                style: 'destructive',
                onPress: () => performSpotDelete(spot, true),
              },
            ],
          );
          return;
        }
        setDoneCopy(`Błąd usuwania: ${res.code}${res.message ? ` — ${res.message}` : ''}`);
      }
    } catch (e: any) {
      notifyWarning();
      setDoneCopy(`Błąd nieoczekiwany: ${e?.message ?? String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  function confirmSpotDelete(spot: api.FounderSpotRow) {
    if (busyId) return;
    Alert.alert(
      'Usunąć bike park?',
      `"${spot.name}" (${spot.status}, ${spot.trailCount} tras${spot.isMine ? ', twój' : `, autor: ${spot.submitterUsername ?? '?'}`}).\n\nKasuje też wszystkie trasy i runy w tym parku. Bezpowrotnie.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'USUŃ',
          style: 'destructive',
          onPress: () => performSpotDelete(spot, false),
        },
      ],
    );
  }

  async function performTrailDelete(trail: api.FounderTrailRow) {
    setBusyId(trail.trailId);
    try {
      const res = await api.deleteTrail(trail.trailId);
      if (res.ok) {
        tapMedium();
        notifySuccess();
        setDoneCopy(`Usunięto trasę "${trail.name}".`);
        triggerRefresh();
        setGodKey((k) => k + 1);
        setPreviewKey((k) => k + 1);
      } else {
        notifyWarning();
        setDoneCopy(`Błąd usuwania trasy: ${res.code}${res.message ? ` — ${res.message}` : ''}`);
      }
    } catch (e: any) {
      notifyWarning();
      setDoneCopy(`Błąd nieoczekiwany: ${e?.message ?? String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function performUserDelete(user: api.FounderUserRow) {
    setBusyId(user.userId);
    try {
      const res = await api.deleteUserCascade(user.userId, 'founder cleanup');
      if (res.ok) {
        tapMedium();
        notifySuccess();
        const c = res.data.cascade;
        setDoneCopy(
          `Usunięto użytkownika "${res.data.deletedUsername}". Kaskada: ${c.runs} runów, ${c.leaderboardEntries} wpisów tablicy, ${c.spotsOrphaned} spotów osierocono, ${c.trailsOrphaned} tras osierocono.`,
        );
        triggerRefresh();
        setGodKey((k) => k + 1);
      } else {
        notifyWarning();
        const friendly =
          res.code === 'cannot_delete_self' ? 'Nie możesz usunąć własnego konta.'
          : res.code === 'forbidden'         ? 'Brak uprawnień foundera.'
          : res.code === 'user_not_found'    ? 'Użytkownik już nie istnieje.'
          : `${res.code}${res.message ? ` — ${res.message}` : ''}`;
        setDoneCopy(`Błąd usuwania użytkownika: ${friendly}`);
      }
    } catch (e: any) {
      notifyWarning();
      setDoneCopy(`Błąd nieoczekiwany: ${e?.message ?? String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  function confirmUserDelete(user: api.FounderUserRow) {
    if (busyId) return;
    if (user.isMe) {
      Alert.alert('To Twoje konto', 'Nie możesz usunąć siebie z tego ekranu.');
      return;
    }
    Alert.alert(
      'Usunąć użytkownika?',
      `@${user.username}\nRola: ${user.role}\nZjazdy: ${user.totalRuns}\nTrasy pioniera: ${user.pioneeredTotal}\n\nKonto auth + profil + cała aktywność znikają. Spoty i trasy które utworzył zostają (autor → null), żeby historia innych się nie rozpadła.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'USUŃ KONTO',
          style: 'destructive',
          onPress: () => performUserDelete(user),
        },
      ],
    );
  }

  function confirmTrailDelete(trail: api.FounderTrailRow) {
    if (busyId) return;
    const ownerLabel = trail.isMine ? 'twoja' : `autor: ${trail.pioneerUsername ?? '?'}`;
    Alert.alert(
      'Usunąć trasę?',
      `"${trail.name}" w "${trail.spotName ?? trail.spotId}" (${ownerLabel}, ${trail.runsContributed} runów).\n\nKasuje też wszystkie runy + leaderboard. Bezpowrotnie.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'USUŃ',
          style: 'destructive',
          onPress: () => performTrailDelete(trail),
        },
      ],
    );
  }

  const armed = confirmText === CONFIRM_TOKEN && !running;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {/* Two-layer structure:
            (a) Pressable scrim spans the full screen and dismisses
                the modal on tap.
            (b) KeyboardAvoidingView floats above with
                `pointerEvents="box-none"` so taps OUTSIDE the sheet
                bubble through to the scrim, and ScrollView gestures
                INSIDE the sheet aren't fighting a Pressable wrapper.
            Old structure stacked Pressables without explicit flex
            on KAV, which made `maxHeight: '92%'` indeterminate and
            interfered with the ScrollView's pan responder. */}
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={handleClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kavWrap}
          pointerEvents="box-none"
        >
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.headerRow}>
                <Text style={styles.label}>FOUNDER TOOLS</Text>
                <Pressable
                  onPress={handleForceClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Zamknij"
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed && styles.closeBtnPressed,
                  ]}
                >
                  <IconGlyph name="x" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
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
                        footnote="(nie usuwane resetem — kasuj z listy poniżej)"
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
                  returnKeyType="go"
                  onSubmitEditing={() => { if (armed) void handleReset(); }}
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

                {/* ─── God mode: bike parks ─── */}
                <View style={styles.divider} />
                <Text style={styles.title}>God mode — bike parki</Text>
                <Text style={styles.warning}>
                  Wszystkie spoty w bazie. Skasowanie usuwa też trasy i runy
                  w parku. Jeśli ktoś inny ma tam runy — proponuję archiwizację.
                </Text>

                {spotsLoading && spots.length === 0 ? (
                  <ActivityIndicator color={colors.accent} />
                ) : spotsError ? (
                  <Text style={styles.previewError}>Błąd listy ({spotsError}).</Text>
                ) : spots.length === 0 ? (
                  <Text style={styles.previewError}>Brak spotów.</Text>
                ) : (
                  <View style={styles.list}>
                    {spots.map((s) => (
                      <SpotRow
                        key={s.spotId}
                        spot={s}
                        busy={busyId === s.spotId}
                        onDelete={() => confirmSpotDelete(s)}
                      />
                    ))}
                  </View>
                )}

                {/* ─── God mode: trails ─── */}
                <View style={styles.divider} />
                <Text style={styles.title}>God mode — trasy</Text>
                <Text style={styles.warning}>
                  Wszystkie trasy w bazie. Founder kasuje również cudze trasy
                  (z runami innych) — używaj rozsądnie.
                </Text>

                {trailsLoading && trails.length === 0 ? (
                  <ActivityIndicator color={colors.accent} />
                ) : trailsError ? (
                  <Text style={styles.previewError}>Błąd listy ({trailsError}).</Text>
                ) : trails.length === 0 ? (
                  <Text style={styles.previewError}>Brak tras.</Text>
                ) : (
                  <View style={styles.list}>
                    {trails.map((t) => (
                      <TrailRow
                        key={t.trailId}
                        trail={t}
                        busy={busyId === t.trailId}
                        onDelete={() => confirmTrailDelete(t)}
                      />
                    ))}
                  </View>
                )}

                {/* ─── God mode: users ─── */}
                <View style={styles.divider} />
                <Text style={styles.title}>God mode — użytkownicy</Text>
                <Text style={styles.warning}>
                  Wszystkie konta. Usunięcie kasuje konto auth + profil + całą
                  aktywność. Spoty i trasy autorstwa usuwanego zostają z autorem
                  null. Siebie nie usuniesz z tego ekranu.
                </Text>

                {usersLoading && users.length === 0 ? (
                  <ActivityIndicator color={colors.accent} />
                ) : usersError ? (
                  <Text style={styles.previewError}>Błąd listy ({usersError}).</Text>
                ) : users.length === 0 ? (
                  <Text style={styles.previewError}>Brak użytkowników.</Text>
                ) : (
                  <View style={styles.list}>
                    {users.map((u) => (
                      <UserRow
                        key={u.userId}
                        user={u}
                        busy={busyId === u.userId}
                        onDelete={() => confirmUserDelete(u)}
                      />
                    ))}
                  </View>
                )}
              </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
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

function SpotRow({
  spot,
  busy,
  onDelete,
}: {
  spot: api.FounderSpotRow;
  busy: boolean;
  onDelete: () => void;
}) {
  const statusColor =
    spot.status === 'active' ? colors.accent
    : spot.status === 'pending' ? colors.warn
    : colors.textTertiary;
  const owner = spot.isMine ? 'JA' : (spot.submitterUsername ?? '?');
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={styles.rowName}>{spot.name}</Text>
        <Text style={styles.rowMeta}>
          <Text style={{ color: statusColor }}>{spot.status.toUpperCase()}</Text>
          {' · '}
          {spot.trailCount} tras
          {' · '}
          {owner}
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        disabled={busy}
        style={({ pressed }) => [
          styles.rowAction,
          pressed && styles.rowActionPressed,
          busy && styles.rowActionBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <Text style={styles.rowActionLabel}>USUŃ</Text>
        )}
      </Pressable>
    </View>
  );
}

function UserRow({
  user,
  busy,
  onDelete,
}: {
  user: api.FounderUserRow;
  busy: boolean;
  onDelete: () => void;
}) {
  const roleColor =
    user.role === 'founder' ? colors.danger
    : user.role === 'curator' || user.role === 'moderator' ? colors.accent
    : colors.textTertiary;
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={styles.rowName}>
          @{user.username}{user.isMe ? ' · TY' : ''}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          <Text style={{ color: roleColor }}>{user.role.toUpperCase()}</Text>
          {' · '}
          {user.totalRuns} runów
          {' · '}
          {user.pioneeredTotal} pioniera
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        disabled={busy || user.isMe}
        style={({ pressed }) => [
          styles.rowAction,
          pressed && !user.isMe && styles.rowActionPressed,
          (busy || user.isMe) && styles.rowActionBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <Text style={styles.rowActionLabel}>USUŃ</Text>
        )}
      </Pressable>
    </View>
  );
}

function TrailRow({
  trail,
  busy,
  onDelete,
}: {
  trail: api.FounderTrailRow;
  busy: boolean;
  onDelete: () => void;
}) {
  const owner = trail.isMine ? 'JA' : (trail.pioneerUsername ?? '?');
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={styles.rowName}>{trail.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {trail.spotName ?? trail.spotId}
          {' · '}
          {trail.runsContributed} runów
          {' · '}
          {owner}
        </Text>
      </View>
      <Pressable
        onPress={onDelete}
        disabled={busy}
        style={({ pressed }) => [
          styles.rowAction,
          pressed && styles.rowActionPressed,
          busy && styles.rowActionBusy,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <Text style={styles.rowActionLabel}>USUŃ</Text>
        )}
      </Pressable>
    </View>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  kavWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    // Explicit pixel cap. '%' depended on a parent height that
    // wasn't well-defined inside the previous Pressable chain,
    // making the sheet's effective max ambiguous.
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMid,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 2.4,
    paddingVertical: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.6,
  },
  rowAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.5)',
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowActionPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(255, 71, 87, 0.18)',
  },
  rowActionBusy: {
    opacity: 0.5,
  },
  rowActionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 1.5,
  },
});
