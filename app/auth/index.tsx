// ═══════════════════════════════════════════════════════════
// Auth Screen — wejście do ligi NWD
// Email OTP (kod z maila) — prostszy i bardziej niezawodny niż magic link
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { useAuthContext } from '@/hooks/AuthContext';
import { LEGAL } from '@/constants/legal';
import { validateUsername } from '@/services/moderation';

type Step = 'email' | 'verify_code' | 'create_profile';

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
  const [sendCooldown, setSendCooldown] = useState(0); // initial send cooldown (after first send)
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

  // Cooldown timers
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

  /** Detect rate limit from Supabase error */
  const isRateLimited = (err: any): boolean => {
    const msg = (err?.message ?? '').toLowerCase();
    return msg.includes('rate limit') ||
      msg.includes('too many') ||
      msg.includes('429') ||
      err?.status === 429;
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Podaj prawidłowy adres email');
      return;
    }
    // Block spam clicks during cooldown
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
      setSendCooldown(30); // prevent rapid re-entry to email step + resend
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
    // If successful, onAuthStateChange will fire and redirect
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

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Brand header */}
        <View style={styles.header}>
          <Text style={styles.brand}>NWD</Text>
          <Text style={styles.subtitle}>NEW WORLD DISORDER</Text>
          <Text style={styles.tagline}>DOŁĄCZ DO LIGI</Text>
        </View>

        {step === 'email' && (
          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="twoj@email.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.cta, (loading || sendCooldown > 0) && styles.ctaDisabled]}
              onPress={handleSendCode}
              disabled={loading || sendCooldown > 0}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : sendCooldown > 0 ? (
                <Text style={styles.ctaText}>WYŚLIJ PONOWNIE ({sendCooldown}s)</Text>
              ) : (
                <Text style={styles.ctaText}>WYŚLIJ KOD</Text>
              )}
            </Pressable>

            <Pressable style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>PRZEGLĄDAJ BEZ LOGOWANIA</Text>
            </Pressable>

            <Text style={styles.legalNote}>
              Logując się akceptujesz{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.termsUrl)}>
                Regulamin
              </Text>
              {' '}i{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.privacyUrl)}>
                Politykę Prywatności
              </Text>
              .
            </Text>
          </View>
        )}

        {step === 'verify_code' && (
          <View style={styles.form}>
            <View style={styles.inboxCard}>
              <Text style={styles.inboxIcon}>📧</Text>
              <Text style={styles.inboxTitle}>SPRAWDŹ SKRZYNKĘ</Text>
              <Text style={styles.inboxDesc}>
                Wysłaliśmy kod logowania na{'\n'}{email}
              </Text>
              <Text style={styles.inboxHint}>
                Skopiuj kod z maila i wklej poniżej.
              </Text>
            </View>

            <Text style={styles.label}>TWÓJ KOD</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="00000000"
              placeholderTextColor={colors.textTertiary}
              value={otpCode}
              onChangeText={setOtpCode}
              keyboardType="number-pad"
              maxLength={8}
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.ctaText}>POTWIERDŹ</Text>
              )}
            </Pressable>

            <View style={styles.resendRow}>
              <Pressable
                style={styles.skipBtn}
                onPress={handleResend}
                disabled={resendCooldown > 0}
              >
                <Text style={[styles.skipText, resendCooldown > 0 && { color: colors.textTertiary }]}>
                  {resendCooldown > 0 ? `WYŚLIJ PONOWNIE (${resendCooldown}s)` : 'WYŚLIJ PONOWNIE'}
                </Text>
              </Pressable>

              <Pressable style={styles.skipBtn} onPress={() => { setStep('email'); setError(''); setOtpCode(''); }}>
                <Text style={styles.skipText}>ZMIEŃ EMAIL</Text>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'create_profile' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>TWOJA NAZWA W LIDZE</Text>
            <Text style={styles.formDesc}>
              Tak będziesz widoczny na tablicy wyników.
            </Text>

            <Text style={styles.label}>RIDER TAG</Text>
            <TextInput
              style={styles.input}
              placeholder="twoj.tag"
              placeholderTextColor={colors.textTertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              editable={!loading}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={handleCreateProfile}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.ctaText}>DOŁĄCZ DO LIGI</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Auth error state — e.g. profile fetch failed */}
        {state.status === 'error' && step === 'email' && (
          <View style={styles.form}>
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>PROBLEM Z LOGOWANIEM</Text>
              <Text style={styles.errorCardDesc}>{state.message}</Text>
            </View>
            <Pressable style={styles.cta} onPress={retryAuth}>
              <Text style={styles.ctaText}>SPRÓBUJ PONOWNIE</Text>
            </Pressable>
            <Pressable style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>PRZEGLĄDAJ BEZ LOGOWANIA</Text>
            </Pressable>
          </View>
        )}

        {/* Season badge */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>NWD · LIGA GRAVITY</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.huge },
  brand: { fontFamily: 'Orbitron_700Bold', fontSize: 48, color: colors.textPrimary, letterSpacing: 12 },
  subtitle: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, marginTop: spacing.sm },
  tagline: { ...typography.label, color: colors.accent, letterSpacing: 6, marginTop: spacing.md },
  form: { gap: spacing.md },
  formTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center', letterSpacing: 2 },
  formDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
  label: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginBottom: spacing.xxs },
  input: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.textPrimary, ...typography.input },
  codeInput: { textAlign: 'center', fontSize: 22, fontFamily: 'Orbitron_700Bold', letterSpacing: 6 },
  error: { ...typography.bodySmall, color: colors.red, textAlign: 'center' },
  cta: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { ...typography.cta, color: colors.bg, letterSpacing: 4, fontSize: 15 },
  skipBtn: { alignItems: 'center', paddingVertical: spacing.md },
  skipText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  inboxCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.accent },
  inboxIcon: { fontSize: 40, marginBottom: spacing.md },
  inboxTitle: { ...typography.h3, color: colors.textPrimary, letterSpacing: 2, marginBottom: spacing.sm },
  inboxDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  inboxHint: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, marginTop: spacing.sm, textAlign: 'center' },
  errorCard: { backgroundColor: 'rgba(255, 59, 48, 0.08)', borderWidth: 1, borderColor: colors.red, borderRadius: radii.lg, padding: spacing.xl, alignItems: 'center' },
  errorCardTitle: { ...typography.h3, color: colors.red, letterSpacing: 2, marginBottom: spacing.sm },
  errorCardDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  footer: { alignItems: 'center', marginTop: spacing.huge },
  footerText: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, letterSpacing: 3 },
  legalNote: { ...typography.labelSmall, color: colors.textTertiary, textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: spacing.md, paddingHorizontal: spacing.md },
  legalLink: { color: colors.textSecondary, textDecorationLine: 'underline' },
});
