/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportComments } from '../@/components/Reports/Management/ReportComments';
import { ManagementReport } from '../@/types';

const mockReport: ManagementReport = {
    id: 'rep-1',
    type: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    status: 'DRAFT',
    title: 'Monthly Highlight Report',
    period: '2025-W52',
    data: {},
    comments: [
        { id: 'c1', createdBy: 'user-2', createdByName: 'John Doe', content: 'Needs more detail on ROI.', createdAt: new Date().toISOString(), resolved: false, isResolved: false }
    ],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

describe('ReportComments Component', () => {
    const defaultProps = {
        reportId: 'rep-1',
        sectionId: 'section-1',
        comments: mockReport.comments || [],
        currentUserId: 'user-1',
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

        const sendButton = screen.getByRole('button', { name: /send comment/i });
        fireEvent.click(sendButton);

        expect(onAddComment).toHaveBeenCalledWith('Looks good to me.', [], undefined);
    });

    it('calls onResolveComment when resolve button is clicked', () => {
        const onResolveComment = vi.fn();
        render(<ReportComments {...defaultProps} onResolveComment={onResolveComment} />);

        const moreButton = screen.getByRole('button', { name: /more options/i });
        fireEvent.click(moreButton);

        const resolveButton = screen.getByRole('button', { name: /resolve/i });
        fireEvent.click(resolveButton);

        expect(onResolveComment).toHaveBeenCalledWith('c1');
    });
});
