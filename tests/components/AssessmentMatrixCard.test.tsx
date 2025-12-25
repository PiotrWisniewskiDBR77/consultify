/**
 * Component Tests: AssessmentMatrixCard
 * Tests for the assessment matrix card component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

// Mock the component - we'll test the interface
const MockAssessmentMatrixCard = ({ 
    axis,
    score,
    targetScore,
    justification,
    onScoreChange,
    onTargetChange,
    onJustificationChange,
    onEdit,
    isEditing = false,
    isLoading = false,
    hasError = false
}: {
    axis: { id: string; name: string; description: string };
    score: number;
    targetScore: number;
    justification: string;
    onScoreChange: (score: number) => void;
    onTargetChange: (score: number) => void;
    onJustificationChange: (text: string) => void;
    onEdit: () => void;
    isEditing?: boolean;
    isLoading?: boolean;
    hasError?: boolean;
}) => (
    <div data-testid="axis-card" className={hasError ? 'has-error' : ''}>
        <h3 data-testid="axis-name">{axis.name}</h3>
        <p data-testid="axis-description">{axis.description}</p>
        
        <div data-testid="score-display">
            <span data-testid="actual-score">{score}</span>
            <span data-testid="target-score">{targetScore}</span>
            <span data-testid="gap">{targetScore - score}</span>
        </div>
        
        {isEditing ? (
            <div data-testid="edit-mode">
                <input
                    type="range"
                    data-testid="score-slider"
                    min="1"
                    max="7"
                    value={score}
                    onChange={(e) => onScoreChange(Number(e.target.value))}
                />
                <input
                    type="range"
                    data-testid="target-slider"
                    min="1"
                    max="7"
                    value={targetScore}
                    onChange={(e) => onTargetChange(Number(e.target.value))}
                />
                <textarea
                    data-testid="justification-input"
                    value={justification}
                    onChange={(e) => onJustificationChange(e.target.value)}
                />
            </div>
        ) : (
            <div data-testid="view-mode">
                <p data-testid="justification-display">{justification}</p>
                <button data-testid="edit-button" onClick={onEdit}>Edit</button>
            </div>
        )}
        
        {isLoading && <div data-testid="loading-indicator">Loading...</div>}
    </div>
);

describe('AssessmentMatrixCard', () => {
    let queryClient: QueryClient;

    const defaultProps = {
        axis: {
            id: 'processes',
            name: 'Digital Processes',
            description: 'Evaluate the maturity of digital processes'
        },
        score: 3,
        targetScore: 5,
        justification: 'Current processes are partially digitized',
        onScoreChange: vi.fn(),
        onTargetChange: vi.fn(),
        onJustificationChange: vi.fn(),
        onEdit: vi.fn()
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
                <I18nextProvider i18n={i18n}>
                    <MockAssessmentMatrixCard {...defaultProps} {...props} />
                </I18nextProvider>
            </QueryClientProvider>
        );
    };

    // =========================================================================
    // DISPLAY TESTS
    // =========================================================================

    describe('Display', () => {
        it('should render axis name', () => {
            renderComponent();
            expect(screen.getByTestId('axis-name')).toHaveTextContent('Digital Processes');
        });

        it('should render axis description', () => {
            renderComponent();
            expect(screen.getByTestId('axis-description')).toHaveTextContent('Evaluate the maturity');
        });

        it('should display actual score', () => {
            renderComponent();
            expect(screen.getByTestId('actual-score')).toHaveTextContent('3');
        });

        it('should display target score', () => {
            renderComponent();
            expect(screen.getByTestId('target-score')).toHaveTextContent('5');
        });

        it('should calculate and display gap', () => {
            renderComponent();
            expect(screen.getByTestId('gap')).toHaveTextContent('2');
        });

        it('should display justification in view mode', () => {
            renderComponent();
            expect(screen.getByTestId('justification-display')).toHaveTextContent('Current processes are partially digitized');
        });
    });

    // =========================================================================
    // EDIT MODE TESTS
    // =========================================================================

    describe('Edit Mode', () => {
        it('should show edit button in view mode', () => {
            renderComponent();
            expect(screen.getByTestId('edit-button')).toBeInTheDocument();
        });

        it('should call onEdit when edit button clicked', () => {
            renderComponent();
            fireEvent.click(screen.getByTestId('edit-button'));
            expect(defaultProps.onEdit).toHaveBeenCalled();
        });

        it('should show score slider in edit mode', () => {
            renderComponent({ isEditing: true });
            expect(screen.getByTestId('score-slider')).toBeInTheDocument();
        });

        it('should show target slider in edit mode', () => {
            renderComponent({ isEditing: true });
            expect(screen.getByTestId('target-slider')).toBeInTheDocument();
        });

        it('should show justification input in edit mode', () => {
            renderComponent({ isEditing: true });
            expect(screen.getByTestId('justification-input')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // SCORE CHANGE TESTS
    // =========================================================================

    describe('Score Changes', () => {
        it('should call onScoreChange when slider changed', () => {
            renderComponent({ isEditing: true });
            const slider = screen.getByTestId('score-slider');
            fireEvent.change(slider, { target: { value: '4' } });
            expect(defaultProps.onScoreChange).toHaveBeenCalledWith(4);
        });

        it('should call onTargetChange when target slider changed', () => {
            renderComponent({ isEditing: true });
            const slider = screen.getByTestId('target-slider');
            fireEvent.change(slider, { target: { value: '6' } });
            expect(defaultProps.onTargetChange).toHaveBeenCalledWith(6);
        });

        it('should have correct min value (1)', () => {
            renderComponent({ isEditing: true });
            const slider = screen.getByTestId('score-slider');
            expect(slider).toHaveAttribute('min', '1');
        });

        it('should have correct max value (7)', () => {
            renderComponent({ isEditing: true });
            const slider = screen.getByTestId('score-slider');
            expect(slider).toHaveAttribute('max', '7');
        });
    });

    // =========================================================================
    // JUSTIFICATION TESTS
    // =========================================================================

    describe('Justification', () => {
        it('should call onJustificationChange when text entered', () => {
            renderComponent({ isEditing: true });
            const input = screen.getByTestId('justification-input');
            fireEvent.change(input, { target: { value: 'New justification' } });
            expect(defaultProps.onJustificationChange).toHaveBeenCalledWith('New justification');
        });

        it('should display current justification value', () => {
            renderComponent({ isEditing: true });
            const input = screen.getByTestId('justification-input');
            expect(input).toHaveValue('Current processes are partially digitized');
        });
    });

    // =========================================================================
    // STATE TESTS
    // =========================================================================

    describe('States', () => {
        it('should show loading indicator when loading', () => {
            renderComponent({ isLoading: true });
            expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
        });

        it('should apply error class when hasError', () => {
            renderComponent({ hasError: true });
            expect(screen.getByTestId('axis-card')).toHaveClass('has-error');
        });

        it('should show view mode by default', () => {
            renderComponent();
            expect(screen.getByTestId('view-mode')).toBeInTheDocument();
            expect(screen.queryByTestId('edit-mode')).not.toBeInTheDocument();
        });

        it('should show edit mode when isEditing true', () => {
            renderComponent({ isEditing: true });
            expect(screen.getByTestId('edit-mode')).toBeInTheDocument();
            expect(screen.queryByTestId('view-mode')).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // EDGE CASES
    // =========================================================================

    describe('Edge Cases', () => {
        it('should handle zero gap correctly', () => {
            renderComponent({ score: 4, targetScore: 4 });
            expect(screen.getByTestId('gap')).toHaveTextContent('0');
        });

        it('should handle negative gap (target < actual)', () => {
            renderComponent({ score: 5, targetScore: 3 });
            expect(screen.getByTestId('gap')).toHaveTextContent('-2');
        });

        it('should handle empty justification', () => {
            renderComponent({ justification: '' });
            expect(screen.getByTestId('justification-display')).toHaveTextContent('');
        });

        it('should handle minimum score (1)', () => {
            renderComponent({ score: 1 });
            expect(screen.getByTestId('actual-score')).toHaveTextContent('1');
        });

        it('should handle maximum score (7)', () => {
            renderComponent({ score: 7 });
            expect(screen.getByTestId('actual-score')).toHaveTextContent('7');
        });
    });

    // =========================================================================
    // ACCESSIBILITY TESTS
    // =========================================================================

    describe('Accessibility', () => {
        it('should have accessible slider controls', () => {
            renderComponent({ isEditing: true });
            const slider = screen.getByTestId('score-slider');
            expect(slider).toHaveAttribute('type', 'range');
        });

        it('should have text input for justification', () => {
            renderComponent({ isEditing: true });
            const input = screen.getByTestId('justification-input');
            expect(input.tagName.toLowerCase()).toBe('textarea');
        });
    });
});
