// ═══════════════════════════════════════════════════════════
// Auth Screen — wejście do ligi NWD
// 3 stepy: email → verify_code → create_profile
// Email OTP (kod z maila), brand chrome (NWDHeader / PageLabel /
// BottomBand) + Btn primary CTA. Cooldowns, rate-limit detection
// and KeyboardAvoidingView preserved from the previous version.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Linking, type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import {
  Btn, NWDHeader, PageLabel, BottomBand,
} from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { LEGAL } from '@/constants/legal';
import { validateUsername } from '@/services/moderation';

type Step = 'email' | 'verify_code' | 'create_profile';

const HEADER_LABEL: Record<Step, string> = {
  email: 'REJESTRACJA',
  verify_code: 'WERYFIKACJA',
  create_profile: 'RIDER TAG',
};

const PAGE_LABEL: Record<Step, string> = {
  email: 'DOŁĄCZ DO LIGI',
  verify_code: 'KOD JEDNORAZOWY',
  create_profile: 'OSTATNI KROK',
};

export default function AuthScreen() {
  const router = useRouter();
  const { state, signInWithEmail, verifyOtp, createProfile, retryAuth } = useAuthContext();
  const [step, setStep] = useState<Step>(
    state.status === 'needs_profile' ? 'create_profile' : 'email',
  );
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendCooldown, setSendCooldown] = useState(0);
  const [emailFocused, setEmailFocused] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);
  const [usernameFocused, setUsernameFocused] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const sendCooldownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // React to auth state changes
  useEffect(() => {
    if (state.status === 'authenticated') {
      router.replace('/(tabs)');
    } else if (state.status === 'needs_profile') {
      setStep('create_profile');
    } else if (state.status === 'error') {
      setError(state.message);
    }
  }, [state.status]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) { clearInterval(cooldownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(cooldownRef.current);
    }
  }, [resendCooldown]);

  // Initial-send cooldown (anti-spam right after first send)
  useEffect(() => {
    if (sendCooldown > 0) {
      sendCooldownRef.current = setInterval(() => {
        setSendCooldown((c) => {
          if (c <= 1) { clearInterval(sendCooldownRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(sendCooldownRef.current);
    }
  }, [sendCooldown]);

  const isRateLimited = (err: any): boolean => {
    const msg = (err?.message ?? '').toLowerCase();
    return msg.includes('rate limit')
      || msg.includes('too many')
      || msg.includes('429')
      || err?.status === 429;
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Podaj prawidłowy adres email');
      return;
    }
    if (sendCooldown > 0) return;

    setLoading(true);
    setError('');
    const { error: authError } = await signInWithEmail(trimmed);
    setLoading(false);
    if (authError) {
      if (isRateLimited(authError)) {
        setError('Za dużo prób. Spróbuj ponownie za chwilę.');
        setSendCooldown(60);
      } else {
        setError(authError.message ?? 'Nie udało się wysłać kodu');
      }
    } else {
      setStep('verify_code');
      setResendCooldown(60);
      setSendCooldown(30);
    }
  };

  const handleVerifyCode = async () => {
    const code = otpCode.trim();
    if (code.length < 6) {
      setError('Wpisz kod z maila');
      return;
    }
    setLoading(true);
    setError('');
    const { error: verifyError } = await verifyOtp(email.trim(), code);
    setLoading(false);
    if (verifyError) {
      setError('Nieprawidłowy lub wygasły kod. Spróbuj ponownie.');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError('');
    const { error: authError } = await signInWithEmail(email.trim());
    setLoading(false);
    if (authError) {
      if (isRateLimited(authError)) {
        setError('Za dużo prób. Spróbuj ponownie za chwilę.');
        setResendCooldown(60);
      } else {
        setError('Nie udało się wysłać kodu');
      }
    } else {
      setResendCooldown(60);
      setError('');
    }
  };

  const handleCreateProfile = async () => {
    const validation = validateUsername(username);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setLoading(true);
    setError('');
    const { error: profileError } = await createProfile(validation.normalized, username.trim());
    setLoading(false);
    if (profileError) {
      if (profileError.message?.includes('duplicate') || profileError.code === '23505') {
        setError('Ta nazwa jest już zajęta');
      } else {
        setError(profileError.message ?? 'Nie udało się utworzyć profilu');
      }
    } else {
      router.replace('/(tabs)');
    }
  };

  // ── Headline + sub copy per step ─────────────────────────────
  const renderHeadline = () => {
    if (step === 'email') {
      return (
        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>Twój rider tag</Text>
          <Text style={[styles.headline, styles.headlineAccent]}>zaczyna się tutaj.</Text>
          <Text style={styles.subPrimary}>Wyślemy ci kod jednorazowy.</Text>
          <Text style={styles.subSecondary}>Bez hasła, bez śmieciowych maili.</Text>
        </View>
      );
    }
    if (step === 'verify_code') {
      return (
        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>Sprawdź skrzynkę.</Text>
          <Text style={[styles.headline, styles.headlineAccent]}>Kod ważny 10 minut.</Text>
          <Text style={styles.subPrimary}>Wpisz 6 cyfr z maila.</Text>
          <Text style={styles.subSecondary}>Jeśli nie ma — sprawdź spam.</Text>
        </View>
      );
    }
    return (
      <View style={styles.headlineBlock}>
        <Text style={styles.headline}>Wybierz nick.</Text>
        <Text style={[styles.headline, styles.headlineAccent]}>Tym podpiszesz swoje czasy.</Text>
        <Text style={styles.subPrimary}>3-20 znaków. Litery, cyfry, _ i -.</Text>
        <Text style={styles.subSecondary}>Nick widać na tablicy obok twojego czasu.</Text>
      </View>
    );
  };

  // ── Form per step ────────────────────────────────────────────
  const renderEmailForm = () => (
    <View style={styles.formBlock}>
      <Text style={styles.fieldLabel}>EMAIL</Text>
      <TextInput
        style={[
          styles.input,
          emailFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
        placeholder="twoj@email.com"
        placeholderTextColor="rgba(242,244,243,0.4)"
        value={email}
        onChangeText={setEmail}
        onFocus={() => setEmailFocused(true)}
        onBlur={() => setEmailFocused(false)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.ctaWrap}>
        <Btn
          size="lg"
          onPress={handleSendCode}
          disabled={loading || sendCooldown > 0}
        >
          {loading
            ? 'WYSYŁAM…'
            : sendCooldown > 0
              ? `WYŚLIJ PONOWNIE (${sendCooldown}s)`
              : 'WYŚLIJ KOD'}
        </Btn>
      </View>
    </View>
  );

  const renderVerifyForm = () => (
    <View style={styles.formBlock}>
      <Text style={styles.fieldLabel}>TWÓJ KOD</Text>
      <TextInput
        style={[
          styles.input,
          styles.codeInput,
          codeFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
        placeholder="000000"
        placeholderTextColor="rgba(242,244,243,0.4)"
        value={otpCode}
        onChangeText={setOtpCode}
        onFocus={() => setCodeFocused(true)}
        onBlur={() => setCodeFocused(false)}
        keyboardType="number-pad"
        maxLength={8}
        editable={!loading}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.ctaWrap}>
        <Btn size="lg" onPress={handleVerifyCode} disabled={loading}>
          {loading ? 'WERYFIKUJĘ…' : 'POTWIERDŹ'}
        </Btn>
      </View>
      <View style={styles.linkRow}>
        <Pressable
          onPress={handleResend}
          disabled={resendCooldown > 0}
          style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
        >
          <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDim]}>
            {resendCooldown > 0 ? `PONOWNIE ZA ${resendCooldown}s` : 'WYŚLIJ PONOWNIE'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { setStep('email'); setError(''); setOtpCode(''); }}
          style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
        >
          <Text style={styles.linkText}>ZMIEŃ EMAIL</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderProfileForm = () => (
    <View style={styles.formBlock}>
      <Text style={styles.fieldLabel}>RIDER TAG</Text>
      <TextInput
        style={[
          styles.input,
          usernameFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
        placeholder="twoj.tag"
        placeholderTextColor="rgba(242,244,243,0.4)"
        value={username}
        onChangeText={setUsername}
        onFocus={() => setUsernameFocused(true)}
        onBlur={() => setUsernameFocused(false)}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        editable={!loading}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.ctaWrap}>
        <Btn size="lg" onPress={handleCreateProfile} disabled={loading}>
          {loading ? 'TWORZĘ PROFIL…' : 'DOŁĄCZ DO LIGI'}
        </Btn>
      </View>
    </View>
  );

  // Auth-context error (e.g. profile fetch failed) — replaces email form
  const renderAuthErrorPanel = () => (
    <View style={styles.formBlock}>
      <View style={styles.errorPanel}>
        <Text style={styles.errorPanelTitle}>PROBLEM Z LOGOWANIEM</Text>
        <Text style={styles.errorPanelDesc}>{state.status === 'error' ? state.message : ''}</Text>
      </View>
      <View style={styles.ctaWrap}>
        <Btn size="lg" onPress={retryAuth}>SPRÓBUJ PONOWNIE</Btn>
      </View>
    </View>
  );

  const renderLegal = () => (
    <View style={styles.legalBlock}>
      <Text style={styles.legalText}>
        Logując się akceptujesz{' '}
        <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.termsUrl)}>
          regulamin
        </Text>
        {' '}i{' '}
        <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.privacyUrl)}>
          politykę prywatności
        </Text>
        .
      </Text>
    </View>
  );

  const showAuthErrorPanel = state.status === 'error' && step === 'email';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <NWDHeader rightContext={{ type: 'label', text: HEADER_LABEL[step] }} />
          <PageLabel text={PAGE_LABEL[step]} variant="default" />
          {renderHeadline()}
          {showAuthErrorPanel
            ? renderAuthErrorPanel()
            : step === 'email'
              ? renderEmailForm()
              : step === 'verify_code'
                ? renderVerifyForm()
                : renderProfileForm()}
          {step === 'email' && !showAuthErrorPanel ? renderLegal() : null}
        </ScrollView>
        <View style={styles.bottomBandWrap}>
          <BottomBand
            status="SEZON 01 · BETA"
            context="wczesny dostęp"
            variant="live"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  keyboardWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },

  // Headline
  headlineBlock: { paddingHorizontal: 24 },
  headline: {
    fontFamily: fonts.racing,
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  headlineAccent: { color: colors.accent },
  subPrimary: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(242,244,243,0.7)',
    marginTop: 12,
  },
  subSecondary: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: 'rgba(242,244,243,0.55)',
  },

  // Form
  formBlock: { paddingHorizontal: 24, marginTop: 60 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(242,244,243,0.5)',
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 2,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: 'rgba(0,255,135,0.25)',
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputFocused: { borderColor: 'rgba(0,255,135,0.6)' },
  inputError: { borderColor: 'rgba(255,71,87,0.6)' },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },

  errorText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
  },

  ctaWrap: { marginTop: 28 },

  // Resend / change-email row (verify_code step)
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 18,
  },
  linkBtn: { paddingVertical: 8, paddingHorizontal: 8 },
  linkBtnPressed: { opacity: 0.6 },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(242,244,243,0.55)',
    letterSpacing: 2,
  },
  linkTextDim: { color: 'rgba(242,244,243,0.32)' },

  // Auth-context error panel (sharp HUD danger)
  errorPanel: {
    backgroundColor: 'rgba(255,71,87,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.6)',
    borderRadius: 2,
    padding: 16,
  },
  errorPanelTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 2.5,
    marginBottom: 6,
  },
  errorPanelDesc: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(242,244,243,0.7)',
  },

  // Legal block (email step only)
  legalBlock: { marginTop: 34, paddingHorizontal: 24 },
  legalText: {
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 11,
    color: 'rgba(242,244,243,0.5)',
    lineHeight: 18,
  },
  legalLink: { color: 'rgba(0,255,135,0.8)', fontWeight: '600' },

  // Bottom band
  bottomBandWrap: { paddingBottom: 8 },
});
