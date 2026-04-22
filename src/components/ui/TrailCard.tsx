import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTimeShort } from '@/content/copy';
import type { BikeParkTrailCardData } from '@/lib/api';
import { formatRelativeTimestamp } from '@/lib/api';
import { GlowButton } from '@/components/ui/GlowButton';
import { SegmentLine } from '@/components/ui/SegmentLine';
import { StatCell } from '@/components/ui/StatCell';
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

function formatActiveRidersLabel(count: number): string {
  return `${count}`;
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
  const ctaLabel = badgeLabel === 'W WALIDACJI' ? 'Jedź' : ctaLabelByState[state];
  const subtitle =
    state === 'pioneer'
      ? pioneerSubtitle ?? 'Dodana przez ciebie'
      : userData.lastRanAt
        ? `${formatRelativeTimestamp(userData.lastRanAt)} temu`
        : 'Jeszcze nie jechałeś';
  const metaParts = [
    formatDifficultyLabel(trail.difficulty),
    formatTrailTypeLabel(trail.type),
    trail.distanceM > 0 ? `${Math.round(trail.distanceM)}m` : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
          <View style={[styles.badge, badgeLabel === 'W WALIDACJI' && styles.badgeValidation]}>
            <Text
              style={[
                styles.badgeText,
                badgeLabel === 'W WALIDACJI' && styles.badgeValidationText,
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
        </Text>
      ) : null}

      <SegmentLine />

      <View style={styles.statsRow}>
        <StatCell
          label="PB"
          value={userData.pbMs ? formatTimeShort(userData.pbMs) : '—'}
        />
        <StatCell
          label="TOP"
          value={formatRankLabel(userData.position)}
        />
        <StatCell
          label="W MIESIĄCU"
          value={formatActiveRidersLabel(trail.activeRidersCount)}
          accent={isBeaten}
        />
      </View>

      {isBeaten && userData.beatenBy ? (
        <Text style={styles.deltaText}>
          DELTA · -{(userData.beatenBy.deltaMs / 1000).toFixed(1)}s
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
  statsRow: {
    flexDirection: 'row',
    gap: chunk9Spacing.cardChildGap,
  },
  deltaText: {
    ...chunk9Typography.label13,
    color: chunk9Colors.accent.emerald,
  },
  footerRow: {
    minHeight: 20,
  },
});
