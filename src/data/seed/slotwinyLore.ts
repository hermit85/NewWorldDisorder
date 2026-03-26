// ═══════════════════════════════════════════════════════════
// SEED: Słotwiny Arena — Game lore & flavor content
// Arcade racing identity layer on top of official data
// ═══════════════════════════════════════════════════════════

// Spot lore
export const spotLore = {
  tagline: 'Tutaj rządzi grawitacja.',
  seasonIntro: 'Sezon 01 startuje na Słotwiny Arena. Cztery trasy. Jedna góra. Twoje nazwisko na tablicy.',
  worldDescription: 'Krynica-Zdrój. Ekipa Pingwina zbudowała to miejsce z ziemi i ambicji. Teraz to Twoja arena.',
} as const;

// Per-trail game flavor — short punchy lines for UI
export const trailFlavor: Record<string, {
  oneLiner: string;
  challenge: string;
  victoryLine: string;
  defeatLine: string;
}> = {
  'galgan-niebieska': {
    oneLiner: 'Smooth berms. Big tables. Build your speed.',
    challenge: 'Can you keep the flow for 2.7km?',
    victoryLine: 'Gałgan owned.',
    defeatLine: 'The warm-up got you.',
  },
  'dookola-swiata-zielona': {
    oneLiner: 'The long way down. Flow state guaranteed.',
    challenge: 'Longest trail on the mountain. Find your rhythm.',
    victoryLine: 'World Tour complete.',
    defeatLine: '3.1km is a long way to lose focus.',
  },
  'kometa-niebieska': {
    oneLiner: 'Find the rhythm. Carry the speed. Hit the line.',
    challenge: 'Berms and rollers. Pump or pedal — your choice.',
    victoryLine: 'Comet speed achieved.',
    defeatLine: 'The comet burns those who hesitate.',
  },
  'dzida-czerwona': {
    oneLiner: 'Raw. Fast. No forgiveness. Prove yourself.',
    challenge: 'Gaps, rocks, roots. The mountain doesn\'t care.',
    victoryLine: 'The Spear strikes.',
    defeatLine: 'Dzida demands respect.',
  },
};

// Difficulty flavor labels (used in UI instead of just "easy"/"hard")
export const difficultyLabels: Record<string, { label: string; sublabel: string }> = {
  easy: { label: 'FLOW', sublabel: 'Send it smooth' },
  medium: { label: 'PUSH', sublabel: 'Find the edge' },
  hard: { label: 'COMMIT', sublabel: 'No brakes' },
  expert: { label: 'FULL SEND', sublabel: 'Everything or nothing' },
  pro: { label: 'LEGEND', sublabel: 'Only the best survive' },
};

// Season-level challenges seeded for Słotwiny
export const seasonChallenges = [
  {
    id: 'weekend-heat-dzida',
    name: 'Weekend: Dzida',
    description: 'Ustaw najszybszy czas na Dzida Czerwona w ten weekend',
    trailId: 'dzida-czerwona',
    type: 'fastest_time' as const,
    rewardXp: 300,
  },
  {
    id: 'three-runs-today',
    name: '3 zjazdy dziś',
    description: 'Ukończ 3 prawidłowe zjazdy dziś na Słotwiny Arena',
    trailId: null,
    type: 'run_count' as const,
    rewardXp: 100,
  },
  {
    id: 'all-trails-session',
    name: 'Cała Góra',
    description: 'Przejedź wszystkie 4 trasy w jednej sesji',
    trailId: null,
    type: 'multi_trail' as const,
    rewardXp: 250,
  },
];
