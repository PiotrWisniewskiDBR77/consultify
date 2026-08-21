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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';

// Profile components
// Settings components
import { AccessibilitySettings } from '../components/settings/AccessibilitySettings';
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
import { AvailabilitySettings } from '../components/settings/AvailabilitySettings';
import { AvatarPhotoSettings } from '../components/settings/AvatarPhotoSettings';
import { BillingSettings } from '../components/settings/BillingSettings';
import { CalendarSyncSettings } from '../components/settings/CalendarSyncSettings';
import { ChatHistorySettings } from '../components/settings/ChatHistorySettings';
import { ConnectedAppsSettings } from '../components/settings/ConnectedAppsSettings';
import { DashboardPreferencesSettings } from '../components/settings/DashboardPreferencesSettings';
import { DataControlsSettings } from '../components/settings/DataControlsSettings';
import { DesktopSoundsSettings } from '../components/settings/DesktopSoundsSettings';
import { DeveloperSettings } from '../components/settings/DeveloperSettings';
import { EmailDigestSettings } from '../components/settings/EmailDigestSettings';
import { EmailSignaturesSettings } from '../components/settings/EmailSignaturesSettings';
import { KeyboardShortcutsSettings } from '../components/settings/KeyboardShortcutsSettings';
import { LanguageSettings } from '../components/settings/LanguageSettings';
import { NotificationSettings } from '../components/settings/NotificationSettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
// QuickProfileCard removed - using Admin-style layout
import { RegionalSettings } from '../components/settings/RegionalSettings';
import { AuthenticationAccessPage } from '../components/settings/security/AuthenticationAccessPage';
import { SecurityOverviewPage } from '../components/settings/security/SecurityOverviewPage';
import { SettingsHeaderActionsProvider } from '../components/settings/SettingsHeaderActions';
import SettingsOwnershipPanels from '../components/settings/SettingsOwnershipPanels';
import SettingsSidebar, { SettingsSection } from '../components/settings/SettingsSidebar';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { VoiceSettings } from '../components/settings/VoiceSettings';
import { WebhooksSettings } from '../components/settings/WebhooksSettings';
import { WorkingHoursSettings } from '../components/settings/WorkingHoursSettings';
import { WorkPreferencesSettings } from '../components/settings/WorkPreferencesSettings';
import { EmptyState } from '../components/shared/states';
// UI components
import { Button } from '../components/ui/primitives/Button';
import { ScrollArea } from '../components/ui/scroll-area';
import { ROUTES } from '../routes/routeConfig';
// Store and types
import { useAppStore } from '../store/useAppStore';
import { AppView, User } from '../types';
import {
  getPilotDefaultSettingsRoute,
  isPilotAllowedSettingsSection,
  isPilotParticipantRole,
} from '../utils/pilotAccess';
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
  overview: {
    title: 'Settings Overview',
    subtitle: 'One root for personal settings, tenant handoff, and module preferences',
  },
  'tenant-defaults': {
    title: 'Tenant Defaults',
    subtitle:
      'Read organization defaults and shared runtime impact without duplicating P30 ownership',
  },
  'tenant-branding': {
    title: 'Branding Handoff',
    subtitle: 'Branding is consumed read-only from Organization and linked to the owning surface',
  },
  'tenant-security': {
    title: 'Security Handoff',
    subtitle: 'Security policy stays visible here, but all writes route to Admin',
  },
  'module-preferences': {
    title: 'Module Preferences',
    subtitle: 'Discover module-level defaults and where they inherit from the root ownership model',
  },
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
  'ai-chat-history': {
    title: 'Chat History',
    subtitle: 'Manage conversation history retention, export, and cleanup',
  },
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
    title: 'Channels & Categories',
    subtitle: 'Control how and when you receive notifications across all channels',
  },
  'notifications-email-digest': {
    title: 'Email & Digest',
    subtitle: 'Choose which emails you receive and how they are summarized',
  },
  'notifications-desktop-sounds': {
    title: 'Desktop & Sounds',
    subtitle: 'Configure how notifications appear on screen and what sounds they play',
  },
  'notifications-availability': {
    title: 'Availability',
    subtitle: 'Control when notifications reach you — temporary mute or recurring schedule',
  },
  // Security (legacy keys kept for URL compat)
  password: { title: 'Password', subtitle: 'Change your password and security settings' },
  mfa: {
    title: 'Two-Factor Authentication',
    subtitle: 'Add an extra layer of security to your account',
  },
  sessions: { title: 'Active Sessions', subtitle: 'View and manage your logged-in devices' },
  'login-history': { title: 'Login History', subtitle: 'Review recent account activity' },
  recovery: { title: 'Recovery Options', subtitle: 'Set up account recovery methods' },
  'security-overview': {
    title: 'Security Overview',
    subtitle: 'Password, two-factor authentication, and recovery options',
  },
  'sessions-activity': {
    title: 'Sessions & Activity',
    subtitle: 'Monitor active sessions and review login history',
  },
  'security-dashboard': {
    title: 'Security Overview',
    subtitle: 'Monitor your account security status and manage protection settings',
  },
  'auth-access': {
    title: 'Authentication & Access',
    subtitle: 'Manage your password, two-factor authentication, sessions, and recovery options',
  },
  // Integrations
  'connected-apps': { title: 'Connected Apps', subtitle: 'Manage third-party app connections' },
  'calendar-sync': { title: 'Calendar Sync', subtitle: 'Connect your calendars' },
  'api-keys': { title: 'API Keys', subtitle: 'Manage your API access keys' },
  webhooks: { title: 'Webhooks', subtitle: 'Configure webhook endpoints' },
  // Data & Privacy
  'data-controls': {
    title: 'Data & Consent',
    subtitle: 'GDPR compliance, consent management, data retention, and account actions',
  },
  billing: {
    title: 'Subscription & Billing',
    subtitle: 'Manage your plan, invoices, usage, and billing terms',
  },
  privacy: {
    title: 'Privacy & Visibility',
    subtitle: 'Control who can see your information and activity',
  },
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
  const [headerActionsTarget, setHeaderActionsTarget] = useState<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const isPilotParticipant = isPilotParticipantRole(currentUser?.role);
  const pilotAllowedSections = useMemo(
    () => ['profile', 'auth-access', 'language', 'theme'] as SettingsSection[],
    []
  );

  useEffect(() => {
    if (location.pathname.replace(/\/+$/, '') === ROUTES.SETTINGS.ROOT) {
      navigate(ROUTES.SETTINGS.PROFILE, { replace: true });
      return;
    }
    const redirectTarget = resolveLegacySyncSettingsEntry(location.pathname, currentUser?.role);
    if (!redirectTarget) return;
    navigate(redirectTarget, { replace: true });
  }, [currentUser?.role, location.pathname, navigate]);

  // Get section from URL path
  const activeSection = useMemo(() => {
    const pathSection = normalizeSettingsSectionFromPath(location.pathname);
    return (
      Object.keys(sectionMeta).includes(pathSection) ? pathSection : 'overview'
    ) as SettingsSection;
  }, [location.pathname]);

  useEffect(() => {
    if (!isPilotParticipant) return;
    if (isPilotAllowedSettingsSection(activeSection)) return;
    navigate(getPilotDefaultSettingsRoute(), { replace: true });
  }, [activeSection, isPilotParticipant, navigate]);

  // Hidden sections redirect to Profile. Their nav entries are removed from the
  // sidebar; if reached via URL, bounce to profile.
  //  - SET-28: read-only ownership/handoff sections (no user value, read-only).
  //  - 'shortcuts': the Keyboard Shortcuts customizer is hidden until a global
  //    shortcut-dispatch system exists (rebinds are otherwise not wired app-wide).
  useEffect(() => {
    // A legacy alias (e.g. /settings/integrations) resolves to 'overview' here
    // before its own redirect lands, so it would falsely match a hidden section.
    // Let the legacy resolver redirect win instead of bouncing to Profile —
    // otherwise this effect clobbers it (both fire on the same mount commit).
    if (resolveLegacySyncSettingsEntry(location.pathname, currentUser?.role)) return;
    const hiddenSections: SettingsSection[] = [
      'overview',
      'tenant-defaults',
      'tenant-branding',
      'tenant-security',
      'module-preferences',
      'shortcuts',
    ];
    if (hiddenSections.includes(activeSection)) {
      navigate(ROUTES.SETTINGS.PROFILE, { replace: true });
    }
  }, [activeSection, currentUser?.role, location.pathname, navigate]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileMenuButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [sidebarOpen]);

  // Handle section change - update URL
  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      if (isPilotParticipant && !isPilotAllowedSettingsSection(section)) {
        navigate(getPilotDefaultSettingsRoute());
        setSidebarOpen(false);
        return;
      }
      navigate(`${ROUTES.SETTINGS.ROOT}/${section}`);
      setSidebarOpen(false);
    },
    [isPilotParticipant, navigate]
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
  const settingsLabel = useMemo(() => {
    const label = t('settings.sidebar.title', 'Settings');
    if (label !== label.toLocaleUpperCase()) return label;
    const normalized = label.toLocaleLowerCase();
    return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
  }, [t]);

  // Render content based on active section
  const renderContent = useCallback(() => {
    switch (activeSection) {
      // My Settings
      case 'overview':
        return <SettingsOwnershipPanels mode="overview" onOpenSection={handleSectionChange} />;
      case 'tenant-defaults':
        return (
          <SettingsOwnershipPanels mode="tenant-defaults" onOpenSection={handleSectionChange} />
        );
      case 'tenant-branding':
        return (
          <SettingsOwnershipPanels mode="tenant-branding" onOpenSection={handleSectionChange} />
        );
      case 'tenant-security':
        return (
          <SettingsOwnershipPanels mode="tenant-security" onOpenSection={handleSectionChange} />
        );
      case 'module-preferences':
        return (
          <SettingsOwnershipPanels mode="module-preferences" onOpenSection={handleSectionChange} />
        );
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
      case 'ai-chat-history':
        return <ChatHistorySettings />;
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
      case 'notifications-email-digest':
        return <EmailDigestSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'notifications-desktop-sounds':
        return <DesktopSoundsSettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'notifications-availability':
        return <AvailabilitySettings currentUser={currentUser} onUpdateUser={onUpdateUser} />;

      // Security (consolidated v2)
      case 'security-dashboard':
        return <SecurityOverviewPage currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'auth-access':
        return <AuthenticationAccessPage currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      // Legacy security routes (redirect to new consolidated views)
      case 'security-overview':
        return <SecurityOverviewPage currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'sessions-activity':
      case 'sessions':
      case 'login-history':
        return <AuthenticationAccessPage currentUser={currentUser} onUpdateUser={onUpdateUser} />;
      case 'password':
      case 'mfa':
      case 'recovery':
        return <AuthenticationAccessPage currentUser={currentUser} onUpdateUser={onUpdateUser} />;

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

      // Billing
      case 'billing':
        return <BillingSettings currentUser={currentUser} />;

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
          <EmptyState
            variant="filter"
            title={t('settings.sectionNotFound', 'Section not found')}
            description={t(
              'settings.sectionNotFoundHint',
              'This settings section does not exist. Pick another from the sidebar.'
            )}
          />
        );
    }
  }, [activeSection, currentUser, onUpdateUser, t]);

  return (
    <SettingsHeaderActionsProvider value={headerActionsTarget}>
      <div className="relative flex h-full bg-[var(--c-bg)]">
        {/* Mobile Overlay */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label={t('settings.sidebar.closeNavigation', 'Close settings navigation')}
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Admin Style */}
        <div
          id="settings-navigation"
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
            allowedSections={isPilotParticipant ? pilotAllowedSections : undefined}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--c-surface)]">
          {/* Header - Breadcrumbs Style (Golden Standard) */}
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[var(--c-border-subtle)] bg-[var(--c-surface)] px-4 lg:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Button
                ref={mobileMenuButtonRef}
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={
                  sidebarOpen
                    ? t('settings.sidebar.closeNavigation', 'Close settings navigation')
                    : t('settings.sidebar.openNavigation', 'Open settings navigation')
                }
                aria-expanded={sidebarOpen}
                aria-controls="settings-navigation"
                className="p-2 text-[var(--c-text-secondary)] hover:text-[var(--c-text)] lg:hidden"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              {/* Breadcrumbs */}
              <div className="flex items-center text-sm font-medium text-[var(--c-text-muted)]">
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="rounded-sm transition-colors hover:text-[var(--c-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                >
                  {settingsLabel}
                </button>
                <ChevronRight size={14} aria-hidden="true" className="mx-2" />
                <h1
                  id="settings-page-title"
                  className="truncate text-sm font-medium text-[var(--c-text)]"
                >
                  {currentMeta.title}
                </h1>
              </div>
            </div>
            <div ref={setHeaderActionsTarget} className="flex shrink-0 items-center gap-2" />
          </header>

          {/* Content */}
          <ScrollArea className="flex-1">
            <main
              aria-labelledby="settings-page-title"
              className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-5 lg:p-6"
            >
              {renderContent()}
            </main>
          </ScrollArea>
        </div>
      </div>
    </SettingsHeaderActionsProvider>
  );
};

export default SettingsView;
