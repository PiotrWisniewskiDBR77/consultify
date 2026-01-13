import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  QuickActions,
  QuickActionButton,
  MoreActionsButton,
} from '@/components/MyWork/shared/QuickActions';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('QuickActions', () => {
  const mockOnAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all provided actions', () => {
    render(<QuickActions onAction={mockOnAction} actions={['complete', 'schedule']} />);

    expect(screen.getByTitle('Complete')).toBeTruthy();
    expect(screen.getByTitle('Schedule')).toBeTruthy();
  });

  it('handles action click', () => {
    render(<QuickActions onAction={mockOnAction} actions={['complete']} />);

    fireEvent.click(screen.getByTitle('Complete'));
    expect(mockOnAction).toHaveBeenCalledWith('complete');
  });

  it('requires confirmation for delete action', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<QuickActions onAction={mockOnAction} actions={['delete']} />);

    fireEvent.click(screen.getByTitle('Delete'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockOnAction).toHaveBeenCalledWith('delete');
    confirmSpy.mockRestore();
  });

  it('does not call onAction if delete confirmation is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<QuickActions onAction={mockOnAction} actions={['delete']} />);

    fireEvent.click(screen.getByTitle('Delete'));
    expect(mockOnAction).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('hides actions when visible is false', () => {
    const { container } = render(<QuickActions onAction={mockOnAction} visible={false} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('QuickActionButton', () => {
  it('renders with label when showLabel is true', () => {
    render(<QuickActionButton action="complete" onClick={vi.fn()} showLabel={true} />);
    expect(screen.getByText('Complete')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn();
    render(<QuickActionButton action="complete" onClick={mockOnClick} />);

    fireEvent.click(screen.getByTitle('Complete'));
    expect(mockOnClick).toHaveBeenCalled();
  });
});

describe('MoreActionsButton', () => {
  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn();
    render(<MoreActionsButton onClick={mockOnClick} />);

    fireEvent.click(screen.getByTitle('More actions'));
    expect(mockOnClick).toHaveBeenCalled();
  });
});
