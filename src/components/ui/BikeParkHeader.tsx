// ─────────────────────────────────────────────────────────────
// BikeParkHeader — Bike Park Hub identity card
//
// Drop-in replacement for the per-screen identity block. Models
// design-system/Bike Park Hub.html .parkHead component:
//
//   [logo SŁ] [name + region]
//   ─────────────────────────
//   [WARUNKI] [TRAS] [AKTYWNI]
//
// Conditions strip is data-driven — only renders cells we have
// real data for (warunki ← spot.status, tras ← trailCount,
// aktywni ← activeRidersToday). The "ZAMYKA 17:00" cell from
// the design needs hours data we don't ship yet, so it stays out.
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import type { Spot } from '@/data/types';

export interface BikeParkHeaderProps {
  spot: Spot;
  /** Fallback used by the "AKTYWNI" cell when activeRidersToday is 0 */
  fallbackActiveRiders?: number;
  style?: ViewStyle;
}

function logoFor(name: string): string {
  // First two characters of the name, capitalized. Falls back to "P"
  // for "Park" if a single-character name slips through.
  const stripped = name.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
  if (stripped.length >= 2) return stripped.slice(0, 2).toUpperCase();
  if (stripped.length === 1) return stripped.toUpperCase();
  return 'P';
}

function statusToWarunki(status: Spot['status']): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (status === 'active') return { label: 'OPEN', tone: 'good' };
  if (status === 'seasonal') return { label: 'OFF SEZON', tone: 'warn' };
  return { label: 'ZAMKNIĘTE', tone: 'bad' };
}

export function BikeParkHeader({ spot, fallbackActiveRiders = 0, style }: BikeParkHeaderProps) {
  const warunki = statusToWarunki(spot.status);
  const activeRiders = spot.activeRidersToday || fallbackActiveRiders;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.identityRow}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>{logoFor(spot.name)}</Text>
        </View>
        <View style={styles.identityCol}>
          <Text style={styles.name} numberOfLines={1}>
            {spot.name}
          </Text>
          <View style={styles.locRow}>
            <View style={styles.locDot} />
            <Text style={styles.locText} numberOfLines={1}>
              {/* § voice.label: regions/locations CAPS in mono caption.
                 Pre-fix shipped raw "mazowieckie" lowercase which broke the
                 mono-CAPS rule for label-class meta. */}
              {spot.region.toUpperCase()}
              {spot.trailCount > 0 ? ` · ${spot.trailCount} ${trailWord(spot.trailCount)}` : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.condStrip}>
        <View style={styles.condCell}>
          <Text style={styles.condLabel}>WARUNKI</Text>
          <Text
            style={[
              styles.condValue,
              warunki.tone === 'good' && styles.condValueGood,
              warunki.tone === 'warn' && styles.condValueWarn,
              warunki.tone === 'bad' && styles.condValueBad,
            ]}
          >
            {warunki.label}
          </Text>
        </View>

        <View style={[styles.condCell, styles.condCellMid]}>
          <Text style={styles.condLabel}>TRAS</Text>
          <Text style={styles.condValue}>{spot.trailCount}</Text>
        </View>

        <View style={[styles.condCell, styles.condCellLast]}>
          <Text style={styles.condLabel}>AKTYWNI</Text>
          <Text style={styles.condValue}>{activeRiders}</Text>
        </View>
      </View>
    </View>
  );
}

function trailWord(n: number): string {
  if (n === 1) return 'trasa';
  if (n < 5) return 'trasy';
  return 'tras';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.chrome,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  logo: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0, 255, 135, 0.10)',
    borderWidth: 1,
    borderColor: colors.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...typography.title,
    fontSize: 14,
    lineHeight: 14,
    color: colors.accent,
    letterSpacing: -0.28,
    fontWeight: '800',
  },
  identityCol: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  name: {
    ...typography.lead,
    fontSize: 18,
    lineHeight: 18,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: -0.18,
    fontWeight: '700',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSecondary,
  },
  locText: {
    ...typography.body,
    fontSize: 11,
    lineHeight: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  condStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  condCell: {
    flex: 1,
    gap: 3,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  condCellMid: {
    paddingHorizontal: 8,
  },
  condCellLast: {
    paddingLeft: 8,
    paddingRight: 0,
    borderRightWidth: 0,
  },
  condLabel: {
    ...typography.micro,
    fontSize: 8,
    letterSpacing: 1.92, // 0.24em @ 8px
    color: colors.textSecondary,
    fontWeight: '800',
  },
  condValue: {
    ...typography.lead,
    fontSize: 13,
    lineHeight: 14,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  condValueGood: {
    color: colors.accent,
  },
  condValueWarn: {
    color: colors.warn,
  },
  condValueBad: {
    color: colors.danger,
  },
});
