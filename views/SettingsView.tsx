/**
 * SettingsView - Main Settings Panel with 6-Module Tab Structure
 * 
 * Modules: Profile | AI Preferences | Notifications | Security | Integrations | Appearance
 * 
 * Uses tabs within the content area - NO separate sidebar.
 * Navigation is handled via the main Sidebar floating menu.
 */

import React, { useMemo } from 'react';
import { User, AppView } from '../types';
import { useAppStore } from '../store/useAppStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
    UserCircle,
    Brain,
    Bell,
    Shield,
    Link,
    Palette,
    User as UserIcon,
    Image,
    Key,
    CreditCard,
    Trash2,
    MessageSquare,
    History,
    Mic,
    Volume2,
    Mail,
    Smartphone,
    Clock,
    Fingerprint,
    Monitor,
    Database,
    EyeOff,
    LayoutGrid,
    Webhook,
    Calendar,
    Sun,
    Globe,
    Accessibility,
    Settings,
    ClipboardList,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Import settings components
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { AvatarSettings } from '../components/settings/AvatarSettings';
import { PasswordSettings } from '../components/settings/PasswordSettings';
import { BillingSettings } from '../components/settings/BillingSettings';
import { AccountManagementSettings } from '../components/settings/AccountManagementSettings';
import { AIInstructionsSettings } from '../components/settings/AIInstructionsSettings';
import { AIMemorySettings } from '../components/settings/AIMemorySettings';
import { ResponseStyleSettings } from '../components/settings/ResponseStyleSettings';
import { ChatHistorySettings } from '../components/settings/ChatHistorySettings';
import { VoiceSettings } from '../components/settings/VoiceSettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { EmailNotificationsSettings } from '../components/settings/EmailNotificationsSettings';
import { PushNotificationsSettings } from '../components/settings/PushNotificationsSettings';
import { NotificationScheduleSettings } from '../components/settings/NotificationScheduleSettings';
import { MFASetup } from '../components/Profile/MFASetup';
import { ActiveSessionsSettings } from '../components/settings/ActiveSessionsSettings';
import { LoginHistorySettings } from '../components/settings/LoginHistorySettings';
import { DataControlsSettings } from '../components/settings/DataControlsSettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { ConnectedAppsSettings } from '../components/settings/ConnectedAppsSettings';
import { APIAccessSettings } from '../components/settings/APIAccessSettings';
import { WebhooksSettings } from '../components/settings/WebhooksSettings';
import { CalendarSyncSettings } from '../components/settings/CalendarSyncSettings';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { LanguageSettings } from '../components/settings/LanguageSettings';
import { RegionalSettings } from '../components/settings/RegionalSettings';
import { AccessibilitySettings } from '../components/settings/AccessibilitySettings';
import { WorkPreferencesSettings } from '../components/settings/WorkPreferencesSettings';
import { DashboardPreferencesSettings } from '../components/settings/DashboardPreferencesSettings';

// Settings section type
type SettingsSection = 'profile' | 'ai-preferences' | 'notifications' | 'security' | 'integrations' | 'appearance';

// Map AppView to SettingsSection
const getSettingsSection = (view: AppView): SettingsSection => {
    // New module-based navigation
    if (view === AppView.SETTINGS_PROFILE_MODULE) return 'profile';
    if (view === AppView.SETTINGS_AI_MODULE) return 'ai-preferences';
    if (view === AppView.SETTINGS_NOTIFICATIONS_MODULE) return 'notifications';
    if (view === AppView.SETTINGS_SECURITY_MODULE) return 'security';
    if (view === AppView.SETTINGS_INTEGRATIONS_MODULE) return 'integrations';
    if (view === AppView.SETTINGS_APPEARANCE_MODULE) return 'appearance';

    // Legacy views mapping
    if (view === AppView.SETTINGS_PROFILE || view === AppView.SETTINGS_BILLING) {
        return 'profile';
    }
    if (view === AppView.SETTINGS_AI || view === AppView.SETTINGS_AI_MEMORY || view === AppView.SETTINGS_AI_RESPONSE_STYLE ||
        view === AppView.SETTINGS_AI_CHAT_HISTORY || view === AppView.SETTINGS_AI_VOICE) {
        return 'ai-preferences';
    }
    if (view === AppView.SETTINGS_NOTIFICATIONS) {
        return 'notifications';
    }
    if (view === AppView.SETTINGS_SECURITY || view === AppView.SETTINGS_MFA || view === AppView.SETTINGS_ACTIVE_SESSIONS ||
        view === AppView.SETTINGS_LOGIN_HISTORY || view === AppView.SETTINGS_DATA_CONTROLS || view === AppView.SETTINGS_PRIVACY) {
        return 'security';
    }
    if (view === AppView.SETTINGS_INTEGRATIONS || view === AppView.SETTINGS_API_ACCESS ||
        view === AppView.SETTINGS_WEBHOOKS || view === AppView.SETTINGS_CALENDAR_SYNC) {
        return 'integrations';
    }
    if (view === AppView.SETTINGS_APPEARANCE || view === AppView.SETTINGS_REGIONALIZATION ||
        view === AppView.SETTINGS_ACCESSIBILITY || view === AppView.SETTINGS_WORK_PREFERENCES ||
        view === AppView.SETTINGS_DASHBOARD_PREFERENCES) {
        return 'appearance';
    }
    return 'profile';
};

