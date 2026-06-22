/**
 * @vitest-environment jsdom
 *
 * InitiativeGantt — drag rollback + click-vs-drag (M13 Depth · Seria V · W5).
 *
 * Companion to the drag-reschedule spec. Locks in the failure / no-op paths:
 *   - Api.put REJECTS → the optimistic override is reverted (bar snaps back to
 *     its original `left`) AND onReschedule is NOT called.
 *   - A sub-half-day pointer move (a click, not a drag) → no PUT, no callback,
 *     bar stays put.
 *
 * Pointer plumbing is polyfilled identically to InitiativeGantt.drag-reschedule.
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
  // @ts-expect-error — minimal polyfill for the component's pointer plumbing.
  global.PointerEvent = FakePointerEvent;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
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

function barFor(title: string): HTMLElement {
  const el = document.querySelector(`[title^="${title}"]`);
  if (!el) throw new Error(`No bar found for "${title}"`);
  return el as HTMLElement;
}

async function drag(el: HTMLElement, dx: number) {
  await act(async () => {
    el.dispatchEvent(new FakePointerEvent('pointerdown', { clientX: 0, pointerId: 1 }));
    el.dispatchEvent(new FakePointerEvent('pointermove', { clientX: dx, pointerId: 1 }));
    el.dispatchEvent(new FakePointerEvent('pointerup', { clientX: dx, pointerId: 1 }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('InitiativeGantt — drag rollback (W5)', () => {
  it('reverts the bar and does NOT call onReschedule when the PUT rejects', async () => {
    putMock.mockRejectedValue(new Error('500 server error'));
    const onReschedule = vi.fn();
    render(<InitiativeGantt items={[TASK]} onReschedule={onReschedule} />);

    const originalLeft = barFor('Build feature').style.left;

    await drag(barFor('Build feature'), 200);

    // The PUT was attempted…
    expect(putMock).toHaveBeenCalledTimes(1);
    // …but it failed, so the override is rolled back to the original position.
    expect(barFor('Build feature').style.left).toBe(originalLeft);
    // No success callback on a failed persist.
    expect(onReschedule).not.toHaveBeenCalled();
  });

  it('treats a sub-half-day move as a click: no PUT, no callback, no move', async () => {
    putMock.mockResolvedValue({});
    const onReschedule = vi.fn();
    render(<InitiativeGantt items={[TASK]} onReschedule={onReschedule} />);

    const originalLeft = barFor('Build feature').style.left;

    // Range spans many weeks; 1px over a 1000px grid is far under the half-day snap.
    await drag(barFor('Build feature'), 1);

    expect(putMock).not.toHaveBeenCalled();
    expect(onReschedule).not.toHaveBeenCalled();
    expect(barFor('Build feature').style.left).toBe(originalLeft);
  });
});
