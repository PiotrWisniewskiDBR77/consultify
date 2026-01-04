/**
 * Settings E2E Tests
 * 
 * End-to-end tests for the complete settings flow.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import userEvent from '@testing-library/user-event';

// Full app imports (mocked services)
import { SettingsView } from '../../views/SettingsView';
import { AppView, User } from '../../types';

// Mock all services
vi.mock('../../services/api', () => ({
    Api: {
        updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
        updatePreferences: vi.fn().mockResolvedValue({ success: true }),
        updatePassword: vi.fn().mockResolvedValue({ success: true }),
        getSessions: vi.fn().mockResolvedValue([
            { id: 'sess-1', device: 'Chrome', ip: '192.168.1.1', current: true },
            { id: 'sess-2', device: 'Safari', ip: '192.168.1.2', current: false },
        ]),
        revokeSession: vi.fn().mockResolvedValue({ success: true }),
        getLoginHistory: vi.fn().mockResolvedValue([
            { id: '1', status: 'success', timestamp: new Date().toISOString() },
        ]),
        clearAIMemory: vi.fn().mockResolvedValue({ success: true }),
        clearChatHistory: vi.fn().mockResolvedValue({ success: true }),
        exportUserData: vi.fn().mockResolvedValue({ downloadUrl: '/export.zip' }),
        getApiKeys: vi.fn().mockResolvedValue([]),
        createApiKey: vi.fn().mockResolvedValue({ key: 'cf_test_key_12345' }),
        deleteApiKey: vi.fn().mockResolvedValue({ success: true }),
        getWebhooks: vi.fn().mockResolvedValue([]),
        createWebhook: vi.fn().mockResolvedValue({ id: 'webhook-1' }),
        deleteWebhook: vi.fn().mockResolvedValue({ success: true }),
        getCalendarConnections: vi.fn().mockResolvedValue([]),
        connectCalendar: vi.fn().mockResolvedValue({ authUrl: 'https://oauth.example.com' }),
        disconnectCalendar: vi.fn().mockResolvedValue({ success: true }),
        getIntegrations: vi.fn().mockResolvedValue([]),
        logout: vi.fn().mockResolvedValue({}),
    },
}));

vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn(() => ({
        currentView: AppView.SETTINGS_PROFILE_MODULE,
        setCurrentView: vi.fn(),
        isSidebarCollapsed: false,
        toggleSidebarCollapse: vi.fn(),
    })),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
        {children}
    </I18nextProvider>
);

// Full mock user
const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    companyName: 'Test Company',
    avatar: '',
    preferences: {
        theme: 'dark',
        language: 'en',
        notifications: {
            email: true,
            push: true,
        },
        ai: {
            memoryEnabled: true,
            responseLength: 'medium',
            responseTone: 'professional',
        },
    },
    extended_preferences: {},
    preferredLanguage: 'en',
};

const mockOnNavigate = vi.fn();
const mockToggleTheme = vi.fn();

// =============================================================================
// FULL SETTINGS VIEW E2E TESTS
// =============================================================================

describe('Settings View E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial Rendering', () => {
        it('renders SettingsView with sidebar and content', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                // Sidebar should be visible
                expect(screen.getByText(/profile/i)).toBeTruthy();
                expect(screen.getByText(/ai/i)).toBeTruthy();
                expect(screen.getByText(/notification/i)).toBeTruthy();
                expect(screen.getByText(/security/i)).toBeTruthy();
                expect(screen.getByText(/integration/i)).toBeTruthy();
                expect(screen.getByText(/appearance/i)).toBeTruthy();
            });
        });

        it('shows Profile module by default', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            await waitFor(() => {
                // Profile content should be visible
                expect(screen.getByDisplayValue('Test User')).toBeTruthy();
                expect(screen.getByDisplayValue('test@example.com')).toBeTruthy();
            });
        });
    });

    describe('Module Navigation', () => {
        it('navigates to AI Preferences module', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const aiButton = screen.getByText(/ai/i);
            fireEvent.click(aiButton);

            await waitFor(() => {
                expect(screen.getByText(/instruction/i)).toBeTruthy();
                expect(screen.getByText(/memory/i)).toBeTruthy();
                expect(screen.getByText(/style/i)).toBeTruthy();
            });
        });

        it('navigates to Security module', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const securityButton = screen.getByText(/security/i);
            fireEvent.click(securityButton);

            await waitFor(() => {
                expect(screen.getByText(/mfa/i)).toBeTruthy();
                expect(screen.getByText(/session/i)).toBeTruthy();
            });
        });

        it('navigates to Integrations module', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const integrationsButton = screen.getByText(/integration/i);
            fireEvent.click(integrationsButton);

            await waitFor(() => {
                expect(screen.getByText(/apps/i)).toBeTruthy();
                expect(screen.getByText(/api/i)).toBeTruthy();
                expect(screen.getByText(/webhook/i)).toBeTruthy();
            });
        });

        it('navigates to Appearance module', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const appearanceButton = screen.getByText(/appearance/i);
            fireEvent.click(appearanceButton);

            await waitFor(() => {
                expect(screen.getByText(/theme/i)).toBeTruthy();
                expect(screen.getByText(/language/i)).toBeTruthy();
            });
        });
    });

    describe('Tab Navigation Within Modules', () => {
        it('navigates between tabs in Profile module', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Click Password tab
            const passwordTab = screen.getByText(/password/i);
            fireEvent.click(passwordTab);

            await waitFor(() => {
                expect(screen.getByLabelText(/current password/i)).toBeTruthy();
            });

            // Click Account tab
            const accountTab = screen.getByText(/account/i);
            fireEvent.click(accountTab);

            await waitFor(() => {
                expect(screen.getByText(/delete account/i)).toBeTruthy();
            });
        });

        it('navigates between tabs in AI Preferences module', async () => {
            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Go to AI module
            const aiButton = screen.getByText(/ai/i);
            fireEvent.click(aiButton);

            // Click Memory tab
            const memoryTab = await screen.findByText(/memory/i);
            fireEvent.click(memoryTab);

            await waitFor(() => {
                expect(screen.getByText(/enable memory/i)).toBeTruthy();
            });

            // Click Voice tab
            const voiceTab = screen.getByText(/voice/i);
            fireEvent.click(voiceTab);

            await waitFor(() => {
                expect(screen.getByText(/enable voice/i)).toBeTruthy();
            });
        });
    });
});

// =============================================================================
// PROFILE MODULE E2E TESTS
// =============================================================================

describe('Profile Module E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Personal Information', () => {
        it('updates user name', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const nameInput = screen.getByDisplayValue('Test User');
            await user.clear(nameInput);
            await user.type(nameInput, 'New Name');

            const saveButton = screen.getByText(/save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(Api.updateUserProfile).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'New Name' })
                );
            });
        });

        it('shows validation error for empty name', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const nameInput = screen.getByDisplayValue('Test User');
            await user.clear(nameInput);

            const saveButton = screen.getByText(/save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/name is required/i)).toBeTruthy();
            });
        });
    });

    describe('Password Change', () => {
        it('changes password successfully', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Go to password tab
            const passwordTab = screen.getByText(/password/i);
            await user.click(passwordTab);

            // Fill in password fields
            const currentPassword = screen.getByLabelText(/current password/i);
            const newPassword = screen.getByLabelText(/new password/i);
            const confirmPassword = screen.getByLabelText(/confirm password/i);

            await user.type(currentPassword, 'oldpassword123');
            await user.type(newPassword, 'NewStrongP@ss123');
            await user.type(confirmPassword, 'NewStrongP@ss123');

            const changeButton = screen.getByText(/change password/i);
            await user.click(changeButton);

            await waitFor(() => {
                expect(Api.updatePassword).toHaveBeenCalled();
            });
        });

        it('shows error when passwords do not match', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const passwordTab = screen.getByText(/password/i);
            await user.click(passwordTab);

            const newPassword = screen.getByLabelText(/new password/i);
            const confirmPassword = screen.getByLabelText(/confirm password/i);

            await user.type(newPassword, 'NewStrongP@ss123');
            await user.type(confirmPassword, 'DifferentP@ss456');

            const changeButton = screen.getByText(/change password/i);
            await user.click(changeButton);

            await waitFor(() => {
                expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
            });
        });
    });

    describe('Account Management', () => {
        it('requests data export', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const accountTab = screen.getByText(/account/i);
            await user.click(accountTab);

            const exportButton = screen.getByText(/export data/i);
            await user.click(exportButton);

            await waitFor(() => {
                expect(Api.exportUserData).toHaveBeenCalled();
            });
        });

        it('shows delete confirmation dialog', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const accountTab = screen.getByText(/account/i);
            await user.click(accountTab);

            const deleteButton = screen.getByText(/delete account/i);
            await user.click(deleteButton);

            await waitFor(() => {
                expect(screen.getByText(/are you sure/i)).toBeTruthy();
                expect(screen.getByText(/this action cannot be undone/i)).toBeTruthy();
            });
        });
    });
});

// =============================================================================
// AI PREFERENCES MODULE E2E TESTS
// =============================================================================

describe('AI Preferences Module E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('AI Memory', () => {
        it('clears AI memory with confirmation', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Navigate to AI > Memory
            const aiButton = screen.getByText(/ai/i);
            await user.click(aiButton);

            const memoryTab = await screen.findByText(/memory/i);
            await user.click(memoryTab);

            const clearButton = await screen.findByText(/clear memory/i);
            await user.click(clearButton);

            // Confirm in dialog
            const confirmButton = await screen.findByText(/confirm/i);
            await user.click(confirmButton);

            await waitFor(() => {
                expect(Api.clearAIMemory).toHaveBeenCalled();
            });
        });
    });

    describe('Response Style', () => {
        it('changes response length preference', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Navigate to AI > Style
            const aiButton = screen.getByText(/ai/i);
            await user.click(aiButton);

            const styleTab = await screen.findByText(/style/i);
            await user.click(styleTab);

            const shortOption = await screen.findByText(/short/i);
            await user.click(shortOption);

            await waitFor(() => {
                expect(Api.updatePreferences).toHaveBeenCalledWith(
                    expect.objectContaining({
                        ai: expect.objectContaining({ responseLength: 'short' })
                    })
                );
            });
        });
    });

    describe('Chat History', () => {
        it('clears chat history with confirmation', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Navigate to AI > History
            const aiButton = screen.getByText(/ai/i);
            await user.click(aiButton);

            const historyTab = await screen.findByText(/history/i);
            await user.click(historyTab);

            const clearButton = await screen.findByText(/clear history/i);
            await user.click(clearButton);

            // Confirm
            const confirmButton = await screen.findByText(/confirm/i);
            await user.click(confirmButton);

            await waitFor(() => {
                expect(Api.clearChatHistory).toHaveBeenCalled();
            });
        });
    });
});

// =============================================================================
// SECURITY MODULE E2E TESTS
// =============================================================================

describe('Security Module E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Active Sessions', () => {
        it('displays and manages active sessions', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Navigate to Security > Sessions
            const securityButton = screen.getByText(/security/i);
            await user.click(securityButton);

            const sessionsTab = await screen.findByText(/session/i);
            await user.click(sessionsTab);

            // Should show sessions
            await waitFor(() => {
                expect(screen.getByText(/chrome/i)).toBeTruthy();
                expect(screen.getByText(/safari/i)).toBeTruthy();
                expect(screen.getByText(/current/i)).toBeTruthy();
            });
        });

        it('revokes individual session', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const securityButton = screen.getByText(/security/i);
            await user.click(securityButton);

            const sessionsTab = await screen.findByText(/session/i);
            await user.click(sessionsTab);

            // Find revoke button for non-current session
            const revokeButtons = await screen.findAllByText(/sign out/i);
            const individualRevokeButton = revokeButtons.find(btn => 
                !btn.textContent?.toLowerCase().includes('all')
            );
            if (individualRevokeButton) {
                await user.click(individualRevokeButton);
            }

            await waitFor(() => {
                expect(Api.revokeSession).toHaveBeenCalled();
            });
        });
    });

    describe('Login History', () => {
        it('displays login history', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const securityButton = screen.getByText(/security/i);
            await user.click(securityButton);

            const historyTab = await screen.findByText(/history/i);
            await user.click(historyTab);

            await waitFor(() => {
                expect(Api.getLoginHistory).toHaveBeenCalled();
            });
        });
    });
});

// =============================================================================
// INTEGRATIONS MODULE E2E TESTS
// =============================================================================

describe('Integrations Module E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('API Keys', () => {
        it('creates new API key', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            // Navigate to Integrations > API
            const integrationsButton = screen.getByText(/integration/i);
            await user.click(integrationsButton);

            const apiTab = await screen.findByText(/api/i);
            await user.click(apiTab);

            const createButton = await screen.findByText(/create new key/i);
            await user.click(createButton);

            // Fill in key name
            const nameInput = await screen.findByPlaceholderText(/key name/i);
            await user.type(nameInput, 'My New API Key');

            const confirmButton = await screen.findByText(/create/i);
            await user.click(confirmButton);

            await waitFor(() => {
                expect(Api.createApiKey).toHaveBeenCalledWith(
                    expect.objectContaining({ name: 'My New API Key' })
                );
            });
        });
    });

    describe('Webhooks', () => {
        it('creates new webhook', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const integrationsButton = screen.getByText(/integration/i);
            await user.click(integrationsButton);

            const webhooksTab = await screen.findByText(/webhook/i);
            await user.click(webhooksTab);

            const addButton = await screen.findByText(/add webhook/i);
            await user.click(addButton);

            // Fill in webhook details
            const urlInput = await screen.findByPlaceholderText(/webhook url/i);
            await user.type(urlInput, 'https://example.com/my-webhook');

            const createButton = await screen.findByText(/create/i);
            await user.click(createButton);

            await waitFor(() => {
                expect(Api.createWebhook).toHaveBeenCalledWith(
                    expect.objectContaining({ url: 'https://example.com/my-webhook' })
                );
            });
        });
    });

    describe('Calendar Sync', () => {
        it('connects Google Calendar', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const integrationsButton = screen.getByText(/integration/i);
            await user.click(integrationsButton);

            const calendarTab = await screen.findByText(/calendar/i);
            await user.click(calendarTab);

            const googleConnectButton = await screen.findByTestId('connect-google');
            await user.click(googleConnectButton);

            await waitFor(() => {
                expect(Api.connectCalendar).toHaveBeenCalledWith('google');
            });
        });
    });
});

// =============================================================================
// APPEARANCE MODULE E2E TESTS
// =============================================================================

describe('Appearance Module E2E', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Theme Selection', () => {
        it('switches to light theme', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const appearanceButton = screen.getByText(/appearance/i);
            await user.click(appearanceButton);

            const lightOption = await screen.findByText(/light/i);
            await user.click(lightOption);

            expect(mockToggleTheme).toHaveBeenCalledWith('light');
        });

        it('switches to system theme', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const appearanceButton = screen.getByText(/appearance/i);
            await user.click(appearanceButton);

            const systemOption = await screen.findByText(/system/i);
            await user.click(systemOption);

            expect(mockToggleTheme).toHaveBeenCalledWith('system');
        });
    });

    describe('Language Selection', () => {
        it('changes language to Polish', async () => {
            const user = userEvent.setup();

            render(
                <TestWrapper>
                    <SettingsView
                        currentUser={mockUser}
                        onNavigate={mockOnNavigate}
                        theme="dark"
                        toggleTheme={mockToggleTheme}
                    />
                </TestWrapper>
            );

            const appearanceButton = screen.getByText(/appearance/i);
            await user.click(appearanceButton);

            const languageTab = await screen.findByText(/language/i);
            await user.click(languageTab);

            const polishOption = await screen.findByText(/polski/i);
            await user.click(polishOption);

            await waitFor(() => {
                expect(Api.updatePreferences).toHaveBeenCalledWith(
                    expect.objectContaining({ language: 'pl' })
                );
            });
        });
    });
});

// =============================================================================
// ACCESSIBILITY & RESPONSIVENESS TESTS
// =============================================================================

describe('Settings Accessibility', () => {
    it('supports keyboard navigation', async () => {
        const user = userEvent.setup();

        render(
            <TestWrapper>
                <SettingsView
                    currentUser={mockUser}
                    onNavigate={mockOnNavigate}
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        // Tab through sidebar items
        await user.tab();
        await user.tab();
        await user.tab();

        // Press Enter to select
        await user.keyboard('{Enter}');

        // Content should change based on selection
    });

    it('has proper ARIA labels', async () => {
        render(
            <TestWrapper>
                <SettingsView
                    currentUser={mockUser}
                    onNavigate={mockOnNavigate}
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        // Check for proper ARIA attributes
        const nav = screen.getByRole('navigation');
        expect(nav).toBeTruthy();

        const tablist = screen.getByRole('tablist');
        expect(tablist).toBeTruthy();
    });

    it('shows loading states', async () => {
        // Mock slow API response
        vi.mocked(Api.getSessions).mockImplementation(() => 
            new Promise(resolve => setTimeout(() => resolve([]), 1000))
        );

        render(
            <TestWrapper>
                <SettingsView
                    currentUser={mockUser}
                    onNavigate={mockOnNavigate}
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        const securityButton = screen.getByText(/security/i);
        fireEvent.click(securityButton);

        const sessionsTab = await screen.findByText(/session/i);
        fireEvent.click(sessionsTab);

        // Should show loading indicator
        expect(screen.getByText(/loading/i)).toBeTruthy();
    });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Settings Error Handling', () => {
    it('shows error toast on API failure', async () => {
        vi.mocked(Api.updateUserProfile).mockRejectedValue(new Error('Network error'));

        const user = userEvent.setup();

        render(
            <TestWrapper>
                <SettingsView
                    currentUser={mockUser}
                    onNavigate={mockOnNavigate}
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        const nameInput = screen.getByDisplayValue('Test User');
        await user.clear(nameInput);
        await user.type(nameInput, 'New Name');

        const saveButton = screen.getByText(/save/i);
        await user.click(saveButton);

        await waitFor(() => {
            expect(screen.getByText(/failed/i)).toBeTruthy();
        });
    });

    it('handles session expiration gracefully', async () => {
        vi.mocked(Api.getSessions).mockRejectedValue({ status: 401 });

        render(
            <TestWrapper>
                <SettingsView
                    currentUser={mockUser}
                    onNavigate={mockOnNavigate}
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        const securityButton = screen.getByText(/security/i);
        fireEvent.click(securityButton);

        // Should redirect to login or show re-auth prompt
    });
});

// Import Api for mocking
import { Api } from '../../services/api';










