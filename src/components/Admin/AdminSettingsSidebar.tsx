/**
 * AdminSettingsSidebar - Grouped navigation sidebar for Admin Settings module
 *
 * Features:
 * - Collapsible groups (matching Settings pattern exactly)
 * - Clean header without icon (Admin-style)
 * - Active state indicators with violet accent
 * - Badge support for counts
 * - Auto-expand group containing active section
 *
 * Design: Matches Settings Sidebar pattern exactly
 */

import {
  ArrowLeft,
  Bell,
  Blocks,
  Building2,
  ChevronDown,
  CreditCard,
  Database,
  FileText,
  Key,
  LayoutGrid,
  MessageSquare,
  Palette,
  Receipt,
  Shield,
  Sparkles,
  Wallet,
  Webhook,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';

// Admin Settings section identifier
export type AdminSettingsSection =
  | 'organization'
  | 'branding'
  | 'billing'
  | 'payment'
  | 'tax'
  | 'alerts'
  | 'security'
  | 'governance'
  | 'audit'
  | 'report-creator'
  | 'block-library'
  | 'initiative-templates'
  | 'initiative-sections'
  | 'integrations'
  | 'api'
  | 'feedback';

interface NavItem {
  id: AdminSettingsSection;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeType?: 'count' | 'new' | 'beta' | 'warning';
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface AdminSettingsSidebarProps {
  activeSection: AdminSettingsSection;
  onSectionChange: (section: AdminSettingsSection) => void;
  className?: string;
  pendingFeedbackCount?: number;
  onBack?: () => void;
}

export const AdminSettingsSidebar: React.FC<AdminSettingsSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  pendingFeedbackCount = 0,
  onBack,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['organization-settings'])
  );

  // Navigation groups configuration - matching Settings structure
  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'organization-settings',
        label: t('admin.sidebar.groups.organization', 'ORGANIZATION'),
        defaultOpen: true,
        items: [
          {
            id: 'organization',
            label: t('admin.tabs.organization', 'Strategic Profile'),
            icon: Building2,
          },
          {
            id: 'branding',
            label: t('admin.tabs.branding', 'Branding'),
            icon: Palette,
          },
        ],
      },
      {
        id: 'billing-settings',
        label: t('admin.sidebar.groups.billing', 'BILLING'),
        items: [
          {
            id: 'billing',
            label: t('admin.tabs.billing', 'Plans'),
            icon: CreditCard,
          },
          {
            id: 'payment',
            label: t('admin.tabs.payment', 'Payment'),
            icon: Wallet,
          },
          {
            id: 'tax',
            label: t('admin.tabs.tax', 'Tax'),
            icon: Receipt,
          },
          {
            id: 'alerts',
            label: t('admin.tabs.alerts', 'Alerts'),
            icon: Bell,
          },
        ],
      },
      {
        id: 'security-settings',
        label: t('admin.sidebar.groups.security', 'SECURITY'),
        items: [
          {
            id: 'security',
            label: t('admin.tabs.security', 'Security'),
            icon: Shield,
          },
          {
            id: 'governance',
            label: t('admin.tabs.governance', 'Governance'),
            icon: Database,
          },
          {
            id: 'audit',
            label: t('admin.tabs.audit', 'Audit'),
            icon: FileText,
          },
        ],
      },
      {
        id: 'tools-settings',
        label: t('admin.sidebar.groups.tools', 'TOOLS'),
        items: [
          {
            id: 'report-creator',
            label: t('admin.tabs.reportTemplates', 'Report Templates'),
            icon: FileText,
          },
          {
            id: 'block-library',
            label: t('admin.tabs.blockLibrary', 'Block Library'),
            icon: Blocks,
          },
          {
            id: 'initiative-templates',
            label: t('admin.tabs.initiativeTemplates', 'Initiative Templates'),
            icon: Sparkles,
          },
          {
            id: 'initiative-sections',
            label: t('admin.tabs.initiativeSections', 'Section Library'),
            icon: LayoutGrid,
            badge: 'new',
            badgeType: 'new' as const,
          },
        ],
      },
      {
        id: 'integrations-settings',
        label: t('admin.sidebar.groups.integrations', 'INTEGRATIONS'),
        items: [
          {
            id: 'integrations',
            label: t('admin.tabs.integrations', 'Integrations'),
            icon: Webhook,
          },
          {
            id: 'api',
            label: t('admin.tabs.api', 'API'),
            icon: Key,
          },
        ],
      },
      {
        id: 'feedback-settings',
        label: t('admin.sidebar.groups.feedback', 'FEEDBACK'),
        items: [
          {
            id: 'feedback',
            label: t('admin.tabs.feedback', 'Feedback'),
            icon: MessageSquare,
            badge: pendingFeedbackCount > 0 ? pendingFeedbackCount : undefined,
            badgeType: 'count',
          },
        ],
      },
    ],
    [t, pendingFeedbackCount]
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
          {t('admin.settings.title', 'ADMIN')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-500 mt-0.5">
          {t('admin.settings.subtitle', 'Organization settings, tools, and management')}
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
          <ArrowLeft className="w-4 h-4" />
          {t('admin.settings.backToDashboard', 'Back to Dashboard')}
        </button>
      </div>
    </div>
  );
};

export default AdminSettingsSidebar;
