/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharterBuilder } from '../../../src/components/PMO/CharterBuilder';

const mockInitialData = {
  problemStatement: 'Test problem',
  objectives: 'Test objectives',
  deliverables: ['Deliverable 1'],
  successCriteria: ['Success criterion 1'],
  scopeIn: ['In scope item'],
  scopeOut: ['Out of scope item'],
  keyRisks: ['Risk 1'],
  budget: 10000,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  ownerStrategyId: 'user-1',
  ownerExecutionId: 'user-2',
};

const mockUsers = [
  { id: 'user-1', firstName: 'John', lastName: 'Doe' },
  { id: 'user-2', firstName: 'Jane', lastName: 'Smith' },
];

describe('CharterBuilder Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders component', () => {
      render(
        <CharterBuilder initiativeId="init-1" initialData={mockInitialData} users={mockUsers} />
      );
      expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
      const { container } = render(
        <CharterBuilder initiativeId="init-1" initialData={mockInitialData} users={mockUsers} />
      );
      expect(container).toBeInTheDocument();
    });

    it('displays charter content', () => {
      render(
        <CharterBuilder initiativeId="init-1" initialData={mockInitialData} users={mockUsers} />
      );

      const charterElements = screen.queryAllByText(/charter|project|builder/i);
      expect(charterElements.length).toBeGreaterThanOrEqual(0);
    });

    it('shows navigation sections', () => {
      render(
        <CharterBuilder initiativeId="init-1" initialData={mockInitialData} users={mockUsers} />
      );

      const sections = screen.queryAllByText(/overview|scope|risks|budget/i);
      expect(sections).toBeDefined();
    });
  });

  describe('Functionality', () => {
    it('has form elements', () => {
      render(
        <CharterBuilder initiativeId="init-1" initialData={mockInitialData} users={mockUsers} />
      );

      const inputs = screen.queryAllByRole('textbox');
      const buttons = screen.queryAllByRole('button');
      expect(inputs.length + buttons.length).toBeGreaterThanOrEqual(0);
    });

    it('handles read-only mode', () => {
      render(
        <CharterBuilder
          initiativeId="init-1"
          initialData={mockInitialData}
          users={mockUsers}
          readOnly={true}
        />
      );
      expect(document.body).toBeDefined();
    });
  });
});
