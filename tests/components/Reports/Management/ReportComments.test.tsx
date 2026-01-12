/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportComments } from '../../../../components/Reports/Management/ReportComments';
import { ManagementReport } from '../../../../types';

const mockReport: ManagementReport = {
    id: 'rep-1',
    type: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    status: 'DRAFT',
    title: 'Monthly Highlight Report',
    period: '2025-W52',
    data: {},
    comments: [
        { id: 'c1', authorName: 'John Doe', content: 'Needs more detail on ROI.', createdAt: new Date().toISOString(), resolved: false }
    ],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

describe('ReportComments Component', () => {
    const defaultProps = {
        report: mockReport,
        onAddComment: vi.fn(),
        onResolveComment: vi.fn(),
        onDeleteComment: vi.fn()
    };

    it('renders existing comment threads', () => {
        render(<ReportComments {...defaultProps} />);
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Needs more detail on ROI.')).toBeInTheDocument();
    });

    it('allows adding a new comment', () => {
        const onAddComment = vi.fn();
        render(<ReportComments {...defaultProps} onAddComment={onAddComment} />);

        const input = screen.getByPlaceholderType ? screen.getByPlaceholderText(/add a comment/i) : screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Looks good to me.' } });

        const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);

        expect(onAddComment).toHaveBeenCalledWith('Looks good to me.');
    });

    it('calls onResolveComment when resolve button is clicked', () => {
        const onResolveComment = vi.fn();
        render(<ReportComments {...defaultProps} onResolveComment={onResolveComment} />);

        const resolveButton = screen.getByRole('button', { name: /resolve/i });
        fireEvent.click(resolveButton);

        expect(onResolveComment).toHaveBeenCalledWith('c1');
    });
});
