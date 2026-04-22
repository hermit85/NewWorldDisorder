import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatTimeShort } from '@/content/copy';
import { formatRelativeTimestamp } from '@/lib/api';
import { Brackets } from '@/components/ui/Brackets';
import { GlowButton } from '@/components/ui/GlowButton';
import { PulseDot } from '@/components/ui/PulseDot';
import { SegmentLine } from '@/components/ui/SegmentLine';
import { StatCell } from '@/components/ui/StatCell';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type ActiveHeroCardProps = {
  variant: 'active';
  trailName: string;
  beaterName: string;
  happenedAt: string;
  deltaMs: number;
  beaterTimeMs: number;
  userTimeMs: number;
  onPrimary?: () => void;
};

type EmptyHeroCardProps = {
  variant: 'empty';
  onSecondary?: () => void;
};

export type HeroCardProps = ActiveHeroCardProps | EmptyHeroCardProps;

function formatDeltaSeconds(deltaMs: number): string {
  return `${(deltaMs / 1000).toFixed(1)}s`;
}

export const HeroCard = memo(function HeroCard(props: HeroCardProps) {
  const isActive = props.variant === 'active';

  return (
    <View style={styles.container}>
      <Brackets color={isActive ? 'emerald' : 'dim'} />

      {isActive ? (
        <>
          <View style={styles.kickerRow}>
            <PulseDot size="sm" />
            <Text style={styles.kicker}>
              POBITO CIĘ · TRASA: {props.trailName}
            </Text>
          </View>

          <Text style={styles.title}>ODGRYŹ SIĘ.</Text>
          <Text style={styles.body}>
            {props.beaterName} wyprzedził cię {formatRelativeTimestamp(props.happenedAt)}. Był
            szybszy o {formatDeltaSeconds(props.deltaMs)}.
          </Text>

          <SegmentLine />

          <View style={styles.statsRow}>
            <StatCell
              label={props.beaterName}
              value={formatTimeShort(props.beaterTimeMs)}
            />
            <StatCell
              label="TWÓJ PB"
              value={formatTimeShort(props.userTimeMs)}
            />
            <StatCell
              label="DELTA"
              value={`-${formatDeltaSeconds(props.deltaMs)}`}
              accent
            />
          </View>

          <GlowButton
            label="Odzyskaj pierwsze miejsce"
            onPress={props.onPrimary}
            variant="primary"
          />
        </>
      ) : (
        <>
          <View style={styles.kickerRow}>
            <View style={styles.dimDot} />
            <Text style={[styles.kicker, styles.kickerDim]}>
              STATUS DNIA · SPOKÓJ
            </Text>
          </View>

          <Text style={styles.title}>Dziś bez zmian.</Text>
          <Text style={styles.body}>
            Nikt cię nie wyprzedził. Utrzymaj pozycję lub zaproś rywala — daj komuś link do apki.
          </Text>

          <GlowButton
            label="Zaproś rywala"
            onPress={props.onSecondary}
            variant="secondary"
          />
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    gap: chunk9Spacing.cardChildGap,
    borderRadius: chunk9Radii.card,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    padding: chunk9Spacing.cardPadding,
    overflow: 'hidden',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 18,
  },
  kicker: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
    flex: 1,
  },
  kickerDim: {
    color: chunk9Colors.text.secondary,
  },
  dimDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: chunk9Colors.bg.hairline,
  },
  title: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    paddingRight: 24,
  },
  body: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    paddingRight: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: chunk9Spacing.cardChildGap,
  },
});
