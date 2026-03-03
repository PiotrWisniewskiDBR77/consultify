/**
 * Select Component Tests
 * Testing dropdown select component
 *
 * @module tests/unit/components/UI/Select.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Select component
const MockSelect: React.FC<{
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  searchable?: boolean;
}> = ({
  options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3', disabled: true },
  ],
  value = '',
  onChange = () => {},
  placeholder = 'Select an option',
  disabled = false,
  error,
  label,
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div data-testid="select-wrapper" data-error={!!error}>
      {label && <label data-testid="select-label">{label}</label>}
      <button
        data-testid="select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span data-testid="select-value">{selectedOption?.label || placeholder}</span>
      </button>
      {isOpen && (
        <ul data-testid="select-options" role="listbox">
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              data-testid={`option-${option.value}`}
              data-disabled={option.disabled}
              aria-selected={value === option.value}
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value);
                  setIsOpen(false);
                }
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <span data-testid="select-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

describe('Select Component', () => {
  describe('Rendering', () => {
    it('should render select', () => {
      render(<MockSelect />);
      expect(screen.getByTestId('select-trigger')).toBeInTheDocument();
    });

    it('should show placeholder', () => {
      render(<MockSelect placeholder="Choose..." />);
      expect(screen.getByTestId('select-value')).toHaveTextContent('Choose...');
    });

    it('should show selected value', () => {
      render(<MockSelect value="opt1" />);
      expect(screen.getByTestId('select-value')).toHaveTextContent('Option 1');
    });

    it('should render label', () => {
      render(<MockSelect label="Category" />);
      expect(screen.getByTestId('select-label')).toHaveTextContent('Category');
    });
  });

  describe('Opening/Closing', () => {
    it('should open dropdown on click', () => {
      render(<MockSelect />);

      fireEvent.click(screen.getByTestId('select-trigger'));

      expect(screen.getByTestId('select-options')).toBeInTheDocument();
    });

    it('should close dropdown on selection', () => {
      render(<MockSelect />);

      fireEvent.click(screen.getByTestId('select-trigger'));
      fireEvent.click(screen.getByTestId('option-opt1'));

      expect(screen.queryByTestId('select-options')).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should call onChange on selection', () => {
      const onChange = vi.fn();
      render(<MockSelect onChange={onChange} />);

      fireEvent.click(screen.getByTestId('select-trigger'));
      fireEvent.click(screen.getByTestId('option-opt2'));

      expect(onChange).toHaveBeenCalledWith('opt2');
    });

    it('should not select disabled option', () => {
      const onChange = vi.fn();
      render(<MockSelect onChange={onChange} />);

      fireEvent.click(screen.getByTestId('select-trigger'));
      fireEvent.click(screen.getByTestId('option-opt3'));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('States', () => {
    it('should be disabled', () => {
      render(<MockSelect disabled={true} />);
      expect(screen.getByTestId('select-trigger')).toBeDisabled();
    });

    it('should show error', () => {
      render(<MockSelect error="Required field" />);
      expect(screen.getByTestId('select-error')).toHaveTextContent('Required field');
    });
  });

  describe('Accessibility', () => {
    it('should have listbox role', () => {
      render(<MockSelect />);
      fireEvent.click(screen.getByTestId('select-trigger'));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have aria-expanded', () => {
      render(<MockSelect />);
      expect(screen.getByTestId('select-trigger')).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(screen.getByTestId('select-trigger'));
      expect(screen.getByTestId('select-trigger')).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
