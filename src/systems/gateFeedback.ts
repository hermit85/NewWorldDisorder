// ═══════════════════════════════════════════════════════════
// gateFeedback — haptic + TTS cues for gate events
//
// Why: during a ride the phone is in the pocket. If the timer silently
// auto-starts the rider has no way to know it worked, and walk-test v5
// showed riders tapping manually "just in case" — which either no-ops
// (armed_ranked) or force-starts (armed_practice) and the timer drifts
// from the real crossing. A loud BZZZ + spoken cue gives honest
// confirmation that the run is live.
//
// All calls are fire-and-forget and catch their own errors: audio/TTS
// failures must never crash the run, and Android devices without a TTS
// engine (rare but real) should still get the haptic.
// ═══════════════════════════════════════════════════════════

import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

const TTS_OPTIONS: Speech.SpeechOptions = {
  language: 'pl-PL',
  rate: 1.05,
  pitch: 1.0,
};

/** Internal: fire a sequence of heavy haptic impacts with a small delay
 *  between them so they feel like a burst rather than one long pulse. */
async function hapticBurst(count: number, spacingMs: number) {
  for (let i = 0; i < count; i++) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, spacingMs));
    }
  }
}

function speak(text: string) {
  Speech.speak(text, TTS_OPTIONS);
}

/**
 * Gate auto-start confirmation. Two heavy impacts + spoken "start".
 * The double pulse is loud enough to be felt through gloves + pocket
 * without being mistakable for a regular notification.
 */
export function announceAutoStart() {
  void hapticBurst(2, 90);
  speak('Start');
}

/**
 * Manual-start fallback confirmation (D3). Single heavy impact + "start
 * ręczny" so the rider knows the tap worked and the run is running but
 * unverified.
 */
export function announceManualStart() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  speak('Start ręczny');
}

/**
 * Gate auto-finish confirmation. Triple impact with success notification
 * haptic on top, and a spoken meta time so the rider doesn't need to look
 * at the phone at the bottom of the trail to know they finished.
 */
export function announceAutoFinish(elapsedMs: number) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  void hapticBurst(3, 120);
  speak(`Meta. ${formatSpokenTime(elapsedMs)}`);
}

/** Format "1:23.4" into something a TTS engine pronounces cleanly in
 *  Polish: "1 minuta 23 sekundy" for readability, drop tenths under a
 *  minute to keep the utterance short mid-ride. */
function formatSpokenTime(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes === 0) {
    return `${seconds} sekund`;
  }
  return `${minutes} ${minutes === 1 ? 'minuta' : 'minut'} ${seconds} ${seconds === 1 ? 'sekunda' : 'sekund'}`;
}

/** Abort any in-flight TTS utterance. Useful on cancel / unmount. */
export function stopGateSpeech() {
  Speech.stop();
}
