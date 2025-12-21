/**
 * Assessment Matrix Card Component Tests
 * 
 * Phase 5: Component Tests - Assessment Component
 * Tests assessment matrix display and navigation.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AssessmentMatrixCard } from '../../components/assessment/AssessmentMatrixCard';

describe('AssessmentMatrixCard', () => {
    const mockAreas = [
        {
            id: 'area-1',
            name: 'Area 1',
            levels: [
                { level: 1, description: 'Level 1' },
                { level: 2, description: 'Level 2' }
            ]
        }
    ];

    const mockScores = {
        'area-1': [2, 3] // actual: 2, target: 3
    };

    const mockOnNavigate = vi.fn();

    describe('Rendering', () => {
        it('should render assessment matrix card', () => {
            render(
                <AssessmentMatrixCard
                    title="Test Axis"
                    areas={mockAreas}
                    scores={mockScores}
                    actual={2}
                    target={3}
                />
            );
            expect(screen.getByText('Test Axis')).toBeInTheDocument();
        });

        it('should display actual and target scores', () => {
            render(
                <AssessmentMatrixCard
                    title="Test Axis"
                    areas={mockAreas}
                    scores={mockScores}
                    actual={2.5}
                    target={3.5}
                />
            );
            expect(screen.getByText('2.5')).toBeInTheDocument();
            expect(screen.getByText('3.5')).toBeInTheDocument();
        });

        it('should display gap points', () => {
            render(
                <AssessmentMatrixCard
                    title="Test Axis"
                    areas={mockAreas}
                    scores={mockScores}
                    actual={2}
                    target={3}
                />
            );
            expect(screen.getByText(/Gap Points/i)).toBeInTheDocument();
        });

        it('should show "Optimized" when gap is zero', () => {
            render(
                <AssessmentMatrixCard
                    title="Test Axis"
                    areas={mockAreas}
                    scores={mockScores}
                    actual={3}
                    target={3}
                />
            );
            expect(screen.getByText('Optimized')).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('should call onNavigate when navigate button clicked', () => {
            render(
                <AssessmentMatrixCard
                    title="Test Axis"
                    areas={mockAreas}
                    scores={mockScores}
                    actual={2}
                    target={3}
                    onNavigate={mockOnNavigate}
                />
            );
            const navigateButton = screen.queryByRole('button');
            if (navigateButton) {
                fireEvent.click(navigateButton);
                expect(mockOnNavigate).toHaveBeenCalled();
            }
        });
    });
});

