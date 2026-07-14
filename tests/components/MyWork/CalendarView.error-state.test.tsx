/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const refetchMock = vi.fn();
const getMyWorkCalendarConflictsMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Mirror i18next: t(key, fallbackString) OR t(key, { defaultValue }).
    t: (key: string, opt?: unknown) => {
      if (typeof opt === 'string') return opt;
      if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
        return String((opt as { defaultValue: unknown }).defaultValue);
      }
      return key;
    },
    i18n: { language: 'en', changeLanguage: () => {} },
  }),
}));

vi.mock('../../../src/services/api', () => ({
  default: {
    getIntegrations: vi.fn().mockResolvedValue([]),
    getMyWorkCalendarConflicts: (...args: unknown[]) => getMyWorkCalendarConflictsMock(...args),
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
  it('uses local date key for conflict lookup (timezone-safe)', async () => {
    getMyWorkCalendarConflictsMock.mockResolvedValue({
      totalItems: 0,
      hasConflicts: false,
      tasks: [],
      decisions: [],
      suggestion: null,
    });

    render(<CalendarView />);

    await waitFor(() => {
      expect(getMyWorkCalendarConflictsMock).toHaveBeenCalled();
    });
    const [dateKey] = getMyWorkCalendarConflictsMock.mock.calls[0] || [];
    expect(typeof dateKey).toBe('string');
    expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateKey).not.toContain('T');
    expect(dateKey).not.toContain('Z');
  });

  it('shows a visible retryable error state instead of a silent empty grid', async () => {
    getMyWorkCalendarConflictsMock.mockResolvedValue({
      totalItems: 0,
      hasConflicts: false,
      tasks: [],
      decisions: [],
      suggestion: null,
    });
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
