/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/components/ui/primitives/Button', () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button type="button" onClick={onClick} disabled={disabled || loading} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../src/components/ui/primitives/Modal', () => ({
  Modal: ({ open, title, description, children, footer }: any) =>
    open ? (
      <div>
        <div>{title}</div>
        <div>{description}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

const getMyWorkCalendarConflictsMock = vi.fn();
const createMyWorkCalendarEventMock = vi.fn();

vi.mock('../../../src/services/api', () => ({
  default: {
    getMyWorkCalendarConflicts: (...args: unknown[]) => getMyWorkCalendarConflictsMock(...args),
    createMyWorkCalendarEvent: (...args: unknown[]) => createMyWorkCalendarEventMock(...args),
  },
}));

import { CalendarCreateEventModal } from '../../../src/components/MyWork/Calendar/CalendarCreateEventModal';

describe('CalendarCreateEventModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyWorkCalendarConflictsMock.mockResolvedValue({
      date: '2026-03-27',
      tasks: [{ id: 'task-1', title: 'Prepare deck' }],
      decisions: [{ id: 'decision-1', title: 'Approve scope' }],
      totalItems: 2,
      hasConflicts: false,
      suggestion: 'Balanced day.',
    });
    createMyWorkCalendarEventMock.mockResolvedValue({
      data: { id: 'task-99', source: 'task' },
    });
  });

  it('loads governed calendar conflicts when opened', async () => {
    render(
      <CalendarCreateEventModal
        open
        defaultDate={new Date(2026, 2, 27)}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getMyWorkCalendarConflictsMock).toHaveBeenCalledWith('2026-03-27');
    });

    expect(screen.getByText('You already have 2 items on this day.')).toBeInTheDocument();
    expect(screen.getByText('Task: Prepare deck')).toBeInTheDocument();
    expect(screen.getByText('Decision: Approve scope')).toBeInTheDocument();
    expect(screen.getByText('Balanced day.')).toBeInTheDocument();
  });

  it('shows a bounded warning when the governed conflict check is temporarily unavailable', async () => {
    getMyWorkCalendarConflictsMock.mockRejectedValue({
      status: 503,
      message: 'Service unavailable',
    });

    render(
      <CalendarCreateEventModal
        open
        defaultDate={new Date(2026, 2, 27)}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(
          'Day-load preview is temporarily unavailable, but you can still create the task.',
        ),
      ).toHaveLength(2);
    });

    expect(screen.getByText('Day preview is limited')).toBeInTheDocument();
  });

  it('creates a task-backed calendar event and notifies the host callbacks', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();

    render(
      <CalendarCreateEventModal
        open
        defaultDate={new Date(2026, 2, 27)}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Prepare review deck'), {
      target: { value: 'Prepare review deck' },
    });
    fireEvent.change(screen.getByPlaceholderText('Short context or definition of done...'), {
      target: { value: 'Bounded V8 continuity check' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'weekly' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(createMyWorkCalendarEventMock).toHaveBeenCalledWith({
        title: 'Prepare review deck',
        description: 'Bounded V8 continuity check',
        start: '2026-03-27',
        allDay: true,
        source: 'task',
        recurrence: { preset: 'weekly' },
      });
    });

    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('submits from the title field without requiring a footer click', async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();

    render(
      <CalendarCreateEventModal
        open
        defaultDate={new Date(2026, 2, 27)}
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    const titleInput = screen.getByPlaceholderText('e.g. Prepare review deck');

    fireEvent.change(titleInput, {
      target: { value: 'Submit with Enter' },
    });
    fireEvent.submit(titleInput.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(createMyWorkCalendarEventMock).toHaveBeenCalledWith({
        title: 'Submit with Enter',
        description: undefined,
        start: '2026-03-27',
        allDay: true,
        source: 'task',
      });
    });

    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
