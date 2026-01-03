/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvidencePanel from '../../../components/ai/EvidencePanel';

const mockExplanation = {
    entity_type: 'proposal',
    entity_id: 'prop-1',
    confidence: 0.85,
    has_explanation: true,
    evidence_count: 3,
    reasoning: [
        {
            id: 'reason-1',
            reasoning_summary: 'Based on the analysis of project metrics and historical data',
            assumptions: [
                'Current team velocity remains stable',
                'No major blockers are introduced'
            ],
            confidence: 0.85,
            created_at: '2024-01-15T10:00:00Z'
        }
    ],
    evidences: [
        {
            link_id: 'link-1',
            evidence_id: 'ev-1',
            type: 'METRIC_SNAPSHOT',
            source: 'Project Analytics',
            weight: 1.0,
            note: 'Weekly velocity data',
            payload: { velocity: 42, sprint: 10 },
            created_at: '2024-01-14T09:00:00Z'
        },
        {
            link_id: 'link-2',
            evidence_id: 'ev-2',
            type: 'SIGNAL',
            source: 'Risk Monitor',
            weight: 0.75,
            note: null,
            payload: { risk_level: 'medium' },
            created_at: '2024-01-13T08:00:00Z'
        },
        {
            link_id: 'link-3',
            evidence_id: 'ev-3',
            type: 'DOC_REF',
            source: 'Project Charter',
            weight: 1.0,
            note: 'Reference document',
            payload: { doc_id: 'charter-1' },
            created_at: '2024-01-12T07:00:00Z'
        }
    ]
};

