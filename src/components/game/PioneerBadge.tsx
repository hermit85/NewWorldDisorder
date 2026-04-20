// ═══════════════════════════════════════════════════════════
// PioneerBadge — Sprint 4 minimal Pioneer identity mark.
//
// Lightning bolt ⚡ in signal green. No tier progression UI yet
// (rookie / trailblazer / legend etc. land in Sprint 6+ with the
// Hall of Fame). Sprint 4 just gives Pioneer identity visible
// presence on the trail header and on the Pioneer's leaderboard row.
//
// Philosophy (GPT): protect truth first, celebrate pioneers later.
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { hudColors, hudTypography } from '@/theme/gameHud';

export interface PioneerBadgeProps {
  size?: 'sm' | 'md';
  /** If true, renders "PIONEER" text next to the bolt. */
  label?: boolean;
}

// Lightning-bolt path — MaterialDesign's flash_on icon, 24x24 viewBox.
const BOLT_PATH = 'M13 2L3 14h7l-1 8 10-12h-7l1-8z';

export function PioneerBadge({ size = 'md', label = false }: PioneerBadgeProps) {
  const dim = size === 'sm' ? 14 : 18;
  return (
    <View style={styles.container} accessibilityLabel="Pioneer tej trasy">
      <Svg width={dim} height={dim} viewBox="0 0 24 24">
        <Path d={BOLT_PATH} fill={hudColors.pioneerMark} />
      </Svg>
      {label && <Text style={styles.label}>PIONEER</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    ...hudTypography.label,
    fontSize: 10,
    letterSpacing: 2,
    color: hudColors.pioneerMark,
  },
});
