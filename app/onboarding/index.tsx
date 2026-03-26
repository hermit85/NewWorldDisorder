// ═══════════════════════════════════════════════════════════
// Onboarding — Racing game intro · 3 slides + GPS gate
// Reanimated motion · topo atmosphere · league energy
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';
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
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Easing,
  FadeIn,
  SlideInUp,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography, fonts } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { requestLocationPermission } from '@/systems/gps';
import { useBetaFlow } from '@/hooks/useBetaFlow';
import { selectionTick, notifySuccess, tapLight } from '@/systems/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

// ── Topo Grid Background ─────────────────────────────────

function TopoBackground({ slideIndex }: { slideIndex: number }) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 20000, easing: Easing.linear }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [0, -30]) },
      { translateX: interpolate(drift.value, [0, 1], [-10, 10]) },
    ],
    opacity: interpolate(drift.value, [0, 0.5, 1], [0.04, 0.07, 0.04]),
  }));

  // Generate topo contour lines
  const lines = [];
  for (let i = 0; i < 12; i++) {
    const y = 80 + i * 65;
    const curveOffset = Math.sin(i * 0.7 + slideIndex) * 40;
    lines.push(
      <View
        key={`topo-${i}`}
        style={[
          topoStyles.contourLine,
          {
            top: y,
            left: -20 + curveOffset,
            right: -20 - curveOffset,
            transform: [{ rotate: `${-2 + i * 0.4}deg` }],
          },
        ]}
      />
    );
  }

  // Grid crosshairs
  const gridLines = [];
  for (let i = 0; i < 8; i++) {
    gridLines.push(
      <View key={`hgrid-${i}`} style={[topoStyles.gridLine, { top: i * (SCREEN_HEIGHT / 7) }]} />,
    );
  }
  for (let i = 0; i < 5; i++) {
    gridLines.push(
      <View key={`vgrid-${i}`} style={[topoStyles.gridLineV, { left: i * (SCREEN_WIDTH / 4) }]} />,
    );
  }

  return (
    <Animated.View style={[topoStyles.container, animatedStyle]} pointerEvents="none">
      {gridLines}
      {lines}
      {/* Corner telemetry marks */}
      <View style={[topoStyles.cornerMark, { top: 60, right: 20 }]}>
        <Text style={topoStyles.telemetryText}>ALT 1247m</Text>
      </View>
      <View style={[topoStyles.cornerMark, { bottom: 120, left: 20 }]}>
        <Text style={topoStyles.telemetryText}>GRD −18%</Text>
      </View>
    </Animated.View>
  );
}

const topoStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  contourLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: colors.accent,
    opacity: 0.5,
    borderRadius: 100,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textTertiary,
    opacity: 0.15,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.textTertiary,
    opacity: 0.1,
  },
  cornerMark: {
    position: 'absolute',
  },
  telemetryText: {
    fontFamily: fonts.racingLight,
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 2,
    opacity: 0.5,
  },
});

// ── Noise / Grain Overlay ────────────────────────────────

function GrainOverlay() {
  return <View style={grainStyles.overlay} pointerEvents="none" />;
}

const grainStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.03,
    // RN doesn't have CSS noise, but a subtle border effect
    // creates micro-texture on dark backgrounds
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.02)',
  },
});

// ── Animated Slide ───────────────────────────────────────

