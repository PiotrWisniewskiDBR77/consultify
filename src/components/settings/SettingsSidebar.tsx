/**
 * SettingsSidebar - Grouped navigation sidebar for Settings
 *
 * Features:
 * - Collapsible groups (matching Admin pattern exactly)
 * - Clean header without icon (Admin-style)
 * - Active state indicators with violet accent
 * - Badge support for counts
 * - Auto-expand group containing active section
 *
 * Design: Matches Admin Sidebar pattern exactly
 */

import {
  Accessibility,
  Bell,
  BookOpen,
  Brain,
  Calendar,
  ChevronDown,
  Clock,
  Code2,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileSignature,
  Globe,
  History,
  Image,
  Key,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  Lock,
  LogOut,
  Mail,
  Mic,
  Monitor,
  Moon,
  Palette,
  Settings,
  Shield,
  Sliders,
  Sparkles,
  User,
  Webhook,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';

// Settings section identifier
export type SettingsSection =
  | 'overview'
  | 'tenant-defaults'
  | 'tenant-branding'
  | 'tenant-security'
  | 'module-preferences'
  // My Settings
  | 'profile'
  | 'avatar'
  | 'signatures'
  | 'working-hours'
  // Work Preferences
  | 'dashboard'
  | 'work-preferences'
  | 'regional'
  | 'language'
  // AI & Automation
  | 'ai-behavior'
  | 'ai-model-params'
  | 'ai-autocomplete'
  | 'ai-memory'
  | 'ai-chat-history'
  | 'ai-privacy'
  | 'ai-prompt-library'
  | 'ai-voice'
  | 'ai-usage'
  // Notifications
  | 'notifications-overview'
  | 'notifications-email-digest'
  | 'notifications-desktop-sounds'
  | 'notifications-availability'
  // Security
  | 'password'
  | 'mfa'
  | 'sessions'
  | 'login-history'
  | 'recovery'
  | 'security-overview'
  | 'sessions-activity'
  | 'security-dashboard'
  | 'auth-access'
  // Integrations
  | 'connected-apps'
  | 'calendar-sync'
  | 'api-keys'
  | 'webhooks'
  // Data & Privacy
  | 'data-controls'
  | 'privacy'
  // Billing
  | 'billing'
  // Appearance
  | 'theme'
  | 'accessibility'
  | 'shortcuts'
  // Advanced
  | 'import-export'
  | 'templates'
  | 'developer'
  | 'beta-features'
  | 'settings-history';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  external?: boolean;
  badge?: string | number;
  badgeType?: 'count' | 'new' | 'beta' | 'warning';
  keywords?: string[];
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  className?: string;
  onBack?: () => void;
  allowedSections?: SettingsSection[];
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  onBack,
  allowedSections,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['my-settings']));
  const allowedSectionSet = useMemo(
    () => (allowedSections?.length ? new Set(allowedSections) : null),
    [allowedSections]
  );

  // Navigation groups configuration - matching Admin structure (no icons on groups)
  const navGroups: NavGroup[] = useMemo<NavGroup[]>(
    () =>
      (
        [
          {
            id: 'my-settings',
            label: t('settings.sidebar.groups.mySettings', 'PERSONAL'),
            items: [
              {
                id: 'profile',
                label: t('settings.sidebar.profile', 'Profile'),
                icon: User,
                keywords: ['name', 'email', 'bio', 'personal'],
              },
              {
                id: 'avatar',
                label: t('settings.sidebar.avatar', 'Avatar & Photo'),
                icon: Image,
                keywords: ['picture', 'photo', 'image'],
              },
              {
                id: 'signatures',
                label: t('settings.sidebar.signatures', 'Email Signatures'),
                icon: FileSignature,
                keywords: ['signature', 'email'],
              },
              {
                id: 'working-hours',
                label: t('settings.sidebar.workingHours', 'Working Hours'),
                icon: Clock,
                keywords: ['hours', 'schedule', 'availability'],
              },
            ],
          },
          {
            id: 'work-preferences',
            label: t('settings.sidebar.groups.workPreferences', 'WORKFLOW'),
            items: [
              {
                id: 'dashboard',
                label: t('settings.sidebar.dashboard', 'Dashboard'),
                icon: LayoutDashboard,
                keywords: ['home', 'widgets', 'start page'],
              },
              {
                id: 'work-preferences',
                label: t('settings.sidebar.workPrefs', 'Work Preferences'),
                icon: Settings,
                keywords: ['tasks', 'projects', 'default'],
              },
              {
                id: 'regional',
                label: t('settings.sidebar.regional', 'Regional'),
                icon: Globe,
                keywords: ['timezone', 'date', 'format', 'currency'],
              },
              {
                id: 'language',
                label: t('settings.sidebar.language', 'Language'),
                icon: Globe,
                keywords: ['locale', 'translation'],
              },
            ],
          },
          {
            id: 'ai-automation-group',
            label: t('settings.sidebar.groups.aiAutomation', 'MODULES: AI & AUTOMATION'),
            items: [
              {
                id: 'ai-behavior',
                label: t('settings.sidebar.aiBehavior', 'Behavior & Instructions'),
                icon: Brain,
                keywords: [
                  'prompt',
                  'system',
                  'behavior',
                  'personality',
                  'tone',
                  'style',
                  'instructions',
                ],
              },
              {
                id: 'ai-model-params',
                label: t('settings.sidebar.aiModelParams', 'Model & Parameters'),
                icon: Sparkles,
                keywords: ['gpt', 'claude', 'gemini', 'llm', 'temperature', 'tokens'],
              },
              {
                id: 'ai-autocomplete',
                label: t('settings.sidebar.aiAutocomplete', 'Auto-Complete'),
                icon: Zap,
                keywords: ['suggestions', 'completion'],
              },
              {
                id: 'ai-memory',
                label: t('settings.sidebar.aiMemory', 'Memory & Context'),
                icon: Database,
                keywords: ['context', 'remember', 'retention', 'memory'],
              },
              {
                id: 'ai-chat-history',
                label: t('settings.sidebar.aiChatHistory', 'Chat History'),
                icon: History,
                keywords: ['history', 'chat', 'conversations', 'transcript'],
              },
              {
                id: 'ai-privacy',
                label: t('settings.sidebar.aiPrivacy', 'Data & Privacy'),
                icon: Shield,
                keywords: ['privacy', 'data', 'access', 'audit', 'compliance'],
              },
              {
                id: 'ai-prompt-library',
                label: t('settings.sidebar.aiPromptLibrary', 'Prompt Library'),
                icon: BookOpen,
                keywords: ['prompts', 'templates', 'saved', 'library'],
              },
              {
                id: 'ai-voice',
                label: t('settings.sidebar.aiVoice', 'Voice & TTS'),
                icon: Mic,
                keywords: ['speech', 'text to speech', 'audio'],
              },
              {
                id: 'ai-usage',
                label: t('settings.sidebar.aiUsage', 'Usage Dashboard'),
                icon: Zap,
                keywords: ['tokens', 'cost', 'usage', 'stats'],
              },
            ],
          },
          {
            id: 'notifications',
            label: t('settings.sidebar.groups.notifications', 'MODULES: NOTIFICATIONS'),
            items: [
              {
                id: 'notifications-overview',
                label: t('settings.sidebar.notificationsOverview', 'Channels & Categories'),
                icon: Bell,
                keywords: ['alerts', 'notifications', 'channels'],
              },
              {
                id: 'notifications-email-digest',
                label: t('settings.sidebar.notificationsEmailDigest', 'Email & Digest'),
                icon: Mail,
                keywords: ['email', 'digest', 'summary', 'daily', 'weekly'],
              },
              {
                id: 'notifications-desktop-sounds',
                label: t('settings.sidebar.notificationsDesktopSounds', 'Desktop & Sounds'),
                icon: Monitor,
                keywords: ['push', 'desktop', 'browser', 'audio', 'alert', 'tone', 'sound'],
              },
              {
                id: 'notifications-availability',
                label: t('settings.sidebar.notificationsAvailability', 'Availability'),
                icon: Moon,
                keywords: [
                  'quiet hours',
                  'dnd',
                  'do not disturb',
                  'focus',
                  'schedule',
                  'silent',
                  'pause',
                ],
              },
            ],
          },
          {
            id: 'security',
            label: t('settings.sidebar.groups.security', 'SECURITY'),
            items: [
              {
                id: 'security-dashboard',
                label: t('settings.sidebar.securityOverview', 'Security Overview'),
                icon: Shield,
                keywords: ['score', 'status', 'protection', 'dashboard', 'mfa', '2fa'],
              },
              {
                id: 'auth-access',
                label: t('settings.sidebar.authAccess', 'Authentication & Access'),
                icon: Lock,
                keywords: ['password', 'sessions', 'recovery', 'login', 'devices', 'history'],
              },
            ],
          },
          {
            id: 'integrations',
            label: t('settings.sidebar.groups.integrations', 'MODULES: INTEGRATIONS'),
            items: [
              {
                id: 'connected-apps',
                label: t('settings.sidebar.connectedApps', 'Connected Apps'),
                icon: Link2,
                keywords: ['slack', 'teams', 'apps'],
              },
              {
                id: 'calendar-sync',
                label: t('settings.sidebar.calendarSync', 'Calendar Sync'),
                icon: Calendar,
                keywords: ['google', 'outlook', 'calendar'],
              },
              {
                id: 'api-keys',
                label: t('settings.sidebar.apiKeys', 'API Keys'),
                icon: Key,
                keywords: ['token', 'developer', 'api'],
              },
              {
                id: 'webhooks',
                label: t('settings.sidebar.webhooks', 'Webhooks'),
                icon: Webhook,
                keywords: ['automation', 'endpoint'],
              },
            ],
          },
          {
            id: 'data-privacy',
            label: t('settings.sidebar.groups.dataPrivacy', 'DATA & PRIVACY'),
            items: [
              {
                id: 'data-controls',
                label: t('settings.sidebar.dataControls', 'Data & Consent'),
                icon: Database,
                keywords: [
                  'gdpr',
                  'retention',
                  'storage',
                  'consent',
                  'export',
                  'delete',
                  'account',
                ],
              },
              {
                id: 'privacy',
                label: t('settings.sidebar.privacy', 'Privacy & Visibility'),
                icon: Shield,
                keywords: ['visibility', 'sharing', 'online', 'profile', 'activity', 'mentions'],
              },
            ],
          },
          {
            id: 'billing',
            label: t('settings.sidebar.groups.billing', 'BILLING'),
            items: [
              {
                id: 'billing',
                label: t('settings.sidebar.billing', 'Subscription & Billing'),
                icon: CreditCard,
                keywords: [
                  'subscription',
                  'plan',
                  'invoice',
                  'payment',
                  'credits',
                  'license',
                  'usage',
                ],
              },
            ],
          },
          {
            id: 'appearance',
            label: t('settings.sidebar.groups.appearance', 'APPEARANCE'),
            items: [
              {
                id: 'theme',
                label: t('settings.sidebar.theme', 'Theme'),
                icon: Palette,
                keywords: ['dark', 'light', 'color'],
              },
              {
                id: 'accessibility',
                label: t('settings.sidebar.accessibility', 'Accessibility'),
                icon: Accessibility,
                keywords: ['contrast', 'motion', 'font'],
              },
              // 'shortcuts' (Keyboard Shortcuts) intentionally hidden until a global
              // shortcut-dispatch system exists. The customizer would otherwise let
              // users rebind shortcuts that are not wired app-wide. Component and
              // route are kept for when the dispatcher lands.
            ],
          },
          {
            id: 'advanced',
            label: t('settings.sidebar.groups.advanced', 'ADVANCED & HISTORY'),
            items: [
              {
                id: 'import-export',
                label: t('settings.sidebar.importExport', 'Import/Export'),
                icon: Download,
                keywords: ['backup', 'restore'],
              },
              {
                id: 'templates',
                label: t('settings.sidebar.templates', 'Templates'),
                icon: BookOpen,
                keywords: ['preset', 'save', 'load'],
              },
              {
                id: 'developer',
                label: t('settings.sidebar.developer', 'Developer'),
                icon: Code2,
                keywords: ['debug', 'api', 'logs'],
              },
              {
                id: 'beta-features',
                label: t('settings.sidebar.betaFeatures', 'Beta Features'),
                icon: Sparkles,
                badge: 'Beta',
                badgeType: 'beta',
                keywords: ['experimental', 'preview'],
              },
              {
                id: 'settings-history',
                label: t('settings.sidebar.settingsHistory', 'History'),
                icon: History,
                keywords: ['changes', 'rollback', 'audit'],
              },
            ],
          },
        ] as NavGroup[]
      )
        .map((group) => ({
          ...group,
          items: allowedSectionSet
            ? group.items.filter((item) => allowedSectionSet.has(item.id))
            : group.items,
        }))
        .filter((group) => group.items.length > 0),
    [allowedSectionSet, t]
  );

  // Toggle group expansion
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Auto-expand group containing active section (only on section change)
  useEffect(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => item.id === activeSection)
    );
    if (activeGroup) {
      setExpandedGroups((prev) => {
        if (prev.has(activeGroup.id)) return prev;
        return new Set([...prev, activeGroup.id]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Render badge
  const renderBadge = (item: NavItem) => {
    if (!item.badge) return null;

    const badgeStyles = {
      count: 'bg-[color-mix(in_srgb,var(--c-info)_12%,transparent)] text-[var(--c-info)]',
      new: 'bg-[color-mix(in_srgb,var(--c-success)_12%,transparent)] text-[var(--c-success)]',
      beta: 'bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] text-[var(--c-warning)]',
      warning: 'bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] text-[var(--c-danger)]',
    };

    return (
      <span
        className={cn(
          'px-1.5 py-0.5 text-[10px] font-medium rounded-full min-w-[18px] text-center',
          badgeStyles[item.badgeType || 'count']
        )}
      >
        {item.badge}
      </span>
    );
  };

  return (
    <div
      role="complementary"
      aria-label={t('settings.sidebar.navigationRegion', 'Settings navigation')}
      className={cn(
        'flex h-full w-[280px] flex-col border-r border-[var(--c-border-subtle)] bg-[var(--c-surface)]',
        className
      )}
    >
      {/* Header - Admin style (no icon, bold title) */}
      <div className="px-5 pb-4 pt-5">
        <h1 className="text-lg font-bold tracking-wide text-[var(--c-text)]">
          {t('settings.sidebar.title', 'SETTINGS')}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--c-text-muted)]">
          {t('settings.sidebar.subtitle', 'Personal, tenant, and module settings')}
        </p>
      </div>

      {/* Navigation - Collapsible Groups (Admin style - no icons on group headers) */}
      <div className="flex-1 overflow-y-auto px-3">
        <nav aria-label={t('settings.sidebar.navigation', 'Settings sections')} className="space-y-1">
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id}>
                {/* Group Header - Clickable, no icon (Admin style) */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`settings-group-${group.id}`}
                  className="flex w-full items-center justify-between px-2 py-2.5 text-[11px] font-semibold tracking-wider text-[var(--c-text-muted)] transition-colors hover:text-[var(--c-text-secondary)]"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      !isExpanded && '-rotate-90'
                    )}
                  />
                </button>

                {/* Group Items - Animated collapse */}
                <div
                  id={`settings-group-${group.id}`}
                  hidden={!isExpanded}
                  className={cn(
                    'overflow-hidden transition-all duration-200 ease-in-out',
                    isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="space-y-0.5 pb-2">
                    {group.items.map((item) => {
                      const isActive = activeSection === item.id;
                      const Icon = item.icon;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => onSectionChange(item.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
                            isActive
                              ? 'bg-[var(--c-accent-soft)] font-medium text-[var(--c-text)]'
                              : 'text-[var(--c-text-secondary)] hover:bg-[var(--c-surface-raised)] hover:text-[var(--c-text)]'
                          )}
                        >
                          <Icon
                            aria-hidden="true"
                            className={cn(
                              'h-4 w-4 flex-shrink-0',
                              isActive ? 'text-[var(--c-info)]' : 'text-[var(--c-text-muted)]'
                            )}
                          />
                          <span className="flex-1 text-left">{item.label}</span>
                          {renderBadge(item)}
                          {item.external && <ExternalLink className="w-3 h-3 opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--c-border-subtle)] p-3">
        <button
          type="button"
          onClick={onBack || (() => window.history.back())}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--c-surface-raised)] hover:text-[var(--c-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
        >
          <LogOut aria-hidden="true" className="w-4 h-4 rotate-180" />
          {t('settings.sidebar.backToDashboard', 'Back to Dashboard')}
        </button>
      </div>
    </div>
  );
};

export default SettingsSidebar;
