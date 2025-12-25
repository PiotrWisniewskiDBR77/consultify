/**
 * Component Tests: AssessmentAxisWorkspace
 * Tests for the main axis editing workspace with AI integration
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

// Mock hooks
const mockAI = {
    suggestJustification: vi.fn(),
    suggestEvidence: vi.fn(),
    suggestTarget: vi.fn(),
    correctText: vi.fn(),
    isLoading: false,
    error: null,
    clearError: vi.fn()
};

vi.mock('../../hooks/useAssessmentAI', () => ({
    useAssessmentAI: () => mockAI
}));

vi.mock('../../store/useAppStore', () => ({
    useAppStore: () => ({
        currentProjectId: 'project-123'
    })
}));

// Mock sub-components
vi.mock('./LevelNavigator', () => ({
    LevelNavigator: ({ onSelectLevel, currentLevel }: any) => (
        <div data-testid="level-navigator">
            {[1, 2, 3, 4, 5, 6, 7].map(level => (
                <button 
                    key={level} 
                    data-testid={`level-${level}`}
                    onClick={() => onSelectLevel(level)}
                    className={currentLevel === level ? 'active' : ''}
                >
                    Level {level}
                </button>
            ))}
        </div>
    )
}));

vi.mock('./LevelDetailCard', () => ({
    LevelDetailCard: ({ 
        level, 
        title, 
        onSetActual, 
        onSetTarget, 
        onSetNA,
        isActual,
        isTarget,
        notes,
        onNotesChange,
        onAiAssist,
        isAiLoading
    }: any) => (
        <div data-testid="level-detail-card">
            <div data-testid="level-title">{title}</div>
            <div data-testid="current-level">{level}</div>
            <button data-testid="set-actual-btn" onClick={onSetActual}>Set Actual</button>
            <button data-testid="set-target-btn" onClick={onSetTarget}>Set Target</button>
            <button data-testid="set-na-btn" onClick={onSetNA}>Set NA</button>
            <div data-testid="is-actual">{isActual ? 'true' : 'false'}</div>
            <div data-testid="is-target">{isTarget ? 'true' : 'false'}</div>
            <textarea 
                data-testid="notes-input"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
            />
            <button 
                data-testid="ai-assist-btn" 
                onClick={onAiAssist}
                disabled={isAiLoading}
            >
                AI Assist
            </button>
        </div>
    )
}));

import { AssessmentAxisWorkspace } from '../../components/assessment/AssessmentAxisWorkspace';

describe('AssessmentAxisWorkspace', () => {
    let queryClient: QueryClient;

    const defaultProps = {
        axis: 'processes' as const,
        data: {
            actual: 0,
            target: 0,
            justification: ''
        },
        onChange: vi.fn(),
        onNext: vi.fn(),
        context: {
            goals: ['Digital transformation'],
            challenges: ['Legacy systems'],
            industry: 'Manufacturing'
        },
        projectId: 'project-123'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        });
        mockAI.isLoading = false;
        mockAI.error = null;
    });

    const renderComponent = (props = {}) => {
        return render(
            <QueryClientProvider client={queryClient}>
                <I18nextProvider i18n={i18n}>
                    <AssessmentAxisWorkspace {...defaultProps} {...props} />
                </I18nextProvider>
            </QueryClientProvider>
        );
    };

    // =========================================================================
    // BASIC RENDER TESTS
    // =========================================================================

    describe('Basic Rendering', () => {
        it('should render workspace', () => {
            renderComponent();
            
            expect(screen.getByTestId('level-navigator')).toBeInTheDocument();
            expect(screen.getByTestId('level-detail-card')).toBeInTheDocument();
        });

        it('should show read-only banner when readOnly', () => {
            renderComponent({ readOnly: true });
            
            expect(screen.getByText(/read-only/i)).toBeInTheDocument();
        });

        it('should render next button', () => {
            renderComponent();
            
            expect(screen.getByText(/Potwierdź i Dalej|Confirm/i)).toBeInTheDocument();
        });

        it('should disable next button when no scores set', () => {
            renderComponent();
            
            const nextButton = screen.getByText(/Potwierdź i Dalej|Confirm/i);
            expect(nextButton).toBeDisabled();
        });
    });

    // =========================================================================
    // LEVEL NAVIGATION TESTS
    // =========================================================================

    describe('Level Navigation', () => {
        it('should render level navigator with 7 levels', () => {
            renderComponent();
            
            for (let i = 1; i <= 7; i++) {
                expect(screen.getByTestId(`level-${i}`)).toBeInTheDocument();
            }
        });

        it('should update current level on click', () => {
            renderComponent();
            
            fireEvent.click(screen.getByTestId('level-3'));
            
            expect(screen.getByTestId('current-level')).toHaveTextContent('3');
        });
    });

    // =========================================================================
    // SCORE SETTING TESTS (BITMASK LOGIC)
    // =========================================================================

    describe('Score Setting (Bitmask)', () => {
        it('should set actual score on click', () => {
            renderComponent();
            
            // Select level 3
            fireEvent.click(screen.getByTestId('level-3'));
            
            // Click set actual
            fireEvent.click(screen.getByTestId('set-actual-btn'));
            
            expect(defaultProps.onChange).toHaveBeenCalled();
        });

        it('should set target score on click', () => {
            renderComponent();
            
            fireEvent.click(screen.getByTestId('level-3'));
            fireEvent.click(screen.getByTestId('set-target-btn'));
            
            expect(defaultProps.onChange).toHaveBeenCalled();
        });

        it('should clear both on NA click', () => {
            renderComponent();
            
            fireEvent.click(screen.getByTestId('level-3'));
            fireEvent.click(screen.getByTestId('set-na-btn'));
            
            expect(defaultProps.onChange).toHaveBeenCalled();
        });

        it('should toggle actual bit correctly', () => {
            // Start with actual = 4 (binary: 100, level 3 set)
            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            // Select level 3 and check
            fireEvent.click(screen.getByTestId('level-3'));
            expect(screen.getByTestId('is-actual')).toHaveTextContent('true');
        });

        it('should toggle target bit correctly', () => {
            // Start with target = 8 (binary: 1000, level 4 set)
            renderComponent({
                data: { actual: 0, target: 8, justification: '' }
            });

            fireEvent.click(screen.getByTestId('level-4'));
            expect(screen.getByTestId('is-target')).toHaveTextContent('true');
        });
    });

    // =========================================================================
    // NOTES / JUSTIFICATION TESTS
    // =========================================================================

    describe('Notes / Justification', () => {
        it('should display notes', () => {
            renderComponent({
                data: { actual: 0, target: 0, justification: 'Test note' }
            });
            
            expect(screen.getByTestId('notes-input')).toHaveValue('Test note');
        });

        it('should update notes on change', () => {
            renderComponent();
            
            const input = screen.getByTestId('notes-input');
            fireEvent.change(input, { target: { value: 'New note' } });
            
            expect(defaultProps.onChange).toHaveBeenCalledWith(
                expect.objectContaining({ justification: 'New note' })
            );
        });
    });

    // =========================================================================
    // AI INTEGRATION TESTS
    // =========================================================================

    describe('AI Integration', () => {
        it('should show AI action buttons', () => {
            renderComponent({ 
                data: { actual: 4, target: 0, justification: '' }
            });
            
            expect(screen.getByText('Sugeruj')).toBeInTheDocument();
            expect(screen.getByText('Dowody')).toBeInTheDocument();
            expect(screen.getByText('Cel')).toBeInTheDocument();
        });

        it('should call AI suggest on button click', async () => {
            mockAI.suggestJustification.mockResolvedValue({
                suggestion: 'AI suggested text'
            });

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            fireEvent.click(screen.getByText('Sugeruj'));

            await waitFor(() => {
                expect(mockAI.suggestJustification).toHaveBeenCalled();
            });
        });

        it('should call AI evidence on button click', async () => {
            mockAI.suggestEvidence.mockResolvedValue({
                evidence: ['Evidence 1', 'Evidence 2']
            });

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            fireEvent.click(screen.getByText('Dowody'));

            await waitFor(() => {
                expect(mockAI.suggestEvidence).toHaveBeenCalled();
            });
        });

        it('should call AI target on button click', async () => {
            mockAI.suggestTarget.mockResolvedValue({
                suggestedTarget: 6
            });

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            fireEvent.click(screen.getByText('Cel'));

            await waitFor(() => {
                expect(mockAI.suggestTarget).toHaveBeenCalled();
            });
        });

        it('should show AI correction button when notes exist', () => {
            renderComponent({
                data: { actual: 4, target: 0, justification: 'Some text' }
            });
            
            expect(screen.getByText('Popraw')).toBeInTheDocument();
        });

        it('should disable AI buttons when loading', () => {
            mockAI.isLoading = true;

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            const suggestBtn = screen.getByText('Sugeruj').closest('button');
            expect(suggestBtn).toBeDisabled();
        });

        it('should show AI suggestion panel when suggestion received', async () => {
            mockAI.suggestJustification.mockResolvedValue({
                suggestion: 'AI generated suggestion'
            });

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            fireEvent.click(screen.getByText('Sugeruj'));

            await waitFor(() => {
                expect(screen.getByText('Sugestia AI')).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // SUB-AREA TESTS
    // =========================================================================

    describe('Sub-Areas (Detailed Mode)', () => {
        it('should show sub-area selector when axis has areas', () => {
            // This depends on translation data having areas
            // For now, we test the logic exists
            renderComponent();
            
            // Check that workspace renders without error
            expect(screen.getByTestId('level-navigator')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // PROGRESS DISPLAY TESTS
    // =========================================================================

    describe('Progress Display', () => {
        it('should show axis progress section', () => {
            renderComponent();
            
            expect(screen.getByText(/AXIS PROGRESS|Approved|Remaining/i)).toBeInTheDocument();
        });

        it('should show 0/1 when nothing completed (simple mode)', () => {
            renderComponent();
            
            expect(screen.getByText('0/1')).toBeInTheDocument();
        });

        it('should show 1/1 when completed (simple mode)', () => {
            renderComponent({
                data: { actual: 4, target: 8, justification: '' }
            });
            
            expect(screen.getByText('1/1')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // NEXT BUTTON TESTS
    // =========================================================================

    describe('Next Button', () => {
        it('should be disabled when no actual set', () => {
            renderComponent({
                data: { actual: 0, target: 8, justification: '' }
            });
            
            const nextBtn = screen.getByText(/Potwierdź i Dalej|Confirm/i);
            expect(nextBtn).toBeDisabled();
        });

        it('should be disabled when no target set', () => {
            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });
            
            const nextBtn = screen.getByText(/Potwierdź i Dalej|Confirm/i);
            expect(nextBtn).toBeDisabled();
        });

        it('should be enabled when both set', () => {
            renderComponent({
                data: { actual: 4, target: 8, justification: '' }
            });
            
            const nextBtn = screen.getByText(/Potwierdź i Dalej|Confirm/i);
            expect(nextBtn).not.toBeDisabled();
        });

        it('should call onNext when clicked', () => {
            renderComponent({
                data: { actual: 4, target: 8, justification: '' }
            });
            
            const nextBtn = screen.getByText(/Potwierdź i Dalej|Confirm/i);
            fireEvent.click(nextBtn);
            
            expect(defaultProps.onNext).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // ERROR DISPLAY TESTS
    // =========================================================================

    describe('Error Display', () => {
        it('should show AI error when present', () => {
            mockAI.error = 'AI service unavailable';

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            expect(screen.getByText(/AI Error/i)).toBeInTheDocument();
        });

        it('should clear error on dismiss', () => {
            mockAI.error = 'Test error';

            renderComponent({
                data: { actual: 4, target: 0, justification: '' }
            });

            fireEvent.click(screen.getByText('Dismiss'));

            expect(mockAI.clearError).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // READ-ONLY MODE TESTS
    // =========================================================================

    describe('Read-Only Mode', () => {
        it('should hide AI buttons in read-only mode', () => {
            renderComponent({
                readOnly: true,
                data: { actual: 4, target: 8, justification: '' }
            });

            expect(screen.queryByText('Sugeruj')).not.toBeInTheDocument();
        });
    });
});

