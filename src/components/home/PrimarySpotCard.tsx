// ═══════════════════════════════════════════════════════════
// PrimarySpotCard — home-screen shortcut to the user's primary
// bike park (most recently visited). Two variants:
//
//   active — name + one-liner summary + WEJDŹ affordance
//   empty  — PIERWSZY KROK prompt + ADD CTA
//
// Chunk 9 rebuilt home without any entry point to spot creation.
// This card restores the "Twój bike park" path from spec v1 §4.1
// and routes new-rider empty flow to /spot/new.
// ═══════════════════════════════════════════════════════════

import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { formatTimeShort } from '@/content/copy';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';
import { GlowButton } from '@/components/ui/GlowButton';

type Props =
  | {
      variant: 'active';
      spotId: string;
      spotName: string;
      trailCount: number;
      bestDurationMs: number | null;
    }
  | { variant: 'empty' };

function trailsLabel(n: number): string {
  if (n === 1) return '1 trasa';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} trasy`;
  return `${n} tras`;
}

export const PrimarySpotCard = memo(function PrimarySpotCard(props: Props) {
  const router = useRouter();

  const onActivePress = useCallback(() => {
    if (props.variant !== 'active') return;
    Haptics.selectionAsync().catch(() => undefined);
    router.push(`/spot/${props.spotId}`);
  }, [props, router]);

  if (props.variant === 'empty') {
    return (
      <View style={styles.card} accessibilityLabel="Pierwszy bike park — karta pusta">
        <Text style={styles.microLabel}>PIERWSZY KROK</Text>
        <Text style={styles.title}>Znajdź swój bike park</Text>
        <View style={styles.emptyCtaWrap}>
          <GlowButton
            label="+ Dodaj bike park"
            variant="primary"
            onPress={() => router.push('/spot/new')}
          />
        </View>
      </View>
    );
  }

  const { spotName, trailCount, bestDurationMs } = props;
  const summary = bestDurationMs != null
    ? `${trailsLabel(trailCount)} · Rekord ${formatTimeShort(bestDurationMs)}`
    : trailsLabel(trailCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otwórz bike park ${spotName}`}
      onPress={onActivePress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Text style={styles.microLabel}>TWÓJ BIKE PARK</Text>
      <Text style={styles.title} numberOfLines={1}>{spotName}</Text>
      <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
      <Text style={styles.cta}>WEJDŹ →</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: chunk9Colors.bg.surface,
    borderRadius: chunk9Radii.card,
    paddingVertical: chunk9Spacing.cardPadding,
    paddingHorizontal: chunk9Spacing.cardPadding,
  },
  cardPressed: { opacity: 0.85 },
  microLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.secondary,
  },
  title: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    marginTop: 6,
  },
  summary: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    marginTop: 4,
  },
  cta: {
    ...chunk9Typography.label13,
    color: chunk9Colors.accent.emerald,
    marginTop: 12,
  },
  emptyCtaWrap: {
    marginTop: 16,
  },
});
