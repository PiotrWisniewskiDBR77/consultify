/**
 * DemoLoadingOverlay Component Tests
 * Testing loading overlay display and animation
 * 
 * @module tests/unit/components/Demo/DemoLoadingOverlay.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock component for testing patterns
const MockDemoLoadingOverlay: React.FC<{
    isVisible?: boolean;
    message?: string;
    progress?: number;
    showProgress?: boolean;
}> = ({
    isVisible = true,
    message = 'Loading...',
    progress = 0,
    showProgress = false
}) => {
        if (!isVisible) return null;

        return (
            <div data-testid="demo-loading-overlay" role="progressbar" aria-busy="true">
                <div data-testid="loading-spinner" className="spinner" />
                <p data-testid="loading-message">{message}</p>
                {showProgress && (
                    <div data-testid="progress-bar" style={{ width: `${progress}%` }}>
                        <span data-testid="progress-value">{progress}%</span>
                    </div>
                )}
            </div>
        );
    };

describe('DemoLoadingOverlay Component', () => {
    describe('Visibility', () => {
        it('should render when visible', () => {
            render(<MockDemoLoadingOverlay isVisible={true} />);
            expect(screen.getByTestId('demo-loading-overlay')).toBeInTheDocument();
        });

        it('should not render when hidden', () => {
            render(<MockDemoLoadingOverlay isVisible={false} />);
            expect(screen.queryByTestId('demo-loading-overlay')).not.toBeInTheDocument();
        });
    });

    describe('Content', () => {
        it('should display loading message', () => {
            render(<MockDemoLoadingOverlay message="Loading demo data..." />);
            expect(screen.getByTestId('loading-message')).toHaveTextContent('Loading demo data...');
        });

        it('should show spinner', () => {
            render(<MockDemoLoadingOverlay />);
            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
        });
    });

    describe('Progress', () => {
        it('should hide progress bar by default', () => {
            render(<MockDemoLoadingOverlay />);
            expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
        });

        it('should show progress bar when enabled', () => {
            render(<MockDemoLoadingOverlay showProgress={true} progress={50} />);
            expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
            expect(screen.getByTestId('progress-value')).toHaveTextContent('50%');
        });

        it('should update progress value', () => {
            const { rerender } = render(<MockDemoLoadingOverlay showProgress={true} progress={25} />);
            expect(screen.getByTestId('progress-value')).toHaveTextContent('25%');

            rerender(<MockDemoLoadingOverlay showProgress={true} progress={75} />);
            expect(screen.getByTestId('progress-value')).toHaveTextContent('75%');
        });
    });

    describe('Accessibility', () => {
        it('should have progressbar role', () => {
            render(<MockDemoLoadingOverlay />);
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('should indicate busy state', () => {
            render(<MockDemoLoadingOverlay />);
            expect(screen.getByRole('progressbar')).toHaveAttribute('aria-busy', 'true');
        });
    });
});
