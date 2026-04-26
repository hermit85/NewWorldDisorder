// ═══════════════════════════════════════════════════════════
// SpotCard — hero tile for the Spoty tab. 220-ish px tall card
// with a stylized arena-map silhouette in the top band, then
// title + region/distance + live stats + KOM callout + a
// context-specific CTA at the bottom.
//
// Three CTA states:
//   active  → POJEDŹ DO   (regular spot, not your home)
//   home    → WRÓĆ DO X   (your home spot, has history)
//   pioneer → JEDŹ JAKO PIONIER  (no rider has claimed yet)
//
// The arena map is generated deterministically from spot id —
// stable per-spot without backend geometry. Real arena maps
// (when shipped) replace the silhouette via the `mapNode` prop.
// ═══════════════════════════════════════════════════════════

import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { LiveDot } from '../brand/LiveDot';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type SpotCardCta = 'active' | 'home' | 'pioneer';

export interface SpotCardProps {
  /** Stable id, used to seed the silhouette. */
  spotId: string;
  name: string;
  region: string;
  /** Pre-formatted distance "320 km". */
  distance?: string | null;
  trailCount: number;
  /** Live count — pulses if > 0. */
  ridersNow?: number | null;
  /** Daily count (no pulse). */
  ridersToday?: number | null;
  /** KOM callout (e.g. "Kamil Z. · 1:21.0 (Czarna)"). */
  komLine?: string | null;
  /** CTA semantic — drives label + dot tone. */
  ctaKind?: SpotCardCta;
  /** Override CTA label. */
  ctaLabel?: string;
  /** Override the silhouette band entirely (e.g. real arena SVG). */
  mapNode?: ReactNode;
  onPress?: () => void;
}

const CTA_DEFAULTS: Record<SpotCardCta, string> = {
  active: 'Pojedź do',
  home: 'Wróć do areny',
  pioneer: 'Jedź jako pionier',
};

// 8-point silhouette derived deterministically from spotId. Kept
// as a low-poly mountain ridge, gradient-stroked across the card.
function generateArenaPath(spotId: string): string {
  const points = 8;
  const heights: number[] = [];
  for (let i = 0; i < points; i++) {
    const c = spotId.charCodeAt(i % spotId.length) || 65;
    heights.push(20 + (c % 40)); // 20–60 height range
  }
  const stepX = 320 / (points - 1);
  const yMax = 80;
  return heights
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${(yMax - h).toFixed(1)}`)
    .concat([`L 320 80`, `L 0 80`, `Z`])
    .join(' ');
}

export function SpotCard({
  spotId,
  name,
  region,
  distance,
  trailCount,
  ridersNow,
  ridersToday,
  komLine,
  ctaKind = 'active',
  ctaLabel,
  mapNode,
  onPress,
}: SpotCardProps) {
  const path = generateArenaPath(spotId);
  const isPioneer = ctaKind === 'pioneer';
  const accentColor = isPioneer ? colors.accent : colors.textSecondary;
  const ctaCopy = (ctaLabel ?? CTA_DEFAULTS[ctaKind]).toUpperCase();

  const Container = onPress ? Pressable : View;

  return (
    <Container
      {...(onPress ? { onPress, accessibilityRole: 'button' as const } : {})}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.card,
        isPioneer && styles.cardPioneer,
        pressed && onPress && styles.cardPressed,
      ]}
    >
      {/* Arena map band */}
      <View style={styles.mapBand}>
        {mapNode ?? (
          <Svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none">
            <Defs>
              <SvgLinearGradient id={`spot-grad-${spotId}`} x1="0%" y1="100%" x2="0%" y2="0%">
                <Stop offset="0%" stopColor={accentColor} stopOpacity="0.18" />
                <Stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
              </SvgLinearGradient>
            </Defs>
            <Path d={path} fill={`url(#spot-grad-${spotId})`} stroke="none" />
            <Path
              d={path
                .split('Z')[0]
                .replace(/L 320 80\s*L 0 80\s*$/, '')
                .trim()}
              fill="none"
              stroke={accentColor}
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>

      <View style={styles.body}>
        {/* Pill row */}
        <View style={styles.pillRow}>
          {ridersNow != null && ridersNow > 0 ? (
            <View style={styles.hotPill}>
              <LiveDot size={5} color={colors.accent} mode="pulse" />
              <Text style={styles.hotPillText}>{`${ridersNow} TERAZ`}</Text>
            </View>
          ) : null}
          {isPioneer ? (
            <View style={styles.pioneerPill}>
              <Text style={styles.pioneerPillText}>PIONEER SLOT WOLNY</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.name} numberOfLines={1}>
          {name.toUpperCase()}
        </Text>

        {/* Sub line */}
        <Text style={styles.sub} numberOfLines={1}>
          {[region.toUpperCase(), distance?.toUpperCase(), `${trailCount} ${trailWord(trailCount)}`]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>

        {/* KOM line */}
        {komLine ? (
          <Text style={styles.kom} numberOfLines={1}>
            KOM: {komLine}
          </Text>
        ) : null}

        {/* Daily count fallback if no live */}
        {!ridersNow && ridersToday != null && ridersToday > 0 ? (
          <Text style={styles.dailyCount}>{`${ridersToday} riderów dziś`}</Text>
        ) : null}

        {/* CTA */}
        <View style={[styles.cta, isPioneer && styles.ctaPioneer]}>
          <Text style={[styles.ctaLabel, isPioneer && styles.ctaLabelPioneer]}>{ctaCopy}</Text>
          <Text style={[styles.ctaArrow, isPioneer && styles.ctaArrowPioneer]}>→</Text>
        </View>
      </View>
    </Container>
  );
}

function trailWord(n: number): string {
  if (n === 1) return 'TRASA';
  if (n < 5) return 'TRASY';
  return 'TRAS';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 220,
  },
  cardPioneer: {
    borderColor: colors.borderHot,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  mapBand: {
    height: 80,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 16,
  },
  hotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.accentDim,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderHot,
  },
  hotPillText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.6,
  },
  pioneerPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderHot,
    backgroundColor: 'transparent',
  },
  pioneerPillText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.8,
  },
  name: {
    fontFamily: fonts.racing,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    lineHeight: 26,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  sub: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  kom: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  dailyCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaPioneer: {
    borderTopColor: colors.borderHot,
  },
  ctaLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  ctaLabelPioneer: {
    color: colors.accent,
  },
  ctaArrow: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  ctaArrowPioneer: {
    color: colors.accent,
  },
});
