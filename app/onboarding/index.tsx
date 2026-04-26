// ═══════════════════════════════════════════════════════════
// Onboarding — v8: 3 slides (LIGA / RANKING / PROGRESS) + GPS gate.
//
// Slide chrome (header + dots + CTA) lives here so it stays locked
// at the same Y across all three slides. Each slide owns only its
// own content + scroll. The GPS gate after slide 03 is unchanged
// from the prior flow — we only restyled the CTA labels.
//
// Lifecycle:
//   slide 03 CTA → handleFinish
//     → completeSlidesOnly()        (slides done, gate not yet)
//     → setShowLocationPrompt(true) (renders GPS gate)
//   GPS gate AKTYWUJ → requestLocationPermission()
//     → grant → handleEnterApp → completeOnboarding() → /(tabs)
//     → deny  → handleEnterApp → completeOnboarding() → /(tabs)
//   Authed rider deep-linking here → router.replace('/(tabs)')
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect, type ComponentType } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { requestLocationPermission } from '@/systems/gps';
import { useBetaFlow } from '@/hooks/useBetaFlow';
import { useAuthContext } from '@/hooks/AuthContext';
import { notifySuccess, tapLight } from '@/systems/haptics';
import { OnboardingHeader } from './_components/Header';
import { PaginationDots } from './_components/PaginationDots';
import { CtaButton } from './_components/CtaButton';
import { SlideLiga } from './_slides/SlideLiga';
import { SlideRanking } from './_slides/SlideRanking';
import { SlideProgress } from './_slides/SlideProgress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideDef {
  key: '01' | '02' | '03';
  cta: string;
  Component: ComponentType;
}

const SLIDES: SlideDef[] = [
  { key: '01', cta: 'Dalej', Component: SlideLiga },
  { key: '02', cta: 'Rozumiem', Component: SlideRanking },
  { key: '03', cta: 'Zaczynam', Component: SlideProgress },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeSlidesOnly, completeOnboarding } = useBetaFlow();
  const { isAuthenticated } = useAuthContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const fade = useSharedValue(0);
  const listRef = useRef<FlatList<SlideDef>>(null);

  // Authed rider hitting /onboarding via deep link/back stack: go home.
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleFinish = useCallback(async () => {
    notifySuccess();
    await completeSlidesOnly();
    fade.value = 0;
    setShowLocationPrompt(true);
    fade.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
  }, [completeSlidesOnly, fade]);

  const handleEnterApp = useCallback(async () => {
    notifySuccess();
    await completeOnboarding();
    // Auth-gated: every fresh rider must sign in before reaching tabs.
    // /auth has its own "Przeglądaj bez logowania" escape hatch for the
    // curious; we don't bypass it here.
    router.replace('/auth');
  }, [router, completeOnboarding]);

  const handleCta = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleFinish();
    }
  }, [currentIndex, handleFinish]);

  const handleRequestPermission = useCallback(async () => {
    tapLight();
    const result = await requestLocationPermission();
    setPermissionAsked(true);
    if (result.foreground) {
      setPermissionGranted(true);
      notifySuccess();
    }
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (showLocationPrompt) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.gpsContent, fadeStyle]}>
          <Text style={styles.gpsTag}>WERYFIKACJA</Text>
          <Text style={styles.gpsTitle}>
            Ranking działa{'\n'}tylko z aktywnym GPS.
          </Text>
          <Text style={styles.gpsBody}>
            Bez lokalizacji możesz jechać trening, ale zweryfikowany zjazd
            wymaga GPS.
          </Text>

          <View style={styles.gpsActions}>
            {!permissionAsked ? (
              <CtaButton label="Aktywuj GPS" onPress={handleRequestPermission} />
            ) : permissionGranted ? (
              <>
                <View style={styles.gpsGranted}>
                  <Text style={styles.gpsGrantedText}>GPS AKTYWNY</Text>
                  <View style={styles.gpsGrantedDot} />
                </View>
                <CtaButton label="Wchodzę do appki" onPress={handleEnterApp} />
              </>
            ) : (
              <>
                <View style={styles.gpsDenied}>
                  <Text style={styles.gpsDeniedText}>
                    Włącz GPS w Ustawieniach aby jechać rankingowo.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Trening offline"
                  onPress={handleEnterApp}
                  style={styles.gpsSecondaryBtn}
                >
                  <Text style={styles.gpsSecondaryText}>TRENING OFFLINE</Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const renderSlide = ({ item }: ListRenderItemInfo<SlideDef>) => (
    <View style={styles.slide}>
      <item.Component />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerWrap}>
        <OnboardingHeader pageIndex={currentIndex} pageCount={SLIDES.length} />
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <View style={styles.bottom}>
        <PaginationDots count={SLIDES.length} activeIndex={currentIndex} />
        <View style={styles.ctaWrap}>
          <CtaButton label={SLIDES[currentIndex].cta} onPress={handleCta} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerWrap: {
    flexShrink: 0,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  ctaWrap: {
    width: '100%',
  },
  // ── GPS gate ────────────────────────────────────────
  gpsContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  gpsTag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
    marginBottom: 16,
  },
  gpsTitle: {
    fontFamily: fonts.racing,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  gpsBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: 40,
    maxWidth: 340,
  },
  gpsActions: {
    gap: 12,
  },
  gpsGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  gpsGrantedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.accent,
  },
  gpsGrantedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  gpsDenied: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  gpsDeniedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  gpsSecondaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsSecondaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
});
