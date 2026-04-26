// ═══════════════════════════════════════════════════════════
// createTrail — ADR-012 Phase 1.2 two-tier name guard contract.
//
// The server returns three distinct shapes the client maps to a
// discriminated union:
//   - `ok: true` — happy path with `trail_id`
//   - `code: 'duplicate_name_in_spot'` + `existing` row — hard
//     normalized_name collision
//   - `code: 'name_suggests_existing'` + `suggestions[]` — soft
//     duplicate_base_key match; rider can bypass with
//     `forceCreate: true`
//   - any other code → polish-error fallback
//
// These tests pin the wrapper's mapping so a future server-side
// shape change can't silently regress the UI contract.
// ═══════════════════════════════════════════════════════════

import { createTrail } from '@/lib/api';

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  isSupabaseConfigured: true,
}));

const baseParams = {
  spotId: 'spot-test',
  name: 'Test Trail',
  difficulty: 'medium' as const,
  trailType: 'flow' as const,
};

describe('createTrail — two-tier guard', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('forwards forceCreate=false by default', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, trail_id: 'pioneer-abc' },
      error: null,
    });

    await createTrail(baseParams);

    expect(mockRpc).toHaveBeenCalledWith('create_trail', {
      p_spot_id: 'spot-test',
      p_name: 'Test Trail',
      p_difficulty: 'medium',
      p_trail_type: 'flow',
      p_force_create: false,
    });
  });

  it('returns ok=true with trailId on success', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, trail_id: 'pioneer-abc' },
      error: null,
    });

    const result = await createTrail(baseParams);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.trailId).toBe('pioneer-abc');
    }
  });

  it('maps duplicate_name_in_spot with existing row', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: false,
        code: 'duplicate_name_in_spot',
        existing: {
          trail_id: 'pioneer-existing',
          official_name: 'Kometa',
          difficulty: 'medium',
          trail_type: 'flow',
        },
      },
      error: null,
    });

    const result = await createTrail({ ...baseParams, name: 'Kómeta' });

    expect(result.ok).toBe(false);
    if (!result.ok && 'existing' in result) {
      expect(result.code).toBe('duplicate_name_in_spot');
      expect(result.existing.trailId).toBe('pioneer-existing');
      expect(result.existing.officialName).toBe('Kometa');
      expect(result.message).toMatch(/już istnieje/i);
    } else {
      throw new Error('expected duplicate_name_in_spot');
    }
  });

  it('maps name_suggests_existing with suggestions array', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: false,
        code: 'name_suggests_existing',
        suggestions: [
          {
            trail_id: 'pioneer-kometa',
            official_name: 'Kometa',
            difficulty: 'medium',
            trail_type: 'flow',
            calibration_status: 'fresh_pending_second_run',
          },
          {
            trail_id: 'pioneer-kometa-pro',
            official_name: 'Kometa Pro',
            difficulty: 'expert',
            trail_type: 'tech',
            calibration_status: 'fresh',
          },
        ],
      },
      error: null,
    });

    const result = await createTrail({ ...baseParams, name: 'Kometa 2' });

    expect(result.ok).toBe(false);
    if (!result.ok && 'suggestions' in result) {
      expect(result.code).toBe('name_suggests_existing');
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].officialName).toBe('Kometa');
      expect(result.suggestions[1].officialName).toBe('Kometa Pro');
    } else {
      throw new Error('expected name_suggests_existing');
    }
  });

  it('forwards forceCreate=true to bypass the soft warn', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: true, trail_id: 'pioneer-new' },
      error: null,
    });

    await createTrail({ ...baseParams, name: 'Kometa Black', forceCreate: true });

    expect(mockRpc).toHaveBeenCalledWith(
      'create_trail',
      expect.objectContaining({ p_force_create: true }),
    );
  });

  it('returns rpc_failed on transport error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'network down' },
    });

    const result = await createTrail(baseParams);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('rpc_failed');
      expect(result.message).toBeTruthy();
    }
  });

  it('maps unknown server codes through the polish-error fallback', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, code: 'something_unexpected' },
      error: null,
    });

    const result = await createTrail(baseParams);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('something_unexpected');
      expect(result.message).toBeTruthy();
    }
  });

  it('maps validation errors (name_too_short) with the polish copy', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, code: 'name_too_short' },
      error: null,
    });

    const result = await createTrail({ ...baseParams, name: 'Ab' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('name_too_short');
      expect(result.message).toMatch(/3 znaki/);
    }
  });
});
