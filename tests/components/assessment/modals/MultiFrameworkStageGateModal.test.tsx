/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiFrameworkStageGateModal } from '../../../../components/assessment/modals/MultiFrameworkStageGateModal';
import { AssessmentFramework } from '../../../../store/useMultiFrameworkStore';

// Mock the store
vi.mock('../../../../store/useMultiFrameworkStore', () => ({
    useMultiFrameworkStore: () => ({
        frameworks: {
            [AssessmentFramework.ADKAR]: {
                name: 'ADKAR',
                version: '1.0',
                phases: ['Awareness', 'Desire', 'Knowledge', 'Ability', 'Reinforcement']
            }
        },
        getFrameworkConfig: vi.fn(() => ({
            name: 'ADKAR',
            version: '1.0',
            phases: ['Awareness', 'Desire', 'Knowledge', 'Ability', 'Reinforcement']
        }))
    }),
    AssessmentFramework: {
        ADKAR: 'ADKAR',
        KOTTER: 'KOTTER',
        LEAN: 'LEAN',
        SIX_SIGMA: 'SIX_SIGMA'
    }
}));

const mockReviewers = [
    {
        id: 'reviewer-1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'Senior Consultant',
        canApprove: true
    },
    {
        id: 'reviewer-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'Project Manager',
        canApprove: false
    }
];

