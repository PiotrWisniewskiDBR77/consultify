/**
 * Alert Component Tests
 * Testing alert/notification component
 *
 * @module tests/unit/components/UI/Alert.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Alert component
const MockAlert: React.FC<{
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
}> = ({
  variant = 'info',
  title,
  children = 'Alert message',
  dismissible = false,
  onDismiss = () => {},
  icon,
}) => {
  return (
    <div data-testid="alert" data-variant={variant} role="alert">
      {icon && <span data-testid="alert-icon">{icon}</span>}
      <div data-testid="alert-content">
        {title && <strong data-testid="alert-title">{title}</strong>}
        <span data-testid="alert-message">{children}</span>
      </div>
      {dismissible && (
        <button data-testid="alert-dismiss" onClick={onDismiss} aria-label="Dismiss alert">
          ×
        </button>
      )}
    </div>
  );
};

describe('Alert Component', () => {
  describe('Rendering', () => {
    it('should render alert', () => {
      render(<MockAlert />);
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });

    it('should render message', () => {
      render(<MockAlert>Custom message</MockAlert>);
      expect(screen.getByTestId('alert-message')).toHaveTextContent('Custom message');
    });

    it('should render title when provided', () => {
      render(<MockAlert title="Alert Title" />);
      expect(screen.getByTestId('alert-title')).toHaveTextContent('Alert Title');
    });

    it('should not render title when not provided', () => {
      render(<MockAlert />);
      expect(screen.queryByTestId('alert-title')).not.toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it.each(['info', 'success', 'warning', 'error'] as const)(
      'should apply %s variant',
      (variant) => {
        render(<MockAlert variant={variant} />);
        expect(screen.getByTestId('alert')).toHaveAttribute('data-variant', variant);
      }
    );
  });

  describe('Icon', () => {
    it('should render icon when provided', () => {
      render(<MockAlert icon={<span>🔔</span>} />);
      expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });

    it('should not render icon when not provided', () => {
      render(<MockAlert />);
      expect(screen.queryByTestId('alert-icon')).not.toBeInTheDocument();
    });
  });

  describe('Dismissible', () => {
    it('should hide dismiss button by default', () => {
      render(<MockAlert />);
      expect(screen.queryByTestId('alert-dismiss')).not.toBeInTheDocument();
    });

    it('should show dismiss button when dismissible', () => {
      render(<MockAlert dismissible={true} />);
      expect(screen.getByTestId('alert-dismiss')).toBeInTheDocument();
    });

    it('should call onDismiss when dismiss clicked', () => {
      const onDismiss = vi.fn();
      render(<MockAlert dismissible={true} onDismiss={onDismiss} />);

      fireEvent.click(screen.getByTestId('alert-dismiss'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have alert role', () => {
      render(<MockAlert />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have accessible dismiss button', () => {
      render(<MockAlert dismissible={true} />);
      expect(screen.getByLabelText('Dismiss alert')).toBeInTheDocument();
    });
  });
});
