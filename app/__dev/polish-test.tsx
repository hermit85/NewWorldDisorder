// ═══════════════════════════════════════════════════════════
// /__dev/polish-test — Polish-character rendering regression test.
// Every typography style + a live TextInput so a field audit
// catches font-coverage regressions on real hardware.
//
// Dev-only: renders nothing in production builds. Navigate via
// router.push('/__dev/polish-test') from any dev entrypoint.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLoadedFonts, isLoaded } from 'expo-font';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { hudColors, hudTypography } from '@/theme/gameHud';

// Full Polish Latin Extended set — every char must render or the
// font is missing Polish coverage.
const POLISH_CHARS = 'ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ';
const SAMPLE_SENTENCE = 'Gałgan Niebieska — ząb, źdźbło, ćma, łódź, żółw, ślimak.';
const SAMPLE_UPPER = 'ZAKOŃCZ · KALIBRACJĘ · ODRZUĆ · PIERWSZĄ · DOŁĄCZ';
const REQUIRED_FONTS = [
  'Inter_400Regular',
  'Inter_500Medium',
  'Inter_600SemiBold',
  'Inter_700Bold',
  'Rajdhani_400Regular',
  'Rajdhani_500Medium',
  'Rajdhani_600SemiBold',
  'Rajdhani_700Bold',
] as const;

export default function PolishTestScreen() {
  const router = useRouter();
  const [input, setInput] = useState('Gałgan');
  const loadedFonts = getLoadedFonts().filter((fontName) =>
    REQUIRED_FONTS.includes(fontName as (typeof REQUIRED_FONTS)[number]),
  );
  const missingFonts = REQUIRED_FONTS.filter((fontName) => !isLoaded(fontName));
  const hasMissingFonts = missingFonts.length > 0;

  if (!__DEV__) return null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backLabel}>← WRÓĆ</Text>
        </Pressable>

        <Text style={styles.pageTitle}>POLISH CHARS · RENDER TEST</Text>
        <Text style={styles.pageSub}>
          Każdy blok poniżej powinien pokazać dokładnie te same polskie{'\n'}
          znaki. Jeśli któryś renderuje „¬" albo puste kwadraty —{'\n'}
          ten font nie ma pokrycia Latin Extended.
        </Text>

        <Section label="Font load assertion">
          <Text style={[styles.assertion, hasMissingFonts ? styles.assertionBad : styles.assertionGood]}>
            {hasMissingFonts
              ? `FAIL — missing: ${missingFonts.join(', ')}`
              : 'PASS — all Inter + Rajdhani weights are loaded'}
          </Text>
          <Text style={styles.loadedFonts}>
            loaded: {loadedFonts.join(', ')}
          </Text>
        </Section>

        {/* Live TextInput — the original bug source */}
        <Section label="TextInput (typography.input)">
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Wpisz polskie znaki…"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.meta}>len: {input.length} · codepoints:</Text>
          <Text style={styles.codepoints}>
            {Array.from(input)
              .map((c) => `${c}=U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
              .join(' ')}
          </Text>
        </Section>

        {/* ── typography (display = Rajdhani, body = Inter) ── */}
        <SectionHeader>typography.*</SectionHeader>

        <Sample name="timeHero (Rajdhani 700)" style={typography.timeHero}>{POLISH_CHARS}</Sample>
        <Sample name="h1 (Inter 700)"          style={typography.h1}>{SAMPLE_UPPER}</Sample>
        <Sample name="h2 (Inter 700)"          style={typography.h2}>{SAMPLE_UPPER}</Sample>
        <Sample name="h3 (Inter 600)"          style={typography.h3}>{SAMPLE_SENTENCE}</Sample>
        <Sample name="body (Inter 400)"        style={typography.body}>{SAMPLE_SENTENCE}</Sample>
        <Sample name="bodySmall (Inter)"       style={typography.bodySmall}>{SAMPLE_SENTENCE}</Sample>
        <Sample name="label (Inter 600)"       style={typography.label}>{SAMPLE_UPPER}</Sample>
        <Sample name="labelSmall (Inter)"      style={typography.labelSmall}>{SAMPLE_UPPER}</Sample>
        <Sample name="cta (Inter 700)"         style={typography.cta}>{SAMPLE_UPPER}</Sample>
        <Sample name="input (Inter 500)"       style={typography.input}>{SAMPLE_SENTENCE}</Sample>

        {/* ── hudTypography (game HUD, Rajdhani display) ── */}
        <SectionHeader>hudTypography.* (HUD / Rajdhani)</SectionHeader>

        <Sample name="displayHuge (Rajdhani 700)"    style={hudTypography.displayHuge}>0123 ĄĘŁŃ</Sample>
        <Sample name="displayLarge (Rajdhani 700)"   style={hudTypography.displayLarge}>PIERWSZĄ</Sample>
        <Sample name="label (Rajdhani 700)"          style={{ ...hudTypography.label, color: hudColors.gpsStrong }}>{SAMPLE_UPPER}</Sample>
        <Sample name="labelSmall (Rajdhani 700)"     style={{ ...hudTypography.labelSmall, color: hudColors.textMuted }}>{SAMPLE_UPPER}</Sample>
        <Sample name="action (Rajdhani 700)"         style={{ ...hudTypography.action, color: hudColors.gpsStrong }}>ZAKOŃCZ</Sample>
        <Sample name="input (Inter 500)"             style={{ ...hudTypography.input, color: hudColors.timerPrimary }}>{SAMPLE_SENTENCE}</Sample>

        <Text style={styles.footerNote}>
          Post-ADR-011 expectation (per @expo-google-fonts metadata):{'\n'}
          • Rajdhani_{'{'}400,500,600,700{'}'} → full Latin Extended-A coverage (all Polish OK).{'\n'}
          • Inter_{'{'}400,500,600,700{'}'} → full Latin Extended-A coverage (all Polish OK).{'\n'}
          Every sample above should render every diacritic correctly.
          If a sample shows „¬" or a □ box the font didn't load —
          check useFonts() in app/_layout.tsx.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Sample({
  name,
  style,
  children,
}: {
  name: string;
  style: any;
  children: string;
}) {
  return (
    <View style={styles.sampleRow}>
      <Text style={styles.sampleName}>{name}</Text>
      <Text style={[styles.sampleBase, style]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },
  back: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  pageTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  pageSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.label,
    color: colors.accent,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.input,
  },
  meta: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  assertion: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  assertionGood: {
    color: colors.accent,
  },
  assertionBad: {
    color: colors.red,
  },
  loadedFonts: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  codepoints: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sampleRow: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sampleName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: colors.textTertiary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  sampleBase: {
    color: colors.textPrimary,
  },
  footerNote: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});
