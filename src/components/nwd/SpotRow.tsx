// ─────────────────────────────────────────────────────────────
// SpotRow — bike park list row (per screens-home.jsx SpotRow)
//
// Anatomy:
//   [marker 44] [name + sub]                  [pill] [chevron]
//
// Marker: 44×44 surface, mountain icon, accent for active spots,
//   warn for "new" pending spots.
// Name: Rajdhani 700 17px CAPS.
// Sub: mono 10px caps · region · distance · trail count.
// Trailing pill: accent w/ rider count, OR warn "Nowy".
// ─────────────────────────────────────────────────────────────
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { radii } from '@/theme/spacing';
import { IconGlyph, type IconName } from './IconGlyph';
import { Pill, type PillState } from './Pill';

export interface SpotRowProps {
  name: string;
  /** Region/voivodeship (e.g. "Małopolskie"). Will be uppercased. */
  region: string;
  /** Optional pre-formatted distance (e.g. "320 km"). */
  distance?: string | null;
  /** Trail count for the spot. Hidden when 0 or undefined. */
  trailCount?: number;
  /** "active" | "new" | "closed". */
  status?: 'active' | 'new' | 'closed';
  /** Number of riders shown on the trailing pill (active spots). */
  riders?: number | null;
  /** Override marker icon (default: mountain). */
  icon?: IconName;
  /** Trailing override — replaces the auto pill if provided. */
  trailing?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

function formatTrailWord(n: number): string {
  if (n === 1) return 'trasa';
  if (n < 5) return 'trasy';
  return 'tras';
}

export function SpotRow({
  name,
  region,
  distance,
  trailCount,
  status = 'active',
  riders,
  icon = 'spot',
  trailing,
  onPress,
  style,
}: SpotRowProps) {
  const handlePress = onPress
    ? () => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }
    : undefined;

  const markerTone =
    status === 'new' ? 'warn'
      : status === 'closed' ? 'closed'
        : 'active';

  const subParts: string[] = [region.toUpperCase()];
  if (distance) subParts.push(distance.toUpperCase());
  if (trailCount && trailCount > 0) subParts.push(`${trailCount} ${formatTrailWord(trailCount).toUpperCase()}`);

  const trailingNode =
    trailing
    ?? (status === 'new' ? <Pill state="pending">Nowy</Pill>
      : status === 'closed' ? <Pill state="invalid">Zamknięte</Pill>
        : riders != null ? <Pill state="accent">{`${riders}`}</Pill>
          : null);

  const Container = handlePress ? Pressable : View;

  return (
    <Container
      {...(handlePress
        ? { onPress: handlePress, accessibilityRole: 'button' as const }
        : {})}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        pressed && handlePress && styles.rowPressed,
        style,
      ]}
    >
      <View
        style={[
          styles.marker,
          markerTone === 'active' && styles.markerActive,
          markerTone === 'warn' && styles.markerWarn,
          markerTone === 'closed' && styles.markerClosed,
        ]}
      >
        <IconGlyph
          name={icon}
          size={20}
          color={
            markerTone === 'active' ? colors.accent
              : markerTone === 'warn' ? colors.warn
                : colors.textSecondary
          }
        />
      </View>

      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {name.toUpperCase()}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {subParts.join(' · ')}
        </Text>
      </View>

      {trailingNode}

      <IconGlyph
        name="chevron-right"
        size={16}
        color={colors.textTertiary}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowPressed: {
    borderColor: colors.borderHot,
  },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  markerActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  markerWarn: {
    backgroundColor: 'transparent',
    borderColor: colors.warn,
  },
  markerClosed: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 17,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.085, // -0.005em @ 17
    textTransform: 'uppercase',
  },
  sub: {
    ...typography.micro,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1.0, // 0.10em @ 10
    fontFamily: 'Inter_700Bold',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
