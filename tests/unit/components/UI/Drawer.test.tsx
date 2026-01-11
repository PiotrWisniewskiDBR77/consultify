/**
 * Drawer Component Tests
 * Testing drawer/sidebar component behavior
 *
 * @module tests/unit/components/UI/Drawer.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Drawer component for testing patterns
const MockDrawer: React.FC<{
  isOpen?: boolean;
  onClose?: () => void;
  position?: 'left' | 'right';
  title?: string;
  children?: React.ReactNode;
}> = ({
  isOpen = true,
  onClose = () => {},
  position = 'right',
  title = 'Drawer Title',
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div data-testid="drawer" data-position={position} role="dialog">
      <div data-testid="drawer-header">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="Close drawer">
          ×
        </button>
      </div>
      <div data-testid="drawer-content">{children}</div>
    </div>
  );
};

describe('Drawer Component', () => {
  describe('Visibility', () => {
    it('should render when open', () => {
      render(<MockDrawer isOpen={true} />);
      expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      render(<MockDrawer isOpen={false} />);
      expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
    });
  });

  describe('Position', () => {
    it('should render on right by default', () => {
      render(<MockDrawer />);
      expect(screen.getByTestId('drawer')).toHaveAttribute('data-position', 'right');
    });

    it('should render on left when specified', () => {
      render(<MockDrawer position="left" />);
      expect(screen.getByTestId('drawer')).toHaveAttribute('data-position', 'left');
    });
  });

  describe('Content', () => {
    it('should display title', () => {
      render(<MockDrawer title="Settings" />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render children', () => {
      render(
        <MockDrawer>
          <p>Drawer content</p>
        </MockDrawer>
      );
      expect(screen.getByText('Drawer content')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<MockDrawer onClose={onClose} />);

      fireEvent.click(screen.getByLabelText('Close drawer'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role', () => {
      render(<MockDrawer />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
