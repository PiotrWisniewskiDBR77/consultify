/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildInitiativeScheduleAxis,
  InitiativePortfolioScheduleView,
} from '../InitiativePortfolioScheduleView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, unknown>) =>
      Object.entries(values ?? {}).reduce(
        (text, [key, value]) => text.replace(`{{${key}}}`, String(value)),
        fallback
      ),
    i18n: { language: 'en' },
  }),
}));

const initiatives = [
  {
    id: 'known',
    name: 'Known window',
    plannedStartDate: '2026-09-08',
    plannedEndDate: '2026-10-12',
  },
  { id: 'unknown', name: 'Missing window', plannedStartDate: null, plannedEndDate: null },
] as any;

describe('F2-1 E1 portfolio calendar and Gantt', () => {
  it('keeps the same native identities in calendar and Gantt and never invents missing dates', () => {
    const { rerender } = render(
      <InitiativePortfolioScheduleView
        initiatives={initiatives}
        onOpen={vi.fn()}
        anchorDate={new Date('2026-09-13T00:00:00Z')}
      />
    );
    expect(screen.getByTestId('initiative-schedule-row-known')).toBeInTheDocument();
    expect(screen.getByTestId('initiative-schedule-unknown')).toHaveTextContent('Missing window');
    expect(
      screen.getByTestId('initiative-portfolio-schedule').querySelector('[data-granularity]')
    ).toHaveAttribute('data-granularity', 'week');
    rerender(
      <InitiativePortfolioScheduleView
        initiatives={initiatives}
        onOpen={vi.fn()}
        anchorDate={new Date('2026-09-13T00:00:00Z')}
        mode="gantt"
      />
    );
    expect(screen.getByTestId('initiative-schedule-row-known')).toHaveTextContent('Known window');
    expect(screen.getByLabelText('2026-09-08 – 2026-10-12')).toBeInTheDocument();
    const header = screen
      .getByTestId('initiative-portfolio-schedule')
      .querySelector<HTMLElement>('[data-granularity]');
    const row = screen.getByTestId('initiative-schedule-row-known');
    expect(row.dataset.timelineWidth).toBe(header?.dataset.timelineWidth);
    expect(row.style.gridTemplateColumns).toBe(header?.style.gridTemplateColumns);
    expect(row.querySelector('svg')).toHaveAttribute(
      'viewBox',
      `0 0 ${row.dataset.timelineWidth} 24`
    );
  });

  it('switches 6/12-month axes to months while 1/3 remain weekly', () => {
    render(
      <InitiativePortfolioScheduleView
        initiatives={initiatives}
        onOpen={vi.fn()}
        anchorDate={new Date('2026-09-13T00:00:00Z')}
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: '6 mo' }));
    expect(
      screen.getByTestId('initiative-portfolio-schedule').querySelector('[data-granularity]')
    ).toHaveAttribute('data-granularity', 'month');
    const assertCalendarGeometry = () => {
      const header = screen
        .getByTestId('initiative-portfolio-schedule')
        .querySelector<HTMLElement>('[data-granularity]');
      const row = screen.getByTestId('initiative-schedule-row-known');
      const headerTrack = header?.querySelector<HTMLElement>('[data-schedule-header-track]');
      const rowTrack = row.querySelector<HTMLElement>('[data-schedule-row-track]');
      expect(row.style.gridTemplateColumns).toBe(header?.style.gridTemplateColumns);
      expect(rowTrack?.style.width).toBe(headerTrack?.style.width);
      expect(
        [...(headerTrack?.querySelectorAll<HTMLElement>('[data-schedule-tick]') ?? [])].map(
          (cell) => cell.style.width
        )
      ).toEqual(
        [...(rowTrack?.querySelectorAll<HTMLElement>('[data-schedule-cell]') ?? [])].map(
          (cell) => cell.style.width
        )
      );
      const coveredWidth = [
        ...(headerTrack?.querySelectorAll<HTMLElement>('[data-schedule-tick]') ?? []),
      ].reduce((sum, cell) => sum + Number.parseFloat(cell.style.width), 0);
      expect(coveredWidth).toBeCloseTo(Number.parseFloat(headerTrack?.style.width ?? '0'), 5);
    };
    assertCalendarGeometry();
    fireEvent.click(screen.getByRole('radio', { name: '1 mo' }));
    expect(
      screen.getByTestId('initiative-portfolio-schedule').querySelector('[data-granularity]')
    ).toHaveAttribute('data-granularity', 'week');
    assertCalendarGeometry();
  });

  it('anchors a Chicago local September evening to September rather than the next UTC month', () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = 'America/Chicago';
    try {
      const axis = buildInitiativeScheduleAxis(new Date('2026-10-01T01:00:00.000Z'), 1);
      expect(axis.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    } finally {
      process.env.TZ = previousTimezone;
    }
  });

  it('keeps Gantt weekly at 6/12 months and does not clamp out-of-horizon bars to an edge', () => {
    const rows = [
      ...initiatives,
      {
        id: 'outside',
        name: 'Future work',
        plannedStartDate: '2028-01-01',
        plannedEndDate: '2028-02-01',
      },
    ] as any;
    render(
      <InitiativePortfolioScheduleView
        initiatives={rows}
        onOpen={vi.fn()}
        anchorDate={new Date('2026-09-13T00:00:00Z')}
        mode="gantt"
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: '12 mo' }));
    expect(
      screen.getByTestId('initiative-portfolio-schedule').querySelector('[data-granularity]')
    ).toHaveAttribute('data-granularity', 'week');
    expect(screen.queryByTestId('initiative-schedule-row-outside')).toBeNull();
    expect(screen.getByTestId('initiative-schedule-outside-horizon')).toHaveTextContent(
      '1 scheduled initiative'
    );
  });

  it('places a one-month Gantt bar on the same proportional weekly axis as its header ticks', () => {
    render(
      <InitiativePortfolioScheduleView
        initiatives={initiatives}
        onOpen={vi.fn()}
        anchorDate={new Date('2026-09-13T00:00:00Z')}
        mode="gantt"
      />
    );
    fireEvent.click(screen.getByRole('radio', { name: '1 mo' }));
    const header = screen
      .getByTestId('initiative-portfolio-schedule')
      .querySelector<HTMLElement>('[data-granularity]');
    const ticks = [...(header?.querySelectorAll<HTMLElement>('[data-schedule-tick]') ?? [])];
    const trackWidth = Number.parseFloat(
      header?.querySelector<HTMLElement>('[data-schedule-header-track]')?.style.width ?? '0'
    );
    expect(ticks.reduce((sum, tick) => sum + Number.parseFloat(tick.style.width), 0)).toBeCloseTo(
      trackWidth,
      5
    );
    const rect = screen.getByLabelText('2026-09-08 – 2026-10-12').querySelector('rect');
    expect(Number(rect?.getAttribute('x'))).toBeCloseTo(Number(ticks[1]?.dataset.axisX), 5);
  });
});
