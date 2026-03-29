/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

import { CalendarSidebar } from '../../../src/components/MyWork/Calendar/CalendarSidebar';

describe('CalendarSidebar external source availability', () => {
  it('keeps unavailable external calendars honest and points the user to Integrations', () => {
    render(
      <CalendarSidebar
        filter={{ sources: ['task', 'initiative', 'decision', 'consultify', 'google', 'outlook'] }}
        onFilterChange={vi.fn()}
        currentDate={new Date('2026-03-28T00:00:00Z')}
        onDateChange={vi.fn()}
        externalSourceStatus={{
          google: {
            available: false,
            statusLabel: 'Setup in progress',
            helper: 'Google Calendar is on the governed path, but configuration or authorization is not complete yet.',
            nextStep: 'Finish configuration or authorization in Integrations.',
          },
          outlook: {
            available: false,
            statusLabel: 'Reauth required',
            helper: 'Outlook needs reauthorization before it returns to a trustworthy sync state.',
            nextStep: 'Start reauthorization in Integrations.',
          },
        }}
      />
    );

    expect(screen.getByText('Google Calendar: Setup in progress')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Google Calendar is on the governed path, but configuration or authorization is not complete yet.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Start reauthorization in Integrations.')).toBeInTheDocument();

    expect(screen.getByText('Google Calendar').closest('button')).toBeDisabled();
    expect(screen.getByText('Outlook').closest('button')).toBeDisabled();
  });

  it('allows toggling an external source once the integration is active', () => {
    const onFilterChange = vi.fn();

    render(
      <CalendarSidebar
        filter={{ sources: ['task'] }}
        onFilterChange={onFilterChange}
        currentDate={new Date('2026-03-28T00:00:00Z')}
        onDateChange={vi.fn()}
        externalSourceStatus={{
          google: {
            available: true,
            statusLabel: 'Active',
            helper: 'Google Calendar is ready for calendar filtering.',
          },
          outlook: {
            available: false,
            statusLabel: 'Not connected',
            helper: 'Outlook does not have an active connection yet.',
            nextStep: 'Connect the source in Integrations.',
          },
        }}
      />
    );

    fireEvent.click(screen.getByText('Google Calendar'));

    expect(onFilterChange).toHaveBeenCalledWith({
      sources: ['task', 'google'],
    });
  });

  it('shows workload guidance for the selected day', () => {
    render(
      <CalendarSidebar
        filter={{ sources: ['task'] }}
        onFilterChange={vi.fn()}
        currentDate={new Date('2026-03-28T00:00:00Z')}
        onDateChange={vi.fn()}
        externalSourceStatus={{
          google: {
            available: true,
            statusLabel: 'Active',
            helper: 'Google Calendar is ready for calendar filtering.',
          },
        }}
        workloadSummary={{
          variant: 'warning',
          title: 'Day is already heavily loaded',
          body: 'You already have 4 items here. Consider a reschedule or a planning adjustment.',
        }}
      />
    );

    expect(screen.getByText('Day is already heavily loaded')).toBeInTheDocument();
    expect(
      screen.getByText('You already have 4 items here. Consider a reschedule or a planning adjustment.')
    ).toBeInTheDocument();
  });
});
