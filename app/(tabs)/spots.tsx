// ═══════════════════════════════════════════════════════════
// SPOTY tab — bike park list + add entry point.
//
// Supersedes the old MOJE ZJAZDY history tab. Run history moved
// to the RIDER tab under "AKTYWNOŚĆ" (handoff A6) because the
// retention question for this slot is "gdzie pojadę" not
// "co się zjeździło". Full list view ships in A4.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chunk9Colors, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

export default function SpotsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.inner}>
        <Text style={styles.title}>SPOTY</Text>
        <Text style={styles.body}>Lista bike parków — ładuje się za chwilę.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: chunk9Colors.bg.base },
  inner: {
    flex: 1,
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingTop: chunk9Spacing.sectionVertical,
    gap: 8,
  },
  title: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
  },
  body: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
});
