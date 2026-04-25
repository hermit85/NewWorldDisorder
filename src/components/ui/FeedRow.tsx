// ─────────────────────────────────────────────────────────────
// FeedRow — leaderboard / activity feed row
//
// Migrated to canonical: chunk9 → @/theme tokens, 🏆/👤/🗺️
// emoji map → IconGlyph (podium / spot / line) per § 13.5 no-emoji
// rule + § icons.md 12-glyph set.
// ─────────────────────────────────────────────────────────────
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconGlyph, type IconName } from '@/components/nwd';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

type FeedRowProps = {
  type: 'beat' | 'rider' | 'trail';
  text: string;
  name: string;
  timestamp: string;
  onPress?: () => void;
};

// Semantic mapping per icons.md:
//   beat  → podium (someone passed you on the leaderboard)
//   rider → spot   (rider activity at a location pin)
//   trail → line   (track-line glyph)
const iconByType: Record<FeedRowProps['type'], IconName> = {
  beat: 'podium',
  rider: 'spot',
  trail: 'line',
};

export const FeedRow = memo(function FeedRow({
  type,
  text,
  name,
  timestamp,
  onPress,
}: FeedRowProps) {
  const iconName = iconByType[type];
  const highlightedText = text.includes(name) ? text.replace(name, '').trim() : text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
    >
      <View style={styles.iconWrap}>
        <IconGlyph
          name={iconName}
          size={16}
          variant={type === 'beat' ? 'accent' : 'default'}
          color={type === 'beat' ? undefined : colors.textSecondary}
        />
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.text} numberOfLines={2}>
          <Text style={styles.name}>{name}</Text>
          {highlightedText ? ` ${highlightedText}` : ''}
        </Text>
      </View>
      <Text style={styles.timestamp}>{timestamp}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  containerPressed: {
    opacity: 0.86,
  },
  iconWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    flex: 1,
  },
  text: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  timestamp: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.0,
    color: colors.textTertiary,
    marginTop: 2,
    fontWeight: '700',
  },
});
