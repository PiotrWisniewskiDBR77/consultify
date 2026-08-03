import { describe, expect, it, vi } from 'vitest';

import { getExecutionManagementSnapshot } from '../executionManagementSnapshotService.js';

const ORG = 'org-1';
const INITIATIVE = 'ini-1';

function deps(overrides: { all?: ReturnType<typeof vi.fn>; get?: ReturnType<typeof vi.fn> } = {}) {
  return {
    get:
      overrides.get ||
      vi.fn().mockResolvedValue({
        id: INITIATIVE,
        projectId: 'project-1',
        name: 'Delivery',
        status: 'EXECUTING',
        ownerId: 'user-1',
        ownerName: 'Ada Owner',
        plannedStartDate: '2026-08-01',
        plannedEndDate: '2026-09-01',
        actualStartDate: null,
        actualEndDate: null,
      }),
    all: overrides.all || vi.fn().mockResolvedValue([]),
    now: () => new Date('2026-08-01T10:00:00.000Z'),
  };
}

describe('getExecutionManagementSnapshot', () => {
  it('assembles canonical initiative, milestones, linked tasks and linked decisions', async () => {
    const all = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'ms-1', initiativeId: INITIATIVE }])
      .mockResolvedValueOnce([{ id: 'task-1', initiativeId: INITIATIVE, status: 'todo' }])
      .mockResolvedValueOnce([{ id: 'decision-1', initiativeId: INITIATIVE, status: 'pending' }]);

    const snapshot = await getExecutionManagementSnapshot(
      ORG,
      INITIATIVE,
      'project-1',
      deps({ all })
    );

    expect(snapshot).toMatchObject({
      contractVersion: 'execution_management_snapshot_v1',
      asOf: '2026-08-01T10:00:00.000Z',
      initiative: { id: INITIATIVE, status: 'EXECUTING', ownerId: 'user-1' },
      milestones: [{ id: 'ms-1' }],
      tasks: [{ id: 'task-1', status: 'todo' }],
      decisions: [{ id: 'decision-1', status: 'pending' }],
      degradedSections: [],
    });
    expect(all.mock.calls[2][0]).toContain('WHERE initiative_id = ? AND organization_id = ?');
    expect(all.mock.calls[2][0]).not.toContain('project_id = ?');
    expect(all.mock.calls[2][1]).toEqual([INITIATIVE, ORG]);
  });

  it('queries only columns present in the canonical initiatives schema', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    await getExecutionManagementSnapshot(ORG, INITIATIVE, undefined, deps({ get }));
    expect(get.mock.calls[0][0]).toContain("COALESCE(i.name, '')");
    expect(get.mock.calls[0][0]).not.toContain('i.title');
  });

  it('returns available empty sections rather than marking them degraded', async () => {
    const snapshot = await getExecutionManagementSnapshot(ORG, INITIATIVE, undefined, deps());
    expect(snapshot?.milestones).toEqual([]);
    expect(snapshot?.tasks).toEqual([]);
    expect(snapshot?.decisions).toEqual([]);
    expect(snapshot?.provenance.tasks.state).toBe('available');
    expect(snapshot?.degradedSections).toEqual([]);
  });

  it('marks only a failed section degraded and preserves other reads', async () => {
    const all = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('tasks table unavailable'))
      .mockResolvedValueOnce([{ id: 'decision-1' }]);
    const snapshot = await getExecutionManagementSnapshot(
      ORG,
      INITIATIVE,
      undefined,
      deps({ all })
    );
    expect(snapshot?.tasks).toEqual([]);
    expect(snapshot?.decisions).toEqual([{ id: 'decision-1' }]);
    expect(snapshot?.provenance.tasks).toEqual({
      source: 'tasks',
      state: 'degraded',
      reason: 'section_unavailable',
    });
    expect(snapshot?.degradedSections).toEqual(['tasks']);
  });

  it('applies organization and optional project scope to the initiative lookup', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const snapshot = await getExecutionManagementSnapshot(
      ORG,
      INITIATIVE,
      'foreign-project',
      deps({ get })
    );
    expect(snapshot).toBeNull();
    expect(get.mock.calls[0][0]).toContain(
      'i.id = ? AND i.organization_id = ? AND i.project_id = ?'
    );
    expect(get.mock.calls[0][1]).toEqual([INITIATIVE, ORG, 'foreign-project']);
  });
});
