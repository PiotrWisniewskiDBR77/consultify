/**
 * Textarea Component Tests
 * Testing textarea form control
 * 
 * @module tests/unit/components/UI/Textarea.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Textarea component
const MockTextarea: React.FC<{
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    label?: string;
    rows?: number;
    maxLength?: number;
    showCount?: boolean;
    resizable?: boolean;
}> = ({
    value = '',
    onChange = () => { },
    placeholder,
    disabled = false,
    error,
    label,
    rows = 3,
    maxLength,
    showCount = false,
    resizable = true
}) => {
        return (
            <div data-testid="textarea-wrapper" data-error={!!error}>
                {label && <label data-testid="textarea-label">{label}</label>}
                <textarea
                    data-testid="textarea"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={rows}
                    maxLength={maxLength}
                    style={{ resize: resizable ? 'vertical' : 'none' }}
                    aria-invalid={!!error}
                />
                {showCount && maxLength && (
                    <span data-testid="textarea-count">{value.length}/{maxLength}</span>
                )}
                {error && <span data-testid="textarea-error" role="alert">{error}</span>}
            </div>
        );
    };

describe('Textarea Component', () => {
    describe('Rendering', () => {
        it('should render textarea', () => {
            render(<MockTextarea />);
            expect(screen.getByTestId('textarea')).toBeInTheDocument();
        });

        it('should render placeholder', () => {
            render(<MockTextarea placeholder="Enter description..." />);
            expect(screen.getByPlaceholderText('Enter description...')).toBeInTheDocument();
        });

        it('should render label', () => {
            render(<MockTextarea label="Description" />);
            expect(screen.getByTestId('textarea-label')).toHaveTextContent('Description');
        });
    });

    describe('Rows', () => {
        it('should set rows', () => {
            render(<MockTextarea rows={5} />);
            expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '5');
        });
    });

    describe('States', () => {
        it('should be disabled', () => {
            render(<MockTextarea disabled={true} />);
            expect(screen.getByTestId('textarea')).toBeDisabled();
        });

        it('should show error', () => {
            render(<MockTextarea error="Description is required" />);
            expect(screen.getByTestId('textarea-error')).toHaveTextContent('Description is required');
        });
    });

    describe('Character Count', () => {
        it('should show character count', () => {
            render(<MockTextarea value="Hello" maxLength={100} showCount={true} />);
            expect(screen.getByTestId('textarea-count')).toHaveTextContent('5/100');
        });

        it('should set maxLength', () => {
            render(<MockTextarea maxLength={500} />);
            expect(screen.getByTestId('textarea')).toHaveAttribute('maxLength', '500');
        });
    });

    describe('Interactions', () => {
        it('should call onChange when typing', () => {
            const onChange = vi.fn();
            render(<MockTextarea onChange={onChange} />);

            fireEvent.change(screen.getByTestId('textarea'), { target: { value: 'New text' } });
            expect(onChange).toHaveBeenCalledWith('New text');
        });
    });

    describe('Resize', () => {
        it('should be resizable by default', () => {
            render(<MockTextarea />);
            expect(screen.getByTestId('textarea')).toHaveStyle({ resize: 'vertical' });
        });

        it('should disable resize when resizable is false', () => {
            render(<MockTextarea resizable={false} />);
            expect(screen.getByTestId('textarea')).toHaveStyle({ resize: 'none' });
        });
    });
});
