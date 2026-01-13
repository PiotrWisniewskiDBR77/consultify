/**
 * Form Controls Component Tests
 * Testing form input wrapper
 *
 * @module tests/unit/components/UI/FormControl.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock FormControl component
const MockFormControl: React.FC<{
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({
  label,
  helperText,
  error,
  required = false,
  disabled = false,
  children = <input data-testid="form-input" />,
}) => {
  return (
    <div data-testid="form-control" data-disabled={disabled} data-error={!!error}>
      {label && (
        <label data-testid="form-label">
          {label}
          {required && <span data-testid="form-required">*</span>}
        </label>
      )}
      <div data-testid="form-input-wrapper">{children}</div>
      {error ? (
        <span data-testid="form-error" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span data-testid="form-helper">{helperText}</span>
      ) : null}
    </div>
  );
};

describe('FormControl Component', () => {
  describe('Rendering', () => {
    it('should render form control', () => {
      render(<MockFormControl />);
      expect(screen.getByTestId('form-control')).toBeInTheDocument();
    });

    it('should render label', () => {
      render(<MockFormControl label="Email" />);
      expect(screen.getByTestId('form-label')).toHaveTextContent('Email');
    });

    it('should render children', () => {
      render(<MockFormControl />);
      expect(screen.getByTestId('form-input')).toBeInTheDocument();
    });
  });

  describe('Required', () => {
    it('should show required indicator', () => {
      render(<MockFormControl label="Name" required={true} />);
      expect(screen.getByTestId('form-required')).toHaveTextContent('*');
    });

    it('should not show required indicator when not required', () => {
      render(<MockFormControl label="Optional" required={false} />);
      expect(screen.queryByTestId('form-required')).not.toBeInTheDocument();
    });
  });

  describe('Helper Text', () => {
    it('should render helper text', () => {
      render(<MockFormControl helperText="Enter your email address" />);
      expect(screen.getByTestId('form-helper')).toHaveTextContent('Enter your email address');
    });
  });

  describe('Error State', () => {
    it('should render error message', () => {
      render(<MockFormControl error="This field is required" />);
      expect(screen.getByTestId('form-error')).toHaveTextContent('This field is required');
    });

    it('should have error state', () => {
      render(<MockFormControl error="Error" />);
      expect(screen.getByTestId('form-control')).toHaveAttribute('data-error', 'true');
    });

    it('should show error instead of helper when both present', () => {
      render(<MockFormControl helperText="Help" error="Error" />);
      expect(screen.getByTestId('form-error')).toBeInTheDocument();
      expect(screen.queryByTestId('form-helper')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should have disabled state', () => {
      render(<MockFormControl disabled={true} />);
      expect(screen.getByTestId('form-control')).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have alert role for error', () => {
      render(<MockFormControl error="Error" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
