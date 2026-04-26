import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatTimeShort } from '@/content/copy';
import type { BikeParkTrailCardData } from '@/lib/api';
import { formatRelativeTimestamp } from '@/lib/api';
import { Platform } from 'react-native';
import { GlowButton } from '@/components/ui/GlowButton';
import { colors } from '@/theme/colors';
import { spacing, radii } from '@/theme/spacing';

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

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

const captionMono10 = {
  fontFamily: monoFont,
  fontSize: 10,
  lineHeight: 14,
  letterSpacing: 1.4,
  textTransform: 'uppercase' as const,
};

const body13 = {
  fontFamily: 'Inter_500Medium',
  fontSize: 13,
  lineHeight: 19.5,
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: 18,
  },
  containerBeaten: {
    borderColor: 'rgba(0,255,135,0.55)',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  containerPressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: 0.56,
    color: colors.textPrimary,
  },
  meta: {
    ...captionMono10,
    color: colors.textSecondary,
  },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  badgeValidation: {
    borderColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    ...captionMono10,
    color: colors.textPrimary,
  },
  badgeValidationText: {
    color: colors.textSecondary,
  },
  subtitle: {
    ...body13,
    color: colors.textSecondary,
  },
  subtitlePrimary: {
    color: colors.textPrimary,
  },
  beatenCopy: {
    ...body13,
    color: colors.accent,
  },
  footerRow: {
    minHeight: 20,
  },
});
