// ═══════════════════════════════════════════════════════════
// /__dev/empty-states — screenshot fixture for the three
// chunk 10.1 empty/success states that depend on DB content we
// can't reliably reproduce in-sim (fresh account, zero spots,
// post-submit success toast).
//
// Query: ?kind=home-no-spots | spots-empty | add-spot-success
// Dev-only (!__DEV__ returns null) and lives under app/__dev/
// so the Expo router group is visibly gated.
// ═══════════════════════════════════════════════════════════

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Platform, TextStyle } from 'react-native';
import { GlowButton } from '@/components/ui/GlowButton';
import { FilterPill } from '@/components/ui/FilterPill';
import { PrimarySpotCard } from '@/components/home/PrimarySpotCard';
import { colors } from '@/theme/colors';
import { spacing, radii } from '@/theme/spacing';

// Local alias to keep the stylesheet body unchanged. Dev-only screen.
const monoFontEmptyStates = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});
const chunk9Colors = {
  bg: { base: colors.bg, surface: colors.panel, hairline: colors.borderMid },
  text: { primary: colors.textPrimary, secondary: colors.textSecondary, tertiary: colors.textTertiary },
  accent: { emerald: colors.accent },
} as const;
const chunk9Spacing = {
  containerHorizontal: spacing.pad,
  sectionVertical: spacing.lg,
  cardPadding: spacing.pad,
  cardChildGap: spacing.gap,
} as const;
const chunk9Radii = {
  card: radii.card,
  pill: radii.pill,
} as const;
const chunk9Typography = {
  display28: { fontFamily: 'Rajdhani_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: 0.56 } satisfies TextStyle,
  display56: { fontFamily: 'Rajdhani_700Bold', fontSize: 56, lineHeight: 68, letterSpacing: 0 } satisfies TextStyle,
  label13: { fontFamily: 'Rajdhani_700Bold', fontSize: 13, lineHeight: 18, letterSpacing: 2.86, textTransform: 'uppercase' } satisfies TextStyle,
  body13: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19.5 } satisfies TextStyle,
  captionMono10: { fontFamily: monoFontEmptyStates, fontSize: 10, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' } satisfies TextStyle,
} as const;

type Kind = 'home-no-spots' | 'spots-empty' | 'add-spot-success';

export default function EmptyStatesPreview() {
  if (!__DEV__) return null;

  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = (params.kind ?? 'home-no-spots') as Kind;

  // Chunk 10.2 dead-end audit: this dev route previously rendered
  // with zero navigation affordance. Small Wróć pill at the top so
  // the rider can always escape.
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={handleBack}
          hitSlop={16}
          style={styles.devBack}
        >
          <Text style={styles.devBackLabel}>← Wróć</Text>
        </Pressable>
        {kind === 'home-no-spots' ? <HomeNoSpots /> : null}
        {kind === 'spots-empty' ? <SpotsEmpty /> : null}
        {kind === 'add-spot-success' ? <AddSpotSuccess /> : null}
      </View>
    </SafeAreaView>
  );
}

function HomeNoSpots() {
  return (
    <View style={{ gap: chunk9Spacing.sectionVertical }}>
      <View>
        <Text style={styles.brand}>NWD</Text>
        <Text style={styles.brandSub}>LIGA GRAVITY</Text>
      </View>
      <PrimarySpotCard variant="empty" />
    </View>
  );
}

function SpotsEmpty() {
  return (
    <View style={{ gap: chunk9Spacing.sectionVertical }}>
      <Text style={styles.header}>SPOTY</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Brak bike parków w twojej okolicy.</Text>
        <GlowButton label="+ Dodaj pierwszy bike park" variant="primary" onPress={() => undefined} />
      </View>
    </View>
  );
}

function AddSpotSuccess() {
  return (
    <View style={{ gap: chunk9Spacing.sectionVertical }}>
      <Text style={styles.backLabel}>← Wróć</Text>
      <Text style={styles.screenTitle}>Dodaj bike park</Text>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Zgłoszono «Las Lipowy»</Text>
        <Text style={styles.cardBody}>
          Sprawdzimy w 24h. Dostaniesz notyfikację, gdy będzie zatwierdzony.
        </Text>
        <GlowButton label="Wróć do listy" variant="primary" onPress={() => undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: chunk9Colors.bg.base },
  container: {
    flex: 1,
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingTop: chunk9Spacing.sectionVertical,
  },
  brand: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  brandSub: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    marginTop: 2,
  },
  header: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
  },
  empty: {
    paddingVertical: 32,
    gap: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    textAlign: 'center',
  },
  backLabel: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  devBack: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 8,
  },
  devBackLabel: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  screenTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: chunk9Colors.bg.hairline,
  },
  dotActive: { backgroundColor: chunk9Colors.accent.emerald },
  card: {
    backgroundColor: chunk9Colors.bg.surface,
    borderRadius: chunk9Radii.card,
    padding: chunk9Spacing.cardPadding,
    gap: 12,
  },
  cardTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    fontSize: 22,
    lineHeight: 28,
  },
  cardBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
});
