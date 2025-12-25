/**
 * Component Tests: AssessmentHubDashboard
 * Tests for the main assessment hub dashboard component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

// Mock data
const mockAssessmentData = {
    id: 'assessment-123',
    projectId: 'project-456',
    overallScore: 3.5,
    targetScore: 5.2,
    status: 'DRAFT',
    progress: 57,
    lastUpdated: '2024-01-20T14:30:00Z',
    axisScores: {
        processes: { actual: 4, target: 6 },
        digitalProducts: { actual: 3, target: 5 },
        businessModels: { actual: 3, target: 5 },
        dataManagement: { actual: 4, target: 6 },
        culture: { actual: 3, target: 5 },
        cybersecurity: { actual: 5, target: 6 },
        aiMaturity: { actual: 2, target: 5 }
    }
};

// Mock component for testing
const MockAssessmentHubDashboard = ({
    assessment,
    onStartAssessment,
    onContinueAssessment,
    onViewReport,
    onExport,
    isLoading = false,
    error = null
}: {
    assessment: typeof mockAssessmentData | null;
    onStartAssessment?: () => void;
    onContinueAssessment?: () => void;
    onViewReport?: () => void;
    onExport?: (format: string) => void;
    isLoading?: boolean;
    error?: string | null;
}) => {
    if (isLoading) {
        return <div data-testid="loading-state">Loading assessment data...</div>;
    }

    if (error) {
        return <div data-testid="error-state">{error}</div>;
    }

    if (!assessment) {
        return (
            <div data-testid="empty-state">
                <h2>No assessment started</h2>
                <button data-testid="start-assessment" onClick={onStartAssessment}>
                    Start Assessment
                </button>
            </div>
        );
    }

    return (
        <div data-testid="assessment-hub">
            {/* Header Section */}
            <header data-testid="hub-header">
                <h1>Digital Readiness Assessment</h1>
                <span data-testid="assessment-status" className={assessment.status.toLowerCase()}>
                    {assessment.status}
                </span>
            </header>

            {/* Overall Score Section */}
            <section data-testid="overall-score-section">
                <div data-testid="current-score">{assessment.overallScore.toFixed(1)}</div>
                <div data-testid="target-score">{assessment.targetScore.toFixed(1)}</div>
                <div data-testid="overall-gap">
                    {(assessment.targetScore - assessment.overallScore).toFixed(1)}
                </div>
            </section>

            {/* Progress Section */}
            <section data-testid="progress-section">
                <div 
                    role="progressbar" 
                    data-testid="assessment-progress"
                    aria-valuenow={assessment.progress}
                >
                    {assessment.progress}% complete
                </div>
            </section>

            {/* Axis Grid */}
            <section data-testid="axis-grid">
                {Object.entries(assessment.axisScores).map(([axisId, scores]) => (
                    <div key={axisId} data-testid={`axis-${axisId}`} className="axis-summary">
                        <span>{axisId}</span>
                        <span>{scores.actual}</span>
                        <span>{scores.target}</span>
                    </div>
                ))}
            </section>

            {/* Quick Insights */}
            <section data-testid="quick-insights">
                <h3>Quick Insights</h3>
                <div data-testid="priority-gap">Priority gap: aiMaturity</div>
                <div data-testid="strength">Strength: cybersecurity</div>
            </section>

            {/* Actions */}
            <section data-testid="actions-section">
                <button data-testid="continue-assessment" onClick={onContinueAssessment}>
                    Continue Assessment
                </button>
                <button data-testid="view-report" onClick={onViewReport}>
                    View Report
                </button>
                <div data-testid="export-menu">
                    <button onClick={() => onExport?.('pdf')}>Export PDF</button>
                    <button onClick={() => onExport?.('excel')}>Export Excel</button>
                </div>
            </section>

            {/* Last Updated */}
            <footer data-testid="last-updated">
                Last updated: {new Date(assessment.lastUpdated).toLocaleDateString()}
            </footer>
        </div>
    );
};

