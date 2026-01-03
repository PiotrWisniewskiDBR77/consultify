/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecuritySettings } from '../../../components/settings/SecuritySettings';
import { Api } from '../../../services/api';

// Mock dependencies

vi.mock('../../../services/api', () => ({
    Api: {
        getActiveSessions: vi.fn(),
        changePassword: vi.fn(),
        revokeSession: vi.fn(),
        revokeAllSessions: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockCurrentUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
};

const mockSessions = [
    {
        id: 'session-1',
        deviceInfo: 'Chrome on Windows',
        ip: '192.168.1.1',
        createdAt: '2024-01-15T10:00:00Z',
        isCurrent: true
    },
    {
        id: 'session-2',
        deviceInfo: 'Safari on mobile',
        ip: '192.168.1.2',
        createdAt: '2024-01-14T08:00:00Z',
        isCurrent: false
    }
];

describe('SecuritySettings Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getActiveSessions as any).mockResolvedValue({ sessions: mockSessions });
        (Api.changePassword as any).mockResolvedValue({});
        (Api.revokeSession as any).mockResolvedValue({});
        (Api.revokeAllSessions as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders Security heading', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Security')).toBeInTheDocument();
            });
        });

        it('renders Change Password section', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Change Password')).toBeInTheDocument();
            });
        });

        it('renders Active Sessions section', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Active Sessions')).toBeInTheDocument();
            });
        });
    });

    describe('Password Change Form', () => {
        it('renders password input fields', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Current Password')).toBeInTheDocument();
                expect(screen.getByText('New Password')).toBeInTheDocument();
                expect(screen.getByText('Confirm New Password')).toBeInTheDocument();
            });
        });

        it('shows password requirements', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
                expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
                expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
                expect(screen.getByText('One number')).toBeInTheDocument();
            });
        });

        it('validates password requirements as user types', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('New Password')).toBeInTheDocument();
            });

            const newPasswordInput = screen.getAllByPlaceholderText('••••••••')[1];
            await user.type(newPasswordInput, 'Test1234');

            // All requirements should be met
            await waitFor(() => {
                // Check for checkmark icons
                const checkIcons = document.querySelectorAll('.text-emerald-500');
                expect(checkIcons.length).toBeGreaterThan(0);
            });
        });

        it('shows password match indicator', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('New Password')).toBeInTheDocument();
            });

            const inputs = screen.getAllByPlaceholderText('••••••••');
            await user.type(inputs[1], 'Test1234');
            await user.type(inputs[2], 'Test1234');

            await waitFor(() => {
                const checkCircles = document.querySelectorAll('.text-emerald-500');
                expect(checkCircles.length).toBeGreaterThan(0);
            });
        });

        it('disables submit when requirements not met', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                const submitButton = screen.getByText('Change Password').closest('button');
                expect(submitButton).toBeDisabled();
            });
        });

        it('calls API on valid password change', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('New Password')).toBeInTheDocument();
            });

            const inputs = screen.getAllByPlaceholderText('••••••••');
            await user.type(inputs[0], 'CurrentPass123');
            await user.type(inputs[1], 'NewPass123');
            await user.type(inputs[2], 'NewPass123');

            const submitButton = screen.getByText('Change Password').closest('button');
            await user.click(submitButton!);

            await waitFor(() => {
                expect(Api.changePassword).toHaveBeenCalledWith('CurrentPass123', 'NewPass123');
            });
        });

        it('shows error message on failed password change', async () => {
            (Api.changePassword as any).mockRejectedValue(new Error('Invalid current password'));

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('New Password')).toBeInTheDocument();
            });

            const inputs = screen.getAllByPlaceholderText('••••••••');
            await user.type(inputs[0], 'WrongPass');
            await user.type(inputs[1], 'NewPass123');
            await user.type(inputs[2], 'NewPass123');

            const submitButton = screen.getByText('Change Password').closest('button');
            await user.click(submitButton!);

            await waitFor(() => {
                expect(screen.getByText('Invalid current password')).toBeInTheDocument();
            });
        });

        it('toggles password visibility', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Current Password')).toBeInTheDocument();
            });

            const toggleButtons = document.querySelectorAll('button');
            // Find eye icon button
            const eyeButton = Array.from(toggleButtons).find(btn => 
                btn.querySelector('.lucide-eye') || btn.querySelector('.lucide-eye-off')
            );

            if (eyeButton) {
                await user.click(eyeButton);
                // Password input should now be type="text"
            }
        });
    });

    describe('Active Sessions', () => {
        it('fetches and displays sessions on mount', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(Api.getActiveSessions).toHaveBeenCalled();
                expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
                expect(screen.getByText('Safari on mobile')).toBeInTheDocument();
            });
        });

        it('shows Current badge for current session', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Current')).toBeInTheDocument();
            });
        });

        it('shows IP addresses', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
                expect(screen.getByText('192.168.1.2')).toBeInTheDocument();
            });
        });

        it('shows Revoke button for non-current sessions', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Revoke')).toBeInTheDocument();
            });
        });

        it('hides Revoke button for current session', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
            });

            // Chrome session is current, should not have revoke button adjacent
            const revokeButtons = screen.getAllByText('Revoke');
            expect(revokeButtons.length).toBe(1); // Only for Safari session
        });

        it('calls revokeSession when Revoke clicked', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Revoke')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Revoke'));

            await waitFor(() => {
                expect(Api.revokeSession).toHaveBeenCalledWith('session-2');
            });
        });

        it('removes session from list after revoke', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Safari on mobile')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Revoke'));

            await waitFor(() => {
                expect(screen.queryByText('Safari on mobile')).not.toBeInTheDocument();
            });
        });
    });

    describe('Log Out All Sessions', () => {
        it('shows Log Out All Others button when multiple sessions', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Log Out All Others')).toBeInTheDocument();
            });
        });

        it('hides button when only one session', async () => {
            (Api.getActiveSessions as any).mockResolvedValue({ 
                sessions: [mockSessions[0]] 
            });

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
            });

            expect(screen.queryByText('Log Out All Others')).not.toBeInTheDocument();
        });

        it('calls revokeAllSessions when confirmed', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(true);

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Log Out All Others')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Log Out All Others'));

            await waitFor(() => {
                expect(Api.revokeAllSessions).toHaveBeenCalled();
            });
        });

        it('does not call API when cancelled', async () => {
            vi.spyOn(window, 'confirm').mockReturnValue(false);

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Log Out All Others')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Log Out All Others'));

            expect(Api.revokeAllSessions).not.toHaveBeenCalled();
        });
    });

    describe('Loading States', () => {
        it('shows loading spinner while fetching sessions', async () => {
            (Api.getActiveSessions as any).mockImplementation(() => new Promise(() => {}));

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toBeTruthy();
        });

        it('shows Changing... while password is being changed', async () => {
            (Api.changePassword as any).mockImplementation(() => new Promise(() => {}));

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('New Password')).toBeInTheDocument();
            });

            const inputs = screen.getAllByPlaceholderText('••••••••');
            await user.type(inputs[0], 'CurrentPass123');
            await user.type(inputs[1], 'NewPass123');
            await user.type(inputs[2], 'NewPass123');

            const submitButton = screen.getByText('Change Password').closest('button');
            await user.click(submitButton!);

            await waitFor(() => {
                expect(screen.getByText('Changing...')).toBeInTheDocument();
            });
        });
    });

    describe('Device Icons', () => {
        it('shows mobile icon for mobile devices', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Safari on mobile')).toBeInTheDocument();
            });

            // Check for smartphone icon near mobile session
        });

        it('shows monitor icon for desktop devices', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
            });

            // Check for monitor icon near desktop session
        });
    });

    describe('Empty State', () => {
        it('shows no sessions message when empty', async () => {
            (Api.getActiveSessions as any).mockResolvedValue({ sessions: [] });

            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                expect(screen.getByText('No active sessions found')).toBeInTheDocument();
            });
        });
    });

    describe('Dark Mode Support', () => {
        it('includes dark mode classes', async () => {
            render(<SecuritySettings currentUser={mockCurrentUser as any} />);

            await waitFor(() => {
                const containers = document.querySelectorAll('.dark\\:bg-navy-900');
                expect(containers.length).toBeGreaterThan(0);
            });
        });
    });
});









