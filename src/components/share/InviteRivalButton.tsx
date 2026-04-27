// ─────────────────────────────────────────────────────────────
// InviteRivalButton — "ZAPROŚ RYWALA" CTA wrapping React Native
// Share API. Used on result screen + Tablica hero/proof card.
//
// Errors are swallowed silently except an opt-in onError callback,
// because Share.share() rejects when the user dismisses the sheet
// (which is NOT a real error). The button never blocks UX on share
// failure — caller surfaces a soft toast if it cares.
// ─────────────────────────────────────────────────────────────

import { Pressable, Share, StyleSheet, Text, type ViewStyle } from 'react-native';
import { tapLight } from '@/systems/haptics';
import { buildInviteShare, type InviteContext } from '@/features/share/inviteRival';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface InviteRivalButtonProps {
  context: InviteContext;
  /** Optional callback fired when the OS share sheet successfully
   *  dispatched (action !== Share.dismissedAction). */
  onShared?: () => void;
  /** Optional callback for hard failures (rare; Share.share rejects
   *  on user dismissal too — we filter that out before calling). */
  onError?: (e: unknown) => void;
  /** Visual variant — `'pill'` is the default rounded outline used
   *  on result + Tablica; `'inline'` is a compact text-only link
   *  for tighter card surfaces. */
  variant?: 'pill' | 'inline';
  /** Custom label override; defaults to "ZAPROŚ RYWALA". */
  label?: string;
  style?: ViewStyle;
}

export function InviteRivalButton({
  context,
  onShared,
  onError,
  variant = 'pill',
  label = 'ZAPROŚ RYWALA',
  style,
}: InviteRivalButtonProps) {
  async function handlePress() {
    tapLight();
    try {
      const payload = buildInviteShare(context);
      const result = await Share.share(
        {
          title: payload.title,
          message: payload.message,
          url: payload.url,
        },
        { dialogTitle: payload.title },
      );
      // dismissedAction is the user closing the sheet — not an error.
      if (result.action !== Share.dismissedAction) {
        onShared?.();
      }
    } catch (e) {
      onError?.(e);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        variant === 'pill' ? styles.pill : styles.inline,
        pressed && (variant === 'pill' ? styles.pillPressed : styles.inlinePressed),
        style,
      ]}
    >
      <Text style={variant === 'pill' ? styles.pillLabel : styles.inlineLabel}>
        {label}
      </Text>
      {variant === 'pill' ? <Text style={styles.pillArrow}>↗</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderHot,
    backgroundColor: colors.accentDim,
  },
  pillPressed: {
    backgroundColor: colors.accent,
  },
  pillLabel: {
    fontFamily: fonts.racing,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.4,
  },
  pillArrow: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  inline: {
    paddingVertical: 4,
  },
  inlinePressed: {
    opacity: 0.6,
  },
  inlineLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
  },
});
