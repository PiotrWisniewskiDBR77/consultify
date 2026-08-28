/**
 * R1 Smoke: V4-TOOL-03..07 — Context Pack Service
 * Verifies: buildContextForIntent, saveContextSnapshot, getContextSnapshot
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
  recordQueryPerformance: vi.fn(),
  getCurrentPgTransactionClient: vi.fn().mockReturnValue(undefined),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  buildContextForIntent,
  saveContextSnapshot,
  getContextSnapshot,
} from '../../../../server/src/services/ai/contextPackService.js';

describe('V4-TOOL: Context Pack Service', () => {
  it('exports buildContextForIntent', () => {
    expect(typeof buildContextForIntent).toBe('function');
  });
  it('exports saveContextSnapshot', () => {
    expect(typeof saveContextSnapshot).toBe('function');
  });
  it('exports getContextSnapshot', () => {
    expect(typeof getContextSnapshot).toBe('function');
  });

  it('getContextSnapshot() returns null for non-existent snapshot', async () => {
    const result = await getContextSnapshot('org-1', 'nonexistent-id');
    expect(result).toBeNull();
  });
});
