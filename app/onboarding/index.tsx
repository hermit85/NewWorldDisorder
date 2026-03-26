// ═══════════════════════════════════════════════════════════
// Onboarding — Racing game intro · 3 slides + GPS gate
// Uses RN Animated API only (no Reanimated — Expo Go compat)
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Dimensions,
  Animated,
  Easing,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography, fonts } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { requestLocationPermission } from '@/systems/gps';
import { useBetaFlow } from '@/hooks/useBetaFlow';
import { selectionTick, notifySuccess, tapLight } from '@/systems/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 20000, easing: Easing.linear, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  const opacity = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.04, 0.07, 0.04] });

  const lines = [];
  for (let i = 0; i < 12; i++) {
    const y = 80 + i * 65;
    const curveOffset = Math.sin(i * 0.7 + slideIndex) * 40;
    lines.push(
      <View
        key={`topo-${i}`}
        style={[
          topoStyles.contourLine,
          { top: y, left: -20 + curveOffset, right: -20 - curveOffset, transform: [{ rotate: `${-2 + i * 0.4}deg` }] },
        ]}
      />
    );
  }

  const gridLines = [];
  for (let i = 0; i < 8; i++) {
    gridLines.push(<View key={`hgrid-${i}`} style={[topoStyles.gridLine, { top: i * (SCREEN_HEIGHT / 7) }]} />);
  }
  for (let i = 0; i < 5; i++) {
    gridLines.push(<View key={`vgrid-${i}`} style={[topoStyles.gridLineV, { left: i * (SCREEN_WIDTH / 4) }]} />);
  }

  return (
    <Animated.View style={[topoStyles.container, { opacity, transform: [{ translateY }, { translateX }] }]} pointerEvents="none">
      {gridLines}
      {lines}
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
  container: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  contourLine: { position: 'absolute', height: 1, backgroundColor: colors.accent, opacity: 0.5, borderRadius: 100 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.textTertiary, opacity: 0.15 },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: colors.textTertiary, opacity: 0.1 },
  cornerMark: { position: 'absolute' },
  telemetryText: { fontFamily: fonts.racingLight, fontSize: 9, color: colors.textTertiary, letterSpacing: 2, opacity: 0.5 },
});

// ── Animated Slide ───────────────────────────────────────

