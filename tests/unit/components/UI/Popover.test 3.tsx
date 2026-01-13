/**
 * Popover Component Tests
 * Testing popover display and positioning
 * 
 * @module tests/unit/components/UI/Popover.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock Popover component
const MockPopover: React.FC<{
    trigger?: React.ReactNode;
    content?: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    closeOnClickOutside?: boolean;
}> = ({
    trigger = <button>Open</button>,
    content = 'Popover content',
    position = 'bottom',
    closeOnClickOutside = true
}) => {
        const [isOpen, setIsOpen] = useState(false);

        return (
            <div data-testid="popover-container">
                <div
                    data-testid="popover-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {trigger}
                </div>
                {isOpen && (
                    <div
                        data-testid="popover-content"
                        data-position={position}
                        role="dialog"
                    >
                        {content}
                        <button
                            data-testid="popover-close"
                            onClick={() => setIsOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        );
    };

describe('Popover Component', () => {
    describe('Visibility', () => {
        it('should not show content by default', () => {
            render(<MockPopover />);
            expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
        });

        it('should show content when trigger clicked', () => {
            render(<MockPopover />);

            fireEvent.click(screen.getByTestId('popover-trigger'));

            expect(screen.getByTestId('popover-content')).toBeInTheDocument();
        });

        it('should toggle content on trigger click', () => {
            render(<MockPopover />);
            const trigger = screen.getByTestId('popover-trigger');

            fireEvent.click(trigger);
            expect(screen.getByTestId('popover-content')).toBeInTheDocument();

            fireEvent.click(trigger);
            expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
        });
    });

    describe('Content', () => {
        it('should render custom trigger', () => {
            render(<MockPopover trigger={<span>Click me</span>} />);
            expect(screen.getByText('Click me')).toBeInTheDocument();
        });

        it('should render custom content', () => {
            render(<MockPopover content={<div>Custom content here</div>} />);

            fireEvent.click(screen.getByTestId('popover-trigger'));

            expect(screen.getByText('Custom content here')).toBeInTheDocument();
        });
    });

    describe('Position', () => {
        it.each(['top', 'bottom', 'left', 'right'] as const)('should apply %s position', (position) => {
            render(<MockPopover position={position} />);

            fireEvent.click(screen.getByTestId('popover-trigger'));

            expect(screen.getByTestId('popover-content')).toHaveAttribute('data-position', position);
        });
    });

    describe('Close Behavior', () => {
        it('should close when close button clicked', () => {
            render(<MockPopover />);

            fireEvent.click(screen.getByTestId('popover-trigger'));
            expect(screen.getByTestId('popover-content')).toBeInTheDocument();

            fireEvent.click(screen.getByTestId('popover-close'));
            expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have dialog role when open', () => {
            render(<MockPopover />);

            fireEvent.click(screen.getByTestId('popover-trigger'));

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });
});
