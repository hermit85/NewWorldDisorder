// ─────────────────────────────────────────────────────────────
// PageTitle — large display title (per ui.jsx PageTitle)
//
// Anatomy:
//   [KICKER]                  mono CAPS muted accent
//   Title here.               Rajdhani 800 hero/title size
//   subtitle line             body 14 muted (optional)
//
// Used as the screen-title block on tabs (SPOTY / RIDER / TABLICA).
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export interface PageTitleProps {
  kicker?: string;
  title: string;
  subtitle?: string | null;
  /** Use hero size (56) instead of default title size (42). */
  hero?: boolean;
  style?: ViewStyle;
}

export function PageTitle({
  kicker,
  title,
  subtitle,
  hero = false,
  style,
}: PageTitleProps) {
  return (
    <View style={[styles.container, style]}>
      {kicker ? <Text style={styles.kicker}>{kicker.toUpperCase()}</Text> : null}
      <Text
        style={[styles.title, hero && styles.titleHero]}
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  kicker: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    fontSize: 10.5,
    letterSpacing: 2.31, // 0.22em @ 10.5
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 42,
    // 1.1× — Polish diacritics in CAPS need ascender headroom.
    // 0.95× clips Ó/Ś/Ć dots, Ł stroke, Ż/Ź marks.
    lineHeight: 42 * 1.1,
    letterSpacing: -0.84, // -0.02em @ 42
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  titleHero: {
    fontSize: 56,
    lineHeight: 56 * 1.1,
    letterSpacing: -1.12, // -0.02em @ 56
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
