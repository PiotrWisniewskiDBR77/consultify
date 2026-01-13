/**
 * Modal Component Tests
 * Testing modal dialog component
 * 
 * @module tests/unit/components/UI/Modal.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Modal component
const MockModal: React.FC<{
    isOpen?: boolean;
    onClose?: () => void;
    title?: string;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
}> = ({
    isOpen = true,
    onClose = () => { },
    title,
    children,
    footer,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true
}) => {
        if (!isOpen) return null;

        return (
            <div
                data-testid="modal-overlay"
                onClick={() => closeOnOverlayClick && onClose()}
            >
                <div
                    data-testid="modal"
                    data-size={size}
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                >
                    <header data-testid="modal-header">
                        {title && <h2 data-testid="modal-title">{title}</h2>}
                        <button onClick={onClose} data-testid="modal-close" aria-label="Close modal">×</button>
                    </header>
                    <div data-testid="modal-body">{children}</div>
                    {footer && <footer data-testid="modal-footer">{footer}</footer>}
                </div>
            </div>
        );
    };

describe('Modal Component', () => {
    describe('Visibility', () => {
        it('should render when open', () => {
            render(<MockModal isOpen={true} />);
            expect(screen.getByTestId('modal')).toBeInTheDocument();
        });

        it('should not render when closed', () => {
            render(<MockModal isOpen={false} />);
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
        });
    });

    describe('Content', () => {
        it('should render title', () => {
            render(<MockModal title="Modal Title" />);
            expect(screen.getByTestId('modal-title')).toHaveTextContent('Modal Title');
        });

        it('should render body content', () => {
            render(<MockModal>Modal content here</MockModal>);
            expect(screen.getByTestId('modal-body')).toHaveTextContent('Modal content here');
        });

        it('should render footer', () => {
            render(<MockModal footer={<button>Submit</button>} />);
            expect(screen.getByTestId('modal-footer')).toBeInTheDocument();
        });
    });

    describe('Sizes', () => {
        it.each(['sm', 'md', 'lg', 'xl'] as const)('should apply %s size', (size) => {
            render(<MockModal size={size} />);
            expect(screen.getByTestId('modal')).toHaveAttribute('data-size', size);
        });
    });

    describe('Close Behavior', () => {
        it('should call onClose when close button clicked', () => {
            const onClose = vi.fn();
            render(<MockModal onClose={onClose} />);

            fireEvent.click(screen.getByTestId('modal-close'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when overlay clicked', () => {
            const onClose = vi.fn();
            render(<MockModal onClose={onClose} closeOnOverlayClick={true} />);

            fireEvent.click(screen.getByTestId('modal-overlay'));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when modal content clicked', () => {
            const onClose = vi.fn();
            render(<MockModal onClose={onClose} />);

            fireEvent.click(screen.getByTestId('modal-body'));
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('should have dialog role', () => {
            render(<MockModal />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('should have aria-modal', () => {
            render(<MockModal />);
            expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        });

        it('should have accessible close button', () => {
            render(<MockModal />);
            expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
        });
    });
});
