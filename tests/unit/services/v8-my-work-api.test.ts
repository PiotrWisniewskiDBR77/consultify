import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8MyWorkApi } from '@/services/api/v8/my-work';
import { v8Get, v8Post } from '@/services/api/v8/client';

describe('V8MyWorkApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests canonical inbox rows from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({ items: [] });

    await V8MyWorkApi.getCanonicalInboxTable({
      status: 'pending',
      limit: 200,
      section: 'assigned_tasks',
    });

    expect(v8Get).toHaveBeenCalledWith('/my-work/inbox/canonical', {
      status: 'pending',
      limit: '200',
      section: 'assigned_tasks',
    });
  });

  it('requests canonical inbox stats from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      total: 12,
      byPriority: { critical: 4 },
      bySection: { assigned_tasks: 3 },
      byStatus: { pending: 9, resolved: 2, snoozed: 1 },
      bySlaStatus: { breached: 2 },
    });

    const data = await V8MyWorkApi.getCanonicalInboxStats();

    expect(v8Get).toHaveBeenCalledWith('/my-work/inbox/canonical/stats');
    expect(data.total).toBe(12);
  });

  it('materializes canonical inbox rows through the V8 namespace', async () => {
    vi.mocked(v8Post).mockResolvedValue({ success: true, upserted: 3 });

    const data = await V8MyWorkApi.materializeCanonicalInbox();

    expect(v8Post).toHaveBeenCalledWith('/my-work/inbox/canonical/materialize');
    expect(data.success).toBe(true);
    expect(data.upserted).toBe(3);
  });
});
