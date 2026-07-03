import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryOne = vi.fn();
const mockIsEnabled = vi.fn();
const mockGetReadiness = vi.fn();
const mockGetTimeline = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryRun: vi.fn(),
  getTableColumns: undefined,
}));
vi.mock('../../../../server/src/services/initiative/initiativeGateAiConfig.js', () => ({
  isInitiativeGateAiEnabled: (...a: unknown[]) => mockIsEnabled(...a),
  getGateAiThreshold: vi.fn(),
}));
vi.mock('../../../../server/src/services/initiative/gateAiReadinessService.js', () => ({
  getGateReadiness: (...a: unknown[]) => mockGetReadiness(...a),
}));
vi.mock('../../../../server/src/services/initiative/gateTimelineService.js', () => ({
  getTimelineFlags: (...a: unknown[]) => mockGetTimeline(...a),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { InitiativeController } from '../../../../server/src/controllers/InitiativeController.js';
import { gateAiSoftBlocks } from '../../../../server/src/types/gateAi.js';

function createRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}
const ORG = 'org-1';

describe('InitiativeController.getGateAiCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 without org', async () => {
    const res = createRes();
    await InitiativeController.getGateAiCheck({ user: null, params: { id: 'i1' }, body: {} } as any, res as any, vi.fn() as any);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('400 on unknown gate (no derivable gate)', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'i1', status: 'PLANNING' });
    const res = createRes();
    await InitiativeController.getGateAiCheck(
      { user: { organizationId: ORG }, params: { id: 'i1' }, body: { gate: 'NONSENSE' } } as any,
      res as any,
      vi.fn() as any
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('derives the gate from targetStatus when no explicit gate is given', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'i1', status: 'PLANNING' });
    mockIsEnabled.mockResolvedValueOnce(true);
    const readiness = { score: 88, threshold: 75, verdict: 'ready', gaps: [], fixes: [] };
    mockGetReadiness.mockResolvedValueOnce(readiness);
    mockGetTimeline.mockResolvedValueOnce(null);
    const res = createRes();
    // PLANNING → APPROVED is the APPROVE gate
    await InitiativeController.getGateAiCheck(
      { user: { organizationId: ORG }, params: { id: 'i1' }, body: { targetStatus: 'APPROVED' } } as any,
      res as any,
      vi.fn() as any
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, gate: 'APPROVE', aiReadiness: readiness })
    );
  });

  it('404 when the initiative is not in the caller org', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const res = createRes();
    await InitiativeController.getGateAiCheck(
      { user: { organizationId: ORG }, params: { id: 'i1' }, body: { gate: 'APPROVE' } } as any,
      res as any,
      vi.fn() as any
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), ['i1', ORG]);
  });

  it('enabled:false (no AI computed) when the per-org flag is OFF', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'i1' });
    mockIsEnabled.mockResolvedValueOnce(false);
    const res = createRes();
    await InitiativeController.getGateAiCheck(
      { user: { organizationId: ORG }, params: { id: 'i1' }, body: { gate: 'APPROVE' } } as any,
      res as any,
      vi.fn() as any
    );
    expect(res.json).toHaveBeenCalledWith({
      enabled: false,
      gate: 'APPROVE',
      aiReadiness: null,
      timeline: null,
    });
    expect(mockGetReadiness).not.toHaveBeenCalled();
  });

  it('enabled:true with readiness + timeline when flag ON and gate is an AI gate', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'i1' });
    mockIsEnabled.mockResolvedValueOnce(true);
    const readiness = { score: 80, threshold: 75, verdict: 'ready', gaps: [], fixes: [] };
    mockGetReadiness.mockResolvedValueOnce(readiness);
    mockGetTimeline.mockResolvedValueOnce(null);
    const res = createRes();
    await InitiativeController.getGateAiCheck(
      { user: { organizationId: ORG }, params: { id: 'i1' }, body: { gate: 'approve' } } as any,
      res as any,
      vi.fn() as any
    );
    expect(res.json).toHaveBeenCalledWith({
      enabled: true,
      gate: 'APPROVE',
      aiReadiness: readiness,
      timeline: null,
    });
  });
});

describe('gateAiSoftBlocks (soft-block decision)', () => {
  it('never blocks when disabled', () => {
    expect(gateAiSoftBlocks({ enabled: false, gate: 'APPROVE', aiReadiness: null, timeline: null })).toBe(false);
  });
  it('blocks when readiness is below threshold', () => {
    expect(
      gateAiSoftBlocks({
        enabled: true,
        gate: 'APPROVE',
        aiReadiness: { score: 40, threshold: 75, verdict: 'below', gaps: [], fixes: [] },
        timeline: null,
      })
    ).toBe(true);
  });
  it('blocks when a timeline flag is severity block', () => {
    expect(
      gateAiSoftBlocks({
        enabled: true,
        gate: 'SCHEDULE',
        aiReadiness: { score: 90, threshold: 75, verdict: 'ready', gaps: [], fixes: [] },
        timeline: { flags: [{ severity: 'block', kind: 'dependency', message: 'x' }] },
      })
    ).toBe(true);
  });
  it('does not block on warn-only timeline + ready readiness', () => {
    expect(
      gateAiSoftBlocks({
        enabled: true,
        gate: 'SCHEDULE',
        aiReadiness: { score: 90, threshold: 75, verdict: 'ready', gaps: [], fixes: [] },
        timeline: { flags: [{ severity: 'warn', kind: 'date_conflict', message: 'x' }] },
      })
    ).toBe(false);
  });
});
