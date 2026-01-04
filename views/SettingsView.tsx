/**
 * SettingsView - Modern two-column Settings Panel
 *
 * Architecture:
 * - Left sidebar (280px) with grouped navigation and search
 * - Right content area with dynamic component rendering
 * - Quick Profile Card at top of sidebar
 *
 * Based on UI/UX best practices from ClickUp, HubSpot, and Slack.
 */

import { ArrowLeft } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Profile components
import { MFASetup } from '../components/Profile/MFASetup';
// Settings components
import { AccessibilitySettings } from '../components/settings/AccessibilitySettings';
import AccountManagementSettings from '../components/settings/AccountManagementSettings';
import { ActiveSessionsSettings } from '../components/settings/ActiveSessionsSettings';
// Advanced settings (existing components)
import { SettingsExportImport } from '../components/settings/advanced/SettingsExportImport';
import { SettingsHistory } from '../components/settings/advanced/SettingsHistory';
import { SettingsTemplates } from '../components/settings/advanced/SettingsTemplates';
import { AIAutoCompleteSettings } from '../components/settings/AIAutoCompleteSettings';
import { AIInstructionsSettings } from '../components/settings/AIInstructionsSettings';
import { AIMemorySettings } from '../components/settings/AIMemorySettings';
import { AIModelSelectionSettings } from '../components/settings/AIModelSelectionSettings';
import { AIParametersSettings } from '../components/settings/AIParametersSettings';
import { AIPersonalitySettings } from '../components/settings/AIPersonalitySettings';
// New components (to be created)
import { AIUsageDashboard } from '../components/settings/AIUsageDashboard';
import { APIAccessSettings } from '../components/settings/APIAccessSettings';
import { AvatarUploader } from '../components/settings/AvatarUploader';
import { CalendarSyncSettings } from '../components/settings/CalendarSyncSettings';
import { ConnectedAppsSettings } from '../components/settings/ConnectedAppsSettings';
import { DashboardPreferencesSettings } from '../components/settings/DashboardPreferencesSettings';
import { DataControlsSettings } from '../components/settings/DataControlsSettings';
import { DeveloperSettings } from '../components/settings/DeveloperSettings';
import { DNDModeSettings } from '../components/settings/DNDModeSettings';
import { EmailNotificationsSettings } from '../components/settings/EmailNotificationsSettings';
import { EmailSignaturesSettings } from '../components/settings/EmailSignaturesSettings';
import { ExportDataSettings } from '../components/settings/ExportDataSettings';
import { KeyboardShortcutsSettings } from '../components/settings/KeyboardShortcutsSettings';
import { LanguageSettings } from '../components/settings/LanguageSettings';
import { LoginHistorySettings } from '../components/settings/LoginHistorySettings';
import { NotificationDigestSettings } from '../components/settings/NotificationDigestSettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { PasswordSettings } from '../components/settings/PasswordSettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { PushNotificationsSettings } from '../components/settings/PushNotificationsSettings';
import { QuickProfileCard } from '../components/settings/QuickProfileCard';
import { QuietHoursSettings } from '../components/settings/QuietHoursSettings';
import { RecoveryOptionsSettings } from '../components/settings/RecoveryOptionsSettings';
import { RegionalSettings } from '../components/settings/RegionalSettings';
import SettingsSidebar, { SettingsSection } from '../components/settings/SettingsSidebar';
import { SoundNotificationsSettings } from '../components/settings/SoundNotificationsSettings';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { VoiceSettings } from '../components/settings/VoiceSettings';
import { WebhooksSettings } from '../components/settings/WebhooksSettings';
import { WorkingHoursSettings } from '../components/settings/WorkingHoursSettings';
import { WorkPreferencesSettings } from '../components/settings/WorkPreferencesSettings';
// UI components
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
// Store and types
import { useAppStore } from '../store/useAppStore';
import { AppView, User } from '../types';

interface SettingsViewProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

