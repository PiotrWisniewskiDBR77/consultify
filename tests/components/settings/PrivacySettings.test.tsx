/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrivacySettings } from '../../../components/settings/PrivacySettings';
import { Api } from '../../../services/api';


vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
};

const mockPreferences = {
    showOnlineStatus: true,
    activityVisibility: 'team',
    profileVisibility: 'organization',
    allowMentions: true,
    showInDirectory: true,
    shareActivityWithAI: true
};

describe('PrivacySettings Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ preferences: mockPreferences });
        (Api.put as any).mockResolvedValue({});
    });

    it('renders Privacy Settings heading', async () => {
        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText(/Privacy/i)).toBeInTheDocument();
        });
    });

    it('loads preferences on mount', async () => {
        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/preferences/privacy');
        });
    });

    it('renders all preference sections', async () => {
        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText(/Online Status/i)).toBeInTheDocument();
            expect(screen.getByText(/Activity Visibility/i)).toBeInTheDocument();
            expect(screen.getByText(/Profile Visibility/i)).toBeInTheDocument();
        });
    });

    it('toggles show online status', async () => {
        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText(/Online Status/i)).toBeInTheDocument();
        });

        const toggle = screen.getByRole('switch', { name: /online status/i });
        await user.click(toggle);

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalled();
        });
    });

    it('changes activity visibility', async () => {
        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText(/Activity Visibility/i)).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox', { name: /activity visibility/i });
        await user.selectOptions(select, 'private');

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalled();
        });
    });

    it('saves preferences when Save clicked', async () => {
        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText(/Save/i)).toBeInTheDocument();
        });

        const saveButton = screen.getByRole('button', { name: /save/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith('/settings/preferences/privacy', expect.objectContaining({
                preferences: expect.any(Object)
            }));
        });
    });

    it('shows loading state while fetching', () => {
        (Api.get as any).mockImplementation(() => new Promise(() => {}));

        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
        (Api.get as any).mockRejectedValue(new Error('Failed to load'));

        render(<PrivacySettings currentUser={mockUser as any} onUpdateUser={vi.fn()} />);

        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });
});









