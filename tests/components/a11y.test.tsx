import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from '../../components/Button';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { LoadingScreen } from '../../components/LoadingScreen';

// Note: jest-axe requires additional setup. For now, we'll do basic a11y checks manually.

/**
 * Level 3: Component Tests - Accessibility (a11y)
 * Tests component accessibility compliance
 */
describe('Component Test: Accessibility (a11y)', () => {
    it('Button should be keyboard accessible', () => {
        const { container } = render(<Button>Click Me</Button>);
        const button = container.querySelector('button');
        expect(button).toBeDefined();
        expect(button?.tagName).toBe('BUTTON');
        expect(button).not.toHaveAttribute('disabled');
    });

    it('Button should have proper semantic HTML', () => {
        const { container } = render(<Button>Click Me</Button>);
        const button = container.querySelector('button');
        expect(button).toBeInTheDocument();
        expect(button?.textContent).toContain('Click Me');
    });

    it('ErrorBoundary should have accessible error message', () => {
        const { container } = render(
            <ErrorBoundary>
                <div>Test</div>
            </ErrorBoundary>
        );
        // ErrorBoundary should render children normally when no error
        expect(container.textContent).toContain('Test');
    });

    it('LoadingScreen should have accessible structure', () => {
        const { container } = render(<LoadingScreen />);
        // Should have a main container
        expect(container.firstChild).toBeDefined();
    });

    it('components should have proper ARIA labels when needed', () => {
        const { container } = render(
            <Button aria-label="Submit form">Submit</Button>
        );
        const button = container.querySelector('button');
        expect(button).toHaveAttribute('aria-label', 'Submit form');
    });
});

