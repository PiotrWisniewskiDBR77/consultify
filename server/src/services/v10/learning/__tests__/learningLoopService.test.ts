import { beforeEach, describe, expect, it, vi } from 'vitest';

const runMock = vi.fn(async () => ({ success: true, changes: 1 }));
const getMock = vi.fn(async () => null);
const allMock = vi.fn(async () => []);

vi.mock('../../../../utils/DbPromise.js', () => ({
  run: (...args: any[]) => runMock(...args),
  get: (...args: any[]) => getMock(...args),
  all: (...args: any[]) => allMock(...args),
}));

import { LearningLoopService } from '../learningLoopService.js';

function makeScope() {
  return { tenantId: 'tenant-1', userId: 'user-1', userRole: 'ADMIN' as const };
}

describe('LearningLoopService (DB adapter)', () => {
  beforeEach(() => {
    runMock.mockClear();
    getMock.mockClear();
    allMock.mockClear();
  });

  it('submits feedback and enqueues stewardship for low rating', async () => {
    const service = new LearningLoopService();

    const good = await service.submitFeedback({
      scope: makeScope(),
      now: '2026-04-21T10:00:00.000Z',
      rating: 5,
      comment: 'nice',
      targetType: 'chat',
      tags: ['t1'],
    });
    expect(good.queuedForStewardship).toBe(false);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(String(runMock.mock.calls[0]?.[0] || '')).toContain('v10_learning_feedback');

    const bad = await service.submitFeedback({
      scope: makeScope(),
      now: '2026-04-21T10:01:00.000Z',
      rating: 1,
      comment: 'bad',
      targetType: 'chat',
      tags: ['t1'],
    });
    expect(bad.queuedForStewardship).toBe(true);
    expect(runMock).toHaveBeenCalledTimes(3);
    expect(String(runMock.mock.calls[2]?.[0] || '')).toContain('v10_learning_stewardship_queue');
  });

  it('blocks retention when PII-like patterns are present and enqueues stewardship item', async () => {
    const service = new LearningLoopService();
    const preview = await service.retentionPreview({
      scope: makeScope(),
      now: '2026-04-21T10:00:00.000Z',
      text: 'Contact me at test@example.com',
      contextHint: 'unit',
    });
    expect(preview.retain).toBe(false);
    expect(preview.ttlDays).toBe(0);
    expect(preview.reasons.length).toBeGreaterThan(0);
    expect(runMock).toHaveBeenCalledTimes(2);
    expect(String(runMock.mock.calls[0]?.[0] || '')).toContain('v10_learning_retention_previews');
    expect(String(runMock.mock.calls[1]?.[0] || '')).toContain('v10_learning_stewardship_queue');
  });

  it('resolves stewardship items through DB update', async () => {
    const service = new LearningLoopService();
    getMock.mockResolvedValueOnce({ item_id: 'item-1' });

    const res = await service.resolveStewardship('item-1', {
      scope: makeScope(),
      now: '2026-04-21T10:00:00.000Z',
      note: 'ok',
    });
    expect(res.status).toBe('resolved');
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(String(runMock.mock.calls[0]?.[0] || '')).toContain('UPDATE v10_learning_stewardship_queue');
  });

  it('computes dashboard metrics from aggregates', async () => {
    const service = new LearningLoopService();
    getMock
      .mockResolvedValueOnce({ total: 2, avg_rating: 3.5, low_count: 1 })
      .mockResolvedValueOnce({ total: 4, denied_count: 1 })
      .mockResolvedValueOnce({ open_items: 7 })
      .mockResolvedValueOnce({ total: 3, open: 2 });

    const dash = await service.dashboard({ tenantId: 'tenant-1', now: '2026-04-21T10:00:00.000Z' });
    expect(dash.feedback.total).toBe(2);
    expect(dash.feedback.avgRating).toBe(3.5);
    expect(dash.retention.previewTotal).toBe(4);
    expect(dash.stewardship.openItems).toBe(7);
    expect(dash.incidents.total).toBe(3);
    expect(dash.incidents.open).toBe(2);
  });
});

