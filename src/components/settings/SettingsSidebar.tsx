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
  Database,
  Download,
  ExternalLink,
  FileSignature,
  Globe,
  History,
  Image,
  Key,
  Keyboard,
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
  Trash2,
  User,
  Webhook,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';

// Settings section identifier
export type SettingsSection =
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
  // Integrations
  | 'connected-apps'
  | 'calendar-sync'
  | 'api-keys'
  | 'webhooks'
  // Data & Privacy
  | 'data-controls'
  | 'privacy'
  | 'export-data'
  | 'delete-account'
  // Appearance
  | 'theme'
  | 'accessibility'
  | 'shortcuts'
  // Advanced
  | 'import-export'
  | 'templates'
  | 'developer'
  | 'beta-features'
  | 'settings-history'
;

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
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  onBack,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['my-settings']));

  // Navigation groups configuration - matching Admin structure (no icons on groups)
  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'my-settings',
        label: t('settings.sidebar.groups.mySettings', 'MY SETTINGS'),
        defaultOpen: true,
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
        label: t('settings.sidebar.groups.workPreferences', 'WORK PREFERENCES'),
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
        label: t('settings.sidebar.groups.aiAutomation', 'AI & AUTOMATION'),
        items: [
          {
            id: 'ai-behavior',
            label: t('settings.sidebar.aiBehavior', 'Behavior & Instructions'),
            icon: Brain,
            keywords: ['prompt', 'system', 'behavior', 'personality', 'tone', 'style', 'instructions'],
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
            keywords: ['context', 'history', 'remember', 'retention'],
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
        label: t('settings.sidebar.groups.notifications', 'NOTIFICATIONS'),
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
            keywords: ['quiet hours', 'dnd', 'do not disturb', 'focus', 'schedule', 'silent', 'pause'],
          },
        ],
      },
      {
        id: 'security',
        label: t('settings.sidebar.groups.security', 'SECURITY'),
        items: [
          {
            id: 'password',
            label: t('settings.sidebar.password', 'Password'),
            icon: Key,
            keywords: ['change', 'reset', 'credentials'],
          },
          {
            id: 'mfa',
            label: t('settings.sidebar.mfa', 'Two-Factor Auth'),
            icon: Shield,
            keywords: ['2fa', 'authenticator', 'totp'],
          },
          {
            id: 'sessions',
            label: t('settings.sidebar.sessions', 'Active Sessions'),
            icon: Monitor,
            keywords: ['devices', 'logged in'],
          },
          {
            id: 'login-history',
            label: t('settings.sidebar.loginHistory', 'Login History'),
            icon: History,
            keywords: ['activity', 'sign in'],
          },
          {
            id: 'recovery',
            label: t('settings.sidebar.recovery', 'Recovery Options'),
            icon: LifeBuoy,
            keywords: ['backup', 'email', 'phone'],
          },
        ],
      },
      {
        id: 'integrations',
        label: t('settings.sidebar.groups.integrations', 'INTEGRATIONS'),
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
            label: t('settings.sidebar.dataControls', 'Data Controls'),
            icon: Database,
            keywords: ['retention', 'storage'],
          },
          {
            id: 'privacy',
            label: t('settings.sidebar.privacy', 'Privacy'),
            icon: Lock,
            keywords: ['visibility', 'sharing', 'consent'],
          },
          {
            id: 'export-data',
            label: t('settings.sidebar.exportData', 'Export Data'),
            icon: Download,
            keywords: ['gdpr', 'download', 'backup'],
          },
          {
            id: 'delete-account',
            label: t('settings.sidebar.deleteAccount', 'Delete Account'),
            icon: Trash2,
            keywords: ['close', 'remove', 'deactivate'],
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
          {
            id: 'shortcuts',
            label: t('settings.sidebar.shortcuts', 'Keyboard Shortcuts'),
            icon: Keyboard,
            keywords: ['hotkeys', 'keys'],
          },
        ],
      },
      {
        id: 'advanced',
        label: t('settings.sidebar.groups.advanced', 'ADVANCED'),
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
    ],
    [t]
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

  // Auto-expand group containing active section
  useEffect(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => item.id === activeSection)
    );
    if (activeGroup && !expandedGroups.has(activeGroup.id)) {
      setExpandedGroups((prev) => new Set([...prev, activeGroup.id]));
    }
  }, [activeSection, navGroups, expandedGroups]);

  // Render badge
  const renderBadge = (item: NavItem) => {
    if (!item.badge) return null;

    const badgeStyles = {
      count: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      beta: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      warning: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
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
      className={cn(
        'flex flex-col h-full w-[280px] bg-white dark:bg-navy-950 border-r border-slate-200 dark:border-navy-800',
        className
      )}
    >
      {/* Header - Admin style (no icon, bold title) */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-lg font-bold text-navy-900 dark:text-white tracking-wide">
          {t('settings.sidebar.title', 'SETTINGS')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">
          {t('settings.sidebar.subtitle', 'Personal preferences')}
        </p>
      </div>

      {/* Navigation - Collapsible Groups (Admin style - no icons on group headers) */}
      <div className="flex-1 overflow-y-auto px-3">
        <nav className="space-y-1">
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id}>
                {/* Group Header - Clickable, no icon (Admin style) */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-2.5 text-[11px] font-semibold tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      !isExpanded && '-rotate-90'
                    )}
                  />
                </button>

                {/* Group Items - Animated collapse */}
                <div
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
                          key={item.id}
                          onClick={() => onSectionChange(item.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                            isActive
                              ? 'bg-violet-50 text-violet-700 font-medium dark:bg-violet-600/20 dark:text-violet-300'
                              : 'text-slate-600 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800/20 hover:text-navy-900 dark:hover:text-white'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4 flex-shrink-0',
                              isActive
                                ? 'text-violet-600 dark:text-violet-400'
                                : 'text-slate-400 dark:text-slate-400'
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
      <div className="p-3 border-t border-slate-200 dark:border-white/5">
        <button
          onClick={onBack || (() => window.history.back())}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          {t('settings.sidebar.backToDashboard', 'Back to Dashboard')}
        </button>
      </div>
    </div>
  );
};

export default SettingsSidebar;
