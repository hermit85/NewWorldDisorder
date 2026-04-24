import { Tabs } from 'expo-router';
import {
  Text,
  View,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TIMING = { duration: 200, easing: Easing.out(Easing.cubic) };

const TAB_LABELS: Record<string, string> = {
  index: 'START',
  spots: 'SPOTY',
  leaderboard: 'TABLICA',
  profile: 'RIDER',
};

function TabItem({ label, focused }: { label: string; focused: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(1.05, { duration: 90 }),
        withTiming(1, { duration: 110 }),
      );
    }
  }, [focused]);

  // Inactive opacity raised from 0.35 → 0.62 so the label
  // remains readable on OLED iPhones without competing with
  // the focused tab. Color also moved up to textSecondary.
  const textAnim = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0.62, TIMING),
    transform: [{ scale: scale.value }],
  }));

  const barAnim = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, TIMING),
    transform: [{ scaleX: withTiming(focused ? 1 : 0, TIMING) }],
  }));

  const glowAnim = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 0.45 : 0, { duration: 280 }),
  }));

  return (
    <View style={styles.tabItem}>
      <Animated.Text
        style={[
          styles.label,
          { color: focused ? colors.textPrimary : colors.textSecondary },
          textAnim,
        ]}
      >
        {label}
      </Animated.Text>
      <View style={styles.barWrap}>
        <Animated.View style={[styles.bar, barAnim]} />
        <Animated.View style={[styles.glow, glowAnim]} />
      </View>
    </View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
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
      <Tabs.Screen name="spots" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItem: {
    alignItems: 'center',
  },
  label: {
    fontFamily: fonts.racing,
    fontSize: 11,
    letterSpacing: 2,
  },
  barWrap: {
    marginTop: 7,
    height: 2,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    height: 1.5,
    width: 20,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  glow: {
    position: 'absolute',
    height: 6,
    width: 28,
    borderRadius: 3,
    backgroundColor: colors.accentGlow,
  },
});
