// ─────────────────────────────────────────────────────────────
// TrailCard — canonical card-style trail row (per
// screens-spot-trail.jsx TrailRow)
//
// Used on spot detail and trail listings. Card surface (panel +
// hairline + cardRadius + 16 padding) with two horizontal rows:
//
//   ┌─────────────────────────────────────────────────────┐
//   │ NAME (Rajdhani 700 CAPS)               PB (TWÓJ PB) │
//   │ [DIFF pill] [TAG pill] [STATUS pill]    02:14.83    │
//   ├─ hairline ──────────────────────────────────────────┤
//   │ ⤷ length    ↓ drop                ⚡ JEDŹ           │
//   └─────────────────────────────────────────────────────┘
//
// Companion to flat-row TrailRow (BPH-style). Use TrailCard for
// browse/list contexts, TrailRow for dense map-attached lists.
// ─────────────────────────────────────────────────────────────
import { ReactNode, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { IconGlyph } from './IconGlyph';
import { Pill } from './Pill';
import { DifficultyPill, resolveDifficultyTone } from '@/components/ui/DifficultyPill';

export type TrailStatus = 'open' | 'validating' | 'closed';

export interface TrailCardProps {
  name: string;
  /** Trail.difficulty (easy/medium/hard/expert). */
  difficulty?: string | null;
  /** Trail.type — flow / tech / etc. Optional second pill. */
  trailType?: string | null;
  /** Status pill — open/validating/closed. */
  status?: TrailStatus;
  /** Pre-formatted length, e.g. "1.6 km". */
  length?: string | null;
  /** Pre-formatted drop, e.g. "320 m". */
  drop?: string | null;
  /** Pre-formatted PB time. Null/undefined = no PB shown. */
  pbTime?: string | null;
  /** Optional rank number to show under PB ("#23"). */
  rank?: number | null;
  /** Right-side CTA label (default: "JEDŹ"). */
  ctaLabel?: string;
  /** Hide CTA when trail isn't startable. */
  hideCta?: boolean;
  /** Override trailing pill — used for pioneer states ("PIONIER" etc). */
  pioneerLabel?: ReactNode;
  /** Glow border + e4 panel — for self/recent trail. */
  highlight?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const STATUS_PILL: Record<TrailStatus, { state: 'verified' | 'pending' | 'invalid'; label: string }> = {
  open: { state: 'verified', label: 'OPEN' },
  validating: { state: 'pending', label: 'W WALIDACJI' },
  closed: { state: 'invalid', label: 'ZAMKNIĘTA' },
};

export function TrailCard({
  name,
  difficulty,
  trailType,
  status = 'open',
  length,
  drop,
  pbTime,
  rank,
  ctaLabel = 'Jedź',
  hideCta = false,
  pioneerLabel,
  highlight = false,
  onPress,
  style,
}: TrailCardProps) {
  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  }, [onPress]);

  const tone = resolveDifficultyTone(difficulty, trailType);
  const statusPreset = STATUS_PILL[status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Trasa ${name}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        highlight && styles.cardHighlight,
        pressed && { borderColor: colors.borderHot },
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {name.toUpperCase()}
          </Text>
          <View style={styles.pillRow}>
            <DifficultyPill tone={tone} />
            {trailType ? (
              <Pill state="neutral" size="xs">{trailType}</Pill>
            ) : null}
            {pioneerLabel ?? (
              <Pill state={statusPreset.state} size="xs" dot={status === 'open' || status === 'validating'}>
                {statusPreset.label}
              </Pill>
            )}
          </View>
        </View>

        {pbTime ? (
          <View style={styles.pbBlock}>
            <Text style={styles.pbLabel}>
              {rank != null ? `PB · #${rank}` : 'TWÓJ PB'}
            </Text>
            <Text style={styles.pbTime}>{pbTime}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.metaGroup}>
          {length ? (
            <View style={styles.metaItem}>
              <IconGlyph name="line" size={11} color={colors.textSecondary} />
              <Text style={styles.metaText}>{length}</Text>
            </View>
          ) : null}
          {drop ? (
            <View style={styles.metaItem}>
              <IconGlyph name="arrow-right" size={11} color={colors.textSecondary} />
              <Text style={styles.metaText}>{drop}</Text>
            </View>
          ) : null}
        </View>

        {!hideCta ? (
          <View style={styles.ctaGroup}>
            <IconGlyph name="lock" size={12} variant="accent" />
            <Text style={styles.ctaText}>{ctaLabel.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: 16,
    gap: 12,
  },
  cardHighlight: {
    borderColor: colors.borderHot,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 20,
    lineHeight: 21,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.20, // -0.01em @ 20
    textTransform: 'uppercase',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pbBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pbLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.62, // 0.18em @ 9
    color: colors.textTertiary,
    fontWeight: '700',
  },
  pbTime: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 18,
    lineHeight: 18,
    color: colors.accent,
    fontWeight: '700',
    letterSpacing: -0.09, // -0.005em @ 18
    fontVariant: ['tabular-nums'],
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaGroup: {
    flexDirection: 'row',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.0, // 0.10em @ 10
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  ctaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1.8, // 0.18em @ 10
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

void spacing;
