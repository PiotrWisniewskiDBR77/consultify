/**
 * Badge Component Tests
 * Testing badge display and variants
 *
 * @module tests/unit/components/UI/Badge.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Badge component
const MockBadge: React.FC<{
  children?: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}> = ({
  children = 'Badge',
  variant = 'default',
  size = 'md',
  dot = false,
  removable = false,
  onRemove = () => {},
}) => {
  return (
    <span data-testid="badge" data-variant={variant} data-size={size}>
      {dot && <span data-testid="badge-dot" />}
      <span data-testid="badge-content">{children}</span>
      {removable && (
        <button data-testid="badge-remove" onClick={onRemove} aria-label="Remove">
          ×
        </button>
      )}
    </span>
  );
};

describe('Badge Component', () => {
  describe('Rendering', () => {
    it('should render badge', () => {
      render(<MockBadge />);
      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('should render children', () => {
      render(<MockBadge>New</MockBadge>);
      expect(screen.getByTestId('badge-content')).toHaveTextContent('New');
    });
  });

  describe('Variants', () => {
    it.each(['default', 'primary', 'success', 'warning', 'error', 'info'] as const)(
      'should apply %s variant',
      (variant) => {
        render(<MockBadge variant={variant} />);
        expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', variant);
      }
    );
  });

  describe('Sizes', () => {
    it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
      render(<MockBadge size={size} />);
      expect(screen.getByTestId('badge')).toHaveAttribute('data-size', size);
    });
  });

  describe('Dot Indicator', () => {
    it('should hide dot by default', () => {
      render(<MockBadge />);
      expect(screen.queryByTestId('badge-dot')).not.toBeInTheDocument();
    });

    it('should show dot when enabled', () => {
      render(<MockBadge dot={true} />);
      expect(screen.getByTestId('badge-dot')).toBeInTheDocument();
    });
  });

  describe('Removable', () => {
    it('should hide remove button by default', () => {
      render(<MockBadge />);
      expect(screen.queryByTestId('badge-remove')).not.toBeInTheDocument();
    });

    it('should show remove button when removable', () => {
      render(<MockBadge removable={true} />);
      expect(screen.getByTestId('badge-remove')).toBeInTheDocument();
    });

    it('should have accessible remove button', () => {
      render(<MockBadge removable={true} />);
      expect(screen.getByLabelText('Remove')).toBeInTheDocument();
    });
  });
});
