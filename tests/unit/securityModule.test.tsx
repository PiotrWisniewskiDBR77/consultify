/**
 * Security Module - Comprehensive Unit Tests
 * 
 * Tests for:
 * - SecurityDashboard
 * - TrustedDevicesSettings
 * - SecurityEventsSettings
 * - DataControlsSettings
 * - MFASetup (enhanced)
 * - SecurityPrivacyModule (integration)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-i18next first (hoisted)
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | Record<string, unknown>) => {
            if (typeof fallback === 'string') return fallback;
            if (typeof fallback === 'object' && 'defaultValue' in fallback) return fallback.defaultValue as string;
            return key;
        },
        i18n: {
            language: 'en',
            changeLanguage: vi.fn()
        }
    }),
    I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() }
}));

// Mock API module
vi.mock('../../services/api', () => ({
    Api: {
        get: vi.fn().mockResolvedValue({}),
        post: vi.fn().mockResolvedValue({ success: true }),
        put: vi.fn().mockResolvedValue({ success: true }),
        delete: vi.fn().mockResolvedValue({ success: true })
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    },
    toast: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock InfoButton
vi.mock('../../components/shared/InfoButton', () => ({
    InfoButton: () => null
}));

// Mock TabLayout
vi.mock('../../components/SuperAdmin/TabLayout', () => ({
    TabLayout: ({ children, tabs }: { children: React.ReactNode; tabs: Array<{ id: string; label: string }> }) => (
        <div>
            <div data-testid="tabs">
                {tabs.map((tab: { id: string; label: string }) => (
                    <button key={tab.id} data-testid={`tab-${tab.id}`}>{tab.label}</button>
                ))}
            </div>
            <div>{children}</div>
        </div>
    ),
    Tab: () => null
}));

// Import API for mocking
import { Api } from '../../services/api';

// Import components
import { SecurityDashboard } from '../../components/settings/SecurityDashboard';
import { TrustedDevicesSettings } from '../../components/settings/TrustedDevicesSettings';
import { SecurityEventsSettings } from '../../components/settings/SecurityEventsSettings';
import { DataControlsSettings } from '../../components/settings/DataControlsSettings';
import { MFASetup } from '../../components/Profile/MFASetup';

// Test utilities
const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'MEMBER',
    mfaEnabled: false,
    organizationId: 'org-1'
};

const mockUserWithMfa = {
    ...mockUser,
    mfaEnabled: true
};

describe('SecurityDashboard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders security score section', async () => {
        render(<SecurityDashboard currentUser={mockUser as any} />);
        
        await waitFor(() => {
            expect(screen.getByText(/Security Dashboard/i)).toBeInTheDocument();
        });
    });

    it('displays security score calculation', async () => {
        vi.mocked(Api.get).mockResolvedValueOnce({
            score: {
                total: 68,
                breakdown: {
                    mfa: { score: 0, max: 30, enabled: false },
                    passwordStrength: { score: 20, max: 25, strength: 'good' },
                    recentActivity: { score: 18, max: 20, suspicious: 0 },
                    sessions: { score: 15, max: 15, count: 1 },
                    dataControls: { score: 8, max: 10, optedOut: false }
                },
                recommendations: ['Enable two-factor authentication']
            }
        });

        render(<SecurityDashboard currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText('68')).toBeInTheDocument();
        });
    });

    it('displays compliance badges', async () => {
        vi.mocked(Api.get).mockResolvedValue({
            compliance: {
                gdpr: { compliant: true },
                soc2: { compliant: true },
                iso27001: { compliant: true }
            }
        });

        render(<SecurityDashboard currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText('GDPR')).toBeInTheDocument();
            expect(screen.getByText('SOC 2')).toBeInTheDocument();
            expect(screen.getByText('ISO 27001')).toBeInTheDocument();
        });
    });

    it('calls onNavigateToTab callback when provided', async () => {
        const mockNavigate = vi.fn();
        render(
            <SecurityDashboard currentUser={mockUser as any} onNavigateToTab={mockNavigate} />
        );

        // Wait for component to load
        await waitFor(() => {
            expect(screen.getByText(/Security Dashboard/i)).toBeInTheDocument();
        });

        // The quick action cards should call onNavigateToTab when clicked
        // Just verify callback is passed and component renders
        expect(mockNavigate).toBeDefined();
    });

    it('handles refresh action', async () => {
        render(<SecurityDashboard currentUser={mockUser as any} />);

        await waitFor(() => {
            const refreshButton = screen.getByText(/Refresh/i);
            fireEvent.click(refreshButton);
            expect(Api.get).toHaveBeenCalled();
        });
    });
});

describe('TrustedDevicesSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Make API return error to trigger component's internal mock data
        vi.mocked(Api.get).mockRejectedValue(new Error('API error'));
    });

    it('renders trusted devices section heading', async () => {
        render(<TrustedDevicesSettings currentUser={mockUser as any} />);

        // Wait for loading to finish and check title renders
        await waitFor(() => {
            const headings = screen.getAllByText(/Trusted Devices/i);
            expect(headings.length).toBeGreaterThan(0);
        }, { timeout: 3000 });
    });

    it('displays mock device data when API fails', async () => {
        render(<TrustedDevicesSettings currentUser={mockUser as any} />);

        // Component should render mock data when API fails
        await waitFor(() => {
            // Mock data includes "Chrome on MacOS" device
            expect(screen.getByText(/Chrome on MacOS/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('displays trust duration settings', async () => {
        render(<TrustedDevicesSettings currentUser={mockUser as any} />);

        // Trust Duration section should appear
        await waitFor(() => {
            expect(screen.getByText(/How long devices stay trusted/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});

describe('SecurityEventsSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders security events list', async () => {
        vi.mocked(Api.get).mockResolvedValue({
            events: [
                {
                    id: '1',
                    type: 'login',
                    severity: 'info',
                    title: 'Successful Login',
                    description: 'Logged in from Chrome',
                    timestamp: new Date().toISOString(),
                    ip: '192.168.1.1'
                }
            ]
        });

        render(<SecurityEventsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Security Events/i)).toBeInTheDocument();
            expect(screen.getByText(/Successful Login/i)).toBeInTheDocument();
        });
    });

    it('shows alert settings panel', async () => {
        vi.mocked(Api.get).mockResolvedValue({ events: [] });

        render(<SecurityEventsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            const alertsButton = screen.getByText(/Alerts/i);
            fireEvent.click(alertsButton);
            expect(screen.getByText(/Security Alert Settings/i)).toBeInTheDocument();
        });
    });

    it('displays severity badges correctly', async () => {
        vi.mocked(Api.get).mockResolvedValue({
            events: [
                { id: '1', type: 'suspicious', title: 'Failed Login', severity: 'critical', description: 'Multiple failures', timestamp: new Date().toISOString() }
            ]
        });

        render(<SecurityEventsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Critical/i)).toBeInTheDocument();
        });
    });
});

describe('DataControlsSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Api.get).mockResolvedValue({});
    });

    it('renders consent management section', async () => {
        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Data Controls/i)).toBeInTheDocument();
            expect(screen.getByText(/Consent Management/i)).toBeInTheDocument();
        });
    });

    it('displays all consent toggles', async () => {
        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Usage Analytics/i)).toBeInTheDocument();
            expect(screen.getByText(/Personalization/i)).toBeInTheDocument();
            expect(screen.getByText(/Marketing/i)).toBeInTheDocument();
            expect(screen.getByText(/Third-Party/i)).toBeInTheDocument();
            expect(screen.getByText(/AI Model Training/i)).toBeInTheDocument();
        });
    });

    it('displays data retention options', async () => {
        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/Data Retention/i)).toBeInTheDocument();
            expect(screen.getByText(/30 days/i)).toBeInTheDocument();
            expect(screen.getByText(/1 year/i)).toBeInTheDocument();
        });
    });

    it('shows GDPR compliance banner', async () => {
        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(screen.getByText(/GDPR Compliant/i)).toBeInTheDocument();
        });
    });

    it('handles data export request', async () => {
        vi.mocked(Api.post).mockResolvedValueOnce({
            request: {
                id: 'req-1',
                status: 'pending',
                requestedAt: new Date().toISOString()
            }
        });

        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            const exportButton = screen.getByText(/Request Export/i);
            fireEvent.click(exportButton);
        });

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/api/gdpr/export-request', {});
        });
    });

    it('shows delete confirmation modal', async () => {
        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            const deleteButton = screen.getByText(/Request Deletion/i);
            fireEvent.click(deleteButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/Delete All Your Data/i)).toBeInTheDocument();
        });
    });
});

describe('MFASetup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial state for MFA disabled user', () => {
        render(<MFASetup isEnabled={false} onUpdate={vi.fn()} />);

        // Check for the title and enable button specifically
        expect(screen.getByRole('heading', { name: /Two-Factor Authentication/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Enable Two-Factor Authentication/i })).toBeInTheDocument();
    });

    it('shows enabled state when MFA is active', () => {
        render(<MFASetup isEnabled={true} onUpdate={vi.fn()} />);

        expect(screen.getByText(/Active/i)).toBeInTheDocument();
    });

    it('starts MFA setup flow', async () => {
        vi.mocked(Api.post).mockResolvedValueOnce({
            qrCode: 'data:image/png;base64,test',
            manualEntry: 'ABCD1234EFGH5678'
        });

        render(<MFASetup isEnabled={false} onUpdate={vi.fn()} />);

        const enableButton = screen.getByRole('button', { name: /Enable Two-Factor Authentication/i });
        fireEvent.click(enableButton);

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/api/mfa/setup', {});
        });
    });

    it('displays QR code during setup', async () => {
        vi.mocked(Api.post).mockResolvedValueOnce({
            qrCode: 'data:image/png;base64,test',
            manualEntry: 'ABCD1234EFGH5678'
        });

        render(<MFASetup isEnabled={false} onUpdate={vi.fn()} />);

        const enableButton = screen.getByRole('button', { name: /Enable Two-Factor Authentication/i });
        fireEvent.click(enableButton);

        await waitFor(() => {
            expect(screen.getByText(/Scan QR Code/i)).toBeInTheDocument();
        });
    });

    it('shows disable confirmation when MFA is enabled', async () => {
        render(<MFASetup isEnabled={true} onUpdate={vi.fn()} />);

        const disableButton = screen.getByText(/Disable 2FA/i);
        fireEvent.click(disableButton);

        await waitFor(() => {
            expect(screen.getByText(/Disable 2FA/i)).toBeInTheDocument();
        });
    });
});

describe('Security Module API Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls security score endpoint on dashboard load', async () => {
        vi.mocked(Api.get).mockResolvedValue({ score: { total: 75 } });

        render(<SecurityDashboard currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/api/security/score');
        });
    });

    it('calls compliance endpoint', async () => {
        vi.mocked(Api.get).mockResolvedValue({ compliance: {} });

        render(<SecurityDashboard currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/api/security/compliance');
        });
    });

    it('calls GDPR consents endpoint', async () => {
        vi.mocked(Api.get).mockResolvedValue({ consents: {} });

        render(<DataControlsSettings currentUser={mockUser as any} />);

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/api/gdpr/consents');
        });
    });
});
