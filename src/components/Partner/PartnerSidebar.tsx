/**
 * PartnerSidebar - Grouped navigation sidebar for Partner Portal
 *
 * Features:
 * - Collapsible groups (matching Admin/Settings pattern)
 * - Clean header without icon (consistent style)
 * - Active state indicators with Harvard Crimson accent + left stripe
 * - Badge support for counts (pending certs, active clients, etc.)
 * - Auto-expand group containing active section
 *
 * Design: Dark sidebar (navy-950) matching Admin and Settings
 */

import {
  Award,
  Banknote,
  Building2,
  ChevronDown,
  DollarSign,
  ExternalLink,
  FileText,
  FolderKanban,
  FolderOpen,
  GraduationCap,
  Home,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  MousePointerClick,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';

// Partner section identifier
export type PartnerSection =
  // Home
  | 'partner-home'
  // Overview
  | 'dashboard'
  | 'metrics'
  // Referrals
  | 'referral-tools'
  | 'referral-analytics'
  | 'referred-organizations'
  // Earnings
  | 'earnings'
  | 'statements'
  | 'payouts'
  | 'payout-settings'
  // Clients
  | 'client-access'
  | 'organizations'
  | 'projects'
  | 'users'
  // Academy (Certification)
  | 'learning-path'
  | 'exams'
  | 'certificates'
  // Resources
  | 'documentation'
  | 'marketing'
  | 'case-studies'
  | 'templates'
  // Profile
  | 'company-info'
  | 'specializations'
  | 'regions'
  | 'public-listing';

interface NavItem {
  id: PartnerSection;
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

interface PartnerSidebarProps {
  activeSection: PartnerSection;
  onSectionChange: (section: PartnerSection) => void;
  className?: string;
  pendingCertifications?: number;
  activeClients?: number;
  onBack?: () => void;
  programMode?: boolean;
}

export const PartnerSidebar: React.FC<PartnerSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  pendingCertifications = 0,
  activeClients = 0,
  onBack,
  programMode = false,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['home']));

  // Navigation groups configuration
  const navGroups: NavGroup[] = useMemo(() => {
    if (programMode) {
      return [
        {
          id: 'program',
          label: t('partner.sidebar.groups.program', 'Partner program'),
          defaultOpen: true,
          items: [
            {
              id: 'partner-home',
              label: t('partner.program.overview', 'Program overview'),
              icon: Home,
            },
            {
              id: 'dashboard',
              label: t('partner.program.benefits', 'Why become a partner'),
              icon: Sparkles,
            },
            {
              id: 'metrics',
              label: t('partner.program.stories', 'Partner success stories'),
              icon: TrendingUp,
            },
            {
              id: 'earnings',
              label: t('partner.program.earnings', 'Earnings and tiers'),
              icon: DollarSign,
            },
            {
              id: 'company-info',
              label: t('partner.program.join', 'How to join'),
              icon: UserCheck,
            },
            {
              id: 'learning-path',
              label: t('partner.program.academy', 'Partner Academy'),
              icon: GraduationCap,
            },
            {
              id: 'documentation',
              label: t('partner.program.resources', 'Program resources'),
              icon: FileText,
            },
            {
              id: 'templates',
              label: t('partner.program.faq', 'FAQ and support'),
              icon: FolderOpen,
            },
          ],
        },
      ];
    }

    return [
      {
        id: 'home',
        label: t('partner.sidebar.groups.home', 'HOME'),
        defaultOpen: true,
        items: [
          {
            id: 'partner-home',
            label: t('partner.sidebar.partnerHome', 'Home'),
            icon: Home,
            keywords: ['home', 'welcome', 'start'],
          },
          {
            id: 'dashboard',
            label: t('partner.sidebar.dashboard', 'Dashboard'),
            icon: LayoutDashboard,
            keywords: ['dashboard', 'summary', 'overview'],
          },
          {
            id: 'metrics',
            label: t('partner.sidebar.metrics', 'Metrics'),
            icon: TrendingUp,
            keywords: ['kpi', 'performance', 'stats', 'metrics'],
          },
        ],
      },
      {
        id: 'referrals',
        label: t('partner.sidebar.groups.referrals', 'REFERRALS'),
        defaultOpen: true,
        items: [
          {
            id: 'referral-tools',
            label: t('partner.sidebar.referralTools', 'My Links & Codes'),
            icon: Link2,
            badge: 'New',
            badgeType: 'new',
            keywords: ['referral', 'links', 'codes', 'share'],
          },
          {
            id: 'referral-analytics',
            label: t('partner.sidebar.referralAnalytics', 'Click Analytics'),
            icon: MousePointerClick,
            keywords: ['clicks', 'analytics', 'tracking'],
          },
          {
            id: 'referred-organizations',
            label: t('partner.sidebar.referredOrganizations', 'Referred Customers'),
            icon: Share2,
            keywords: ['referred', 'customers', 'attributions'],
          },
        ],
      },
      {
        id: 'earnings',
        label: t('partner.sidebar.groups.earnings', 'EARNINGS'),
        items: [
          {
            id: 'earnings',
            label: t('partner.sidebar.earnings', 'Commission Earnings'),
            icon: DollarSign,
            keywords: ['earnings', 'commissions', 'revenue'],
          },
          {
            id: 'statements',
            label: t('partner.sidebar.statements', 'Statements'),
            icon: FileText,
            keywords: ['statements', 'reports', 'monthly'],
          },
          {
            id: 'payouts',
            label: t('partner.sidebar.payouts', 'Payout History'),
            icon: Banknote,
            keywords: ['payouts', 'history', 'payments'],
          },
          {
            id: 'payout-settings',
            label: t('partner.sidebar.payoutSettings', 'Payout Settings'),
            icon: Wallet,
            keywords: ['payout', 'settings', 'bank', 'account'],
          },
        ],
      },
      {
        id: 'clients',
        label: t('partner.sidebar.groups.clients', 'CLIENT MANAGEMENT'),
        items: [
          {
            id: 'client-access',
            label: t('partner.sidebar.clientAccess', 'Client Access Manager'),
            icon: UserCheck,
            keywords: ['access', 'clients', 'employees'],
          },
          {
            id: 'organizations',
            label: t('partner.sidebar.organizations', 'Organizations'),
            icon: Building2,
            badge: activeClients > 0 ? activeClients : undefined,
            badgeType: 'count',
            keywords: ['organizations', 'companies', 'clients'],
          },
          {
            id: 'projects',
            label: t('partner.sidebar.projects', 'Active Projects'),
            icon: FolderKanban,
            keywords: ['projects', 'transformation', 'active'],
          },
          {
            id: 'users',
            label: t('partner.sidebar.users', 'Team Members'),
            icon: UserPlus,
            keywords: ['users', 'team', 'members'],
          },
        ],
      },
      {
        id: 'academy',
        label: t('partner.sidebar.groups.academy', 'ACADEMY'),
        items: [
          {
            id: 'learning-path',
            label: t('partner.sidebar.learningPath', 'Learning Path'),
            icon: Target,
            badge: pendingCertifications > 0 ? pendingCertifications : undefined,
            badgeType: 'count',
            keywords: ['learning', 'path', 'courses', 'training'],
          },
          {
            id: 'exams',
            label: t('partner.sidebar.exams', 'Exams'),
            icon: FileText,
            keywords: ['exams', 'tests', 'assessment'],
          },
          {
            id: 'certificates',
            label: t('partner.sidebar.certificates', 'Certificates'),
            icon: Award,
            keywords: ['certificates', 'badges', 'credentials'],
          },
        ],
      },
      {
        id: 'profile',
        label: t('partner.sidebar.groups.profile', 'DIRECTORY PROFILE'),
        items: [
          {
            id: 'company-info',
            label: t('partner.sidebar.companyInfo', 'Company Info'),
            icon: Building2,
            keywords: ['company', 'info', 'details'],
          },
          {
            id: 'specializations',
            label: t('partner.sidebar.specializations', 'Specializations'),
            icon: Award,
            keywords: ['specializations', 'frameworks', 'expertise'],
          },
          {
            id: 'regions',
            label: t('partner.sidebar.regions', 'Regions'),
            icon: MapPin,
            keywords: ['regions', 'locations', 'markets'],
          },
          {
            id: 'public-listing',
            label: t('partner.sidebar.publicListing', 'Public Listing'),
            icon: Users,
            keywords: ['public', 'listing', 'directory', 'catalog'],
          },
        ],
      },
      {
        id: 'resources',
        label: t('partner.sidebar.groups.resources', 'RESOURCES'),
        items: [
          {
            id: 'documentation',
            label: t('partner.sidebar.documentation', 'Documentation'),
            icon: FileText,
            keywords: ['docs', 'documentation', 'guides'],
          },
          {
            id: 'marketing',
            label: t('partner.sidebar.marketing', 'Marketing Materials'),
            icon: Sparkles,
            keywords: ['marketing', 'materials', 'presentations'],
          },
          {
            id: 'case-studies',
            label: t('partner.sidebar.caseStudies', 'Case Studies'),
            icon: TrendingUp,
            keywords: ['case', 'studies', 'success', 'stories'],
          },
          {
            id: 'templates',
            label: t('partner.sidebar.templates', 'PMO Templates'),
            icon: FolderOpen,
            badge: 'New',
            badgeType: 'new',
            keywords: ['templates', 'pmo', 'frameworks'],
          },
        ],
      },
    ];
  }, [t, activeClients, pendingCertifications, programMode]);

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
      warning: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
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
    <div className={cn('flex flex-col h-full w-[280px] bg-slate-50 dark:bg-navy-950', className)}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">
          {programMode
            ? t('partner.program.title', 'Consultify Partner Program')
            : t('partner.sidebar.title', 'Partner')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {programMode
            ? t('partner.program.subtitle', 'Grow your business with Consultify')
            : t('partner.sidebar.subtitle', 'Grow with Consultify')}
        </p>
      </div>

      {/* Navigation - Collapsible Groups */}
      <div className="flex-1 overflow-y-auto px-3">
        <nav className="space-y-1">
          {navGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id}>
                {/* Group Header - Clickable */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-2.5 text-[11px] font-semibold tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
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
                            'relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                            isActive
                              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--c-info)]'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/20 hover:text-slate-900 dark:hover:text-white'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4 flex-shrink-0',
                              isActive
                                ? 'text-[var(--c-info)]'
                                : 'text-slate-500 dark:text-slate-400'
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
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/20 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          {t('partner.sidebar.backToApp', 'Back to App')}
        </button>
      </div>
    </div>
  );
};

export default PartnerSidebar;
