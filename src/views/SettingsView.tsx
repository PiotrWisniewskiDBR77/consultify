/**
 * SettingsView - Modern two-column Settings Panel
 *
 * Architecture:
 * - Left sidebar (280px) with grouped navigation and search
 * - Right content area with dynamic component rendering
 * - Mobile-first responsive design
 * - Quick Profile Card at top of sidebar
 *
 * Based on UI/UX best practices from ClickUp, HubSpot, and Slack.
 *
 * @version 2.0
 */

import { ChevronRight, Menu, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';

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
import { AIBehaviorSettings } from '../components/settings/AIBehaviorSettings';
import { AIMemorySettings } from '../components/settings/AIMemorySettings';
import { AIModelParametersSettings } from '../components/settings/AIModelParametersSettings';
import { AIPrivacySettings } from '../components/settings/AIPrivacySettings';
import { AIPromptLibrarySettings } from '../components/settings/AIPromptLibrarySettings';
import { AIUsageDashboard } from '../components/settings/AIUsageDashboard';
import { APIAccessSettings } from '../components/settings/APIAccessSettings';
import { AvatarPhotoSettings } from '../components/settings/AvatarPhotoSettings';
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
// QuickProfileCard removed - using Admin-style layout
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
import { Button } from '../components/ui/primitives/Button';
import { ScrollArea } from '../components/ui/scroll-area';
import { ROUTES } from '../routes/routeConfig';
// Store and types
import { useAppStore } from '../store/useAppStore';
import { AppView, User } from '../types';
import {
  normalizeSettingsSectionFromPath,
  resolveLegacySyncSettingsEntry,
} from './settings/syncEntryResolver';

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
  'work-preferences': {
    title: 'Work Preferences',
    subtitle: 'Configure default task and project settings',
  },
  regional: {
    title: 'Regional Settings',
    subtitle: 'Set your timezone, date format, and language preferences',
  },
  language: { title: 'Language', subtitle: 'Choose your preferred language' },
  // AI & Automation
  'ai-behavior': {
    title: 'Behavior & Instructions',
    subtitle: 'Define how the AI communicates — prompt, tone, style, and context',
  },
  'ai-model-params': {
    title: 'Model & Parameters',
    subtitle: 'Choose AI models and fine-tune generation parameters',
  },
  'ai-autocomplete': { title: 'Auto-Complete', subtitle: 'Configure AI-powered suggestions' },
  'ai-memory': { title: 'Memory & Context', subtitle: 'Control AI memory and context retention' },
  'ai-privacy': {
    title: 'AI Data & Privacy',
    subtitle: 'Control data access, retention, and compliance settings',
  },
  'ai-prompt-library': {
    title: 'Prompt Library',
    subtitle: 'Save and organize reusable prompts for different contexts',
  },
  'ai-voice': { title: 'Voice & TTS', subtitle: 'Configure voice input and text-to-speech' },
  'ai-usage': {
    title: 'Usage Dashboard',
    subtitle: 'Monitor your AI usage and token consumption',
  },
  // Notifications
  'notifications-overview': {
    title: 'Notifications',
    subtitle: 'Control how and when you receive notifications',
  },
  'notifications-email': {
    title: 'Email Notifications',
    subtitle: 'Manage email notification preferences',
  },
  'notifications-push': {
    title: 'Push Notifications',
    subtitle: 'Configure browser and mobile push notifications',
  },
  'notifications-sounds': {
    title: 'Sound Notifications',
    subtitle: 'Set notification sounds and volume',
  },
  'notifications-quiet-hours': {
    title: 'Quiet Hours',
    subtitle: 'Schedule times when notifications are muted',
  },
  'notifications-digest': {
    title: 'Notification Digest',
    subtitle: 'Configure notification summary emails',
  },
  'notifications-dnd': { title: 'Do Not Disturb', subtitle: 'Temporarily pause all notifications' },
  // Security
  password: { title: 'Password', subtitle: 'Change your password and security settings' },
  mfa: {
    title: 'Two-Factor Authentication',
    subtitle: 'Add an extra layer of security to your account',
  },
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
  'import-export': {
    title: 'Import/Export Settings',
    subtitle: 'Backup and restore your settings',
  },
  templates: { title: 'Settings Templates', subtitle: 'Save and apply settings presets' },
  developer: { title: 'Developer Mode', subtitle: 'Access developer tools and debugging' },
  'beta-features': { title: 'Beta Features', subtitle: 'Try experimental features before release' },
  'settings-history': { title: 'Settings History', subtitle: 'View and restore previous settings' },
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateUser,
  theme,
  toggleTheme,
}) => {
  const { setCurrentView } = useAppStore();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const redirectTarget = resolveLegacySyncSettingsEntry(location.pathname, currentUser?.role);
    if (!redirectTarget) return;
    navigate(redirectTarget, { replace: true });
  }, [currentUser?.role, location.pathname, navigate]);

  // Get section from URL path
  const activeSection = useMemo(() => {
    const pathSection = normalizeSettingsSectionFromPath(location.pathname);
    return (
      Object.keys(sectionMeta).includes(pathSection) ? pathSection : 'profile'
    ) as SettingsSection;
  }, [location.pathname]);

  // Handle section change - update URL
  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      navigate(`${ROUTES.SETTINGS.ROOT}/${section}`);
      setSidebarOpen(false);
    },
    [navigate]
  );

  // Handle back to main app (Chat)
  const handleBackToDashboard = useCallback(() => {
    setCurrentView(AppView.AI_CHAT);
    navigate(ROUTES.AI_CHAT);
  }, [navigate, setCurrentView]);

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
        return <AvatarPhotoSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'signatures':
        return <EmailSignaturesSettings currentUser={currentUser} />;
      case 'working-hours':
        return <WorkingHoursSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;

      // Work Preferences
      case 'dashboard':
        return (
          <DashboardPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />
        );
      case 'work-preferences':
        return <WorkPreferencesSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'regional':
        return <RegionalSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'language':
        return <LanguageSettings />;

      // AI & Automation
      case 'ai-behavior':
        return <AIBehaviorSettings />;
      case 'ai-model-params':
        return <AIModelParametersSettings />;
      case 'ai-autocomplete':
        return <AIAutoCompleteSettings />;
      case 'ai-memory':
        return <AIMemorySettings />;
      case 'ai-privacy':
        return <AIPrivacySettings />;
      case 'ai-prompt-library':
        return <AIPromptLibrarySettings />;
      case 'ai-voice':
        return <VoiceSettings />;
      case 'ai-usage':
        return <AIUsageDashboard currentUser={currentUser} />;

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
        return (
          <MFASetup
            isEnabled={currentUser?.mfaEnabled || false}
            onUpdate={() => onUpdateUser({})}
          />
        );
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
          <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
            {t('settings.sectionNotFound', 'Section not found')}
          </div>
        );
    }
  }, [activeSection, currentUser, onUpdateUser, t]);

  return (
    <div className="flex h-full bg-slate-50 dark:bg-navy-950 relative">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Admin Style */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-300 ease-in-out',
          'lg:static lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onBack={handleBackToDashboard}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-navy-900">
        {/* Header - Breadcrumbs Style (Golden Standard) */}
        <header className="flex items-center justify-between px-4 lg:px-6 h-12 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-slate-600 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white p-2"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Breadcrumbs */}
            <div className="flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
              <span
                onClick={handleBackToDashboard}
                className="hover:text-navy-900 dark:hover:text-white cursor-pointer transition-colors"
              >
                Settings
              </span>
              <ChevronRight size={14} className="mx-2" />
              <span className="text-navy-900 dark:text-white">{currentMeta.title}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6 max-w-5xl mx-auto w-full space-y-6">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default SettingsView;
