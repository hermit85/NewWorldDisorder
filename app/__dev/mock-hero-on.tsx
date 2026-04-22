import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function MockHeroOnScreen() {
  const router = useRouter();

  useEffect(() => {
    if (__DEV__) {
      (globalThis as typeof globalThis & { __DEV_MOCK_HERO_BEAT__?: boolean }).__DEV_MOCK_HERO_BEAT__ = true;
    }
    router.replace('/(tabs)');
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
