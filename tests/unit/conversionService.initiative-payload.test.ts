/**
 * Chain gap #5 regression pin (Ideas/MyWork ConvertTo → Initiative).
 *
 * The live POST /api/initiatives is guarded by validateBody(CreateInitiativeSchema):
 *  - `title` is REQUIRED (a `name`-only payload → 400, conversion dead at runtime)
 *  - provenance is camelCase `sourceType`/`sourceId` — snake_case keys are
 *    silently stripped by zod, so the back-reference to the source session was
 *    lost (source_type fell back to 'manual').
 *
 * These tests pin the fixed payload shape AND prove it against the REAL backend
 * schema, so a drift on either side (FE payload or BE validator) fails here.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    createInitiative: vi.fn(),
    post: vi.fn(),
  },
}));
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));
vi.mock('@/services/traceabilityService', () => ({
  materializeMyWorkSession: vi.fn(),
}));

import { Api } from '@/services/api';
import { createOutputFromSession } from '@/services/conversionService';
import { CreateInitiativeSchema } from '../../server/src/validators/initiative.validators';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('conversionService — ConvertTo → Initiative payload (chain #5)', () => {
  it('sends title + camelCase sourceType/sourceId (provenance back-ref preserved)', async () => {
    (Api.createInitiative as any).mockResolvedValue({ id: 'init-1' });

    const result = await createOutputFromSession('sess-42', 'initiative', 'My converted idea');

    expect(result.success).toBe(true);
    expect(result.outputId).toBe('init-1');
    expect(Api.createInitiative).toHaveBeenCalledOnce();
    const payload = (Api.createInitiative as any).mock.calls[0][0];
    expect(payload.title).toBe('My converted idea');
    expect(payload.sourceType).toBe('tool_session');
    expect(payload.sourceId).toBe('sess-42');
    // The broken snake_case keys must NOT come back.
    expect(payload.source_type).toBeUndefined();
    expect(payload.source_id).toBeUndefined();
  });

  it('the payload passes the REAL backend CreateInitiativeSchema with provenance intact', async () => {
    (Api.createInitiative as any).mockResolvedValue({ id: 'init-2' });

    await createOutputFromSession('sess-7', 'initiative', 'Schema round-trip idea');

    const payload = (Api.createInitiative as any).mock.calls[0][0];
    const parsed = CreateInitiativeSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Provenance survives validation — the back-ref the chain #5 gap was losing.
      expect((parsed.data as any).sourceType).toBe('tool_session');
      expect((parsed.data as any).sourceId).toBe('sess-7');
    }
  });

  it('REGRESSION: the old payload shape (name + snake_case) is rejected/stripped by the backend schema', () => {
    const legacyPayload = {
      name: 'My converted idea',
      description: 'Converted from MyWork session',
      source_type: 'tool_session',
      source_id: 'sess-42',
    };
    const parsed = CreateInitiativeSchema.safeParse(legacyPayload);
    // Missing `title` → the live route would 400 this payload.
    expect(parsed.success).toBe(false);
  });
});
