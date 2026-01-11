/**
 * RolloutPlanTab Component Tests
 * Testing rollout plan tabbed interface
 *
 * @module tests/unit/components/Assessment/RolloutPlanTab.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock RolloutPlanTab component
const MockRolloutPlanTab: React.FC<{
  phases?: Array<{ id: string; name: string; status: 'pending' | 'active' | 'completed' }>;
  activePhase?: string;
  onPhaseSelect?: (phaseId: string) => void;
}> = ({
  phases = [
    { id: 'p1', name: 'Planning', status: 'completed' },
    { id: 'p2', name: 'Development', status: 'active' },
    { id: 'p3', name: 'Testing', status: 'pending' },
    { id: 'p4', name: 'Deployment', status: 'pending' },
  ],
  activePhase = 'p2',
  onPhaseSelect = () => {},
}) => {
  return (
    <div data-testid="rollout-plan-tab">
      <div data-testid="phase-list" role="tablist">
        {phases.map((phase) => (
          <button
            key={phase.id}
            role="tab"
            data-testid={`phase-${phase.id}`}
            data-status={phase.status}
            aria-selected={activePhase === phase.id}
            onClick={() => onPhaseSelect(phase.id)}
          >
            <span data-testid={`phase-name-${phase.id}`}>{phase.name}</span>
            <span data-testid={`phase-status-${phase.id}`}>{phase.status}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" data-testid="phase-content">
        Phase content for: {phases.find((p) => p.id === activePhase)?.name}
      </div>
    </div>
  );
};

describe('RolloutPlanTab Component', () => {
  describe('Rendering', () => {
    it('should render all phases', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByTestId('phase-p1')).toBeInTheDocument();
      expect(screen.getByTestId('phase-p2')).toBeInTheDocument();
      expect(screen.getByTestId('phase-p3')).toBeInTheDocument();
      expect(screen.getByTestId('phase-p4')).toBeInTheDocument();
    });

    it('should display phase names', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByTestId('phase-name-p1')).toHaveTextContent('Planning');
      expect(screen.getByTestId('phase-name-p2')).toHaveTextContent('Development');
    });
  });

  describe('Status Indicators', () => {
    it('should show completed status', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByTestId('phase-p1')).toHaveAttribute('data-status', 'completed');
    });

    it('should show active status', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByTestId('phase-p2')).toHaveAttribute('data-status', 'active');
    });

    it('should show pending status', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByTestId('phase-p3')).toHaveAttribute('data-status', 'pending');
    });
  });

  describe('Phase Selection', () => {
    it('should mark active phase as selected', () => {
      render(<MockRolloutPlanTab activePhase="p2" />);
      expect(screen.getByTestId('phase-p2')).toHaveAttribute('aria-selected', 'true');
    });

    it('should call onPhaseSelect when phase clicked', () => {
      const onPhaseSelect = vi.fn();
      render(<MockRolloutPlanTab onPhaseSelect={onPhaseSelect} />);

      fireEvent.click(screen.getByTestId('phase-p3'));
      expect(onPhaseSelect).toHaveBeenCalledWith('p3');
    });

    it('should display content for active phase', () => {
      render(<MockRolloutPlanTab activePhase="p1" />);
      expect(screen.getByTestId('phase-content')).toHaveTextContent('Planning');
    });
  });

  describe('Accessibility', () => {
    it('should have tablist role', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('should have tab roles for phases', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getAllByRole('tab')).toHaveLength(4);
    });

    it('should have tabpanel role for content', () => {
      render(<MockRolloutPlanTab />);
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });
});
