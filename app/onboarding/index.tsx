// ═══════════════════════════════════════════════════════════
// Onboarding — 3-screen teaser + post-onboarding location
// Swipeable pages · short copy · league vibe
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { requestLocationPermission } from '@/systems/gps';
import { useBetaFlow } from '@/hooks/useBetaFlow';
import { selectionTick, notifySuccess, tapLight } from '@/systems/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Content ──────────────────────────────────────────────

interface OnboardingSlide {
  key: string;
  tag: string;
  title: string;
  body: string;
  cta: string;
}

const slides: OnboardingSlide[] = [
  {
    key: 'game',
    tag: 'GRA',
    title: 'Prawdziwe trasy.\nPrawdziwa liga.',
    body: 'NWD zamienia realne trasy downhill w grę wyścigową. Twoja góra. Twój czas. Twoja pozycja.',
    cta: 'WEJDŹ DO LIGI',
  },
  {
    key: 'ranked',
    tag: 'ZJAZDY RANKINGOWE',
    title: 'Liczą się tylko\nzweryfikowane zjazdy.',
    body: 'Startuj z bramki. Trzymaj się trasy. Finiszuj na końcu. Tylko czyste przejazdy trafiają na tablicę.',
    cta: 'ROZUMIEM',
  },
  {
    key: 'training',
    tag: 'TRENING',
    title: 'Trenuj bez presji.\nRankuj co pewne.',
    body: 'Gdy warunki są słabe albo start nie był czysty, jedź trening. Liga ma być uczciwa.',
    cta: 'ZACZYNAM',
  },
];

// ── Component ────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useBetaFlow();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const fadeAnim = useSharedValue(1);

  // Track page changes from swipe
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Finish onboarding → show location prompt
  const handleFinish = useCallback(async () => {
    notifySuccess();
    await completeOnboarding();
    // Show location prompt as separate moment
    fadeAnim.value = withTiming(0, { duration: 200 }, () => {
      // will be set in JS thread
    });
    setShowLocationPrompt(true);
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, [completeOnboarding, fadeAnim]);

  // Enter the app
  const handleEnterApp = useCallback(() => {
    notifySuccess();
    router.replace('/(tabs)');
  }, [router]);

  // CTA press — advance or finish
  const handleCta = useCallback(() => {
    selectionTick();
    if (currentIndex < slides.length - 1) {
      // Scroll to next page
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      // Last slide → finish
      handleFinish();
    }
  }, [currentIndex, handleFinish]);

  // Location permission
  const handleRequestPermission = useCallback(async () => {
    tapLight();
    const result = await requestLocationPermission();
    setPermissionAsked(true);
    if (result.foreground) {
      setPermissionGranted(true);
      notifySuccess();
    }
  }, []);

  const animatedContainer = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  // ── Location Prompt (post-onboarding) ──────────────────

  if (showLocationPrompt) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.locationContent, animatedContainer]}>
          <Text style={styles.locationTag}>OSTATNI KROK</Text>
          <Text style={styles.locationTitle}>
            Włącz GPS{'\n'}żeby jechać.
          </Text>
          <Text style={styles.locationBody}>
            Bez lokalizacji nie zweryfikujemy zjazdu. Trening działa zawsze.
          </Text>

          {!permissionAsked ? (
            <Pressable style={styles.locationBtn} onPress={handleRequestPermission}>
              <Text style={styles.locationBtnText}>WŁĄCZ LOKALIZACJĘ</Text>
            </Pressable>
          ) : permissionGranted ? (
            <View style={styles.locationGranted}>
              <Text style={styles.locationGrantedText}>✓ GPS AKTYWNY</Text>
            </View>
          ) : (
            <View style={styles.locationDenied}>
              <Text style={styles.locationDeniedText}>
                Możesz włączyć później w Ustawieniach.
              </Text>
            </View>
          )}

          <Pressable style={styles.enterBtn} onPress={handleEnterApp}>
            <Text style={styles.enterBtnText}>
              {permissionGranted ? 'WCHODZĘ' : 'POMIŃ'}
            </Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Swipeable Onboarding Slides ────────────────────────

  const renderSlide = ({ item }: ListRenderItemInfo<OnboardingSlide>) => (
    <View style={styles.slide}>
      <View style={styles.slideContent}>
        <Text style={styles.tag}>{item.tag}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={listRef}
        data={slides}
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

      <View style={styles.footer}>
        <PageDots total={slides.length} current={currentIndex} />

        <Pressable style={styles.ctaBtn} onPress={handleCta}>
          <Text style={styles.ctaBtnText}>{slides[currentIndex].cta}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ── Page Dots ────────────────────────────────────────────

function PageDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            i < current && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Slide
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
  },
  slideContent: {
    paddingHorizontal: spacing.xxl,
  },
  tag: {
    ...typography.labelSmall,
    color: colors.accent,
    letterSpacing: 4,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 32,
    lineHeight: 40,
    marginBottom: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  // Page dots
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 24,
  },
  dotDone: {
    backgroundColor: colors.textTertiary,
  },

  // CTA button
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  ctaBtnText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 3,
  },

  // Location prompt
  locationContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  locationTag: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 4,
    marginBottom: spacing.xl,
  },
  locationTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 36,
    marginBottom: spacing.lg,
  },
  locationBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  locationBtn: {
    backgroundColor: colors.blue,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationBtnText: {
    ...typography.cta,
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  locationGranted: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationGrantedText: {
    ...typography.cta,
    color: colors.accent,
    letterSpacing: 2,
  },
  locationDenied: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationDeniedText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  enterBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  enterBtnText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 3,
  },
});
