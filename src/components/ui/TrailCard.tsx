import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatTimeShort } from '@/content/copy';
import type { BikeParkTrailCardData } from '@/lib/api';
import { formatRelativeTimestamp } from '@/lib/api';
import { GlowButton } from '@/components/ui/GlowButton';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type TrailCardProps = BikeParkTrailCardData & {
  onPress?: () => void;
  onCtaPress?: () => void;
};

const ctaLabelByState = {
  default: 'Jedź',
  beaten: 'Odgryź się',
  virgin: 'Jedź rankingowo',
  pioneer: 'Broń pozycji',
} as const;

function formatDifficultyLabel(difficulty: string): string {
  return difficulty.toUpperCase();
}

function formatTrailTypeLabel(type: string): string {
  return type.toUpperCase();
}

function formatRankLabel(position?: number): string {
  return position ? `#${position}` : '—';
}

export const TrailCard = memo(function TrailCard({
  trail,
  state,
  userData,
  pioneerStatusLabel,
  pioneerSubtitle,
  onPress,
  onCtaPress,
}: TrailCardProps) {
  const badgeLabel = pioneerStatusLabel ?? (state === 'virgin' ? 'NEW' : null);
  const isBeaten = state === 'beaten';
  const ctaVariant = isBeaten ? 'primary' : 'inlineLink';
  const ctaLabel = badgeLabel === 'DRUGI ZJAZD' ? 'Jedź' : ctaLabelByState[state];
  const subtitle =
    state === 'pioneer'
      ? pioneerSubtitle ?? 'Dodana przez ciebie'
      : userData.lastRanAt
        ? `${formatRelativeTimestamp(userData.lastRanAt)} temu`
        : 'Jeszcze nie jechałeś';
  // B4: collapse the 3-cell stat grid (PB / TOP / W MIESIĄCU) into a
  // single inline meta row so the card answers "can I ride this?" at
  // a glance. PB + position sit next to difficulty/type; full stats
  // still available on trail detail.
  const metaParts = [
    formatDifficultyLabel(trail.difficulty),
    formatTrailTypeLabel(trail.type),
    userData.pbMs ? `PB ${formatTimeShort(userData.pbMs)}` : null,
    userData.position ? formatRankLabel(userData.position) : null,
  ].filter(Boolean);
  const accessibilityLabel = [
    `Trasa ${trail.name}`,
    metaParts.join(', '),
    subtitle,
    `Akcja: ${ctaLabel}`,
  ].filter(Boolean).join('. ');

  const handleCardPress = useCallback(() => {
    // Spec v2 1.5: card tap fires haptic.tap (CTA delegates to GlowButton)
    Haptics.selectionAsync().catch(() => undefined);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handleCardPress}
      style={({ pressed }) => [
        styles.container,
        isBeaten && styles.containerBeaten,
        pressed && styles.containerPressed,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {trail.name}
          </Text>
          <Text style={styles.meta}>
            {metaParts.join(' · ')}
          </Text>
        </View>

        {badgeLabel ? (
          <View style={[styles.badge, badgeLabel === 'DRUGI ZJAZD' && styles.badgeValidation]}>
            <Text
              style={[
                styles.badgeText,
                badgeLabel === 'DRUGI ZJAZD' && styles.badgeValidationText,
              ]}
            >
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.subtitle, state === 'pioneer' && styles.subtitlePrimary]}>
        {subtitle}
      </Text>

      {isBeaten && userData.beatenBy ? (
        <Text style={styles.beatenCopy}>
          {userData.beatenBy.name} cię pobił · {formatRelativeTimestamp(userData.beatenBy.happenedAt)}
          {'  ·  -'}
          {(userData.beatenBy.deltaMs / 1000).toFixed(1)}s
        </Text>
      ) : null}

      <View style={styles.footerRow}>
        {ctaVariant === 'primary' ? (
          <GlowButton
            label={ctaLabel}
            onPress={onCtaPress}
            variant="primary"
          />
        ) : (
          <GlowButton
            label={ctaLabel}
            onPress={onCtaPress}
            variant="inlineLink"
          />
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: chunk9Spacing.cardChildGap,
    borderRadius: chunk9Radii.card,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    padding: chunk9Spacing.cardPaddingTight,
  },
  containerBeaten: {
    borderColor: 'rgba(0,255,135,0.55)',
    borderLeftWidth: 3,
    borderLeftColor: chunk9Colors.accent.emerald,
  },
  containerPressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: chunk9Spacing.cardChildGap,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    fontSize: 24,
    lineHeight: 24,
  },
  meta: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  badge: {
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  badgeValidation: {
    borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.primary,
  },
  badgeValidationText: {
    color: chunk9Colors.text.secondary,
  },
  subtitle: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  subtitlePrimary: {
    color: chunk9Colors.text.primary,
  },
  beatenCopy: {
    ...chunk9Typography.body13,
    color: chunk9Colors.accent.emerald,
  },
  footerRow: {
    minHeight: 20,
  },
});
