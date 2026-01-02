/**
 * @vitest-environment jsdom
 * ProfileVisibilitySettings Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileVisibilitySettings } from '../../../components/settings/ProfileVisibilitySettings';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn()
    }
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback
    })
}));

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
};

const mockVisibilitySettings = {
    visibility: {
        profile: 'organization',
        showEmail: false,
        showPhone: false,
        showActivityStatus: true,
        showLastSeen: true,
        showInDirectory: true,
        allowMentionsFrom: 'all',
        allowDirectMessagesFrom: 'all'
    }
};

describe('ProfileVisibilitySettings Component', () => {
    const user = userEvent.setup();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockVisibilitySettings);
        (Api.put as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('renders the section title', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Privacy & Visibility')).toBeInTheDocument();
            });
        });

        it('renders profile visibility section', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
            });
        });

        it('renders contact visibility section', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Contact Information')).toBeInTheDocument();
            });
        });

        it('renders activity status section', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Activity Status')).toBeInTheDocument();
            });
        });

        it('renders communication settings section', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Communication Settings')).toBeInTheDocument();
            });
        });
    });

    describe('Profile Visibility Options', () => {
        it('renders all visibility options', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Public')).toBeInTheDocument();
                expect(screen.getByText('Organization')).toBeInTheDocument();
                expect(screen.getByText('Team Only')).toBeInTheDocument();
                expect(screen.getByText('Private')).toBeInTheDocument();
            });
        });

        it('shows Organization as selected by default', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const orgButton = screen.getByText('Organization').closest('button');
                expect(orgButton).toHaveClass('border-purple-500');
            });
        });

        it('selects visibility option on click', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Public')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Public'));

            await waitFor(() => {
                const publicButton = screen.getByText('Public').closest('button');
                expect(publicButton).toHaveClass('border-purple-500');
            });
        });
    });

    describe('Contact Information Toggles', () => {
        it('renders show email toggle', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show email address')).toBeInTheDocument();
            });
        });

        it('renders show phone toggle', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show phone number')).toBeInTheDocument();
            });
        });

        it('renders show in directory toggle', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show in team directory')).toBeInTheDocument();
            });
        });

        it('toggles email visibility on click', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show email address')).toBeInTheDocument();
            });

            // Find toggle buttons - they are the rounded-full buttons
            const toggleButtons = document.querySelectorAll('button[class*="rounded-full"]');
            expect(toggleButtons.length).toBeGreaterThan(0);
            
            // Click the first toggle (show email)
            if (toggleButtons[0]) {
                await user.click(toggleButtons[0] as HTMLElement);
            }

            // Component should still be rendered
            await waitFor(() => {
                expect(screen.getByText('Show email address')).toBeInTheDocument();
            });
        });
    });

    describe('Activity Status Toggles', () => {
        it('renders online status toggle', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show online status')).toBeInTheDocument();
            });
        });

        it('renders last seen toggle', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show last seen')).toBeInTheDocument();
            });
        });
    });

    describe('Communication Settings', () => {
        it('renders mentions settings', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Allow @mentions from')).toBeInTheDocument();
            });
        });

        it('renders DM settings', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Allow direct messages from')).toBeInTheDocument();
            });
        });

        it('shows allow from options', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                // Should have multiple "Everyone" buttons for mentions and DMs
                expect(screen.getAllByText('Everyone').length).toBeGreaterThanOrEqual(2);
                expect(screen.getAllByText('Team members only').length).toBeGreaterThanOrEqual(2);
                expect(screen.getAllByText('Nobody').length).toBeGreaterThanOrEqual(2);
            });
        });
    });

    describe('Form Submission', () => {
        it('calls API on save', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(Api.put).toHaveBeenCalledWith('/profile/visibility', expect.any(Object));
            });
        });

        it('shows saving state', async () => {
            (Api.put as any).mockImplementation(() => new Promise(() => {}));

            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByText('Saving...')).toBeInTheDocument();
            });
        });

        it('shows success toast on save', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByText('Saved!')).toBeInTheDocument();
            });
        });
    });

    describe('Privacy Note', () => {
        it('renders privacy note', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Privacy Note')).toBeInTheDocument();
            });
        });

        it('shows administrator notice', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText(/Administrators can always view/)).toBeInTheDocument();
            });
        });
    });

    describe('Data Loading', () => {
        it('loads visibility settings on mount', async () => {
            render(<ProfileVisibilitySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith('/profile/visibility');
            });
        });
    });
});

