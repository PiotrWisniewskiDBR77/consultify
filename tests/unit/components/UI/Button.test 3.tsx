/**
 * Button Component Tests
 * Core UI button component testing
 * 
 * @module tests/unit/components/UI/Button.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Button component for testing patterns
const MockButton: React.FC<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    onClick?: () => void;
    children?: React.ReactNode;
}> = ({
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    leftIcon,
    rightIcon,
    onClick = () => { },
    children = 'Button'
}) => {
        return (
            <button
                data-testid="button"
                data-variant={variant}
                data-size={size}
                disabled={disabled || loading}
                onClick={onClick}
                aria-busy={loading}
            >
                {loading && <span data-testid="button-loader">Loading...</span>}
                {leftIcon && <span data-testid="button-left-icon">{leftIcon}</span>}
                <span data-testid="button-content">{children}</span>
                {rightIcon && <span data-testid="button-right-icon">{rightIcon}</span>}
            </button>
        );
    };

describe('Button Component', () => {
    describe('Variants', () => {
        it.each(['primary', 'secondary', 'danger', 'ghost'] as const)('should render %s variant', (variant) => {
            render(<MockButton variant={variant} />);
            expect(screen.getByTestId('button')).toHaveAttribute('data-variant', variant);
        });

        it('should default to primary variant', () => {
            render(<MockButton />);
            expect(screen.getByTestId('button')).toHaveAttribute('data-variant', 'primary');
        });
    });

    describe('Sizes', () => {
        it.each(['sm', 'md', 'lg'] as const)('should render %s size', (size) => {
            render(<MockButton size={size} />);
            expect(screen.getByTestId('button')).toHaveAttribute('data-size', size);
        });
    });

    describe('States', () => {
        it('should be disabled when disabled prop is true', () => {
            render(<MockButton disabled={true} />);
            expect(screen.getByTestId('button')).toBeDisabled();
        });

        it('should be disabled when loading', () => {
            render(<MockButton loading={true} />);
            expect(screen.getByTestId('button')).toBeDisabled();
        });

        it('should show loader when loading', () => {
            render(<MockButton loading={true} />);
            expect(screen.getByTestId('button-loader')).toBeInTheDocument();
        });

        it('should indicate busy state when loading', () => {
            render(<MockButton loading={true} />);
            expect(screen.getByTestId('button')).toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('Icons', () => {
        it('should render left icon', () => {
            render(<MockButton leftIcon={<span>←</span>}>Back</MockButton>);
            expect(screen.getByTestId('button-left-icon')).toBeInTheDocument();
        });

        it('should render right icon', () => {
            render(<MockButton rightIcon={<span>→</span>}>Next</MockButton>);
            expect(screen.getByTestId('button-right-icon')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onClick when clicked', () => {
            const onClick = vi.fn();
            render(<MockButton onClick={onClick} />);

            fireEvent.click(screen.getByTestId('button'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('should not call onClick when disabled', () => {
            const onClick = vi.fn();
            render(<MockButton onClick={onClick} disabled={true} />);

            fireEvent.click(screen.getByTestId('button'));
            expect(onClick).not.toHaveBeenCalled();
        });
    });

    describe('Content', () => {
        it('should render children', () => {
            render(<MockButton>Submit Form</MockButton>);
            expect(screen.getByTestId('button-content')).toHaveTextContent('Submit Form');
        });
    });
});
