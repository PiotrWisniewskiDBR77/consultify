/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CorrectiveActions } from '../../../components/Execution/CorrectiveActions';

describe('CorrectiveActions Component', () => {
    const defaultProps = {
        projectId: 'project-1',
        onCreateAction: vi.fn(),
        onUpdateAction: vi.fn()
    };

    it('renders the component title and description', () => {
        render(<CorrectiveActions {...defaultProps} />);
        expect(screen.getByText('Corrective Actions')).toBeInTheDocument();
        expect(screen.getByText('Track and manage remediation activities for off-target KPIs')).toBeInTheDocument();
    });

    it('renders the summary statistics cards', () => {
        render(<CorrectiveActions {...defaultProps} />);
        expect(screen.getByText('Total Actions')).toBeInTheDocument();
        expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Completed').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
    });

    it('shows the overdue alert when overdue actions exist', () => {
        render(<CorrectiveActions {...defaultProps} />);
        // CA-2 is OPEN with due date '2025-01-05' (which is in the past from 2025-12-29)
        // CA-1 is IN_PROGRESS with '2025-01-15'
        expect(screen.getByText(/corrective actions are overdue/i)).toBeInTheDocument();
    });

    it('renders the "New Action" button and calls onCreateAction on click', () => {
        const onCreateAction = vi.fn();
        render(<CorrectiveActions {...defaultProps} onCreateAction={onCreateAction} />);
        const button = screen.getByRole('button', { name: /new action/i });
        fireEvent.click(button);
        expect(onCreateAction).toHaveBeenCalled();
    });

    it('filters actions when status tabs are clicked', () => {
        render(<CorrectiveActions {...defaultProps} />);

        // Initial state (all actions)
        expect(screen.getByText('Increase User Training Sessions')).toBeInTheDocument();
        expect(screen.getByText('Budget Variance Mitigation')).toBeInTheDocument();

        // Click Completed tab
        fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

        expect(screen.queryByText('Budget Variance Mitigation')).not.toBeInTheDocument();
        expect(screen.getByText('Process Documentation Update')).toBeInTheDocument();
    });

    it('expands an action card when clicked', () => {
        render(<CorrectiveActions {...defaultProps} />);

        const actionTitle = screen.getByText('Increase User Training Sessions');
        fireEvent.click(actionTitle);

        expect(screen.getByText('Root Cause')).toBeInTheDocument();
        expect(screen.getByText('Expected Impact')).toBeInTheDocument();
        expect(screen.getByText('Action Steps')).toBeInTheDocument();
    });

    it('calls onUpdateAction when "Mark Complete" is clicked inside an expanded action', () => {
        const onUpdateAction = vi.fn();
        render(<CorrectiveActions {...defaultProps} onUpdateAction={onUpdateAction} />);

        // CA-1 is IN_PROGRESS
        const actionTitle = screen.getByText('Increase User Training Sessions');
        fireEvent.click(actionTitle);

        const completeButton = screen.getByRole('button', { name: /mark complete/i });
        fireEvent.click(completeButton);

        expect(onUpdateAction).toHaveBeenCalledWith('ca-1', expect.objectContaining({ status: 'COMPLETED' }));
    });
});
