import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

describe('ErrorBoundary Component', () => {
    const originalError = console.error;
    const originalLocation = window.location;

    beforeEach(() => {
        // Suppress console.error for error boundary tests
        console.error = vi.fn();
        
        // Mock window.location
        delete (window as any).location;
        window.location = {
            ...originalLocation,
            href: '',
        } as any;
        
        // Mock localStorage
        Storage.prototype.clear = vi.fn();
    });

    afterEach(() => {
        console.error = originalError;
        window.location = originalLocation;
        vi.clearAllMocks();
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('catches errors and displays error UI', () => {
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

    it('has reset button that clears localStorage and redirects', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        const resetButton = screen.getByText('Reset Application Data (Fix)');
        expect(resetButton).toBeInTheDocument();

        fireEvent.click(resetButton);

        expect(localStorage.clear).toHaveBeenCalled();
        expect(window.location.href).toBe('/');
    });

    it('logs error to console when error occurs', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('handles multiple errors correctly', () => {
        const { rerender } = render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        // Rerender with new error
        rerender(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders error UI with correct styling classes', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        const errorContainer = screen.getByText('Something went wrong').closest('.min-h-screen');
        expect(errorContainer).toBeInTheDocument();
        expect(errorContainer).toHaveClass('bg-slate-900');
    });

    it('displays error message in code block', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        const errorMessage = screen.getByText('Test error');
        const codeBlock = errorMessage.closest('.bg-slate-950');
        
        expect(codeBlock).toBeInTheDocument();
        expect(codeBlock).toHaveClass('font-mono');
    });
});
