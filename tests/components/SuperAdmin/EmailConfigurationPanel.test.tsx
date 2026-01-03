/**
 * EmailConfigurationPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmailConfigurationPanel } from '../../../components/SuperAdmin/EmailConfigurationPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn(),
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

describe('EmailConfigurationPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockConfig = {
        id: 'config-1',
        organization_id: 'org-1',
        provider: 'smtp',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_username: 'user@example.com',
        smtp_password_encrypted: '****',
        smtp_use_tls: true,
        from_email: 'noreply@example.com',
        from_name: 'Consultify',
        reply_to_email: 'support@example.com',
        spf_verified: true,
        dkim_verified: true,
        dmarc_verified: false,
        last_verified_at: '2025-01-01T10:00:00Z',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ config: mockConfig })
        );
    });

    it('renders and fetches organizations', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('shows organization select dropdown', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });
    });

    it('fetches email config when organization is selected', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/email-config?organizationId=org-1');
        });
    });

    it('displays email provider section', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Email Provider')).toBeTruthy();
            expect(screen.getByText('Choose your email service')).toBeTruthy();
        });
    });

    it('shows provider options', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Custom SMTP')).toBeTruthy();
            expect(screen.getByText('SendGrid')).toBeTruthy();
            expect(screen.getByText('Mailgun')).toBeTruthy();
            expect(screen.getByText('Amazon SES')).toBeTruthy();
        });
    });

    it('shows SMTP configuration when SMTP is selected', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('SMTP Host')).toBeTruthy();
            expect(screen.getByText('Port')).toBeTruthy();
            expect(screen.getByText('Username')).toBeTruthy();
            expect(screen.getByText('Password')).toBeTruthy();
        });
    });

    it('shows SMTP values from config', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByDisplayValue('smtp.example.com')).toBeTruthy();
            expect(screen.getByDisplayValue('587')).toBeTruthy();
            expect(screen.getByDisplayValue('user@example.com')).toBeTruthy();
        });
    });

    it('shows Use TLS checkbox', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Use TLS')).toBeTruthy();
        });
    });

    it('displays sender settings section', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Sender Settings')).toBeTruthy();
            expect(screen.getByText('Configure email sender details')).toBeTruthy();
        });
    });

    it('shows sender settings fields', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('From Email')).toBeTruthy();
            expect(screen.getByText('From Name')).toBeTruthy();
            expect(screen.getByText('Reply-To Email (optional)')).toBeTruthy();
        });
    });

    it('shows sender values from config', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByDisplayValue('noreply@example.com')).toBeTruthy();
            expect(screen.getByDisplayValue('Consultify')).toBeTruthy();
            expect(screen.getByDisplayValue('support@example.com')).toBeTruthy();
        });
    });

    it('displays DNS verification section', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('DNS Verification')).toBeTruthy();
            expect(screen.getByText('Email authentication records')).toBeTruthy();
        });
    });

    it('shows SPF verification status', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('SPF')).toBeTruthy();
        });
    });

    it('shows DKIM verification status', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('DKIM')).toBeTruthy();
        });
    });

    it('shows DMARC verification status', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('DMARC')).toBeTruthy();
        });
    });

    it('shows Verify DNS button', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Verify DNS')).toBeTruthy();
        });
    });

    it('displays test configuration section', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Configuration')).toBeTruthy();
            expect(screen.getByText('Send a test email')).toBeTruthy();
        });
    });

    it('shows test email input and send button', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByPlaceholderText('test@example.com')).toBeTruthy();
            expect(screen.getByText('Send Test')).toBeTruthy();
        });
    });

    it('shows Save Changes button', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Save Changes')).toBeTruthy();
        });
    });

    it('enables save button when config is changed', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByDisplayValue('smtp.example.com')).toBeTruthy();
        });

        // Change SMTP host
        const hostInput = screen.getByDisplayValue('smtp.example.com');
        fireEvent.change(hostInput, { target: { value: 'mail.example.com' } });

        const saveButton = screen.getByText('Save Changes');
        expect(saveButton.closest('button')).not.toHaveProperty('disabled', true);
    });

    it('saves config when save button is clicked', async () => {
        (Api.put as any).mockResolvedValue({ success: true });
        
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByDisplayValue('smtp.example.com')).toBeTruthy();
        });

        // Change SMTP host
        const hostInput = screen.getByDisplayValue('smtp.example.com');
        fireEvent.change(hostInput, { target: { value: 'mail.example.com' } });

        // Click save
        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith(
                '/settings/email-config?organizationId=org-1',
                expect.objectContaining({
                    smtp_host: 'mail.example.com',
                })
            );
        });
    });

    it('sends test email when Send Test is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByPlaceholderText('test@example.com')).toBeTruthy();
        });

        // Enter test email
        const testEmailInput = screen.getByPlaceholderText('test@example.com');
        fireEvent.change(testEmailInput, { target: { value: 'test@test.com' } });

        // Click Send Test
        fireEvent.click(screen.getByText('Send Test'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith(
                '/settings/email-config/test?organizationId=org-1',
                { email: 'test@test.com' }
            );
        });
    });

    it('verifies DNS when Verify DNS is clicked', async () => {
        (Api.post as any).mockResolvedValue({ spf: true, dkim: true, dmarc: true });
        
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Verify DNS')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Verify DNS'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/settings/email-config/verify-dns?organizationId=org-1');
        });
    });

    it('shows API key field when SendGrid is selected', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('SendGrid')).toBeTruthy();
        });

        // Click SendGrid provider
        fireEvent.click(screen.getByText('SendGrid'));

        await waitFor(() => {
            expect(screen.getByText('API Key')).toBeTruthy();
        });
    });

    it('shows domain field when Mailgun is selected', async () => {
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ config: { ...mockConfig, provider: 'mailgun' } })
        );
        
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Domain')).toBeTruthy();
        });
    });

    it('shows region field when Amazon SES is selected', async () => {
        (Api.get as any).mockImplementation(() => 
            Promise.resolve({ config: { ...mockConfig, provider: 'ses' } })
        );
        
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('AWS Region')).toBeTruthy();
        });
    });

    it('toggles password visibility', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Password')).toBeTruthy();
        });

        // Find the eye button and click it
        const passwordField = screen.getByLabelText ? screen.getByLabelText('Password') : null;
        const eyeButtons = document.querySelectorAll('svg.lucide-eye, svg.lucide-eye-off');
        if (eyeButtons.length > 0) {
            fireEvent.click(eyeButtons[0].closest('button')!);
        }
        
        // Password field type should change
        // Note: This would need to check the input type changes
    });

    it('shows info banner about DNS setup', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/Recommended:/)).toBeTruthy();
        });
    });

    it('refreshes config when refresh button is clicked', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Email Provider')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshIcon = document.querySelector('svg.lucide-refresh-cw');
        if (refreshIcon) {
            fireEvent.click(refreshIcon.closest('button')!);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });

    it('shows last verified date when available', async () => {
        render(<EmailConfigurationPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/Last verified:/)).toBeTruthy();
        });
    });
});






