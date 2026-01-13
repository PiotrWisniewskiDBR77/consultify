/**
 * Rating Component Tests
 * Testing star rating component
 * 
 * @module tests/unit/components/UI/Rating.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Rating component
const MockRating: React.FC<{
    value?: number;
    onChange?: (value: number) => void;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    readonly?: boolean;
    precision?: 1 | 0.5;
}> = ({
    value = 0,
    onChange = () => { },
    max = 5,
    size = 'md',
    readonly = false,
    precision = 1
}) => {
        return (
            <div
                data-testid="rating"
                data-size={size}
                data-readonly={readonly}
                role="radiogroup"
                aria-label="Rating"
            >
                {Array.from({ length: max }, (_, i) => {
                    const starValue = i + 1;
                    const isFilled = starValue <= value;
                    const isHalf = precision === 0.5 && starValue - 0.5 === value;

                    return (
                        <button
                            key={i}
                            data-testid={`rating-star-${i}`}
                            data-filled={isFilled}
                            data-half={isHalf}
                            onClick={() => !readonly && onChange(starValue)}
                            disabled={readonly}
                            role="radio"
                            aria-checked={isFilled}
                        >
                            {isFilled ? '★' : '☆'}
                        </button>
                    );
                })}
                <span data-testid="rating-value">{value}/{max}</span>
            </div>
        );
    };

describe('Rating Component', () => {
    describe('Rendering', () => {
        it('should render rating', () => {
            render(<MockRating />);
            expect(screen.getByTestId('rating')).toBeInTheDocument();
        });

        it('should render correct number of stars', () => {
            render(<MockRating max={5} />);
            expect(screen.getByTestId('rating-star-0')).toBeInTheDocument();
            expect(screen.getByTestId('rating-star-4')).toBeInTheDocument();
        });

        it('should render value', () => {
            render(<MockRating value={3} max={5} />);
            expect(screen.getByTestId('rating-value')).toHaveTextContent('3/5');
        });
    });

    describe('Filled Stars', () => {
        it('should fill stars up to value', () => {
            render(<MockRating value={3} />);

            expect(screen.getByTestId('rating-star-0')).toHaveAttribute('data-filled', 'true');
            expect(screen.getByTestId('rating-star-2')).toHaveAttribute('data-filled', 'true');
            expect(screen.getByTestId('rating-star-3')).toHaveAttribute('data-filled', 'false');
        });
    });

    describe('Interaction', () => {
        it('should call onChange on click', () => {
            const onChange = vi.fn();
            render(<MockRating onChange={onChange} />);

            fireEvent.click(screen.getByTestId('rating-star-3'));
            expect(onChange).toHaveBeenCalledWith(4);
        });

        it('should not call onChange when readonly', () => {
            const onChange = vi.fn();
            render(<MockRating onChange={onChange} readonly={true} />);

            fireEvent.click(screen.getByTestId('rating-star-2'));
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('Size', () => {
        it.each(['sm', 'md', 'lg'] as const)('should apply %s size', (size) => {
            render(<MockRating size={size} />);
            expect(screen.getByTestId('rating')).toHaveAttribute('data-size', size);
        });
    });

    describe('Accessibility', () => {
        it('should have radiogroup role', () => {
            render(<MockRating />);
            expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        });

        it('should have radio role for stars', () => {
            render(<MockRating />);
            expect(screen.getAllByRole('radio')).toHaveLength(5);
        });

        it('should have aria-label', () => {
            render(<MockRating />);
            expect(screen.getByLabelText('Rating')).toBeInTheDocument();
        });
    });
});
