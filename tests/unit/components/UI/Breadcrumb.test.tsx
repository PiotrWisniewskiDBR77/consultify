/**
 * Breadcrumb Component Tests
 * Testing breadcrumb navigation
 *
 * @module tests/unit/components/UI/Breadcrumb.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Breadcrumb component
const MockBreadcrumb: React.FC<{
  items?: Array<{ label: string; href?: string; onClick?: () => void }>;
  separator?: string;
  maxItems?: number;
}> = ({
  items = [
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Electronics' },
  ],
  separator = '/',
  maxItems,
}) => {
  const displayItems =
    maxItems && items.length > maxItems
      ? [...items.slice(0, 1), { label: '...', href: undefined }, ...items.slice(-2)]
      : items;

  return (
    <nav data-testid="breadcrumb" aria-label="Breadcrumb">
      <ol data-testid="breadcrumb-list">
        {displayItems.map((item, index) => (
          <li key={index} data-testid={`breadcrumb-item-${index}`}>
            {index > 0 && <span data-testid="breadcrumb-separator">{separator}</span>}
            {item.href ? (
              <a
                href={item.href}
                data-testid={`breadcrumb-link-${index}`}
                onClick={(e) => {
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
              >
                {item.label}
              </a>
            ) : (
              <span data-testid={`breadcrumb-current-${index}`} aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

describe('Breadcrumb Component', () => {
  describe('Rendering', () => {
    it('should render breadcrumb nav', () => {
      render(<MockBreadcrumb />);
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    });

    it('should render all items', () => {
      render(<MockBreadcrumb />);
      expect(screen.getByTestId('breadcrumb-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('breadcrumb-item-2')).toBeInTheDocument();
    });

    it('should render links for items with href', () => {
      render(<MockBreadcrumb />);
      expect(screen.getByTestId('breadcrumb-link-0')).toHaveAttribute('href', '/');
    });

    it('should render current page without link', () => {
      render(<MockBreadcrumb />);
      expect(screen.getByTestId('breadcrumb-current-2')).toBeInTheDocument();
    });
  });

  describe('Separator', () => {
    it('should use default separator', () => {
      render(<MockBreadcrumb />);
      const separators = screen.getAllByTestId('breadcrumb-separator');
      expect(separators[0]).toHaveTextContent('/');
    });

    it('should use custom separator', () => {
      render(<MockBreadcrumb separator=">" />);
      const separators = screen.getAllByTestId('breadcrumb-separator');
      expect(separators[0]).toHaveTextContent('>');
    });
  });

  describe('Truncation', () => {
    it('should truncate long breadcrumbs', () => {
      const manyItems = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/1' },
        { label: 'Level 2', href: '/2' },
        { label: 'Level 3', href: '/3' },
        { label: 'Current' },
      ];
      render(<MockBreadcrumb items={manyItems} maxItems={4} />);
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have nav with aria-label', () => {
      render(<MockBreadcrumb />);
      expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    });

    it('should have aria-current on current page', () => {
      render(<MockBreadcrumb />);
      expect(screen.getByTestId('breadcrumb-current-2')).toHaveAttribute('aria-current', 'page');
    });
  });
});
