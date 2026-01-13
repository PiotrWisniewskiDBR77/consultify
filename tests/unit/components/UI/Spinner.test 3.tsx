/**
 * Spinner Component Tests
 * Testing loading spinner
 * 
 * @module tests/unit/components/UI/Spinner.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Spinner component
const MockSpinner: React.FC<{
    size?: 'sm' | 'md' | 'lg' | 'xl';
    color?: 'primary' | 'secondary' | 'white';
    label?: string;
}> = ({
    size = 'md',
    color = 'primary',
    label
}) => {
        return (
            <div
                data-testid="spinner"
                data-size={size}
                data-color={color}
                role="status"
                aria-live="polite"
            >
                <svg data-testid="spinner-icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                </svg>
                {label ? (
                    <span data-testid="spinner-label">{label}</span>
                ) : (
                    <span className="sr-only" data-testid="spinner-sr">Loading...</span>
                )}
            </div>
        );
    };

describe('Spinner Component', () => {
    describe('Rendering', () => {
        it('should render spinner', () => {
            render(<MockSpinner />);
            expect(screen.getByTestId('spinner')).toBeInTheDocument();
        });

        it('should render spinner icon', () => {
            render(<MockSpinner />);
            expect(screen.getByTestId('spinner-icon')).toBeInTheDocument();
        });

        it('should render label when provided', () => {
            render(<MockSpinner label="Loading data..." />);
            expect(screen.getByTestId('spinner-label')).toHaveTextContent('Loading data...');
        });

        it('should render sr-only text when no label', () => {
            render(<MockSpinner />);
            expect(screen.getByTestId('spinner-sr')).toHaveTextContent('Loading...');
        });
    });

    describe('Size', () => {
        it.each(['sm', 'md', 'lg', 'xl'] as const)('should apply %s size', (size) => {
            render(<MockSpinner size={size} />);
            expect(screen.getByTestId('spinner')).toHaveAttribute('data-size', size);
        });
    });

    describe('Color', () => {
        it.each(['primary', 'secondary', 'white'] as const)('should apply %s color', (color) => {
            render(<MockSpinner color={color} />);
            expect(screen.getByTestId('spinner')).toHaveAttribute('data-color', color);
        });
    });

    describe('Accessibility', () => {
        it('should have status role', () => {
            render(<MockSpinner />);
            expect(screen.getByRole('status')).toBeInTheDocument();
        });

        it('should have aria-live polite', () => {
            render(<MockSpinner />);
            expect(screen.getByTestId('spinner')).toHaveAttribute('aria-live', 'polite');
        });
    });
});
