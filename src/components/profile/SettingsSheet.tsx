// ─────────────────────────────────────────────────────────────
// SettingsSheet — bottom sheet behind the gear icon on JA.
//
// Keeps the passport screen free of settings content. All
// account-management entry points live here: edit avatar,
// privacy, terms, support, sign out, delete account. Each row
// stays a one-tap navigation; the sheet does no business logic
// itself.
//
// React Native has no first-party bottom sheet, so we use a
// translucent Modal with a slide-up panel. Good enough for MVP;
// a swap to react-native-bottom-sheet can come later without
// touching consumers.
// ─────────────────────────────────────────────────────────────

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface SettingsSheetItem {
  label: string;
  /** When true, the row renders in danger color (e.g. Wyloguj, Usuń konto). */
  destructive?: boolean;
  onPress: () => void;
}

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  items: SettingsSheetItem[];
}

export function SettingsSheet({ visible, onClose, items }: SettingsSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Inner Pressable absorbs taps so they don't dismiss the sheet. */}
        <Pressable onPress={() => {}} style={styles.sheetWrap}>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.label}>USTAWIENIA</Text>
            <ScrollView contentContainerStyle={styles.list}>
              {items.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    item.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.rowLabel,
                      item.destructive && styles.rowLabelDestructive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.rowChevron,
                      item.destructive && styles.rowChevronDestructive,
                    ]}
                  >
                    →
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMid,
    marginBottom: 8,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2.4,
    paddingVertical: 4,
  },
  list: {
    gap: 4,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  rowPressed: {
    backgroundColor: colors.accentDim,
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowLabelDestructive: {
    color: colors.danger,
  },
  rowChevron: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textTertiary,
  },
  rowChevronDestructive: {
    color: colors.danger,
  },
});
