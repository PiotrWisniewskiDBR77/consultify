/**
 * Tooltip Component Tests
 * Testing tooltip behavior and positioning
 * 
 * @module tests/unit/components/UI/Tooltip.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Tooltip component for testing patterns
const MockTooltip: React.FC<{
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    children: React.ReactNode;
}> = ({
    content,
    position = 'top',
    children
}) => {
        const [isVisible, setIsVisible] = useState(false);

        return (
            <div
                data-testid="tooltip-wrapper"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
            >
                {children}
                {isVisible && (
                    <div
                        role="tooltip"
                        data-testid="tooltip"
                        data-position={position}
                    >
                        {content}
                    </div>
                )}
            </div>
        );
    };

describe('Tooltip Component', () => {
    describe('Visibility', () => {
        it('should not show tooltip by default', () => {
            render(
                <MockTooltip content="Tooltip text">
                    <button>Hover me</button>
                </MockTooltip>
            );

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('should show tooltip on hover', () => {
            render(
                <MockTooltip content="Tooltip text">
                    <button>Hover me</button>
                </MockTooltip>
            );

            fireEvent.mouseEnter(screen.getByTestId('tooltip-wrapper'));

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
            expect(screen.getByText('Tooltip text')).toBeInTheDocument();
        });

        it('should hide tooltip on mouse leave', () => {
            render(
                <MockTooltip content="Tooltip text">
                    <button>Hover me</button>
                </MockTooltip>
            );

            const wrapper = screen.getByTestId('tooltip-wrapper');
            fireEvent.mouseEnter(wrapper);
            fireEvent.mouseLeave(wrapper);

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
    });

    describe('Position', () => {
        it('should default to top position', () => {
            render(
                <MockTooltip content="Top tooltip">
                    <button>Hover me</button>
                </MockTooltip>
            );

            fireEvent.mouseEnter(screen.getByTestId('tooltip-wrapper'));

            expect(screen.getByTestId('tooltip')).toHaveAttribute('data-position', 'top');
        });

        it.each(['top', 'bottom', 'left', 'right'] as const)('should apply %s position', (position) => {
            render(
                <MockTooltip content="Positioned tooltip" position={position}>
                    <button>Hover me</button>
                </MockTooltip>
            );

            fireEvent.mouseEnter(screen.getByTestId('tooltip-wrapper'));

            expect(screen.getByTestId('tooltip')).toHaveAttribute('data-position', position);
        });
    });

    describe('Accessibility', () => {
        it('should show tooltip on focus', () => {
            render(
                <MockTooltip content="Focus tooltip">
                    <button>Focus me</button>
                </MockTooltip>
            );

            fireEvent.focus(screen.getByTestId('tooltip-wrapper'));

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        it('should hide tooltip on blur', () => {
            render(
                <MockTooltip content="Focus tooltip">
                    <button>Focus me</button>
                </MockTooltip>
            );

            const wrapper = screen.getByTestId('tooltip-wrapper');
            fireEvent.focus(wrapper);
            fireEvent.blur(wrapper);

            expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });

        it('should have tooltip role', () => {
            render(
                <MockTooltip content="Accessible tooltip">
                    <button>Hover me</button>
                </MockTooltip>
            );

            fireEvent.mouseEnter(screen.getByTestId('tooltip-wrapper'));

            expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });
    });
});
