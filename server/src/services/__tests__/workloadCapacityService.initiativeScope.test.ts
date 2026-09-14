import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll } = vi.hoisted(() => ({ dbAll: vi.fn() }));

vi.mock('../../utils/DbPromise.js', () => ({
  default: { all: dbAll, get: vi.fn() },
  isSilenceableMissingRelationError: () => true,
}));

import { getExecutionResourcePlan } from '../workloadCapacityService.js';

describe('getExecutionResourcePlan initiative scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValueOnce([]);
  });

  it('binds project and initiative statuses inside the tenant-scoped task query', async () => {
    await getExecutionResourcePlan('org-1', {
      weeks: 8,
      projectId: 'project-1',
      initiativeStatuses: ['PENDING_APPROVAL', 'APPROVED'],
    });

    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toContain('i.project_id = ?');
    expect(sql).not.toContain('t.project_id = ?');
    expect(sql).toContain('FROM initiatives');
    expect(sql).toContain('UPPER(COALESCE(i.status');
    expect(params).toEqual(['org-1', 'project-1', 'PENDING_APPROVAL', 'APPROVED']);
  });
});
