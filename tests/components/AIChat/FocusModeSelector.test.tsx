/**
 * Tests for FocusModeSelector component
 * World-Class Chat 2025
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusModeSelector } from '@/components/AIChat/Input/FocusModeSelector';
import { FocusMode } from '@/types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}));

describe('FocusModeSelector', () => {
  const defaultProps = {
    value: 'all' as FocusMode,
    onChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all focus mode options', () => {
    render(<FocusModeSelector {...defaultProps} />);
    
    expect(screen.getByText(/all/i)).toBeInTheDocument();
    expect(screen.getByText(/pmo docs/i)).toBeInTheDocument();
    expect(screen.getByText(/project/i)).toBeInTheDocument();
    expect(screen.getByText(/research/i)).toBeInTheDocument();
    expect(screen.getByText(/web/i)).toBeInTheDocument();
  });

  it('highlights active focus mode', () => {
    render(<FocusModeSelector {...defaultProps} value="pmo-docs" />);
    
    // Find button by role and check if it has active styling
    const buttons = screen.getAllByRole('button');
    const activeButton = buttons.find(btn => {
      const classes = btn.className;
      return classes.includes('bg-blue') || classes.includes('text-blue');
    });
    expect(activeButton).toBeDefined();
  });

  it('calls onChange when clicking a mode', () => {
    render(<FocusModeSelector {...defaultProps} />);
    
    const researchButton = screen.getByText(/research/i);
    fireEvent.click(researchButton);
    
    expect(defaultProps.onChange).toHaveBeenCalledWith('research');
  });

  it('disables buttons when disabled prop is true', () => {
    render(<FocusModeSelector {...defaultProps} disabled={true} />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('renders in compact mode', () => {
    render(<FocusModeSelector {...defaultProps} compact={true} />);
    
    // In compact mode, buttons should be smaller
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows tooltips with descriptions', () => {
    render(<FocusModeSelector {...defaultProps} />);
    
    const allButton = screen.getByText(/all/i).closest('button');
    expect(allButton).toHaveAttribute('title');
  });

  it('handles focus mode change correctly', () => {
    const onChange = vi.fn();
    render(<FocusModeSelector value="all" onChange={onChange} />);
    
    fireEvent.click(screen.getByText(/web/i));
    expect(onChange).toHaveBeenCalledWith('web');
    
    fireEvent.click(screen.getByText(/project/i));
    expect(onChange).toHaveBeenCalledWith('project-data');
  });
});

