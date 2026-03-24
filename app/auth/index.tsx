// ═══════════════════════════════════════════════════════════
// Auth Screen — Magic link login for NWD beta
// Feels like entering a league, not signing up for SaaS
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { useAuthContext } from '@/hooks/AuthContext';

type Step = 'email' | 'check_inbox' | 'create_profile';

export default function AuthScreen() {
  const router = useRouter();
  const { state, signInWithEmail, createProfile } = useAuthContext();
  const [step, setStep] = useState<Step>(
    state.status === 'needs_profile' ? 'create_profile' : 'email',
  );
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // React to auth state changes (e.g., deep link magic link callback)
  useEffect(() => {
    if (state.status === 'authenticated') {
      router.replace('/(tabs)');
    } else if (state.status === 'needs_profile') {
      setStep('create_profile');
    }
  }, [state.status]);

  const handleSendLink = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setLoading(true);
    setError('');

    const { error: authError } = await signInWithEmail(email.trim());

    setLoading(false);
    if (authError) {
      setError(authError.message ?? 'Failed to send link');
    } else {
      setStep('check_inbox');
    }
  };

  const handleCreateProfile = async () => {
    const clean = username.trim().toLowerCase();
    if (clean.length < 2) {
      setError('Rider tag must be at least 2 characters');
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(clean)) {
      setError('Letters, numbers, dots, dashes only');
      return;
    }

    setLoading(true);
    setError('');

    const { error: profileError } = await createProfile(clean, username.trim());

    setLoading(false);
    if (profileError) {
      if (profileError.message?.includes('duplicate') || profileError.code === '23505') {
        setError('That rider tag is taken');
      } else {
        setError(profileError.message ?? 'Failed to create profile');
      }
    } else {
      router.replace('/(tabs)');
    }
  };

  // Skip auth — dev/demo mode
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
          <Text style={styles.tagline}>ENTER THE LEAGUE</Text>
        </View>

        {step === 'email' && (
          <View style={styles.form}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="rider@email.com"
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
              style={[styles.cta, loading && styles.ctaDisabled]}
              onPress={handleSendLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.ctaText}>SEND MAGIC LINK</Text>
              )}
            </Pressable>

            <Pressable style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>SKIP — EXPLORE DEMO</Text>
            </Pressable>
          </View>
        )}

        {step === 'check_inbox' && (
          <View style={styles.form}>
            <View style={styles.inboxCard}>
              <Text style={styles.inboxIcon}>📧</Text>
              <Text style={styles.inboxTitle}>CHECK YOUR INBOX</Text>
              <Text style={styles.inboxDesc}>
                We sent a magic link to {email}. Tap it to enter the league.
              </Text>
            </View>

            <Pressable style={styles.skipBtn} onPress={() => setStep('email')}>
              <Text style={styles.skipText}>BACK</Text>
            </Pressable>
          </View>
        )}

        {step === 'create_profile' && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>CHOOSE YOUR RIDER TAG</Text>
            <Text style={styles.formDesc}>
              This is your name on the leaderboard. Choose wisely.
            </Text>

            <Text style={styles.label}>RIDER TAG</Text>
            <TextInput
              style={styles.input}
              placeholder="your.tag"
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
                <Text style={styles.ctaText}>ENTER THE LEAGUE</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Season badge */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>SEASON 01 · SŁOTWINY ARENA</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  brand: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 48,
    color: colors.textPrimary,
    letterSpacing: 12,
  },
  subtitle: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  tagline: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 6,
    marginTop: spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  formTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  formDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  label: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 3,
    marginBottom: spacing.xxs,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
  },
  error: {
    ...typography.bodySmall,
    color: colors.red,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 4,
    fontSize: 15,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  inboxCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  inboxIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  inboxTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  inboxDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.huge,
  },
  footerText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    letterSpacing: 3,
  },
});
