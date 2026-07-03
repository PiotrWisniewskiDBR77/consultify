/**
 * @vitest-environment jsdom
 *
 * InitiativeCalendar — drag-reschedule (M13 Depth · Seria R/V · 6e3a20d48f).
 *
 * Mirrors the Gantt W5 contract for the Calendar surface (HTML5 drag):
 *   - Task chips are draggable (cursor-grab) and set dataTransfer to their id;
 *     dropping on a different day persists via Api.put('/api/pmo/tasks/:id',
 *     { startedAt, dueDate }) AND fires onReschedule.
 *   - Without onReschedule the chips are not draggable (read-only calendar).
 *   - Milestones are not persisted via the task endpoint.
 *
 * jsdom has no real DragEvent/DataTransfer, so we polyfill the minimum surface.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

import { InitiativeCalendar } from '@/components/Initiatives/calendar/InitiativeCalendar';
import type { ScheduleItem } from '@/types/initiativeSchedule';

const putMock = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { put: (...args: any[]) => putMock(...args) },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// --- jsdom drag polyfills --------------------------------------------------
class FakeDataTransfer {
  private store = new Map<string, string>();
  setData(type: string, val: string) {
    this.store.set(type, val);
  }
  getData(type: string) {
    return this.store.get(type) ?? '';
  }
}
class FakeDragEvent extends Event {
  dataTransfer: FakeDataTransfer;
  constructor(type: string, dataTransfer: FakeDataTransfer) {
    super(type, { bubbles: true, cancelable: true });
    this.dataTransfer = dataTransfer;
  }
}

beforeEach(() => {
  putMock.mockReset();
  putMock.mockResolvedValue({});
  // Fix "today" so the June grid is visible deterministically.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

const TASK: ScheduleItem = {
  id: 'task:1',
  type: 'task',
  title: 'Build feature',
  start: '2026-06-15',
  end: '2026-06-17',
  sourceId: '1',
  sourceKind: 'task',
};

function chipFor(title: string): HTMLElement {
  const el = document.querySelector(`[title^="${title}"]`);
  if (!el) throw new Error(`No chip for "${title}"`);
  return el as HTMLElement;
}
/** A day cell whose data-day differs from `notIso` (a valid drop target). */
function otherDayCell(notIso: string): HTMLElement {
  const cells = Array.from(document.querySelectorAll('[data-day]')) as HTMLElement[];
  const target = cells.find((c) => c.getAttribute('data-day') && c.getAttribute('data-day') !== notIso);
  if (!target) throw new Error('No alternate day cell found');
  return target;
}

async function dragChipToDay(chip: HTMLElement, dayCell: HTMLElement) {
  const dt = new FakeDataTransfer();
  await act(async () => {
    chip.dispatchEvent(new FakeDragEvent('dragstart', dt)); // handler sets text/plain = item.id
    dayCell.dispatchEvent(new FakeDragEvent('drop', dt)); // handleDrop reads it
    await Promise.resolve();
  });
}

describe('InitiativeCalendar — drag-reschedule', () => {
  it('renders a draggable task chip with cursor-grab when onReschedule is provided', () => {
    render(<InitiativeCalendar items={[TASK]} onReschedule={vi.fn()} />);
    const chip = chipFor('Build feature');
    expect(chip.getAttribute('draggable')).toBe('true');
    expect(chip.className).toContain('cursor-grab');
  });

  it('is read-only (chip not draggable) without onReschedule', () => {
    render(<InitiativeCalendar items={[TASK]} />);
    const chip = chipFor('Build feature');
    expect(chip.getAttribute('draggable')).toBe('false');
    expect(chip.className).not.toContain('cursor-grab');
  });

  it('persists a task drop via PUT /api/pmo/tasks/:id and calls onReschedule', async () => {
    const onReschedule = vi.fn();
    render(<InitiativeCalendar items={[TASK]} onReschedule={onReschedule} />);

    await dragChipToDay(chipFor('Build feature'), otherDayCell('2026-06-15'));

    expect(putMock).toHaveBeenCalledTimes(1);
    const [url, body] = putMock.mock.calls[0];
    expect(url).toBe('/api/pmo/tasks/1');
    expect(body).toHaveProperty('startedAt');
    expect(body).toHaveProperty('dueDate');

    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule.mock.calls[0][0]).toBe('task:1'); // itemId
    expect(onReschedule.mock.calls[0][1]).toBe('task'); // sourceKind
    expect(onReschedule.mock.calls[0][2]).toBe('1'); // sourceId
  });
});
