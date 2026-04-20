// ═══════════════════════════════════════════════════════════
// Delete Account — App Store Guideline 5.1.1(v) compliance
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { useAuthContext } from '@/hooks/AuthContext';
import { deleteAccount } from '@/services/accountDeletion';
import { LEGAL } from '@/constants/legal';
import { notifyWarning } from '@/systems/haptics';

const CONFIRM_WORD = 'USUŃ';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthContext();
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!canConfirm || loading) return;

    Alert.alert(
      'Usunąć konto?',
      'Twoje konto, profil i PB zostaną trwale usunięte. Twoje trasy i czasy zostaną zachowane anonimowo jako część publicznej historii tras — dzięki temu kalibracje kolejnych riderów pozostają spójne.\n\nNie możesz tego cofnąć.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'USUŃ KONTO NA ZAWSZE',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await deleteAccount();
            setLoading(false);

            if (result.status === 'success') {
              Alert.alert(
                'Konto usunięte',
                'Twoje konto i wszystkie powiązane dane zostały trwale usunięte.',
                [{ text: 'OK', onPress: () => router.replace('/auth') }],
              );
            } else if (result.status === 'not_authenticated') {
              Alert.alert('Sesja wygasła', 'Zaloguj się ponownie, aby usunąć konto.');
              router.replace('/auth');
            } else if (result.status === 'backend_unavailable') {
              notifyWarning();
              Alert.alert(
                'Usunięcie wymaga kontaktu',
                `Nie mogliśmy teraz automatycznie usunąć Twojego konta. Wyślij wiadomość na ${result.supportEmail} z prośbą o usunięcie — zrobimy to ręcznie w ciągu 30 dni.`,
                [
                  { text: 'Anuluj', style: 'cancel' },
                  {
                    text: 'Napisz e-mail',
                    onPress: () =>
                      Linking.openURL(
                        `mailto:${result.supportEmail}?subject=Usunięcie konta NWD&body=Proszę o usunięcie mojego konta NWD powiązanego z adresem: ${user?.email ?? ''}`,
                      ),
                  },
                ],
              );
            } else {
              notifyWarning();
              Alert.alert(
                'Nie udało się usunąć',
                `${result.message}\n\nSkontaktuj się z nami: ${LEGAL.supportEmail}`,
              );
            }
          },
        },
      ],
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Zaloguj się, aby zarządzać kontem.</Text>
          <Pressable style={styles.fallbackBtn} onPress={() => router.replace('/auth')}>
            <Text style={styles.fallbackBtnText}>ZALOGUJ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← WRÓĆ</Text>
        </Pressable>

        <Text style={styles.title}>USUŃ KONTO</Text>
        <Text style={styles.subtitle}>
          Ta operacja jest nieodwracalna.
        </Text>

        <View style={styles.warnCard}>
          <Text style={styles.warnTitle}>CO ZOSTANIE USUNIĘTE</Text>
          <WarnRow text="Twój profil, rider tag i zdjęcie" />
          <WarnRow text="Rekordy osobiste (PB) i pozycje w rankingach" />
          <WarnRow text="Osiągnięcia, XP i ranga" />
          <WarnRow text="Dostęp do konta powiązanego z tym e-mailem" />
        </View>

        <View style={[styles.warnCard, styles.keepCard]}>
          <Text style={[styles.warnTitle, styles.keepTitle]}>CO ZOSTANIE ZACHOWANE ANONIMOWO</Text>
          <WarnRow text="Trasy które utworzyłeś jako pierwszy Pionier" dotColor={colors.accent} />
          <WarnRow text="Czasy zjazdów (bez powiązania z Tobą)" dotColor={colors.accent} />
          <Text style={styles.keepNote}>
            Dzięki temu kalibracje kolejnych riderów pozostają spójne.{'\n'}
            (GDPR compliance — pioneer_user_id → NULL)
          </Text>
        </View>

        <Text style={styles.note}>
          Proces uruchamiamy natychmiast po potwierdzeniu. Niektóre logi techniczne mogą zostać w kopiach zapasowych do 30 dni, po czym są automatycznie usuwane.
        </Text>

        <Text style={styles.label}>
          Aby kontynuować, wpisz poniżej słowo <Text style={styles.labelStrong}>{CONFIRM_WORD}</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_WORD}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />

        <Pressable
          style={[styles.deleteBtn, (!canConfirm || loading) && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={!canConfirm || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.deleteBtnText}>USUŃ KONTO NA ZAWSZE</Text>
          )}
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>ANULUJ</Text>
        </Pressable>

        <Text style={styles.footer}>
          Jeżeli wolisz, aby usunięcie konta przeprowadzić ręcznie, napisz na{' '}
          <Text
            style={styles.footerLink}
            onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)}
          >
            {LEGAL.supportEmail}
          </Text>
          .
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function WarnRow({ text, dotColor }: { text: string; dotColor?: string }) {
  return (
    <View style={styles.warnRow}>
      <Text style={[styles.warnDot, dotColor && { color: dotColor }]}>•</Text>
      <Text style={styles.warnText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },
  backBtn: { marginBottom: spacing.lg },
  backText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  title: { fontFamily: 'Orbitron_700Bold', fontSize: 22, color: colors.red, letterSpacing: 3, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },

  warnCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.red, marginBottom: spacing.lg },
  warnTitle: { ...typography.labelSmall, color: colors.red, letterSpacing: 3, marginBottom: spacing.md, fontSize: 10 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
  warnDot: { color: colors.red, fontSize: 14, lineHeight: 20 },
  warnText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1, lineHeight: 20 },
  keepCard: { borderColor: 'rgba(0, 255, 140, 0.30)' },
  keepTitle: { color: colors.accent },
  keepNote: { ...typography.labelSmall, color: colors.textTertiary, lineHeight: 16, fontSize: 10, marginTop: spacing.md, letterSpacing: 0.5 },

  note: { ...typography.bodySmall, color: colors.textTertiary, lineHeight: 20, marginBottom: spacing.xl },

  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.sm },
  labelStrong: { color: colors.red, fontFamily: 'Orbitron_700Bold', letterSpacing: 2 },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    // Was Orbitron_700Bold — Orbitron is missing Polish diacritics
    // (Gałgan → Ga¬gan). The confirm word is "USUŃ" which happens to
    // be ASCII-only, but typography.input is the canonical pick.
    ...typography.input,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  deleteBtn: {
    backgroundColor: colors.red,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: { ...typography.cta, color: colors.textPrimary, letterSpacing: 3, fontSize: 14 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.xl },
  cancelBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 2 },

  footer: { ...typography.labelSmall, color: colors.textTertiary, textAlign: 'center', lineHeight: 18, fontSize: 10 },
  footerLink: { color: colors.textSecondary, textDecorationLine: 'underline' },

  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  fallbackText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  fallbackBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  fallbackBtnText: { ...typography.cta, color: colors.bg, letterSpacing: 2 },
});