describe('MultiFrameworkStageGateModal Component', () => {
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

        // Mock fetch for validation
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    data: {
                        completeness: 0.85,
                        frameworks: {
                            [AssessmentFramework.ADKAR]: {
                                awareness: { score: 8, completed: true },
                                desire: { score: 7, completed: true },
                                knowledge: { score: 6, completed: true },
                                ability: { score: 9, completed: true },
                                reinforcement: { score: 5, completed: false }
                            }
                        }
                    }
                })
            })
        ) as any;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Modal Rendering', () => {
        it('renders modal when isOpen is true', () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            expect(screen.getByText('Stage Gate: DRAFT → In Review')).toBeInTheDocument();
        });

        it('does not render when isOpen is false', () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={false}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            expect(screen.queryByText('Stage Gate')).not.toBeInTheDocument();
        });

        it('shows framework name in title', () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            expect(screen.getByText('ADKAR Assessment')).toBeInTheDocument();
        });
    });

    describe('Validation Checks', () => {
        it('displays validation checks on load', async () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Assessment completeness (85%)')).toBeInTheDocument();
            });
        });

        it('shows validation errors for incomplete assessments', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            completeness: 0.6,
                            frameworks: {
                                [AssessmentFramework.ADKAR]: {
                                    awareness: { score: 3, completed: false },
                                    desire: { score: 4, completed: false }
                                }
                            }
                        }
                    })
                })
            ) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Assessment completeness (60%)')).toBeInTheDocument();
            });

            // Should show validation error
            expect(screen.getByText(/requires minimum 70% completeness/)).toBeInTheDocument();
        });
    });

    describe('Reviewer Selection', () => {
        beforeEach(() => {
            // Mock reviewers API
            global.fetch = vi.fn((url) => {
                if (url.includes('/reviewers')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: mockReviewers })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            completeness: 0.85,
                            frameworks: {
                                [AssessmentFramework.ADKAR]: {
                                    awareness: { score: 8, completed: true },
                                    desire: { score: 7, completed: true },
                                    knowledge: { score: 6, completed: true },
                                    ability: { score: 9, completed: true },
                                    reinforcement: { score: 5, completed: false }
                                }
                            }
                        }
                    })
                });
            }) as any;
        });

        it('loads and displays available reviewers', async () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            });
        });

        it('allows selecting reviewers', async () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            const reviewerCheckbox = screen.getByRole('checkbox', { name: /John Doe/ });
            await user.click(reviewerCheckbox);

            expect(reviewerCheckbox).toBeChecked();
        });
    });

    describe('Comment Input', () => {
        it('allows entering submission comment', async () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Assessment completeness (85%)')).toBeInTheDocument();
            });

            const commentTextarea = screen.getByPlaceholderText('Add a comment (optional)');
            await user.type(commentTextarea, 'Ready for review');

            expect(commentTextarea).toHaveValue('Ready for review');
        });
    });

    describe('Submission Actions', () => {
        it('disables submit button when validation fails', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            completeness: 0.5, // Below minimum
                            frameworks: {}
                        }
                    })
                })
            ) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                const submitButton = screen.getByRole('button', { name: /submit for review/i });
                expect(submitButton).toBeDisabled();
            });
        });

        it('enables submit button when validation passes', async () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                const submitButton = screen.getByRole('button', { name: /submit for review/i });
                expect(submitButton).not.toBeDisabled();
            });
        });

        it('calls onSuccess after successful submission', async () => {
            const onSuccess = vi.fn();

            global.fetch = vi.fn((url) => {
                if (url.includes('/stage-gate')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ success: true })
                    });
                }
                if (url.includes('/reviewers')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: mockReviewers })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            completeness: 0.85,
                            frameworks: {
                                [AssessmentFramework.ADKAR]: {
                                    awareness: { score: 8, completed: true },
                                    desire: { score: 7, completed: true },
                                    knowledge: { score: 6, completed: true },
                                    ability: { score: 9, completed: true },
                                    reinforcement: { score: 5, completed: false }
                                }
                            }
                        }
                    })
                });
            }) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                    onSuccess={onSuccess}
                />
            );

            await waitFor(() => {
                const submitButton = screen.getByRole('button', { name: /submit for review/i });
                expect(submitButton).not.toBeDisabled();
            });

            const submitButton = screen.getByRole('button', { name: /submit for review/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalled();
            });
        });
    });

    describe('Different Target Statuses', () => {
        it('shows approve button for APPROVED target status', () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="IN_REVIEW"
                    targetStatus="APPROVED"
                />
            );

            expect(screen.getByText('Stage Gate: In Review → Approved')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
        });

        it('shows reject button for REJECTED target status', () => {
            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="IN_REVIEW"
                    targetStatus="REJECTED"
                />
            );

            expect(screen.getByText('Stage Gate: In Review → Rejected')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
        });
    });

    describe('Close Functionality', () => {
        it('calls onClose when close button is clicked', async () => {
            const onClose = vi.fn();

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={onClose}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            const closeButton = screen.getByRole('button', { name: /close/i });
            await user.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Loading States', () => {
        it('shows loading indicator during validation', () => {
            global.fetch = vi.fn(() => new Promise(() => {})) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            expect(screen.getByText('Validating assessment...')).toBeInTheDocument();
        });

        it('shows loading indicator during submission', async () => {
            global.fetch = vi.fn((url) => {
                if (url.includes('/stage-gate')) {
                    return new Promise(() => {}); // Never resolves
                }
                if (url.includes('/reviewers')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: mockReviewers })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            completeness: 0.85,
                            frameworks: {}
                        }
                    })
                });
            }) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                const submitButton = screen.getByRole('button', { name: /submit for review/i });
                expect(submitButton).not.toBeDisabled();
            });

            const submitButton = screen.getByRole('button', { name: /submit for review/i });
            await user.click(submitButton);

            expect(screen.getByText('Submitting...')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('shows error message on validation failure', async () => {
            global.fetch = vi.fn(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error'
                })
            ) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Failed to validate assessment')).toBeInTheDocument();
            });
        });

        it('shows error message on submission failure', async () => {
            global.fetch = vi.fn((url) => {
                if (url.includes('/stage-gate')) {
                    return Promise.resolve({
                        ok: false,
                        status: 400,
                        json: () => Promise.resolve({ error: 'Validation failed' })
                    });
                }
                if (url.includes('/reviewers')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: mockReviewers })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        data: {
                            completeness: 0.85,
                            frameworks: {}
                        }
                    })
                });
            }) as any;

            render(
                <MultiFrameworkStageGateModal
                    isOpen={true}
                    onClose={vi.fn()}
                    assessmentId="assessment-1"
                    framework={AssessmentFramework.ADKAR}
                    currentStatus="DRAFT"
                    targetStatus="IN_REVIEW"
                />
            );

            await waitFor(() => {
                const submitButton = screen.getByRole('button', { name: /submit for review/i });
                expect(submitButton).not.toBeDisabled();
            });

            const submitButton = screen.getByRole('button', { name: /submit for review/i });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Validation failed')).toBeInTheDocument();
            });
        });
    });
});














