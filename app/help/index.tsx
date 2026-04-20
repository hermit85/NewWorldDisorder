// ═══════════════════════════════════════════════════════════
// Pomoc / FAQ / legal & support
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { LEGAL } from '@/constants/legal';

interface FAQ {
  q: string;
  a: string;
}

const faqs: FAQ[] = [
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
    a: 'Poczekaj aż sprawdzian gotowości pokaże zielony. Stój w otwartym terenie. Unikaj startu w gęstym lesie. Apka powie Ci kiedy sygnał jest wystarczający do rankingu.',
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← WRÓĆ</Text>
          </Pressable>
          <Text style={styles.title}>JAK DZIAŁA NWD</Text>
        </View>

        {/* Zasady */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>ZASADY</Text>
          <RuleRow icon="🏁" text="Startuj z bramki" />
          <RuleRow icon="📍" text="Trzymaj się trasy" />
          <RuleRow icon="✓" text="Przejedź checkpointy" />
          <RuleRow icon="🎯" text="Finiszuj na bramce mety" />
          <RuleRow icon="📶" text="Utrzymuj silny GPS" />
          <RuleRow icon="🏆" text="Tylko zweryfikowane zjazdy wchodzą na tablicę" />
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>FAQ</Text>
        {faqs.map((faq, i) => (
          <View key={i} style={styles.faqItem}>
            <Text style={styles.faqQ}>{faq.q}</Text>
            <Text style={styles.faqA}>{faq.a}</Text>
          </View>
        ))}

        {/* Support / contact */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>POTRZEBUJESZ POMOCY?</Text>
          <Text style={styles.supportBody}>
            Masz pytanie albo problem ze zjazdem? Napisz do nas.
          </Text>
          <Pressable
            style={styles.supportBtn}
            onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)}
          >
            <Text style={styles.supportBtnText}>{LEGAL.supportEmail}</Text>
          </Pressable>
          <Text style={styles.supportVersion}>
            Sezon 01 · Słotwiny Arena
          </Text>
        </View>

        {/* Legal links */}
        <View style={styles.legalRow}>
          <Pressable style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.privacyUrl)}>
            <Text style={styles.legalLinkText}>POLITYKA PRYWATNOŚCI</Text>
          </Pressable>
          <Pressable style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.termsUrl)}>
            <Text style={styles.legalLinkText}>REGULAMIN</Text>
          </Pressable>
          <Pressable style={styles.legalLink} onPress={() => Linking.openURL(LEGAL.supportUrl)}>
            <Text style={styles.legalLinkText}>WSPARCIE</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RuleRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleIcon}>{icon}</Text>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },
  header: { marginBottom: spacing.xl },
  backBtn: { marginBottom: spacing.md },
  backText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  title: { ...typography.label, color: colors.textSecondary, letterSpacing: 4, marginBottom: spacing.sm },
  rulesCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.accent },
  rulesTitle: { ...typography.labelSmall, color: colors.accent, letterSpacing: 3, marginBottom: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  ruleIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  ruleText: { ...typography.body, color: colors.textPrimary },
  sectionTitle: { ...typography.label, color: colors.textSecondary, letterSpacing: 3, marginBottom: spacing.md },
  faqItem: { backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  faqQ: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', marginBottom: spacing.sm },
  faqA: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  supportCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  supportTitle: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 2, marginBottom: spacing.sm },
  supportBody: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  supportBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  supportBtnText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 1, fontSize: 11 },
  supportVersion: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, letterSpacing: 2 },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  legalLink: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  legalLinkText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 9 },
});
