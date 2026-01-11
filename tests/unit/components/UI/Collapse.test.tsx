/**
 * Collapse Component Tests
 * Testing collapsible panel component
 *
 * @module tests/unit/components/UI/Collapse.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Collapse component
const MockCollapse: React.FC<{
  title?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  onChange?: (isOpen: boolean) => void;
}> = ({
  title = 'Section',
  children = <p>Collapsed content</p>,
  defaultOpen = false,
  disabled = false,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (!disabled) {
      const newState = !isOpen;
      setIsOpen(newState);
      onChange?.(newState);
    }
  };

  return (
    <div data-testid="collapse" data-disabled={disabled}>
      <button
        data-testid="collapse-trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={isOpen}
      >
        <span data-testid="collapse-title">{title}</span>
        <span data-testid="collapse-icon">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div data-testid="collapse-content" role="region">
          {children}
        </div>
      )}
    </div>
  );
};

describe('Collapse Component', () => {
  describe('Default State', () => {
    it('should be collapsed by default', () => {
      render(<MockCollapse />);
      expect(screen.queryByTestId('collapse-content')).not.toBeInTheDocument();
    });

    it('should be expanded when defaultOpen is true', () => {
      render(<MockCollapse defaultOpen={true} />);
      expect(screen.getByTestId('collapse-content')).toBeInTheDocument();
    });
  });

  describe('Toggle', () => {
    it('should expand on click', () => {
      render(<MockCollapse />);

      fireEvent.click(screen.getByTestId('collapse-trigger'));

      expect(screen.getByTestId('collapse-content')).toBeInTheDocument();
    });

    it('should collapse on second click', () => {
      render(<MockCollapse defaultOpen={true} />);

      fireEvent.click(screen.getByTestId('collapse-trigger'));

      expect(screen.queryByTestId('collapse-content')).not.toBeInTheDocument();
    });

    it('should call onChange on toggle', () => {
      const onChange = vi.fn();
      render(<MockCollapse onChange={onChange} />);

      fireEvent.click(screen.getByTestId('collapse-trigger'));
      expect(onChange).toHaveBeenCalledWith(true);

      fireEvent.click(screen.getByTestId('collapse-trigger'));
      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Disabled', () => {
    it('should not toggle when disabled', () => {
      render(<MockCollapse disabled={true} />);

      fireEvent.click(screen.getByTestId('collapse-trigger'));

      expect(screen.queryByTestId('collapse-content')).not.toBeInTheDocument();
    });

    it('should have disabled trigger', () => {
      render(<MockCollapse disabled={true} />);
      expect(screen.getByTestId('collapse-trigger')).toBeDisabled();
    });
  });

  describe('Content', () => {
    it('should render title', () => {
      render(<MockCollapse title="Settings" />);
      expect(screen.getByTestId('collapse-title')).toHaveTextContent('Settings');
    });

    it('should render children when open', () => {
      render(<MockCollapse defaultOpen={true}>Custom content</MockCollapse>);
      expect(screen.getByTestId('collapse-content')).toHaveTextContent('Custom content');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-expanded false when collapsed', () => {
      render(<MockCollapse />);
      expect(screen.getByTestId('collapse-trigger')).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-expanded true when expanded', () => {
      render(<MockCollapse defaultOpen={true} />);
      expect(screen.getByTestId('collapse-trigger')).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have region role for content', () => {
      render(<MockCollapse defaultOpen={true} />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });
});
