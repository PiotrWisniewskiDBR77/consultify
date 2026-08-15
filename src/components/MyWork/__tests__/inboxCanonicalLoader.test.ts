import { describe, expect, it, vi } from 'vitest';

import { loadCanonicalInboxSnapshot } from '../inboxCanonicalLoader';

function makeDeps() {
  const item = {
    id: 'inbox-1', userId: 'user-a', organizationId: 'org-a', itemType: 'task' as const,
    sourceEntityType: 'task', sourceEntityId: 'task-1', title: 'Review task',
    priority: 'high' as const, section: 'assigned_tasks', status: 'pending' as const,
    slaStatus: 'on_track' as const, sourceStatus: 'in_progress', initiativeId: 'initiative-1',
    createdAt: '2026-08-15T10:00:00.000Z',
  };
  return {
    materializeCanonicalInbox: vi.fn().mockResolvedValue({ success: true, upserted: 1 }),
    getCanonicalInboxTable: vi.fn().mockResolvedValue({ items: [item] }),
    getCanonicalInboxStats: vi.fn().mockResolvedValue({
      total: 1, byPriority: { high: 1 }, bySection: { assigned_tasks: 1 },
      byStatus: { pending: 1 }, bySlaStatus: { on_track: 1 },
    }),
  };
}

describe('MYW-001 canonical Inbox loader', () => {
  it('materializes before reading and preserves task source lineage', async () => {
    const api = makeDeps();
    const order: string[] = [];
    const canonicalItem = (await api.getCanonicalInboxTable()).items[0];
    api.getCanonicalInboxTable.mockClear();
    api.materializeCanonicalInbox.mockImplementation(async () => {
      order.push('materialize');
      return { success: true, upserted: 1 };
    });
    api.getCanonicalInboxTable.mockImplementation(async () => {
      order.push('table');
      return { items: [canonicalItem] };
    });
    api.getCanonicalInboxStats.mockImplementation(async () => {
      order.push('stats');
      return makeDeps().getCanonicalInboxStats();
    });

    const result = await loadCanonicalInboxSnapshot({ status: 'pending', limit: 200 }, api);
    expect(order[0]).toBe('materialize');
    expect(order.slice(1).sort()).toEqual(['stats', 'table']);
    expect(result.items[0]).toMatchObject({
      organizationId: 'org-a', sourceEntityType: 'task', sourceEntityId: 'task-1',
      sourceStatus: 'in_progress', initiativeId: 'initiative-1',
    });
  });

  it('surfaces materialization failure and performs no subsequent reads', async () => {
    const api = makeDeps();
    api.materializeCanonicalInbox.mockRejectedValue(Object.assign(new Error('V8 disabled'), { status: 404 }));
    await expect(loadCanonicalInboxSnapshot({ status: 'pending' }, api)).rejects.toThrow('V8 disabled');
    expect(api.getCanonicalInboxTable).not.toHaveBeenCalled();
    expect(api.getCanonicalInboxStats).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed materialization instead of showing stale rows', async () => {
    const api = makeDeps();
    api.materializeCanonicalInbox.mockResolvedValue({ success: false });
    await expect(loadCanonicalInboxSnapshot({}, api)).rejects.toThrow('did not confirm success');
    expect(api.getCanonicalInboxTable).not.toHaveBeenCalled();
  });

  it('surfaces table and stats failures instead of a partial Inbox', async () => {
    const tableFailure = makeDeps();
    tableFailure.getCanonicalInboxTable.mockRejectedValue(new Error('canonical table failed'));
    await expect(loadCanonicalInboxSnapshot({}, tableFailure)).rejects.toThrow('canonical table failed');
    const statsFailure = makeDeps();
    statsFailure.getCanonicalInboxStats.mockRejectedValue(new Error('canonical stats failed'));
    await expect(loadCanonicalInboxSnapshot({}, statsFailure)).rejects.toThrow('canonical stats failed');
  });
});
