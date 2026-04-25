// ─────────────────────────────────────────────────────────────
// NWD Design System v1.0 — Motion (§ 05)
//
// Tempo = stan. Faster = more urgent. Every animation MUST be
// gated on `prefers-reduced-motion` (handled in component layer
// via AccessibilityInfo.isReduceMotionEnabled()).
//
// Six named tokens:
//   pulseArmed       1.2s ease-in-out   urgent — "I'm racing"
//   pulseVerified    2.4s ease-in-out   calm — "Ride confirmed"
//   pulsePending     0.6s linear        anxious — "Validating"
//   scanAmbient      4.2s ease-in-out   HUD scan-line, ambient
//   sparkParticle    2.8s ease-out      iskry, achievement burst
//   glitchEvent      5.0s linear        rare glitch (5% of cycle)
// ─────────────────────────────────────────────────────────────

export const motion = {
  // ── Durations (ms) — generic transitions ───────────────────
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  dramatic: 800,
  heroReveal: 1200,

  // ── Race-state animation tokens (§ 05) ─────────────────────
  pulseArmed: 1200,        // armed dot pulse
  pulseVerified: 2400,     // verified dot breathe
  pulsePending: 600,       // pending dot blink
  scanAmbient: 4200,       // HUD scan-line sweep
  sparkParticle: 2800,     // particle field
  glitchEvent: 5000,       // glitch keyframe cycle

  // ── Spring configs for Reanimated ──────────────────────────
  spring: {
    snappy: { damping: 20, stiffness: 300, mass: 0.8 },
    impact: { damping: 15, stiffness: 400, mass: 0.6 },
    bouncy: { damping: 12, stiffness: 200, mass: 1 },
    gentle: { damping: 20, stiffness: 150, mass: 1 },
  },

  // ── Easing-like timing presets ─────────────────────────────
  timing: {
    fast: { duration: 200 },
    normal: { duration: 300 },
    slow: { duration: 500 },
    dramatic: { duration: 800 },
  },
} as const;

// Glow tokens — used for shadow / box-shadow surrogates.
// glowSoft sits inside elevation; glowHot is for armed rows.
export const glows = {
  // Design-system canonical
  glowSoft: { color: 'rgba(0, 255, 135, 0.12)', radius: 16 },
  glowHot:  { color: 'rgba(0, 255, 135, 0.30)', radius: 24 },

  // Legacy aliases — keep until call sites migrate.
  pb: {
    color: 'rgba(0, 255, 135, 0.6)',
    radius: 20,
  },
  rankUp: {
    color: 'rgba(255, 210, 63, 0.5)',
    radius: 16,
  },
  legend: {
    color: 'rgba(0, 255, 135, 0.8)',
    radius: 24,
  },
  danger: {
    color: 'rgba(255, 71, 87, 0.5)',
    radius: 12,
  },
} as const;

export const hapticPatterns = {
  runStart: 'medium' as const,
  runFinish: 'heavy' as const,
  pb: 'success' as const,
  rankUp: 'success' as const,
  achievement: 'success' as const,
  tap: 'light' as const,
  error: 'error' as const,
};
