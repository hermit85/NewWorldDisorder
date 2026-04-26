import { StyleSheet, Text, View } from 'react-native';
import { Btn, Card, IconGlyph } from '@/components/nwd';
import { useSyncOutbox } from '@/hooks/useSyncOutbox';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export function SyncOutboxCard() {
  const { state, totalPending, totalIssues, flush } = useSyncOutbox();

  if (totalIssues === 0) return null;

  const pendingParts = [
    state.pendingRuns > 0 ? `${state.pendingRuns} zjazd${state.pendingRuns === 1 ? '' : 'y'}` : null,
    state.pendingSpots > 0 ? `${state.pendingSpots} bike park${state.pendingSpots === 1 ? '' : 'i'}` : null,
  ].filter(Boolean);
  const rejectedPart = state.rejectedSpots > 0
    ? `${state.rejectedSpots} odrzucon${state.rejectedSpots === 1 ? 'y' : 'e'}`
    : null;
  const busy = state.refreshing || state.isRetrying;
  const body = totalPending > 0
    ? `Czeka na wysłanie: ${pendingParts.join(' · ')}${rejectedPart ? ` · ${rejectedPart}` : ''}. Nic nie znika po wyjściu z appki.`
    : `Odrzucono po synchronizacji: ${rejectedPart}. Sprawdź zgłoszenie przed ponowną próbą.`;

  return (
    <Card padding={16} style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <IconGlyph name="split" size={18} color={colors.gold} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>SYNC OUTBOX</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      {totalPending > 0 && (
        <Btn
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={flush}
          disabled={busy}
          style={styles.cta}
        >
          {busy ? 'Wysyłam' : 'Wyślij teraz'}
        </Btn>
      )}
    </Card>
  );
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
  cta: {
    alignSelf: 'flex-start',
  },
});
