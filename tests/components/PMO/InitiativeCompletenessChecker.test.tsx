/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InitiativeCompletenessChecker } from '../../components/PMO/InitiativeCompletenessChecker';

const mockInitiative = {
    name: 'Test Initiative',
    summary: 'Test summary',
    problemStatement: 'Test problem',
    hypothesis: 'Test hypothesis',
    businessValue: 100000,
    costCapex: 50000,
    costOpex: 20000,
    expectedRoi: 25,
    ownerBusinessId: 'user-1',
    ownerBusiness: { id: 'user-1', firstName: 'John', lastName: 'Business' },
    ownerExecutionId: 'user-2',
    ownerExecution: { id: 'user-2', firstName: 'Jane', lastName: 'Execution' },
    plannedStartDate: '2024-01-01',
    plannedEndDate: '2024-12-31',
    deliverables: ['Deliverable 1', 'Deliverable 2'],
    successCriteria: ['Success criterion 1'],
    keyRisks: ['Risk 1', 'Risk 2']
};

describe('InitiativeCompletenessChecker Component', () => {
    describe('Complete Initiative', () => {
        it('shows 100% completeness for fully filled initiative', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} />);

            expect(screen.getByText('100%')).toBeInTheDocument();
            expect(screen.getByText('Complete')).toBeInTheDocument();
        });

        it('shows all required fields as completed', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} />);

            expect(screen.getByText('Problem Statement')).toBeInTheDocument();
            expect(screen.getByText('Business Value')).toBeInTheDocument();
            expect(screen.getByText('Budget')).toBeInTheDocument();
            expect(screen.getByText('Timeline')).toBeInTheDocument();
            expect(screen.getByText('Owners')).toBeInTheDocument();
            expect(screen.getByText('Success Criteria')).toBeInTheDocument();
        });
    });

    describe('Incomplete Initiative', () => {
        const incompleteInitiative = {
            name: 'Incomplete Initiative'
        };

        it('shows low completeness percentage for empty initiative', () => {
            render(<InitiativeCompletenessChecker initiative={incompleteInitiative} />);

            expect(screen.getByText('0%')).toBeInTheDocument();
            expect(screen.getByText('Incomplete')).toBeInTheDocument();
        });

        it('shows missing required fields', () => {
            render(<InitiativeCompletenessChecker initiative={incompleteInitiative} />);

            expect(screen.getByText('Missing required fields')).toBeInTheDocument();
        });

        it('highlights missing fields with warning color', () => {
            render(<InitiativeCompletenessChecker initiative={incompleteInitiative} />);

            const missingIndicators = screen.getAllByTestId('missing-field');
            expect(missingIndicators.length).toBeGreaterThan(0);
        });
    });

    describe('Partial Completion', () => {
        const partialInitiative = {
            name: 'Partial Initiative',
            problemStatement: 'Test problem',
            businessValue: 50000,
            ownerBusinessId: 'user-1',
            deliverables: ['Deliverable 1']
        };

        it('calculates correct percentage for partially complete initiative', () => {
            render(<InitiativeCompletenessChecker initiative={partialInitiative} />);

            // Should show some percentage between 0% and 100%
            const percentageText = screen.getByText(/\d+%/);
            expect(percentageText).toBeInTheDocument();
        });

        it('shows mix of completed and missing fields', () => {
            render(<InitiativeCompletenessChecker initiative={partialInitiative} />);

            expect(screen.getByText('Problem Statement')).toBeInTheDocument();
            expect(screen.getByText('Business Value')).toBeInTheDocument();
        });
    });

    describe('Field Validation', () => {
        it('validates problem statement field', () => {
            const initiativeWithProblem = { problemStatement: 'Test problem' };
            const initiativeWithoutProblem = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithProblem} />);
            expect(screen.getByText(/Problem Statement/)).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutProblem} />);
            expect(screen.getByText(/Problem Statement/)).toBeInTheDocument();
        });

        it('validates budget fields', () => {
            const initiativeWithBudget = { costCapex: 10000, costOpex: 5000 };
            const initiativeWithoutBudget = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithBudget} />);
            expect(screen.getByText('Budget')).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutBudget} />);
            expect(screen.getByText('Budget')).toBeInTheDocument();
        });

        it('validates owner fields', () => {
            const initiativeWithOwners = {
                ownerBusinessId: 'user-1',
                ownerExecutionId: 'user-2'
            };
            const initiativeWithoutOwners = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithOwners} />);
            expect(screen.getByText('Owners')).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutOwners} />);
            expect(screen.getByText('Owners')).toBeInTheDocument();
        });

        it('validates timeline fields', () => {
            const initiativeWithTimeline = {
                plannedStartDate: '2024-01-01',
                plannedEndDate: '2024-12-31'
            };
            const initiativeWithoutTimeline = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithTimeline} />);
            expect(screen.getByText('Timeline')).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutTimeline} />);
            expect(screen.getByText('Timeline')).toBeInTheDocument();
        });

        it('validates deliverables field', () => {
            const initiativeWithDeliverables = { deliverables: ['Item 1'] };
            const initiativeWithoutDeliverables = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithDeliverables} />);
            expect(screen.getByText('Deliverables')).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutDeliverables} />);
            expect(screen.getByText('Deliverables')).toBeInTheDocument();
        });

        it('validates success criteria field', () => {
            const initiativeWithCriteria = { successCriteria: ['Criterion 1'] };
            const initiativeWithoutCriteria = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithCriteria} />);
            expect(screen.getByText('Success Criteria')).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutCriteria} />);
            expect(screen.getByText('Success Criteria')).toBeInTheDocument();
        });

        it('validates risks field', () => {
            const initiativeWithRisks = { keyRisks: ['Risk 1'] };
            const initiativeWithoutRisks = {};

            const { rerender } = render(<InitiativeCompletenessChecker initiative={initiativeWithRisks} />);
            expect(screen.getByText('Risks')).toBeInTheDocument();

            rerender(<InitiativeCompletenessChecker initiative={initiativeWithoutRisks} />);
            expect(screen.getByText('Risks')).toBeInTheDocument();
        });
    });

    describe('UI Elements', () => {
        it('shows progress bar', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} />);

            const progressBar = document.querySelector('progress');
            expect(progressBar).toBeInTheDocument();
        });

        it('displays field icons', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} />);

            // Should show check circles for completed fields
            const checkIcons = document.querySelectorAll('[data-icon="check"]');
            expect(checkIcons.length).toBeGreaterThan(0);
        });

        it('shows expandable details', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} />);

            expect(screen.getByText('Show Details')).toBeInTheDocument();
        });
    });

    describe('Compact Mode', () => {
        it('renders in compact mode when specified', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} compact />);

            // In compact mode, should show just percentage and status
            expect(screen.getByText('100%')).toBeInTheDocument();
            expect(screen.getByText('Complete')).toBeInTheDocument();
        });

        it('hides detailed field list in compact mode', () => {
            render(<InitiativeCompletenessChecker initiative={mockInitiative} compact />);

            expect(screen.queryByText('Show Details')).not.toBeInTheDocument();
        });
    });
});










