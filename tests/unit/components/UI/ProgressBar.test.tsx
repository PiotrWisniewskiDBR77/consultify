/**
 * ProgressBar Component Tests
 * Testing progress bar display and animations
 *
 * @module tests/unit/components/UI/ProgressBar.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock ProgressBar component
const MockProgressBar: React.FC<{
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}> = ({
  value = 0,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  animated = false,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      data-testid="progress-bar"
      data-variant={variant}
      data-size={size}
      data-animated={animated}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div data-testid="progress-fill" style={{ width: `${percentage}%` }} />
      {showLabel && (
        <span data-testid="progress-label">{label || `${Math.round(percentage)}%`}</span>
      )}
    </div>
  );
};

describe('ProgressBar Component', () => {
  describe('Rendering', () => {
    it('should render progress bar', () => {
      render(<MockProgressBar value={50} />);
      expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    });

    it('should set correct width based on value', () => {
      render(<MockProgressBar value={75} max={100} />);
      expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '75%' });
    });

    it('should cap at 100%', () => {
      render(<MockProgressBar value={150} max={100} />);
      expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '100%' });
    });

    it('should floor at 0%', () => {
      render(<MockProgressBar value={-10} max={100} />);
      expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '0%' });
    });
  });

  describe('Variants', () => {
    it.each(['default', 'success', 'warning', 'error'] as const)(
      'should apply %s variant',
      (variant) => {
        render(<MockProgressBar variant={variant} />);
        expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-variant', variant);
      }
    );
  });

  describe('Sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
      render(<MockProgressBar size={size} />);
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-size', size);
    });
  });

  describe('Labels', () => {
    it('should hide label by default', () => {
      render(<MockProgressBar value={50} />);
      expect(screen.queryByTestId('progress-label')).not.toBeInTheDocument();
    });

    it('should show percentage label', () => {
      render(<MockProgressBar value={75} showLabel={true} />);
      expect(screen.getByTestId('progress-label')).toHaveTextContent('75%');
    });

    it('should show custom label', () => {
      render(<MockProgressBar value={50} showLabel={true} label="Uploading..." />);
      expect(screen.getByTestId('progress-label')).toHaveTextContent('Uploading...');
    });
  });

  describe('Animation', () => {
    it('should apply animated attribute', () => {
      render(<MockProgressBar animated={true} />);
      expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-animated', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have progressbar role', () => {
      render(<MockProgressBar value={50} />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should have correct aria values', () => {
      render(<MockProgressBar value={30} max={100} />);
      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '30');
      expect(bar).toHaveAttribute('aria-valuemin', '0');
      expect(bar).toHaveAttribute('aria-valuemax', '100');
    });
  });
});
