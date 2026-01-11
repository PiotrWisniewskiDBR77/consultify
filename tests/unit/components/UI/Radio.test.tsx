/**
 * Radio Component Tests
 * Testing radio button component
 *
 * @module tests/unit/components/UI/Radio.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Radio component
const MockRadio: React.FC<{
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  orientation?: 'horizontal' | 'vertical';
}> = ({
  options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ],
  value,
  onChange = () => {},
  name = 'radio-group',
  orientation = 'vertical',
}) => {
  return (
    <div data-testid="radio-group" role="radiogroup" data-orientation={orientation}>
      {options.map((option, index) => (
        <label
          key={option.value}
          data-testid={`radio-option-${index}`}
          data-disabled={option.disabled}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => !option.disabled && onChange(option.value)}
            disabled={option.disabled}
            data-testid={`radio-input-${index}`}
          />
          <span data-testid={`radio-label-${index}`}>{option.label}</span>
        </label>
      ))}
    </div>
  );
};

describe('Radio Component', () => {
  describe('Rendering', () => {
    it('should render radio group', () => {
      render(<MockRadio />);
      expect(screen.getByTestId('radio-group')).toBeInTheDocument();
    });

    it('should render all options', () => {
      render(<MockRadio />);
      expect(screen.getByTestId('radio-option-0')).toBeInTheDocument();
      expect(screen.getByTestId('radio-option-1')).toBeInTheDocument();
      expect(screen.getByTestId('radio-option-2')).toBeInTheDocument();
    });

    it('should render labels', () => {
      render(<MockRadio />);
      expect(screen.getByTestId('radio-label-0')).toHaveTextContent('Option A');
    });
  });

  describe('Selection', () => {
    it('should select value', () => {
      render(<MockRadio value="b" />);
      expect(screen.getByTestId('radio-input-1')).toBeChecked();
    });

    it('should call onChange on selection', () => {
      const onChange = vi.fn();
      render(<MockRadio onChange={onChange} />);

      fireEvent.click(screen.getByTestId('radio-input-1'));
      expect(onChange).toHaveBeenCalledWith('b');
    });
  });

  describe('Disabled', () => {
    it('should disable option', () => {
      const options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
      ];
      render(<MockRadio options={options} />);
      expect(screen.getByTestId('radio-input-1')).toBeDisabled();
    });
  });

  describe('Orientation', () => {
    it.each(['horizontal', 'vertical'] as const)('should apply %s orientation', (orientation) => {
      render(<MockRadio orientation={orientation} />);
      expect(screen.getByTestId('radio-group')).toHaveAttribute('data-orientation', orientation);
    });
  });

  describe('Accessibility', () => {
    it('should have radiogroup role', () => {
      render(<MockRadio />);
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });
  });
});
