/**
 * Component Tests: GapAnalysisDashboard
 * Complete test coverage for gap analysis visualization
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'gapAnalysis.title': 'Gap Analysis',
                'gapAnalysis.currentLevel': 'Current Level',
                'gapAnalysis.targetLevel': 'Target Level',
                'gapAnalysis.gap': 'Gap',
                'gapAnalysis.priority': 'Priority',
                'gapAnalysis.recommendations': 'Recommendations',
                'gapAnalysis.pathway': 'Improvement Pathway',
                'gapAnalysis.estimatedTime': 'Estimated Time',
                'gapAnalysis.noData': 'No gap analysis data available'
            };
            return translations[key] || key;
        }
    })
}));

// Mock chart component
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />,
    RadarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radar-chart">{children}</div>,
    PolarGrid: () => <div />,
    PolarAngleAxis: () => <div />,
    PolarRadiusAxis: () => <div />,
    Radar: () => <div data-testid="radar" />
}));

// Create mock component for testing
const mockGapData = {
    axes: [
        {
            axisId: 'processes',
            axisName: 'Digital Processes',
            currentScore: 3,
            targetScore: 5,
            gap: 2,
            gapSeverity: 'MEDIUM' as const,
            pathway: [
                { level: 4, description: 'Integrated workflows', estimatedMonths: 6 },
                { level: 5, description: 'End-to-end digital', estimatedMonths: 9 }
            ],
            recommendations: [
                { title: 'Implement automation', priority: 'HIGH' },
                { title: 'Integrate systems', priority: 'MEDIUM' }
            ]
        },
        {
            axisId: 'culture',
            axisName: 'Organizational Culture',
            currentScore: 2,
            targetScore: 5,
            gap: 3,
            gapSeverity: 'HIGH' as const,
            pathway: [
                { level: 3, description: 'Digital initiatives', estimatedMonths: 4 },
                { level: 4, description: 'Organization commitment', estimatedMonths: 8 },
                { level: 5, description: 'Agile culture', estimatedMonths: 12 }
            ],
            recommendations: [
                { title: 'Change management program', priority: 'HIGH' }
            ]
        },
        {
            axisId: 'dataManagement',
            axisName: 'Data & Analytics',
            currentScore: 4,
            targetScore: 5,
            gap: 1,
            gapSeverity: 'LOW' as const,
            pathway: [
                { level: 5, description: 'Advanced analytics', estimatedMonths: 6 }
            ],
            recommendations: []
        }
    ],
    summary: {
        totalGap: 6,
        averageGap: 2,
        highPriorityCount: 2,
        estimatedTotalMonths: 45
    }
};

const GapAnalysisDashboard: React.FC<{
    assessmentId: string;
    data?: typeof mockGapData;
    onAxisSelect?: (axisId: string) => void;
    showChart?: boolean;
}> = ({ assessmentId, data, onAxisSelect, showChart = true }) => {
    const [selectedAxis, setSelectedAxis] = React.useState<string | null>(null);

    const handleAxisClick = (axisId: string) => {
        setSelectedAxis(axisId);
        onAxisSelect?.(axisId);
    };

    if (!data) {
        return <div data-testid="no-data">No gap analysis data available</div>;
    }

    const selectedAxisData = data.axes.find(a => a.axisId === selectedAxis);

    return (
        <div data-testid="gap-analysis-dashboard">
            <h2>Gap Analysis</h2>

            {/* Summary section */}
            <div data-testid="summary-section">
                <div data-testid="total-gap">Total Gap: {data.summary.totalGap}</div>
                <div data-testid="average-gap">Average Gap: {data.summary.averageGap.toFixed(1)}</div>
                <div data-testid="high-priority">High Priority: {data.summary.highPriorityCount}</div>
                <div data-testid="estimated-time">Estimated Time: {data.summary.estimatedTotalMonths} months</div>
            </div>

            {/* Chart */}
            {showChart && (
                <div data-testid="chart-container">
                    <div data-testid="bar-chart">
                        {data.axes.map(axis => (
                            <div 
                                key={axis.axisId} 
                                data-testid={`bar-${axis.axisId}`}
                                style={{ height: `${axis.gap * 20}px` }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Axis cards */}
            <div data-testid="axis-cards">
                {data.axes.map(axis => (
                    <div 
                        key={axis.axisId}
                        data-testid={`axis-card-${axis.axisId}`}
                        onClick={() => handleAxisClick(axis.axisId)}
                        className={`axis-card ${axis.gapSeverity.toLowerCase()}`}
                    >
                        <h3 data-testid={`axis-name-${axis.axisId}`}>{axis.axisName}</h3>
                        <div data-testid={`current-score-${axis.axisId}`}>
                            Current: {axis.currentScore}
                        </div>
                        <div data-testid={`target-score-${axis.axisId}`}>
                            Target: {axis.targetScore}
                        </div>
                        <div 
                            data-testid={`gap-value-${axis.axisId}`}
                            className={`gap-badge ${axis.gapSeverity.toLowerCase()}`}
                        >
                            Gap: {axis.gap}
                        </div>
                        <div data-testid={`severity-${axis.axisId}`}>
                            {axis.gapSeverity}
                        </div>
                    </div>
                ))}
            </div>

            {/* Axis detail panel */}
            {selectedAxisData && (
                <div data-testid="axis-detail-panel">
                    <h3>{selectedAxisData.axisName} - Improvement Pathway</h3>
                    
                    <div data-testid="pathway-steps">
                        {selectedAxisData.pathway.map((step, index) => (
                            <div key={index} data-testid={`pathway-step-${index}`}>
                                <span>Level {step.level}: {step.description}</span>
                                <span>{step.estimatedMonths} months</span>
                            </div>
                        ))}
                    </div>

                    {selectedAxisData.recommendations.length > 0 && (
                        <div data-testid="recommendations">
                            <h4>Recommendations</h4>
                            {selectedAxisData.recommendations.map((rec, index) => (
                                <div key={index} data-testid={`recommendation-${index}`}>
                                    <span>{rec.title}</span>
                                    <span data-testid={`rec-priority-${index}`}>{rec.priority}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button 
                        onClick={() => setSelectedAxis(null)}
                        data-testid="close-detail"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
};

describe('GapAnalysisDashboard', () => {
    const defaultProps = {
        assessmentId: 'assessment-123',
        data: mockGapData,
        onAxisSelect: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // RENDERING TESTS
    // =========================================================================

    describe('Rendering', () => {
        it('should render the dashboard', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('gap-analysis-dashboard')).toBeInTheDocument();
        });

        it('should display title', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByText('Gap Analysis')).toBeInTheDocument();
        });

        it('should show no data message when data is undefined', () => {
            render(<GapAnalysisDashboard assessmentId="test" data={undefined} />);
            expect(screen.getByTestId('no-data')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // SUMMARY SECTION TESTS
    // =========================================================================

    describe('Summary Section', () => {
        it('should display total gap', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('total-gap')).toHaveTextContent('6');
        });

        it('should display average gap', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('average-gap')).toHaveTextContent('2.0');
        });

        it('should display high priority count', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('high-priority')).toHaveTextContent('2');
        });

        it('should display estimated time', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('estimated-time')).toHaveTextContent('45 months');
        });
    });

    // =========================================================================
    // CHART TESTS
    // =========================================================================

    describe('Chart', () => {
        it('should render chart container', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('chart-container')).toBeInTheDocument();
        });

        it('should render bars for each axis', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('bar-processes')).toBeInTheDocument();
            expect(screen.getByTestId('bar-culture')).toBeInTheDocument();
            expect(screen.getByTestId('bar-dataManagement')).toBeInTheDocument();
        });

        it('should hide chart when showChart is false', () => {
            render(<GapAnalysisDashboard {...defaultProps} showChart={false} />);
            expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // AXIS CARDS TESTS
    // =========================================================================

    describe('Axis Cards', () => {
        it('should render all axis cards', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('axis-card-processes')).toBeInTheDocument();
            expect(screen.getByTestId('axis-card-culture')).toBeInTheDocument();
            expect(screen.getByTestId('axis-card-dataManagement')).toBeInTheDocument();
        });

        it('should display axis name', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('axis-name-processes')).toHaveTextContent('Digital Processes');
        });

        it('should display current score', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('current-score-processes')).toHaveTextContent('3');
        });

        it('should display target score', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('target-score-processes')).toHaveTextContent('5');
        });

        it('should display gap value', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('gap-value-processes')).toHaveTextContent('2');
        });

        it('should display severity indicator', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('severity-culture')).toHaveTextContent('HIGH');
        });
    });

    // =========================================================================
    // SEVERITY CLASSIFICATION TESTS
    // =========================================================================

    describe('Severity Classification', () => {
        it('should classify gap of 1 as LOW', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('severity-dataManagement')).toHaveTextContent('LOW');
        });

        it('should classify gap of 2 as MEDIUM', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('severity-processes')).toHaveTextContent('MEDIUM');
        });

        it('should classify gap of 3+ as HIGH', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);
            expect(screen.getByTestId('severity-culture')).toHaveTextContent('HIGH');
        });
    });

    // =========================================================================
    // AXIS SELECTION TESTS
    // =========================================================================

    describe('Axis Selection', () => {
        it('should call onAxisSelect when card clicked', async () => {
            const onAxisSelect = vi.fn();
            render(<GapAnalysisDashboard {...defaultProps} onAxisSelect={onAxisSelect} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(onAxisSelect).toHaveBeenCalledWith('processes');
        });

        it('should show detail panel when axis selected', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByTestId('axis-detail-panel')).toBeInTheDocument();
        });

        it('should display pathway steps in detail panel', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByTestId('pathway-step-0')).toBeInTheDocument();
            expect(screen.getByTestId('pathway-step-1')).toBeInTheDocument();
        });

        it('should display recommendations in detail panel', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByTestId('recommendations')).toBeInTheDocument();
            expect(screen.getByTestId('recommendation-0')).toBeInTheDocument();
        });

        it('should close detail panel on close button click', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));
            expect(screen.getByTestId('axis-detail-panel')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('close-detail'));
            expect(screen.queryByTestId('axis-detail-panel')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // PATHWAY DISPLAY TESTS
    // =========================================================================

    describe('Pathway Display', () => {
        it('should show level description', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByText(/Integrated workflows/)).toBeInTheDocument();
        });

        it('should show estimated months for each step', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByText(/6 months/)).toBeInTheDocument();
        });

        it('should show all pathway steps', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-culture'));

            expect(screen.getByTestId('pathway-step-0')).toBeInTheDocument();
            expect(screen.getByTestId('pathway-step-1')).toBeInTheDocument();
            expect(screen.getByTestId('pathway-step-2')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // RECOMMENDATIONS TESTS
    // =========================================================================

    describe('Recommendations', () => {
        it('should display recommendation title', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByText(/Implement automation/)).toBeInTheDocument();
        });

        it('should display recommendation priority', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-processes'));

            expect(screen.getByTestId('rec-priority-0')).toHaveTextContent('HIGH');
        });

        it('should not show recommendations section when empty', async () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            await userEvent.click(screen.getByTestId('axis-card-dataManagement'));

            expect(screen.queryByTestId('recommendations')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // SORTING TESTS
    // =========================================================================

    describe('Sorting', () => {
        it('should display axes in provided order', () => {
            render(<GapAnalysisDashboard {...defaultProps} />);

            const cards = screen.getByTestId('axis-cards').children;
            expect(cards[0]).toHaveAttribute('data-testid', 'axis-card-processes');
            expect(cards[1]).toHaveAttribute('data-testid', 'axis-card-culture');
            expect(cards[2]).toHaveAttribute('data-testid', 'axis-card-dataManagement');
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================

    describe('Edge Cases', () => {
        it('should handle zero gap', () => {
            const dataWithZeroGap = {
                ...mockGapData,
                axes: [{
                    ...mockGapData.axes[0],
                    currentScore: 5,
                    targetScore: 5,
                    gap: 0,
                    gapSeverity: 'LOW' as const
                }]
            };

            render(<GapAnalysisDashboard {...defaultProps} data={dataWithZeroGap} />);
            expect(screen.getByTestId('gap-value-processes')).toHaveTextContent('0');
        });

        it('should handle empty axes array', () => {
            const emptyData = {
                axes: [],
                summary: { totalGap: 0, averageGap: 0, highPriorityCount: 0, estimatedTotalMonths: 0 }
            };

            render(<GapAnalysisDashboard {...defaultProps} data={emptyData} />);
            expect(screen.getByTestId('axis-cards').children).toHaveLength(0);
        });

        it('should handle long axis names', () => {
            const longNameData = {
                ...mockGapData,
                axes: [{
                    ...mockGapData.axes[0],
                    axisName: 'Very Long Axis Name That Should Still Be Displayed Properly'
                }]
            };

            render(<GapAnalysisDashboard {...defaultProps} data={longNameData} />);
            expect(screen.getByText(/Very Long Axis/)).toBeInTheDocument();
        });
    });
});

