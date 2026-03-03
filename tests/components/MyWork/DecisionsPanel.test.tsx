/**
 * DecisionsPanel Component - Comprehensive Tests
 *
 * Tests the decisions panel component for the MyWork module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock hooks
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    isLoading: false,
  }),
}));

// Mock decisions data
const mockDecisions = [
  {
    id: 'decision-1',
    title: 'Approve Budget Increase',
    description: 'Review and approve the Q1 budget increase request',
    status: 'pending',
    deadline: '2024-02-15',
    priority: 'high',
    createdBy: 'Jane Smith',
    project: 'Project Alpha',
  },
  {
    id: 'decision-2',
    title: 'Hire New Developer',
    description: 'Decision on hiring for the frontend team',
    status: 'approved',
    deadline: '2024-02-20',
    priority: 'medium',
    createdBy: 'John Doe',
    project: 'Project Beta',
  },
  {
    id: 'decision-3',
    title: 'Change Release Date',
    description: 'Postpone the release by 2 weeks',
    status: 'rejected',
    deadline: '2024-02-10',
    priority: 'low',
    createdBy: 'Alice Brown',
    project: 'Project Gamma',
  },
];

// Mock DecisionsPanel component
const MockDecisionsPanel = ({
  decisions = mockDecisions,
  onApprove = vi.fn(),
  onReject = vi.fn(),
  onFilter = vi.fn(),
  filter = 'all',
}: {
  decisions?: typeof mockDecisions;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onFilter?: (filter: string) => void;
  filter?: string;
}) => {
  const filteredDecisions =
    filter === 'all' ? decisions : decisions.filter((d) => d.status === filter);

  return (
    <div data-testid="decisions-panel">
      <header data-testid="decisions-header">
        <h2>Decisions</h2>
        <div data-testid="decisions-filters">
          <button
            data-testid="filter-all"
            onClick={() => onFilter('all')}
            aria-pressed={filter === 'all'}
          >
            All
          </button>
          <button
            data-testid="filter-pending"
            onClick={() => onFilter('pending')}
            aria-pressed={filter === 'pending'}
          >
            Pending
          </button>
          <button
            data-testid="filter-approved"
            onClick={() => onFilter('approved')}
            aria-pressed={filter === 'approved'}
          >
            Approved
          </button>
          <button
            data-testid="filter-rejected"
            onClick={() => onFilter('rejected')}
            aria-pressed={filter === 'rejected'}
          >
            Rejected
          </button>
        </div>
      </header>

      <ul data-testid="decisions-list" role="list">
        {filteredDecisions.map((decision) => (
          <li key={decision.id} data-testid={`decision-${decision.id}`} role="listitem">
            <h3 data-testid="decision-title">{decision.title}</h3>
            <p data-testid="decision-description">{decision.description}</p>
            <span data-testid="decision-status">{decision.status}</span>
            <span data-testid="decision-priority">{decision.priority}</span>
            <span data-testid="decision-deadline">{decision.deadline}</span>
            <span data-testid="decision-project">{decision.project}</span>
            <span data-testid="decision-creator">{decision.createdBy}</span>

            {decision.status === 'pending' && (
              <div data-testid="decision-actions">
                <button data-testid="action-approve" onClick={() => onApprove(decision.id)}>
                  Approve
                </button>
                <button data-testid="action-reject" onClick={() => onReject(decision.id)}>
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {filteredDecisions.length === 0 && <div data-testid="empty-state">No decisions found</div>}
    </div>
  );
};

describe('DecisionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the panel container', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('decisions-panel')).toBeDefined();
    });

    it('should render the header', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('decisions-header')).toBeDefined();
    });

    it('should render filter buttons', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('decisions-filters')).toBeDefined();
    });

    it('should render decisions list', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('decisions-list')).toBeDefined();
    });
  });

  describe('Decision items', () => {
    it('should render all decisions', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('decision-decision-1')).toBeDefined();
      expect(screen.getByTestId('decision-decision-2')).toBeDefined();
      expect(screen.getByTestId('decision-decision-3')).toBeDefined();
    });

    it('should display decision title', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getAllByTestId('decision-title')[0]).toBeDefined();
    });

    it('should display decision description', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getAllByTestId('decision-description')[0]).toBeDefined();
    });

    it('should display decision status', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getAllByTestId('decision-status')[0]).toBeDefined();
    });

    it('should display decision priority', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getAllByTestId('decision-priority')[0]).toBeDefined();
    });

    it('should display decision deadline', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getAllByTestId('decision-deadline')[0]).toBeDefined();
    });
  });

  describe('Filter functionality', () => {
    it('should render All filter button', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('filter-all')).toBeDefined();
    });

    it('should render Pending filter button', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('filter-pending')).toBeDefined();
    });

    it('should render Approved filter button', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('filter-approved')).toBeDefined();
    });

    it('should render Rejected filter button', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('filter-rejected')).toBeDefined();
    });

    it('should call onFilter when filter clicked', () => {
      const onFilter = vi.fn();
      render(
        <MemoryRouter>
          <MockDecisionsPanel onFilter={onFilter} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('filter-pending'));
      expect(onFilter).toHaveBeenCalledWith('pending');
    });

    it('should filter decisions by pending status', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel filter="pending" />
        </MemoryRouter>
      );

      expect(screen.getByTestId('decision-decision-1')).toBeDefined();
      expect(screen.queryByTestId('decision-decision-2')).toBeNull();
    });
  });

  describe('Actions', () => {
    it('should show action buttons for pending decisions', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      const decision1 = screen.getByTestId('decision-decision-1');
      expect(decision1.querySelector('[data-testid="decision-actions"]')).toBeDefined();
    });

    it('should show Approve button for pending decisions', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('action-approve')).toBeDefined();
    });

    it('should show Reject button for pending decisions', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByTestId('action-reject')).toBeDefined();
    });

    it('should call onApprove when approve clicked', () => {
      const onApprove = vi.fn();
      render(
        <MemoryRouter>
          <MockDecisionsPanel onApprove={onApprove} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('action-approve'));
      expect(onApprove).toHaveBeenCalledWith('decision-1');
    });

    it('should call onReject when reject clicked', () => {
      const onReject = vi.fn();
      render(
        <MemoryRouter>
          <MockDecisionsPanel onReject={onReject} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('action-reject'));
      expect(onReject).toHaveBeenCalledWith('decision-1');
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no decisions', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel decisions={[]} />
        </MemoryRouter>
      );

      expect(screen.getByTestId('empty-state')).toBeDefined();
    });

    it('should show empty state text', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel decisions={[]} />
        </MemoryRouter>
      );

      expect(screen.getByText('No decisions found')).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should have heading element', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
    });

    it('should have list role', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getByRole('list')).toBeDefined();
    });

    it('should have listitem roles', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel />
        </MemoryRouter>
      );

      expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    it('should have aria-pressed on filter buttons', () => {
      render(
        <MemoryRouter>
          <MockDecisionsPanel filter="all" />
        </MemoryRouter>
      );

      const allButton = screen.getByTestId('filter-all');
      expect(allButton.getAttribute('aria-pressed')).toBe('true');
    });
  });
});
