export const motion = {
  // Durations (ms)
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  dramatic: 800,
  heroReveal: 1200,

  // Spring configs for reanimated
  spring: {
    snappy: { damping: 20, stiffness: 300, mass: 0.8 },
    impact: { damping: 15, stiffness: 400, mass: 0.6 },
    bouncy: { damping: 12, stiffness: 200, mass: 1 },
    gentle: { damping: 20, stiffness: 150, mass: 1 },
  },

  // Easing-like timing
  timing: {
    fast: { duration: 200 },
    normal: { duration: 300 },
    slow: { duration: 500 },
    dramatic: { duration: 800 },
  },
} as const;

export const glows = {
  pb: {
    color: 'rgba(0, 255, 136, 0.6)',
    radius: 20,
  },
  rankUp: {
    color: 'rgba(255, 215, 0, 0.5)',
    radius: 16,
  },
  legend: {
    color: 'rgba(0, 255, 136, 0.8)',
    radius: 24,
  },
  danger: {
    color: 'rgba(255, 59, 48, 0.5)',
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
