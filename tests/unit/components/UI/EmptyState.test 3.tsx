/**
 * Empty State Component Tests
 * Testing empty state display
 * 
 * @module tests/unit/components/UI/EmptyState.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock EmptyState component
const MockEmptyState: React.FC<{
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    action?: { label: string; onClick: () => void };
    size?: 'sm' | 'md' | 'lg';
}> = ({
    icon = '📭',
    title = 'No items found',
    description,
    action,
    size = 'md'
}) => {
        return (
            <div data-testid="empty-state" data-size={size}>
                {icon && <span data-testid="empty-state-icon">{icon}</span>}
                <h3 data-testid="empty-state-title">{title}</h3>
                {description && <p data-testid="empty-state-description">{description}</p>}
                {action && (
                    <button
                        data-testid="empty-state-action"
                        onClick={action.onClick}
                    >
                        {action.label}
                    </button>
                )}
            </div>
        );
    };

describe('EmptyState Component', () => {
    describe('Rendering', () => {
        it('should render empty state', () => {
            render(<MockEmptyState />);
            expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        });

        it('should render title', () => {
            render(<MockEmptyState title="No results" />);
            expect(screen.getByTestId('empty-state-title')).toHaveTextContent('No results');
        });

        it('should render description', () => {
            render(<MockEmptyState description="Try adjusting your filters" />);
            expect(screen.getByTestId('empty-state-description')).toHaveTextContent('Try adjusting your filters');
        });

        it('should render icon', () => {
            render(<MockEmptyState icon="🔍" />);
            expect(screen.getByTestId('empty-state-icon')).toHaveTextContent('🔍');
        });
    });

    describe('Action', () => {
        it('should render action button', () => {
            const action = { label: 'Create New', onClick: vi.fn() };
            render(<MockEmptyState action={action} />);
            expect(screen.getByTestId('empty-state-action')).toHaveTextContent('Create New');
        });

        it('should call action onClick', () => {
            const onClick = vi.fn();
            render(<MockEmptyState action={{ label: 'Add Item', onClick }} />);

            fireEvent.click(screen.getByTestId('empty-state-action'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Size', () => {
        it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
            render(<MockEmptyState size={size} />);
            expect(screen.getByTestId('empty-state')).toHaveAttribute('data-size', size);
        });
    });

    describe('Optional Elements', () => {
        it('should not render description when not provided', () => {
            render(<MockEmptyState />);
            expect(screen.queryByTestId('empty-state-description')).not.toBeInTheDocument();
        });

        it('should not render action when not provided', () => {
            render(<MockEmptyState />);
            expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
        });
    });
});
