import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DecisionsList } from '../../../../src/components/MyWork/DecisionsList';
import { Api } from '../../../../src/services/api';

// Mock dependencies
vi.mock('../../../../src/services/api', () => ({
    Api: {
        getDecisions: vi.fn(),
        updateDecision: vi.fn(),
        deleteDecision: vi.fn(),
        createDecision: vi.fn()
    }
}));

const mockUsePMOStore = vi.fn();
vi.mock('../../../../src/store/usePMOStore', () => ({
    usePMOStore: (selector: any) => mockUsePMOStore(selector),
    PMODecisionStatus: {}
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

/**
 * DecisionsList Component Tests
 * Tests for decisions list component with full integration
 * CRITICAL FOR ENTERPRISE DECISION MANAGEMENT UI
 */
describe('DecisionsList Component', () => {
    const mockOnEditDecision = vi.fn();
    const mockOnCreateDecision = vi.fn();

    const mockDecisions = [
        {
            id: '1',
            title: 'Strategic Investment Decision',
            status: 'pending',
            priority: 'high',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
            description: 'Major investment decision requiring board approval',
            stakeholders: ['CEO', 'CFO', 'CTO'],
            impact: 'high',
            risk: 'medium'
        },
        {
            id: '2',
            title: 'Approved Decision',
            status: 'approved',
            priority: 'medium',
            description: 'Decision that was already approved'
        },
        {
            id: '3',
            title: 'Rejected Decision',
            status: 'rejected',
            priority: 'low',
            description: 'Decision that was rejected'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getDecisions as any).mockImplementation(() => Promise.resolve(mockDecisions));
        (Api.updateDecision as any).mockImplementation(() => Promise.resolve({}));
        (Api.deleteDecision as any).mockImplementation(() => Promise.resolve({}));
        (Api.createDecision as any).mockImplementation(() => Promise.resolve({}));

        mockUsePMOStore.mockImplementation((selector: any) => {
            const state = {
                getDecisionStatus: () => ({ color: '#28a745', text: 'Approved' })
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render decisions list with decisions', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            expect(screen.getByText('Approved Decision')).toBeInTheDocument();
            expect(screen.getByText('Rejected Decision')).toBeInTheDocument();
        });

        it('should display decision status badges', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Check status badges
            expect(screen.getByText('pending')).toBeInTheDocument();
            expect(screen.getByText('approved')).toBeInTheDocument();
            expect(screen.getByText('rejected')).toBeInTheDocument();
        });

        it('should show decision metadata', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Check metadata display
            expect(screen.getByText('High Impact')).toBeInTheDocument();
            expect(screen.getByText('Medium Risk')).toBeInTheDocument();
            expect(screen.getByText('CEO, CFO, CTO')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onEditDecision when edit button is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            const editButton = screen.getByRole('button', { name: /edit.*decision/i });
            await user.click(editButton);

            expect(mockOnEditDecision).toHaveBeenCalledWith(mockDecisions[0]);
        });

        it('should update decision status', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Find status dropdown and change it
            const statusSelect = screen.getByDisplayValue('pending');
            await user.selectOptions(statusSelect, 'approved');

            expect(Api.updateDecision).toHaveBeenCalledWith('1', { status: 'approved' });
        });

        it('should delete decision with confirmation', async () => {
            const user = userEvent.setup();
            // Mock window.confirm
            vi.spyOn(window, 'confirm').mockReturnValue(true);

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            const deleteButton = screen.getByRole('button', { name: /delete.*decision/i });
            await user.click(deleteButton);

            expect(window.confirm).toHaveBeenCalled();
            expect(Api.deleteDecision).toHaveBeenCalledWith('1');
        });
    });

    describe('Filtering and Sorting', () => {
        it('should filter decisions by status', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                    initialFilter={{ status: 'approved' }}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Approved Decision')).toBeInTheDocument();
            });

            expect(screen.queryByText('Strategic Investment Decision')).not.toBeInTheDocument();
        });

        it('should filter by priority', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                    initialFilter={{ priority: 'high' }}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            expect(screen.queryByText('Approved Decision')).not.toBeInTheDocument();
        });

        it('should sort by due date', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                    initialSort={{ field: 'dueDate', direction: 'asc' }}
                />
            );

            await waitFor(() => {
                const decisionElements = screen.getAllByRole('article');
                // First decision should be the one with earliest due date
                expect(decisionElements[0]).toHaveTextContent('Strategic Investment Decision');
            });
        });
    });

    describe('Stakeholder Management', () => {
        it('should display stakeholder avatars', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Check stakeholder display
            expect(screen.getByText('CEO')).toBeInTheDocument();
            expect(screen.getByText('CFO')).toBeInTheDocument();
            expect(screen.getByText('CTO')).toBeInTheDocument();
        });

        it('should show stakeholder count when many', async () => {
            const decisionWithManyStakeholders = {
                ...mockDecisions[0],
                stakeholders: Array.from({ length: 10 }, (_, i) => `Stakeholder ${i + 1}`)
            };

            (Api.getDecisions as any).mockResolvedValue([decisionWithManyStakeholders]);

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/\+7 more/)).toBeInTheDocument();
            });
        });
    });

    describe('Decision Workflow', () => {
        it('should show approval workflow for pending decisions', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Check workflow buttons for pending decision
            expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
        });

        it('should handle approval action', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            const approveButton = screen.getByRole('button', { name: /approve/i });
            await user.click(approveButton);

            expect(Api.updateDecision).toHaveBeenCalledWith('1', { status: 'approved' });
        });

        it('should show decision history', async () => {
            const decisionWithHistory = {
                ...mockDecisions[0],
                history: [
                    { action: 'created', timestamp: '2025-01-01T10:00:00Z', user: 'John Doe' },
                    { action: 'updated', timestamp: '2025-01-02T11:00:00Z', user: 'Jane Smith' }
                ]
            };

            (Api.getDecisions as any).mockResolvedValue([decisionWithHistory]);

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Toggle history view
            const historyButton = screen.getByRole('button', { name: /history/i });
            await user.click(historyButton);

            expect(screen.getByText('created by John Doe')).toBeInTheDocument();
            expect(screen.getByText('updated by Jane Smith')).toBeInTheDocument();
        });
    });

    describe('Bulk Operations', () => {
        it('should support bulk status update', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Select multiple decisions
            const checkboxes = screen.getAllByRole('checkbox', { name: /select/i });
            await user.click(checkboxes[0]);
            await user.click(checkboxes[1]);

            // Bulk update
            const bulkUpdateButton = screen.getByRole('button', { name: /bulk.*update/i });
            await user.click(bulkUpdateButton);

            const bulkStatusSelect = screen.getByDisplayValue('');
            await user.selectOptions(bulkStatusSelect, 'approved');

            const applyButton = screen.getByRole('button', { name: /apply/i });
            await user.click(applyButton);

            expect(Api.updateDecision).toHaveBeenCalledTimes(2);
        });
    });

    describe('Real-time Updates', () => {
        it('should update when decision changes externally', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Simulate external update (e.g., via WebSocket)
            const updatedDecisions = [
                { ...mockDecisions[0], status: 'approved' },
                mockDecisions[1],
                mockDecisions[2]
            ];

            (Api.getDecisions as any).mockResolvedValue(updatedDecisions);

            // Trigger re-fetch (in real app this would be automatic)
            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            await user.click(refreshButton);

            await waitFor(() => {
                expect(screen.getByText('approved')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels for decision actions', async () => {
            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            const editButton = screen.getByRole('button', { name: /edit.*decision/i });
            expect(editButton).toHaveAttribute('aria-label', 'Edit decision: Strategic Investment Decision');
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <DecisionsList
                    onEditDecision={mockOnEditDecision}
                    onCreateDecision={mockOnCreateDecision}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Strategic Investment Decision')).toBeInTheDocument();
            });

            // Navigate through decisions with keyboard
            await user.keyboard('{Tab}');
            expect(screen.getByText('Strategic Investment Decision')).toHaveFocus();
        });
    });
});




