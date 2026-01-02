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
        getLoginHistory: vi.fn().mockResolvedValue([]),
        clearAIMemory: vi.fn().mockResolvedValue({}),
        clearChatHistory: vi.fn().mockResolvedValue({}),
        exportUserData: vi.fn().mockResolvedValue({ data: {} }),
        getIntegrations: vi.fn().mockResolvedValue([]),
        getApiKeys: vi.fn().mockResolvedValue([]),
        getWebhooks: vi.fn().mockResolvedValue([]),
        getCalendarConnections: vi.fn().mockResolvedValue([]),
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
                expect(screen.getAllByText(/password/i).length).toBeGreaterThan(0);
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

            const avatarTab = screen.getByText(/avatar/i);
            fireEvent.click(avatarTab);

            await waitFor(() => {
                expect(screen.getByText(/profile picture/i)).toBeTruthy();
            });
        });

        it('switches to Password tab when clicked', async () => {
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

            const passwordTab = screen.getByText(/password/i);
            fireEvent.click(passwordTab);

            await waitFor(() => {
                expect(screen.getByText(/change password/i)).toBeTruthy();
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

            const accountTab = screen.getByText(/account/i);
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
                        initialTab="password"
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(screen.getByText(/change password/i)).toBeTruthy();
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

            const memoryTab = screen.getByText(/memory/i);
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

            const memoryTab = screen.getByText(/memory/i);
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

            const memoryTab = screen.getByText(/memory/i);
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

            const styleTab = screen.getByText(/style/i);
            fireEvent.click(styleTab);

            await waitFor(() => {
                expect(screen.getByText(/response style/i)).toBeTruthy();
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

            const styleTab = screen.getByText(/style/i);
            fireEvent.click(styleTab);

            await waitFor(() => {
                expect(screen.getByText(/short/i)).toBeTruthy();
                expect(screen.getByText(/medium/i)).toBeTruthy();
                expect(screen.getByText(/long/i)).toBeTruthy();
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

            const styleTab = screen.getByText(/style/i);
            fireEvent.click(styleTab);

            await waitFor(() => {
                expect(screen.getByText(/formal/i)).toBeTruthy();
                expect(screen.getByText(/professional/i)).toBeTruthy();
                expect(screen.getByText(/casual/i)).toBeTruthy();
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

            const historyTab = screen.getByText(/history/i);
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getByText(/chat history/i)).toBeTruthy();
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

            const historyTab = screen.getByText(/history/i);
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getByText(/save chat history/i)).toBeTruthy();
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

            const scheduleTab = screen.getByText(/schedule/i);
            fireEvent.click(scheduleTab);

            await waitFor(() => {
                expect(screen.getByText(/quiet hours/i)).toBeTruthy();
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

            const scheduleTab = screen.getByText(/schedule/i);
            fireEvent.click(scheduleTab);

            await waitFor(() => {
                expect(screen.getByText(/weekend notifications/i)).toBeTruthy();
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
                expect(screen.getByText(/mfa/i)).toBeTruthy();
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
                expect(screen.getAllByText(/history/i).length).toBeGreaterThan(0);
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

            const sessionsTab = screen.getByText(/session/i);
            fireEvent.click(sessionsTab);

            await waitFor(() => {
                expect(screen.getByText(/active sessions/i)).toBeTruthy();
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

            const sessionsTab = screen.getByText(/session/i);
            fireEvent.click(sessionsTab);

            await waitFor(() => {
                expect(screen.getByText(/sign out all/i)).toBeTruthy();
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

            const sessionsTab = screen.getByText(/session/i);
            fireEvent.click(sessionsTab);

            await waitFor(() => {
                expect(screen.getByText(/current/i)).toBeTruthy();
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

            const historyTab = screen.getByText(/history/i);
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getByText(/login history/i)).toBeTruthy();
            });
        });

        it('renders login entries with status', async () => {
            render(
                <TestWrapper>
                    <SecurityPrivacyModule
                        currentUser={mockUser as any}
                        onUpdateUser={mockOnUpdateUser}
                    />
                </TestWrapper>
            );

            const historyTab = screen.getByText(/history/i);
            fireEvent.click(historyTab);

            await waitFor(() => {
                expect(screen.getByText(/successful/i)).toBeTruthy();
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

            const dataTab = screen.getByText(/data/i);
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getByText(/data controls/i)).toBeTruthy();
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

            const dataTab = screen.getByText(/data/i);
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getByText(/training opt-out/i)).toBeTruthy();
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

            const dataTab = screen.getByText(/data/i);
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getByText(/retention/i)).toBeTruthy();
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

            const dataTab = screen.getByText(/data/i);
            fireEvent.click(dataTab);

            await waitFor(() => {
                expect(screen.getByText(/export/i)).toBeTruthy();
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
                expect(screen.getByText(/apps/i)).toBeTruthy();
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

            const apiTab = screen.getByText(/api/i);
            fireEvent.click(apiTab);

            await waitFor(() => {
                expect(screen.getByText(/api keys/i)).toBeTruthy();
            });
        });

        it('renders create new key button', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const apiTab = screen.getByText(/api/i);
            fireEvent.click(apiTab);

            await waitFor(() => {
                expect(screen.getByText(/create new key/i)).toBeTruthy();
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

            const webhookTab = screen.getByText(/webhook/i);
            fireEvent.click(webhookTab);

            await waitFor(() => {
                expect(screen.getByText(/webhooks/i)).toBeTruthy();
            });
        });

        it('renders add webhook button', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const webhookTab = screen.getByText(/webhook/i);
            fireEvent.click(webhookTab);

            await waitFor(() => {
                expect(screen.getByText(/add webhook/i)).toBeTruthy();
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

            const calendarTab = screen.getByText(/calendar/i);
            fireEvent.click(calendarTab);

            await waitFor(() => {
                expect(screen.getByText(/calendar sync/i)).toBeTruthy();
            });
        });

        it('renders Google Calendar option', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const calendarTab = screen.getByText(/calendar/i);
            fireEvent.click(calendarTab);

            await waitFor(() => {
                expect(screen.getByText(/google calendar/i)).toBeTruthy();
            });
        });

        it('renders Outlook Calendar option', async () => {
            render(
                <TestWrapper>
                    <IntegrationsModule currentUser={mockUser as any} />
                </TestWrapper>
            );

            const calendarTab = screen.getByText(/calendar/i);
            fireEvent.click(calendarTab);

            await waitFor(() => {
                expect(screen.getByText(/outlook calendar/i)).toBeTruthy();
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
                expect(screen.getByText(/theme/i)).toBeTruthy();
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
                expect(screen.getByText(/light/i)).toBeTruthy();
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
                expect(screen.getByText(/dark/i)).toBeTruthy();
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
                expect(screen.getByText(/system/i)).toBeTruthy();
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

            const lightButton = screen.getByText(/light/i);
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

            const darkButton = screen.getByText(/dark/i);
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

            const systemButton = screen.getByText(/system/i);
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

            const languageTab = screen.getByText(/language/i);
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

            const languageTab = screen.getByText(/language/i);
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

            const languageTab = screen.getByText(/language/i);
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
