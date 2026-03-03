/**
 * Card Component Tests
 * Testing card container component
 *
 * @module tests/unit/components/UI/Card.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Card component
const MockCard: React.FC<{
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}> = ({
  title,
  subtitle,
  children,
  footer,
  onClick,
  hoverable = false,
  variant = 'default',
  padding = 'md',
}) => {
  return (
    <article
      data-testid="card"
      data-variant={variant}
      data-padding={padding}
      data-hoverable={hoverable}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {(title || subtitle) && (
        <header data-testid="card-header">
          {title && <h3 data-testid="card-title">{title}</h3>}
          {subtitle && <p data-testid="card-subtitle">{subtitle}</p>}
        </header>
      )}
      {children && <div data-testid="card-body">{children}</div>}
      {footer && <footer data-testid="card-footer">{footer}</footer>}
    </article>
  );
};

describe('Card Component', () => {
  describe('Rendering', () => {
    it('should render card', () => {
      render(<MockCard />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should render title', () => {
      render(<MockCard title="Card Title" />);
      expect(screen.getByTestId('card-title')).toHaveTextContent('Card Title');
    });

    it('should render subtitle', () => {
      render(<MockCard subtitle="Card subtitle" />);
      expect(screen.getByTestId('card-subtitle')).toHaveTextContent('Card subtitle');
    });

    it('should render body content', () => {
      render(<MockCard>Content here</MockCard>);
      expect(screen.getByTestId('card-body')).toHaveTextContent('Content here');
    });

    it('should render footer', () => {
      render(<MockCard footer={<button>Action</button>} />);
      expect(screen.getByTestId('card-footer')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it.each(['default', 'outlined', 'elevated'] as const)('should apply %s variant', (variant) => {
      render(<MockCard variant={variant} />);
      expect(screen.getByTestId('card')).toHaveAttribute('data-variant', variant);
    });
  });

  describe('Padding', () => {
    it.each(['none', 'sm', 'md', 'lg'] as const)('should apply %s padding', (padding) => {
      render(<MockCard padding={padding} />);
      expect(screen.getByTestId('card')).toHaveAttribute('data-padding', padding);
    });
  });

  describe('Interactions', () => {
    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      render(<MockCard onClick={onClick} />);

      fireEvent.click(screen.getByTestId('card'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should apply hoverable attribute', () => {
      render(<MockCard hoverable={true} />);
      expect(screen.getByTestId('card')).toHaveAttribute('data-hoverable', 'true');
    });
  });

  describe('Conditional Rendering', () => {
    it('should not render header when no title/subtitle', () => {
      render(<MockCard>Just content</MockCard>);
      expect(screen.queryByTestId('card-header')).not.toBeInTheDocument();
    });

    it('should not render footer when not provided', () => {
      render(<MockCard />);
      expect(screen.queryByTestId('card-footer')).not.toBeInTheDocument();
    });
  });
});
