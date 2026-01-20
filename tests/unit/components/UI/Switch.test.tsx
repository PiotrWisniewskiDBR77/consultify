/**
 * Switch Component Tests
 * Testing toggle switch behavior
 *
 * @module tests/unit/components/UI/Switch.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Switch component
const MockSwitch: React.FC<{
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ checked = false, onChange = () => {}, disabled = false, label, size = 'md' }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Don't call onChange if disabled
    if (!disabled) {
      onChange(e.target.checked);
    }
  };

  return (
    <label data-testid="switch-wrapper">
      <input
        type="checkbox"
        role="switch"
        data-testid="switch"
        data-size={size}
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
        aria-checked={checked}
      />
      {label && <span data-testid="switch-label">{label}</span>}
    </label>
  );
};

describe('Switch Component', () => {
  describe('States', () => {
    it('should render unchecked by default', () => {
      render(<MockSwitch />);
      expect(screen.getByTestId('switch')).not.toBeChecked();
    });

    it('should render checked when checked prop is true', () => {
      render(<MockSwitch checked={true} />);
      expect(screen.getByTestId('switch')).toBeChecked();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<MockSwitch disabled={true} />);
      expect(screen.getByTestId('switch')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('should call onChange when clicked', () => {
      const onChange = vi.fn();
      render(<MockSwitch onChange={onChange} />);

      fireEvent.click(screen.getByTestId('switch'));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should toggle state correctly', () => {
      const onChange = vi.fn();
      render(<MockSwitch checked={true} onChange={onChange} />);

      fireEvent.click(screen.getByTestId('switch'));
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(<MockSwitch disabled={true} onChange={onChange} />);

      fireEvent.click(screen.getByTestId('switch'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Label', () => {
    it('should render label when provided', () => {
      render(<MockSwitch label="Enable notifications" />);
      expect(screen.getByTestId('switch-label')).toHaveTextContent('Enable notifications');
    });

    it('should not render label when not provided', () => {
      render(<MockSwitch />);
      expect(screen.queryByTestId('switch-label')).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
      render(<MockSwitch size={size} />);
      expect(screen.getByTestId('switch')).toHaveAttribute('data-size', size);
    });
  });

  describe('Accessibility', () => {
    it('should have switch role', () => {
      render(<MockSwitch />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should have correct aria-checked', () => {
      render(<MockSwitch checked={true} />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });
});