function SlideContent({ item, isActive }: { item: OnboardingSlide; isActive: boolean }) {
  const tagAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      tagAnim.setValue(0);
      titleAnim.setValue(0);
      bodyAnim.setValue(0);
      Animated.stagger(150, [
        Animated.spring(tagAnim, { toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true }),
        Animated.spring(titleAnim, { toValue: 1, damping: 18, stiffness: 180, mass: 0.8, useNativeDriver: true }),
        Animated.spring(bodyAnim, { toValue: 1, damping: 20, stiffness: 200, mass: 0.8, useNativeDriver: true }),
      ]).start();
    } else {
      tagAnim.setValue(0);
      titleAnim.setValue(0);
      bodyAnim.setValue(0);
    }
  }, [isActive]);

  const makeStyle = (anim: Animated.Value, offset: number) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
  });

  return (
    <View style={styles.slideContent}>
      <Animated.Text style={[styles.tag, makeStyle(tagAnim, 20)]}>{item.tag}</Animated.Text>
      <Animated.Text style={[styles.title, makeStyle(titleAnim, 30)]}>{item.title}</Animated.Text>
      <Animated.Text style={[styles.body, makeStyle(bodyAnim, 25)]}>{item.body}</Animated.Text>
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
  const widthAnim = useRef(new Animated.Value(isActive ? 32 : 8)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : isDone ? 0.5 : 0.2)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(widthAnim, { toValue: isActive ? 32 : 8, damping: 18, stiffness: 250, mass: 0.8, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: isActive ? 1 : isDone ? 0.5 : 0.2, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [isActive, isDone]);

  return (
    <View style={styles.segmentWrapper}>
      <Animated.View
        style={[
          styles.segment,
          isActive && styles.segmentActive,
          isDone && styles.segmentDone,
          { width: widthAnim, opacity: opacityAnim },
        ]}
      />
    </View>
  );
}

// ── CTA Button ───────────────────────────────────────────

function RaceCTA({ label, onPress, variant = 'primary' }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'gps' }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, damping: 15, stiffness: 400, mass: 0.6, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, damping: 12, stiffness: 300, mass: 0.8, useNativeDriver: true }).start();
  };

  const bgColor = variant === 'gps' ? colors.blue : variant === 'secondary' ? 'transparent' : colors.accent;
  const textColor = variant === 'secondary' ? colors.textSecondary : '#0A0A0F';
  const borderStyle = variant === 'secondary' ? { borderWidth: 1, borderColor: colors.border } : {};

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.ctaBtn, { backgroundColor: bgColor }, borderStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Text style={[styles.ctaBtnText, { color: textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Component ────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeSlidesOnly, completeOnboarding } = useBetaFlow();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const listRef = useRef<FlatList<OnboardingSlide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleFinish = useCallback(async () => {
    notifySuccess();
    await completeSlidesOnly(); // slides done, but gate not yet
    fadeAnim.setValue(0);
    setShowLocationPrompt(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [completeSlidesOnly, fadeAnim]);

  const handleEnterApp = useCallback(async () => {
    notifySuccess();
    await completeOnboarding(); // full gate completed — now safe to mark done
    router.replace('/(tabs)');
  }, [router, completeOnboarding]);

  const handleCta = useCallback(() => {
    selectionTick();
    if (currentIndex < slides.length - 1) {
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

  // ── GPS Gate ───────────────────────────────────────────

  if (showLocationPrompt) {
    return (
      <SafeAreaView style={styles.container}>
        <TopoBackground slideIndex={3} />
        <Animated.View style={[styles.gpsContent, { opacity: fadeAnim }]}>
          <Text style={styles.gpsTag}>WERYFIKACJA</Text>
          <Text style={styles.gpsTitle}>
            Ranking działa{'\n'}tylko z aktywnym GPS.
          </Text>
          <Text style={styles.gpsBody}>
            Bez lokalizacji możesz jechać trening, ale zweryfikowany zjazd wymaga GPS.
          </Text>

          <View style={styles.gpsActions}>
            {!permissionAsked ? (
              <RaceCTA label="AKTYWUJ GPS" onPress={handleRequestPermission} variant="gps" />
            ) : permissionGranted ? (
              <View style={styles.gpsGranted}>
                <Text style={styles.gpsGrantedText}>GPS AKTYWNY</Text>
                <View style={styles.gpsGrantedDot} />
              </View>
            ) : (
              <View style={styles.gpsDenied}>
                <Text style={styles.gpsDeniedText}>Możesz włączyć później w Ustawieniach.</Text>
              </View>
            )}

            <RaceCTA
              label={permissionGranted ? 'WCHODZĘ' : 'JADĘ TRENING'}
              onPress={handleEnterApp}
              variant={permissionGranted ? 'primary' : 'secondary'}
            />
          </View>
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

      <View style={styles.slideCounter}>
        <Text style={styles.slideCounterText}>
          <Text style={styles.slideCounterCurrent}>{String(currentIndex + 1).padStart(2, '0')}</Text>
          <Text style={styles.slideCounterSep}> / </Text>
          <Text style={styles.slideCounterTotal}>{String(slides.length).padStart(2, '0')}</Text>
        </Text>
      </View>

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
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
      />

      <View style={styles.footer}>
        <RaceIndicator total={slides.length} current={currentIndex} />
        <RaceCTA label={slides[currentIndex].cta} onPress={handleCta} />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  slideCounter: { position: 'absolute', top: 70, right: spacing.xxl, zIndex: 10 },
  slideCounterText: { fontFamily: fonts.racingLight, fontSize: 12 },
  slideCounterCurrent: { color: colors.accent, fontFamily: fonts.racing, fontSize: 14 },
  slideCounterSep: { color: colors.textTertiary },
  slideCounterTotal: { color: colors.textTertiary, fontFamily: fonts.racingLight, fontSize: 12 },
  slide: { width: SCREEN_WIDTH, flex: 1, justifyContent: 'center' },
  slideContent: { paddingHorizontal: spacing.xxl },
  tag: { ...typography.labelSmall, color: colors.accent, letterSpacing: 6, marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, fontSize: 30, lineHeight: 38, marginBottom: spacing.lg, letterSpacing: -0.3 },
  body: { ...typography.body, color: colors.textSecondary, lineHeight: 24, maxWidth: 300 },
  footer: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, gap: spacing.lg },
  indicatorRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, height: 16 },
  segmentWrapper: { height: 4, justifyContent: 'center', alignItems: 'center' },
  segment: { height: 3, borderRadius: 2, backgroundColor: colors.bgElevated },
  segmentActive: { backgroundColor: colors.accent, height: 4, borderRadius: 2 },
  segmentDone: { backgroundColor: colors.textTertiary },
  ctaBtn: { borderRadius: radii.lg, paddingVertical: spacing.lg + 2, alignItems: 'center' },
  ctaBtnText: { ...typography.cta, letterSpacing: 3, fontFamily: fonts.bodySemiBold },
  gpsContent: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  gpsTag: { ...typography.labelSmall, color: colors.blue, letterSpacing: 6, marginBottom: spacing.xl },
  gpsTitle: { ...typography.h1, color: colors.textPrimary, fontSize: 28, lineHeight: 36, marginBottom: spacing.lg, letterSpacing: -0.3 },
  gpsBody: { ...typography.body, color: colors.textSecondary, lineHeight: 24, marginBottom: spacing.xxl + spacing.lg, maxWidth: 300 },
  gpsActions: { gap: spacing.md },
  gpsGranted: { flexDirection: 'row', backgroundColor: colors.accentDim, borderRadius: radii.lg, paddingVertical: spacing.lg + 2, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  gpsGrantedText: { ...typography.cta, color: colors.accent, letterSpacing: 3, fontFamily: fonts.bodySemiBold },
  gpsGrantedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  gpsDenied: { paddingVertical: spacing.md, alignItems: 'center' },
  gpsDeniedText: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },
});
