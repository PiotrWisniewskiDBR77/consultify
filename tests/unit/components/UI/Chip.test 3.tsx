/**
 * Chip Component Tests
 * Testing chip/tag component
 * 
 * @module tests/unit/components/UI/Chip.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Chip component
const MockChip: React.FC<{
    label?: string;
    variant?: 'filled' | 'outlined';
    color?: 'default' | 'primary' | 'success' | 'warning' | 'error';
    size?: 'sm' | 'md' | 'lg';
    onDelete?: () => void;
    onClick?: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
}> = ({
    label = 'Chip',
    variant = 'filled',
    color = 'default',
    size = 'md',
    onDelete,
    onClick,
    icon,
    disabled = false
}) => {
        return (
            <span
                data-testid="chip"
                data-variant={variant}
                data-color={color}
                data-size={size}
                data-disabled={disabled}
                onClick={onClick && !disabled ? onClick : undefined}
                role={onClick ? 'button' : undefined}
                tabIndex={onClick && !disabled ? 0 : undefined}
            >
                {icon && <span data-testid="chip-icon">{icon}</span>}
                <span data-testid="chip-label">{label}</span>
                {onDelete && (
                    <button
                        data-testid="chip-delete"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!disabled) onDelete();
                        }}
                        disabled={disabled}
                        aria-label="Remove"
                    >
                        ×
                    </button>
                )}
            </span>
        );
    };

describe('Chip Component', () => {
    describe('Rendering', () => {
        it('should render chip', () => {
            render(<MockChip />);
            expect(screen.getByTestId('chip')).toBeInTheDocument();
        });

        it('should render label', () => {
            render(<MockChip label="Category" />);
            expect(screen.getByTestId('chip-label')).toHaveTextContent('Category');
        });

        it('should render icon', () => {
            render(<MockChip icon="⭐" />);
            expect(screen.getByTestId('chip-icon')).toHaveTextContent('⭐');
        });
    });

    describe('Variants', () => {
        it.each(['filled', 'outlined'] as const)('should apply %s variant', (variant) => {
            render(<MockChip variant={variant} />);
            expect(screen.getByTestId('chip')).toHaveAttribute('data-variant', variant);
        });
    });

    describe('Colors', () => {
        it.each(['default', 'primary', 'success', 'warning', 'error'] as const)('should apply %s color', (color) => {
            render(<MockChip color={color} />);
            expect(screen.getByTestId('chip')).toHaveAttribute('data-color', color);
        });
    });

    describe('Sizes', () => {
        it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
            render(<MockChip size={size} />);
            expect(screen.getByTestId('chip')).toHaveAttribute('data-size', size);
        });
    });

    describe('Deletable', () => {
        it('should show delete button when onDelete provided', () => {
            render(<MockChip onDelete={vi.fn()} />);
            expect(screen.getByTestId('chip-delete')).toBeInTheDocument();
        });

        it('should call onDelete when delete clicked', () => {
            const onDelete = vi.fn();
            render(<MockChip onDelete={onDelete} />);

            fireEvent.click(screen.getByTestId('chip-delete'));
            expect(onDelete).toHaveBeenCalledTimes(1);
        });
    });

    describe('Clickable', () => {
        it('should call onClick when clicked', () => {
            const onClick = vi.fn();
            render(<MockChip onClick={onClick} />);

            fireEvent.click(screen.getByTestId('chip'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('should have button role when clickable', () => {
            render(<MockChip onClick={vi.fn()} />);
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Disabled', () => {
        it('should not call onClick when disabled', () => {
            const onClick = vi.fn();
            render(<MockChip onClick={onClick} disabled={true} />);

            fireEvent.click(screen.getByTestId('chip'));
            expect(onClick).not.toHaveBeenCalled();
        });
    });
});
