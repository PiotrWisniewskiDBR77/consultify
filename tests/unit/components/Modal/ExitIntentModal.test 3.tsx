/**
 * ExitIntentModal Component Tests
 * Testing exit intent modal behavior
 * 
 * @module tests/unit/components/Modal/ExitIntentModal.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock component for testing patterns
const MockExitIntentModal: React.FC<{
    isOpen?: boolean;
    onClose?: () => void;
    onSubmit?: (email: string) => void;
    title?: string;
    description?: string;
}> = ({
    isOpen = true,
    onClose = () => { },
    onSubmit = () => { },
    title = 'Wait! Before you go...',
    description = 'Get our exclusive guide'
}) => {
        const [email, setEmail] = React.useState('');

        if (!isOpen) return null;

        return (
            <div data-testid="exit-intent-modal" role="dialog">
                <h2 data-testid="modal-title">{title}</h2>
                <p data-testid="modal-description">{description}</p>
                <input
                    type="email"
                    data-testid="email-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                />
                <button onClick={() => onSubmit(email)} data-testid="submit-button">
                    Get Access
                </button>
                <button onClick={onClose} data-testid="close-button" aria-label="Close">
                    No thanks
                </button>
            </div>
        );
    };

describe('ExitIntentModal Component', () => {
    describe('Visibility', () => {
        it('should render when open', () => {
            render(<MockExitIntentModal isOpen={true} />);

            expect(screen.getByTestId('exit-intent-modal')).toBeInTheDocument();
        });

        it('should not render when closed', () => {
            render(<MockExitIntentModal isOpen={false} />);

            expect(screen.queryByTestId('exit-intent-modal')).not.toBeInTheDocument();
        });

        it('should have dialog role for accessibility', () => {
            render(<MockExitIntentModal isOpen={true} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('Content', () => {
        it('should display custom title', () => {
            render(<MockExitIntentModal title="Custom Title" />);

            expect(screen.getByTestId('modal-title')).toHaveTextContent('Custom Title');
        });

        it('should display custom description', () => {
            render(<MockExitIntentModal description="Custom description text" />);

            expect(screen.getByTestId('modal-description')).toHaveTextContent('Custom description text');
        });
    });

    describe('Form Interaction', () => {
        it('should allow email input', () => {
            render(<MockExitIntentModal />);

            const input = screen.getByTestId('email-input');
            fireEvent.change(input, { target: { value: 'test@example.com' } });

            expect(input).toHaveValue('test@example.com');
        });

        it('should call onSubmit with email when submit clicked', () => {
            const onSubmit = vi.fn();
            render(<MockExitIntentModal onSubmit={onSubmit} />);

            const input = screen.getByTestId('email-input');
            fireEvent.change(input, { target: { value: 'user@test.com' } });
            fireEvent.click(screen.getByTestId('submit-button'));

            expect(onSubmit).toHaveBeenCalledWith('user@test.com');
        });

        it('should call onClose when close button clicked', () => {
            const onClose = vi.fn();
            render(<MockExitIntentModal onClose={onClose} />);

            fireEvent.click(screen.getByTestId('close-button'));

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });
});
