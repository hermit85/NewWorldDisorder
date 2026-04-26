// ═══════════════════════════════════════════════════════════
// PodiumPortraits — top-3 horizontal podium block.
//
// Three boxes side-by-side, gold/silver/bronze. The center box
// (gold) is taller — physical podium hierarchy. Each box owns:
// avatar (80×80 with podium-color border), rider tag, time, and
// delta (silver/bronze only). Tappable per-box for head-to-head
// drill-down.
//
// Avatar rendering is delegated via the `renderAvatar` prop so
// the consumer can drop in a real RiderAvatar with image-loader
// + fallback initials, while this primitive owns layout only.
// ═══════════════════════════════════════════════════════════

import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface PodiumEntry {
  userId: string;
  position: 1 | 2 | 3;
  username: string;
  bestTimeMs: number;
  /** Delta to leader in ms — only used for positions 2/3 */
  deltaMs?: number;
  isCurrentUser?: boolean;
}

export interface PodiumPortraitsProps {
  entries: PodiumEntry[];
  /** Render avatar node from outside — keeps image / upload concerns
   *  out of this primitive. Receives the entry, returns the avatar JSX. */
  renderAvatar: (entry: PodiumEntry, size: number) => ReactNode;
  onPressEntry?: (entry: PodiumEntry) => void;
}

const PODIUM_TONE: Record<1 | 2 | 3, { color: string; bg: string; border: string; size: number; height: number }> = {
  1: { color: colors.gold, bg: 'rgba(255, 210, 63, 0.10)', border: 'rgba(255, 210, 63, 0.40)', size: 80, height: 188 },
  2: { color: colors.silver, bg: 'rgba(201, 209, 214, 0.06)', border: 'rgba(201, 209, 214, 0.30)', size: 64, height: 168 },
  3: { color: colors.bronze, bg: 'rgba(224, 138, 92, 0.06)', border: 'rgba(224, 138, 92, 0.30)', size: 64, height: 168 },
};

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(2).padStart(5, '0')}` : s.toFixed(2);
}

function formatDelta(ms: number): string {
  return `+${(ms / 1000).toFixed(1)}s`;
}

export function PodiumPortraits({ entries, renderAvatar, onPressEntry }: PodiumPortraitsProps) {
  // Order on screen: 2 (left) · 1 (center) · 3 (right) — physical podium.
  const byPosition = new Map(entries.map((e) => [e.position, e]));
  const order: Array<1 | 2 | 3> = [2, 1, 3];

  return (
    <View style={styles.row}>
      {order.map((pos) => {
        const entry = byPosition.get(pos);
        if (!entry) {
          return <View key={`empty-${pos}`} style={[styles.box, { height: PODIUM_TONE[pos].height }]} />;
        }
        const tone = PODIUM_TONE[pos];
        const Container = onPressEntry ? Pressable : View;
        return (
          <Container
            key={entry.userId}
            {...(onPressEntry ? { onPress: () => onPressEntry(entry) } : {})}
            style={({ pressed }: { pressed?: boolean }) => [
              styles.box,
              {
                height: tone.height,
                borderColor: tone.border,
                backgroundColor: tone.bg,
              },
              pressed && styles.boxPressed,
              entry.isCurrentUser && styles.boxSelf,
            ]}
          >
            <Text style={[styles.posBadge, { color: tone.color }]}>{`#${pos}`}</Text>
            <View style={[styles.avatarSlot, { width: tone.size, height: tone.size, borderColor: tone.color }]}>
              {renderAvatar(entry, tone.size - 6)}
            </View>
            <Text style={styles.tag} numberOfLines={1}>
              @{entry.username}
            </Text>
            <Text style={[styles.time, { color: tone.color }]}>{formatTime(entry.bestTimeMs)}</Text>
            {entry.position !== 1 && entry.deltaMs != null && entry.deltaMs > 0 ? (
              <Text style={styles.delta}>{formatDelta(entry.deltaMs)}</Text>
            ) : null}
            {entry.isCurrentUser ? <Text style={styles.youTag}>TY</Text> : null}
          </Container>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  box: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  boxPressed: {
    transform: [{ scale: 0.98 }],
  },
  boxSelf: {
    borderColor: colors.borderHot,
    backgroundColor: colors.accentDim,
  },
  posBadge: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  avatarSlot: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    maxWidth: '100%',
  },
  time: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  delta: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.4,
  },
  youTag: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
    marginTop: 2,
  },
});