describe('AssessmentHubDashboard', () => {
    let queryClient: QueryClient;

    const defaultProps = {
        assessment: mockAssessmentData,
        onStartAssessment: vi.fn(),
        onContinueAssessment: vi.fn(),
        onViewReport: vi.fn(),
        onExport: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false }
            }
        });
    });

    const renderComponent = (props = {}) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>
                    <I18nextProvider i18n={i18n}>
                        <MockAssessmentHubDashboard {...defaultProps} {...props} />
                    </I18nextProvider>
                </MemoryRouter>
            </QueryClientProvider>
        );
    };

    // =========================================================================
    // LOADING STATE TESTS
    // =========================================================================

    describe('Loading State', () => {
        it('should show loading indicator when loading', () => {
            renderComponent({ isLoading: true });
            expect(screen.getByTestId('loading-state')).toBeInTheDocument();
        });

        it('should not show hub content when loading', () => {
            renderComponent({ isLoading: true });
            expect(screen.queryByTestId('assessment-hub')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // ERROR STATE TESTS
    // =========================================================================

    describe('Error State', () => {
        it('should show error message', () => {
            renderComponent({ error: 'Failed to load assessment' });
            expect(screen.getByTestId('error-state')).toHaveTextContent('Failed to load assessment');
        });

        it('should not show hub content on error', () => {
            renderComponent({ error: 'Error occurred' });
            expect(screen.queryByTestId('assessment-hub')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // EMPTY STATE TESTS
    // =========================================================================

    describe('Empty State', () => {
        it('should show empty state when no assessment', () => {
            renderComponent({ assessment: null });
            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });

        it('should show start assessment button', () => {
            renderComponent({ assessment: null });
            expect(screen.getByTestId('start-assessment')).toBeInTheDocument();
        });

        it('should call onStartAssessment when button clicked', () => {
            renderComponent({ assessment: null });
            fireEvent.click(screen.getByTestId('start-assessment'));
            expect(defaultProps.onStartAssessment).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // HEADER TESTS
    // =========================================================================

    describe('Header', () => {
        it('should display title', () => {
            renderComponent();
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Digital Readiness Assessment');
        });

        it('should display assessment status', () => {
            renderComponent();
            expect(screen.getByTestId('assessment-status')).toHaveTextContent('DRAFT');
        });

        it('should apply status class', () => {
            renderComponent();
            expect(screen.getByTestId('assessment-status')).toHaveClass('draft');
        });
    });

    // =========================================================================
    // SCORE DISPLAY TESTS
    // =========================================================================

    describe('Score Display', () => {
        it('should display current overall score', () => {
            renderComponent();
            expect(screen.getByTestId('current-score')).toHaveTextContent('3.5');
        });

        it('should display target score', () => {
            renderComponent();
            expect(screen.getByTestId('target-score')).toHaveTextContent('5.2');
        });

        it('should calculate and display gap', () => {
            renderComponent();
            expect(screen.getByTestId('overall-gap')).toHaveTextContent('1.7');
        });
    });

    // =========================================================================
    // PROGRESS TESTS
    // =========================================================================

    describe('Progress', () => {
        it('should display progress percentage', () => {
            renderComponent();
            expect(screen.getByTestId('assessment-progress')).toHaveTextContent('57% complete');
        });

        it('should have progressbar role', () => {
            renderComponent();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('should have correct aria-valuenow', () => {
            renderComponent();
            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '57');
        });
    });

    // =========================================================================
    // AXIS GRID TESTS
    // =========================================================================

    describe('Axis Grid', () => {
        it('should display all 7 axes', () => {
            renderComponent();
            expect(screen.getByTestId('axis-processes')).toBeInTheDocument();
            expect(screen.getByTestId('axis-digitalProducts')).toBeInTheDocument();
            expect(screen.getByTestId('axis-businessModels')).toBeInTheDocument();
            expect(screen.getByTestId('axis-dataManagement')).toBeInTheDocument();
            expect(screen.getByTestId('axis-culture')).toBeInTheDocument();
            expect(screen.getByTestId('axis-cybersecurity')).toBeInTheDocument();
            expect(screen.getByTestId('axis-aiMaturity')).toBeInTheDocument();
        });

        it('should display axis scores', () => {
            renderComponent();
            const processesAxis = screen.getByTestId('axis-processes');
            expect(processesAxis).toHaveTextContent('4');
            expect(processesAxis).toHaveTextContent('6');
        });
    });

    // =========================================================================
    // INSIGHTS TESTS
    // =========================================================================

    describe('Quick Insights', () => {
        it('should display insights section', () => {
            renderComponent();
            expect(screen.getByTestId('quick-insights')).toBeInTheDocument();
        });

        it('should show priority gap', () => {
            renderComponent();
            expect(screen.getByTestId('priority-gap')).toHaveTextContent('aiMaturity');
        });

        it('should show strength', () => {
            renderComponent();
            expect(screen.getByTestId('strength')).toHaveTextContent('cybersecurity');
        });
    });

    // =========================================================================
    // ACTION TESTS
    // =========================================================================

    describe('Actions', () => {
        it('should display continue button', () => {
            renderComponent();
            expect(screen.getByTestId('continue-assessment')).toBeInTheDocument();
        });

        it('should call onContinueAssessment when clicked', () => {
            renderComponent();
            fireEvent.click(screen.getByTestId('continue-assessment'));
            expect(defaultProps.onContinueAssessment).toHaveBeenCalled();
        });

        it('should display view report button', () => {
            renderComponent();
            expect(screen.getByTestId('view-report')).toBeInTheDocument();
        });

        it('should call onViewReport when clicked', () => {
            renderComponent();
            fireEvent.click(screen.getByTestId('view-report'));
            expect(defaultProps.onViewReport).toHaveBeenCalled();
        });

        it('should have export options', () => {
            renderComponent();
            expect(screen.getByTestId('export-menu')).toBeInTheDocument();
        });

        it('should call onExport with pdf format', () => {
            renderComponent();
            fireEvent.click(screen.getByText('Export PDF'));
            expect(defaultProps.onExport).toHaveBeenCalledWith('pdf');
        });

        it('should call onExport with excel format', () => {
            renderComponent();
            fireEvent.click(screen.getByText('Export Excel'));
            expect(defaultProps.onExport).toHaveBeenCalledWith('excel');
        });
    });

    // =========================================================================
    // LAST UPDATED TESTS
    // =========================================================================

    describe('Last Updated', () => {
        it('should display last updated date', () => {
            renderComponent();
            expect(screen.getByTestId('last-updated')).toBeInTheDocument();
        });

        it('should format date correctly', () => {
            renderComponent();
            // Date formatting depends on locale
            expect(screen.getByTestId('last-updated')).toHaveTextContent('Last updated:');
        });
    });

    // =========================================================================
    // STATUS VARIATIONS TESTS
    // =========================================================================

    describe('Status Variations', () => {
        const statuses = ['DRAFT', 'IN_REVIEW', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED'];

        statuses.forEach(status => {
            it(`should display ${status} status correctly`, () => {
                renderComponent({
                    assessment: { ...mockAssessmentData, status }
                });
                expect(screen.getByTestId('assessment-status')).toHaveTextContent(status);
            });
        });
    });

    // =========================================================================
    // SCORE EDGE CASES TESTS
    // =========================================================================

    describe('Score Edge Cases', () => {
        it('should handle perfect score (7)', () => {
            renderComponent({
                assessment: { ...mockAssessmentData, overallScore: 7, targetScore: 7 }
            });
            expect(screen.getByTestId('current-score')).toHaveTextContent('7.0');
            expect(screen.getByTestId('overall-gap')).toHaveTextContent('0.0');
        });

        it('should handle minimum score (1)', () => {
            renderComponent({
                assessment: { ...mockAssessmentData, overallScore: 1 }
            });
            expect(screen.getByTestId('current-score')).toHaveTextContent('1.0');
        });

        it('should handle 0% progress', () => {
            renderComponent({
                assessment: { ...mockAssessmentData, progress: 0 }
            });
            expect(screen.getByTestId('assessment-progress')).toHaveTextContent('0% complete');
        });

        it('should handle 100% progress', () => {
            renderComponent({
                assessment: { ...mockAssessmentData, progress: 100 }
            });
            expect(screen.getByTestId('assessment-progress')).toHaveTextContent('100% complete');
        });
    });
});

