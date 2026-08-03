/**
 * @vitest-environment jsdom
 *
 * MW-07 — CalendarGrid: explicit project/provider lineage rendering, and the
 * reschedule payload it forwards to `onEventMove` carries the row `version`
 * so the backend's optimistic-concurrency guard (server/src/routes/v8/
 * my-work.routes.ts PUT .../events/task/:id) has something to compare against.
 *
 * FullCalendar does not lay out/drag reliably under jsdom (existing sibling
 * test `CalendarView.error-state.test.tsx` avoids it entirely by stubbing
 * CalendarGrid out). Here we mount the REAL CalendarGrid but replace only the
 * `@fullcalendar/react` engine with a thin stub that exposes the exact props
 * CalendarGrid computes (`events`, `eventContent`, `eventDrop`) — this still
 * exercises CalendarGrid's own mapping/handler logic, not a trivial passthrough.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CalendarGrid } from '../../../src/components/MyWork/Calendar/CalendarGrid';
import type { CalendarEvent } from '../../../src/components/MyWork/Calendar/calendarTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

let capturedProps: any = null;

vi.mock('@fullcalendar/react', () => ({
  default: React.forwardRef((props: any, ref: any) => {
    capturedProps = props;
    React.useImperativeHandle(ref, () => ({
      getApi: () => ({
        today: vi.fn(),
        prev: vi.fn(),
        next: vi.fn(),
        getDate: () => new Date('2026-03-01T00:00:00.000Z'),
        changeView: vi.fn(),
      }),
    }));
    return (
      <div data-testid="fc-stub">
        {props.events.map((e: any) => (
          <div key={e.id} data-testid={`fc-event-${e.id}`}>
            {props.eventContent({
              event: { title: e.title, extendedProps: e.extendedProps },
              timeText: '',
            })}
          </div>
        ))}
      </div>
    );
  }),
}));
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }));
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }));
vi.mock('@fullcalendar/interaction', () => ({ default: {} }));
vi.mock('@fullcalendar/list', () => ({ default: {} }));

const TASK_EVENT: CalendarEvent = {
  id: 'task-abc123',
  title: 'Prepare deck',
  start: '2026-03-05',
  allDay: true,
  source: 'task',
  sourceId: 'abc123',
  editAuthority: 'local_only',
  projectId: 'proj_1',
  projectName: 'Atelier Toys Rollout',
  provider: 'internal',
  version: '9876543',
};

function renderGrid(onEventMove?: (payload: any) => Promise<boolean>) {
  return render(
    <CalendarGrid
      events={[TASK_EVENT]}
      viewMode="month"
      currentDate={new Date('2026-03-01T00:00:00.000Z')}
      onDateChange={vi.fn()}
      onViewModeChange={vi.fn()}
      onEventMove={onEventMove}
    />
  );
}

describe('CalendarGrid — MW-07 project/provider lineage + version forwarding', () => {
  it('renders the project name and an honest "Internal" provider marker visibly on the task event, not only in a tooltip', () => {
    renderGrid();
    // Visible text content, not just the `title` (hover-tooltip) attribute —
    // the golden flow requires lineage the user can SEE, not discover on hover.
    expect(screen.getByText('Atelier Toys Rollout · Internal')).toBeInTheDocument();
  });

  it('never fabricates a Google/Microsoft provider label for a task-sourced event', () => {
    renderGrid();
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/microsoft|outlook/i)).not.toBeInTheDocument();
  });

  it('omits the lineage line entirely when the backend sends no project/provider (no false lineage)', () => {
    const bare: CalendarEvent = { ...TASK_EVENT, projectId: undefined, projectName: undefined, provider: undefined };
    render(
      <CalendarGrid
        events={[bare]}
        viewMode="month"
        currentDate={new Date('2026-03-01T00:00:00.000Z')}
        onDateChange={vi.fn()}
        onViewModeChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/Internal/)).not.toBeInTheDocument();
  });

  it('forwards the row version (not the unused legacy etag) to onEventMove on drag-drop, so the server can enforce its conflict guard', async () => {
    const onEventMove = vi.fn().mockResolvedValue(true);
    renderGrid(onEventMove);
    expect(capturedProps).toBeTruthy();

    const fakeInfo = {
      event: {
        extendedProps: { source: 'task', sourceId: 'abc123', version: '9876543', etag: undefined },
        start: new Date('2026-03-12T00:00:00.000Z'),
        end: null,
        allDay: true,
      },
      revert: vi.fn(),
    };

    await capturedProps.eventDrop(fakeInfo);

    expect(onEventMove).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'task',
        sourceId: 'abc123',
        expectedVersion: '9876543',
      })
    );
    expect(fakeInfo.revert).not.toHaveBeenCalled();
  });

  it('reverts the drag when onEventMove reports failure (e.g. the backend rejected a stale version with 409)', async () => {
    const onEventMove = vi.fn().mockResolvedValue(false);
    renderGrid(onEventMove);

    const fakeInfo = {
      event: {
        extendedProps: { source: 'task', sourceId: 'abc123', version: '9876543' },
        start: new Date('2026-03-12T00:00:00.000Z'),
        end: null,
        allDay: true,
      },
      revert: vi.fn(),
    };

    await capturedProps.eventDrop(fakeInfo);
    expect(fakeInfo.revert).toHaveBeenCalledTimes(1);
  });
});
