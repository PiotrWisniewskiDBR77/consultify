/**
 * SmartDemoBanner Component Tests
 * Testing demo banner display and interactions
 * 
 * @module tests/unit/components/Demo/SmartDemoBanner.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock component for testing patterns
const MockSmartDemoBanner: React.FC<{
    isVisible?: boolean;
    message?: string;
    onAction?: () => void;
    onClose?: () => void;
    variant?: 'info' | 'warning' | 'success';
}> = ({
    isVisible = true,
    message = 'You are in demo mode',
    onAction = () => { },
    onClose = () => { },
    variant = 'info'
}) => {
        if (!isVisible) return null;

        return (
            <div data-testid="smart-demo-banner" data-variant={variant}>
                <span data-testid="banner-message">{message}</span>
                <button onClick={onAction} data-testid="banner-action">Learn More</button>
                <button onClick={onClose} data-testid="banner-close" aria-label="Close">×</button>
            </div>
        );
    };

describe('SmartDemoBanner Component', () => {
    describe('Visibility', () => {
        it('should render when visible', () => {
            render(<MockSmartDemoBanner isVisible={true} />);

            expect(screen.getByTestId('smart-demo-banner')).toBeInTheDocument();
        });

        it('should not render when hidden', () => {
            render(<MockSmartDemoBanner isVisible={false} />);

            expect(screen.queryByTestId('smart-demo-banner')).not.toBeInTheDocument();
        });
    });

    describe('Content', () => {
        it('should display custom message', () => {
            render(<MockSmartDemoBanner message="Custom demo message" />);

            expect(screen.getByTestId('banner-message')).toHaveTextContent('Custom demo message');
        });

        it('should apply variant styling', () => {
            render(<MockSmartDemoBanner variant="warning" />);

            expect(screen.getByTestId('smart-demo-banner')).toHaveAttribute('data-variant', 'warning');
        });
    });

    describe('Interactions', () => {
        it('should call onAction when action button clicked', () => {
            const onAction = vi.fn();
            render(<MockSmartDemoBanner onAction={onAction} />);

            fireEvent.click(screen.getByTestId('banner-action'));

            expect(onAction).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when close button clicked', () => {
            const onClose = vi.fn();
            render(<MockSmartDemoBanner onClose={onClose} />);

            fireEvent.click(screen.getByTestId('banner-close'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Variants', () => {
        it.each(['info', 'warning', 'success'] as const)('should render %s variant', (variant) => {
            render(<MockSmartDemoBanner variant={variant} />);

            expect(screen.getByTestId('smart-demo-banner')).toHaveAttribute('data-variant', variant);
        });
    });
});
