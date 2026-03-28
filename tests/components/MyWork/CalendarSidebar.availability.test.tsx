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
        externalSourceAvailability={{ google: false, outlook: false }}
      />
    );

    expect(screen.getAllByText('Connect in Integrations').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'Google and Outlook sources appear here only after an active connection is available in Integrations.'
      )
    ).toBeInTheDocument();

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
        externalSourceAvailability={{ google: true, outlook: false }}
      />
    );

    fireEvent.click(screen.getByText('Google Calendar'));

    expect(onFilterChange).toHaveBeenCalledWith({
      sources: ['task', 'google'],
    });
  });
});
