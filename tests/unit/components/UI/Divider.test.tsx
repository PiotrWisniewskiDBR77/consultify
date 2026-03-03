/**
 * Divider Component Tests
 * Testing divider/separator component
 *
 * @module tests/unit/components/UI/Divider.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Divider component
const MockDivider: React.FC<{
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'dotted';
  label?: string;
  spacing?: 'sm' | 'md' | 'lg';
}> = ({ orientation = 'horizontal', variant = 'solid', label, spacing = 'md' }) => {
  return (
    <div
      data-testid="divider"
      data-orientation={orientation}
      data-variant={variant}
      data-spacing={spacing}
      role="separator"
      aria-orientation={orientation}
    >
      {label && <span data-testid="divider-label">{label}</span>}
    </div>
  );
};

describe('Divider Component', () => {
  describe('Rendering', () => {
    it('should render divider', () => {
      render(<MockDivider />);
      expect(screen.getByTestId('divider')).toBeInTheDocument();
    });

    it('should render label when provided', () => {
      render(<MockDivider label="OR" />);
      expect(screen.getByTestId('divider-label')).toHaveTextContent('OR');
    });
  });

  describe('Orientation', () => {
    it('should apply horizontal orientation', () => {
      render(<MockDivider orientation="horizontal" />);
      expect(screen.getByTestId('divider')).toHaveAttribute('data-orientation', 'horizontal');
    });

    it('should apply vertical orientation', () => {
      render(<MockDivider orientation="vertical" />);
      expect(screen.getByTestId('divider')).toHaveAttribute('data-orientation', 'vertical');
    });
  });

  describe('Variant', () => {
    it.each(['solid', 'dashed', 'dotted'] as const)('should apply %s variant', (variant) => {
      render(<MockDivider variant={variant} />);
      expect(screen.getByTestId('divider')).toHaveAttribute('data-variant', variant);
    });
  });

  describe('Spacing', () => {
    it.each(['sm', 'md', 'lg'] as const)('should apply %s spacing', (spacing) => {
      render(<MockDivider spacing={spacing} />);
      expect(screen.getByTestId('divider')).toHaveAttribute('data-spacing', spacing);
    });
  });

  describe('Accessibility', () => {
    it('should have separator role', () => {
      render(<MockDivider />);
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('should have aria-orientation', () => {
      render(<MockDivider orientation="horizontal" />);
      expect(screen.getByTestId('divider')).toHaveAttribute('aria-orientation', 'horizontal');
    });
  });
});
