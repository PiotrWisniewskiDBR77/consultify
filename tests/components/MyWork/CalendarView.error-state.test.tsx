/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const refetchMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/services/api', () => ({
  default: {
    getIntegrations: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../src/components/MyWork/Calendar/useCalendarData', () => ({
  useCalendarData: () => ({
    events: [],
    loading: false,
    error: 'Failed to load calendar events',
    filter: { sources: ['task'] },
    setFilter: vi.fn(),
    refetch: refetchMock,
  }),
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarSidebar', () => ({
  CalendarSidebar: () => <div>Sidebar</div>,
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarGrid', () => ({
  CalendarGrid: () => <div>Grid</div>,
}));

vi.mock('../../../src/components/MyWork/Calendar/CalendarCreateEventModal', () => ({
  CalendarCreateEventModal: () => null,
}));

import { CalendarView } from '../../../src/components/MyWork/Calendar/CalendarView';

describe('CalendarView error honesty', () => {
  it('shows a visible retryable error state instead of a silent empty grid', async () => {
    render(<CalendarView />);

    await waitFor(() => {
      expect(screen.getByText('Calendar view is temporarily unavailable.')).toBeInTheDocument();
    });
    expect(
      screen.getByText('This does not mean the day is empty. Refresh the data and try again.')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ Retry/i }));
    expect(refetchMock).toHaveBeenCalled();
  });
});
