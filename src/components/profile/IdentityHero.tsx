// ─────────────────────────────────────────────────────────────
// IdentityHero — top of JA passport.
//
// Wraps the existing RiderIdCard primitive (avatar with breathing
// ring, big @handle, rank/level row, season meta) with two extra
// pieces the passport screen needs:
//   - gear icon top-right (opens SettingsSheet)
//   - rank progression bar below identity ("RIDER → SENDER · 1300 XP")
//
// XP-to-next-level bar lives one section down on the screen (we keep
// XP and rank progression conceptually distinct: XP is the slow drip,
// RANK is the trwały tier).
// ─────────────────────────────────────────────────────────────

import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { RiderIdCard } from '@/components/nwd';

export interface IdentityHeroProps {
  avatar: ReactNode;
  riderTag: string;
  rankLabel: string;
  rankColor?: string;
  level: number;
  /** Pre-formatted season + zjazdy line. Caller controls copy so
   *  this primitive never produces "Beta" strings of its own. */
  seasonLine: string;
  /** Rank progression: from rank, to next rank (or null if max),
   *  ratio 0..1 of XP collected toward the next rank, and a label
   *  such as "1300 XP do awansu". */
  rankProgress?: {
    fromLabel: string;
    toLabel: string | null;
    ratio: number;
    captionRight: string;
    fromColor: string;
    toColor: string;
  };
  onSettingsPress: () => void;
}

export function IdentityHero({
  avatar,
  riderTag,
  rankLabel,
  rankColor,
  level,
  seasonLine,
  rankProgress,
  onSettingsPress,
}: IdentityHeroProps) {
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onSettingsPress}
        accessibilityRole="button"
        accessibilityLabel="Ustawienia"
        hitSlop={12}
        style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
      >
        <Text style={styles.menuLabel}>MENU</Text>
      </Pressable>

      <RiderIdCard
        avatar={avatar}
        riderTag={riderTag}
        rankLabel={rankLabel}
        level={level}
        meta={seasonLine}
        ringColor={rankColor}
      />

      {rankProgress ? (
        <View style={styles.rankProgressBlock}>
          <View style={styles.rankProgressBar}>
            <View
              style={[
                styles.rankProgressFill,
                {
                  width: `${Math.max(0, Math.min(1, rankProgress.ratio)) * 100}%`,
                  backgroundColor: rankProgress.fromColor,
                },
              ]}
            />
          </View>
          <View style={styles.rankProgressRow}>
            <Text style={[styles.rankProgressFrom, { color: rankProgress.fromColor }]}>
              {rankProgress.fromLabel.toUpperCase()}
            </Text>
            {rankProgress.toLabel ? (
              <>
                <Text style={styles.rankProgressArrow}>→</Text>
                <Text style={[styles.rankProgressTo, { color: rankProgress.toColor }]}>
                  {rankProgress.toLabel.toUpperCase()}
                </Text>
              </>
            ) : null}
            <View style={{ flex: 1 }} />
            <Text style={styles.rankProgressCaption}>{rankProgress.captionRight}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    paddingTop: 4,
  },
  // Small mono-uppercase MENU button — the carousel-indicator vibe
  // of three dots was confusing here, and a real ⚙ glyph isn't in
  // Inter. A text affordance reads correctly in any font.
  menuBtn: {
    position: 'absolute',
    top: 14,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  menuBtnPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  menuLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  rankProgressBlock: {
    marginTop: 4,
    paddingHorizontal: 4,
    gap: 6,
  },
  rankProgressBar: {
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  rankProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  rankProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankProgressFrom: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  rankProgressArrow: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textTertiary,
  },
  rankProgressTo: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  rankProgressCaption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.4,
  },
});
