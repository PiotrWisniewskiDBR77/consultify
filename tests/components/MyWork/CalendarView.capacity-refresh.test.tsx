/**
 * @vitest-environment jsdom
 *
 * MW-07 — the capacity ("Day load") read model must be re-read from the server
 * after a calendar time write, not just the events feed.
 *
 * The grid and the day-load summary are two INDEPENDENT server reads of the
 * same schedule: `useCalendarData` (events) and
 * `GET /my-work/calendar/conflicts?date=` (capacity). `handleEventMove`
 * originally refreshed only the first, so dragging a task onto or off the
 * selected day left the capacity summary next to the grid showing the counts
 * it had fetched when the date was last selected — two panels, same day,
 * contradicting each other, with the stale one being the number the user is
 * meant to make a scheduling decision from.
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const refetchMock = vi.fn();
const updateMyWorkCalendarEventMock = vi.fn();
const conflictsMock = vi.fn();
let capturedOnEventMove: ((payload: any) => Promise<boolean>) | undefined;

// Stable across renders, exactly like the real react-i18next hook — see the
// sibling no-premature-success test for what an unstable `t` does to
// CalendarView's day-load effect.
const stableT = (key: string, opt?: unknown) => {
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};
const stableUseTranslationResult = {
  t: stableT,
  i18n: { language: 'en', changeLanguage: () => {} },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => stableUseTranslationResult,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/services/api', () => ({
  default: {
    getIntegrations: vi.fn().mockResolvedValue([]),
    getMyWorkCalendarConflicts: (...args: unknown[]) => conflictsMock(...args),
    updateMyWorkCalendarEvent: (...args: unknown[]) => updateMyWorkCalendarEventMock(...args),
  },
}));

vi.mock('../../../src/components/MyWork/Calendar/useCalendarData', () => ({
  useCalendarData: () => ({
    events: [
      {
        id: 'task-golden',
        title: 'Golden task',
        start: '2026-03-05',
        allDay: true,
        source: 'task',
        sourceId: 'golden',
        version: '111',
      },
    ],
    loading: false,
    error: null,
    filter: { sources: ['task'] },
    setFilter: vi.fn(),
    refetch: refetchMock,
  }),
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarSidebar', () => ({
  CalendarSidebar: () => <div>Sidebar</div>,
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarGrid', () => ({
  CalendarGrid: (props: any) => {
    capturedOnEventMove = props.onEventMove;
    return <div>Grid</div>;
  },
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarCreateEventModal', () => ({
  CalendarCreateEventModal: () => null,
}));

import { CalendarView } from '../../../src/components/MyWork/Calendar/CalendarView';

const mountView = async () => {
  await act(async () => {
    render(<CalendarView />);
  });
  expect(capturedOnEventMove).toBeTruthy();
  expect(conflictsMock.mock.calls.length).toBeGreaterThan(0);
  return conflictsMock.mock.calls.length;
};

describe('CalendarView — capacity read model is re-read after a time write', () => {
  beforeEach(() => {
    refetchMock.mockClear();
    updateMyWorkCalendarEventMock.mockClear();
    conflictsMock.mockClear();
    capturedOnEventMove = undefined;
    conflictsMock.mockResolvedValue({
      totalItems: 3,
      hasConflicts: false,
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      decisions: [],
      suggestion: null,
    });
  });

  it('re-reads day load after a CONFIRMED reschedule (not only the events feed)', async () => {
    updateMyWorkCalendarEventMock.mockResolvedValue({
      id: 'golden',
      source: 'task',
      dueDate: '2026-03-12',
      version: '222',
    });

    const afterMount = await mountView();

    let moved: boolean | undefined;
    await act(async () => {
      moved = await capturedOnEventMove!({
        source: 'task',
        sourceId: 'golden',
        start: '2026-03-12T00:00:00.000Z',
        expectedVersion: '111',
      });
    });

    expect(moved).toBe(true);
    expect(refetchMock).toHaveBeenCalled();
    // The point of this file: capacity must have been re-read too.
    expect(conflictsMock.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it('re-reads day load after a REJECTED reschedule too — a 409 also changes what the server holds', async () => {
    updateMyWorkCalendarEventMock.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409, data: {} })
    );

    const afterMount = await mountView();

    let moved: boolean | undefined;
    await act(async () => {
      moved = await capturedOnEventMove!({
        source: 'task',
        sourceId: 'golden',
        start: '2026-03-12T00:00:00.000Z',
        expectedVersion: '111',
      });
    });

    expect(moved).toBe(false);
    expect(conflictsMock.mock.calls.length).toBeGreaterThan(afterMount);
  });

  it('does not re-read day load when the write was refused client-side for a missing version', async () => {
    const afterMount = await mountView();

    let moved: boolean | undefined;
    await act(async () => {
      moved = await capturedOnEventMove!({
        source: 'task',
        sourceId: 'golden',
        start: '2026-03-12T00:00:00.000Z',
        // expectedVersion deliberately absent
      });
    });

    expect(moved).toBe(false);
    expect(updateMyWorkCalendarEventMock).not.toHaveBeenCalled();
    // Nothing was written, but the client still re-syncs both reads rather
    // than leaving the grid on a position the user dragged it to.
    expect(conflictsMock.mock.calls.length).toBeGreaterThan(afterMount);
  });
});
