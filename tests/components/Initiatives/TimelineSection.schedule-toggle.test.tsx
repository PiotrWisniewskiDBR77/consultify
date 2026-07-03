/**
 * @vitest-environment jsdom
 *
 * TimelineSection — schedule view toggle (M13 Depth · Seria R + V).
 *
 * Locks in the Calendar / Gantt segmented control:
 *   - Initial state is "none": neither view is mounted, neither button is pressed.
 *   - Click "Gantt" → aria-pressed=true on Gantt + the Gantt view mounts.
 *   - Click "Calendar" → switches: Calendar pressed + mounted, Gantt unmounts.
 *   - Re-click the active button → collapses back to "none" (view unmounts).
 *
 * TimelineSection consumes a large InitiativeContext and several heavy children
 * (planner, calendar, gantt). We stub the context with the minimum the render
 * path reads, and replace the children with trivial markers so the test stays
 * about the toggle/aria contract, not the inner views.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { TimelineSection } from '@/components/Initiatives/sections/TimelineSection';

// --- Stub the heavy children with identifiable markers --------------------
vi.mock('@/components/Initiatives/gantt', () => ({
  InitiativeGantt: () => <div data-testid="gantt-view">GANTT</div>,
}));
vi.mock('@/components/Initiatives/calendar', () => ({
  InitiativeCalendar: () => <div data-testid="calendar-view">CALENDAR</div>,
}));
vi.mock('@/components/Initiatives/sections/TimelinePlanner', () => ({
  TimelinePlanner: () => <div data-testid="planner">PLANNER</div>,
}));

// framer-motion → plain elements (avoid animation timing in the mode body).
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => <div {...props} />,
    }
  ),
}));

vi.mock('@/services/api', () => ({
  Api: { post: vi.fn(), put: vi.fn(), get: vi.fn() },
}));

// --- Minimal InitiativeContext stub ---------------------------------------
// Covers every field TimelineSection destructures + the ESTIMATE-mode render.
const ctxValue: any = {
  initiative: { id: '1', name: 'Test initiative', status: 'DRAFT' },
  isPolish: false,
  startDate: '',
  setStartDate: vi.fn(),
  endDate: '',
  setEndDate: vi.fn(),
  status: 'DRAFT', // → ESTIMATE mode (lightest, planner is stubbed anyway)
  targetDate: null,
  decisions: [],
  tasks: [],
  setTasks: vi.fn(),
  users: [],
  timelineMilestones: [],
  setTimelineMilestones: vi.fn(),
  timelinePhases: [],
  setTimelinePhases: vi.fn(),
  timelineLocked: false,
  baselineVersion: null,
  estimatedDurationMonths: null,
  raidItems: [],
  dependencies: [],
  timelineAiRequest: null,
  clearTimelineAiRequest: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

const SECTION_PROPS: any = {
  sectionType: { id: 'timeline', label: 'Timeline' },
  expanded: true,
  onToggle: vi.fn(),
};

function renderSection() {
  return render(<TimelineSection {...SECTION_PROPS} />);
}

/** The toggle buttons carry their fallback label as accessible name (setup t()). */
function toggleBtn(container: HTMLElement, label: 'Calendar' | 'Gantt'): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label
  );
  if (!btn) throw new Error(`No toggle button "${label}"`);
  return btn as HTMLButtonElement;
}

describe('TimelineSection — schedule view toggle', () => {
  it('starts collapsed: neither view mounted, neither button pressed', () => {
    const { container, queryByTestId } = renderSection();
    expect(toggleBtn(container, 'Gantt').getAttribute('aria-pressed')).toBe('false');
    expect(toggleBtn(container, 'Calendar').getAttribute('aria-pressed')).toBe('false');
    expect(queryByTestId('gantt-view')).toBeNull();
    expect(queryByTestId('calendar-view')).toBeNull();
  });

  it('clicking Gantt presses it and mounts the Gantt view', () => {
    const { container, queryByTestId } = renderSection();
    fireEvent.click(toggleBtn(container, 'Gantt'));

    expect(toggleBtn(container, 'Gantt').getAttribute('aria-pressed')).toBe('true');
    expect(toggleBtn(container, 'Calendar').getAttribute('aria-pressed')).toBe('false');
    expect(queryByTestId('gantt-view')).not.toBeNull();
    expect(queryByTestId('calendar-view')).toBeNull();
  });

  it('switching to Calendar swaps the mounted view and the pressed button', () => {
    const { container, queryByTestId } = renderSection();
    fireEvent.click(toggleBtn(container, 'Gantt'));
    fireEvent.click(toggleBtn(container, 'Calendar'));

    expect(toggleBtn(container, 'Calendar').getAttribute('aria-pressed')).toBe('true');
    expect(toggleBtn(container, 'Gantt').getAttribute('aria-pressed')).toBe('false');
    expect(queryByTestId('calendar-view')).not.toBeNull();
    expect(queryByTestId('gantt-view')).toBeNull();
  });

  it('re-clicking the active button collapses back to none', () => {
    const { container, queryByTestId } = renderSection();
    fireEvent.click(toggleBtn(container, 'Gantt')); // open
    fireEvent.click(toggleBtn(container, 'Gantt')); // close

    expect(toggleBtn(container, 'Gantt').getAttribute('aria-pressed')).toBe('false');
    expect(queryByTestId('gantt-view')).toBeNull();
    expect(queryByTestId('calendar-view')).toBeNull();
  });
});
