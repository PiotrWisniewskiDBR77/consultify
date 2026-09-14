/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ExecutionBankViews,
  formatExecutionBankDate,
} from '@/components/Execution/ExecutionBankViews';
import {
  buildExecutionBankRows,
  buildExecutionCalendarWindow,
} from '@/components/Execution/executionBankModel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

const rows = buildExecutionBankRows(
  [
    {
      id: 'initiative-a',
      name: 'Alpha',
      lifecycleStatus: 'IN_EXECUTION',
      progress: null,
      baselineStartDate: '2028-01-10',
      baselineEndDate: '2028-02-10',
      currentPlanStartDate: '2028-01-20',
      currentPlanEndDate: '2028-03-20',
    },
    {
      id: 'initiative-b',
      name: 'Beta',
      lifecycleStatus: 'SCHEDULED',
      progress: null,
      currentPlanEndDate: 'invalid',
    },
  ],
  [
    {
      executionCaseId: 'case-a',
      initiativeId: 'initiative-a',
      version: 4,
      state: 'ACTIVE',
      forecastStartDate: '2028-01-25',
      forecastEndDate: '2028-03-01',
      forecastObservedAt: '2028-01-15T00:00:00Z',
      health: 'AT_RISK',
    },
    { executionCaseId: 'case-b', initiativeId: 'initiative-b', version: 2, state: 'ACTIVE' },
  ],
  { asOf: '2028-01-31', identityMode: 'INITIATIVE' }
);

afterEach(cleanup);

