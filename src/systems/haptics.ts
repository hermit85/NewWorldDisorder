// ═══════════════════════════════════════════════════════════
// Haptics — tactile feedback for key moments
// Sharp, premium, racing-game feel. Not childish bounces.
// ═══════════════════════════════════════════════════════════

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isDevice = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — UI transitions, selections */
export function tapLight() {
  if (!isDevice) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium tap — confirmations, arm run */
export function tapMedium() {
  if (!isDevice) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Heavy impact — run start, PB, finish */
export function tapHeavy() {
  if (!isDevice) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Success — verified, achievement, rank up */
export function notifySuccess() {
  if (!isDevice) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Warning — weak signal, practice only */
export function notifyWarning() {
  if (!isDevice) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** Error — invalid, rejected */
export function notifyError() {
  if (!isDevice) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

/** Selection tick — onboarding dots, tab switches */
export function selectionTick() {
  if (!isDevice) return;
  Haptics.selectionAsync().catch(() => {});
}
