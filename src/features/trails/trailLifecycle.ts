import type { CalibrationStatus, Trail, TrustTier } from '@/data/types';
import type { PillState, TrailStatus } from '@/components/nwd';

export type TrailDisplayKind =
  | 'sketch'
  | 'new'
  | 'league_open'
  | 'confirmed'
  | 'needs_review';

export interface TrailLifecycleInput {
  calibrationStatus?: CalibrationStatus | string | null;
  geometryMissing?: boolean | null;
  trustTier?: TrustTier | string | null;
  isActive?: boolean | null;
  currentVersionId?: string | null;
}

export interface TrailDisplayState {
  kind: TrailDisplayKind;
  label: string;
  title: string;
  body: string;
  pillState: PillState;
  cardStatus: TrailStatus;
}

export interface TrailAction {
  id: 'pioneer' | 'ranked' | 'practice';
  label: string;
  caption: string;
}

export interface TrailActions {
  primary: TrailAction;
  secondary: TrailAction | null;
  rankedAvailable: boolean;
}

function normalizeStatus(value: TrailLifecycleInput['calibrationStatus']): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

export function getTrailDisplayState(input: TrailLifecycleInput): TrailDisplayState {
  const status = normalizeStatus(input.calibrationStatus);

  if (input.isActive === false || input.trustTier === 'disputed' || status === 'locked') {
    return {
      kind: 'needs_review',
      label: 'Wymaga sprawdzenia',
      title: 'Wymaga sprawdzenia',
      body: 'Ta trasa jest ukryta przed ligą albo wymaga ręcznej kontroli.',
      pillState: 'invalid',
      cardStatus: 'closed',
    };
  }

  if (status === 'draft' || input.geometryMissing === true) {
    return {
      kind: 'sketch',
      label: 'Szkic',
      title: 'Szkic trasy',
      body: 'Ta trasa ma nazwę, ale nie ma jeszcze nagranej linii.',
      pillState: 'pending',
      cardStatus: 'validating',
    };
  }

  if (status === 'fresh_pending_second_run' || status === 'calibrating') {
    return {
      kind: 'new',
      label: 'Nowa trasa',
      title: 'Nowa trasa',
      body: 'Linia jest nagrana. Możesz jechać rankingowo; pierwsze przejazdy pomagają potwierdzić trasę.',
      pillState: 'pending',
      cardStatus: 'validating',
    };
  }

  if (status === 'live_fresh') {
    return {
      kind: 'league_open',
      label: 'Liga otwarta',
      title: 'Liga otwarta',
      body: 'Wyniki rankingowe wchodzą na tablicę. Trasa nadal zbiera potwierdzenia.',
      pillState: 'verified',
      cardStatus: 'open',
    };
  }

  if (status === 'live_confirmed' || status === 'stable' || status === 'verified') {
    return {
      kind: 'confirmed',
      label: 'Potwierdzona',
      title: 'Potwierdzona',
      body: 'Kilka przejazdów potwierdziło, że linia i bramki mają sens.',
      pillState: 'verified',
      cardStatus: 'open',
    };
  }

  return {
    kind: 'needs_review',
    label: 'Wymaga sprawdzenia',
    title: 'Wymaga sprawdzenia',
    body: 'Nie mamy pewności, czy ta trasa jest gotowa do ligi.',
    pillState: 'invalid',
    cardStatus: 'closed',
  };
}

export function getAvailableTrailActions(
  trail: Trail | TrailLifecycleInput,
  options: { isTrainingOnly?: boolean } = {},
): TrailActions {
  const state = getTrailDisplayState(trail);

  if (state.kind === 'sketch') {
    return {
      primary: {
        id: 'pioneer',
        label: 'Nagraj pierwszy zjazd',
        caption: 'Wyznaczysz linię, start i metę dla tej trasy.',
      },
      secondary: null,
      rankedAvailable: false,
    };
  }

  if (options.isTrainingOnly || state.kind === 'needs_review') {
    return {
      primary: {
        id: 'practice',
        label: 'Trening',
        caption: 'Bez rankingu. Dobry do rozpoznania trasy.',
      },
      secondary: null,
      rankedAvailable: false,
    };
  }

  return {
    primary: {
      id: 'ranked',
      label: 'Jedź rankingowo',
      caption:
        state.kind === 'new'
          ? 'Czas może wejść na tablicę. Ten przejazd może też pomóc potwierdzić trasę.'
          : 'Czas może wejść na tablicę.',
    },
    secondary: {
      id: 'practice',
      label: 'Trening',
      caption: 'Bez rankingu. Dobry do rozpoznania trasy.',
    },
    rankedAvailable: true,
  };
}
