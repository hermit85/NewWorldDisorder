// ─────────────────────────────────────────────────────────────
// SyncOutboxCard — visible status of the offline save queue.
//
// Pre-fix bug: tapping "Wyślij teraz" set `refreshing: true` and
// then `false`, but the actual flush result never reached the UI.
// On a TestFlight device with 4 stuck runs the rider saw nothing
// happen. This rewrite:
//
//   1. Renders an explicit feedback state (idle / syncing /
//      success / partial / error) read from useSyncOutbox.feedback.
//   2. Shows a "Stale" section for runs the queue gave up on,
//      with the server's rejection reason and a Discard CTA so
//      the rider can clear the queue without an invisible loop.
//   3. After a successful flush the feedback line stays visible
//      until the rider closes / re-opens the screen, instead of
//      flickering back to the original "4 zjazdy" copy.
// ─────────────────────────────────────────────────────────────

import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Btn, Card, IconGlyph } from '@/components/nwd';
import { useSyncOutbox, type SyncFeedback } from '@/hooks/useSyncOutbox';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { FinalizedRun } from '@/systems/runStore';

export function SyncOutboxCard() {
  const { state, feedback, totalIssues, flush, discardStale } = useSyncOutbox();

  if (totalIssues === 0) return null;

  const pendingParts = [
    state.pendingRuns > 0 ? `${state.pendingRuns} ${zjazdWord(state.pendingRuns)}` : null,
    state.pendingSpots > 0 ? `${state.pendingSpots} bike park${state.pendingSpots === 1 ? '' : 'i'}` : null,
  ].filter(Boolean);
  const rejectedPart = state.rejectedSpots > 0
    ? `${state.rejectedSpots} odrzucon${state.rejectedSpots === 1 ? 'y' : 'e'} bike park${state.rejectedSpots === 1 ? '' : 'i'}`
    : null;
  const stalePart = state.staleRuns.length > 0
    ? `${state.staleRuns.length} ${zjazdWord(state.staleRuns.length)} bez wysłania`
    : null;

  const busy = feedback.kind === 'syncing' || state.isRetrying;
  const hasPendingToFlush = state.pendingRuns + state.pendingSpots > 0;

  const summary = (() => {
    if (pendingParts.length > 0) {
      const tail = [rejectedPart, stalePart].filter(Boolean).join(' · ');
      return `Zapisane lokalnie, czekają na serwer: ${pendingParts.join(' · ')}${tail ? ` · ${tail}` : ''}.`;
    }
    if (rejectedPart && !stalePart) {
      return `Odrzucone po synchronizacji: ${rejectedPart}.`;
    }
    if (stalePart) {
      return `Te zjazdy nie poszły do serwera. Sprawdź powód poniżej i wyślij ponownie albo odrzuć.`;
    }
    return 'Synchronizacja w toku.';
  })();

  return (
    <Card padding={16} style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <IconGlyph name="split" size={18} color={colors.gold} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>NIEWYSŁANE ZJAZDY</Text>
          <Text style={styles.body}>{summary}</Text>
        </View>
      </View>

      <FeedbackLine feedback={feedback} />

      {hasPendingToFlush && (
        <Btn
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={flush}
          disabled={busy}
          style={styles.cta}
        >
          {busy ? 'Wysyłam…' : 'Wyślij teraz'}
        </Btn>
      )}

      {state.staleRuns.length > 0 ? (
        <View style={styles.staleSection}>
          <Text style={styles.staleHeader}>NIE WYSŁANO PO {state.staleRuns[0].saveAttempts ?? 5} PRÓBACH</Text>
          {state.staleRuns.map((run) => (
            <StaleRunRow key={run.sessionId} run={run} onDiscard={discardStale} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function FeedbackLine({ feedback }: { feedback: SyncFeedback }) {
  if (feedback.kind === 'idle') return null;
  let color: string = colors.textSecondary;
  let prefix = '';
  let body = '';
  switch (feedback.kind) {
    case 'syncing':
      color = colors.textSecondary;
      prefix = 'WYSYŁANIE';
      body = 'Łączę z serwerem…';
      break;
    case 'success':
      color = colors.accent;
      prefix = `WYSŁANO ${feedback.succeeded}/${feedback.total}`;
      body = 'Wszystkie zjazdy poszły do serwera.';
      break;
    case 'partial':
      color = colors.warn;
      prefix = `WYSŁANO ${feedback.succeeded}/${feedback.total}`;
      body = `${feedback.failures} zjazd${feedback.failures === 1 ? '' : 'y'} odrzucone — spróbuj ponownie albo odrzuć ręcznie.`;
      break;
    case 'error':
      color = colors.danger;
      prefix = 'BŁĄD';
      body = feedback.reason;
      break;
  }
  return (
    <View style={styles.feedback}>
      <Text style={[styles.feedbackPrefix, { color }]}>{prefix}</Text>
      <Text style={styles.feedbackBody}>{body}</Text>
    </View>
  );
}

// Map server-side error codes / details to plain-Polish copy a
// rider can act on. Keep the technical pair available in __DEV__
// for debugging — users see only the friendly version.
function friendlyReason(code: string | undefined, detail: string | undefined): string {
  // Detail is more specific (e.g. "run_rate_limited" inside the
  // generic "rpc_transport" wrapper), check it first.
  if (detail === 'run_rate_limited') {
    return 'Zbyt szybko po poprzednim zjeździe — odczekaj kilka minut.';
  }
  if (detail === 'duplicate_run') {
    return 'Ten zjazd został już wcześniej zapisany.';
  }
  if (detail === 'invalid_geometry' || detail === 'corridor_violation') {
    return 'GPS nie złapał trasy zgodnej z linią.';
  }
  if (detail === 'gate_missing' || detail === 'no_finish') {
    return 'Brak przecięcia mety — zjazd niezaliczony.';
  }
  // Fall back to code.
  if (code === 'rpc_transport') return 'Brak połączenia z serwerem.';
  if (code === 'unauthorized' || code === 'auth_expired') return 'Sesja wygasła — zaloguj ponownie.';
  if (code === 'rate_limited') return 'Zbyt szybko po poprzednim zjeździe.';
  if (code === 'validation_failed') return 'Zjazd nie spełnia warunków rankingu.';
  return 'Serwer odrzucił zjazd — spróbuj ponownie później.';
}

function StaleRunRow({
  run,
  onDiscard,
}: {
  run: FinalizedRun;
  onDiscard: (sessionId: string) => void;
}) {
  const code = run.lastError?.code;
  const detail = run.lastError?.detail;
  const reason = friendlyReason(code, detail);

  function handleDiscard() {
    Alert.alert(
      'Usunąć z kolejki?',
      `${run.trailName}\n\n${reason}\n\nZjazd zostanie usunięty z lokalnej kolejki. Tej operacji nie można cofnąć.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń', style: 'destructive', onPress: () => onDiscard(run.sessionId) },
      ],
    );
  }

  return (
    <View style={styles.staleRow}>
      <View style={styles.staleCopy}>
        <Text style={styles.staleTrail}>{run.trailName}</Text>
        <Text style={styles.staleReason}>{reason}</Text>
        {__DEV__ && (code || detail) ? (
          <Text style={styles.staleDebug}>
            {code ?? '?'}{detail ? ` · ${detail}` : ''}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={handleDiscard} style={({ pressed }) => [styles.discardBtn, pressed && styles.discardBtnPressed]}>
        <Text style={styles.discardLabel}>USUŃ Z KOLEJKI</Text>
      </Pressable>
    </View>
  );
}

function zjazdWord(n: number): string {
  if (n === 1) return 'zjazd';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return 'zjazdów';
  if (lastOne >= 2 && lastOne <= 4) return 'zjazdy';
  return 'zjazdów';
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.25)',
    backgroundColor: 'rgba(255, 204, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    lineHeight: 14,
    color: colors.gold,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  feedback: {
    gap: 2,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  feedbackPrefix: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  feedbackBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  cta: {
    alignSelf: 'flex-start',
  },
  staleSection: {
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  staleHeader: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  staleCopy: {
    flex: 1,
    gap: 2,
  },
  staleTrail: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  staleReason: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  staleDebug: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: colors.textTertiary,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  discardBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.4)',
    backgroundColor: 'rgba(255, 71, 87, 0.08)',
  },
  discardBtnPressed: {
    backgroundColor: 'rgba(255, 71, 87, 0.18)',
  },
  discardLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    fontWeight: '800',
    color: colors.danger,
    letterSpacing: 1.6,
  },
});
