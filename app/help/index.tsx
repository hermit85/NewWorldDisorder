// ═══════════════════════════════════════════════════════════
// Pomoc / FAQ — informacje dla beta testerów
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

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
    q: 'To beta — czego się spodziewać?',
    a: 'Weryfikacja GPS wciąż się poprawia. Niektóre przypadki mogą nie zostać prawidłowo zweryfikowane. Wyniki mogą czasem wydawać się niespójne. Zgłaszaj wszystko co dziwne — Twój feedback kształtuje ligę.',
  },
  {
    q: 'Jakie trasy są dostępne?',
    a: 'Sezon 01 obejmuje Słotwiny Arena w Krynicy-Zdrój: Gałgan, Dookoła Świata, Kometa i Dzida. Więcej spotów w kolejnych sezonach.',
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
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>ZAMKNIĘTA BETA</Text>
          </View>
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

        {/* Beta note */}
        <View style={styles.betaNote}>
          <Text style={styles.betaNoteTitle}>🔒 BETA TESTER</Text>
          <Text style={styles.betaNoteBody}>
            Jesteś częścią zamkniętej grupy testowej. Weryfikacja GPS, detekcja trasy i logika rankingowa są aktywnie rozwijane. Twoje zjazdy i feedback bezpośrednio kształtują produkt.
          </Text>
          <Text style={styles.betaNoteVersion}>
            v0.2.0-beta · Sezon 01 · Słotwiny Arena
          </Text>
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
  betaBadge: { alignSelf: 'flex-start', backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  betaText: { ...typography.labelSmall, color: colors.accent, fontSize: 9, letterSpacing: 2 },
  rulesCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.xl, borderWidth: 1, borderColor: colors.accent },
  rulesTitle: { ...typography.labelSmall, color: colors.accent, letterSpacing: 3, marginBottom: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  ruleIcon: { fontSize: 18, width: 28, textAlign: 'center' },
  ruleText: { ...typography.body, color: colors.textPrimary },
  sectionTitle: { ...typography.label, color: colors.textSecondary, letterSpacing: 3, marginBottom: spacing.md },
  faqItem: { backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  faqQ: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', marginBottom: spacing.sm },
  faqA: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  betaNote: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  betaNoteTitle: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 2, marginBottom: spacing.sm },
  betaNoteBody: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  betaNoteVersion: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, letterSpacing: 2 },
});
