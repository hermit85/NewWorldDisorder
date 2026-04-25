// ─────────────────────────────────────────────────────────────
// HotLapStrip — gold "hot lap of the day" banner
//
// Shows the fastest run of the day on a notable trail. Models
// design-system/Bike Park Hub.html .hotLap component:
//
//   [★ icon] HOT LAP DZIŚ · TRAIL NAME
//            RIDER NAME · TIME · 32 min temu
//                                          [time large]
//
// Self-contained — accepts the formatted parts from the caller
// since the bike-park screen has access to RPC results that hold
// everything needed (rider name, trail name, time, recency).
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { formatTimeShort } from '@/content/copy';

export interface HotLapStripProps {
  trailName: string;
  riderName: string;
  durationMs: number;
  /** Pre-formatted "32 min temu" — caller owns relative-time formatting. */
  recencyLabel?: string | null;
  style?: ViewStyle;
}

export function HotLapStrip({
  trailName,
  riderName,
  durationMs,
  recencyLabel,
  style,
}: HotLapStripProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.icon}>
        <Text style={styles.iconGlyph}>★</Text>
      </View>

      <View style={styles.main}>
        <Text style={styles.kicker} numberOfLines={1}>
          HOT LAP DZIŚ · {trailName.toUpperCase()}
        </Text>
        <Text style={styles.body} numberOfLines={1}>
          {riderName.toUpperCase()}
          <Text style={styles.bodyTime}> · {formatTimeShort(durationMs)}</Text>
          {recencyLabel ? <Text style={styles.bodyMuted}> · {recencyLabel}</Text> : null}
        </Text>
      </View>

      <Text style={styles.heroTime}>{formatTimeShort(durationMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    // Soft gold gradient hint — flat tinted bg approximates the
    // CSS linear-gradient(90deg, rgba(255,210,63,0.05), transparent).
    backgroundColor: 'rgba(255, 210, 63, 0.04)',
  },
  icon: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    ...typography.title,
    fontSize: 12,
    lineHeight: 12,
    color: colors.gold,
    fontWeight: '800',
  },
  main: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  kicker: {
    ...typography.micro,
    fontSize: 8,
    letterSpacing: 1.92, // 0.24em @ 8px
    color: colors.gold,
    fontWeight: '800',
  },
  body: {
    ...typography.body,
    fontSize: 12,
    lineHeight: 14,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bodyTime: {
    ...typography.lead,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bodyMuted: {
    color: colors.textSecondary,
  },
  heroTime: {
    ...typography.lead,
    fontSize: 16,
    lineHeight: 16,
    color: colors.gold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
