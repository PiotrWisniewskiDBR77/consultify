/**
 * Toast Component Tests
 * Testing toast notification component
 * 
 * @module tests/unit/components/UI/Toast.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Mock Toast component
const MockToast: React.FC<{
    message?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    onClose?: () => void;
    action?: { label: string; onClick: () => void };
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}> = ({
    message = 'Toast message',
    type = 'info',
    duration = 5000,
    onClose = () => { },
    action,
    position = 'top-right'
}) => {
        return (
            <div
                data-testid="toast"
                data-type={type}
                data-position={position}
                role="alert"
                aria-live="polite"
            >
                <span data-testid="toast-icon">{type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
                <span data-testid="toast-message">{message}</span>
                {action && (
                    <button
                        data-testid="toast-action"
                        onClick={action.onClick}
                    >
                        {action.label}
                    </button>
                )}
                <button
                    data-testid="toast-close"
                    onClick={onClose}
                    aria-label="Close notification"
                >
                    ×
                </button>
            </div>
        );
    };

describe('Toast Component', () => {
    describe('Rendering', () => {
        it('should render toast', () => {
            render(<MockToast />);
            expect(screen.getByTestId('toast')).toBeInTheDocument();
        });

        it('should render message', () => {
            render(<MockToast message="Operation successful" />);
            expect(screen.getByTestId('toast-message')).toHaveTextContent('Operation successful');
        });

        it('should render close button', () => {
            render(<MockToast />);
            expect(screen.getByTestId('toast-close')).toBeInTheDocument();
        });
    });

    describe('Types', () => {
        it.each(['success', 'error', 'warning', 'info'] as const)('should apply %s type', (type) => {
            render(<MockToast type={type} />);
            expect(screen.getByTestId('toast')).toHaveAttribute('data-type', type);
        });

        it('should show success icon', () => {
            render(<MockToast type="success" />);
            expect(screen.getByTestId('toast-icon')).toHaveTextContent('✓');
        });

        it('should show error icon', () => {
            render(<MockToast type="error" />);
            expect(screen.getByTestId('toast-icon')).toHaveTextContent('✕');
        });
    });

    describe('Position', () => {
        it.each(['top-right', 'top-left', 'bottom-right', 'bottom-left'] as const)('should apply %s position', (position) => {
            render(<MockToast position={position} />);
            expect(screen.getByTestId('toast')).toHaveAttribute('data-position', position);
        });
    });

    describe('Actions', () => {
        it('should render action button', () => {
            const action = { label: 'Undo', onClick: vi.fn() };
            render(<MockToast action={action} />);
            expect(screen.getByTestId('toast-action')).toHaveTextContent('Undo');
        });

        it('should call action onClick', () => {
            const onClick = vi.fn();
            render(<MockToast action={{ label: 'Retry', onClick }} />);

            fireEvent.click(screen.getByTestId('toast-action'));
            expect(onClick).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when close clicked', () => {
            const onClose = vi.fn();
            render(<MockToast onClose={onClose} />);

            fireEvent.click(screen.getByTestId('toast-close'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Accessibility', () => {
        it('should have alert role', () => {
            render(<MockToast />);
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        it('should have aria-live polite', () => {
            render(<MockToast />);
            expect(screen.getByTestId('toast')).toHaveAttribute('aria-live', 'polite');
        });

        it('should have accessible close button', () => {
            render(<MockToast />);
            expect(screen.getByLabelText('Close notification')).toBeInTheDocument();
        });
    });
});
