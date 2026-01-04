/**
 * SettingsSidebar - Grouped navigation sidebar for Settings
 *
 * Features:
 * - Collapsible groups (HubSpot-style)
 * - Search with Cmd+K shortcut
 * - Active state indicators
 * - External link indicators
 * - Scroll-to-section behavior
 */

import {
    Accessibility,
    Bell,
    BookOpen,
    Brain,
    Calendar,
    ChevronDown,
    ChevronRight,
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
    Search,
    Settings,
    Shield,
    Sliders,
    Smartphone,
    Sparkles,
    Sun,
    Trash2,
    User,
    Users,
    Volume2,
    Webhook,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

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
    | 'ai-instructions'
    | 'ai-model'
    | 'ai-parameters'
    | 'ai-usage'
    | 'ai-voice'
    | 'ai-memory'
    | 'ai-personality'
    | 'ai-autocomplete'
    // Notifications
    | 'notifications-overview'
    | 'notifications-email'
    | 'notifications-push'
    | 'notifications-sounds'
    | 'notifications-quiet-hours'
    | 'notifications-digest'
    | 'notifications-dnd'
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
    | 'settings-history';

interface NavItem {
    id: SettingsSection;
    label: string;
    icon: React.ElementType;
    external?: boolean;
    badge?: string;
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
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeSection, onSectionChange, className }) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(['my-settings', 'work-preferences', 'ai-automation', 'notifications']),
    );

    // Navigation groups configuration
    const navGroups: NavGroup[] = useMemo(
        () => [
            {
                id: 'my-settings',
                label: t('settings.sidebar.groups.mySettings', 'My Settings'),
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
                label: t('settings.sidebar.groups.workPreferences', 'Work Preferences'),
                defaultOpen: true,
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
                id: 'ai-automation',
                label: t('settings.sidebar.groups.aiAutomation', 'AI & Automation'),
                defaultOpen: true,
                items: [
                    {
                        id: 'ai-instructions',
                        label: t('settings.sidebar.aiInstructions', 'AI Instructions'),
                        icon: Brain,
                        keywords: ['prompt', 'system', 'behavior'],
                    },
                    {
                        id: 'ai-model',
                        label: t('settings.sidebar.aiModel', 'Model Selection'),
                        icon: Sparkles,
                        keywords: ['gpt', 'claude', 'gemini', 'llm'],
                    },
                    {
                        id: 'ai-parameters',
                        label: t('settings.sidebar.aiParameters', 'Parameters'),
                        icon: Sliders,
                        keywords: ['temperature', 'tokens', 'context'],
                    },
                    {
                        id: 'ai-usage',
                        label: t('settings.sidebar.aiUsage', 'AI Usage Dashboard'),
                        icon: Zap,
                        badge: 'New',
                        keywords: ['tokens', 'cost', 'usage', 'stats'],
                    },
                    {
                        id: 'ai-personality',
                        label: t('settings.sidebar.aiPersonality', 'Personality'),
                        icon: User,
                        keywords: ['tone', 'style', 'voice'],
                    },
                    {
                        id: 'ai-autocomplete',
                        label: t('settings.sidebar.aiAutocomplete', 'Auto-Complete'),
                        icon: Zap,
                        keywords: ['suggestions', 'completion'],
                    },
                    {
                        id: 'ai-memory',
                        label: t('settings.sidebar.aiMemory', 'Memory'),
                        icon: Database,
                        keywords: ['context', 'history', 'remember'],
                    },
                    {
                        id: 'ai-voice',
                        label: t('settings.sidebar.aiVoice', 'Voice & TTS'),
                        icon: Mic,
                        keywords: ['speech', 'text to speech', 'audio'],
                    },
                ],
            },
            {
                id: 'notifications',
                label: t('settings.sidebar.groups.notifications', 'Notifications'),
                defaultOpen: true,
                items: [
                    {
                        id: 'notifications-overview',
                        label: t('settings.sidebar.notificationsOverview', 'Overview'),
                        icon: Bell,
                        keywords: ['alerts', 'notifications'],
                    },
                    {
                        id: 'notifications-email',
                        label: t('settings.sidebar.notificationsEmail', 'Email'),
                        icon: Mail,
                        keywords: ['email', 'digest'],
                    },
                    {
                        id: 'notifications-push',
                        label: t('settings.sidebar.notificationsPush', 'Push'),
                        icon: Smartphone,
                        keywords: ['mobile', 'desktop', 'browser'],
                    },
                    {
                        id: 'notifications-sounds',
                        label: t('settings.sidebar.notificationsSounds', 'Sounds'),
                        icon: Volume2,
                        keywords: ['audio', 'alert', 'tone'],
                    },
                    {
                        id: 'notifications-quiet-hours',
                        label: t('settings.sidebar.quietHours', 'Quiet Hours'),
                        icon: Moon,
                        keywords: ['schedule', 'silent', 'pause'],
                    },
                    {
                        id: 'notifications-digest',
                        label: t('settings.sidebar.digest', 'Digest'),
                        icon: Mail,
                        keywords: ['summary', 'daily', 'weekly'],
                    },
                    {
                        id: 'notifications-dnd',
                        label: t('settings.sidebar.dnd', 'Do Not Disturb'),
                        icon: Moon,
                        keywords: ['focus', 'block', 'silent'],
                    },
                ],
            },
            {
                id: 'security',
                label: t('settings.sidebar.groups.security', 'Security'),
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
                label: t('settings.sidebar.groups.integrations', 'Integrations'),
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
                label: t('settings.sidebar.groups.dataPrivacy', 'Data & Privacy'),
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
                label: t('settings.sidebar.groups.appearance', 'Appearance'),
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
                label: t('settings.sidebar.groups.advanced', 'Advanced'),
                items: [
                    {
                        id: 'import-export',
                        label: t('settings.sidebar.importExport', 'Import/Export Settings'),
                        icon: Download,
                        keywords: ['backup', 'restore'],
                    },
                    {
                        id: 'templates',
                        label: t('settings.sidebar.templates', 'Settings Templates'),
                        icon: BookOpen,
                        keywords: ['preset', 'save', 'load'],
                    },
                    {
                        id: 'developer',
                        label: t('settings.sidebar.developer', 'Developer Mode'),
                        icon: Code2,
                        keywords: ['debug', 'api', 'logs'],
                    },
                    {
                        id: 'beta-features',
                        label: t('settings.sidebar.betaFeatures', 'Beta Features'),
                        icon: Sparkles,
                        badge: 'Beta',
                        keywords: ['experimental', 'preview'],
                    },
                    {
                        id: 'settings-history',
                        label: t('settings.sidebar.settingsHistory', 'Settings History'),
                        icon: History,
                        keywords: ['changes', 'rollback', 'audit'],
                    },
                ],
            },
        ],
        [t],
    );

    // Filter items based on search
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return navGroups;

        const query = searchQuery.toLowerCase();
        return navGroups
            .map((group) => ({
                ...group,
                items: group.items.filter(
                    (item) =>
                        item.label.toLowerCase().includes(query) ||
                        item.keywords?.some((keyword) => keyword.toLowerCase().includes(query)),
                ),
            }))
            .filter((group) => group.items.length > 0);
    }, [navGroups, searchQuery]);

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

    // Keyboard shortcut for search (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('settings-search')?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Auto-expand group containing active section
    useEffect(() => {
        const activeGroup = navGroups.find((group) => group.items.some((item) => item.id === activeSection));
        if (activeGroup && !expandedGroups.has(activeGroup.id)) {
            setExpandedGroups((prev) => new Set([...prev, activeGroup.id]));
        }
    }, [activeSection, navGroups, expandedGroups]);

    return (
        <div
            className={cn(
                'flex flex-col h-full bg-slate-50 dark:bg-navy-900/50 border-r border-slate-200 dark:border-navy-700',
                className,
            )}
        >
            {/* Search */}
            <div className="p-4 border-b border-slate-200 dark:border-navy-700">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        id="settings-search"
                        type="text"
                        placeholder={t('settings.sidebar.searchPlaceholder', 'Search settings...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-12 bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-navy-700 rounded">
                        ⌘K
                    </kbd>
                </div>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1">
                <nav className="p-2">
                    {filteredGroups.map((group) => (
                        <div key={group.id} className="mb-1">
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                            >
                                <span>{group.label}</span>
                                {expandedGroups.has(group.id) ? (
                                    <ChevronDown className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </button>

                            {/* Group Items */}
                            {expandedGroups.has(group.id) && (
                                <div className="space-y-0.5 mt-1">
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
                                                        ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium'
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-slate-900 dark:hover:text-white',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'w-4 h-4 flex-shrink-0',
                                                        isActive ? 'text-violet-600 dark:text-violet-400' : '',
                                                    )}
                                                />
                                                <span className="flex-1 text-left truncate">{item.label}</span>
                                                {item.badge && (
                                                    <span
                                                        className={cn(
                                                            'px-1.5 py-0.5 text-[10px] font-medium rounded-full',
                                                            item.badge === 'New'
                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                                        )}
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                                {item.external && <ExternalLink className="w-3 h-3 text-slate-400" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-navy-700">
                <button
                    onClick={() => window.history.back()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4 rotate-180" />
                    {t('settings.sidebar.backToDashboard', 'Back to Dashboard')}
                </button>
            </div>
        </div>
    );
};

export default SettingsSidebar;
