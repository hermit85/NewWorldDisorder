// ═══════════════════════════════════════════════════════════
// LiveTicker — auto-rotating drama feed used as the
// "TODAY'S DRAMA" hero band on Ranking and the news strip on
// Home. Each event is a 1-2-line item; the ticker cycles ~3.6s
// per item with a fade-and-slide transition.
//
// Sprint 1 ships with a `mockEvents` fallback so the UI lights
// up before the backend events feed exists. Replace the data
// prop with a real subscription in Sprint 3.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type LiveTickerEventKind = 'kom_swap' | 'rank_up' | 'debut' | 'pioneer';

export interface LiveTickerEvent {
  id: string;
  kind: LiveTickerEventKind;
  /** "Kamil Z. zabrał KOM Czarna" */
  headline: string;
  /** Optional secondary line: "−0.4s · 12 min temu" */
  detail?: string;
  /** Optional trail name in original casing — used to mark relevance
      against the Home mission's current trail. */
  trailName?: string;
}

export interface LiveTickerProps {
  /** Events to cycle through. If empty / undefined, ticker hides
      (or renders the empty fallback if `emptyCopy` is set). */
  events?: LiveTickerEvent[];
  /** Per-item dwell time in ms. Default 3600. */
  intervalMs?: number;
  /** Section title shown above the rotating event. Default "TODAY'S DRAMA". */
  title?: string;
  /** Mission's current trail name. Events matching this name render
      in their normal accent color; unrelated events render muted so
      they don't compete with the primary mission card. */
  currentTrailName?: string;
  /** Kinds to filter out entirely. Use e.g. `['pioneer']` while the
      Home mission is a ranked run, so Pioneer slots don't read as
      a competing CTA under the hero. */
  suppressKinds?: LiveTickerEventKind[];
  /** Copy shown when no events remain after suppression. When unset,
      the ticker hides (legacy behaviour). */
  emptyCopy?: string;
}

// Pre-canned events that ship with the component so screens can
// drop the ticker in before the backend feed is ready. The shape
// matches what the eventual SSE / WebSocket subscription will emit.
export const MOCK_TICKER_EVENTS: LiveTickerEvent[] = [
  {
    id: 'mock-1',
    kind: 'kom_swap',
    headline: 'Kamil Z. zabrał KOM · Czarna',
    detail: '−0.4s · 12 min temu',
    trailName: 'Czarna',
  },
  {
    id: 'mock-2',
    kind: 'rank_up',
    headline: 'Mateusz P. AWANS na #4 · Dzida',
    detail: '+1 pozycja · weekend',
    trailName: 'Dzida',
  },
  {
    id: 'mock-3',
    kind: 'debut',
    headline: 'ania_park · debiut #8 · Prezydencka',
    detail: '1:28.4 · pierwszy zjazd rankingowy',
    trailName: 'Prezydencka',
  },
  {
    id: 'mock-4',
    kind: 'pioneer',
    headline: 'Nowa trasa: Salomea · WWA',
    detail: 'Pioneer slot wolny',
    trailName: 'Salomea',
  },
];

const KIND_COLOR: Record<LiveTickerEventKind, string> = {
  kom_swap: colors.gold,
  rank_up: colors.accent,
  debut: colors.warn,
  pioneer: colors.accent,
};

const KIND_GLYPH: Record<LiveTickerEventKind, string> = {
  kom_swap: '◆',     // KOM = the diamond
  rank_up: '↑',
  debut: '★',
  pioneer: '⬢',
};

export function LiveTicker({
  events = MOCK_TICKER_EVENTS,
  intervalMs = 3600,
  title = "TODAY'S DRAMA",
  currentTrailName,
  suppressKinds,
  emptyCopy,
}: LiveTickerProps) {
  // Filter out kinds the consumer wants suppressed (e.g. pioneer slots
  // when the active mission is a ranked run). Done before indexing so
  // the rotation stays stable and we don't hit out-of-bounds.
  const visibleEvents = suppressKinds && suppressKinds.length > 0
    ? events.filter((e) => !suppressKinds.includes(e.kind))
    : events;

  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const translate = useSharedValue(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset index when the visible-events set shrinks below the cursor.
  useEffect(() => {
    if (index >= visibleEvents.length) setIndex(0);
  }, [visibleEvents.length, index]);

  useEffect(() => {
    if (visibleEvents.length <= 1) return;
    intervalRef.current = setInterval(() => {
      // fade + slide out, swap, slide in
      opacity.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
      translate.value = withTiming(-8, { duration: 220 }, () => {
        translate.value = 8;
      });
      setTimeout(() => {
        setIndex((i) => (i + 1) % visibleEvents.length);
        opacity.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
        translate.value = withTiming(0, { duration: 320 });
      }, 240);
    }, intervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visibleEvents.length, intervalMs, opacity, translate]);

  const animatedItem = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  // Empty state — render a quiet pulse so Home keeps its rhythm
  // ("hero · ticker · quest · streak") even when no events exist.
  if (!visibleEvents.length) {
    if (!emptyCopy) return null;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.eventRow}>
          <Text style={[styles.glyph, styles.glyphMuted]}>·</Text>
          <View style={styles.eventBody}>
            <Text style={[styles.headline, styles.headlineMuted]} numberOfLines={2}>
              {emptyCopy}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const safeIndex = Math.min(index, visibleEvents.length - 1);
  const event = visibleEvents[safeIndex];
  if (!event) {
    return null;
  }
  const isRelated = !!currentTrailName
    && !!event.trailName
    && event.trailName.toLowerCase() === currentTrailName.toLowerCase();
  // Related events keep their kind color (pop). Unrelated events go
  // muted so they read as ambient league pulse, not a competing CTA.
  const eventColor = isRelated ? KIND_COLOR[event.kind] : colors.textSecondary;
  const glyph = KIND_GLYPH[event.kind];

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Animated.View style={[styles.eventRow, animatedItem]}>
        <Text style={[styles.glyph, { color: eventColor }]}>{glyph}</Text>
        <View style={styles.eventBody}>
          <Text style={[styles.headline, { color: eventColor }]} numberOfLines={2}>
            {event.headline}
          </Text>
          {event.detail ? (
            <Text style={styles.detail} numberOfLines={1}>
              {event.detail}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 88,
    gap: 10,
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  glyph: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 20,
    width: 18,
    textAlign: 'center',
  },
  glyphMuted: {
    color: colors.textTertiary,
  },
  headlineMuted: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  eventBody: {
    flex: 1,
    gap: 3,
  },
  headline: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  detail: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
