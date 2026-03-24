// ═══════════════════════════════════════════════════════════
// Help / FAQ — beta tester reference
// Quick answers to common questions during testing
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
    q: 'What counts as a ranked run?',
    a: 'A ranked run must start at the official gate, follow the trail route, pass all checkpoints, and finish at the end gate. GPS signal must be strong enough for verification.',
  },
  {
    q: 'Why was my run marked Practice Only?',
    a: 'Common reasons: you started outside the gate, GPS was too weak, you missed a checkpoint, or you chose practice mode. Check the run status on your result screen.',
  },
  {
    q: 'How does the leaderboard work?',
    a: 'Only verified ranked runs appear on the official board. Your best time per trail counts. Positions update after each verified run.',
  },
  {
    q: 'What is XP?',
    a: 'XP (experience points) rewards your riding: finishing runs, beating PBs, entering the top 10, completing challenges. XP unlocks rank titles from Rookie to Legend.',
  },
  {
    q: 'How do I get a good GPS signal?',
    a: 'Wait for the readiness check to show green. Stay in open areas. Avoid starting in dense tree cover. The app will tell you when signal is strong enough for ranked.',
  },
  {
    q: 'Can I practice without affecting my rank?',
    a: 'Yes. Practice runs record your time and route but never appear on the official leaderboard.',
  },
  {
    q: 'This is a beta — what should I expect?',
    a: 'GPS verification is still improving. Some edge cases may not verify correctly. Results might occasionally feel off. Report anything weird — your feedback shapes the league.',
  },
  {
    q: 'What trails are available?',
    a: 'Season 01 covers Słotwiny Arena in Krynica-Zdrój: Gałgan, Dookoła Świata, Kometa, and Dzida. More spots coming in future seasons.',
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
            <Text style={styles.backText}>← BACK</Text>
          </Pressable>
          <Text style={styles.title}>HOW NWD WORKS</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>CLOSED BETA</Text>
          </View>
        </View>

        {/* Quick rules */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>QUICK RULES</Text>
          <RuleRow icon="🏁" text="Start at the gate" />
          <RuleRow icon="📍" text="Stay on the trail line" />
          <RuleRow icon="✓" text="Pass all checkpoints" />
          <RuleRow icon="🎯" text="Finish at the end gate" />
          <RuleRow icon="📶" text="Keep GPS signal strong" />
          <RuleRow icon="🏆" text="Only verified runs enter the board" />
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
          <Text style={styles.betaNoteTitle}>🔒 BETA TESTER NOTE</Text>
          <Text style={styles.betaNoteBody}>
            You are part of a closed test group. GPS verification, route detection, and ranking logic are all actively improving. Your runs and feedback directly shape the product.
          </Text>
          <Text style={styles.betaNoteVersion}>
            v0.2.0-beta · Season 01 · Słotwiny Arena
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  title: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  betaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  betaText: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 2,
  },
  rulesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  rulesTitle: {
    ...typography.labelSmall,
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  ruleIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  ruleText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  faqItem: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqQ: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.sm,
  },
  faqA: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  betaNote: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  betaNoteTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  betaNoteBody: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  betaNoteVersion: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    letterSpacing: 2,
  },
});