function SlideContent({ item, isActive }: { item: OnboardingSlide; isActive: boolean }) {
  const tagOpacity = useSharedValue(0);
  const tagTranslateY = useSharedValue(20);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(25);

  useEffect(() => {
    if (isActive) {
      // Staggered entrance
      tagOpacity.value = withDelay(100, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      tagTranslateY.value = withDelay(100, withSpring(0, { damping: 20, stiffness: 200 }));

      titleOpacity.value = withDelay(250, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
      titleTranslateY.value = withDelay(250, withSpring(0, { damping: 18, stiffness: 180 }));

      bodyOpacity.value = withDelay(450, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      bodyTranslateY.value = withDelay(450, withSpring(0, { damping: 20, stiffness: 200 }));
    } else {
      // Reset for next entrance
      tagOpacity.value = 0;
      tagTranslateY.value = 20;
      titleOpacity.value = 0;
      titleTranslateY.value = 30;
      bodyOpacity.value = 0;
      bodyTranslateY.value = 25;
    }
  }, [isActive]);

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagTranslateY.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  return (
    <View style={styles.slideContent}>
      <Animated.Text style={[styles.tag, tagStyle]}>{item.tag}</Animated.Text>
      <Animated.Text style={[styles.title, titleStyle]}>{item.title}</Animated.Text>
      <Animated.Text style={[styles.body, bodyStyle]}>{item.body}</Animated.Text>
    </View>
  );
}

// ── Race Page Indicator ──────────────────────────────────

function RaceIndicator({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.indicatorRow}>
      {Array.from({ length: total }, (_, i) => (
        <IndicatorSegment key={i} isActive={i === current} isDone={i < current} />
      ))}
    </View>
  );
}

function IndicatorSegment({ isActive, isDone }: { isActive: boolean; isDone: boolean }) {
  const width = useSharedValue(isActive ? 32 : 8);
  const opacity = useSharedValue(isActive ? 1 : isDone ? 0.5 : 0.2);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(isActive ? 32 : 8, { damping: 18, stiffness: 250 });
    opacity.value = withTiming(isActive ? 1 : isDone ? 0.5 : 0.2, { duration: 300 });
    if (isActive) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.sine) }),
          withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isActive, isDone]);

  const segmentStyle = useAnimatedStyle(() => ({
    width: width.value,
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.segmentWrapper}>
      {isActive && (
        <Animated.View style={[styles.segmentGlow, glowStyle]} />
      )}
      <Animated.View
        style={[
          styles.segment,
          isActive && styles.segmentActive,
          isDone && styles.segmentDone,
          segmentStyle,
        ]}
      />
    </View>
  );
}

// ── CTA Button ───────────────────────────────────────────

