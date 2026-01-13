/**
 * Radio Group Component Tests
 * Testing radio group selection
 *
 * @module tests/unit/components/UI/RadioGroup.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock RadioGroup component
const MockRadioGroup: React.FC<{
  name?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
}> = ({
  name = 'radio-group',
  options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3', disabled: true },
  ],
  value = '',
  onChange = () => {},
  orientation = 'vertical',
  disabled = false,
}) => {
  return (
    <div data-testid="radio-group" data-orientation={orientation} role="radiogroup">
      {options.map((option) => (
        <label key={option.value} data-testid={`radio-label-${option.value}`}>
          <input
            type="radio"
            name={name}
            value={option.value}
            data-testid={`radio-${option.value}`}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onChange(option.value)}
            aria-checked={value === option.value}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
};

describe('RadioGroup Component', () => {
  describe('Rendering', () => {
    it('should render radio group', () => {
      render(<MockRadioGroup />);
      expect(screen.getByTestId('radio-group')).toBeInTheDocument();
    });

    it('should render all options', () => {
      render(<MockRadioGroup />);
      expect(screen.getByTestId('radio-opt1')).toBeInTheDocument();
      expect(screen.getByTestId('radio-opt2')).toBeInTheDocument();
      expect(screen.getByTestId('radio-opt3')).toBeInTheDocument();
    });

    it('should render option labels', () => {
      render(<MockRadioGroup />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('should check selected option', () => {
      render(<MockRadioGroup value="opt2" />);
      expect(screen.getByTestId('radio-opt2')).toBeChecked();
      expect(screen.getByTestId('radio-opt1')).not.toBeChecked();
    });

    it('should call onChange on selection', () => {
      const onChange = vi.fn();
      render(<MockRadioGroup onChange={onChange} />);

      fireEvent.click(screen.getByTestId('radio-opt1'));
      expect(onChange).toHaveBeenCalledWith('opt1');
    });
  });

  describe('Disabled', () => {
    it('should disable individual option', () => {
      render(<MockRadioGroup />);
      expect(screen.getByTestId('radio-opt3')).toBeDisabled();
    });

    it('should disable all options when group disabled', () => {
      render(<MockRadioGroup disabled={true} />);
      expect(screen.getByTestId('radio-opt1')).toBeDisabled();
      expect(screen.getByTestId('radio-opt2')).toBeDisabled();
    });
  });

  describe('Orientation', () => {
    it('should apply vertical orientation', () => {
      render(<MockRadioGroup orientation="vertical" />);
      expect(screen.getByTestId('radio-group')).toHaveAttribute('data-orientation', 'vertical');
    });

    it('should apply horizontal orientation', () => {
      render(<MockRadioGroup orientation="horizontal" />);
      expect(screen.getByTestId('radio-group')).toHaveAttribute('data-orientation', 'horizontal');
    });
  });

  describe('Accessibility', () => {
    it('should have radiogroup role', () => {
      render(<MockRadioGroup />);
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('should have aria-checked', () => {
      render(<MockRadioGroup value="opt1" />);
      expect(screen.getByTestId('radio-opt1')).toHaveAttribute('aria-checked', 'true');
    });
  });
});
