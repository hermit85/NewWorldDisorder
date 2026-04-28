import React, { useState, useRef, useCallback, useEffect } from 'react';
import { isRunningInExpoGo } from 'expo';
import { Stack, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import {
  useFonts,
  Rajdhani_400Regular,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { AuthProvider } from '@/hooks/AuthContext';
import { hydrateRunStore } from '@/systems/runStore';
import { initSaveQueue } from '@/systems/saveQueue';
import { initSubmissionQueue } from '@/services/spotSubmission';

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN),
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: true,
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  profilesSampleRate: 1.0,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: __DEV__ ? 1.0 : 0.05,
  enableLogs: true,
  integrations: [
    navigationIntegration,
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
    }),
  ],
  enableNativeFramesTracking: !isRunningInExpoGo(),
});

// Side-effect import — registers the background location task with
// expo-task-manager at app init. MUST happen on every launch,
// including headless iOS background launches, otherwise incoming
// location batches have no handler to receive them. See
// src/features/recording/backgroundLocationTask.ts for the guard
// that makes this import idempotent under Fast Refresh.
import '@/features/recording/backgroundLocationTask';
// Ranked / practice real-run task — parallel registration with the
// pioneer recording task. Same "must run at app init every launch"
// requirement; see src/systems/realRunBackgroundTask.ts for details.
import '@/systems/realRunBackgroundTask';

// Debug drawer — only imported in dev
const DebugDrawerLazy = __DEV__
  ? require('@/components/dev/DebugDrawer').DebugDrawer
  : null;

// ── Error Boundary — catches crashes, shows recovery UI ──
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[NWD] Uncaught error:', error, info.componentStack);
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      // Error boundary stays on plain RN primitives — using nwd/Btn
      // here would couple the last-resort UI to component code that
      // could itself be the source of the error. Hand-styled is the
      // safe fallback. Font family pulled from typography tokens so
      // the one variable that can drift gets the canonical token.
      const err = this.state.error;
      const stackHead = err?.stack?.split('\n').slice(0, 6).join('\n') ?? '';
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontFamily: fonts.racing, fontSize: 14, color: colors.danger, letterSpacing: 3, marginBottom: 12 }}>
            CRASH
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: 13, textAlign: 'center', marginBottom: 8, fontWeight: '600' }}>
            {err?.name ?? 'Error'}: {err?.message ?? 'unknown'}
          </Text>
          <Text selectable style={{ color: colors.textSecondary, fontSize: 10, fontFamily: 'Courier', textAlign: 'left', marginBottom: 24 }}>
            {stackHead}
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13, letterSpacing: 2 }}>PONÓW</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const [fontsLoaded] = useFonts({
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // ── Hydrate run store + init save queue on mount ──
  // Wrap the chain so any failure surfaces to Sentry and the console
  // instead of becoming a silently-rejected promise. hydrateRunStore
  // catches internally today, but the queue inits start async drains
  // whose rejections would otherwise vanish.
  useEffect(() => {
    void (async () => {
      try {
        await hydrateRunStore();
        initSaveQueue();
        initSubmissionQueue();
      } catch (e) {
        console.error('[NWD] App init chain failed:', e);
        Sentry.captureException(e, { tags: { phase: 'app-init' } });
      }
    })();
  }, []);

  useEffect(() => {
    navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  // ── Debug drawer toggle (5-tap) ──
  const [debugOpen, setDebugOpen] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDebugTap = useCallback(() => {
    if (!__DEV__) return;
    tapCountRef.current++;
    if (tapCountRef.current >= 5) {
      setDebugOpen((v) => !v);
      tapCountRef.current = 0;
    }
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <AppErrorBoundary>
    <AuthProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none', contentStyle: { backgroundColor: colors.bg } }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" options={{ animation: 'fade' }} />
          <Stack.Screen
            name="auth/index"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="onboarding/index"
            options={{
              animation: 'none',
              gestureEnabled: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
          <Stack.Screen
            name="trail/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="trail/new"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="run/active"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="run/recording"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="run/review"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="run/rejected"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="run/result"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
          <Stack.Screen
            name="spot/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="help/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="settings/index"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="settings/delete-account"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>

        {/* Debug trigger — invisible 5-tap zone in bottom-right corner */}
        {__DEV__ && (
          <Pressable
            style={debugStyles.trigger}
            onPress={handleDebugTap}
          >
            {debugOpen && <View style={debugStyles.indicator} />}
          </Pressable>
        )}

        {/* Debug drawer overlay */}
        {__DEV__ && debugOpen && DebugDrawerLazy && (
          <DebugDrawerLazy onClose={() => setDebugOpen(false)} />
        )}
      </View>
    </AuthProvider>
    </AppErrorBoundary>
  );
}

const debugStyles = StyleSheet.create({
  trigger: {
    position: 'absolute',
    bottom: 90,
    right: 0,
    width: 44,
    height: 44,
    zIndex: 9998,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0f0',
    position: 'absolute',
    top: 4,
    right: 4,
  },
});

export default Sentry.wrap(RootLayout);
