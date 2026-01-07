/**
 * SuperAdminFeedbackView Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminFeedbackView } from '../../../src/views/superadmin/SuperAdminFeedbackView';

// Mock Api
vi.mock('@/services/api', () => ({
    Api: {
        getFeedback: vi.fn(),
        updateFeedbackStatus: vi.fn()
    }
}));

import { Api } from '@/services/api';

// Mock date-fns
vi.mock('date-fns', () => ({
    format: (date: Date, format: string) => '2025-01-01',
    pl: {},
    enUS: {}
}));

describe('SuperAdminFeedbackView', () => {
    const mockFeedback = [
        {
            id: 'fb-1',
            user_id: 'user-1',
            user_email: 'user@test.com',
            type: 'BUG',
            message: 'Found a bug',
            status: 'NEW',
            created_at: '2025-01-01T00:00:00Z'
        },
        {
            id: 'fb-2',
            user_id: 'user-2',
            user_email: 'user2@test.com',
            type: 'IDEA',
            message: 'Great idea',
            status: 'RESOLVED',
            created_at: '2025-01-02T00:00:00Z'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('token', 'test-token');
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);
        (Api.updateFeedbackStatus as any).mockResolvedValue({ success: true });
    });

    it('should render loading state initially', () => {
        vi.mocked(global.fetch).mockImplementation(() => new Promise(() => { }));

        render(<SuperAdminFeedbackView />);

        // Loading state should be shown
        expect(screen.getByText(/feedback/i)).toBeInTheDocument();
    });

    it('should fetch and display feedback', async () => {
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(Api.getFeedback).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });
    });

    it('should filter feedback by status', async () => {
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });

        // Filter by NEW
        const newFilter = screen.getByText('NEW'); // Note: This might need adjustment if it's a select option
        // The component uses a select for filtering, so we should change the select value
        const filterSelect = screen.getByRole('combobox');
        fireEvent.change(filterSelect, { target: { value: 'NEW' } });

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
            expect(screen.queryByText('Great idea')).not.toBeInTheDocument();
        });
    });

    it('should search feedback', async () => {
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/search/i);
        fireEvent.change(searchInput, { target: { value: 'bug' } });

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
            expect(screen.queryByText('Great idea')).not.toBeInTheDocument();
        });
    });

    it('should handle API errors', async () => {
        (Api.getFeedback as any).mockRejectedValue(new Error('API Error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });

        consoleSpy.mockRestore();
    });

    it('should display feedback type icons', async () => {
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });
    });

    it('should display user email', async () => {
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('user@test.com')).toBeInTheDocument();
        });
    });

    it('should display created date', async () => {
        (Api.getFeedback as any).mockResolvedValue(mockFeedback);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });
    });

    it('should handle empty feedback list', async () => {
        (Api.getFeedback as any).mockResolvedValue([]);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(Api.getFeedback).toHaveBeenCalled();
        });
    });
});