describe('EvidencePanel Component', () => {
    const user = userEvent.setup();
    const defaultProps = {
        entityType: 'proposal' as const,
        entityId: 'prop-1',
        token: 'test-token'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockExplanation)
            })
        ) as any;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Loading State', () => {
        it('shows loading spinner while fetching', async () => {
            global.fetch = vi.fn(() => new Promise(() => {})) as any;

            render(<EvidencePanel {...defaultProps} />);

            expect(screen.getByText('Loading evidence...')).toBeInTheDocument();
            expect(document.querySelector('.animate-spin')).toBeTruthy();
        });
    });

    describe('Error State', () => {
        it('shows error message on fetch failure', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    statusText: 'Not Found'
                })
            ) as any;

            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Failed to fetch explanation/)).toBeInTheDocument();
            });
        });

        it('shows error on network failure', async () => {
            global.fetch = vi.fn(() =>
                Promise.reject(new Error('Network error'))
            ) as any;

            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument();
            });
        });
    });

    describe('Empty State', () => {
        it('shows no evidence message when has_explanation is false', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ ...mockExplanation, has_explanation: false })
                })
            ) as any;

            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('No evidence available for this item yet.')).toBeInTheDocument();
            });
        });

        it('shows no evidence when explanation is null', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(null)
                })
            ) as any;

            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('No evidence available for this item yet.')).toBeInTheDocument();
            });
        });
    });

    describe('Header Display', () => {
        it('shows Evidence & Reasoning header', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Evidence & Reasoning')).toBeInTheDocument();
            });
        });

        it('displays confidence badge', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('85%')).toBeInTheDocument();
            });
        });

        it('shows export button', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Export Evidence Pack')).toBeInTheDocument();
            });
        });
    });

    describe('Reasoning Section', () => {
        it('displays reasoning summary', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Reasoning Summary')).toBeInTheDocument();
                expect(screen.getByText('Based on the analysis of project metrics and historical data')).toBeInTheDocument();
            });
        });

        it('displays assumptions', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Assumptions')).toBeInTheDocument();
                expect(screen.getByText('Current team velocity remains stable')).toBeInTheDocument();
                expect(screen.getByText('No major blockers are introduced')).toBeInTheDocument();
            });
        });

        it('shows recorded date', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/Recorded:/)).toBeInTheDocument();
            });
        });
    });

    describe('Evidence List', () => {
        it('shows evidence count', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Linked Evidence (3)')).toBeInTheDocument();
            });
        });

        it('displays evidence sources', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Project Analytics')).toBeInTheDocument();
                expect(screen.getByText('Risk Monitor')).toBeInTheDocument();
                expect(screen.getByText('Project Charter')).toBeInTheDocument();
            });
        });

        it('shows evidence type labels', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Metric')).toBeInTheDocument();
                expect(screen.getByText('Signal')).toBeInTheDocument();
                expect(screen.getByText('Document')).toBeInTheDocument();
            });
        });

        it('shows weight for weighted evidence', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('(weight: 75%)')).toBeInTheDocument();
            });
        });
    });

    describe('Evidence Expansion', () => {
        it('expands evidence on click', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Project Analytics')).toBeInTheDocument();
            });

            // Click to expand first evidence
            await user.click(screen.getByText('Project Analytics'));

            await waitFor(() => {
                expect(screen.getByText(/"velocity": 42/)).toBeInTheDocument();
            });
        });

        it('shows note when expanded', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Project Analytics')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Project Analytics'));

            await waitFor(() => {
                expect(screen.getByText('Note: Weekly velocity data')).toBeInTheDocument();
            });
        });

        it('collapses evidence on second click', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Project Analytics')).toBeInTheDocument();
            });

            // Expand
            await user.click(screen.getByText('Project Analytics'));

            await waitFor(() => {
                expect(screen.getByText(/"velocity": 42/)).toBeInTheDocument();
            });

            // Collapse
            await user.click(screen.getByText('Project Analytics'));

            await waitFor(() => {
                expect(screen.queryByText(/"velocity": 42/)).not.toBeInTheDocument();
            });
        });

        it('only one evidence expanded at a time', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Project Analytics')).toBeInTheDocument();
            });

            // Expand first
            await user.click(screen.getByText('Project Analytics'));

            await waitFor(() => {
                expect(screen.getByText(/"velocity": 42/)).toBeInTheDocument();
            });

            // Expand second - should collapse first
            await user.click(screen.getByText('Risk Monitor'));

            await waitFor(() => {
                expect(screen.queryByText(/"velocity": 42/)).not.toBeInTheDocument();
                expect(screen.getByText(/"risk_level": "medium"/)).toBeInTheDocument();
            });
        });
    });

    describe('Export Functionality', () => {
        it('triggers download on export click', async () => {
            const createObjectURLMock = vi.fn(() => 'blob:url');
            const revokeObjectURLMock = vi.fn();
            global.URL.createObjectURL = createObjectURLMock;
            global.URL.revokeObjectURL = revokeObjectURLMock;

            global.fetch = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockExplanation)
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ exported: 'data' })
                });

            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Export Evidence Pack')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Export Evidence Pack'));

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/ai/explain/proposal/prop-1/export?format=json',
                    expect.any(Object)
                );
            });
        });

        it('shows loading spinner during export', async () => {
            global.fetch = vi.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(mockExplanation)
                })
                .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Export Evidence Pack')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Export Evidence Pack'));

            await waitFor(() => {
                const exportButton = screen.getByText('Export Evidence Pack').closest('button');
                expect(exportButton?.querySelector('.animate-spin')).toBeTruthy();
            });
        });
    });

    describe('API Integration', () => {
        it('fetches with correct URL and headers', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    '/api/ai/explain/proposal/prop-1',
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer test-token',
                            'Content-Type': 'application/json'
                        })
                    })
                );
            });
        });

        it('does not fetch when entityId is empty', async () => {
            render(<EvidencePanel {...defaultProps} entityId="" />);

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled();
            });
        });

        it('does not fetch when token is empty', async () => {
            render(<EvidencePanel {...defaultProps} token="" />);

            await waitFor(() => {
                expect(global.fetch).not.toHaveBeenCalled();
            });
        });

        it('refetches when entityId changes', async () => {
            const { rerender } = render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(1);
            });

            rerender(<EvidencePanel {...defaultProps} entityId="prop-2" />);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Evidence Type Icons', () => {
        it('shows Activity icon for METRIC_SNAPSHOT', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Metric')).toBeInTheDocument();
            });
        });

        it('shows AlertCircle icon for SIGNAL', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Signal')).toBeInTheDocument();
            });
        });

        it('shows FileText icon for DOC_REF', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Document')).toBeInTheDocument();
            });
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', async () => {
            render(<EvidencePanel {...defaultProps} />);

            await waitFor(() => {
                const container = document.querySelector('.dark\\:bg-blue-900\\/20');
                expect(container).toBeTruthy();
            });
        });
    });
});









