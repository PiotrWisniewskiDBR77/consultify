/**
 * R0 Smoke: V4-EXEC-02 — Workqueue (Action Queue) Service
 * Verifies: assignApproval(), getMyApprovals(), getOverdueCount()
 */

const mockDb = vi.hoisted(() => ({
  run: vi.fn((_sql: string, _params: any[], cb: any) => cb?.(null, { changes: 1 })),
  all: vi.fn((_sql: string, _params: any[], cb: any) => cb?.(null, [])),
  get: vi.fn((_sql: string, _params: any[], cb: any) => cb?.(null, null)),
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  default: { getDatabase: vi.fn().mockResolvedValue(mockDb) },
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import WorkqueueService from '../../../../server/src/services/workqueueService.js';

describe('V4-EXEC-02: Workqueue Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WorkqueueService.setDependencies({ db: mockDb });
  });

  it('exports assignApproval function', () => {
    expect(typeof WorkqueueService.assignApproval).toBe('function');
  });

  it('exports getMyApprovals function', () => {
    expect(typeof WorkqueueService.getMyApprovals).toBe('function');
  });

  it('exports completeApproval function', () => {
    expect(typeof WorkqueueService.completeApproval).toBe('function');
  });

  it('exports getOverdueCount function', () => {
    expect(typeof WorkqueueService.getOverdueCount).toBe('function');
  });

  it('getMyApprovals() returns an array', async () => {
    mockDb.all.mockImplementation((_sql: string, _params: any[], cb: any) => cb(null, []));
    const result = await WorkqueueService.getMyApprovals('user-1', 'org-1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('getOverdueCount() returns a number', async () => {
    mockDb.get.mockImplementation((_sql: string, _params: any[], cb: any) =>
      cb(null, { count: 5 })
    );
    const result = await WorkqueueService.getOverdueCount('org-1');
    expect(typeof result).toBe('number');
  });
});
