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

import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { GlowButton } from '@/components/ui/GlowButton';
import { FilterPill } from '@/components/ui/FilterPill';
import { PrimarySpotCard } from '@/components/home/PrimarySpotCard';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type Kind = 'home-no-spots' | 'spots-empty' | 'add-spot-success';

export default function EmptyStatesPreview() {
  if (!__DEV__) return null;

  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = (params.kind ?? 'home-no-spots') as Kind;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
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
