/**
 * AdminSidebar - Grouped navigation sidebar for Admin module
 *
 * Features:
 * - Collapsible groups (HubSpot-style)
 * - Search with Cmd+K shortcut
 * - Active state indicators with violet accent
 * - Badge support for counts (pending invites, etc.)
 * - External link indicators
 * - Quick actions in sidebar
 * - Auto-expand group containing active section
 *
 * Design: Dark sidebar (navy-900) with violet accents
 */

import {
    Activity,
    BarChart3,
    Bell,
    BookOpen,
    Brain,
    Briefcase,
    Building2,
    ChevronDown,
    ChevronRight,
    Cookie,
    CreditCard,
    Crown,
    Database,
    Download,
    ExternalLink,
    FileText,
    Globe,
    History,
    Key,
    Layers,
    LayoutDashboard,
    Lock,
    LogOut,
    Mail,
    MessageSquare,
    Palette,
    PlayCircle,
    Plus,
    Search,
    Settings,
    Shield,
    TrendingUp,
    Upload,
    UserPlus,
    Users,
    UsersRound,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';
import { Input } from '../ui/primitives/Input';

// Admin section identifier
export type AdminSection =
    // Overview
    | 'dashboard'
    | 'metrics'
    | 'analytics'
    // Organization
    | 'profile'
    | 'branding'
    | 'ownership'
    | 'regional'
    | 'fiscal-year'
    | 'data-hosting'
    | 'approved-domains'
    // Team
    | 'users'
    | 'groups'
    | 'invitations'
    | 'roles'
    | 'consultants'
    | 'org-chart'
    // Workspace
    | 'projects'
    | 'knowledge'
    | 'playbooks'
    | 'bulk-ops'
    | 'custom-statuses'
    // AI
    | 'ai-models'
    | 'ai-health'
    | 'ai-policy'
    | 'ai-access'
    | 'ai-features'
    | 'ai-audit'
    // Billing
    | 'usage'
    | 'plan'
    | 'payment'
    | 'invoices'
    | 'alerts'
    | 'billing-settings'
    | 'cost-allocation'
    | 'seats'
    // Security
    | 'security-settings'
    | 'authentication'
    | 'api-keys'
    | 'audit-log'
    | 'data-management'
    // Compliance
    | 'gdpr'
    | 'cookie-settings'
    | 'data-requests'
    // Feedback
    | 'feedback';

interface NavItem {
    id: AdminSection;
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
    icon: React.ElementType;
    items: NavItem[];
    defaultOpen?: boolean;
}

interface QuickAction {
    id: string;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
}

interface AdminSidebarProps {
    activeSection: AdminSection;
    onSectionChange: (section: AdminSection) => void;
    className?: string;
    pendingInvites?: number;
    pendingDataRequests?: number;
    quickActions?: QuickAction[];
    onBack?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
    activeSection,
    onSectionChange,
    className,
    pendingInvites = 0,
    pendingDataRequests = 0,
    quickActions,
    onBack,
}) => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['overview', 'organization', 'team']));

    // Navigation groups configuration
    const navGroups: NavGroup[] = useMemo(
        () => [
            {
                id: 'overview',
                label: t('admin.sidebar.groups.overview', 'Overview'),
                icon: LayoutDashboard,
                defaultOpen: true,
                items: [
                    {
                        id: 'dashboard',
                        label: t('admin.sidebar.dashboard', 'Dashboard'),
                        icon: LayoutDashboard,
                        keywords: ['home', 'summary', 'overview'],
                    },
                    {
                        id: 'metrics',
                        label: t('admin.sidebar.metrics', 'Metrics'),
                        icon: TrendingUp,
                        keywords: ['kpi', 'performance', 'stats'],
                    },
                    {
                        id: 'analytics',
                        label: t('admin.sidebar.analytics', 'Analytics'),
                        icon: BarChart3,
                        keywords: ['reports', 'charts', 'data'],
                    },
                ],
            },
            {
                id: 'organization',
                label: t('admin.sidebar.groups.organization', 'Organization'),
                icon: Building2,
                defaultOpen: true,
                items: [
                    {
                        id: 'profile',
                        label: t('admin.sidebar.profile', 'Profile & Branding'),
                        icon: Building2,
                        keywords: ['company', 'logo', 'name'],
                    },
                    {
                        id: 'ownership',
                        label: t('admin.sidebar.ownership', 'Ownership'),
                        icon: Crown,
                        keywords: ['owner', 'transfer', 'billing admin'],
                    },
                    {
                        id: 'regional',
                        label: t('admin.sidebar.regional', 'Regional Settings'),
                        icon: Globe,
                        keywords: ['timezone', 'date format', 'currency'],
                    },
                    {
                        id: 'fiscal-year',
                        label: t('admin.sidebar.fiscalYear', 'Fiscal Year'),
                        icon: BarChart3,
                        keywords: ['financial', 'quarters', 'accounting'],
                    },
                    {
                        id: 'data-hosting',
                        label: t('admin.sidebar.dataHosting', 'Data Hosting'),
                        icon: Database,
                        keywords: ['region', 'gdpr', 'compliance', 'storage'],
                    },
                    {
                        id: 'approved-domains',
                        label: t('admin.sidebar.approvedDomains', 'Approved Domains'),
                        icon: Mail,
                        keywords: ['email', 'auto-join', 'domain'],
                    },
                ],
            },
            {
                id: 'team',
                label: t('admin.sidebar.groups.team', 'Team'),
                icon: Users,
                defaultOpen: true,
                items: [
                    {
                        id: 'users',
                        label: t('admin.sidebar.users', 'Users'),
                        icon: Users,
                        keywords: ['members', 'people', 'employees'],
                    },
                    {
                        id: 'groups',
                        label: t('admin.sidebar.groups', 'Teams & Groups'),
                        icon: UsersRound,
                        keywords: ['team', 'department', 'group'],
                    },
                    {
                        id: 'invitations',
                        label: t('admin.sidebar.invitations', 'Invitations'),
                        icon: UserPlus,
                        badge: pendingInvites > 0 ? pendingInvites : undefined,
                        badgeType: 'count',
                        keywords: ['invite', 'pending', 'new user'],
                    },
                    {
                        id: 'roles',
                        label: t('admin.sidebar.roles', 'Roles & Permissions'),
                        icon: Key,
                        keywords: ['permission', 'access', 'role'],
                    },
                    {
                        id: 'consultants',
                        label: t('admin.sidebar.consultants', 'Consultants'),
                        icon: Briefcase,
                        keywords: ['external', 'contractor', 'consultant'],
                    },
                    {
                        id: 'org-chart',
                        label: t('admin.sidebar.orgChart', 'Organization Chart'),
                        icon: Layers,
                        badge: 'New',
                        badgeType: 'new',
                        keywords: ['hierarchy', 'structure', 'reporting'],
                    },
                ],
            },
            {
                id: 'workspace',
                label: t('admin.sidebar.groups.workspace', 'Workspace'),
                icon: Briefcase,
                items: [
                    {
                        id: 'projects',
                        label: t('admin.sidebar.projects', 'Projects'),
                        icon: Briefcase,
                        keywords: ['project', 'initiative'],
                    },
                    {
                        id: 'knowledge',
                        label: t('admin.sidebar.knowledge', 'Knowledge Base'),
                        icon: BookOpen,
                        keywords: ['docs', 'documentation', 'wiki'],
                    },
                    {
                        id: 'playbooks',
                        label: t('admin.sidebar.playbooks', 'Playbooks'),
                        icon: PlayCircle,
                        keywords: ['automation', 'workflow', 'template'],
                    },
                    {
                        id: 'bulk-ops',
                        label: t('admin.sidebar.bulkOps', 'Bulk Operations'),
                        icon: Layers,
                        keywords: ['batch', 'mass', 'import'],
                    },
                    {
                        id: 'custom-statuses',
                        label: t('admin.sidebar.customStatuses', 'Custom Statuses'),
                        icon: Settings,
                        keywords: ['status', 'workflow', 'task'],
                    },
                ],
            },
            {
                id: 'ai',
                label: t('admin.sidebar.groups.ai', 'AI & Intelligence'),
                icon: Brain,
                items: [
                    {
                        id: 'ai-models',
                        label: t('admin.sidebar.aiModels', 'Models & Providers'),
                        icon: Brain,
                        keywords: ['llm', 'gpt', 'claude', 'model'],
                    },
                    {
                        id: 'ai-health',
                        label: t('admin.sidebar.aiHealth', 'Health & Monitoring'),
                        icon: Activity,
                        keywords: ['status', 'uptime', 'performance'],
                    },
                    {
                        id: 'ai-policy',
                        label: t('admin.sidebar.aiPolicy', 'Policy & Governance'),
                        icon: Shield,
                        keywords: ['rules', 'restrictions', 'guidelines'],
                    },
                    {
                        id: 'ai-access',
                        label: t('admin.sidebar.aiAccess', 'Access & Limits'),
                        icon: Users,
                        keywords: ['quota', 'token', 'limit'],
                    },
                    {
                        id: 'ai-features',
                        label: t('admin.sidebar.aiFeatures', 'Features & Privacy'),
                        icon: Settings,
                        keywords: ['feature', 'toggle', 'privacy'],
                    },
                    {
                        id: 'ai-audit',
                        label: t('admin.sidebar.aiAudit', 'Audit & Compliance'),
                        icon: History,
                        keywords: ['log', 'history', 'audit'],
                    },
                ],
            },
            {
                id: 'billing',
                label: t('admin.sidebar.groups.billing', 'Billing'),
                icon: CreditCard,
                items: [
                    {
                        id: 'usage',
                        label: t('admin.sidebar.usage', 'Usage Dashboard'),
                        icon: Activity,
                        keywords: ['consumption', 'usage', 'stats'],
                    },
                    {
                        id: 'plan',
                        label: t('admin.sidebar.plan', 'Plan & Subscription'),
                        icon: CreditCard,
                        keywords: ['plan', 'tier', 'upgrade'],
                    },
                    {
                        id: 'seats',
                        label: t('admin.sidebar.seats', 'Seats & Licenses'),
                        icon: Users,
                        badge: 'New',
                        badgeType: 'new',
                        keywords: ['license', 'seat', 'allocation'],
                    },
                    {
                        id: 'payment',
                        label: t('admin.sidebar.payment', 'Payment Methods'),
                        icon: CreditCard,
                        keywords: ['card', 'payment', 'bank'],
                    },
                    {
                        id: 'invoices',
                        label: t('admin.sidebar.invoices', 'Invoices'),
                        icon: FileText,
                        keywords: ['invoice', 'receipt', 'history'],
                    },
                    {
                        id: 'alerts',
                        label: t('admin.sidebar.alerts', 'Spending Alerts'),
                        icon: Bell,
                        keywords: ['alert', 'notification', 'budget'],
                    },
                    {
                        id: 'cost-allocation',
                        label: t('admin.sidebar.costAllocation', 'Cost Allocation'),
                        icon: Building2,
                        keywords: ['department', 'allocation', 'chargeback'],
                    },
                ],
            },
            {
                id: 'security',
                label: t('admin.sidebar.groups.security', 'Security'),
                icon: Shield,
                items: [
                    {
                        id: 'security-settings',
                        label: t('admin.sidebar.securitySettings', 'Security Settings'),
                        icon: Shield,
                        keywords: ['password', 'policy', 'requirements'],
                    },
                    {
                        id: 'authentication',
                        label: t('admin.sidebar.authentication', 'SSO & Auth'),
                        icon: Lock,
                        keywords: ['sso', 'saml', 'oauth', 'login'],
                    },
                    {
                        id: 'api-keys',
                        label: t('admin.sidebar.apiKeys', 'API Keys'),
                        icon: Key,
                        keywords: ['api', 'token', 'developer'],
                    },
                    {
                        id: 'audit-log',
                        label: t('admin.sidebar.auditLog', 'Audit Log'),
                        icon: History,
                        keywords: ['log', 'activity', 'history'],
                    },
                    {
                        id: 'data-management',
                        label: t('admin.sidebar.dataManagement', 'Data Management'),
                        icon: Download,
                        keywords: ['export', 'backup', 'retention'],
                    },
                ],
            },
            {
                id: 'compliance',
                label: t('admin.sidebar.groups.compliance', 'Compliance'),
                icon: Shield,
                items: [
                    {
                        id: 'gdpr',
                        label: t('admin.sidebar.gdpr', 'GDPR Compliance'),
                        icon: Shield,
                        keywords: ['gdpr', 'privacy', 'eu'],
                    },
                    {
                        id: 'cookie-settings',
                        label: t('admin.sidebar.cookieSettings', 'Cookie Settings'),
                        icon: Cookie,
                        keywords: ['cookie', 'consent', 'banner'],
                    },
                    {
                        id: 'data-requests',
                        label: t('admin.sidebar.dataRequests', 'Data Requests'),
                        icon: FileText,
                        badge: pendingDataRequests > 0 ? pendingDataRequests : undefined,
                        badgeType: pendingDataRequests > 0 ? 'warning' : undefined,
                        keywords: ['request', 'deletion', 'access'],
                    },
                ],
            },
            {
                id: 'feedback',
                label: t('admin.sidebar.groups.feedback', 'Feedback'),
                icon: MessageSquare,
                items: [
                    {
                        id: 'feedback',
                        label: t('admin.sidebar.feedback', 'User Feedback'),
                        icon: MessageSquare,
                        keywords: ['feedback', 'suggestion', 'bug'],
                    },
                ],
            },
        ],
        [t, pendingInvites, pendingDataRequests],
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
                document.getElementById('admin-search')?.focus();
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

    // Default quick actions
    const defaultQuickActions: QuickAction[] = [
        {
            id: 'invite-user',
            label: t('admin.sidebar.quickActions.inviteUser', 'Invite User'),
            icon: UserPlus,
            onClick: () => onSectionChange('invitations'),
            variant: 'primary',
        },
        {
            id: 'bulk-import',
            label: t('admin.sidebar.quickActions.bulkImport', 'Bulk Import'),
            icon: Upload,
            onClick: () => onSectionChange('bulk-ops'),
            variant: 'secondary',
        },
    ];

    const actions = quickActions || defaultQuickActions;

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
                    badgeStyles[item.badgeType || 'count'],
                )}
            >
                {item.badge}
            </span>
        );
    };

    return (
        <div
            className={cn(
                'flex flex-col h-full w-[280px] bg-slate-50 dark:bg-navy-900/50 border-r border-slate-200 dark:border-navy-700',
                className,
            )}
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-navy-700">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                        <Settings className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-navy-900 dark:text-white">
                            {t('admin.sidebar.title', 'Admin Panel')}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('admin.sidebar.subtitle', 'Manage your workspace')}
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        id="admin-search"
                        type="text"
                        placeholder={t('admin.sidebar.searchPlaceholder', 'Search admin...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-12 h-9 text-sm bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-navy-700 rounded">
                        ⌘K
                    </kbd>
                </div>
            </div>

            {/* Quick Actions */}
            {actions.length > 0 && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
                    <div className="flex gap-2">
                        {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <button
                                    key={action.id}
                                    onClick={action.onClick}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150',
                                        action.variant === 'primary'
                                            ? 'bg-violet-600 text-white hover:bg-violet-700'
                                            : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700',
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {action.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto">
                <nav className="p-2">
                    {filteredGroups.map((group) => (
                        <div key={group.id} className="mb-1">
                            {/* Group Header */}
                            <button
                                onClick={() => toggleGroup(group.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <group.icon className="w-3 h-3" />
                                    <span>{group.label}</span>
                                </div>
                                {expandedGroups.has(group.id) ? (
                                    <ChevronDown className="w-3 h-3" />
                                ) : (
                                    <ChevronRight className="w-3 h-3" />
                                )}
                            </button>

                            {/* Group Items */}
                            {expandedGroups.has(group.id) && (
                                <div className="space-y-1 mt-1">
                                    {group.items.map((item) => {
                                        const isActive = activeSection === item.id;
                                        const Icon = item.icon;

                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => onSectionChange(item.id)}
                                                className={cn(
                                                    'w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 active:scale-[0.98]',
                                                    isActive
                                                        ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium border-l-2 border-violet-600 -ml-px'
                                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/40 hover:text-slate-900 dark:hover:text-white',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'w-4 h-4 flex-shrink-0',
                                                        isActive
                                                            ? 'text-violet-600 dark:text-violet-400'
                                                            : 'text-slate-400 dark:text-slate-500',
                                                    )}
                                                />
                                                <span className="flex-1 text-left truncate">{item.label}</span>
                                                {renderBadge(item)}
                                                {item.external && <ExternalLink className="w-3 h-3 opacity-50" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-navy-700">
                <button
                    onClick={onBack || (() => window.history.back())}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4 rotate-180" />
                    {t('admin.sidebar.backToApp', 'Back to App')}
                </button>
            </div>
        </div>
    );
};

export default AdminSidebar;
