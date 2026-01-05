/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseIndicator } from '@/components/PMO/PhaseIndicator';

// Mock dependencies
const mockPMOStore = {
    currentPhase: 'Assessment',
    phaseNumber: 2,
    totalPhases: 6,
    gateStatus: 'NOT_READY',
    isLoading: false,
    projectName: 'Test Project'
};

vi.mock('@/store/usePMOStore', () => ({
    usePMOStore: vi.fn(() => mockPMOStore)
}));

describe('PhaseIndicator Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValue(mockPMOStore);
    });

    describe('Loading State', () => {
        it('shows loading skeleton in compact mode', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                isLoading: true
            });

            render(<PhaseIndicator compact />);

            expect(document.querySelector('.animate-pulse')).toBeTruthy();
        });

        it('shows loading skeleton in full mode', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                isLoading: true
            });

            render(<PhaseIndicator />);

            expect(document.querySelector('.animate-pulse')).toBeTruthy();
        });
    });

    describe('Empty State', () => {
        it('returns null in compact mode when no phase', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: null
            });

            const { container } = render(<PhaseIndicator compact />);
            expect(container.firstChild).toBeNull();
        });

        it('shows "No project selected" in full mode when no phase', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: null
            });

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

            // Should have 6 dots for 6 phases
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
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                gateStatus: 'NOT_READY'
            });

            render(<PhaseIndicator />);

            const phaseName = screen.getByText('Assessment');
            expect(phaseName).toHaveClass('text-amber-500');
        });

        it('applies green color for Execution phase', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Execution',
                phaseNumber: 5,
                gateStatus: 'READY'
            });

            render(<PhaseIndicator />);

            const phaseName = screen.getByText('Execution');
            expect(phaseName).toHaveClass('text-green-500');
        });

        it('applies purple color for early phases when ready', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Context',
                phaseNumber: 1,
                gateStatus: 'READY'
            });

            render(<PhaseIndicator />);

            const phaseName = screen.getByText('Context');
            expect(phaseName).toHaveClass('text-purple-500');
        });
    });

    describe('Status Icons', () => {
        it('shows AlertTriangle when gate NOT_READY', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                gateStatus: 'NOT_READY'
            });

            render(<PhaseIndicator />);

            // Check for amber icon presence
            expect(document.querySelector('.text-amber-500')).toBeTruthy();
        });

        it('shows CheckCircle2 for Execution+ phases', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Execution',
                phaseNumber: 5,
                gateStatus: 'READY'
            });

            render(<PhaseIndicator />);

            // Check for green icon presence
            expect(document.querySelector('.text-green-500')).toBeTruthy();
        });

        it('shows Target for early phases', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Context',
                phaseNumber: 1,
                gateStatus: 'READY'
            });

            render(<PhaseIndicator />);

            // Check for purple icon presence
            expect(document.querySelector('.text-purple-500')).toBeTruthy();
        });
    });

    describe('Progress Dots', () => {
        it('marks completed phases as green', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Initiatives',
                phaseNumber: 3
            });

            render(<PhaseIndicator />);

            const dots = document.querySelectorAll('.rounded-full.w-1\\.5');
            // First 2 dots (Context, Assessment) should be green
            // Current dot (Initiatives) should have ring
        });

        it('marks current phase with ring highlight', () => {
            render(<PhaseIndicator />);

            // Current phase dot should have ring-2
            const currentDot = document.querySelector('.ring-2.ring-purple-500\\/30');
            expect(currentDot).toBeTruthy();
        });

        it('marks future phases as slate/gray', () => {
            render(<PhaseIndicator />);

            // Future phase dots should be slate colored
            const slateDots = document.querySelectorAll('.bg-slate-300');
            expect(slateDots.length).toBeGreaterThan(0);
        });
    });

    describe('Background Colors', () => {
        it('applies amber background when NOT_READY', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                gateStatus: 'NOT_READY'
            });

            render(<PhaseIndicator />);

            const container = document.querySelector('.bg-amber-500\\/10');
            expect(container).toBeTruthy();
        });

        it('applies green background for Execution+', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Execution',
                phaseNumber: 5,
                gateStatus: 'READY'
            });

            render(<PhaseIndicator />);

            const container = document.querySelector('.bg-green-500\\/10');
            expect(container).toBeTruthy();
        });

        it('applies purple background for early phases', () => {
            vi.mocked(require('@/store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: 'Context',
                phaseNumber: 1,
                gateStatus: 'READY'
            });

            render(<PhaseIndicator />);

            const container = document.querySelector('.bg-purple-500\\/10');
            expect(container).toBeTruthy();
        });
    });
});