interface SettingsViewProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
    theme: 'light' | 'dark' | 'system';
    toggleTheme: (newTheme?: 'light' | 'dark' | 'system') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    currentUser,
    onUpdateUser,
    theme,
    toggleTheme
}) => {
    const { currentView, setCurrentView } = useAppStore();
    const { t } = useTranslation();

    // Derive active section from currentView
    const activeSection = useMemo<SettingsSection>(() => {
        return getSettingsSection(currentView);
    }, [currentView]);

    // Handle section change - using new module AppView values
    const handleSectionChange = (section: string) => {
        switch (section) {
            case 'profile':
                setCurrentView(AppView.SETTINGS_PROFILE_MODULE);
                break;
            case 'ai-preferences':
                setCurrentView(AppView.SETTINGS_AI_MODULE);
                break;
            case 'notifications':
                setCurrentView(AppView.SETTINGS_NOTIFICATIONS_MODULE);
                break;
            case 'security':
                setCurrentView(AppView.SETTINGS_SECURITY_MODULE);
                break;
            case 'integrations':
                setCurrentView(AppView.SETTINGS_INTEGRATIONS_MODULE);
                break;
            case 'appearance':
                setCurrentView(AppView.SETTINGS_APPEARANCE_MODULE);
                break;
        }
    };

    // Get section title and subtitle
    const getSectionInfo = () => {
        switch (activeSection) {
            case 'profile':
                return {
                    title: t('settings.profile.title', 'Profile'),
                    subtitle: t('settings.profile.subtitle', 'Manage your personal information and account settings')
                };
            case 'ai-preferences':
                return {
                    title: t('settings.aiPreferences.title', 'AI Preferences'),
                    subtitle: t('settings.aiPreferences.subtitle', 'Customize how AI responds to you')
                };
            case 'notifications':
                return {
                    title: t('settings.notifications.title', 'Notifications'),
                    subtitle: t('settings.notifications.subtitle', 'Control how and when you receive notifications')
                };
            case 'security':
                return {
                    title: t('settings.security.title', 'Security & Privacy'),
                    subtitle: t('settings.security.subtitle', 'Manage your security settings and data')
                };
            case 'integrations':
                return {
                    title: t('settings.integrations.title', 'Integrations'),
                    subtitle: t('settings.integrations.subtitle', 'Connect apps, manage API keys, and configure webhooks')
                };
            case 'appearance':
                return {
                    title: t('settings.appearance.title', 'Appearance & Regional'),
                    subtitle: t('settings.appearance.subtitle', 'Customize your visual preferences and regional settings')
                };
            default:
                return { title: 'Settings', subtitle: '' };
        }
    };

    const sectionInfo = getSectionInfo();

    // Render content based on active section
    const renderContent = () => {
        switch (activeSection) {
            case 'profile':
                return (
                    <Tabs defaultValue="personal" className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-navy-800/50 p-1 rounded-lg">
                            <TabsTrigger value="personal" className="flex items-center gap-2">
                                <UserIcon size={16} />
                                {t('settings.profile.tabs.personal', 'Personal Info')}
                            </TabsTrigger>
                            <TabsTrigger value="avatar" className="flex items-center gap-2">
                                <Image size={16} />
                                {t('settings.profile.tabs.avatar', 'Avatar')}
                            </TabsTrigger>
                            <TabsTrigger value="password" className="flex items-center gap-2">
                                <Key size={16} />
                                {t('settings.profile.tabs.password', 'Password')}
                            </TabsTrigger>
                            <TabsTrigger value="billing" className="flex items-center gap-2">
                                <CreditCard size={16} />
                                {t('settings.profile.tabs.billing', 'Billing')}
                            </TabsTrigger>
                            <TabsTrigger value="account" className="flex items-center gap-2">
                                <Trash2 size={16} />
                                {t('settings.profile.tabs.account', 'Account')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="personal" className="mt-6">
                            <ProfileSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="avatar" className="mt-6">
                            <AvatarSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="password" className="mt-6">
                            <PasswordSettings />
                        </TabsContent>
                        <TabsContent value="billing" className="mt-6">
                            <BillingSettings currentUser={currentUser} />
                        </TabsContent>
                        <TabsContent value="account" className="mt-6">
                            <AccountManagementSettings currentUser={currentUser} />
                        </TabsContent>
                    </Tabs>
                );

            case 'ai-preferences':
                return (
                    <Tabs defaultValue="instructions" className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-navy-800/50 p-1 rounded-lg">
                            <TabsTrigger value="instructions" className="flex items-center gap-2">
                                <MessageSquare size={16} />
                                {t('settings.ai.tabs.instructions', 'Instructions')}
                            </TabsTrigger>
                            <TabsTrigger value="memory" className="flex items-center gap-2">
                                <Brain size={16} />
                                {t('settings.ai.tabs.memory', 'Memory')}
                            </TabsTrigger>
                            <TabsTrigger value="style" className="flex items-center gap-2">
                                <Settings size={16} />
                                {t('settings.ai.tabs.style', 'Response Style')}
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History size={16} />
                                {t('settings.ai.tabs.history', 'Chat History')}
                            </TabsTrigger>
                            <TabsTrigger value="voice" className="flex items-center gap-2">
                                <Mic size={16} />
                                {t('settings.ai.tabs.voice', 'Voice')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="instructions" className="mt-6">
                            <AIInstructionsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="memory" className="mt-6">
                            <AIMemorySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="style" className="mt-6">
                            <ResponseStyleSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="history" className="mt-6">
                            <ChatHistorySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="voice" className="mt-6">
                            <VoiceSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                    </Tabs>
                );

            case 'notifications':
                return (
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-navy-800/50 p-1 rounded-lg">
                            <TabsTrigger value="all" className="flex items-center gap-2">
                                <Bell size={16} />
                                {t('settings.notifications.tabs.all', 'All')}
                            </TabsTrigger>
                            <TabsTrigger value="email" className="flex items-center gap-2">
                                <Mail size={16} />
                                {t('settings.notifications.tabs.email', 'Email')}
                            </TabsTrigger>
                            <TabsTrigger value="push" className="flex items-center gap-2">
                                <Smartphone size={16} />
                                {t('settings.notifications.tabs.push', 'Push')}
                            </TabsTrigger>
                            <TabsTrigger value="schedule" className="flex items-center gap-2">
                                <Clock size={16} />
                                {t('settings.notifications.tabs.schedule', 'Schedule')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="all" className="mt-6">
                            <NotificationSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="email" className="mt-6">
                            <EmailNotificationsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="push" className="mt-6">
                            <PushNotificationsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="schedule" className="mt-6">
                            <NotificationScheduleSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                    </Tabs>
                );

            case 'security':
                return (
                    <Tabs defaultValue="mfa" className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-navy-800/50 p-1 rounded-lg">
                            <TabsTrigger value="mfa" className="flex items-center gap-2">
                                <Fingerprint size={16} />
                                {t('settings.security.tabs.mfa', 'MFA')}
                            </TabsTrigger>
                            <TabsTrigger value="sessions" className="flex items-center gap-2">
                                <Monitor size={16} />
                                {t('settings.security.tabs.sessions', 'Sessions')}
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2">
                                <History size={16} />
                                {t('settings.security.tabs.history', 'Login History')}
                            </TabsTrigger>
                            <TabsTrigger value="data" className="flex items-center gap-2">
                                <Database size={16} />
                                {t('settings.security.tabs.data', 'Data Controls')}
                            </TabsTrigger>
                            <TabsTrigger value="privacy" className="flex items-center gap-2">
                                <EyeOff size={16} />
                                {t('settings.security.tabs.privacy', 'Privacy')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="mfa" className="mt-6">
                            <MFASetup
                                isEnabled={currentUser?.mfaEnabled || false}
                                onUpdate={() => onUpdateUser({})}
                            />
                        </TabsContent>
                        <TabsContent value="sessions" className="mt-6">
                            <ActiveSessionsSettings />
                        </TabsContent>
                        <TabsContent value="history" className="mt-6">
                            <LoginHistorySettings />
                        </TabsContent>
                        <TabsContent value="data" className="mt-6">
                            <DataControlsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="privacy" className="mt-6">
                            <PrivacySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                    </Tabs>
                );

            case 'integrations':
                return (
                    <Tabs defaultValue="apps" className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-navy-800/50 p-1 rounded-lg">
                            <TabsTrigger value="apps" className="flex items-center gap-2">
                                <LayoutGrid size={16} />
                                {t('settings.integrations.tabs.apps', 'Apps')}
                            </TabsTrigger>
                            <TabsTrigger value="api" className="flex items-center gap-2">
                                <Key size={16} />
                                {t('settings.integrations.tabs.api', 'API Keys')}
                            </TabsTrigger>
                            <TabsTrigger value="webhooks" className="flex items-center gap-2">
                                <Webhook size={16} />
                                {t('settings.integrations.tabs.webhooks', 'Webhooks')}
                            </TabsTrigger>
                            <TabsTrigger value="calendar" className="flex items-center gap-2">
                                <Calendar size={16} />
                                {t('settings.integrations.tabs.calendar', 'Calendar')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="apps" className="mt-6">
                            <ConnectedAppsSettings currentUser={currentUser} />
                        </TabsContent>
                        <TabsContent value="api" className="mt-6">
                            <APIAccessSettings currentUser={currentUser} />
                        </TabsContent>
                        <TabsContent value="webhooks" className="mt-6">
                            <WebhooksSettings currentUser={currentUser} />
                        </TabsContent>
                        <TabsContent value="calendar" className="mt-6">
                            <CalendarSyncSettings currentUser={currentUser} />
                        </TabsContent>
                    </Tabs>
                );

            case 'appearance':
                return (
                    <Tabs defaultValue="theme" className="w-full">
                        <TabsList className="bg-slate-100 dark:bg-navy-800/50 p-1 rounded-lg flex-wrap">
                            <TabsTrigger value="theme" className="flex items-center gap-2">
                                <Sun size={16} />
                                {t('settings.appearance.tabs.theme', 'Theme')}
                            </TabsTrigger>
                            <TabsTrigger value="language" className="flex items-center gap-2">
                                <Globe size={16} />
                                {t('settings.appearance.tabs.language', 'Language')}
                            </TabsTrigger>
                            <TabsTrigger value="regional" className="flex items-center gap-2">
                                <Clock size={16} />
                                {t('settings.appearance.tabs.regional', 'Regional')}
                            </TabsTrigger>
                            <TabsTrigger value="accessibility" className="flex items-center gap-2">
                                <Accessibility size={16} />
                                {t('settings.appearance.tabs.accessibility', 'Accessibility')}
                            </TabsTrigger>
                            <TabsTrigger value="work" className="flex items-center gap-2">
                                <ClipboardList size={16} />
                                {t('settings.appearance.tabs.work', 'Work')}
                            </TabsTrigger>
                            <TabsTrigger value="dashboard" className="flex items-center gap-2">
                                <LayoutGrid size={16} />
                                {t('settings.appearance.tabs.dashboard', 'Dashboard')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="theme" className="mt-6">
                            <ThemeSettings theme={theme} toggleTheme={toggleTheme} />
                        </TabsContent>
                        <TabsContent value="language" className="mt-6">
                            <LanguageSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="regional" className="mt-6">
                            <RegionalSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="accessibility" className="mt-6">
                            <AccessibilitySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="work" className="mt-6">
                            <WorkPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                        <TabsContent value="dashboard" className="mt-6">
                            <DashboardPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
                        </TabsContent>
                    </Tabs>
                );

            default:
                return null;
        }
    };

    return (
        <div className="h-full overflow-auto">
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {sectionInfo.title}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {sectionInfo.subtitle}
                    </p>
                </div>

                {/* Content with tabs */}
                {renderContent()}
            </div>
        </div>
    );
};

export default SettingsView;
