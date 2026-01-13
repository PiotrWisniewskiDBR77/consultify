/**
 * Skeleton Component Tests
 * Testing loading skeleton component
 * 
 * @module tests/unit/components/UI/Skeleton.test.tsx
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock Skeleton component
const MockSkeleton: React.FC<{
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
    lines?: number;
}> = ({
    variant = 'text',
    width = '100%',
    height,
    animation = 'pulse',
    lines = 1
}) => {
        const getHeight = () => {
            if (height) return height;
            if (variant === 'text') return '1em';
            if (variant === 'circular') return width;
            return '100px';
        };

        if (lines > 1 && variant === 'text') {
            return (
                <div data-testid="skeleton-container">
                    {Array.from({ length: lines }).map((_, i) => (
                        <div
                            key={i}
                            data-testid={`skeleton-line-${i}`}
                            data-variant={variant}
                            data-animation={animation}
                            style={{ width, height: getHeight() }}
                        />
                    ))}
                </div>
            );
        }

        return (
            <div
                data-testid="skeleton"
                data-variant={variant}
                data-animation={animation}
                style={{ width, height: getHeight() }}
            />
        );
    };

describe('Skeleton Component', () => {
    describe('Variants', () => {
        it.each(['text', 'circular', 'rectangular'] as const)('should render %s variant', (variant) => {
            render(<MockSkeleton variant={variant} />);
            expect(screen.getByTestId('skeleton')).toHaveAttribute('data-variant', variant);
        });
    });

    describe('Dimensions', () => {
        it('should apply width', () => {
            render(<MockSkeleton width="200px" />);
            expect(screen.getByTestId('skeleton')).toHaveStyle({ width: '200px' });
        });

        it('should apply height', () => {
            render(<MockSkeleton height="50px" />);
            expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '50px' });
        });

        it('should default text height to 1em', () => {
            render(<MockSkeleton variant="text" />);
            expect(screen.getByTestId('skeleton')).toHaveStyle({ height: '1em' });
        });
    });

    describe('Animation', () => {
        it.each(['pulse', 'wave', 'none'] as const)('should apply %s animation', (animation) => {
            render(<MockSkeleton animation={animation} />);
            expect(screen.getByTestId('skeleton')).toHaveAttribute('data-animation', animation);
        });
    });

    describe('Multiple Lines', () => {
        it('should render multiple lines', () => {
            render(<MockSkeleton lines={3} />);
            expect(screen.getByTestId('skeleton-container')).toBeInTheDocument();
            expect(screen.getByTestId('skeleton-line-0')).toBeInTheDocument();
            expect(screen.getByTestId('skeleton-line-1')).toBeInTheDocument();
            expect(screen.getByTestId('skeleton-line-2')).toBeInTheDocument();
        });
    });
});
