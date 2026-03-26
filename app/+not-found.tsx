// ═══════════════════════════════════════════════════════════
// Catch-all for unmatched routes (e.g. nwd:/// on cold launch)
// Redirects to the main tab screen instead of showing an error
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to tabs — don't show a broken screen
    router.replace('/(tabs)');
  }, []);

  return null;
}
