/**
 * Settings Components Unit Tests
 * 
 * Tests for individual settings components used within the modules.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        updatePreferences: vi.fn().mockResolvedValue({}),
        updatePassword: vi.fn().mockResolvedValue({}),
        deleteAccount: vi.fn().mockResolvedValue({}),
        getSessions: vi.fn().mockResolvedValue([
            { id: '1', device: 'Chrome on Windows', ip: '192.168.1.1', lastActive: new Date().toISOString(), current: true },
            { id: '2', device: 'Safari on iPhone', ip: '192.168.1.2', lastActive: new Date().toISOString(), current: false },
        ]),
        revokeSession: vi.fn().mockResolvedValue({}),
        revokeAllSessions: vi.fn().mockResolvedValue({}),
        getLoginHistory: vi.fn().mockResolvedValue([
            { id: '1', timestamp: new Date().toISOString(), status: 'success', ip: '192.168.1.1', device: 'Chrome' },
            { id: '2', timestamp: new Date(Date.now() - 86400000).toISOString(), status: 'failed', ip: '192.168.1.2', device: 'Firefox' },
        ]),
        clearAIMemory: vi.fn().mockResolvedValue({}),
        updateAIMemory: vi.fn().mockResolvedValue({}),
        clearChatHistory: vi.fn().mockResolvedValue({}),
        updateChatHistory: vi.fn().mockResolvedValue({}),
        exportUserData: vi.fn().mockResolvedValue({ data: { downloadUrl: '/export/123.zip' } }),
        getIntegrations: vi.fn().mockResolvedValue([]),
        createApiKey: vi.fn().mockResolvedValue({ key: 'test-key-123' }),
        deleteApiKey: vi.fn().mockResolvedValue({}),
        getApiKeys: vi.fn().mockResolvedValue([
            { id: '1', name: 'Test Key', lastUsed: new Date().toISOString(), created: new Date().toISOString() },
        ]),
        getWebhooks: vi.fn().mockResolvedValue([
            { id: '1', url: 'https://example.com/webhook', events: ['task.created'], enabled: true },
        ]),
        createWebhook: vi.fn().mockResolvedValue({ id: '2' }),
        deleteWebhook: vi.fn().mockResolvedValue({}),
        getCalendarConnections: vi.fn().mockResolvedValue([]),
        connectCalendar: vi.fn().mockResolvedValue({}),
        disconnectCalendar: vi.fn().mockResolvedValue({}),
        updateVoiceSettings: vi.fn().mockResolvedValue({}),
        updateResponseStyle: vi.fn().mockResolvedValue({}),
    },
}));

// Import components
import { ProfileSettings } from '../../components/settings/ProfileSettings';
import { PasswordSettings } from '../../components/settings/PasswordSettings';
import { AccountManagementSettings } from '../../components/settings/AccountManagementSettings';
import { AIMemorySettings } from '../../components/settings/AIMemorySettings';
import { ResponseStyleSettings } from '../../components/settings/ResponseStyleSettings';
import { ChatHistorySettings } from '../../components/settings/ChatHistorySettings';
import { VoiceSettings } from '../../components/settings/VoiceSettings';
import { ActiveSessionsSettings } from '../../components/settings/ActiveSessionsSettings';
import { LoginHistorySettings } from '../../components/settings/LoginHistorySettings';
import { DataControlsSettings } from '../../components/settings/DataControlsSettings';
import { APIAccessSettings } from '../../components/settings/APIAccessSettings';
import { WebhooksSettings } from '../../components/settings/WebhooksSettings';
import { CalendarSyncSettings } from '../../components/settings/CalendarSyncSettings';
import { ThemeSettings } from '../../components/settings/ThemeSettings';
import { LanguageSettings } from '../../components/settings/LanguageSettings';
import { AccessibilitySettings } from '../../components/settings/AccessibilitySettings';
import { Api } from '../../services/api';

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
        {children}
    </I18nextProvider>
);

// Mock user for tests
const mockUser = {
    id: '1',
    email: 'user@example.com',
    name: 'Test User',
    role: 'user' as const,
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
            chatHistoryEnabled: true,
        },
    },
    extended_preferences: {},
    preferredLanguage: 'en',
};

const mockOnUpdateUser = vi.fn();
const mockToggleTheme = vi.fn();

// =============================================================================
// PROFILE SETTINGS TESTS
// =============================================================================

describe('ProfileSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders user name field', async () => {
        render(
            <TestWrapper>
                <ProfileSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('Test User')).toBeTruthy();
        });
    });

    it('renders user email field', async () => {
        render(
            <TestWrapper>
                <ProfileSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByDisplayValue('user@example.com')).toBeTruthy();
        });
    });

    it('allows editing name', async () => {
        render(
            <TestWrapper>
                <ProfileSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const nameInput = screen.getByDisplayValue('Test User');
        fireEvent.change(nameInput, { target: { value: 'New Name' } });

        expect(nameInput).toHaveValue('New Name');
    });

    it('calls API on form submit', async () => {
        render(
            <TestWrapper>
                <ProfileSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const saveButton = screen.getByText(/save/i);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(Api.updateUserProfile).toHaveBeenCalled();
        });
    });
});

// =============================================================================
// PASSWORD SETTINGS TESTS
// =============================================================================

describe('PasswordSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders current password field', async () => {
        render(
            <TestWrapper>
                <PasswordSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/current password/i)).toBeTruthy();
        });
    });

    it('renders new password field', async () => {
        render(
            <TestWrapper>
                <PasswordSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/new password/i)).toBeTruthy();
        });
    });

    it('renders confirm password field', async () => {
        render(
            <TestWrapper>
                <PasswordSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByLabelText(/confirm password/i)).toBeTruthy();
        });
    });

    it('validates password match', async () => {
        render(
            <TestWrapper>
                <PasswordSettings />
            </TestWrapper>
        );

        const newPassword = screen.getByLabelText(/new password/i);
        const confirmPassword = screen.getByLabelText(/confirm password/i);

        fireEvent.change(newPassword, { target: { value: 'password123' } });
        fireEvent.change(confirmPassword, { target: { value: 'password456' } });

        const submitButton = screen.getByText(/change password/i);
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText(/passwords do not match/i)).toBeTruthy();
        });
    });

    it('shows password strength indicator', async () => {
        render(
            <TestWrapper>
                <PasswordSettings />
            </TestWrapper>
        );

        const newPassword = screen.getByLabelText(/new password/i);
        fireEvent.change(newPassword, { target: { value: 'weak' } });

        await waitFor(() => {
            expect(screen.getByText(/weak/i)).toBeTruthy();
        });
    });
});

// =============================================================================
// ACCOUNT MANAGEMENT TESTS
// =============================================================================

describe('AccountManagementSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders export data button', async () => {
        render(
            <TestWrapper>
                <AccountManagementSettings
                    currentUser={mockUser as any}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/export data/i)).toBeTruthy();
        });
    });

    it('renders delete account button', async () => {
        render(
            <TestWrapper>
                <AccountManagementSettings
                    currentUser={mockUser as any}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/delete account/i)).toBeTruthy();
        });
    });

    it('shows confirmation dialog on delete', async () => {
        render(
            <TestWrapper>
                <AccountManagementSettings
                    currentUser={mockUser as any}
                />
            </TestWrapper>
        );

        const deleteButton = screen.getByText(/delete account/i);
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText(/are you sure/i)).toBeTruthy();
        });
    });
});

// =============================================================================
// AI MEMORY SETTINGS TESTS
// =============================================================================

describe('AIMemorySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders memory enable toggle', async () => {
        render(
            <TestWrapper>
                <AIMemorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/enable memory/i)).toBeTruthy();
        });
    });

    it('renders clear memory button', async () => {
        render(
            <TestWrapper>
                <AIMemorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/clear memory/i)).toBeTruthy();
        });
    });

    it('calls clear memory API when button clicked', async () => {
        render(
            <TestWrapper>
                <AIMemorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const clearButton = screen.getByText(/clear memory/i);
        fireEvent.click(clearButton);

        // Confirm in dialog
        const confirmButton = screen.getByText(/confirm/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(Api.clearAIMemory).toHaveBeenCalled();
        });
    });

    it('shows memory statistics', async () => {
        render(
            <TestWrapper>
                <AIMemorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/memory usage/i)).toBeTruthy();
        });
    });
});

// =============================================================================
// RESPONSE STYLE SETTINGS TESTS
// =============================================================================

describe('ResponseStyleSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders response length options', async () => {
        render(
            <TestWrapper>
                <ResponseStyleSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/short/i)).toBeTruthy();
            expect(screen.getByText(/medium/i)).toBeTruthy();
            expect(screen.getByText(/long/i)).toBeTruthy();
        });
    });

    it('renders tone options', async () => {
        render(
            <TestWrapper>
                <ResponseStyleSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/formal/i)).toBeTruthy();
            expect(screen.getByText(/professional/i)).toBeTruthy();
            expect(screen.getByText(/casual/i)).toBeTruthy();
        });
    });

    it('allows selecting response length', async () => {
        render(
            <TestWrapper>
                <ResponseStyleSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const shortOption = screen.getByText(/short/i);
        fireEvent.click(shortOption);

        await waitFor(() => {
            expect(Api.updateResponseStyle).toHaveBeenCalledWith(
                expect.objectContaining({ responseLength: 'short' })
            );
        });
    });
});

// =============================================================================
// CHAT HISTORY SETTINGS TESTS
// =============================================================================

describe('ChatHistorySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders save history toggle', async () => {
        render(
            <TestWrapper>
                <ChatHistorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/save chat history/i)).toBeTruthy();
        });
    });

    it('renders retention period selector', async () => {
        render(
            <TestWrapper>
                <ChatHistorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/retention period/i)).toBeTruthy();
        });
    });

    it('renders clear history button', async () => {
        render(
            <TestWrapper>
                <ChatHistorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/clear history/i)).toBeTruthy();
        });
    });

    it('calls clear history API when button clicked', async () => {
        render(
            <TestWrapper>
                <ChatHistorySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const clearButton = screen.getByText(/clear history/i);
        fireEvent.click(clearButton);

        // Confirm in dialog
        const confirmButton = screen.getByText(/confirm/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(Api.clearChatHistory).toHaveBeenCalled();
        });
    });
});

// =============================================================================
// VOICE SETTINGS TESTS
// =============================================================================

describe('VoiceSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders voice enable toggle', async () => {
        render(
            <TestWrapper>
                <VoiceSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/enable voice/i)).toBeTruthy();
        });
    });

    it('renders voice selection', async () => {
        render(
            <TestWrapper>
                <VoiceSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/select voice/i)).toBeTruthy();
        });
    });

    it('renders speech rate slider', async () => {
        render(
            <TestWrapper>
                <VoiceSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/speech rate/i)).toBeTruthy();
        });
    });

    it('renders test voice button', async () => {
        render(
            <TestWrapper>
                <VoiceSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/test voice/i)).toBeTruthy();
        });
    });
});

// =============================================================================
// ACTIVE SESSIONS SETTINGS TESTS
// =============================================================================

describe('ActiveSessionsSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders active sessions list', async () => {
        render(
            <TestWrapper>
                <ActiveSessionsSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/chrome on windows/i)).toBeTruthy();
            expect(screen.getByText(/safari on iphone/i)).toBeTruthy();
        });
    });

    it('marks current session', async () => {
        render(
            <TestWrapper>
                <ActiveSessionsSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/current/i)).toBeTruthy();
        });
    });

    it('renders sign out all button', async () => {
        render(
            <TestWrapper>
                <ActiveSessionsSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/sign out all/i)).toBeTruthy();
        });
    });

    it('allows revoking individual session', async () => {
        render(
            <TestWrapper>
                <ActiveSessionsSettings />
            </TestWrapper>
        );

        await waitFor(() => {
            const revokeButtons = screen.getAllByText(/sign out/i);
            // Find the one that's not "sign out all"
            const individualRevokeButton = revokeButtons.find(btn => 
                !btn.textContent?.toLowerCase().includes('all')
            );
            if (individualRevokeButton) {
                fireEvent.click(individualRevokeButton);
            }
        });

        await waitFor(() => {
            expect(Api.revokeSession).toHaveBeenCalled();
        });
    });

    it('calls revoke all sessions API', async () => {
        render(
            <TestWrapper>
                <ActiveSessionsSettings />
            </TestWrapper>
        );

        const signOutAllButton = await screen.findByText(/sign out all/i);
        fireEvent.click(signOutAllButton);

        // Confirm
        const confirmButton = screen.getByText(/confirm/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(Api.revokeAllSessions).toHaveBeenCalled();
        });
    });
});

// =============================================================================
// LOGIN HISTORY SETTINGS TESTS
// =============================================================================

describe('LoginHistorySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders login history list', async () => {
        render(
            <TestWrapper>
                <LoginHistorySettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/chrome/i)).toBeTruthy();
            expect(screen.getByText(/firefox/i)).toBeTruthy();
        });
    });

    it('shows success and failure status', async () => {
        render(
            <TestWrapper>
                <LoginHistorySettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/successful/i)).toBeTruthy();
            expect(screen.getByText(/failed/i)).toBeTruthy();
        });
    });

    it('displays IP addresses', async () => {
        render(
            <TestWrapper>
                <LoginHistorySettings />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/192.168.1.1/i)).toBeTruthy();
            expect(screen.getByText(/192.168.1.2/i)).toBeTruthy();
        });
    });
});

// =============================================================================
// DATA CONTROLS SETTINGS TESTS
// =============================================================================

describe('DataControlsSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders training opt-out toggle', async () => {
        render(
            <TestWrapper>
                <DataControlsSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/training opt-out/i)).toBeTruthy();
        });
    });

    it('renders retention period selector', async () => {
        render(
            <TestWrapper>
                <DataControlsSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/retention/i)).toBeTruthy();
        });
    });

    it('renders export button', async () => {
        render(
            <TestWrapper>
                <DataControlsSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/export/i)).toBeTruthy();
        });
    });

    it('calls export API when clicked', async () => {
        render(
            <TestWrapper>
                <DataControlsSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const exportButton = screen.getByText(/export/i);
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(Api.exportUserData).toHaveBeenCalled();
        });
    });
});

// =============================================================================
// API ACCESS SETTINGS TESTS
// =============================================================================

describe('APIAccessSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders API keys list', async () => {
        render(
            <TestWrapper>
                <APIAccessSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/test key/i)).toBeTruthy();
        });
    });

    it('renders create new key button', async () => {
        render(
            <TestWrapper>
                <APIAccessSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/create new key/i)).toBeTruthy();
        });
    });

    it('calls create API key when button clicked', async () => {
        render(
            <TestWrapper>
                <APIAccessSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        const createButton = screen.getByText(/create new key/i);
        fireEvent.click(createButton);

        // Fill in key name
        const nameInput = screen.getByPlaceholderText(/key name/i);
        fireEvent.change(nameInput, { target: { value: 'New API Key' } });

        const confirmButton = screen.getByText(/create/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(Api.createApiKey).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'New API Key' })
            );
        });
    });

    it('allows deleting API key', async () => {
        render(
            <TestWrapper>
                <APIAccessSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            const deleteButton = screen.getByTestId('delete-key-1');
            fireEvent.click(deleteButton);
        });

        // Confirm deletion
        const confirmButton = screen.getByText(/confirm/i);
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(Api.deleteApiKey).toHaveBeenCalledWith('1');
        });
    });
});

// =============================================================================
// WEBHOOKS SETTINGS TESTS
// =============================================================================

describe('WebhooksSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders webhooks list', async () => {
        render(
            <TestWrapper>
                <WebhooksSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/example.com/i)).toBeTruthy();
        });
    });

    it('renders add webhook button', async () => {
        render(
            <TestWrapper>
                <WebhooksSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/add webhook/i)).toBeTruthy();
        });
    });

    it('shows webhook URL and events', async () => {
        render(
            <TestWrapper>
                <WebhooksSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/example.com/i)).toBeTruthy();
            expect(screen.getByText(/task.created/i)).toBeTruthy();
        });
    });

    it('allows creating new webhook', async () => {
        render(
            <TestWrapper>
                <WebhooksSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        const addButton = screen.getByText(/add webhook/i);
        fireEvent.click(addButton);

        // Fill in webhook URL
        const urlInput = screen.getByPlaceholderText(/webhook url/i);
        fireEvent.change(urlInput, { target: { value: 'https://test.com/hook' } });

        // Select event
        const eventCheckbox = screen.getByLabelText(/task.created/i);
        fireEvent.click(eventCheckbox);

        const createButton = screen.getByText(/create/i);
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(Api.createWebhook).toHaveBeenCalledWith(
                expect.objectContaining({ url: 'https://test.com/hook' })
            );
        });
    });
});

// =============================================================================
// CALENDAR SYNC SETTINGS TESTS
// =============================================================================

describe('CalendarSyncSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders Google Calendar option', async () => {
        render(
            <TestWrapper>
                <CalendarSyncSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/google calendar/i)).toBeTruthy();
        });
    });

    it('renders Outlook Calendar option', async () => {
        render(
            <TestWrapper>
                <CalendarSyncSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/outlook calendar/i)).toBeTruthy();
        });
    });

    it('allows connecting Google Calendar', async () => {
        render(
            <TestWrapper>
                <CalendarSyncSettings currentUser={mockUser as any} />
            </TestWrapper>
        );

        const connectButton = screen.getByTestId('connect-google');
        fireEvent.click(connectButton);

        await waitFor(() => {
            expect(Api.connectCalendar).toHaveBeenCalledWith('google');
        });
    });
});

// =============================================================================
// THEME SETTINGS TESTS
// =============================================================================

describe('ThemeSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders light theme option', async () => {
        render(
            <TestWrapper>
                <ThemeSettings
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
                <ThemeSettings
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
                <ThemeSettings
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/system/i)).toBeTruthy();
        });
    });

    it('calls toggleTheme when selecting theme', async () => {
        render(
            <TestWrapper>
                <ThemeSettings
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        const lightButton = screen.getByText(/light/i);
        fireEvent.click(lightButton);

        expect(mockToggleTheme).toHaveBeenCalledWith('light');
    });

    it('highlights current theme', async () => {
        render(
            <TestWrapper>
                <ThemeSettings
                    theme="dark"
                    toggleTheme={mockToggleTheme}
                />
            </TestWrapper>
        );

        const darkOption = screen.getByText(/dark/i).closest('button');
        expect(darkOption?.className).toContain('border-purple');
    });
});

// =============================================================================
// LANGUAGE SETTINGS TESTS
// =============================================================================

describe('LanguageSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders English option', async () => {
        render(
            <TestWrapper>
                <LanguageSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/english/i)).toBeTruthy();
        });
    });

    it('renders Polish option', async () => {
        render(
            <TestWrapper>
                <LanguageSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/polski/i)).toBeTruthy();
        });
    });

    it('allows changing language', async () => {
        render(
            <TestWrapper>
                <LanguageSettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        const polishOption = screen.getByText(/polski/i);
        fireEvent.click(polishOption);

        await waitFor(() => {
            expect(mockOnUpdateUser).toHaveBeenCalledWith(
                expect.objectContaining({ preferredLanguage: 'pl' })
            );
        });
    });
});

// =============================================================================
// ACCESSIBILITY SETTINGS TESTS
// =============================================================================

describe('AccessibilitySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders high contrast toggle', async () => {
        render(
            <TestWrapper>
                <AccessibilitySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/high contrast/i)).toBeTruthy();
        });
    });

    it('renders reduce motion toggle', async () => {
        render(
            <TestWrapper>
                <AccessibilitySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/reduce motion/i)).toBeTruthy();
        });
    });

    it('renders font size selector', async () => {
        render(
            <TestWrapper>
                <AccessibilitySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/font size/i)).toBeTruthy();
        });
    });

    it('renders screen reader mode toggle', async () => {
        render(
            <TestWrapper>
                <AccessibilitySettings
                    currentUser={mockUser as any}
                    onUpdateUser={mockOnUpdateUser}
                />
            </TestWrapper>
        );

        await waitFor(() => {
            expect(screen.getByText(/screen reader/i)).toBeTruthy();
        });
    });
});


