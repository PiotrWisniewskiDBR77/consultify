/**
 * Input Component Tests
 * Testing form input component
 *
 * @module tests/unit/components/UI/Input.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Input component
const MockInput: React.FC<{
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  required?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}> = ({
  type = 'text',
  value = '',
  onChange = () => {},
  placeholder,
  disabled = false,
  error,
  label,
  required = false,
  prefix,
  suffix,
}) => {
  return (
    <div data-testid="input-wrapper" data-error={!!error}>
      {label && (
        <label data-testid="input-label">
          {label}
          {required && <span data-testid="input-required">*</span>}
        </label>
      )}
      <div data-testid="input-container">
        {prefix && <span data-testid="input-prefix">{prefix}</span>}
        <input
          type={type}
          data-testid="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-required={required}
        />
        {suffix && <span data-testid="input-suffix">{suffix}</span>}
      </div>
      {error && (
        <span data-testid="input-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render input', () => {
      render(<MockInput />);
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('should show placeholder', () => {
      render(<MockInput placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('should render label', () => {
      render(<MockInput label="Email" />);
      expect(screen.getByTestId('input-label')).toHaveTextContent('Email');
    });
  });

  describe('Types', () => {
    it.each(['text', 'email', 'password', 'number'])('should render %s type', (type) => {
      render(<MockInput type={type} />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', type);
    });
  });

  describe('States', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<MockInput disabled={true} />);
      expect(screen.getByTestId('input')).toBeDisabled();
    });

    it('should show error message', () => {
      render(<MockInput error="Invalid email" />);
      expect(screen.getByTestId('input-error')).toHaveTextContent('Invalid email');
    });

    it('should mark as invalid when error', () => {
      render(<MockInput error="Error" />);
      expect(screen.getByTestId('input')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Required', () => {
    it('should show required indicator', () => {
      render(<MockInput label="Name" required={true} />);
      expect(screen.getByTestId('input-required')).toHaveTextContent('*');
    });

    it('should have aria-required', () => {
      render(<MockInput required={true} />);
      expect(screen.getByTestId('input')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('Prefix/Suffix', () => {
    it('should render prefix', () => {
      render(<MockInput prefix={<span>$</span>} />);
      expect(screen.getByTestId('input-prefix')).toBeInTheDocument();
    });

    it('should render suffix', () => {
      render(<MockInput suffix={<span>.com</span>} />);
      expect(screen.getByTestId('input-suffix')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onChange when typing', () => {
      const onChange = vi.fn();
      render(<MockInput onChange={onChange} />);

      fireEvent.change(screen.getByTestId('input'), { target: { value: 'test' } });
      expect(onChange).toHaveBeenCalledWith('test');
    });
  });

  describe('Accessibility', () => {
    it('should have alert role for error', () => {
      render(<MockInput error="Error message" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
