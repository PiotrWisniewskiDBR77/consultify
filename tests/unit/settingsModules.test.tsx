/**
 * Settings Modules Unit Tests
 * 
 * Comprehensive tests for the 6-module User Settings structure.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';

// Mock the store
import { Api } from '../../services/api';
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn(() => ({
        currentView: 'SETTINGS_PROFILE_MODULE',
        setCurrentView: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebarCollapse: vi.fn(),
    })),
}));

// Mock the API
vi.mock('../../services/api', () => ({
    Api: {
        updateUserProfile: vi.fn().mockResolvedValue({}),
        getFeedback: vi.fn().mockResolvedValue([]),
        getUser: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
        updatePreferences: vi.fn().mockResolvedValue({}),
        getSessions: vi.fn().mockResolvedValue([]),
        getActiveSessions: vi.fn().mockResolvedValue({
            sessions: [
                { id: '1', current: true, deviceInfo: 'Current Device' },
                { id: '2', current: false, deviceInfo: 'Other Device' }
            ]
        }),
        getLoginHistory: vi.fn().mockResolvedValue([]),
        clearAIMemory: vi.fn().mockResolvedValue({}),
        clearChatHistory: vi.fn().mockResolvedValue({}),
        exportUserData: vi.fn().mockResolvedValue({ data: {} }),
        getIntegrations: vi.fn().mockResolvedValue([]),
        getApiKeys: vi.fn().mockResolvedValue([]),
        getWebhooks: vi.fn().mockResolvedValue([]),
        getCalendarConnections: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue({}),
        getLLMProviders: vi.fn().mockResolvedValue([]),
        getNotificationPreferences: vi.fn().mockResolvedValue({}),
        checkLLMProvidersHealth: vi.fn().mockResolvedValue([]),
    },
}));

// Import components
import { SettingsSidebar, SettingsSection, settingsSectionToAppView, appViewToSettingsSection } from '../../components/SettingsSidebar';
import { ProfileModule } from '../../views/settings/ProfileModule';
import { AIPreferencesModule } from '../../views/settings/AIPreferencesModule';
import { NotificationsModule } from '../../views/settings/NotificationsModule';
import { SecurityPrivacyModule } from '../../views/settings/SecurityPrivacyModule';
import { IntegrationsModule } from '../../views/settings/IntegrationsModule';
import { AppearanceModule } from '../../views/settings/AppearanceModule';
import { AppView } from '../../types';

import { MemoryRouter } from 'react-router-dom';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter>
        <I18nextProvider i18n={i18n}>
            {children}
        </I18nextProvider>
    </MemoryRouter>
);

// Mock user for tests
const mockUser = {
    id: '1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'user' as const,
    companyName: 'Test Company',
    avatar: '',
    preferences: {},
    extended_preferences: {},
    preferredLanguage: 'en',
};

const mockOnUpdateUser = vi.fn();
const mockToggleTheme = vi.fn();

// =============================================================================
// SETTINGS SIDEBAR TESTS
// =============================================================================

describe('SettingsSidebar', () => {
    const mockOnSectionChange = vi.fn();
    const mockOnBackToApp = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders all 6 module items', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            expect(screen.getAllByText(/profile/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/ai/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/notification/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/integration/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/appearance/i).length).toBeGreaterThan(0);
        });

        it('displays user email', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            expect(screen.getAllByText('user@example.com').length).toBeGreaterThan(0);
        });

        it('displays user name when provided', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserName="John Doe"
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            expect(screen.getByText('John Doe')).toBeTruthy();
        });

        it('renders back to app button', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            expect(screen.getByText(/back to app/i)).toBeTruthy();
        });
    });

    describe('Navigation', () => {
        it('calls onSectionChange when clicking Profile module', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="security"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const profileButton = screen.getByText(/profile/i);
            fireEvent.click(profileButton);

            expect(mockOnSectionChange).toHaveBeenCalledWith('profile');
        });

        it('calls onSectionChange when clicking AI Preferences module', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const aiButton = screen.getByText(/ai/i);
            fireEvent.click(aiButton);

            expect(mockOnSectionChange).toHaveBeenCalledWith('ai-preferences');
        });

        it('calls onSectionChange when clicking Security module', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const securityButton = screen.getByText(/security/i);
            fireEvent.click(securityButton);

            expect(mockOnSectionChange).toHaveBeenCalledWith('security');
        });

        it('calls onBackToApp when clicking back button', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const backButton = screen.getByText(/back to app/i);
            fireEvent.click(backButton);

            expect(mockOnBackToApp).toHaveBeenCalled();
        });
    });

    describe('Active State', () => {
        it('highlights Profile when active', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="profile"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const profileButton = screen.getByText(/profile/i).closest('button');
            expect(profileButton?.className).toContain('border-l-2');
        });

        it('highlights Security when active', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="security"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const securityButton = screen.getByText(/security/i).closest('button');
            expect(securityButton?.className).toContain('border-l-2');
        });

        it('highlights Appearance when active', () => {
            render(
                <TestWrapper>
                    <SettingsSidebar
                        activeSection="appearance"
                        onSectionChange={mockOnSectionChange}
                        onBackToApp={mockOnBackToApp}
                        currentUserEmail="user@example.com"
                    />
                </TestWrapper>
            );

            const appearanceButton = screen.getByText(/appearance/i).closest('button');
            expect(appearanceButton?.className).toContain('border-l-2');
        });
    });
});

// =============================================================================
// VIEW TO SECTION MAPPINGS TESTS
// =============================================================================

describe('settingsSectionToAppView mapping', () => {
    it('maps profile to SETTINGS_PROFILE_MODULE', () => {
        expect(settingsSectionToAppView['profile']).toBe(AppView.SETTINGS_PROFILE_MODULE);
    });

    it('maps ai-preferences to SETTINGS_AI_MODULE', () => {
        expect(settingsSectionToAppView['ai-preferences']).toBe(AppView.SETTINGS_AI_MODULE);
    });

    it('maps notifications to SETTINGS_NOTIFICATIONS_MODULE', () => {
        expect(settingsSectionToAppView['notifications']).toBe(AppView.SETTINGS_NOTIFICATIONS_MODULE);
    });

    it('maps security to SETTINGS_SECURITY_MODULE', () => {
        expect(settingsSectionToAppView['security']).toBe(AppView.SETTINGS_SECURITY_MODULE);
    });

    it('maps integrations to SETTINGS_INTEGRATIONS_MODULE', () => {
        expect(settingsSectionToAppView['integrations']).toBe(AppView.SETTINGS_INTEGRATIONS_MODULE);
    });

    it('maps appearance to SETTINGS_APPEARANCE_MODULE', () => {
        expect(settingsSectionToAppView['appearance']).toBe(AppView.SETTINGS_APPEARANCE_MODULE);
    });
});

describe('appViewToSettingsSection mapping', () => {
    it('maps SETTINGS_PROFILE_MODULE to profile', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_PROFILE_MODULE]).toBe('profile');
    });

    it('maps SETTINGS_AI_MODULE to ai-preferences', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_AI_MODULE]).toBe('ai-preferences');
    });

    it('maps SETTINGS_NOTIFICATIONS_MODULE to notifications', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_NOTIFICATIONS_MODULE]).toBe('notifications');
    });

    it('maps SETTINGS_SECURITY_MODULE to security', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_SECURITY_MODULE]).toBe('security');
    });

    it('maps SETTINGS_INTEGRATIONS_MODULE to integrations', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_INTEGRATIONS_MODULE]).toBe('integrations');
    });

    it('maps SETTINGS_APPEARANCE_MODULE to appearance', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_APPEARANCE_MODULE]).toBe('appearance');
    });

    // Legacy mappings
    it('maps legacy SETTINGS_PROFILE to profile', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_PROFILE]).toBe('profile');
    });

    it('maps legacy SETTINGS_AI to ai-preferences', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_AI]).toBe('ai-preferences');
    });

    it('maps legacy SETTINGS_SECURITY to security', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_SECURITY]).toBe('security');
    });

    it('maps legacy SETTINGS_PRIVACY to security', () => {
        expect(appViewToSettingsSection[AppView.SETTINGS_PRIVACY]).toBe('security');
    });
});

// =============================================================================
// PROFILE MODULE TESTS
// =============================================================================

describe('ProfileModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab Rendering', () => {
        it('renders with Personal Info tab by default', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/personal/i).length).toBeGreaterThan(0);
            });
        });

        it('renders all 5 tabs', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/personal/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/avatar/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/billing/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/account/i).length).toBeGreaterThan(0);
            });
        });

        it('renders module title and subtitle', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                // The title "Profile" should be visible
                const headers = screen.getAllByText(/profile/i);
                expect(headers.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Tab Navigation', () => {
        it('switches to Avatar tab when clicked', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const avatarTab = screen.getByRole('button', { name: /avatar/i });
            fireEvent.click(avatarTab);

            await waitFor(() => {
                expect(screen.getByText(/profile picture/i)).toBeTruthy();
            });
        });

        it('switches to Security tab when clicked', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const securityTab = screen.getByRole('button', { name: /security/i });
            fireEvent.click(securityTab);

            await waitFor(() => {
                expect(screen.getAllByText(/change password/i).length).toBeGreaterThan(0);
            });
        });

        it('switches to Account tab when clicked', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const accountTab = screen.getByRole('button', { name: /account/i });
            fireEvent.click(accountTab);

            await waitFor(() => {
                expect(screen.getByText(/account management/i)).toBeTruthy();
            });
        });
    });

    describe('Initial Tab', () => {
        it('respects initialTab prop', async () => {
            render(
                <TestWrapper>
                    <ProfileModule
                        initialTab="security"
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/change password/i).length).toBeGreaterThan(0);
            });
        });
    });
});

// =============================================================================
// AI PREFERENCES MODULE TESTS
// =============================================================================

describe('AIPreferencesModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab Rendering', () => {
        it('renders with Instructions tab by default', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/instruction/i).length).toBeGreaterThan(0);
            });
        });

        it('renders all 5 tabs', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/instruction/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/memory/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/style/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/voice/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Memory Tab', () => {
        it('switches to Memory tab when clicked', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const memoryTab = screen.getByRole('button', { name: /memory/i });
            fireEvent.click(memoryTab);

            await waitFor(() => {
                expect(screen.getByText(/ai memory/i)).toBeTruthy();
            });
        });

        it('renders memory enable toggle', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const memoryTab = screen.getByRole('button', { name: /memory/i });
            fireEvent.click(memoryTab);

            await waitFor(() => {
                expect(screen.getByText(/enable memory/i)).toBeTruthy();
            });
        });

        it('renders clear memory button', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const memoryTab = screen.getByRole('button', { name: /memory/i });
            fireEvent.click(memoryTab);

            await waitFor(() => {
                expect(screen.getByText(/clear memory/i)).toBeTruthy();
            });
        });
    });

    describe('Response Style Tab', () => {
        it('switches to Response Style tab when clicked', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const styleTab = screen.getByRole('button', { name: /style/i });
            fireEvent.click(styleTab);

            await waitFor(() => {
                expect(screen.getAllByText(/response style/i).length).toBeGreaterThan(0);
            });
        });

        it('renders length options', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const styleTab = screen.getByRole('button', { name: /style/i });
            fireEvent.click(styleTab);

            await waitFor(() => {
                expect(screen.getAllByText(/short/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/medium/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/long/i).length).toBeGreaterThan(0);
            });
        });

        it('renders tone options', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const styleTab = screen.getByRole('button', { name: /style/i });
            fireEvent.click(styleTab);

            await waitFor(() => {
                expect(screen.getAllByText(/formal/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/professional/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/casual/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Chat History Tab', () => {
        it('switches to Chat History tab when clicked', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const historyTab = screen.getByRole('button', { name: /chat history/i });
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getAllByText(/chat history/i).length).toBeGreaterThan(0);
            });
        });

        it('renders save history toggle', async () => {
            render(
                <TestWrapper>
                    <AIPreferencesModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const historyTab = screen.getByRole('button', { name: /chat history/i });
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getAllByText(/save chat history/i).length).toBeGreaterThan(0);
            });
        });
    });
});

// =============================================================================
// NOTIFICATIONS MODULE TESTS
// =============================================================================

describe('NotificationsModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab Rendering', () => {
        it('renders with All tab by default', async () => {
            render(
                <TestWrapper>
                    <NotificationsModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/all/i).length).toBeGreaterThan(0);
            });
        });

        it('renders all 4 tabs', async () => {
            render(
                <TestWrapper>
                    <NotificationsModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/all/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/email/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/push/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/schedule/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Schedule Tab', () => {
        it('switches to Schedule tab when clicked', async () => {
            render(
                <TestWrapper>
                    <NotificationsModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const scheduleTab = screen.getByRole('button', { name: /schedule/i });
            fireEvent.click(scheduleTab);

            await waitFor(() => {
                expect(screen.getAllByText(/quiet hours/i).length).toBeGreaterThan(0);
            });
        });

        it('renders weekend notifications toggle', async () => {
            render(
                <TestWrapper>
                    <NotificationsModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const scheduleTab = screen.getByRole('button', { name: /schedule/i });
            fireEvent.click(scheduleTab);

            await waitFor(() => {
                expect(screen.getAllByText(/weekend notifications/i).length).toBeGreaterThan(0);
            });
        });
    });
});

// =============================================================================
// SECURITY & PRIVACY MODULE TESTS
// =============================================================================

describe('SecurityPrivacyModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab Rendering', () => {
        it('renders with MFA tab by default', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/mfa/i).length).toBeGreaterThan(0);
            });
        });

        it('renders all 5 tabs', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/mfa/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/session/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/security events/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/data/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/privacy/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Sessions Tab', () => {
        it('switches to Sessions tab when clicked', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const sessionsTab = screen.getByRole('button', { name: /session/i });
            fireEvent.click(sessionsTab);

            await waitFor(() => {
                expect(screen.getAllByText(/active sessions/i).length).toBeGreaterThan(0);
            });
        });

        it('renders sign out all button', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const sessionsTab = screen.getByRole('button', { name: /session/i });
            fireEvent.click(sessionsTab);

            await waitFor(() => {
                expect(screen.getAllByText(/sign out all/i).length).toBeGreaterThan(0);
            });
        });

        it('marks current session', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const sessionsTab = screen.getByRole('button', { name: /session/i });
            fireEvent.click(sessionsTab);

            await waitFor(() => {
                expect(screen.getAllByText(/current/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Login History Tab', () => {
        it('switches to Login History tab when clicked', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const historyTab = screen.getByRole('button', { name: /security events/i });
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getAllByText(/security events/i).length).toBeGreaterThan(0);
            });
        });

        it('renders login entries with status', async () => {
            (Api.get as any).mockImplementation((url: string) => {
                if (url.includes('security/events')) {
                    return Promise.resolve({
                        events: [
                            {
                                id: '1',
                                type: 'login',
                                severity: 'info',
                                title: 'Successful Login',
                                description: 'Logged in from Chrome',
                                timestamp: new Date().toISOString()
                            }
                        ]
                    });
                }
                return Promise.resolve({});
            });

            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const historyTab = screen.getByRole('button', { name: /security events/i });
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getAllByText(/successful/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Data Controls Tab', () => {
        it('switches to Data Controls tab when clicked', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const dataTab = screen.getByRole('button', { name: /data/i });
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getAllByText(/data controls/i).length).toBeGreaterThan(0);
            });
        });

        it('renders training opt-out toggle', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const dataTab = screen.getByRole('button', { name: /data/i });
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getAllByText(/ai model training/i).length).toBeGreaterThan(0);
            });
        });

        it('renders data retention options', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const dataTab = screen.getByRole('button', { name: /data/i });
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getAllByText(/retention/i).length).toBeGreaterThan(0);
            });
        });

        it('renders export data button', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const dataTab = screen.getByRole('button', { name: /data/i });
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getAllByText(/export/i).length).toBeGreaterThan(0);
            });
        });
    });
});

// =============================================================================
// INTEGRATIONS MODULE TESTS
// =============================================================================

describe('IntegrationsModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab Rendering', () => {
        it('renders with Apps tab by default', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/apps/i).length).toBeGreaterThan(0);
            });
        });

        it('renders all 4 tabs', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/apps/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/api/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/webhook/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/calendar/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('API Keys Tab', () => {
        it('switches to API Keys tab when clicked', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const apiTab = screen.getByRole('button', { name: /api/i });
            fireEvent.click(apiTab);

            await waitFor(() => {
                expect(screen.getAllByText(/api keys/i).length).toBeGreaterThan(0);
            });
        });

        it('renders create new key button', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const apiTab = screen.getByRole('button', { name: /api/i });
            fireEvent.click(apiTab);

            await waitFor(() => {
                expect(screen.getAllByText(/create new key/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Webhooks Tab', () => {
        it('switches to Webhooks tab when clicked', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const webhookTab = screen.getByRole('button', { name: /webhook/i });
            fireEvent.click(webhookTab);

            await waitFor(() => {
                expect(screen.getAllByText(/webhooks/i).length).toBeGreaterThan(0);
            });
        });

        it('renders add webhook button', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const webhookTab = screen.getByRole('button', { name: /webhook/i });
            fireEvent.click(webhookTab);

            await waitFor(() => {
                expect(screen.getAllByText(/add webhook/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Calendar Tab', () => {
        it('switches to Calendar tab when clicked', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const calendarTab = screen.getByRole('button', { name: /calendar/i });
            fireEvent.click(calendarTab);

            await waitFor(() => {
                expect(screen.getAllByText(/calendar sync/i).length).toBeGreaterThan(0);
            });
        });

        it('renders Google Calendar option', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const calendarTab = screen.getByRole('button', { name: /calendar/i });
            fireEvent.click(calendarTab);

            await waitFor(() => {
                expect(screen.getAllByText(/google calendar/i).length).toBeGreaterThan(0);
            });
        });

        it('renders Outlook Calendar option', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const calendarTab = screen.getByRole('button', { name: /calendar/i });
            fireEvent.click(calendarTab);

            await waitFor(() => {
                expect(screen.getAllByText(/outlook calendar/i).length).toBeGreaterThan(0);
            });
        });
    });
});

// =============================================================================
// APPEARANCE MODULE TESTS
// =============================================================================

describe('AppearanceModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Tab Rendering', () => {
        it('renders with Theme tab by default', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/theme/i).length).toBeGreaterThan(0);
            });
        });

        it('renders all 6 tabs', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getAllByText(/theme/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/language/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/regional/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/accessibility/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/work/i).length).toBeGreaterThan(0);
                expect(screen.getAllByText(/dashboard/i).length).toBeGreaterThan(0);
            });
        });
    });

    describe('Theme Tab', () => {
        it('renders light theme option', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                // Use functional matcher to strictly match "Light" and avoid "Highlight"
                expect(screen.getByText((content) => content.trim() === 'Light')).toBeTruthy();
            });
        });

        it('renders dark theme option', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText((content) => content.trim() === 'Dark')).toBeTruthy();
            });
        });

        it('renders system theme option', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText((content) => content.trim() === 'System')).toBeTruthy();
            });
        });

        it('calls toggleTheme when selecting light theme', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const lightButton = screen.getByText((content) => content.trim() === 'Light');
            fireEvent.click(lightButton);

            expect(mockToggleTheme).toHaveBeenCalledWith('light');
        });

        it('calls toggleTheme when selecting dark theme', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="light"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const darkButton = screen.getByText((content) => content.trim() === 'Dark');
            fireEvent.click(darkButton);

            expect(mockToggleTheme).toHaveBeenCalledWith('dark');
        });

        it('calls toggleTheme when selecting system theme', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const systemButton = screen.getByText((content) => content.trim() === 'System');
            fireEvent.click(systemButton);

            expect(mockToggleTheme).toHaveBeenCalledWith('system');
        });
    });

    describe('Language Tab', () => {
        it('switches to Language tab when clicked', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const languageTab = screen.getByRole('button', { name: /language/i });
            fireEvent.click(languageTab);

            await waitFor(() => {
                // Should show language selection
                expect(screen.getByText(/english/i)).toBeTruthy();
            });
        });

        it('renders English option', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const languageTab = screen.getByRole('button', { name: /language/i });
            fireEvent.click(languageTab);

            await waitFor(() => {
                expect(screen.getByText(/english/i)).toBeTruthy();
            });
        });

        it('renders Polish option', async () => {
            render(
                <TestWrapper>
                    <AppearanceModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const languageTab = screen.getByRole('button', { name: /language/i });
            fireEvent.click(languageTab);

            await waitFor(() => {
                expect(screen.getByText(/polski/i)).toBeTruthy();
            });
        });
    });
});

// =============================================================================
// INTEGRATION TEST - FULL SETTINGS FLOW
// =============================================================================

describe('Settings Integration', () => {
    it('all modules can be navigated sequentially', async () => {
        const modules: SettingsSection[] = [
            'profile',
            'ai-preferences',
            'notifications',
            'security',
            'integrations',
            'appearance'
        ];

        const mockOnSectionChange = vi.fn();
        const mockOnBackToApp = vi.fn();

        render(
            <TestWrapper>
                <SettingsSidebar
                    activeSection="profile"
                    onSectionChange={mockOnSectionChange}
                    onBackToApp={mockOnBackToApp}
                    currentUserEmail="user@example.com"
                />
            </TestWrapper>
        );

        // Click through all modules
        for (const module of modules) {
            const moduleButton = screen.getByText(new RegExp(module.replace('-', '.*'), 'i'));
            fireEvent.click(moduleButton);
            expect(mockOnSectionChange).toHaveBeenCalledWith(module);
        }

        expect(mockOnSectionChange).toHaveBeenCalledTimes(modules.length);
    });

    it('each module maps to correct AppView', () => {
        const sections: SettingsSection[] = [
            'profile',
            'ai-preferences',
            'notifications',
            'security',
            'integrations',
            'appearance'
        ];

        const expectedViews = [
            AppView.SETTINGS_PROFILE_MODULE,
            AppView.SETTINGS_AI_MODULE,
            AppView.SETTINGS_NOTIFICATIONS_MODULE,
            AppView.SETTINGS_SECURITY_MODULE,
            AppView.SETTINGS_INTEGRATIONS_MODULE,
            AppView.SETTINGS_APPEARANCE_MODULE
        ];

        sections.forEach((section, index) => {
            expect(settingsSectionToAppView[section]).toBe(expectedViews[index]);
        });
    });

    it('reverse mapping works correctly', () => {
        const views = [
            AppView.SETTINGS_PROFILE_MODULE,
            AppView.SETTINGS_AI_MODULE,
            AppView.SETTINGS_NOTIFICATIONS_MODULE,
            AppView.SETTINGS_SECURITY_MODULE,
            AppView.SETTINGS_INTEGRATIONS_MODULE,
            AppView.SETTINGS_APPEARANCE_MODULE
        ];

        const expectedSections: SettingsSection[] = [
            'profile',
            'ai-preferences',
            'notifications',
            'security',
            'integrations',
            'appearance'
        ];

        views.forEach((view, index) => {
            expect(appViewToSettingsSection[view]).toBe(expectedSections[index]);
        });
    });
});
