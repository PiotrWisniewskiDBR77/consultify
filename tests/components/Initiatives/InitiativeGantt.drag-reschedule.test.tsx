/**
 * @vitest-environment jsdom
 *
 * InitiativeGantt — drag-reschedule (M13 Depth · Seria V · W5).
 *
 * Locks in the W5 drag behavior:
 *   - Task bars are draggable: they carry the cursor-grab class and a wired
 *     onPointerDown handler; a simulated drag persists via
 *     Api.put('/api/pmo/tasks/:id', { startedAt, dueDate }) AND fires onReschedule.
 *   - Milestone / phase bars are NOT draggable: no cursor-grab, no pointer handler,
 *     and dragging them never hits the task PUT endpoint.
 *
 * jsdom lacks PointerEvent + setPointerCapture/releasePointerCapture, which the
 * component uses, so we polyfill the minimum surface below.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

import { InitiativeGantt } from '@/components/Initiatives/gantt/InitiativeGantt';
import type { ScheduleItem } from '@/types/initiativeSchedule';

const putMock = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    put: (...args: any[]) => putMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// --- jsdom pointer polyfills ----------------------------------------------
// jsdom has no PointerEvent and HTMLElement.setPointerCapture/releasePointerCapture.
class FakePointerEvent extends Event {
  clientX: number;
  pointerId: number;
  constructor(type: string, init: any = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.clientX = init.clientX ?? 0;
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeEach(() => {
  putMock.mockReset();
  putMock.mockResolvedValue({});
  // @ts-expect-error — minimal polyfill for the component's pointer plumbing.
  global.PointerEvent = FakePointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  // The drag math divides by the grid's measured width; jsdom reports 0 by default.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 1000,
    height: 32,
    top: 0,
    left: 0,
    right: 1000,
    bottom: 32,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

const TASK: ScheduleItem = {
  id: 'task:1',
  type: 'task',
  title: 'Build feature',
  start: '2026-06-01',
  end: '2026-06-05',
  sourceId: '1',
  sourceKind: 'task',
};
const MILESTONE: ScheduleItem = {
  id: 'milestone:9',
  type: 'milestone',
  title: 'Launch gate',
  start: '2026-06-10',
  end: '2026-06-10',
  sourceId: '9',
  sourceKind: 'milestone',
};

function barFor(title: string): HTMLElement {
  // The draggable bar is the element carrying title=<item.title>.
  const el = document.querySelector(`[title^="${title}"]`);
  if (!el) throw new Error(`No bar found for "${title}"`);
  return el as HTMLElement;
}

/** Simulate a left-to-right drag of `el` by `dx` px (well over the half-day snap threshold). */
async function drag(el: HTMLElement, dx: number) {
  await act(async () => {
    el.dispatchEvent(new FakePointerEvent('pointerdown', { clientX: 0, pointerId: 1 }));
    el.dispatchEvent(new FakePointerEvent('pointermove', { clientX: dx, pointerId: 1 }));
    el.dispatchEvent(new FakePointerEvent('pointerup', { clientX: dx, pointerId: 1 }));
    await Promise.resolve();
  });
}

describe('InitiativeGantt — drag-reschedule (W5)', () => {
  it('renders a task bar with cursor-grab affordance', () => {
    render(<InitiativeGantt items={[TASK]} />);
    const bar = barFor('Build feature');
    expect(bar.className).toContain('cursor-grab');
  });

  it('persists a task drag via PUT /api/pmo/tasks/:id and calls onReschedule', async () => {
    const onReschedule = vi.fn();
    render(<InitiativeGantt items={[TASK]} onReschedule={onReschedule} />);

    // Drag ~200px right (range spans many weeks → comfortably > half-day snap).
    await drag(barFor('Build feature'), 200);

    expect(putMock).toHaveBeenCalledTimes(1);
    const [url, body] = putMock.mock.calls[0];
    expect(url).toBe('/api/pmo/tasks/1');
    expect(body).toHaveProperty('startedAt');
    expect(body).toHaveProperty('dueDate');
    expect(typeof body.startedAt).toBe('string');
    expect(typeof body.dueDate).toBe('string');

    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule.mock.calls[0][0]).toBe('task:1'); // itemId
    expect(onReschedule.mock.calls[0][1]).toBe('task'); // sourceKind
    expect(onReschedule.mock.calls[0][2]).toBe('1'); // sourceId
  });

  it('does NOT make a task bar out of a milestone (no cursor-grab, no PUT on drag)', async () => {
    const onReschedule = vi.fn();
    // Include the task so the schedule has a valid week range for both rows.
    render(<InitiativeGantt items={[TASK, MILESTONE]} onReschedule={onReschedule} />);

    const milestoneBar = barFor('Launch gate');
    expect(milestoneBar.className).not.toContain('cursor-grab');

    await drag(milestoneBar, 200);

    // Milestones never carry a pointer handler → no task endpoint hit, no callback.
    expect(putMock).not.toHaveBeenCalled();
    expect(onReschedule).not.toHaveBeenCalled();
  });
});
