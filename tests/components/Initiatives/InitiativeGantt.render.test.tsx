/**
 * @vitest-environment jsdom
 *
 * InitiativeGantt — render (M13 Depth · Seria V · V1).
 *
 * Locks in the static render contract (sibling of the drag-reschedule spec):
 *   - Dated items render a bar carrying the type colour class + the title text.
 *   - The "today" marker (vertical line) appears only when now ∈ the rendered
 *     range, and is absent when the schedule sits entirely in the past.
 *   - Undated items (no `start`) are NOT placed on the axis — they land in the
 *     "undated" footer chip section.
 *   - No dated items at all → `range` is null → quiet empty state, no crash.
 *
 * Dates are anchored around the *real* clock (the component reads Date.now()
 * for the marker), so we build them relative to `new Date()`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';

import { InitiativeGantt } from '@/components/Initiatives/gantt/InitiativeGantt';
import type { ScheduleItem } from '@/types/initiativeSchedule';

// Api isn't hit on a pure render, but the component imports it at module load.
vi.mock('@/services/api', () => ({
  Api: { put: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
/** ISO yyyy-mm-dd for `daysFromNow` days relative to the real clock. */
function isoOffset(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * DAY_MS).toISOString().slice(0, 10);
}

beforeEach(() => {
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

function barFor(title: string, container: HTMLElement): HTMLElement | null {
  return container.querySelector(`[title^="${title}"]`);
}

describe('InitiativeGantt — render (V1)', () => {
  it('renders a task bar with the task colour class and the title text', () => {
    const task: ScheduleItem = {
      id: 'task:1',
      type: 'task',
      title: 'Build feature',
      start: isoOffset(0),
      end: isoOffset(4),
      sourceId: '1',
      sourceKind: 'task',
    };
    const { container } = render(<InitiativeGantt items={[task]} />);

    const bar = barFor('Build feature', container);
    expect(bar).not.toBeNull();
    // task bars carry the canonical semantic task colour token.
    expect(bar!.className).toContain('bg-c-tag-1');
    // title is also painted inside the bar.
    expect(bar!.textContent).toContain('Build feature');
  });

  it('shows the "today" marker when now falls inside the rendered range', () => {
    // Range straddles today: started yesterday, ends in a week.
    const task: ScheduleItem = {
      id: 'task:1',
      type: 'task',
      title: 'In progress',
      start: isoOffset(-1),
      end: isoOffset(7),
      sourceId: '1',
      sourceKind: 'task',
    };
    const { container } = render(<InitiativeGantt items={[task]} />);

    // The marker is the only aria-hidden vertical rule carrying the semantic text token.
    const marker = container.querySelector('[aria-hidden].bg-c-text');
    expect(marker).not.toBeNull();
  });

  it('omits the "today" marker when the whole schedule is in the past', () => {
    // Range entirely behind us: range = [weekStart(-120) .. -120+weeks]; well past.
    const task: ScheduleItem = {
      id: 'task:1',
      type: 'task',
      title: 'Old work',
      start: isoOffset(-120),
      end: isoOffset(-110),
      sourceId: '1',
      sourceKind: 'task',
    };
    const { container } = render(<InitiativeGantt items={[task]} />);

    const marker = container.querySelector('[aria-hidden].bg-c-text');
    expect(marker).toBeNull();
    // Sanity: the bar itself still renders.
    expect(barFor('Old work', container)).not.toBeNull();
  });

  it('routes undated items to the "undated" footer, not onto the axis', () => {
    const dated: ScheduleItem = {
      id: 'task:1',
      type: 'task',
      title: 'Has date',
      start: isoOffset(0),
      end: isoOffset(3),
      sourceId: '1',
      sourceKind: 'task',
    };
    const undated: ScheduleItem = {
      id: 'task:2',
      type: 'task',
      title: 'No date yet',
      start: null,
      end: null,
      sourceId: '2',
      sourceKind: 'task',
    };
    const { container, getByText } = render(<InitiativeGantt items={[dated, undated]} />);

    // The undated footer label is present (i18n key, t() is identity here).
    expect(getByText(/initiatives\.calendarView\.undated/)).toBeTruthy();
    // The undated item has NO draggable bar (no title=… element on the axis).
    expect(barFor('No date yet', container)).toBeNull();
    // …but its title shows as a footer chip.
    expect(getByText('No date yet')).toBeTruthy();
    // The dated item still has its bar.
    expect(barFor('Has date', container)).not.toBeNull();
  });

  it('renders a quiet empty state (no crash) when there is no dated item / range', () => {
    const undatedOnly: ScheduleItem = {
      id: 'task:1',
      type: 'task',
      title: 'Floating',
      start: null,
      end: null,
      sourceId: '1',
      sourceKind: 'task',
    };
    const { getByText } = render(<InitiativeGantt items={[undatedOnly]} />);

    // No range → empty-state copy, rendered without throwing.
    expect(getByText('initiatives.calendarView.empty')).toBeTruthy();
  });

  it('renders the empty state for a fully empty item list', () => {
    const { getByText } = render(<InitiativeGantt items={[]} />);
    expect(getByText('initiatives.calendarView.empty')).toBeTruthy();
  });
});
