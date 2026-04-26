// ═══════════════════════════════════════════════════════════
// Onboarding — v8: 4-step (LIGA / RANKING / PROGRESS / WERYFIKACJA).
//
// Slide chrome (NWD header + 4-dot pagination + CTA pinned bottom)
// lives here so it stays locked at the same Y across all four
// steps. Slides 1-3 swipe horizontally inside a FlatList; step 4
// is the GPS permission gate, rendered in place of the FlatList
// once the rider taps the slide-03 CTA. The page counter (NN / 04)
// and the dot row treat the gate as the 4th step too, so the
// rider's mental model — "where am I in the onboarding" — never
// breaks.
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
import { LiveDot } from './_components/LiveDot';
import { PaginationDots } from './_components/PaginationDots';
import { CtaButton } from './_components/CtaButton';
import { SlideLiga } from './_slides/SlideLiga';
import { SlideRanking } from './_slides/SlideRanking';
import { SlideProgress } from './_slides/SlideProgress';
import { RadarPulse } from './_graphics/RadarPulse';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TOTAL_STEPS = 4; // 3 slides + GPS gate

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
    const gateCta = !permissionAsked
      ? { label: 'Aktywuj GPS', onPress: handleRequestPermission }
      : permissionGranted
        ? { label: 'Wchodzę', onPress: handleEnterApp }
        : { label: 'Trening offline', onPress: handleEnterApp };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerWrap}>
          <OnboardingHeader pageIndex={TOTAL_STEPS - 1} pageCount={TOTAL_STEPS} />
        </View>

        <Animated.View style={[styles.gateBody, fadeStyle]}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>WERYFIKACJA</Text>
            <LiveDot size={5} />
          </View>

          <View style={styles.gateHeadlineBlock}>
            <Text style={styles.gateHeadline}>Ranking działa</Text>
            <Text style={styles.gateHeadline}>tylko z aktywnym GPS.</Text>
          </View>

          <View style={styles.gateSubBlock}>
            <Text style={styles.gateSubPrimary}>
              Bez lokalizacji możesz jechać trening,
            </Text>
            <Text style={styles.gateSubSecondary}>
              ale zweryfikowany zjazd wymaga GPS.
            </Text>
          </View>

          <View style={styles.radarWrap}>
            <RadarPulse />
          </View>

          {permissionAsked && permissionGranted ? (
            <View style={styles.gpsGranted}>
              <View style={styles.gpsGrantedDot} />
              <Text style={styles.gpsGrantedText}>GPS AKTYWNY</Text>
            </View>
          ) : permissionAsked ? (
            <Text style={styles.gateDeniedText}>
              Włącz GPS w Ustawieniach aby jechać rankingowo.
            </Text>
          ) : null}
        </Animated.View>

        <View style={styles.bottom}>
          <PaginationDots count={TOTAL_STEPS} activeIndex={TOTAL_STEPS - 1} />
          <View style={styles.ctaWrap}>
            <CtaButton label={gateCta.label} onPress={gateCta.onPress} />
          </View>
        </View>
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
        <OnboardingHeader pageIndex={currentIndex} pageCount={TOTAL_STEPS} />
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
        <PaginationDots count={TOTAL_STEPS} activeIndex={currentIndex} />
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
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  ctaWrap: {
    width: '100%',
  },
  // ── GPS gate (step 04) ───────────────────────────────
  gateBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 14,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
  },
  gateHeadlineBlock: {
    marginTop: 16,
  },
  gateHeadline: {
    fontFamily: fonts.racing,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  gateSubBlock: {
    marginTop: 12,
    gap: 4,
  },
  gateSubPrimary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  gateSubSecondary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  radarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  gpsGranted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  gpsGrantedText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.accent,
  },
  gpsGrantedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  gateDeniedText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
