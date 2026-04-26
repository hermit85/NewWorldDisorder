// ═══════════════════════════════════════════════════════════
// /__dev/onboarding-preview — standalone slide renderer for the
// v8 onboarding rewrite. Lets us screenshot each slide in
// isolation before wiring them into index.tsx.
//
// Dev-only. Returns null in production.
// Query: ?slide=01|02|03
// ═══════════════════════════════════════════════════════════

import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme/colors';
import { OnboardingHeader } from '../onboarding/components/Header';
import { PaginationDots } from '../onboarding/components/PaginationDots';
import { CtaButton } from '../onboarding/components/CtaButton';
import { SlideLiga } from '../onboarding/slides/SlideLiga';
import { SlideRanking } from '../onboarding/slides/SlideRanking';

const CTA_LABEL: Record<string, string> = {
  '01': 'Dalej',
  '02': 'Rozumiem',
  '03': 'Zaczynam',
};

export default function OnboardingPreviewScreen() {
  if (!__DEV__) return null;

  const params = useLocalSearchParams<{ slide?: string }>();
  const slide = (params.slide ?? '01') as '01' | '02' | '03';
  const index = slide === '02' ? 1 : slide === '03' ? 2 : 0;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.headerWrap}>
        <OnboardingHeader pageIndex={index} pageCount={3} />
      </View>

      <View style={styles.slideWrap}>
        {slide === '01' ? <SlideLiga /> : null}
        {slide === '02' ? <SlideRanking /> : null}
      </View>

      <View style={styles.bottom}>
        <PaginationDots count={3} activeIndex={index} />
        <View style={styles.ctaWrap}>
          <CtaButton label={CTA_LABEL[slide]} onPress={() => undefined} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerWrap: {
    flexShrink: 0,
  },
  slideWrap: {
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
});
