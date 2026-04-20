import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import {
  useFonts,
  Orbitron_400Regular,
  Orbitron_700Bold,
} from '@expo-google-fonts/orbitron';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { colors } from '@/theme/colors';
import { AuthProvider } from '@/hooks/AuthContext';
import { hydrateRunStore } from '@/systems/runStore';
import { initSaveQueue } from '@/systems/saveQueue';

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
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#0A0A0F', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontFamily: 'Orbitron_700Bold', fontSize: 14, color: '#FF3B30', letterSpacing: 3, marginBottom: 12 }}>
            CRASH
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            Coś poszło nie tak. Spróbuj ponownie.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: '#fff', fontSize: 13, letterSpacing: 2 }}>PONÓW</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // ── Hydrate run store + init save queue on mount ──
  useEffect(() => {
    hydrateRunStore().then(() => {
      initSaveQueue();
    });
  }, []);

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
          <Stack.Screen name="index" options={{ animation: 'none', contentStyle: { backgroundColor: '#0A0A0F' } }} />
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
              contentStyle: { backgroundColor: '#0A0A0F' },
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
