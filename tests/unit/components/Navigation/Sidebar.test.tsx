/**
 * Sidebar Component Tests
 * Testing main navigation sidebar
 *
 * @module tests/unit/components/Navigation/Sidebar.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Sidebar component for testing patterns
const MockSidebar: React.FC<{
  isExpanded?: boolean;
  onToggle?: () => void;
  items?: Array<{ id: string; label: string; icon?: string; href: string; badge?: number }>;
  activeItem?: string;
  onItemClick?: (id: string) => void;
}> = ({
  isExpanded = true,
  onToggle = () => {},
  items = [],
  activeItem,
  onItemClick = () => {},
}) => {
  return (
    <aside data-testid="sidebar" data-expanded={isExpanded}>
      <button onClick={onToggle} data-testid="sidebar-toggle" aria-label="Toggle sidebar">
        {isExpanded ? '←' : '→'}
      </button>
      <nav data-testid="sidebar-nav" role="navigation">
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                data-testid={`sidebar-item-${item.id}`}
                data-active={activeItem === item.id}
                onClick={(e) => {
                  e.preventDefault();
                  onItemClick(item.id);
                }}
              >
                {item.icon && <span data-testid="item-icon">{item.icon}</span>}
                {isExpanded && <span data-testid="item-label">{item.label}</span>}
                {item.badge && <span data-testid="item-badge">{item.badge}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

describe('Sidebar Component', () => {
  const mockItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/dashboard' },
    { id: 'tasks', label: 'Tasks', icon: '✅', href: '/tasks', badge: 5 },
    { id: 'reports', label: 'Reports', icon: '📊', href: '/reports' },
    { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' },
  ];

  describe('Rendering', () => {
    it('should render sidebar', () => {
      render(<MockSidebar items={mockItems} />);
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('should render all navigation items', () => {
      render(<MockSidebar items={mockItems} />);
      expect(screen.getByTestId('sidebar-item-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-item-tasks')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-item-reports')).toBeInTheDocument();
    });

    it('should show labels when expanded', () => {
      render(<MockSidebar items={mockItems} isExpanded={true} />);
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('should hide labels when collapsed', () => {
      render(<MockSidebar items={mockItems} isExpanded={false} />);
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('should mark active item', () => {
      render(<MockSidebar items={mockItems} activeItem="tasks" />);
      expect(screen.getByTestId('sidebar-item-tasks')).toHaveAttribute('data-active', 'true');
      expect(screen.getByTestId('sidebar-item-dashboard')).toHaveAttribute('data-active', 'false');
    });
  });

  describe('Badges', () => {
    it('should display badge count', () => {
      render(<MockSidebar items={mockItems} />);
      expect(screen.getByTestId('item-badge')).toHaveTextContent('5');
    });
  });

  describe('Interactions', () => {
    it('should call onToggle when toggle clicked', () => {
      const onToggle = vi.fn();
      render(<MockSidebar onToggle={onToggle} />);

      fireEvent.click(screen.getByTestId('sidebar-toggle'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('should call onItemClick when item clicked', () => {
      const onItemClick = vi.fn();
      render(<MockSidebar items={mockItems} onItemClick={onItemClick} />);

      fireEvent.click(screen.getByTestId('sidebar-item-reports'));
      expect(onItemClick).toHaveBeenCalledWith('reports');
    });
  });

  describe('Accessibility', () => {
    it('should have navigation role', () => {
      render(<MockSidebar items={mockItems} />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should have toggle aria-label', () => {
      render(<MockSidebar />);
      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
    });
  });
});
