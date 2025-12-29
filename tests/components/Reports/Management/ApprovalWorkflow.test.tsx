/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalWorkflow } from '../../../../components/Reports/Management/ApprovalWorkflow';
import { ManagementReport } from '../../../../types';

const mockReport: ManagementReport = {
    id: 'rep-1',
    type: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    status: 'SUBMITTED',
    title: 'Monthly Highlight Report',
    period: '2025-W52',
    data: {},
    approvalWorkflow: {
        currentStep: 1,
        steps: [
            { id: 's1', role: 'Project Manager', userName: 'John PM', status: 'APPROVED', updatedAt: '2025-12-28T10:00:00Z' },
            { id: 's2', role: 'Business Owner', status: 'PENDING', slaHours: 24, deadline: '2025-12-30T10:00:00Z' }
        ]
    },
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

describe('ApprovalWorkflow Component', () => {
    const defaultProps = {
        report: mockReport,
        onApprove: vi.fn(),
        onReject: vi.fn(),
        onAddApprover: vi.fn()
    };

    it('renders the approval chain', () => {
        render(<ApprovalWorkflow {...defaultProps} />);
        expect(screen.getByText('Project Manager')).toBeInTheDocument();
        expect(screen.getByText('John PM')).toBeInTheDocument();
        expect(screen.getByText('Business Owner')).toBeInTheDocument();
    });

    it('displays status badges for steps', () => {
        render(<ApprovalWorkflow {...defaultProps} />);
        expect(screen.getByText('APPROVED')).toBeInTheDocument();
        expect(screen.getByText('PENDING')).toBeInTheDocument();
    });

    it('shows action buttons for current pending step if user has permission', () => {
        // Mock user as Business Owner in a real scenario, here we just check if buttons exist
        render(<ApprovalWorkflow {...defaultProps} />);
        expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('calls onApprove with comments when approved', () => {
        const onApprove = vi.fn();
        render(<ApprovalWorkflow {...defaultProps} onApprove={onApprove} />);

        fireEvent.click(screen.getByRole('button', { name: /approve/i }));

        // Should show a modal/textarea for comments
        const textarea = screen.getByPlaceholderText(/optional comments/i);
        fireEvent.change(textarea, { target: { value: 'All good.' } });

        fireEvent.click(screen.getByRole('button', { name: /confirm approval/i }));

        expect(onApprove).toHaveBeenCalledWith('All good.');
    });
});
