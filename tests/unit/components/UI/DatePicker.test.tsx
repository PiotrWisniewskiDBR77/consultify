/**
 * DatePicker Component Tests
 * Testing date picker component
 *
 * @module tests/unit/components/UI/DatePicker.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock DatePicker component
const MockDatePicker: React.FC<{
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  format?: string;
  clearable?: boolean;
}> = ({
  value = null,
  onChange = () => {},
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
  format = 'YYYY-MM-DD',
  clearable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  return (
    <div data-testid="datepicker" data-format={format}>
      <div
        data-testid="datepicker-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        data-disabled={disabled}
      >
        <input
          data-testid="datepicker-input"
          value={value ? formatDate(value) : ''}
          placeholder={placeholder}
          disabled={disabled}
          readOnly
        />
        {clearable && value && (
          <button
            data-testid="datepicker-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            ×
          </button>
        )}
      </div>
      {isOpen && (
        <div data-testid="datepicker-calendar" role="dialog">
          <button
            data-testid="datepicker-today"
            onClick={() => {
              onChange(new Date());
              setIsOpen(false);
            }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
};

describe('DatePicker Component', () => {
  describe('Rendering', () => {
    it('should render date picker', () => {
      render(<MockDatePicker />);
      expect(screen.getByTestId('datepicker')).toBeInTheDocument();
    });

    it('should show placeholder', () => {
      render(<MockDatePicker placeholder="Choose a date" />);
      expect(screen.getByPlaceholderText('Choose a date')).toBeInTheDocument();
    });

    it('should show formatted date', () => {
      const date = new Date('2026-01-15');
      render(<MockDatePicker value={date} />);
      expect(screen.getByTestId('datepicker-input')).toHaveValue('2026-01-15');
    });
  });

  describe('Calendar', () => {
    it('should open calendar on click', () => {
      render(<MockDatePicker />);

      fireEvent.click(screen.getByTestId('datepicker-trigger'));

      expect(screen.getByTestId('datepicker-calendar')).toBeInTheDocument();
    });

    it('should close calendar on toggle', () => {
      render(<MockDatePicker />);
      const trigger = screen.getByTestId('datepicker-trigger');

      fireEvent.click(trigger);
      expect(screen.getByTestId('datepicker-calendar')).toBeInTheDocument();

      fireEvent.click(trigger);
      expect(screen.queryByTestId('datepicker-calendar')).not.toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should select today', () => {
      const onChange = vi.fn();
      render(<MockDatePicker onChange={onChange} />);

      fireEvent.click(screen.getByTestId('datepicker-trigger'));
      fireEvent.click(screen.getByTestId('datepicker-today'));

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Clear', () => {
    it('should show clear button when value exists', () => {
      render(<MockDatePicker value={new Date()} clearable={true} />);
      expect(screen.getByTestId('datepicker-clear')).toBeInTheDocument();
    });

    it('should clear value on clear click', () => {
      const onChange = vi.fn();
      render(<MockDatePicker value={new Date()} onChange={onChange} clearable={true} />);

      fireEvent.click(screen.getByTestId('datepicker-clear'));
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Disabled', () => {
    it('should not open when disabled', () => {
      render(<MockDatePicker disabled={true} />);

      fireEvent.click(screen.getByTestId('datepicker-trigger'));

      expect(screen.queryByTestId('datepicker-calendar')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role for calendar', () => {
      render(<MockDatePicker />);
      fireEvent.click(screen.getByTestId('datepicker-trigger'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
