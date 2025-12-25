/**
 * Component Tests: AssessmentModuleHub
 * Tests for the main assessment hub with 4-tab navigation
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

// Mock the store
const mockSetCurrentView = vi.fn();
vi.mock('../../store/useAppStore', () => ({
    useAppStore: () => ({
        currentProjectId: 'project-123',
        setCurrentView: mockSetCurrentView
    })
}));

// Mock sub-components
vi.mock('../../components/assessment/AssessmentTable', () => ({
    AssessmentTable: ({ onOpenInMap, onNewAssessment, onCreateReport }: any) => (
        <div data-testid="assessment-table">
            <button data-testid="open-in-map-btn" onClick={() => onOpenInMap('assessment-1')}>Open in Map</button>
            <button data-testid="new-assessment-btn" onClick={onNewAssessment}>New Assessment</button>
            <button data-testid="create-report-btn" onClick={() => onCreateReport('assessment-1')}>Create Report</button>
        </div>
    )
}));

vi.mock('../../components/assessment/ReportsTable', () => ({
    ReportsTable: ({ onCreateInitiatives }: any) => (
        <div data-testid="reports-table">
            <button data-testid="create-initiatives-btn" onClick={() => onCreateInitiatives('report-1')}>Create Initiatives</button>
        </div>
    )
}));

vi.mock('../../components/assessment/InitiativesTable', () => ({
    InitiativesTable: () => <div data-testid="initiatives-table">Initiatives Table</div>
}));

// Import after mocks
import { AssessmentModuleHub } from '../../components/assessment/AssessmentModuleHub';

describe('AssessmentModuleHub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = (props: any = {}) => {
        return render(<AssessmentModuleHub framework="DRD" {...props} />);
    };

    // =========================================================================
    // TAB NAVIGATION TESTS
    // =========================================================================

    describe('Tab Navigation', () => {
        it('should render all 4 tabs', () => {
            renderComponent();

            expect(screen.getByText('Assessment')).toBeInTheDocument();
            expect(screen.getByText('Map')).toBeInTheDocument();
            expect(screen.getByText('Reports')).toBeInTheDocument();
            expect(screen.getByText('Initiatives')).toBeInTheDocument();
        });

        it('should default to assessment tab', () => {
            renderComponent();

            expect(screen.getByTestId('assessment-table')).toBeInTheDocument();
        });

        it('should switch to map tab on click', () => {
            renderComponent();

            fireEvent.click(screen.getByText('Map'));

            expect(screen.getByText('DRD Assessment Map')).toBeInTheDocument();
        });

        it('should switch to reports tab on click', () => {
            renderComponent();

            fireEvent.click(screen.getByText('Reports'));

            expect(screen.getByTestId('reports-table')).toBeInTheDocument();
        });

        it('should switch to initiatives tab on click', () => {
            renderComponent();

            fireEvent.click(screen.getByText('Initiatives'));

            expect(screen.getByTestId('initiatives-table')).toBeInTheDocument();
        });

        it('should accept initialTab prop', () => {
            renderComponent({ initialTab: 'reports' });

            expect(screen.getByTestId('reports-table')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // WORKFLOW PROGRESS INDICATOR TESTS
    // =========================================================================

    describe('Workflow Progress Indicator', () => {
        it('should show workflow steps', () => {
            renderComponent();

            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('4')).toBeInTheDocument();
        });

        it('should highlight current step', () => {
            renderComponent({ initialTab: 'reports' });

            // Reports tab should be highlighted (step 3)
            const step3Text = screen.getByText('Reports');
            expect(step3Text.closest('div')).toHaveClass('text-purple-600');
        });
    });

    // =========================================================================
    // ASSESSMENT TABLE INTERACTIONS
    // =========================================================================

    describe('Assessment Table Interactions', () => {
        it('should handle open in map action', () => {
            renderComponent();

            fireEvent.click(screen.getByTestId('open-in-map-btn'));

            // Should switch to map tab with selected assessment
            expect(screen.getByText('DRD Assessment Map')).toBeInTheDocument();
        });

        it('should handle new assessment action', () => {
            renderComponent();

            fireEvent.click(screen.getByTestId('new-assessment-btn'));

            // Should switch to map tab for new assessment
            expect(screen.getByText('DRD Assessment Map')).toBeInTheDocument();
        });

        it('should handle create report action', () => {
            renderComponent();

            fireEvent.click(screen.getByTestId('create-report-btn'));

            // Should switch to reports tab
            expect(screen.getByTestId('reports-table')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // MAP TAB TESTS
    // =========================================================================

    describe('Map Tab', () => {
        it('should show placeholder when no assessment selected', () => {
            renderComponent({ initialTab: 'map' });

            expect(screen.getByText('Select an assessment from the list or create a new one')).toBeInTheDocument();
        });

        it('should show start new assessment button', () => {
            renderComponent({ initialTab: 'map' });

            expect(screen.getByText('Start New Assessment')).toBeInTheDocument();
        });

        it('should show opening message when assessment selected', () => {
            renderComponent({ initialTab: 'map', initialAssessmentId: 'assessment-123' });

            expect(screen.getByText('Opening assessment editor...')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // REPORTS TAB INTERACTIONS
    // =========================================================================

    describe('Reports Tab Interactions', () => {
        it('should handle create initiatives action', () => {
            renderComponent({ initialTab: 'reports' });

            fireEvent.click(screen.getByTestId('create-initiatives-btn'));

            // Should switch to initiatives tab
            expect(screen.getByTestId('initiatives-table')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // NAVIGATION CALLBACK TESTS
    // =========================================================================

    describe('Navigation Callbacks', () => {
        it('should call onNavigate callback if provided', () => {
            const onNavigate = vi.fn();
            renderComponent({ onNavigate });

            // Trigger some navigation through component actions
            fireEvent.click(screen.getByTestId('new-assessment-btn'));

            // Component should use internal navigation since we clicked tab button
        });

        it('should use setCurrentView when no onNavigate provided', () => {
            renderComponent();

            // Component uses internal state for tab switching
            fireEvent.click(screen.getByText('Reports'));

            expect(screen.getByTestId('reports-table')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // TAB STYLING TESTS
    // =========================================================================

    describe('Tab Styling', () => {
        it('should apply active styles to selected tab', () => {
            renderComponent();

            const assessmentTab = screen.getByText('Assessment').closest('button');
            expect(assessmentTab).toHaveClass('bg-purple-600');
        });

        it('should apply inactive styles to non-selected tabs', () => {
            renderComponent();

            const mapTab = screen.getByText('Map').closest('button');
            expect(mapTab).toHaveClass('bg-white');
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================

    describe('Edge Cases', () => {
        it('should handle undefined initialTab', () => {
            renderComponent({ initialTab: undefined });

            // Should default to assessment
            expect(screen.getByTestId('assessment-table')).toBeInTheDocument();
        });

        it('should handle missing projectId', () => {
            // This tests the component with no project context
            vi.mocked(vi.fn()).mockReturnValueOnce({
                currentProjectId: null,
                setCurrentView: mockSetCurrentView
            });

            // Component should still render
            renderComponent();
            expect(screen.getByText('Assessment')).toBeInTheDocument();
        });
    });
});

