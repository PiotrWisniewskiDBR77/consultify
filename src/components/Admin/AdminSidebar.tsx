/**
 * AdminSidebar - Grouped navigation sidebar for Admin module
 *
 * Features:
 * - Collapsible groups (clean style, no icons on headers)
 * - Active state indicators with violet accent
 * - Badge support for counts (pending invites, etc.)
 * - Auto-expand group containing active section
 *
 * Design: Dark sidebar (navy-950) matching Settings
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
  PlayCircle,
  Settings,
  Shield,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';

// Admin section identifier
export type AdminSection =
  // Overview
  | 'overview'
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
  items: NavItem[];
  defaultOpen?: boolean;
}

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  className?: string;
  pendingInvites?: number;
  pendingDataRequests?: number;
  onBack?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  pendingInvites = 0,
  pendingDataRequests = 0,
  onBack,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['overview']));

  // Navigation groups configuration (no icons on group headers)
  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'overview',
        label: t('admin.sidebar.groups.overview', 'OVERVIEW'),
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
        label: t('admin.sidebar.groups.organization', 'ORGANIZATION'),
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
        label: t('admin.sidebar.groups.team', 'TEAM'),
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
        label: t('admin.sidebar.groups.workspace', 'WORKSPACE'),
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
        label: t('admin.sidebar.groups.ai', 'AI & INTELLIGENCE'),
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
        label: t('admin.sidebar.groups.billing', 'BILLING'),
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
        label: t('admin.sidebar.groups.security', 'SECURITY'),
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
        label: t('admin.sidebar.groups.compliance', 'COMPLIANCE'),
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
        label: t('admin.sidebar.groups.feedback', 'FEEDBACK'),
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
    [t, pendingInvites, pendingDataRequests]
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
      count: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
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
    <div className={cn('flex flex-col h-full w-[280px] bg-c-bg dark:bg-navy-950', className)}>
      {/* Header - Clean style (no icon, bold title) */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-lg font-bold text-c-text tracking-wide">
          {t('admin.sidebar.title', 'ADMIN')}
        </h1>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
          {t('admin.sidebar.subtitle', 'Organization settings')}
        </p>
      </div>

      {/* Navigation - Collapsible Groups (no icons on group headers) */}
      <div className="flex-1 overflow-y-auto px-3">
        <nav className="space-y-1">
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id}>
                {/* Group Header - Clickable, no icon */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-2.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-300 transition-colors"
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
                    isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
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
                              ? 'bg-primary-600/20 text-primary-300 font-medium'
                              : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-800/20 hover:text-white'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4 flex-shrink-0',
                              isActive ? 'text-primary-400' : 'text-slate-500 dark:text-slate-400'
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
      <div className="p-3 border-t border-c-border-subtle space-y-1">
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded-lg transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          {t('admin.sidebar.documentation', 'Documentation')}
          <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
        </a>
        <button
          onClick={onBack || (() => window.history.back())}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          {t('admin.sidebar.backToApp', 'Back to App')}
        </button>
      </div>
    </div>
  );
};

export default AdminSidebar;
