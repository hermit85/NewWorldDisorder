// ═══════════════════════════════════════════════════════════
// RiderAvatar — shows rider photo or initials fallback
// Used in: profile, leaderboard, result screen
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';

interface Props {
  avatarUrl: string | null | undefined;
  username: string;
  size?: number;
  /** Border color override — defaults to border color */
  borderColor?: string;
}

function getInitials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export function RiderAvatar({ avatarUrl, username, size = 36, borderColor }: Props) {
  const [imgError, setImgError] = useState(false);

  // Reset error when URL changes (e.g. after avatar upload)
  useEffect(() => { setImgError(false); }, [avatarUrl]);
  const s = size;
  const borderW = s >= 60 ? 2 : 1.5;
  const fontSize = s >= 60 ? 18 : s >= 36 ? 12 : 9;
  const showImage = !!avatarUrl && !imgError;

  return (
    <View
      style={[
        styles.container,
        {
          width: s,
          height: s,
          borderRadius: s / 2,
          borderWidth: borderW,
          borderColor: borderColor ?? colors.border,
        },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, { width: s - borderW * 2, height: s - borderW * 2, borderRadius: (s - borderW * 2) / 2 }]}
          onError={() => setImgError(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>
          {getInitials(username)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontFamily: 'Inter_700Bold',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
});
