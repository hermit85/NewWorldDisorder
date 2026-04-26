// ═══════════════════════════════════════════════════════════
// Slide 02 — RANKING (gate-and-corridor schematic).
//
// Top → bottom:
//   1. Eyebrow "RANKING" + animated LiveDot
//   2. Headline "Czas liczy się / tylko z bramki." (2 lines white)
//   3. Sub copy 2 lines
//   4. Hero schematic (GateSchematic SVG)
//
// The schematic carries all the visual weight here — start gate
// at top, corridor down with rider dot + animated halo, timer
// overlay, finish gate + VERIFIED check at bottom.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '../_components/LiveDot';
import { GateSchematic } from '../_graphics/GateSchematic';

export const SlideRanking = memo(function SlideRanking() {
  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>RANKING</Text>
        <LiveDot size={5} />
      </View>

      <View style={styles.headlineBlock}>
        <Text style={styles.headlineLine}>Czas liczy się</Text>
        <Text style={styles.headlineLine}>tylko z bramki.</Text>
      </View>

      <View style={styles.subBlock}>
        <Text style={styles.subPrimary}>Linia start. Korytarz. Linia meta.</Text>
        <Text style={styles.subSecondary}>Bez tego — nie liczymy.</Text>
      </View>

      <View style={styles.heroWrap}>
        <GateSchematic />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 14,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: colors.accent,
  },
  headlineBlock: {
    marginTop: 16,
  },
  headlineLine: {
    fontFamily: fonts.racing,
    fontSize: 34,
    lineHeight: 38,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subBlock: {
    marginTop: 16,
    gap: 4,
  },
  subPrimary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  subSecondary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  heroWrap: {
    flex: 1,
    marginTop: 12,
    minHeight: 320,
  },
});
