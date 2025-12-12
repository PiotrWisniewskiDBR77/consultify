import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackWidget } from '../../components/FeedbackWidget';
import { useAppStore } from '../../store/useAppStore';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

vi.mock('../../store/useAppStore');
vi.mock('../../services/api');
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Component Test: FeedbackWidget', () => {
    const mockCurrentUser = { id: 'user-1', email: 'test@example.com' };
    const mockSetCurrentUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            currentUser: mockCurrentUser,
        });
    });

    it('does not render when user is not logged in', () => {
        (useAppStore as any).mockReturnValue({
            currentUser: null,
        });
        const { container } = render(<FeedbackWidget />);
        expect(container.firstChild).toBeNull();
    });

    it('renders trigger button when user is logged in', () => {
        render(<FeedbackWidget />);
        const button = screen.getByTitle('Send Feedback');
        expect(button).toBeInTheDocument();
    });

    it('opens modal when trigger button is clicked', () => {
        render(<FeedbackWidget />);
        const button = screen.getByTitle('Send Feedback');
        fireEvent.click(button);
        // Use getAllByText since "Send Feedback" appears multiple times
        const feedbackTexts = screen.getAllByText('Send Feedback');
        expect(feedbackTexts.length).toBeGreaterThan(0);
        expect(screen.getByPlaceholderText('Describe your issue or idea...')).toBeInTheDocument();
    });

    it('closes modal when X button is clicked', () => {
        render(<FeedbackWidget />);
        const triggerButton = screen.getByTitle('Send Feedback');
        fireEvent.click(triggerButton);
        
        const closeButton = screen.getByRole('button', { name: '' });
        const closeButtons = screen.getAllByRole('button');
        const xButton = closeButtons.find(btn => btn.querySelector('svg'));
        if (xButton) {
            fireEvent.click(xButton);
        }
        
        // Modal should close
        expect(screen.queryByPlaceholderText('Describe your issue or idea...')).not.toBeInTheDocument();
    });

    it('allows selecting feedback type', () => {
        render(<FeedbackWidget />);
        fireEvent.click(screen.getByTitle('Send Feedback'));
        
        const bugButton = screen.getByText('bug');
        const featureButton = screen.getByText('feature');
        
        fireEvent.click(featureButton);
        expect(featureButton).toHaveClass('bg-white');
    });

    it('submits feedback successfully', async () => {
        (Api.sendFeedback as any).mockResolvedValue({});
        
        render(<FeedbackWidget />);
        fireEvent.click(screen.getByTitle('Send Feedback'));
        
        const textarea = screen.getByPlaceholderText('Describe your issue or idea...');
        fireEvent.change(textarea, { target: { value: 'Test feedback message' } });
        
        const submitButton = screen.getByText('Send Feedback');
        fireEvent.click(submitButton);
        
        await waitFor(() => {
            expect(Api.sendFeedback).toHaveBeenCalledWith({
                user_id: mockCurrentUser.id,
                type: 'bug',
                message: 'Test feedback message',
                url: window.location.href,
            });
        });
        
        expect(toast.success).toHaveBeenCalledWith('Feedback sent! Thank you.');
    });

    it('handles submission error', async () => {
        (Api.sendFeedback as any).mockRejectedValue(new Error('API Error'));
        
        render(<FeedbackWidget />);
        fireEvent.click(screen.getByTitle('Send Feedback'));
        
        const textarea = screen.getByPlaceholderText('Describe your issue or idea...');
        fireEvent.change(textarea, { target: { value: 'Test feedback' } });
        
        const submitButton = screen.getByText('Send Feedback');
        fireEvent.click(submitButton);
        
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Failed to send feedback.');
        });
    });

    it('disables submit button when message is empty', () => {
        render(<FeedbackWidget />);
        fireEvent.click(screen.getByTitle('Send Feedback'));
        
        const submitButton = screen.getByText('Send Feedback');
        expect(submitButton).toBeDisabled();
    });
});

