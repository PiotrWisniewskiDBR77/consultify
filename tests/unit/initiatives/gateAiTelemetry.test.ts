import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRun = vi.fn();
const mockTableExists = vi.fn();
const mockWarn = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: (...a: unknown[]) => mockRun(...a),
  tableExists: (...a: unknown[]) => mockTableExists(...a),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: (...a: unknown[]) => mockWarn(...a), info: vi.fn(), error: vi.fn() },
}));

import { recordGateAiEvent } from '../../../server/src/services/initiative/gateAiTelemetryService.js';

describe('gateAiTelemetryService.recordGateAiEvent (G4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a row with correct columns and coerced values', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockRun.mockResolvedValueOnce({ success: true });

    await recordGateAiEvent({
      organizationId: 'org-1',
      initiativeId: 'init-9',
      gate: 'SCHEDULE',
      score: 62.4,
      timelineBlock: true,
      blocked: true,
      overridden: true,
      overrideReason: 'sponsor accepted risk',
      userId: 'user-7',
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    const sql = String(mockRun.mock.calls[0][0]);
    expect(sql).toMatch(/INSERT INTO initiative_gate_ai_events/);
    expect(sql).toMatch(/organization_id, initiative_id, gate, score, timeline_block, blocked, overridden, override_reason, user_id, created_at/);
    // Booleans → 1/0, score rounded to INTEGER, order matches the column list.
    expect(mockRun.mock.calls[0][1]).toEqual([
      'org-1',
      'init-9',
      'SCHEDULE',
      62,
      1, // timeline_block
      1, // blocked
      1, // overridden
      'sponsor accepted risk',
      'user-7',
    ]);
  });

  it('defaults optional fields to 0 / null', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockRun.mockResolvedValueOnce({ success: true });

    await recordGateAiEvent({
      organizationId: 'org-2',
      initiativeId: 'init-2',
      gate: 'APPROVE',
    });

    expect(mockRun.mock.calls[0][1]).toEqual([
      'org-2',
      'init-2',
      'APPROVE',
      null, // score
      0, // timeline_block
      0, // blocked
      0, // overridden
      null, // override_reason
      null, // user_id
    ]);
  });

  it('does not insert and does not throw when the table is missing', async () => {
    mockTableExists.mockResolvedValueOnce(false);

    await expect(
      recordGateAiEvent({ organizationId: 'org-3', initiativeId: 'init-3', gate: 'START' })
    ).resolves.toBeUndefined();

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('swallows a run() error (never breaks a transition)', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockRun.mockRejectedValueOnce(new Error('db down'));

    await expect(
      recordGateAiEvent({ organizationId: 'org-4', initiativeId: 'init-4', gate: 'START' })
    ).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalled();
  });

  it('skips silently when organizationId is blank', async () => {
    await recordGateAiEvent({ organizationId: '  ', initiativeId: 'init-5', gate: 'ACCEPT' });
    expect(mockTableExists).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });
});
