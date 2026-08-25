import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import { duplicateCalendarEventFourWeeks } from '../duplicateCalendarEvent';

vi.mock('@/services/api', () => ({ default: { createMyWorkCalendarEvent: vi.fn() } }));
const create = vi.mocked(Api.createMyWorkCalendarEvent);
const input = {
  title: 'Focus',
  startAt: '2026-08-25T09:00:00.000Z',
  endAt: '2026-08-25T10:00:00.000Z',
};

describe('duplicateCalendarEventFourWeeks', () => {
  beforeEach(() => create.mockReset());
  it('creates four independent weekly events without recurrence fields', async () => {
    create.mockResolvedValue({ id: 'ok' });
    const result = await duplicateCalendarEventFourWeeks(input);
    expect(result.created).toHaveLength(4);
    expect(create.mock.calls.map(([body]) => body.startAt)).toEqual([
      '2026-09-01T09:00:00.000Z',
      '2026-09-08T09:00:00.000Z',
      '2026-09-15T09:00:00.000Z',
      '2026-09-22T09:00:00.000Z',
    ]);
    for (const [body] of create.mock.calls) {
      expect(body).not.toHaveProperty('recurrenceRule');
      expect(body).not.toHaveProperty('recurrenceParentId');
    }
  });
  it('reports partial failure per date and continues', async () => {
    create
      .mockResolvedValueOnce({ id: '1' })
      .mockResolvedValueOnce({ id: '2' })
      .mockRejectedValueOnce(new Error('conflict'))
      .mockResolvedValueOnce({ id: '4' });
    const result = await duplicateCalendarEventFourWeeks(input);
    expect(result.created).toHaveLength(3);
    expect(result.failed).toEqual([{ date: '2026-09-15T09:00:00.000Z', reason: 'conflict' }]);
  });
});
