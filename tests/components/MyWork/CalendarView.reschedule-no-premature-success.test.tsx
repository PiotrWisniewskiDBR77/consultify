/**
 * @vitest-environment jsdom
 *
 * MW-07 — CalendarView.handleEventMove must NEVER report success to
 * CalendarGrid (which then commits the drag visually / shows a success
 * toast) before the backend has actually confirmed the write. This is the
 * "no premature frontend success" guarantee from the golden flow
 * (Codex review BLOCKER 4, negative control #4).
 *
 * CalendarGrid is mocked here (not the real FullCalendar-wrapping
 * component — that is covered separately by
 * tests/components/MyWork/CalendarGrid.lineage-conflict.test.tsx) purely to
 * capture the `onEventMove` callback CalendarView passes down, so this file
 * can invoke it directly and assert on CalendarView's OWN return-value
 * contract with the real (mocked-at-the-Api-boundary) async flow.
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const refetchMock = vi.fn();
const updateMyWorkCalendarEventMock = vi.fn();
let capturedOnEventMove: ((payload: any) => Promise<boolean>) | undefined;

// `t` and the returned object MUST keep a stable identity across renders, the
// way the real react-i18next `useTranslation()` does. CalendarView's day-load
// effect lists `t` in its dependency array
// (src/components/MyWork/Calendar/CalendarView.tsx), so a mock that builds a
// fresh `t` on every call re-fires that effect on every render, each run sets
// state, and the render->effect->setState cycle never converges. Test 1 below
// awaits inside `act()`, which keeps flushing that cycle until the worker dies
// with "JavaScript heap out of memory" (reproduced deterministically with
// `--retry=0`; the repo's default `retry: 1` re-ran the file and reported a
// green 25/25, hiding it). Production behaviour is correct — this is purely
// the harness modelling the hook wrongly.
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
    getMyWorkCalendarConflicts: vi.fn().mockResolvedValue({
      totalItems: 0,
      hasConflicts: false,
      tasks: [],
      decisions: [],
      suggestion: null,
    }),
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

describe('CalendarView — no premature success on reschedule', () => {
  it('does NOT report success (does not resolve true) until the backend actually confirms the write', async () => {
    let resolveApi: (value: unknown) => void = () => {};
    updateMyWorkCalendarEventMock.mockReturnValue(
      new Promise((resolve) => {
        resolveApi = resolve;
      })
    );

    render(<CalendarView />);
    expect(capturedOnEventMove).toBeTruthy();

    let settled = false;
    let result: boolean | undefined;
    const movePromise = capturedOnEventMove!({
      source: 'task',
      sourceId: 'golden',
      start: '2026-03-12T00:00:00.000Z',
      expectedVersion: '111',
    }).then((r) => {
      settled = true;
      result = r;
      return r;
    });

    // The backend call is still pending — CalendarView must not have
    // resolved yet. A "premature success" regression would resolve `true`
    // synchronously/optimistically here, before the API call settles.
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);

    await act(async () => {
      resolveApi({ id: 'golden', source: 'task', dueDate: '2026-03-12', version: '222' });
      await movePromise;
    });

    expect(settled).toBe(true);
    expect(result).toBe(true);
    expect(refetchMock).toHaveBeenCalled();
  });

  it('reports failure (resolves false) when the backend rejects the write — never masks a real error as success', async () => {
    updateMyWorkCalendarEventMock.mockRejectedValue(
      Object.assign(new Error('conflict'), { status: 409, data: {} })
    );

    render(<CalendarView />);
    expect(capturedOnEventMove).toBeTruthy();

    const result = await capturedOnEventMove!({
      source: 'task',
      sourceId: 'golden',
      start: '2026-03-12T00:00:00.000Z',
      expectedVersion: '111',
    });

    expect(result).toBe(false);
  });

  it('refuses to write at all (never calls the API) when no version has been read yet — refuses rather than writing blind', async () => {
    render(<CalendarView />);
    expect(capturedOnEventMove).toBeTruthy();
    updateMyWorkCalendarEventMock.mockClear();

    const result = await capturedOnEventMove!({
      source: 'task',
      sourceId: 'golden',
      start: '2026-03-12T00:00:00.000Z',
      expectedVersion: undefined,
    });

    expect(result).toBe(false);
    expect(updateMyWorkCalendarEventMock).not.toHaveBeenCalled();
  });
});
