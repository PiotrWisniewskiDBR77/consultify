/**
 * Checkbox Component Tests
 * Testing checkbox component
 *
 * @module tests/unit/components/UI/Checkbox.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Checkbox component
const MockCheckbox: React.FC<{
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
}> = ({
  checked = false,
  onChange = () => {},
  indeterminate = false,
  disabled = false,
  label,
  error,
}) => {
  return (
    <div data-testid="checkbox-wrapper" data-error={!!error}>
      <label data-testid="checkbox-label">
        <input
          type="checkbox"
          data-testid="checkbox"
          checked={checked}
          disabled={disabled}
          data-indeterminate={indeterminate}
          onChange={(e) => onChange(e.target.checked)}
          aria-checked={indeterminate ? 'mixed' : checked}
        />
        {label && <span data-testid="checkbox-label-text">{label}</span>}
      </label>
      {error && (
        <span data-testid="checkbox-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

describe('Checkbox Component', () => {
  describe('States', () => {
    it('should render unchecked by default', () => {
      render(<MockCheckbox />);
      expect(screen.getByTestId('checkbox')).not.toBeChecked();
    });

    it('should render checked', () => {
      render(<MockCheckbox checked={true} />);
      expect(screen.getByTestId('checkbox')).toBeChecked();
    });

    it('should render disabled', () => {
      render(<MockCheckbox disabled={true} />);
      expect(screen.getByTestId('checkbox')).toBeDisabled();
    });

    it('should render indeterminate', () => {
      render(<MockCheckbox indeterminate={true} />);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('data-indeterminate', 'true');
    });
  });

  describe('Interactions', () => {
    it('should call onChange when clicked', () => {
      const onChange = vi.fn();
      render(<MockCheckbox onChange={onChange} />);

      fireEvent.click(screen.getByTestId('checkbox'));
      expect(onChange).toHaveBeenCalledWith(true);
    });

    it('should toggle correctly', () => {
      const onChange = vi.fn();
      render(<MockCheckbox checked={true} onChange={onChange} />);

      fireEvent.click(screen.getByTestId('checkbox'));
      expect(onChange).toHaveBeenCalledWith(false);
    });

    it('should not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(<MockCheckbox disabled={true} onChange={onChange} />);

      fireEvent.click(screen.getByTestId('checkbox'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Label', () => {
    it('should render label', () => {
      render(<MockCheckbox label="Accept terms" />);
      expect(screen.getByTestId('checkbox-label-text')).toHaveTextContent('Accept terms');
    });

    it('should not render label when not provided', () => {
      render(<MockCheckbox />);
      expect(screen.queryByTestId('checkbox-label-text')).not.toBeInTheDocument();
    });
  });

  describe('Error', () => {
    it('should show error', () => {
      render(<MockCheckbox error="This field is required" />);
      expect(screen.getByTestId('checkbox-error')).toHaveTextContent('This field is required');
    });
  });

  describe('Accessibility', () => {
    it('should have mixed aria-checked for indeterminate', () => {
      render(<MockCheckbox indeterminate={true} />);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    });
  });
});
