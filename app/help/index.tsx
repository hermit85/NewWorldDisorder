// ═══════════════════════════════════════════════════════════
// Pomoc / Zasady / FAQ / support — single entry point from the
// Rider tab's POMOC link.
//
// Visual pass (post-B20 review): the earlier screen mixed legacy
// `colors.bgCard` shells with chunk9 SectionHeaders, which read
// as "old app, new app" side by side. Now uses the chunk9 dark /
// emerald / hairline system end-to-end so the screen feels like
// the rest of the tabs.
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEGAL } from '@/constants/legal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Divider } from '@/components/ui/Divider';
import {
  chunk9Colors,
  chunk9Radii,
  chunk9Spacing,
  chunk9Typography,
} from '@/theme/chunk9';

interface FAQ {
  q: string;
  a: string;
}

const RULES: { index: string; text: string }[] = [
  { index: '01', text: 'Startuj z bramki' },
  { index: '02', text: 'Trzymaj się trasy' },
  { index: '03', text: 'Przejdź checkpointy' },
  { index: '04', text: 'Finiszuj na bramce mety' },
  { index: '05', text: 'Utrzymuj silny GPS' },
  { index: '06', text: 'Tylko zweryfikowane zjazdy wchodzą na tablicę' },
];

const FAQS: FAQ[] = [
  {
    q: 'Co liczy się jako zjazd rankingowy?',
    a: 'Zjazd rankingowy musi wystartować z oficjalnej bramki, podążać trasą, przejść wszystkie checkpointy i zakończyć się na bramce mety. Sygnał GPS musi być wystarczająco silny do weryfikacji.',
  },
  {
    q: 'Dlaczego mój zjazd został oznaczony jako trening?',
    a: 'Najczęstsze powody: start poza bramką, zbyt słaby GPS, pominięty checkpoint, lub wybrany tryb treningowy. Sprawdź status na ekranie wyniku.',
  },
  {
    q: 'Jak działa tablica wyników?',
    a: 'Na oficjalnej tablicy pojawiają się tylko zweryfikowane zjazdy rankingowe. Liczy się Twój najlepszy czas na danej trasie. Pozycje aktualizują się po każdym zweryfikowanym zjeździe.',
  },
  {
    q: 'Co to jest XP?',
    a: 'XP (punkty doświadczenia) nagradzają Twoją jazdę: ukończone zjazdy, pobite rekordy, wejście do TOP 10, ukończone wyzwania. XP odblokują rangi od Rookie do Legend.',
  },
  {
    q: 'Jak uzyskać dobry sygnał GPS?',
    a: 'Stój w otwartym terenie, unikaj gęstego lasu. Zaczekaj aż sprawdzian gotowości pokaże zielony wskaźnik. Apka powie Ci kiedy sygnał jest wystarczający do rankingu.',
  },
  {
    q: 'Czy mogę trenować bez wpływu na ranking?',
    a: 'Tak. Treningi zapisują Twój czas i trasę, ale nigdy nie pojawiają się na oficjalnej tablicy wyników.',
  },
  {
    q: 'Jakie trasy są dostępne?',
    a: 'Sezon 01 obejmuje Słotwiny Arena w Krynicy-Zdrój: Gałgan, Dookoła Świata, Kometa i Dzida. Kolejne bike parki dołączą w następnych sezonach.',
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć"
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Text style={styles.backGlyph}>←</Text>
          </Pressable>
          <Text style={styles.seasonBadge}>SEZON 01</Text>
        </View>

        <View style={styles.identityBlock}>
          <Text style={styles.kicker}>✦ PRZEWODNIK</Text>
          <Text style={styles.title}>Jak działa NWD</Text>
          <Text style={styles.subtitle}>
            Zasady ligi, najczęstsze pytania i wsparcie — w jednym miejscu.
          </Text>
        </View>

        {/* ── Zasady ─────────────────────────────────────────── */}
        <SectionHeader
          label="Zasady"
          glyph="✦"
          glyphColor={chunk9Colors.accent.emerald}
          spacingTop="lg"
        />
        <View style={styles.rulesBlock}>
          {RULES.map((rule) => (
            <View key={rule.index} style={styles.ruleRow}>
              <Text style={styles.ruleIndex}>{rule.index}</Text>
              <Text style={styles.ruleText}>{rule.text}</Text>
            </View>
          ))}
        </View>

        {/* ── FAQ ────────────────────────────────────────────── */}
        <SectionHeader
          label="Pytania"
          glyph="?"
          glyphColor={chunk9Colors.text.secondary}
          meta={String(FAQS.length)}
          spacingTop="xl"
        />
        <View style={styles.faqBlock}>
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${faq.q}, ${open ? 'zwiń' : 'rozwiń'}`}
                accessibilityState={{ expanded: open }}
                onPress={() => setOpenFaq(open ? null : i)}
                style={({ pressed }) => [
                  styles.faqItem,
                  open && styles.faqItemOpen,
                  pressed && styles.faqItemPressed,
                ]}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQ}>{faq.q}</Text>
                  <Text style={[styles.faqCaret, open && styles.faqCaretOpen]}>
                    {open ? '−' : '+'}
                  </Text>
                </View>
                {open ? <Text style={styles.faqA}>{faq.a}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* ── Support ────────────────────────────────────────── */}
        <SectionHeader
          label="Kontakt"
          glyph="✉"
          glyphColor={chunk9Colors.text.secondary}
          spacingTop="xl"
        />
        <View style={styles.supportBlock}>
          <Text style={styles.supportBody}>
            Utknąłeś albo coś nie gra? Napisz — odpowiadamy w 24h.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Napisz na ${LEGAL.supportEmail}`}
            onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)}
            style={({ pressed }) => [
              styles.supportCta,
              pressed && styles.supportCtaPressed,
            ]}
          >
            <Text style={styles.supportCtaLabel}>{LEGAL.supportEmail}</Text>
          </Pressable>
        </View>

        <Divider variant="strong" />

        {/* ── Legal / meta ───────────────────────────────────── */}
        <View style={styles.legalRow}>
          <Pressable
            style={styles.legalLink}
            onPress={() => Linking.openURL(LEGAL.privacyUrl)}
          >
            <Text style={styles.legalLinkText}>PRYWATNOŚĆ</Text>
          </Pressable>
          <Text style={styles.legalSep}>·</Text>
          <Pressable
            style={styles.legalLink}
            onPress={() => Linking.openURL(LEGAL.termsUrl)}
          >
            <Text style={styles.legalLinkText}>REGULAMIN</Text>
          </Pressable>
          <Text style={styles.legalSep}>·</Text>
          <Pressable
            style={styles.legalLink}
            onPress={() => Linking.openURL(LEGAL.supportUrl)}
          >
            <Text style={styles.legalLinkText}>WSPARCIE</Text>
          </Pressable>
        </View>
        <Text style={styles.footerStamp}>NWD · Sezon 01 · Słotwiny Arena</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: chunk9Colors.bg.base,
  },
  scroll: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 18,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    ...chunk9Typography.display28,
    fontSize: 18,
    color: chunk9Colors.text.primary,
    lineHeight: 18,
  },
  seasonBadge: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.accent.emerald,
    borderWidth: 1,
    borderColor: chunk9Colors.accent.emerald,
    borderRadius: chunk9Radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  identityBlock: {
    marginBottom: 6,
    gap: 6,
  },
  kicker: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.accent.emerald,
    letterSpacing: 2.4,
  },
  title: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  subtitle: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    lineHeight: 20,
  },
  rulesBlock: {
    gap: 4,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: chunk9Colors.bg.hairline,
  },
  ruleIndex: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.accent.emerald,
    width: 28,
  },
  ruleText: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  faqBlock: {
    gap: 8,
  },
  faqItem: {
    borderRadius: chunk9Radii.card,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  faqItemOpen: {
    borderColor: chunk9Colors.accent.emerald,
  },
  faqItemPressed: {
    opacity: 0.8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQ: {
    ...chunk9Typography.body13,
    fontFamily: 'Inter_600SemiBold',
    color: chunk9Colors.text.primary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  faqCaret: {
    ...chunk9Typography.display28,
    fontSize: 20,
    color: chunk9Colors.text.tertiary,
    lineHeight: 20,
    width: 20,
    textAlign: 'center',
  },
  faqCaretOpen: {
    color: chunk9Colors.accent.emerald,
  },
  faqA: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    marginTop: 10,
    lineHeight: 20,
  },
  supportBlock: {
    borderRadius: chunk9Radii.card,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },
  supportBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    lineHeight: 20,
  },
  supportCta: {
    alignSelf: 'flex-start',
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.accent.emerald,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  supportCtaPressed: {
    opacity: 0.7,
  },
  supportCtaLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.accent.emerald,
    fontSize: 12,
    letterSpacing: 2,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  legalLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  legalLinkText: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
    letterSpacing: 2,
  },
  legalSep: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
  },
  footerStamp: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 2.4,
  },
});
