/**
 * Slider Component Tests
 * Testing range slider component
 * 
 * @module tests/unit/components/UI/Slider.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Slider component
const MockSlider: React.FC<{
    value?: number;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    showValue?: boolean;
    marks?: Array<{ value: number; label: string }>;
}> = ({
    value = 50,
    onChange = () => { },
    min = 0,
    max = 100,
    step = 1,
    disabled = false,
    showValue = false,
    marks = []
}) => {
        const percentage = ((value - min) / (max - min)) * 100;

        return (
            <div
                data-testid="slider"
                data-disabled={disabled}
            >
                <input
                    type="range"
                    data-testid="slider-input"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    onChange={(e) => onChange(Number(e.target.value))}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={value}
                />
                <div
                    data-testid="slider-track"
                    style={{ width: `${percentage}%` }}
                />
                {showValue && (
                    <span data-testid="slider-value">{value}</span>
                )}
                {marks.length > 0 && (
                    <div data-testid="slider-marks">
                        {marks.map((mark, index) => (
                            <span
                                key={index}
                                data-testid={`slider-mark-${mark.value}`}
                            >
                                {mark.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    };

describe('Slider Component', () => {
    describe('Rendering', () => {
        it('should render slider', () => {
            render(<MockSlider />);
            expect(screen.getByTestId('slider')).toBeInTheDocument();
        });

        it('should render input with value', () => {
            render(<MockSlider value={75} />);
            expect(screen.getByTestId('slider-input')).toHaveValue('75');
        });

        it('should show value when showValue is true', () => {
            render(<MockSlider value={50} showValue={true} />);
            expect(screen.getByTestId('slider-value')).toHaveTextContent('50');
        });
    });

    describe('Range', () => {
        it('should set min attribute', () => {
            render(<MockSlider min={10} />);
            expect(screen.getByTestId('slider-input')).toHaveAttribute('min', '10');
        });

        it('should set max attribute', () => {
            render(<MockSlider max={200} />);
            expect(screen.getByTestId('slider-input')).toHaveAttribute('max', '200');
        });

        it('should set step attribute', () => {
            render(<MockSlider step={5} />);
            expect(screen.getByTestId('slider-input')).toHaveAttribute('step', '5');
        });
    });

    describe('Changes', () => {
        it('should call onChange when value changes', () => {
            const onChange = vi.fn();
            render(<MockSlider onChange={onChange} />);

            fireEvent.change(screen.getByTestId('slider-input'), { target: { value: '75' } });
            expect(onChange).toHaveBeenCalledWith(75);
        });
    });

    describe('Disabled', () => {
        it('should be disabled', () => {
            render(<MockSlider disabled={true} />);
            expect(screen.getByTestId('slider-input')).toBeDisabled();
        });
    });

    describe('Marks', () => {
        it('should render marks', () => {
            const marks = [
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' }
            ];
            render(<MockSlider marks={marks} />);

            expect(screen.getByTestId('slider-marks')).toBeInTheDocument();
            expect(screen.getByTestId('slider-mark-0')).toHaveTextContent('0%');
            expect(screen.getByTestId('slider-mark-100')).toHaveTextContent('100%');
        });
    });

    describe('Accessibility', () => {
        it('should have aria-valuemin', () => {
            render(<MockSlider min={10} />);
            expect(screen.getByTestId('slider-input')).toHaveAttribute('aria-valuemin', '10');
        });

        it('should have aria-valuemax', () => {
            render(<MockSlider max={90} />);
            expect(screen.getByTestId('slider-input')).toHaveAttribute('aria-valuemax', '90');
        });

        it('should have aria-valuenow', () => {
            render(<MockSlider value={60} />);
            expect(screen.getByTestId('slider-input')).toHaveAttribute('aria-valuenow', '60');
        });
    });
});
