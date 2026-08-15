import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();
const mockAuditLog = vi.fn();
const mockGetTableColumns = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  queryOne: vi.fn(),
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../services/AuditEventsService.js', () => ({
  default: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('uuid', () => ({
  v4: () => 'initiative-1',
}));

import { InitiativeController } from '../../controllers/InitiativeController.js';

function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as any;
}

describe('InitiativeController interview insight lineage', () => {
  beforeEach(() => {
    mockQueryAll.mockReset();
    mockQueryRun.mockReset();
    mockAuditLog.mockReset();
    mockGetTableColumns.mockReset();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockAuditLog.mockResolvedValue(undefined);
    mockGetTableColumns.mockResolvedValue([
      { name: 'source_type' },
      { name: 'created_from' },
      { name: 'category' },
    ]);
  });

  it('filters interview insight initiatives through source, created_from, or category', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'initiative-1',
        organization_id: 'org-1',
        title: 'Draft from insight',
        source_type: 'interview_insight',
        source_id: 'insight-1',
        action_contract_json: JSON.stringify({ target: 'initiative' }),
        source_pack_json: JSON.stringify({ entries: [{ answerId: 'answer-1' }] }),
        evidence_refs_json: JSON.stringify(['answer-1']),
      },
    ]);

    const req = {
      user: { organizationId: 'org-1', id: 'user-1' },
      query: { source: 'interview_insight' },
      headers: {},
    } as any;
    const res = buildRes();

    await InitiativeController.getInitiatives(req, res, vi.fn());

    const [sql, params] = mockQueryAll.mock.calls[0];
    expect(sql).toContain("LOWER(COALESCE(i.source_type, '')) = ?");
    expect(sql).toContain("LOWER(COALESCE(i.created_from, '')) = ?");
    expect(sql).toContain("LOWER(COALESCE(i.category, '')) = ?");
    expect(params).toEqual([
      'org-1',
      'interview_insight',
      'interview_insight',
      'interview_insight',
    ]);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'interview_insight',
          actionContract: { target: 'initiative' },
          sourcePack: { entries: [{ answerId: 'answer-1' }] },
          evidenceRefs: ['answer-1'],
        }),
      ])
    );
  });

  it('persists action contract, source pack, and evidence refs on create', async () => {
    const req = {
      // ADMIN: creation is blocked for the pilot USER/GUEST band, so the
      // lineage-persistence path must run as an authorized (non-pilot) creator.
      user: { organizationId: 'org-1', id: 'user-1', role: 'admin' },
      ip: '127.0.0.1',
      get: vi.fn(),
      body: {
        title: 'Initiative from insight',
        projectId: 'project-1',
        sourceType: 'interview_insight',
        sourceId: 'insight-1',
        actionContract: { target: 'initiative' },
        sourcePack: { entries: [{ answerId: 'answer-1' }] },
        evidenceRefs: ['answer-1'],
      },
    } as any;
    const res = buildRes();

    await InitiativeController.createInitiative(req, res, vi.fn());

    const [sql, params] = mockQueryRun.mock.calls[0];
    expect(sql).toContain('action_contract_json');
    expect(sql).toContain('source_pack_json');
    expect(sql).toContain('evidence_refs_json');
    expect(params).toContain(JSON.stringify({ target: 'initiative' }));
    expect(params).toContain(JSON.stringify({ entries: [{ answerId: 'answer-1' }] }));
    expect(params).toContain(JSON.stringify(['answer-1']));
    expect(res.json).toHaveBeenCalledWith({
      id: 'initiative-1',
      name: 'Initiative from insight',
      message: 'Initiative created',
    });
  });
});
