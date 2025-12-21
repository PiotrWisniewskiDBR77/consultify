/**
 * Action Decision Dialog Component Tests
 * 
 * Phase 5: Component Tests - Critical AI Component
 * Tests AI action approval/rejection dialog with reason input.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionDecisionDialog } from '../../components/ai/ActionDecisionDialog';

describe('ActionDecisionDialog', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should not render when isOpen is false', () => {
            const { container } = render(
                <ActionDecisionDialog
                    isOpen={false}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('should render when isOpen is true', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            expect(screen.getByText('Confirm Approval')).toBeInTheDocument();
        });

        it('should display approval dialog correctly', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Approve Action"
                />
            );
            expect(screen.getByText('Confirm Approval')).toBeInTheDocument();
            expect(screen.getByText('Approve Action')).toBeInTheDocument();
            expect(screen.getByText('Confirm & Execute')).toBeInTheDocument();
        });

        it('should display rejection dialog correctly', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="REJECT"
                    title="Reject Action"
                />
            );
            expect(screen.getByText('Confirm Rejection')).toBeInTheDocument();
            expect(screen.getByText('Reject Action')).toBeInTheDocument();
            expect(screen.getByText('Confirm Rejection')).toBeInTheDocument();
        });

        it('should display action title', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Create New Initiative"
                />
            );
            expect(screen.getByText('Create New Initiative')).toBeInTheDocument();
        });
    });

    describe('User Interactions', () => {
        it('should call onClose when cancel button is clicked', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const cancelButton = screen.getByText('Cancel');
            fireEvent.click(cancelButton);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when X button is clicked', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const closeButton = screen.getByRole('button', { name: '' }); // X button
            fireEvent.click(closeButton);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when backdrop is clicked', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const backdrop = screen.getByText('Confirm Approval').closest('div')?.parentElement?.previousElementSibling;
            if (backdrop) {
                fireEvent.click(backdrop);
                expect(mockOnClose).toHaveBeenCalledTimes(1);
            }
        });

        it('should allow entering reason text', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const textarea = screen.getByPlaceholderText(/Explain why this action is being approved/i);
            fireEvent.change(textarea, { target: { value: 'This looks good' } });
            expect(textarea).toHaveValue('This looks good');
        });

        it('should call onConfirm with reason when approve button is clicked', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const textarea = screen.getByPlaceholderText(/Explain why this action is being approved/i);
            fireEvent.change(textarea, { target: { value: 'Approved reason' } });
            const confirmButton = screen.getByText('Confirm & Execute');
            fireEvent.click(confirmButton);
            expect(mockOnConfirm).toHaveBeenCalledWith('Approved reason');
        });

        it('should call onConfirm with reason when reject button is clicked', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="REJECT"
                    title="Test Action"
                />
            );
            const textarea = screen.getByPlaceholderText(/Please provide a reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: 'Rejection reason' } });
            const confirmButton = screen.getByText('Confirm Rejection');
            fireEvent.click(confirmButton);
            expect(mockOnConfirm).toHaveBeenCalledWith('Rejection reason');
        });
    });

    describe('Validation', () => {
        it('should disable reject button when reason is empty', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="REJECT"
                    title="Test Action"
                />
            );
            const confirmButton = screen.getByText('Confirm Rejection');
            expect(confirmButton).toBeDisabled();
        });

        it('should enable reject button when reason is provided', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="REJECT"
                    title="Test Action"
                />
            );
            const textarea = screen.getByPlaceholderText(/Please provide a reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: 'Reason' } });
            const confirmButton = screen.getByText('Confirm Rejection');
            expect(confirmButton).not.toBeDisabled();
        });

        it('should enable approve button even without reason', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const confirmButton = screen.getByText('Confirm & Execute');
            expect(confirmButton).not.toBeDisabled();
        });

        it('should disable reject button when reason is only whitespace', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="REJECT"
                    title="Test Action"
                />
            );
            const textarea = screen.getByPlaceholderText(/Please provide a reason for rejecting/i);
            fireEvent.change(textarea, { target: { value: '   ' } });
            const confirmButton = screen.getByText('Confirm Rejection');
            expect(confirmButton).toBeDisabled();
        });
    });

    describe('Accessibility', () => {
        it('should have proper semantic structure', () => {
            const { container } = render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const heading = screen.getByRole('heading', { level: 3 });
            expect(heading).toBeInTheDocument();
            expect(heading).toHaveTextContent('Confirm Approval');
        });

        it('should have accessible buttons', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('should have accessible textarea', () => {
            render(
                <ActionDecisionDialog
                    isOpen={true}
                    onClose={mockOnClose}
                    onConfirm={mockOnConfirm}
                    type="APPROVE"
                    title="Test Action"
                />
            );
            const textarea = screen.getByPlaceholderText(/Explain why this action is being approved/i);
            expect(textarea).toBeInTheDocument();
            expect(textarea.tagName).toBe('TEXTAREA');
        });
    });
});

