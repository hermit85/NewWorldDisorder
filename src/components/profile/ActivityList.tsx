// ═══════════════════════════════════════════════════════════
// ActivityList — "AKTYWNOŚĆ" section for the RIDER tab.
//
// Displaces the old MOJE ZJAZDY tab. Reads the same local
// FinalizedRun store so verified + rejected runs stay visible
// across install sessions until a user signs in and DB history
// takes over (future). Tap -> /run/result with the session id
// the store keyed against.
//
// Navigation deliberately uses the session-id-based /run/result
// route because /run/[id] isn't wired yet — Track C-G introduces
// the orphan-safe detail screen.
// ═══════════════════════════════════════════════════════════

import { memo, useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  getAllFinalizedRuns,
  removeFinalizedRunBySession,
  subscribeFinalizedRun,
  type FinalizedRun,
  type SaveStatus,
} from '@/systems/runStore';
import { deleteRun } from '@/lib/api';
import { chunk9Colors, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

// Rider tab lays out Player card → Stats → Aktywność → Osiągnięcia
// in a single ScrollView. The old ceiling of 10 rows (≈ 700 px on
// iPhone 16) shoved the badge grid off-screen — after a few runs
// the rider couldn't see their achievements without scrolling past
// half the activity list. Default view now collapses to 5 most
// recent; the expand button shows the rest without leaving the tab.
const COLLAPSED_VISIBLE = 5;

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const frac = Math.floor((ms % 1000) / 10);
  return min > 0
    ? `${min}:${sec.toString().padStart(2, '0')}.${frac.toString().padStart(2, '0')}`
    : `${sec}.${frac.toString().padStart(2, '0')}`;
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'przed chwilą';
  if (mins < 60) return `${mins} min temu`;
  if (hours < 24) return `${hours}h temu`;
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  const d = new Date(timestamp);
  return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

type StatusPill = { text: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' };

function getStatusPill(run: FinalizedRun): StatusPill {
  if (run.mode === 'practice') return { text: 'TRENING', tone: 'neutral' };
  const v = run.verification;
  if (!v || v.status === 'pending') return { text: 'OCZEKUJE', tone: 'warn' };
  if (v.isLeaderboardEligible) return { text: 'ZWERYFIKOWANY', tone: 'ok' };
  if (v.status === 'weak_signal') return { text: 'SŁABY SYGNAŁ', tone: 'warn' };
  return { text: 'NIEZALICZONY', tone: 'bad' };
}

function getSaveHint(status: SaveStatus): string | null {
  if (status === 'saving') return 'zapisuję…';
  if (status === 'queued') return 'w kolejce';
  if (status === 'failed') return 'zapis nieudany — dotknij aby ponowić';
  if (status === 'offline') return 'zapisano lokalnie';
  return null;
}

const RunRow = memo(function RunRow({
  run,
  onPress,
  onLongPress,
}: {
  run: FinalizedRun;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const pill = getStatusPill(run);
  const hint = getSaveHint(run.saveStatus);
  const pbFlag = run.backendResult?.isPb === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Zjazd ${run.trailName}, ${formatDuration(run.durationMs)}, ${pill.text}. Długie przytrzymanie — usuń.`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={600}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.trailName} numberOfLines={1}>{run.trailName}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.pill, styles[`pill_${pill.tone}`]]}>{pill.text}</Text>
          {pbFlag ? <Text style={styles.pbBadge}>PB</Text> : null}
          <Text style={styles.meta}>· {relativeTime(run.startedAt)}</Text>
        </View>
        {hint ? <Text style={styles.saveHint}>{hint}</Text> : null}
      </View>
      <Text style={[styles.time, pbFlag && styles.timePb]}>
        {formatDuration(run.durationMs)}
      </Text>
    </Pressable>
  );
});

export function ActivityList() {
  const router = useRouter();
  const [runs, setRuns] = useState<FinalizedRun[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setRuns(getAllFinalizedRuns());
    return subscribeFinalizedRun(() => setRuns(getAllFinalizedRuns()));
  }, []);

  const handleTap = useCallback(
    (run: FinalizedRun) => {
      Haptics.selectionAsync().catch(() => undefined);
      router.push({
        pathname: '/run/result',
        params: {
          runSessionId: run.sessionId,
          trailId: run.trailId,
          trailName: run.trailName,
        },
      });
    },
    [router],
  );

  const handleToggle = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    setExpanded((prev) => !prev);
  }, []);

  const handleLongPress = useCallback((run: FinalizedRun) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const backendId = run.backendResult?.run?.id;
    Alert.alert(
      'Usunąć zjazd?',
      `${run.trailName} · ${formatDuration(run.durationMs)}\n\nTej akcji nie cofniesz. Jeśli to był twój PB na tej trasie, kolejny najlepszy zjazd zajmie jego miejsce.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            // Unsaved local-only run (e.g. offline queue still pending):
            // no backend id yet, only drop from the cache.
            if (!backendId) {
              removeFinalizedRunBySession(run.sessionId);
              return;
            }
            const res = await deleteRun(backendId);
            if (res.ok) {
              removeFinalizedRunBySession(run.sessionId);
            } else {
              Alert.alert('Nie udało się usunąć', res.message);
            }
          },
        },
      ],
    );
  }, []);

  const visible = expanded ? runs : runs.slice(0, COLLAPSED_VISIBLE);
  const hasMore = runs.length > COLLAPSED_VISIBLE;

  if (runs.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AKTYWNOŚĆ</Text>
        <Text style={styles.emptyBody}>Jeszcze bez zjazdów. Pierwszy run odblokuje historię.</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AKTYWNOŚĆ</Text>
        {hasMore ? (
          <Text style={styles.sectionMeta}>{visible.length}/{runs.length}</Text>
        ) : null}
      </View>
      <View style={styles.list}>
        {visible.map((run) => (
          <RunRow
            key={run.sessionId}
            run={run}
            onPress={() => handleTap(run)}
            onLongPress={() => handleLongPress(run)}
          />
        ))}
      </View>
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Zwiń aktywność' : `Pokaż wszystkie ${runs.length} zjazdów`}
          onPress={handleToggle}
          style={({ pressed }) => [styles.expandBtn, pressed && styles.expandBtnPressed]}
        >
          <Text style={styles.expandLabel}>
            {expanded ? 'ZWIŃ' : `POKAŻ WSZYSTKIE (${runs.length})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
    marginTop: chunk9Spacing.sectionVertical,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
  },
  sectionMeta: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: chunk9Colors.bg.hairline,
  },
  rowPressed: { opacity: 0.6 },
  rowLeft: { flex: 1, marginRight: 16 },
  trailName: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pill: {
    ...chunk9Typography.captionMono10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  pill_ok: { color: chunk9Colors.accent.emerald, backgroundColor: 'rgba(0,255,135,0.08)' },
  pill_warn: { color: '#FFB547', backgroundColor: 'rgba(255,181,71,0.08)' },
  pill_bad: { color: '#FF4D6D', backgroundColor: 'rgba(255,77,109,0.08)' },
  pill_neutral: { color: chunk9Colors.text.secondary, backgroundColor: 'rgba(255,255,255,0.05)' },
  pbBadge: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.accent.emerald,
    borderWidth: 1,
    borderColor: chunk9Colors.accent.emerald,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  meta: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
    textTransform: 'none',
    letterSpacing: 0.5,
  },
  saveHint: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.tertiary,
    marginTop: 2,
    fontSize: 11,
  },
  time: {
    ...chunk9Typography.stat19,
    color: chunk9Colors.text.primary,
  },
  timePb: { color: chunk9Colors.accent.emerald },
  emptyBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  expandBtn: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
  },
  expandBtnPressed: {
    opacity: 0.6,
  },
  expandLabel: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    letterSpacing: 2,
  },
});
