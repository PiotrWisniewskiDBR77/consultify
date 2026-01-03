/**
 * SessionManagementPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionManagementPanel } from '../../../components/SuperAdmin/security/SessionManagementPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn(),
        getOrganizations: vi.fn(),
    },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('SessionManagementPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockSessions = [
        {
            id: 'session-1',
            user_id: 'user-1',
            organization_id: 'org-1',
            user_email: 'user@test.com',
            user_first_name: 'John',
            user_last_name: 'Doe',
            organization_name: 'Test Organization',
            device_type: 'desktop',
            browser: 'Chrome',
            os: 'Windows',
            ip_address: '192.168.1.1',
            location: 'New York, US',
            created_at: '2025-01-01T10:00:00Z',
            last_activity: '2025-01-01T12:00:00Z',
            expires_at: '2025-01-02T10:00:00Z',
            is_active: true,
        },
        {
            id: 'session-2',
            user_id: 'user-1',
            organization_id: 'org-1',
            user_email: 'user@test.com',
            user_first_name: 'John',
            user_last_name: 'Doe',
            device_type: 'mobile',
            browser: 'Safari',
            os: 'iOS',
            ip_address: '192.168.1.2',
            created_at: '2025-01-01T11:00:00Z',
            last_activity: '2025-01-01T13:00:00Z',
            expires_at: '2025-01-02T11:00:00Z',
            is_active: true,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/sessions')) {
                return Promise.resolve({ sessions: mockSessions });
            }
            return Promise.resolve({});
        });
    });

    it('renders loading state initially', () => {
        render(<SessionManagementPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches organizations on mount', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('fetches sessions on mount', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/security-policies/sessions/all');
        });
    });

    it('displays session count badge', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('2 Active')).toBeTruthy();
        });
    });

    it('displays user information in session list', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeTruthy();
            expect(screen.getByText('user@test.com')).toBeTruthy();
        });
    });

    it('displays device and browser info', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Chrome')).toBeTruthy();
            expect(screen.getByText('Safari')).toBeTruthy();
        });
    });

    it('shows "End All" button for users with multiple sessions', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('End All')).toBeTruthy();
        });
    });

    it('terminates session when terminate button is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Chrome')).toBeTruthy();
        });

        // Find and click terminate button (logout icon)
        const terminateButtons = screen.getAllByTitle('Terminate Session');
        fireEvent.click(terminateButtons[0]);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith(
                '/security-policies/sessions/session-1/terminate',
                { reason: 'admin_action' }
            );
        });
    });

    it('terminates all sessions for user when End All is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('End All')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('End All'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith(
                '/security-policies/org-1/sessions/terminate-all',
                { userId: 'user-1', reason: 'admin_action' }
            );
        });
    });

    it('filters sessions by search query', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Search sessions...');
        fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

        await waitFor(() => {
            expect(screen.getByText('No active sessions found')).toBeTruthy();
        });
    });

    it('filters sessions by organization', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('All Organizations')).toBeTruthy();
        });

        const orgSelect = screen.getByDisplayValue('All Organizations');
        fireEvent.change(orgSelect, { target: { value: 'org-1' } });

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/security-policies/org-1/sessions');
        });
    });

    it('displays empty state when no sessions', async () => {
        (Api.get as any).mockImplementation(() => Promise.resolve({ sessions: [] }));
        
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No active sessions found')).toBeTruthy();
        });
    });

    it('shows IP address in session details', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('192.168.1.1')).toBeTruthy();
        });
    });

    it('refreshes sessions when refresh button is clicked', async () => {
        render(<SessionManagementPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('John Doe')).toBeTruthy();
        });

        // Clear mock calls
        vi.clearAllMocks();

        // Click refresh
        const refreshButton = screen.getByTitle('Refresh');
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/security-policies/sessions/all');
        });
    });
});







