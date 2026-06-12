/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseIndicator } from '../../../src/components/PMO/PhaseIndicator';
import { usePMOStore } from '../../../src/store/usePMOStore';

// No inline store mock - use usePMOStore.setState() for real store integration

describe('PhaseIndicator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set initial store state for tests
    usePMOStore.setState({
      currentPhase: 'Assessment',
      phaseNumber: 2,
      totalPhases: 6,
      gateStatus: 'NOT_READY',
      isLoading: false,
      projectName: 'Test Project',
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton in compact mode', () => {
      usePMOStore.setState({ isLoading: true });

      render(<PhaseIndicator compact />);

      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });

    it('shows loading skeleton in full mode', () => {
      usePMOStore.setState({ isLoading: true });

      render(<PhaseIndicator />);

      expect(document.querySelector('.animate-pulse')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('returns null in compact mode when no phase', () => {
      usePMOStore.setState({ currentPhase: null });

      const { container } = render(<PhaseIndicator compact />);
      expect(container.firstChild).toBeNull();
    });

    it('shows "No project selected" in full mode when no phase', () => {
      usePMOStore.setState({ currentPhase: null });

      render(<PhaseIndicator />);

      expect(screen.getByText('No project selected')).toBeInTheDocument();
    });
  });

  describe('Full Mode Display', () => {
    it('displays phase number and total', () => {
      render(<PhaseIndicator />);

      expect(screen.getByText('Phase 2/6')).toBeInTheDocument();
    });

    it('displays current phase name', () => {
      render(<PhaseIndicator />);

      expect(screen.getByText('Assessment')).toBeInTheDocument();
    });

    it('shows progress dots for all phases', () => {
      render(<PhaseIndicator />);

      const dots = document.querySelectorAll('.rounded-full.w-1\\.5');
      expect(dots.length).toBe(6);
    });
  });

  describe('Compact Mode Display', () => {
    it('shows phase number only', () => {
      render(<PhaseIndicator compact />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('has tooltip with full phase info', () => {
      render(<PhaseIndicator compact />);

      const indicator = document.querySelector('[title]');
      expect(indicator?.getAttribute('title')).toContain('Phase 2/6: Assessment');
    });
  });

  describe('Gate Status Colors', () => {
    it('applies amber color when gate is NOT_READY', () => {
      usePMOStore.setState({ gateStatus: 'NOT_READY' });

      render(<PhaseIndicator />);

      const phaseName = screen.getByText('Assessment');
      expect(phaseName).toHaveClass('text-amber-500');
    });

    it('applies green color for Execution phase', () => {
      usePMOStore.setState({
        currentPhase: 'Execution',
        phaseNumber: 5,
        gateStatus: 'READY',
      });

      render(<PhaseIndicator />);

      const phaseName = screen.getByText('Execution');
      expect(phaseName).toHaveClass('text-green-500');
    });

    it('applies purple color for early phases when ready', () => {
      usePMOStore.setState({
        currentPhase: 'Context',
        phaseNumber: 1,
        gateStatus: 'READY',
      });

      render(<PhaseIndicator />);

      const phaseName = screen.getByText('Context');
      expect(phaseName).toHaveClass('text-primary-500');
    });
  });

  describe('Status Icons', () => {
    it('shows amber icon when gate NOT_READY', () => {
      usePMOStore.setState({ gateStatus: 'NOT_READY' });

      render(<PhaseIndicator />);

      expect(document.querySelector('.text-amber-500')).toBeTruthy();
    });

    it('shows green icon for Execution+ phases', () => {
      usePMOStore.setState({
        currentPhase: 'Execution',
        phaseNumber: 5,
        gateStatus: 'READY',
      });

      render(<PhaseIndicator />);

      expect(document.querySelector('.text-green-500')).toBeTruthy();
    });

    it('shows purple icon for early phases', () => {
      usePMOStore.setState({
        currentPhase: 'Context',
        phaseNumber: 1,
        gateStatus: 'READY',
      });

      render(<PhaseIndicator />);

      expect(document.querySelector('.text-primary-500')).toBeTruthy();
    });
  });

  describe('Background Colors', () => {
    it('applies amber background when NOT_READY', () => {
      usePMOStore.setState({ gateStatus: 'NOT_READY' });

      render(<PhaseIndicator />);

      const container = document.querySelector('.bg-amber-500\\/10');
      expect(container).toBeTruthy();
    });

    it('applies green background for Execution+', () => {
      usePMOStore.setState({
        currentPhase: 'Execution',
        phaseNumber: 5,
        gateStatus: 'READY',
      });

      render(<PhaseIndicator />);

      const container = document.querySelector('.bg-green-500\\/10');
      expect(container).toBeTruthy();
    });

    it('applies purple background for early phases', () => {
      usePMOStore.setState({
        currentPhase: 'Context',
        phaseNumber: 1,
        gateStatus: 'READY',
      });

      render(<PhaseIndicator />);

      const container = document.querySelector('.bg-primary-500\\/10');
      expect(container).toBeTruthy();
    });
  });
});
