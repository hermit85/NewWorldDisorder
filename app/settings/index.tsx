// ─────────────────────────────────────────────────────────────
// /settings — full-screen account & app settings.
//
// Replaces the prior bottom sheet on JA. A push screen scales
// better with the number of items (avatar, legal, support,
// destructive zone, founder zone) and lets us group the menu so
// destructive actions live in their own labelled cluster instead
// of just "the red rows at the bottom".
//
// Sheets that originated from this menu (FeedbackSheet, Founder
// ToolsSheet) are rendered locally — closing the sheet leaves
// the user on /settings rather than yanking them back to JA.
// ─────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TopBar } from '@/components/nwd/TopBar';
import { PageTitle } from '@/components/nwd/PageTitle';
import { SectionHead } from '@/components/nwd/SectionHead';
import { IconGlyph } from '@/components/nwd/IconGlyph';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { useAuthContext } from '@/hooks/AuthContext';
import { useProfile } from '@/hooks/useBackend';
import { useFounderStatus } from '@/hooks/useFounderTools';
import { triggerRefresh } from '@/hooks/useRefresh';
import { LEGAL } from '@/constants/legal';
import { pickAvatarImage, uploadAvatar, removeAvatar } from '@/services/avatar';
import { notifySuccess, notifyWarning, tapLight, tapMedium } from '@/systems/haptics';
import { FeedbackSheet } from '@/components/feedback/FeedbackSheet';
import { FounderToolsSheet } from '@/components/profile/FounderToolsSheet';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile: authProfile, signOut } = useAuthContext();
  const { profile: user } = useProfile(authProfile?.id);
  const { isFounder } = useFounderStatus(authProfile?.id ?? null);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [founderOpen, setFounderOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const handlePickAndUpload = useCallback(async () => {
    if (!authProfile?.id) return;
    const pickResult = await pickAvatarImage();
    if ('denied' in pickResult) {
      Alert.alert('Brak dostępu', 'Włącz dostęp do galerii w Ustawieniach telefonu.');
      return;
    }
    if ('cancelled' in pickResult) return;
    if ('error' in pickResult) {
      notifyWarning();
      Alert.alert('Błąd', pickResult.error);
      return;
    }
    setAvatarBusy(true);
    const result = await uploadAvatar(authProfile.id, pickResult.uri);
    setAvatarBusy(false);
    if (result.status === 'success') {
      tapMedium();
      notifySuccess();
      triggerRefresh();
    } else if (result.status === 'error') {
      notifyWarning();
      Alert.alert('Nie udało się', result.message);
    }
  }, [authProfile?.id]);

  const handleRemoveAvatar = useCallback(async () => {
    if (!authProfile?.id) return;
    setAvatarBusy(true);
    const ok = await removeAvatar(authProfile.id);
    setAvatarBusy(false);
    if (ok) {
      tapLight();
      triggerRefresh();
    } else {
      notifyWarning();
    }
  }, [authProfile?.id]);

  const handleAvatarMenu = useCallback(() => {
    if (!authProfile?.id || avatarBusy) return;
    tapLight();
    if (user?.avatarUrl) {
      Alert.alert(
        'Zdjęcie profilowe',
        undefined,
        [
          { text: 'Zmień zdjęcie', onPress: handlePickAndUpload },
          { text: 'Usuń zdjęcie', style: 'destructive', onPress: handleRemoveAvatar },
          { text: 'Anuluj', style: 'cancel' },
        ],
      );
      return;
    }
    void handlePickAndUpload();
  }, [authProfile?.id, avatarBusy, user?.avatarUrl, handlePickAndUpload, handleRemoveAvatar]);

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      'Wyloguj?',
      'Wrócisz do ekranu logowania. Lokalne zjazdy w kolejce zostają — wrócą po ponownym logowaniu.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyloguj',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  }, [signOut, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TopBar onBack={() => router.back()} />
        <PageTitle title="Ustawienia" />

        {/* ─── KONTO ─── */}
        <View style={styles.section}>
          <SectionHead label="Konto" />
          <Row
            label="Zmień zdjęcie profilowe"
            onPress={handleAvatarMenu}
            busy={avatarBusy}
          />
        </View>

        {/* ─── APLIKACJA ─── */}
        <View style={styles.section}>
          <SectionHead label="Aplikacja" />
          <Row
            label="Wyślij feedback"
            onPress={() => setFeedbackOpen(true)}
          />
          <Row
            label="Wsparcie"
            onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)}
          />
          <Row
            label="Pomoc"
            onPress={() => router.push('/help')}
          />
        </View>

        {/* ─── PRAWO ─── */}
        <View style={styles.section}>
          <SectionHead label="Prawo" />
          <Row
            label="Polityka prywatności"
            onPress={() => Linking.openURL(LEGAL.privacyUrl)}
          />
          <Row
            label="Regulamin"
            onPress={() => Linking.openURL(LEGAL.termsUrl)}
          />
        </View>

        {/* ─── STREFA ZAGROŻENIA ─── */}
        <View style={styles.section}>
          <SectionHead label="Strefa zagrożenia" />
          <Row
            label="Wyloguj"
            destructive
            onPress={handleSignOut}
          />
          <Row
            label="Usuń konto"
            destructive
            onPress={() => router.push('/settings/delete-account')}
          />
        </View>

        {/* ─── FOUNDER (conditional) ─── */}
        {isFounder ? (
          <View style={styles.section}>
            <SectionHead label="Founder" />
            <Row
              label="Founder tools"
              destructive
              onPress={() => setFounderOpen(true)}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* Locally-rendered sheets so closing them keeps the user on
          /settings (not yanked back to /(tabs)/profile). */}
      {authProfile?.id ? (
        <FeedbackSheet
          visible={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          context={{
            userId: authProfile.id,
            screen: 'ja',
          }}
        />
      ) : null}

      <FounderToolsSheet
        visible={founderOpen}
        onClose={() => setFounderOpen(false)}
        currentUserId={authProfile?.id ?? null}
      />
    </SafeAreaView>
  );
}

function Row({
  label,
  onPress,
  destructive = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.row,
        destructive && styles.rowDestructive,
        pressed && !busy && styles.rowPressed,
        busy && styles.rowBusy,
      ]}
    >
      <Text
        style={[
          styles.rowLabel,
          destructive && styles.rowLabelDestructive,
        ]}
      >
        {label}
      </Text>
      {busy ? (
        <ActivityIndicator size="small" color={destructive ? colors.danger : colors.textSecondary} />
      ) : (
        <IconGlyph
          name="chevron-right"
          size={16}
          color={destructive ? colors.danger : colors.textTertiary}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.xl,
  },
  section: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    gap: 12,
  },
  rowDestructive: {
    borderColor: 'rgba(255, 71, 87, 0.32)',
    backgroundColor: 'rgba(255, 71, 87, 0.04)',
  },
  rowPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  rowBusy: {
    opacity: 0.6,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowLabelDestructive: {
    color: colors.danger,
  },
});
