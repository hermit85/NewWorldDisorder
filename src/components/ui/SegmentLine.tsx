import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { colors } from '@/theme/colors';

type SegmentLineProps = {
  insetHorizontal?: number;
};

export const SegmentLine = memo(function SegmentLine({
  insetHorizontal = 0,
}: SegmentLineProps) {
  return (
    <View style={[styles.container, insetHorizontal > 0 && { marginHorizontal: insetHorizontal }]}>
      <Svg height={1} width="100%">
        <Line
          x1="0"
          y1="0.5"
          x2="100%"
          y2="0.5"
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="8 6"
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 1,
    overflow: 'hidden',
  },
});