// Section metadata for headers
const sectionMeta: Record<SettingsSection, { title: string; subtitle: string }> = {
    // My Settings
    profile: { title: 'Profile', subtitle: 'Manage your personal information and account details' },
    avatar: { title: 'Avatar & Photo', subtitle: 'Upload and manage your profile picture' },
    signatures: { title: 'Email Signatures', subtitle: 'Create and manage your email signatures' },
    'working-hours': { title: 'Working Hours', subtitle: 'Set your availability schedule' },
    // Work Preferences
    dashboard: { title: 'Dashboard', subtitle: 'Customize your dashboard layout and widgets' },
    'work-preferences': { title: 'Work Preferences', subtitle: 'Configure default task and project settings' },
    regional: { title: 'Regional Settings', subtitle: 'Set your timezone, date format, and language preferences' },
    language: { title: 'Language', subtitle: 'Choose your preferred language' },
    // AI & Automation
    'ai-instructions': { title: 'AI Instructions', subtitle: 'Customize how AI responds to you' },
    'ai-model': { title: 'Model Selection', subtitle: 'Choose your preferred AI model' },
    'ai-parameters': { title: 'AI Parameters', subtitle: 'Fine-tune AI response settings' },
    'ai-usage': { title: 'AI Usage Dashboard', subtitle: 'Monitor your AI usage and token consumption' },
    'ai-voice': { title: 'Voice & TTS', subtitle: 'Configure voice input and text-to-speech' },
    'ai-memory': { title: 'AI Memory', subtitle: 'Manage AI context and memory settings' },
    'ai-personality': { title: 'AI Personality', subtitle: 'Set AI tone and communication style' },
    'ai-autocomplete': { title: 'Auto-Complete', subtitle: 'Configure AI-powered suggestions' },
    // Notifications
    'notifications-overview': { title: 'Notifications', subtitle: 'Control how and when you receive notifications' },
    'notifications-email': { title: 'Email Notifications', subtitle: 'Manage email notification preferences' },
    'notifications-push': { title: 'Push Notifications', subtitle: 'Configure browser and mobile push notifications' },
    'notifications-sounds': { title: 'Sound Notifications', subtitle: 'Set notification sounds and volume' },
    'notifications-quiet-hours': { title: 'Quiet Hours', subtitle: 'Schedule times when notifications are muted' },
    'notifications-digest': { title: 'Notification Digest', subtitle: 'Configure notification summary emails' },
    'notifications-dnd': { title: 'Do Not Disturb', subtitle: 'Temporarily pause all notifications' },
    // Security
    password: { title: 'Password', subtitle: 'Change your password and security settings' },
    mfa: { title: 'Two-Factor Authentication', subtitle: 'Add an extra layer of security to your account' },
    sessions: { title: 'Active Sessions', subtitle: 'View and manage your logged-in devices' },
    'login-history': { title: 'Login History', subtitle: 'Review recent account activity' },
    recovery: { title: 'Recovery Options', subtitle: 'Set up account recovery methods' },
    // Integrations
    'connected-apps': { title: 'Connected Apps', subtitle: 'Manage third-party app connections' },
    'calendar-sync': { title: 'Calendar Sync', subtitle: 'Connect your calendars' },
    'api-keys': { title: 'API Keys', subtitle: 'Manage your API access keys' },
    webhooks: { title: 'Webhooks', subtitle: 'Configure webhook endpoints' },
    // Data & Privacy
    'data-controls': { title: 'Data Controls', subtitle: 'Manage your data retention and storage' },
    privacy: { title: 'Privacy', subtitle: 'Control your privacy settings' },
    'export-data': { title: 'Export Data', subtitle: 'Download a copy of your data' },
    'delete-account': { title: 'Delete Account', subtitle: 'Permanently delete your account' },
    // Appearance
    theme: { title: 'Theme', subtitle: 'Choose your preferred color theme' },
    accessibility: { title: 'Accessibility', subtitle: 'Configure accessibility options' },
    shortcuts: { title: 'Keyboard Shortcuts', subtitle: 'View and customize keyboard shortcuts' },
    // Advanced
    'import-export': { title: 'Import/Export Settings', subtitle: 'Backup and restore your settings' },
    templates: { title: 'Settings Templates', subtitle: 'Save and apply settings presets' },
    developer: { title: 'Developer Mode', subtitle: 'Access developer tools and debugging' },
    'beta-features': { title: 'Beta Features', subtitle: 'Try experimental features before release' },
    'settings-history': { title: 'Settings History', subtitle: 'View and restore previous settings' },
};

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, onUpdateUser, theme, toggleTheme }) => {
    const { setCurrentView } = useAppStore();
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

    // Handle section change
    const handleSectionChange = useCallback((section: SettingsSection) => {
        setActiveSection(section);
    }, []);

    // Handle back to dashboard
    const handleBackToDashboard = useCallback(() => {
        setCurrentView(AppView.DASHBOARD);
    }, [setCurrentView]);

    // Get current section metadata
    const currentMeta = useMemo(() => {
        const meta = sectionMeta[activeSection];
        return {
            title: t(`settings.sections.${activeSection}.title`, meta.title),
            subtitle: t(`settings.sections.${activeSection}.subtitle`, meta.subtitle),
        };
    }, [activeSection, t]);

    // Render content based on active section
    const renderContent = useCallback(() => {
        switch (activeSection) {
            // My Settings
            case 'profile':
                return <ProfileSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'avatar':
                return <AvatarUploader currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'signatures':
                return <EmailSignaturesSettings currentUser={currentUser} />;
            case 'working-hours':
                return <WorkingHoursSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;

            // Work Preferences
            case 'dashboard':
                return <DashboardPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'work-preferences':
                return <WorkPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'regional':
                return <RegionalSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'language':
                return <LanguageSettings />;

            // AI & Automation
            case 'ai-instructions':
                return <AIInstructionsSettings />;
            case 'ai-model':
                return <AIModelSelectionSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'ai-parameters':
                return <AIParametersSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'ai-usage':
                return <AIUsageDashboard currentUser={currentUser} />;
            case 'ai-voice':
                return <VoiceSettings />;
            case 'ai-memory':
                return <AIMemorySettings />;
            case 'ai-personality':
                return <AIPersonalitySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'ai-autocomplete':
                return <AIAutoCompleteSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;

            // Notifications
            case 'notifications-overview':
                return <NotificationSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'notifications-email':
                return <EmailNotificationsSettings />;
            case 'notifications-push':
                return <PushNotificationsSettings />;
            case 'notifications-sounds':
                return <SoundNotificationsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'notifications-quiet-hours':
                return <QuietHoursSettings currentUser={currentUser} onUpdate={() => onUpdateUser({})} />;
            case 'notifications-digest':
                return <NotificationDigestSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'notifications-dnd':
                return <DNDModeSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;

            // Security
            case 'password':
                return <PasswordSettings />;
            case 'mfa':
                return <MFASetup isEnabled={currentUser?.mfaEnabled || false} onUpdate={() => onUpdateUser({})} />;
            case 'sessions':
                return <ActiveSessionsSettings />;
            case 'login-history':
                return <LoginHistorySettings />;
            case 'recovery':
                return <RecoveryOptionsSettings currentUser={currentUser} />;

            // Integrations
            case 'connected-apps':
                return <ConnectedAppsSettings />;
            case 'calendar-sync':
                return <CalendarSyncSettings />;
            case 'api-keys':
                return <APIAccessSettings currentUser={currentUser} />;
            case 'webhooks':
                return <WebhooksSettings currentUser={currentUser} />;

            // Data & Privacy
            case 'data-controls':
                return <DataControlsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'privacy':
                return <PrivacySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'export-data':
                return <ExportDataSettings currentUser={currentUser} />;
            case 'delete-account':
                return <AccountManagementSettings />;

            // Appearance
            case 'theme':
                return <ThemeSettings />;
            case 'accessibility':
                return <AccessibilitySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'shortcuts':
                return <KeyboardShortcutsSettings currentUser={currentUser} />;

            // Advanced
            case 'import-export':
                return <SettingsExportImport currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'templates':
                return <SettingsTemplates currentUser={currentUser} onUpdateUser={onUpdateUser} />;
            case 'developer':
                return <DeveloperSettings currentUser={currentUser} />;
            case 'beta-features':
                return <DeveloperSettings currentUser={currentUser} showBetaFeatures />;
            case 'settings-history':
                return <SettingsHistory currentUser={currentUser} onUpdateUser={onUpdateUser} />;

            default:
                return (
                    <div className="flex items-center justify-center h-64 text-slate-500">
                        {t('settings.sectionNotFound', 'Section not found')}
                    </div>
                );
        }
    }, [activeSection, currentUser, onUpdateUser, t]);

    return (
        <div className="flex h-full bg-white dark:bg-navy-900">
            {/* Left Sidebar */}
            <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-navy-700">
                {/* Quick Profile Card */}
                <QuickProfileCard
                    currentUser={currentUser}
                    onUpdateUser={onUpdateUser}
                    onEditProfile={() => setActiveSection('profile')}
                />

                {/* Settings Navigation */}
                <SettingsSidebar
                    activeSection={activeSection}
                    onSectionChange={handleSectionChange}
                    className="flex-1"
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBackToDashboard}
                            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            {t('settings.backToDashboard', 'Back to Dashboard')}
                        </Button>
                        <div className="h-6 w-px bg-slate-200 dark:bg-navy-700" />
                        <div>
                            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                                {currentMeta.title}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{currentMeta.subtitle}</p>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <ScrollArea className="flex-1">
                    <div className="p-6 max-w-4xl">{renderContent()}</div>
                </ScrollArea>
            </div>
        </div>
    );
};

export default SettingsView;
