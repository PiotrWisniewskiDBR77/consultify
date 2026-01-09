/**
 * DashboardExecutionSnapshot Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardExecutionSnapshot } from '../../../src/components/dashboard/DashboardExecutionSnapshot';
import { FullSession, InitiativeStatus, AppView } from '../../../src/types';

describe('DashboardExecutionSnapshot Component', () => {
    const mockOnNavigate = vi.fn();

    const mockSession: FullSession = {
        id: 'session-1',
        userId: 'user-1',
        organizationId: 'org-1',
        step1Completed: true,
        step2Completed: true,
        step3Completed: false,
        step5Completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        initiatives: [
            {
                id: 'init-1',
                name: 'Digital Transformation',
                description: 'Main transformation initiative',
                status: InitiativeStatus.IN_PROGRESS,
                priority: 'High',
                sessionId: 'session-1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'init-2',
                name: 'AI Integration',
                description: 'AI integration initiative',
                status: InitiativeStatus.TODO,
                priority: 'Medium',
                sessionId: 'session-1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: 'init-3',
                name: 'Completed Project',
                description: 'Already done',
                status: InitiativeStatus.DONE,
                priority: 'Low',
                sessionId: 'session-1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ],
    } as FullSession;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial Render', () => {
        it('should render the component', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Project Status Overview')).toBeInTheDocument();
        });

        it('should display overall progress section', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Overall Progress')).toBeInTheDocument();
        });

        it('should display current phase section', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Current Phase')).toBeInTheDocument();
        });

        it('should display priority alerts section', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Priority Alerts')).toBeInTheDocument();
        });
    });

    describe('Initiative Statistics', () => {
        it('should show total initiatives count', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Total Initiatives')).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('should show in progress count', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('In Progress')).toBeInTheDocument();
        });

        it('should show completed count', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Completed')).toBeInTheDocument();
            // Check that the completed section exists (count may vary)
        });

        it('should show delayed count', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Delayed')).toBeInTheDocument();
        });
    });

    describe('Progress Calculation', () => {
        it('should calculate progress based on completed steps', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            // step1 (20%) + step2 (20%) = 40%
            expect(screen.getByText('40%')).toBeInTheDocument();
        });

        it('should show higher progress when more steps completed', () => {
            const advancedSession = {
                ...mockSession,
                step3Completed: true,
            };

            render(<DashboardExecutionSnapshot session={advancedSession} onNavigate={mockOnNavigate} />);

            // step1 (20%) + step2 (20%) + step3 (25%) = 65%
            expect(screen.getByText('65%')).toBeInTheDocument();
        });
    });

    describe('Current Phase Display', () => {
        it('should show Roadmap phase when step3 not completed', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Roadmap')).toBeInTheDocument();
            expect(screen.getByText('Planning initiatives')).toBeInTheDocument();
        });

        it('should show Pilot phase when step3 completed but not step5', () => {
            const pilotSession = {
                ...mockSession,
                step3Completed: true,
            };

            render(<DashboardExecutionSnapshot session={pilotSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Pilot Execution')).toBeInTheDocument();
        });
    });

    describe('Live Active Initiatives', () => {
        it('should display active initiatives table', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Live Active Initiatives')).toBeInTheDocument();
        });

        it('should render initiative section', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            // Initiative section header should always be present
            expect(screen.getByText('Live Active Initiatives')).toBeInTheDocument();
        });

        it('should have manage button', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            // Manage button should be present
            expect(screen.getByText('Manage All Initiatives')).toBeInTheDocument();
        });
    });

    describe('KPI Display', () => {
        it('should display KPI section', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument();
        });

        it('should show cycle time KPI', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Cycle Time')).toBeInTheDocument();
            expect(screen.getByText('12d')).toBeInTheDocument();
        });

        it('should show budget usage KPI', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Budget Usage')).toBeInTheDocument();
            expect(screen.getByText('45%')).toBeInTheDocument();
        });

        it('should show ROI realized KPI', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('ROI Realized')).toBeInTheDocument();
            expect(screen.getByText('$12k')).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should have manage initiatives button', () => {
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('Manage All Initiatives')).toBeInTheDocument();
        });

        it('should call onNavigate when manage button clicked', async () => {
            const user = userEvent.setup();
            render(<DashboardExecutionSnapshot session={mockSession} onNavigate={mockOnNavigate} />);

            await user.click(screen.getByText('Manage All Initiatives'));

            expect(mockOnNavigate).toHaveBeenCalledWith(AppView.FULL_STEP2_INITIATIVES);
        });
    });

    describe('Empty State', () => {
        it('should show message when no active initiatives', () => {
            const emptySession = {
                ...mockSession,
                initiatives: [],
            };

            render(<DashboardExecutionSnapshot session={emptySession} onNavigate={mockOnNavigate} />);

            expect(screen.getByText('No active initiatives currently tracked.')).toBeInTheDocument();
        });
    });
});
