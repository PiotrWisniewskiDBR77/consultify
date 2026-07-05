import { describe, expect, it } from 'vitest';

import { buildScheduleItems, toIsoDate } from '../../../src/services/initiativeSchedule';

describe('initiativeSchedule.buildScheduleItems (R1)', () => {
  it('empty source → []', () => {
    expect(buildScheduleItems({})).toEqual([]);
  });

  it('maps a task by dueDate', () => {
    const [item] = buildScheduleItems({
      tasks: [{ id: 't1', title: 'Spec', dueDate: '2026-07-01T00:00:00Z', status: 'todo' }],
    });
    expect(item).toMatchObject({
      id: 'task:t1',
      type: 'task',
      title: 'Spec',
      start: '2026-07-01',
      end: '2026-07-01',
      status: 'todo',
      sourceId: 't1',
      sourceKind: 'task',
    });
  });

  it('milestone is a point (start === end) from milestoneDate', () => {
    const [m] = buildScheduleItems({
      milestones: [{ id: 'm1', title: 'GA', milestoneDate: '2026-08-15' }],
    });
    expect(m.type).toBe('milestone');
    expect(m.start).toBe('2026-08-15');
    expect(m.end).toBe('2026-08-15');
  });

  it('normalizes varied field names (startDate/endDate, name)', () => {
    const [item] = buildScheduleItems({
      tasks: [{ id: 't2', name: 'Build', startDate: '2026-07-01', endDate: '2026-07-10' }],
    });
    expect(item.title).toBe('Build');
    expect(item.start).toBe('2026-07-01');
    expect(item.end).toBe('2026-07-10');
  });

  it('timeline phase spans start→end', () => {
    const [p] = buildScheduleItems({
      timeline: [{ id: 'p1', label: 'Discovery', start: '2026-06-01', end: '2026-06-30' }],
    });
    expect(p).toMatchObject({ id: 'phase:p1', type: 'phase', title: 'Discovery', sourceKind: 'phase' });
    expect(p.start).toBe('2026-06-01');
    expect(p.end).toBe('2026-06-30');
  });

  it('undated item → start/end null (kept for an "undated" bucket)', () => {
    const [item] = buildScheduleItems({ tasks: [{ id: 't3', title: 'No date' }] });
    expect(item.start).toBeNull();
    expect(item.end).toBeNull();
  });

  it('skips items without an id', () => {
    expect(buildScheduleItems({ tasks: [{ title: 'orphan' }] })).toEqual([]);
  });

  it('toIsoDate handles junk → null', () => {
    expect(toIsoDate('not-a-date')).toBeNull();
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('2026-09-09')).toBe('2026-09-09');
  });
});
