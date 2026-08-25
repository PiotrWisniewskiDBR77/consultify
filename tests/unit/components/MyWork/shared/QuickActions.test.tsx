import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuickActions from '@/components/MyWork/shared/QuickActions';

// Mock i18next
// QuickActions.tsx calls t(key, 'Mark complete') / t(key, 'More actions') — react-i18next
// treats a string second argument as the defaultValue (see tests/setup.ts's global mock,
// which does the same). The previous `t: (key) => key` identity mock dropped that second
// argument, so the "Mark complete"/"More actions" title assertions never matched the raw
// key. Resolve the string default instead, with a stable `t` identity.
const t = (key: string, defaultValue?: string) => (typeof defaultValue === 'string' ? defaultValue : key);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t,
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('QuickActions', () => {
  const mockOnStatusChange = vi.fn();
  const mockOnPriorityChange = vi.fn();
  const mockOnMarkComplete = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders status and priority labels', () => {
    render(
      <QuickActions
        status="todo"
        priority="medium"
        onStatusChange={mockOnStatusChange}
        onPriorityChange={mockOnPriorityChange}
      />
    );

    expect(screen.getByText('To Do')).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('handles mark complete click', () => {
    render(<QuickActions status="todo" onMarkComplete={mockOnMarkComplete} />);

    const completeBtn = screen.getByTitle('Mark complete');
    fireEvent.click(completeBtn);

    expect(mockOnMarkComplete).toHaveBeenCalled();
  });

  it('opens status dropdown and changes status', () => {
    render(<QuickActions status="todo" onStatusChange={mockOnStatusChange} />);

    // Click status button to open dropdown
    fireEvent.click(screen.getByText('To Do'));

    // Find and click "Done" in the list
    const doneOption = screen.getByText('Done');
    fireEvent.click(doneOption);

    expect(mockOnStatusChange).toHaveBeenCalledWith('done');
  });

  it('opens priority dropdown and changes priority', () => {
    render(<QuickActions priority="medium" onPriorityChange={mockOnPriorityChange} />);

    // Click priority button
    fireEvent.click(screen.getByText('Medium'));

    // Click "High"
    const highOption = screen.getByText('High');
    fireEvent.click(highOption);

    expect(mockOnPriorityChange).toHaveBeenCalledWith('high');
  });

  it('shows more actions menu and triggers delete', () => {
    render(<QuickActions onDelete={mockOnDelete} />);

    // Open more menu
    fireEvent.click(screen.getByTitle('More actions'));

    // Click delete
    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    expect(mockOnDelete).toHaveBeenCalled();
  });
});
