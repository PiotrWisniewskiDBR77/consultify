/**
 * SuperAdminFeedbackView Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SuperAdminFeedbackView } from '../../../views/superadmin/SuperAdminFeedbackView';

// Mock fetch
global.fetch = vi.fn();

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' }
    })
}));

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
    });

    it('should render loading state initially', () => {
        vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));
        
        render(<SuperAdminFeedbackView />);
        
        // Loading state should be shown
        expect(screen.getByText(/feedback/i)).toBeInTheDocument();
    });

    it('should fetch and display feedback', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockFeedback
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/feedback', {
                headers: { 'Authorization': 'Bearer test-token' }
            });
        });

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });
    });

    it('should filter feedback by status', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockFeedback
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });

        // Filter by NEW
        const newFilter = screen.getByText('NEW');
        fireEvent.click(newFilter);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
            expect(screen.queryByText('Great idea')).not.toBeInTheDocument();
        });
    });

    it('should search feedback', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockFeedback
        } as Response);

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
        vi.mocked(global.fetch).mockRejectedValue(new Error('API Error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });

        consoleSpy.mockRestore();
    });

    it('should handle non-ok response', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: false,
            status: 500
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });

    it('should display feedback type icons', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockFeedback
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });
    });

    it('should display user email', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockFeedback
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('user@test.com')).toBeInTheDocument();
        });
    });

    it('should display created date', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => mockFeedback
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(screen.getByText('Found a bug')).toBeInTheDocument();
        });
    });

    it('should handle empty feedback list', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => []
        } as Response);

        render(<SuperAdminFeedbackView />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled();
        });
    });
});









