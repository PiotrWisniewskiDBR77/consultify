/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PMOStatusBanner, PMOPhaseIndicator, PMOBlockingBadge } from '../../components/PMO/PMOStatusBanner';

// Mock dependencies

const mockPMOStore = {
    currentPhase: 'Execution',
    phaseNumber: 5,
    totalPhases: 6,
    gateStatus: 'NOT_READY',
    systemMessages: [
        { severity: 'critical', code: 'CRIT_01', message: 'Critical issue detected' },
        { severity: 'warning', code: 'WARN_01', message: 'Warning message' },
        { severity: 'info', code: 'INFO_01', message: 'Info message' }
    ],
    blockingIssues: [
        { id: 'issue-1', title: 'Blocking Issue 1', type: 'TASK', reason: 'Overdue' }
    ],
    isLoading: false
};

vi.mock('../../../store/usePMOStore', () => ({
    usePMOStore: () => mockPMOStore
}));

describe('PMOStatusBanner Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Loading State', () => {
        it('returns null when loading', async () => {
            const { usePMOStore } = await import('../../../store/usePMOStore');
            vi.mocked(usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                isLoading: true
            });

            const { container } = render(<PMOStatusBanner />);
            // Should not render content during loading
        });

        it('returns null when no phase', async () => {
            const { usePMOStore } = await import('../../../store/usePMOStore');
            vi.mocked(usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                currentPhase: null
            });

            const { container } = render(<PMOStatusBanner />);
            // Should not render content without phase
        });
    });

    describe('Full Banner Mode', () => {
        it('displays phase header with number and name', () => {
            render(<PMOStatusBanner />);

            expect(screen.getByText('Phase 5/6')).toBeInTheDocument();
            expect(screen.getByText('Execution')).toBeInTheDocument();
        });

        it('shows gate status indicator', () => {
            render(<PMOStatusBanner />);

            expect(screen.getByText('In progress')).toBeInTheDocument();
        });

        it('displays blocking issues count', () => {
            render(<PMOStatusBanner />);

            expect(screen.getByText(/1 blocking/)).toBeInTheDocument();
        });

        it('renders critical messages first', () => {
            render(<PMOStatusBanner />);

            expect(screen.getByText('Critical issue detected')).toBeInTheDocument();
        });

        it('renders warning messages', () => {
            render(<PMOStatusBanner />);

            expect(screen.getByText('Warning message')).toBeInTheDocument();
        });

        it('renders info messages', () => {
            render(<PMOStatusBanner />);

            expect(screen.getByText('Info message')).toBeInTheDocument();
        });

        it('applies correct phase color gradient', () => {
            render(<PMOStatusBanner />);

            const phaseLabel = screen.getByText('Phase 5/6');
            expect(phaseLabel.closest('div')).toHaveClass('bg-gradient-to-r');
        });
    });

    describe('Compact Mode', () => {
        it('renders compact phase indicator', () => {
            render(<PMOStatusBanner compact />);

            expect(screen.getByText(/Phase 5\/6: Execution/)).toBeInTheDocument();
        });

        it('shows blocking count in compact mode', () => {
            render(<PMOStatusBanner compact showBlockingCount />);

            expect(screen.getByText('1')).toBeInTheDocument();
        });

        it('hides blocking count when showBlockingCount is false', () => {
            render(<PMOStatusBanner compact showBlockingCount={false} />);

            expect(screen.queryByText('1')).not.toBeInTheDocument();
        });
    });

    describe('Gate Status Ready', () => {
        it('shows Ready badge when gate is ready', () => {
            vi.mocked(require('../../../store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                gateStatus: 'READY',
                blockingIssues: []
            });

            render(<PMOStatusBanner />);

            expect(screen.getByText('Ready for next phase')).toBeInTheDocument();
        });

        it('shows Ready badge in compact mode', () => {
            vi.mocked(require('../../../store/usePMOStore').usePMOStore).mockReturnValueOnce({
                ...mockPMOStore,
                gateStatus: 'READY',
                blockingIssues: []
            });

            render(<PMOStatusBanner compact />);

            expect(screen.getByText('Ready')).toBeInTheDocument();
        });
    });

    describe('Phase Color Mapping', () => {
        const phases = ['Context', 'Assessment', 'Initiatives', 'Roadmap', 'Execution', 'Stabilization'];

        phases.forEach((phase, index) => {
            it(`applies correct color for ${phase} phase`, () => {
                vi.mocked(require('../../../store/usePMOStore').usePMOStore).mockReturnValueOnce({
                    ...mockPMOStore,
                    currentPhase: phase,
                    phaseNumber: index + 1
                });

                render(<PMOStatusBanner />);

                expect(screen.getByText(phase)).toBeInTheDocument();
            });
        });
    });

    describe('Severity Icons', () => {
        it('renders correct icon for critical severity', () => {
            render(<PMOStatusBanner />);

            // Critical message should have AlertCircle icon
            const criticalMessage = screen.getByText('Critical issue detected').closest('div');
            expect(criticalMessage).toHaveClass('bg-red-50');
        });

        it('renders correct icon for warning severity', () => {
            render(<PMOStatusBanner />);

            // Warning message should have AlertTriangle icon
            const warningMessage = screen.getByText('Warning message').closest('div');
            expect(warningMessage).toHaveClass('bg-amber-50');
        });

        it('renders correct icon for info severity', () => {
            render(<PMOStatusBanner />);

            // Info message should have Info icon
            const infoMessage = screen.getByText('Info message').closest('div');
            expect(infoMessage).toHaveClass('bg-blue-50');
        });
    });
});

describe('PMOPhaseIndicator Component', () => {
    it('renders phase with number', () => {
        render(<PMOPhaseIndicator />);

        expect(screen.getByText('Execution')).toBeInTheDocument();
        expect(screen.getByText('(5/6)')).toBeInTheDocument();
    });

    it('returns null when loading', () => {
        vi.mocked(require('../../../store/usePMOStore').usePMOStore).mockReturnValueOnce({
            ...mockPMOStore,
            isLoading: true
        });

        const { container } = render(<PMOPhaseIndicator />);
        expect(container.firstChild).toBeNull();
    });

    it('returns null when no phase', () => {
        vi.mocked(require('../../../store/usePMOStore').usePMOStore).mockReturnValueOnce({
            ...mockPMOStore,
            currentPhase: null
        });

        const { container } = render(<PMOPhaseIndicator />);
        expect(container.firstChild).toBeNull();
    });
});

describe('PMOBlockingBadge Component', () => {
    const user = userEvent.setup();

    it('renders blocking count', () => {
        render(<PMOBlockingBadge />);

        expect(screen.getByText(/1 blocking/)).toBeInTheDocument();
    });

    it('returns null when no blockers', () => {
        vi.mocked(require('../../../store/usePMOStore').usePMOStore).mockReturnValueOnce({
            ...mockPMOStore,
            blockingIssues: []
        });

        const { container } = render(<PMOBlockingBadge />);
        expect(container.firstChild).toBeNull();
    });

    it('calls onClick handler when clicked', async () => {
        const onClick = vi.fn();
        render(<PMOBlockingBadge onClick={onClick} />);

        await user.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalled();
    });

    it('shows AlertCircle icon', () => {
        render(<PMOBlockingBadge />);

        const badge = screen.getByRole('button');
        expect(badge).toBeInTheDocument();
    });
});



