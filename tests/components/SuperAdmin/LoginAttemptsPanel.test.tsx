/**
 * LoginAttemptsPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginAttemptsPanel } from '../../../components/SuperAdmin/security/LoginAttemptsPanel';
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

describe('LoginAttemptsPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
    ];

    const mockStats = {
        activeSessions: 5,
        loginAttempts: {
            total: 100,
            successful: 95,
            failed: 5,
            successRate: 95,
        },
        activeLockouts: 2,
        customPolicies: 1,
        loginTrend: [],
    };

    const mockLockouts = [
        {
            id: 'lockout-1',
            user_email: 'locked@test.com',
            user_id: 'user-1',
            firstName: 'John',
            lastName: 'Locked',
            reason: 'max_attempts',
            failed_attempts: 5,
            locked_at: '2025-01-01T10:00:00Z',
            expires_at: '2025-01-01T10:30:00Z',
            ip_address: '192.168.1.1',
        },
    ];

    const mockAttempts = [
        {
            id: 'attempt-1',
            user_email: 'user@test.com',
            user_id: 'user-1',
            organization_id: 'org-1',
            success: 1,
            auth_method: 'password',
            ip_address: '192.168.1.1',
            location: 'New York, US',
            created_at: '2025-01-01T12:00:00Z',
        },
        {
            id: 'attempt-2',
            user_email: 'attacker@test.com',
            success: 0,
            failure_reason: 'Invalid password',
            auth_method: 'password',
            ip_address: '10.0.0.1',
            created_at: '2025-01-01T11:00:00Z',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/stats')) {
                return Promise.resolve(mockStats);
            }
            if (url.includes('/lockouts')) {
                return Promise.resolve({ lockouts: mockLockouts });
            }
            if (url.includes('/login-attempts')) {
                return Promise.resolve({ attempts: mockAttempts });
            }
            return Promise.resolve({});
        });
    });

    it('renders loading state initially', () => {
        render(<LoginAttemptsPanel />);
        expect(document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches stats on mount', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/security-policies/stats?days=7');
        });
    });

    it('fetches lockouts on mount', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/security-policies/lockouts/all?active=true');
        });
    });

    it('displays success rate stat', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('95%')).toBeTruthy();
            expect(screen.getByText('Success Rate')).toBeTruthy();
        });
    });

    it('displays successful login count', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('95')).toBeTruthy();
            expect(screen.getByText('Successful')).toBeTruthy();
        });
    });

    it('displays failed login count', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('5')).toBeTruthy();
            expect(screen.getByText('Failed')).toBeTruthy();
        });
    });

    it('displays active lockouts count', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('2')).toBeTruthy();
            expect(screen.getByText('Active Lockouts')).toBeTruthy();
        });
    });

    it('displays lockout section when lockouts exist', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Active Account Lockouts')).toBeTruthy();
            expect(screen.getByText('John Locked')).toBeTruthy();
        });
    });

    it('shows unlock button for locked accounts', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Unlock')).toBeTruthy();
        });
    });

    it('unlocks account when unlock button is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Unlock')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Unlock'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/security-policies/unlock-account', { email: 'locked@test.com' });
        });
    });

    it('displays login attempts table', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('user@test.com')).toBeTruthy();
            expect(screen.getByText('attacker@test.com')).toBeTruthy();
        });
    });

    it('shows success status for successful attempts', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Success')).toBeTruthy();
        });
    });

    it('shows failed status with reason for failed attempts', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            const failedElements = screen.getAllByText('Failed');
            expect(failedElements.length).toBeGreaterThan(0);
            expect(screen.getByText('Invalid password')).toBeTruthy();
        });
    });

    it('filters by status when filter buttons are clicked', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('user@test.com')).toBeTruthy();
        });

        // Click on "Failed" filter
        fireEvent.click(screen.getByRole('button', { name: 'Failed' }));

        await waitFor(() => {
            expect(screen.queryByText('user@test.com')).toBeFalsy();
            expect(screen.getByText('attacker@test.com')).toBeTruthy();
        });
    });

    it('filters by search query', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('user@test.com')).toBeTruthy();
        });

        const searchInput = screen.getByPlaceholderText('Search by email or IP...');
        fireEvent.change(searchInput, { target: { value: 'attacker' } });

        await waitFor(() => {
            expect(screen.queryByText('user@test.com')).toBeFalsy();
            expect(screen.getByText('attacker@test.com')).toBeTruthy();
        });
    });

    it('displays IP address in attempts table', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('192.168.1.1')).toBeTruthy();
            expect(screen.getByText('10.0.0.1')).toBeTruthy();
        });
    });

    it('refreshes data when refresh button is clicked', async () => {
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('user@test.com')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshButton = screen.getByTitle('Refresh');
        fireEvent.click(refreshButton);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('shows empty state when no attempts', async () => {
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/stats')) return Promise.resolve(mockStats);
            if (url.includes('/lockouts')) return Promise.resolve({ lockouts: [] });
            if (url.includes('/login-attempts')) return Promise.resolve({ attempts: [] });
            return Promise.resolve({});
        });
        
        render(<LoginAttemptsPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No login attempts found')).toBeTruthy();
        });
    });
});

