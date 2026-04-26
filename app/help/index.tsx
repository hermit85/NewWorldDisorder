// ═══════════════════════════════════════════════════════════
// Pomoc / Zasady / FAQ / support — single entry point from the
// Rider tab's POMOC link.
//
// Canonical migration: dropped ui/SectionHeader + ui/Divider in
// favour of nwd/ TopBar, PageTitle, SectionHead, Card, Btn, Pill.
// Glyph decorations (✦/?/✉) removed per § 13.5 — section labels
// carry their own meaning, no IconGlyph mapping fits the FAQ /
// Kontakt semantics so the slot stays empty.
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
import { Btn, Card, PageTitle, Pill, SectionHead, TopBar } from '@/components/nwd';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

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
        <TopBar
          onBack={() => router.back()}
          trailing={<Pill state="verified" size="sm">SEZON 01</Pill>}
        />

        <PageTitle
          kicker="Przewodnik"
          title="Jak działa NWD"
          subtitle="Zasady ligi, najczęstsze pytania i wsparcie — w jednym miejscu."
        />

        {/* ── Zasady ─────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHead label="Zasady" />
          <View style={styles.rulesBlock}>
            {RULES.map((rule) => (
              <View key={rule.index} style={styles.ruleRow}>
                <Text style={styles.ruleIndex}>{rule.index}</Text>
                <Text style={styles.ruleText}>{rule.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── FAQ ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHead label="Pytania" count={FAQS.length} />
          <View style={styles.faqBlock}>
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <Card
                  key={i}
                  glow={open}
                  onPress={() => setOpenFaq(open ? null : i)}
                  padding={16}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQ}>{faq.q}</Text>
                    <Text style={[styles.faqCaret, open && styles.faqCaretOpen]}>
                      {open ? '−' : '+'}
                    </Text>
                  </View>
                  {open ? <Text style={styles.faqA}>{faq.a}</Text> : null}
                </Card>
              );
            })}
          </View>
        </View>

        {/* ── Support ────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHead label="Kontakt" />
          <Card>
            <Text style={styles.supportBody}>
              Utknąłeś albo coś nie gra? Napisz — odpowiadamy w 24h.
            </Text>
            <View style={styles.supportCtaRow}>
              <Btn
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)}
              >
                {LEGAL.supportEmail}
              </Btn>
            </View>
          </Card>
        </View>

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
        <Text style={styles.footerStamp}>NWD · SEZON 01 · SŁOTWINY ARENA</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.pad,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
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
    borderBottomColor: colors.border,
  },
  ruleIndex: {
    ...typography.label,
    color: colors.accent,
    width: 28,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    letterSpacing: 1,
  },
  ruleText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  faqBlock: {
    gap: 8,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQ: {
    ...typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  faqCaret: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 22,
    color: colors.textTertiary,
    lineHeight: 22,
    width: 22,
    textAlign: 'center',
  },
  faqCaretOpen: {
    color: colors.accent,
  },
  faqA: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  supportBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  supportCtaRow: {
    flexDirection: 'row',
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  legalLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  legalLinkText: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  legalSep: {
    ...typography.label,
    color: colors.textTertiary,
  },
  footerStamp: {
    ...typography.label,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 2.4,
  },
});
