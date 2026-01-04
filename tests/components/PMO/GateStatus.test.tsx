/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GateStatus } from '../../components/PMO/GateStatus';

// Mock dependencies
vi.mock('../../../store/usePMOStore', () => ({
    usePMOStore: () => ({
        currentPhase: 'Assessment',
        gateStatus: 'NOT_READY',
        missingCriteria: ['Criterion 1', 'Criterion 2'],
        fetchPMOContext: vi.fn()
    })
}));

const mockGateEvaluation = {
    gateType: 'DESIGN_GATE',
    status: 'NOT_READY',
    currentPhase: 'Assessment',
    nextPhase: 'Initiatives',
    completionCriteria: [
        { criterion: 'All axes assessed', isMet: true, evidence: 'Verified' },
        { criterion: 'Gap analysis reviewed', isMet: false, evidence: 'Not met' },
        { criterion: 'Stakeholders approved', isMet: true, evidence: 'Verified' }
    ],
    missingElements: ['Gap analysis reviewed']
};

describe('GateStatus Component', () => {
    const user = userEvent.setup();
    
    beforeEach(() => {
        vi.clearAllMocks();
        global.localStorage = {
            getItem: vi.fn(() => 'mock-token'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn()
        } as any;
        
        global.fetch = vi.fn(() => 
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockGateEvaluation)
            })
        ) as any;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Loading State', () => {
        it('shows loading message while fetching', async () => {
            global.fetch = vi.fn(() => new Promise(() => {})) as any;
            
            render(<GateStatus projectId="proj-1" />);
            
            expect(screen.getByText('Checking gate status...')).toBeInTheDocument();
        });
    });

    describe('Full Mode Display', () => {
        it('renders gate type header', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('DESIGN GATE')).toBeInTheDocument();
            });
        });

        it('shows phase transition info', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Assessment → Initiatives')).toBeInTheDocument();
            });
        });

        it('displays progress percentage', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                // 2 out of 3 met = 67%
                expect(screen.getByText('67%')).toBeInTheDocument();
            });
        });

        it('expands to show criteria on click', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('DESIGN GATE')).toBeInTheDocument();
            });

            // Click to expand
            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Missing (1)')).toBeInTheDocument();
                expect(screen.getByText('Completed (2)')).toBeInTheDocument();
            });
        });

        it('shows missing criteria', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('DESIGN GATE')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Gap analysis reviewed')).toBeInTheDocument();
            });
        });

        it('shows completed criteria', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('DESIGN GATE')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('All axes assessed')).toBeInTheDocument();
                expect(screen.getByText('Stakeholders approved')).toBeInTheDocument();
            });
        });
    });

    describe('Compact Mode Display', () => {
        it('shows gate status badge', async () => {
            render(<GateStatus projectId="proj-1" compact />);

            await waitFor(() => {
                expect(screen.getByText('1 Missing')).toBeInTheDocument();
            });
        });

        it('expands on click in compact mode', async () => {
            render(<GateStatus projectId="proj-1" compact />);

            await waitFor(() => {
                expect(screen.getByText('1 Missing')).toBeInTheDocument();
            });

            await user.click(screen.getByText('1 Missing'));
        });
    });

    describe('Ready Gate State', () => {
        beforeEach(() => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ...mockGateEvaluation,
                        status: 'READY',
                        completionCriteria: [
                            { criterion: 'All axes assessed', isMet: true },
                            { criterion: 'Gap analysis reviewed', isMet: true },
                            { criterion: 'Stakeholders approved', isMet: true }
                        ],
                        missingElements: []
                    })
                })
            ) as any;
        });

        it('shows ready indicator', async () => {
            render(<GateStatus projectId="proj-1" compact />);

            await waitFor(() => {
                expect(screen.getByText('Gate Ready')).toBeInTheDocument();
            });
        });

        it('shows proceed button when ready and onProceed provided', async () => {
            const onProceed = vi.fn();
            render(<GateStatus projectId="proj-1" onProceed={onProceed} />);

            await waitFor(() => {
                expect(screen.getByText('100%')).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText(/Proceed to Initiatives/)).toBeInTheDocument();
            });
        });

        it('calls onProceed when proceed button clicked', async () => {
            const onProceed = vi.fn();
            render(<GateStatus projectId="proj-1" onProceed={onProceed} />);

            await waitFor(() => {
                expect(screen.getByText('100%')).toBeInTheDocument();
            });

            // Expand first
            const expandButtons = screen.getAllByRole('button');
            await user.click(expandButtons[0]);

            await waitFor(() => {
                expect(screen.getByText(/Proceed to Initiatives/)).toBeInTheDocument();
            });

            await user.click(screen.getByText(/Proceed to Initiatives/));

            expect(onProceed).toHaveBeenCalled();
        });

        it('applies green styling when ready', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                const container = document.querySelector('.bg-green-500\\/10');
                expect(container).toBeTruthy();
            });
        });
    });

    describe('Error Handling', () => {
        it('returns null on API error', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: false
                })
            ) as any;

            const { container } = render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                // After error, component should not render anything
            });
        });

        it('handles network error', async () => {
            global.fetch = vi.fn(() => 
                Promise.reject(new Error('Network error'))
            ) as any;

            const { container } = render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                // Component should handle error gracefully
            });
        });
    });

    describe('API Integration', () => {
        it('fetches gate status on mount', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/stage-gates/proj-1/current',
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            Authorization: 'Bearer mock-token'
                        })
                    })
                );
            });
        });

        it('refetches when projectId changes', async () => {
            const { rerender } = render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            rerender(<GateStatus projectId="proj-2" />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });
        });

        it('does not fetch without projectId', async () => {
            render(<GateStatus projectId="" />);

            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('Progress Calculation', () => {
        it('calculates correct progress with mixed criteria', async () => {
            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                // 2/3 = 67% rounded
                expect(screen.getByText('67%')).toBeInTheDocument();
            });
        });

        it('shows 100% when all criteria met', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ...mockGateEvaluation,
                        status: 'READY',
                        completionCriteria: [
                            { criterion: 'Criterion 1', isMet: true },
                            { criterion: 'Criterion 2', isMet: true }
                        ]
                    })
                })
            ) as any;

            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('100%')).toBeInTheDocument();
            });
        });

        it('shows 0% when no criteria met', async () => {
            global.fetch = vi.fn(() => 
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        ...mockGateEvaluation,
                        status: 'NOT_READY',
                        completionCriteria: [
                            { criterion: 'Criterion 1', isMet: false },
                            { criterion: 'Criterion 2', isMet: false }
                        ]
                    })
                })
            ) as any;

            render(<GateStatus projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('0%')).toBeInTheDocument();
            });
        });
    });
});














