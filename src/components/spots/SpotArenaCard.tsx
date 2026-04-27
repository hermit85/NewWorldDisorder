// ─────────────────────────────────────────────────────────────
// SpotArenaCard — single arena tile rendered on SPOTY.
//
// Replaces the older SpotCard which conflated spot status and
// pioneer slot using `spot.trailCount` (a denormalised scalar
// that mapSpot zeros out, hence the famous "PIONEER SLOT WOLNY"
// lie). This card takes a fully-derived SpotArenaState and just
// renders it, no further branching.
// ─────────────────────────────────────────────────────────────

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { MissionTone } from '@/features/home/mission';

export interface SpotArenaCardProps {
  label: string;
  title: string;
  meta: string;
  cta: string;
  tone?: MissionTone;
  onPress: () => void;
}

const TONE_TINTS: Record<MissionTone, { fg: string; bg: string }> = {
  green: { fg: colors.accent, bg: colors.accentDim },
  amber: { fg: colors.gold, bg: colors.goldDim },
  blue: { fg: colors.blue, bg: 'rgba(80, 180, 255, 0.14)' },
};

export function SpotArenaCard({
  label,
  title,
  meta,
  cta,
  tone = 'green',
  onPress,
}: SpotArenaCardProps) {
  const tints = TONE_TINTS[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.kickerWrap, { backgroundColor: tints.bg }]}>
        <Text style={[styles.kicker, { color: tints.fg }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title.toUpperCase()}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        {meta}
      </Text>
      <View style={styles.ctaRow}>
        <Text style={[styles.ctaLabel, { color: tints.fg }]} numberOfLines={1}>
          {cta.toUpperCase()}
        </Text>
        <Text style={[styles.ctaArrow, { color: tints.fg }]}>→</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  cardPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  kickerWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    fontFamily: fonts.racing,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaLabel: {
    fontFamily: fonts.racing,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
    flex: 1,
  },
  ctaArrow: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '800',
  },
});
