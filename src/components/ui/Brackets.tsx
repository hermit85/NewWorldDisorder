import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { chunk9Colors } from '@/theme/chunk9';

type BracketsProps = {
  color?: 'emerald' | 'dim';
};

const bracketColorMap = {
  emerald: chunk9Colors.accent.emerald,
  dim: chunk9Colors.bg.hairline,
} as const;

export const Brackets = memo(function Brackets({
  color = 'dim',
}: BracketsProps) {
  const borderColor = bracketColorMap[color];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.bracket, styles.topLeft, { borderColor }]} />
      <View style={[styles.bracket, styles.topRight, { borderColor }]} />
      <View style={[styles.bracket, styles.bottomLeft, { borderColor }]} />
      <View style={[styles.bracket, styles.bottomRight, { borderColor }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  bracket: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderWidth: 1.5,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
});
