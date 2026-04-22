import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chunk9Colors, chunk9Typography } from '@/theme/chunk9';

type FeedRowProps = {
  type: 'beat' | 'rider' | 'trail';
  text: string;
  name: string;
  timestamp: string;
  onPress?: () => void;
};

const iconByType = {
  beat: '🏆',
  rider: '👤',
  trail: '🗺️',
} as const;

export const FeedRow = memo(function FeedRow({
  type,
  text,
  name,
  timestamp,
  onPress,
}: FeedRowProps) {
  const icon = iconByType[type];
  const highlightedText = text.includes(name) ? text.replace(name, '').trim() : text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
    >
      <Text style={styles.icon}>{icon}</Text>
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
  icon: {
    fontSize: 16,
    lineHeight: 18,
  },
  copyBlock: {
    flex: 1,
  },
  text: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  name: {
    color: chunk9Colors.text.primary,
    fontFamily: 'Inter_500Medium',
  },
  timestamp: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
    marginTop: 2,
  },
});
