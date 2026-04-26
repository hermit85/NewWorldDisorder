// ═══════════════════════════════════════════════════════════
// TrailThumbnailRow — horizontal-scroll trail picker with mini
// elevation profile + name + KOM time + active-state border.
//
// Replaces the previous flat pill row on Ranking. Each tile is
// wide enough for a glance (96px), short enough that 4 fit on
// most phone screens before needing scroll. Active tile has
// accent border + accent KOM time tint.
//
// The elevation profile is a deterministic but varied SVG
// silhouette so trails look distinct without per-trail data.
// When real geometry is available, the consumer can pass a
// `polyline` prop to override.
// ═══════════════════════════════════════════════════════════

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface TrailThumbnail {
  id: string;
  name: string;
  /** KOM time formatted ("1:21.0"). Null if no KOM yet. */
  komTime?: string | null;
  /** Optional override: SVG path data for the elevation profile.
   *  If absent, a deterministic silhouette is generated from id. */
  polyline?: string;
}

export interface TrailThumbnailRowProps {
  trails: TrailThumbnail[];
  activeTrailId: string | null;
  onSelect: (trailId: string) => void;
}

// Generate a deterministic elevation profile from a string id —
// stable per trail without backend geometry. Maps id chars to
// 8 control-point heights, then renders a smooth Catmull-Rom-ish
// curve as straight segments (cheap on RN).
function generateSilhouette(id: string): string {
  const points = 8;
  const heights: number[] = [];
  for (let i = 0; i < points; i++) {
    const charCode = id.charCodeAt(i % id.length) || 65;
    // Map ascii (32–126) to elevation 6–28
    heights.push(6 + (charCode % 22));
  }
  const stepX = 96 / (points - 1);
  const yMax = 32;
  const segments = heights.map((h, i) => {
    const x = i * stepX;
    const y = yMax - h;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return segments.join(' ');
}

export function TrailThumbnailRow({ trails, activeTrailId, onSelect }: TrailThumbnailRowProps) {
  if (trails.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {trails.map((trail) => {
        const isActive = trail.id === activeTrailId;
        const path = trail.polyline ?? generateSilhouette(trail.id);
        const stroke = isActive ? colors.accent : colors.textSecondary;
        return (
          <Pressable
            key={trail.id}
            onPress={() => onSelect(trail.id)}
            style={({ pressed }) => [
              styles.tile,
              isActive && styles.tileActive,
              pressed && styles.tilePressed,
            ]}
          >
            <View style={styles.silhouetteWrap}>
              <Svg width="96" height="32" viewBox="0 0 96 32">
                <Path
                  d={path}
                  stroke={stroke}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text
              style={[styles.name, isActive && styles.nameActive]}
              numberOfLines={1}
            >
              {trail.name.toUpperCase()}
            </Text>
            <Text
              style={[styles.kom, isActive && styles.komActive]}
              numberOfLines={1}
            >
              {trail.komTime ?? 'KOM —'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tile: {
    width: 116,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  tileActive: {
    borderColor: colors.borderHot,
    backgroundColor: colors.accentDim,
  },
  tilePressed: {
    transform: [{ scale: 0.98 }],
  },
  silhouetteWrap: {
    width: '100%',
    height: 32,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  name: {
    fontFamily: fonts.racing,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  nameActive: {
    color: colors.accent,
  },
  kom: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.4,
  },
  komActive: {
    color: colors.accent,
  },
});
