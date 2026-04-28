import type { RunMode, VerificationStatus } from '@/data/verificationTypes';

export type RunResultDisplayKind =
  | 'leaderboard'
  | 'practice'
  | 'ranked_not_counted'
  | 'local'
  | 'saving'
  | 'pioneer_line';

export type RunResultReasonCode =
  | 'missed_start_gate'
  | 'missed_finish_gate'
  | 'gps_quality_too_low'
  | 'route_not_clean'
  | 'training_mode'
  | 'saved_locally'
  | 'submitted_but_not_ranked'
  | 'saving';

export interface RunResultDisplayInput {
  mode: RunMode;
  saveStatus?: string | null;
  verificationStatus?: VerificationStatus | string | null;
  leaderboardEligible?: boolean | null;
  countedInLeaderboard?: boolean | null;
  rankPosition?: number | null;
  isPioneer?: boolean;
}

export interface RunResultDisplayState {
  kind: RunResultDisplayKind;
  title: string;
  body: string;
  reasonCode: RunResultReasonCode | null;
  tone: 'success' | 'muted' | 'warning' | 'danger';
}

function normalizeStatus(value: RunResultDisplayInput['verificationStatus']): string {
  return typeof value === 'string' ? value : 'pending';
}

function mapRankedRejectionReason(status: string): RunResultReasonCode {
  if (status === 'outside_start_gate') return 'missed_start_gate';
  if (status === 'outside_finish_gate') return 'missed_finish_gate';
  if (status === 'weak_signal') return 'gps_quality_too_low';
  if (
    status === 'invalid_route' ||
    status === 'missing_checkpoint' ||
    status === 'shortcut_detected'
  ) {
    return 'route_not_clean';
  }
  return 'submitted_but_not_ranked';
}

export function getRunResultDisplayState(
  input: RunResultDisplayInput,
): RunResultDisplayState {
  const saveStatus = input.saveStatus ?? 'pending';
  const verificationStatus = normalizeStatus(input.verificationStatus);

  if (input.isPioneer) {
    return {
      kind: 'pioneer_line',
      title: 'Linia trasy zapisana',
      body: 'Pierwszy zjazd wyznaczył start, metę i linię dla tej trasy.',
      reasonCode: null,
      tone: 'success',
    };
  }

  if (saveStatus === 'saving' || saveStatus === 'pending') {
    return {
      kind: 'saving',
      title: 'Zapisuję wynik',
      body: 'Sprawdzam przejazd i wysyłam wynik do ligi.',
      reasonCode: 'saving',
      tone: 'warning',
    };
  }

  if (saveStatus === 'offline' || saveStatus === 'queued' || saveStatus === 'failed') {
    return {
      kind: 'local',
      title: 'Zapis lokalny',
      body:
        saveStatus === 'failed'
          ? 'Zjazd został w telefonie. Możesz ponowić wysłanie.'
          : 'Nie mamy teraz połączenia. Wyślę wynik, gdy wróci internet.',
      reasonCode: 'saved_locally',
      tone: 'warning',
    };
  }

  if (input.mode === 'practice' || verificationStatus === 'practice_only') {
    return {
      kind: 'practice',
      title: 'Zjazd treningowy',
      body: 'Nie trafi na ranking. Możesz jechać jeszcze raz rankingowo.',
      reasonCode: 'training_mode',
      tone: 'muted',
    };
  }

  const counted =
    input.countedInLeaderboard === true ||
    input.leaderboardEligible === true ||
    (typeof input.rankPosition === 'number' && input.rankPosition > 0);

  if (input.mode === 'ranked' && verificationStatus === 'verified' && counted) {
    return {
      kind: 'leaderboard',
      title: 'Wynik na tablicy',
      body: 'Twój czas został zapisany w lidze tej trasy.',
      reasonCode: null,
      tone: 'success',
    };
  }

  return {
    kind: 'ranked_not_counted',
    title: 'Nie zaliczono rankingu',
    body: 'Ten przejazd nie trafił na tablicę.',
    reasonCode: mapRankedRejectionReason(verificationStatus),
    tone: 'danger',
  };
}
