import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

describe('Component Test: ErrorBoundary', () => {
    // Suppress console.error for these tests
    const originalError = console.error;
    beforeEach(() => {
        console.error = vi.fn();
    });

    afterEach(() => {
        console.error = originalError;
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div>Test content</div>
            </ErrorBoundary>
        );
        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('displays error UI when child component throws', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/The application encountered an unexpected error/)).toBeInTheDocument();
    });

    it('displays error message in error UI', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Test error')).toBeInTheDocument();
    });

    it('has reset button in error UI', () => {
        const clearSpy = vi.spyOn(Storage.prototype, 'clear');
        const locationSpy = vi.fn();
        delete (window as any).location;
        (window as any).location = { href: '' };

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        const resetButton = screen.getByText('Reset Application Data (Fix)');
        expect(resetButton).toBeInTheDocument();
        
        resetButton.click();
        expect(clearSpy).toHaveBeenCalled();
    });
});

