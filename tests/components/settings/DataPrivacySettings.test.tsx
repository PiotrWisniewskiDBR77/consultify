/**
 * @vitest-environment jsdom
 * DataPrivacySettings Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataPrivacySettings } from '../../../components/settings/DataPrivacySettings';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn()
    }
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback
    })
}));

// Mock window.alert
const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
};

const mockPrivacySettings = {
    preferences: {
        shareAnalytics: true,
        shareUsageData: false,
        improveAI: true,
        marketingEmails: false,
        productUpdates: true,
        newsletterSubscribed: false,
        allowThirdPartyIntegrations: true,
        dataRetentionPolicy: 'standard',
        enablePiiRedaction: false
    }
};

describe('DataPrivacySettings Component', () => {
    const user = userEvent.setup();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockPrivacySettings);
        (Api.put as any).mockResolvedValue({});
        (Api.post as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('renders the section title', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Data & Privacy')).toBeInTheDocument();
            });
        });

        it('renders data sharing section', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Data Sharing')).toBeInTheDocument();
            });
        });

        it('renders communication preferences section', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Communication Preferences')).toBeInTheDocument();
            });
        });

        it('renders data retention section', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Data Retention')).toBeInTheDocument();
            });
        });

        it('renders security section', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Security')).toBeInTheDocument();
            });
        });

        it('renders export data section', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Export Your Data')).toBeInTheDocument();
            });
        });

        it('renders danger zone section', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Danger Zone')).toBeInTheDocument();
            });
        });
    });

    describe('Data Sharing Toggles', () => {
        it('renders share analytics toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Share analytics data')).toBeInTheDocument();
            });
        });

        it('renders share usage data toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Share detailed usage data')).toBeInTheDocument();
            });
        });

        it('renders improve AI toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Help improve AI')).toBeInTheDocument();
            });
        });

        it('shows analytics as enabled by default', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const container = screen.getByText('Share analytics data').closest('div')?.parentElement;
                const toggle = container?.querySelector('button[class*="rounded-full"]');
                expect(toggle).toHaveClass('bg-purple-500');
            });
        });
    });

    describe('Communication Preferences', () => {
        it('renders product updates toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Product updates')).toBeInTheDocument();
            });
        });

        it('renders marketing emails toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Marketing emails')).toBeInTheDocument();
            });
        });

        it('renders newsletter toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Newsletter subscription')).toBeInTheDocument();
            });
        });
    });

    describe('Data Retention Options', () => {
        it('renders retention policy options', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Minimal')).toBeInTheDocument();
                expect(screen.getByText('Standard')).toBeInTheDocument();
                expect(screen.getByText('Extended')).toBeInTheDocument();
            });
        });

        it('shows standard as selected by default', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const standardButton = screen.getByText('Standard').closest('button');
                expect(standardButton).toHaveClass('border-purple-500');
            });
        });

        it('changes retention policy on click', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Minimal')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Minimal'));

            await waitFor(() => {
                const minimalButton = screen.getByText('Minimal').closest('button');
                expect(minimalButton).toHaveClass('border-purple-500');
            });
        });
    });

    describe('Security Options', () => {
        it('renders PII redaction toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable PII redaction')).toBeInTheDocument();
            });
        });

        it('renders third-party integrations toggle', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Allow third-party integrations')).toBeInTheDocument();
            });
        });
    });

    describe('Data Export', () => {
        it('renders export button', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Data Export')).toBeInTheDocument();
            });
        });

        it('calls API on export request', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Data Export')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Data Export'));

            await waitFor(() => {
                expect(Api.post).toHaveBeenCalledWith('/settings/export-data', {});
            });
        });

        it('shows preparing state during export', async () => {
            (Api.post as any).mockImplementation(() => new Promise(() => {}));

            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Data Export')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Data Export'));

            await waitFor(() => {
                expect(screen.getByText('Preparing...')).toBeInTheDocument();
            });
        });

        it('shows success alert after export request', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Data Export')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Data Export'));

            await waitFor(() => {
                expect(mockAlert).toHaveBeenCalledWith('Data export requested. You will receive an email when ready.');
            });
        });

        it('renders info note about export', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText(/You will receive an email with a download link/)).toBeInTheDocument();
            });
        });
    });

    describe('Account Deletion', () => {
        it('renders account deletion button', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });
        });

        it('shows confirmation dialog on deletion click', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Account Deletion'));

            await waitFor(() => {
                expect(screen.getByText('Are you sure?')).toBeInTheDocument();
            });
        });

        it('shows email confirmation input', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Account Deletion'));

            await waitFor(() => {
                expect(screen.getByPlaceholderText('test@example.com')).toBeInTheDocument();
            });
        });

        it('disables delete button until email matches', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Account Deletion'));

            await waitFor(() => {
                const deleteButton = screen.getByText('Delete My Account');
                expect(deleteButton.closest('button')).toBeDisabled();
            });
        });

        it('enables delete button when email matches', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Account Deletion'));

            await waitFor(() => {
                expect(screen.getByPlaceholderText('test@example.com')).toBeInTheDocument();
            });

            await user.type(screen.getByPlaceholderText('test@example.com'), 'test@example.com');

            await waitFor(() => {
                const deleteButton = screen.getByText('Delete My Account');
                expect(deleteButton.closest('button')).not.toBeDisabled();
            });
        });

        it('shows cancel button in confirmation dialog', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Account Deletion'));

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });
        });

        it('hides confirmation dialog on cancel', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Request Account Deletion')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Request Account Deletion'));

            await waitFor(() => {
                expect(screen.getByText('Cancel')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Cancel'));

            await waitFor(() => {
                expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
            });
        });
    });

    describe('Form Submission', () => {
        it('calls API on save', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(Api.put).toHaveBeenCalledWith('/settings/preferences/privacy', expect.any(Object));
            });
        });

        it('shows success toast on save', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByText('Saved!')).toBeInTheDocument();
            });
        });

        it('calls onUpdate callback after successful save', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalled();
            });
        });
    });

    describe('Loading Data', () => {
        it('loads privacy settings on mount', async () => {
            render(<DataPrivacySettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith('/settings/preferences/privacy');
            });
        });
    });
});