function RaceCTA({ label, onPress, variant = 'primary' }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'gps' }) {
  const scale = useSharedValue(1);
  const glowIntensity = useSharedValue(0);

  useEffect(() => {
    if (variant === 'primary' || variant === 'gps') {
      glowIntensity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sine) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sine) }),
        ),
        -1,
        true
      );
    }
  }, [variant]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowIntensity.value, [0, 1], [0, 0.3]),
    transform: [{ scale: interpolate(glowIntensity.value, [0, 1], [1, 1.05]) }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 });
  };

  const bgColor = variant === 'gps' ? colors.blue : variant === 'secondary' ? 'transparent' : colors.accent;
  const textColor = variant === 'secondary' ? colors.textSecondary : colors.bg;
  const borderStyle = variant === 'secondary' ? { borderWidth: 1, borderColor: colors.border } : {};
  const glowColor = variant === 'gps' ? 'rgba(0, 122, 255, 0.4)' : colors.accentGlow;

  return (
    <View>
      {(variant === 'primary' || variant === 'gps') && (
        <Animated.View
          style={[
            styles.ctaGlow,
            glowStyle,
            { backgroundColor: glowColor },
          ]}
          pointerEvents="none"
        />
      )}
      <AnimatedPressable
        style={[
          styles.ctaBtn,
          { backgroundColor: bgColor },
          borderStyle,
          buttonStyle,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={[styles.ctaBtnText, { color: textColor }]}>{label}</Text>
      </AnimatedPressable>
    </View>
  );
}

// ── Component ────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useBetaFlow();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const listRef = useRef<FlatList<OnboardingSlide>>(null);

  // Track page changes from swipe
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Finish onboarding -> show GPS gate
  const handleFinish = useCallback(async () => {
    notifySuccess();
    await completeOnboarding();
    setShowLocationPrompt(true);
  }, [completeOnboarding]);

  // Enter the app
  const handleEnterApp = useCallback(() => {
    notifySuccess();
    router.replace('/(tabs)');
  }, [router]);

  // CTA press — advance or finish
  const handleCta = useCallback(() => {
    selectionTick();
    if (currentIndex < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
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

  // ── GPS Gate (post-onboarding) ─────────────────────────

  if (showLocationPrompt) {
    return (
      <SafeAreaView style={styles.container}>
        <TopoBackground slideIndex={3} />
        <GrainOverlay />

        <Animated.View
          style={styles.gpsContent}
          entering={FadeIn.duration(400)}
        >
          <Animated.Text
            style={styles.gpsTag}
            entering={FadeIn.delay(100).duration(400)}
          >
            WERYFIKACJA
          </Animated.Text>

          <Animated.Text
            style={styles.gpsTitle}
            entering={SlideInUp.delay(200).duration(500).springify().damping(18)}
          >
            Ranking działa{'\n'}tylko z aktywnym GPS.
          </Animated.Text>

          <Animated.Text
            style={styles.gpsBody}
            entering={FadeIn.delay(400).duration(500)}
          >
            Bez lokalizacji możesz jechać trening, ale zweryfikowany zjazd wymaga GPS.
          </Animated.Text>

          <Animated.View
            entering={FadeIn.delay(600).duration(400)}
            style={styles.gpsActions}
          >
            {!permissionAsked ? (
              <RaceCTA label="AKTYWUJ GPS" onPress={handleRequestPermission} variant="gps" />
            ) : permissionGranted ? (
              <View style={styles.gpsGranted}>
                <Text style={styles.gpsGrantedText}>GPS AKTYWNY</Text>
                <View style={styles.gpsGrantedDot} />
              </View>
            ) : (
              <View style={styles.gpsDenied}>
                <Text style={styles.gpsDeniedText}>
                  Możesz włączyć później w Ustawieniach.
                </Text>
              </View>
            )}

            <RaceCTA
              label={permissionGranted ? 'WCHODZĘ' : 'JADĘ TRENING'}
              onPress={handleEnterApp}
              variant={permissionGranted ? 'primary' : 'secondary'}
            />
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Swipeable Onboarding Slides ────────────────────────

  const renderSlide = ({ item, index }: ListRenderItemInfo<OnboardingSlide>) => (
    <View style={styles.slide}>
      <SlideContent item={item} isActive={index === currentIndex} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TopoBackground slideIndex={currentIndex} />
      <GrainOverlay />

      {/* Top-right slide counter */}
      <Animated.View
        style={styles.slideCounter}
        entering={FadeIn.delay(600).duration(400)}
      >
        <Text style={styles.slideCounterText}>
          <Text style={styles.slideCounterCurrent}>{String(currentIndex + 1).padStart(2, '0')}</Text>
          <Text style={styles.slideCounterSep}> / </Text>
          <Text style={styles.slideCounterTotal}>{String(slides.length).padStart(2, '0')}</Text>
        </Text>
      </Animated.View>

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

      <Animated.View
        style={styles.footer}
        entering={FadeIn.delay(500).duration(400)}
      >
        <RaceIndicator total={slides.length} current={currentIndex} />
        <RaceCTA label={slides[currentIndex].cta} onPress={handleCta} />
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },

  // Slide counter (top-right)
  slideCounter: {
    position: 'absolute',
    top: 70,
    right: spacing.xxl,
    zIndex: 10,
  },
  slideCounterText: {
    fontFamily: fonts.racingLight,
    fontSize: 12,
  },
  slideCounterCurrent: {
    color: colors.accent,
    fontFamily: fonts.racing,
    fontSize: 14,
  },
  slideCounterSep: {
    color: colors.textTertiary,
  },
  slideCounterTotal: {
    color: colors.textTertiary,
    fontFamily: fonts.racingLight,
    fontSize: 12,
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
    letterSpacing: 6,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    marginBottom: spacing.lg,
    letterSpacing: -0.3,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    maxWidth: 300,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },

  // Race indicator
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 16,
  },
  segmentWrapper: {
    height: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segment: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.bgElevated,
  },
  segmentActive: {
    backgroundColor: colors.accent,
    height: 4,
    borderRadius: 2,
  },
  segmentDone: {
    backgroundColor: colors.textTertiary,
  },
  segmentGlow: {
    position: 'absolute',
    width: 40,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accentGlow,
  },

  // CTA button
  ctaBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg + 2,
    alignItems: 'center',
  },
  ctaBtnText: {
    ...typography.cta,
    letterSpacing: 3,
    fontFamily: fonts.bodySemiBold,
  },
  ctaGlow: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 4,
    bottom: 4,
    borderRadius: radii.lg + 4,
    backgroundColor: colors.accentGlow,
  },

  // GPS gate screen
  gpsContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  gpsTag: {
    ...typography.labelSmall,
    color: colors.blue,
    letterSpacing: 6,
    marginBottom: spacing.xl,
  },
  gpsTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 28,
    lineHeight: 36,
    marginBottom: spacing.lg,
    letterSpacing: -0.3,
  },
  gpsBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xxl + spacing.lg,
    maxWidth: 300,
  },
  gpsActions: {
    gap: spacing.md,
  },
  gpsGranted: {
    flexDirection: 'row',
    backgroundColor: colors.accentDim,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg + 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  gpsGrantedText: {
    ...typography.cta,
    color: colors.accent,
    letterSpacing: 3,
    fontFamily: fonts.bodySemiBold,
  },
  gpsGrantedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  gpsDenied: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  gpsDeniedText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
