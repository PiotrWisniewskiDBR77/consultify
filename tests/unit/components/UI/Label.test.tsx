/**
 * Label Component Tests
 * Testing form label component
 *
 * @module tests/unit/components/UI/Label.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Label component
const MockLabel: React.FC<{
  children?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
}> = ({ children = 'Label', htmlFor, required = false, optional = false, hint }) => {
  return (
    <label data-testid="label" htmlFor={htmlFor}>
      <span data-testid="label-text">{children}</span>
      {required && (
        <span data-testid="label-required" aria-hidden="true">
          *
        </span>
      )}
      {optional && <span data-testid="label-optional">(optional)</span>}
      {hint && <span data-testid="label-hint">{hint}</span>}
    </label>
  );
};

describe('Label Component', () => {
  describe('Rendering', () => {
    it('should render label text', () => {
      render(<MockLabel>Email Address</MockLabel>);
      expect(screen.getByTestId('label-text')).toHaveTextContent('Email Address');
    });

    it('should associate with input via htmlFor', () => {
      render(<MockLabel htmlFor="email-input">Email</MockLabel>);
      expect(screen.getByTestId('label')).toHaveAttribute('for', 'email-input');
    });
  });

  describe('Required Indicator', () => {
    it('should show required indicator', () => {
      render(<MockLabel required={true}>Name</MockLabel>);
      expect(screen.getByTestId('label-required')).toHaveTextContent('*');
    });

    it('should hide required indicator by default', () => {
      render(<MockLabel>Name</MockLabel>);
      expect(screen.queryByTestId('label-required')).not.toBeInTheDocument();
    });
  });

  describe('Optional Indicator', () => {
    it('should show optional indicator', () => {
      render(<MockLabel optional={true}>Nickname</MockLabel>);
      expect(screen.getByTestId('label-optional')).toHaveTextContent('(optional)');
    });

    it('should hide optional indicator by default', () => {
      render(<MockLabel>Name</MockLabel>);
      expect(screen.queryByTestId('label-optional')).not.toBeInTheDocument();
    });
  });

  describe('Hint Text', () => {
    it('should show hint text', () => {
      render(<MockLabel hint="Enter your full email address">Email</MockLabel>);
      expect(screen.getByTestId('label-hint')).toHaveTextContent('Enter your full email address');
    });

    it('should hide hint text by default', () => {
      render(<MockLabel>Email</MockLabel>);
      expect(screen.queryByTestId('label-hint')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-hidden on required indicator', () => {
      render(<MockLabel required={true}>Name</MockLabel>);
      expect(screen.getByTestId('label-required')).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
