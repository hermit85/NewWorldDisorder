// ═══════════════════════════════════════════════════════════
// submitFeedback — pin the insert payload + error mapping.
//
// Tester MVP loop: a rider on TestFlight taps "Wyślij feedback"
// from JA, types a sentence, and the report has to land in
// public.feedback_reports with the rider's user_id and any run /
// trail context the screen passed in. These tests pin the row
// shape and the empty-message guard.
// ═══════════════════════════════════════════════════════════

import { submitFeedback } from '@/lib/api';

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn((..._args: unknown[]) => ({ select: mockSelect }));
const mockFrom = jest.fn((..._args: unknown[]) => ({ insert: mockInsert }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
  isSupabaseConfigured: true,
}));

describe('submitFeedback', () => {
  beforeEach(() => {
    mockSingle.mockReset();
    mockSelect.mockClear();
    mockInsert.mockClear();
    mockFrom.mockClear();
  });

  test('rejects empty message without hitting the network', async () => {
    const res = await submitFeedback('user-me', { type: 'bug', message: '   ' });
    expect(res.ok).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
    if (!res.ok) {
      expect(res.code).toBe('empty_message');
    }
  });

  test('inserts a row keyed to the caller with type + message + run/trail context', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'fb-1' }, error: null });
    const res = await submitFeedback('user-me', {
      type: 'bug',
      message: 'Sync outbox utknął na 4 zjazdach.',
      screen: 'result',
      trailId: 'trail-prezydencka',
      runId: 'run-1',
      appVersion: '1.0.0 (33)',
      deviceInfo: { platform: 'ios' },
      debugPayload: { saveStatus: 'queued' },
    });
    expect(res.ok).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('feedback_reports');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-me',
      type: 'bug',
      message: 'Sync outbox utknął na 4 zjazdach.',
      screen: 'result',
      trail_id: 'trail-prezydencka',
      run_id: 'run-1',
      app_version: '1.0.0 (33)',
    }));
  });

  test('clamps a 5000-char message down to 4000 (matches DB CHECK)', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'fb-2' }, error: null });
    const long = 'a'.repeat(5000);
    await submitFeedback('user-me', { type: 'praise', message: long });
    const firstCall = mockInsert.mock.calls[0] ?? [];
    const insertedRow = firstCall[0] as { message: string };
    expect(insertedRow.message.length).toBe(4000);
  });

  test('maps a Supabase error into ApiErr with code=insert_failed', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'rls denied' } });
    const res = await submitFeedback('user-me', { type: 'bug', message: 'x' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('insert_failed');
    }
  });
});
