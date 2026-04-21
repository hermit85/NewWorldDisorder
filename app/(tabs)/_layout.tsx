// ═══════════════════════════════════════════════════════════
// Tab bar — Ye brutalist (ADR-013).
//
// Serif lowercase labels, emerald dot under the active tab,
// hairline top border, no scale bounce or glow animation.
// ═══════════════════════════════════════════════════════════

import { Tabs } from 'expo-router';
import { Text, View, StyleSheet, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { hudColors, hudType, hudSpacing } from '@/theme/gameHud';

// Route name → serif lowercase label. Route filenames stay unchanged
// (history/leaderboard/profile) for zero-migration scope — only the
// visible label follows ADR-013 copy direction.
const TAB_LABELS: Record<string, string> = {
  index:       'home',
  history:     'zjazdy',
  leaderboard: 'tablica',
  profile:     'rider',
};

function TabItem({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text
        style={[
          styles.label,
          { color: focused ? hudColors.text.primary : hudColors.text.secondary },
        ]}
      >
        {label}
      </Text>
      <View style={styles.dotWrap}>
        {focused && <View style={styles.dot} />}
      </View>
    </View>
  );
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const label = TAB_LABELS[route.name] ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            style={styles.pressable}
          >
            <TabItem label={label} focused={focused} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: hudColors.surface.base,
    borderTopColor: hudColors.surface.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: hudSpacing.md,
  },
  pressable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabItem: { alignItems: 'center' },
  label: {
    ...hudType.navLabel,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  dotWrap: {
    marginTop: 6,
    height: 3,
    width: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: hudColors.signal,
  },
});