describe('E1b ExecutionBankViews mounted behavior', () => {
  it('keeps the same ordered identity denominator and selection across every read-only renderer', () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    const props = {
      rows,
      selected: { initiativeId: 'initiative-b', executionCaseId: 'case-b' },
      calendarWindow: buildExecutionCalendarWindow('2028-01-31', 3),
      onSelect,
      onOpen,
      onHorizonChange: vi.fn(),
      onDrilldownMonth: vi.fn(),
    } as const;
    const { rerender } = render(<ExecutionBankViews {...props} view="table" />);
    const identities = (renderer: 'table' | 'kanban' | 'calendar' | 'gantt') =>
      screen
        .getAllByTestId(new RegExp(`^execution-bank-${renderer}-item-`))
        .map((node) => node.getAttribute('data-initiative-id'));
    const expected = ['initiative-a', 'initiative-b'];
    expect(identities('table')).toEqual(expected);
    fireEvent.click(screen.getByText('Alpha'));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ executionCaseId: 'case-a' })
    );

    rerender(<ExecutionBankViews {...props} view="kanban" />);
    expect(identities('kanban')).toEqual(expected);
    expect(screen.getByTestId('standard-kanban-card-initiative-a')).toHaveAttribute(
      'draggable',
      'false'
    );
    fireEvent.click(screen.getByTestId('standard-kanban-card-initiative-a'));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ executionCaseId: 'case-a' })
    );

    rerender(<ExecutionBankViews {...props} view="calendar" />);
    expect(identities('calendar')).toEqual(expected);
    expect(screen.getByTestId('execution-bank-unscheduled')).toHaveTextContent('Beta');
    fireEvent.click(screen.getByTestId('execution-bank-calendar-item-initiative-a'));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ executionCaseId: 'case-a' })
    );

    rerender(<ExecutionBankViews {...props} view="gantt" />);
    expect(identities('gantt')).toEqual(expected);
    fireEvent.click(screen.getByTestId('execution-bank-gantt-item-initiative-a'));
    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ executionCaseId: 'case-a' })
    );
    expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent(
      '20 days · forecast'
    );
    expect(screen.getByTestId('execution-bank-gantt-bar-baseline-initiative-a')).toHaveAttribute(
      'data-start',
      '2028-01-10'
    );
    expect(
      screen.getByTestId('execution-bank-gantt-bar-current-plan-initiative-a')
    ).toHaveAttribute('data-end', '2028-03-20');
    expect(screen.getByTestId('execution-bank-gantt-bar-forecast-initiative-a')).toHaveAttribute(
      'data-end',
      '2028-03-01'
    );
    expect(screen.getByTestId('execution-bank-gantt-track-actual-initiative-a')).toHaveAttribute(
      'data-geometry',
      'unknown'
    );
    expect(
      screen.getByTestId('execution-bank-gantt-track-current-plan-initiative-b')
    ).toHaveAttribute('data-geometry', 'unknown');
    const unknownRow = screen.getByTestId('execution-bank-gantt-item-initiative-b');
    expect(unknownRow.querySelector('[data-testid^="execution-bank-gantt-bar-"]')).toBeNull();
    expect(unknownRow.querySelector('[data-testid^="execution-bank-gantt-marker-"]')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('positions dated Gantt geometry on the shared horizon and moves it when the horizon changes', () => {
    const props = {
      rows,
      view: 'gantt' as const,
      selected: null,
      onSelect: vi.fn(),
      onOpen: vi.fn(),
      onHorizonChange: vi.fn(),
      onDrilldownMonth: vi.fn(),
    };
    const { rerender } = render(
      <ExecutionBankViews
        {...props}
        calendarWindow={buildExecutionCalendarWindow('2028-01-31', 3)}
      />
    );
    const threeMonthX = Number(
      screen.getByTestId('execution-bank-gantt-bar-forecast-initiative-a').getAttribute('x')
    );
    const axisLayout = screen.getByTestId('execution-bank-gantt-axis-layout');
    const trackLayout = screen.getByTestId('execution-bank-gantt-track-forecast-initiative-a');
    expect(axisLayout).toHaveClass('grid-cols-[110px_minmax(620px,1fr)]', 'gap-2');
    expect(trackLayout).toHaveClass('grid-cols-[110px_minmax(620px,1fr)]', 'gap-2');
    const axisWidth = screen
      .getByTestId('execution-bank-gantt-axis')
      .getAttribute('viewBox')
      ?.split(' ')[2];
    const trackWidth = trackLayout.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2];
    expect(axisWidth).toBe(trackWidth);
    rerender(
      <ExecutionBankViews
        {...props}
        calendarWindow={buildExecutionCalendarWindow('2028-01-31', 6)}
      />
    );
    const sixMonthX = Number(
      screen.getByTestId('execution-bank-gantt-bar-forecast-initiative-a').getAttribute('x')
    );
    expect(threeMonthX).toBeGreaterThan(sixMonthX);
    expect(screen.getByTestId('execution-bank-gantt-axis')).toHaveAttribute(
      'data-window-end',
      '2028-07-01'
    );
  });

  it('exposes 1/3/6/12 calendar-month controls and 6/12 month week drilldown', () => {
    const onHorizonChange = vi.fn();
    const onDrilldownMonth = vi.fn();
    render(
      <ExecutionBankViews
        rows={rows}
        view="calendar"
        selected={null}
        calendarWindow={buildExecutionCalendarWindow('2028-01-31', 6)}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onHorizonChange={onHorizonChange}
        onDrilldownMonth={onDrilldownMonth}
      />
    );
    for (const label of ['1m', '3m', '6m', '12m'])
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    // DEC-510: zapis daty idzie za locale konta (`localeListy`), nie za
    // przybitym `Intl.DateTimeFormat('en')`. Oczekiwanie liczy zapis TYM SAMYM
    // formaterem co produkt — nadal sprawdzamy KONKRETNĄ datę obok etykiety.
    expect(
      screen.getByText(new RegExp(`Reporting date ${formatExecutionBankDate('2028-01-31')}`))
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '12m' }));
    expect(onHorizonChange).toHaveBeenCalledWith(12);
    fireEvent.click(screen.getByRole('button', { name: '2028-02' }));
    expect(onDrilldownMonth).toHaveBeenCalledWith('2028-02');
  });
});
