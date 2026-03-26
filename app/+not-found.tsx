// ═══════════════════════════════════════════════════════════
// Catch-all for unmatched routes (e.g. nwd://random)
// Redirects to root bootstrap which handles onboarding gate
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, []);

  return null;
}
