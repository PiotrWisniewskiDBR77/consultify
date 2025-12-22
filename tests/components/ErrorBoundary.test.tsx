/**
 * Error Boundary Component Tests
 * Tests error handling in React components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import React from 'react';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

describe('ErrorBoundary', () => {
    beforeEach(() => {
        // Suppress console.error for expected errors
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should render children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div>Test content</div>
            </ErrorBoundary>
        );

        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch errors and display error UI', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
        expect(screen.getByText(/Test error/i)).toBeInTheDocument();
    });

    it('should display reset button when error occurs', () => {
        const clearSpy = vi.spyOn(Storage.prototype, 'clear');
        const locationSpy = vi.fn();
        delete (window as any).location;
        (window as any).location = { href: '' };

        Object.defineProperty(window, 'location', {
            value: { href: '' },
            writable: true
        });

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        const resetButton = screen.getByText(/Reset Application Data/i);
        expect(resetButton).toBeInTheDocument();
    });

    it('should log errors to console', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
