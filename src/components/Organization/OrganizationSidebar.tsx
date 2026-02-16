/**
 * OrganizationSidebar - Settings-like internal navigation for Organization module
 *
 * Mirrors the Settings pattern: single Sidebar entry → Organization page → internal left menu.
 */

import { Building2, ChevronDown, Goal, Map, ShieldAlert, Target } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';

export type OrganizationSection = 'profile' | 'goals' | 'challenges' | 'megatrends' | 'strategy';

interface NavItem {
  id: OrganizationSection;
  labelKey: string;
  defaultLabel: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  labelKey: string;
  defaultLabel: string;
  items: NavItem[];
}

interface OrganizationSidebarProps {
  activeSection: OrganizationSection;
  onSectionChange: (section: OrganizationSection) => void;
  className?: string;
  onBack?: () => void;
}

export const OrganizationSidebar: React.FC<OrganizationSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  onBack,
}) => {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['org']));

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'org',
        labelKey: 'organization.sidebar.group',
        defaultLabel: 'ORGANIZATION',
        items: [
          {
            id: 'profile',
            labelKey: 'organization.sidebar.profile',
            defaultLabel: 'Profile',
            icon: Building2,
          },
          {
            id: 'goals',
            labelKey: 'organization.sidebar.goals',
            defaultLabel: 'Goals',
            icon: Goal,
          },
          {
            id: 'challenges',
            labelKey: 'organization.sidebar.challenges',
            defaultLabel: 'Challenges',
            icon: ShieldAlert,
          },
          {
            id: 'megatrends',
            labelKey: 'organization.sidebar.megatrends',
            defaultLabel: 'Megatrends',
            icon: Map,
          },
          {
            id: 'strategy',
            labelKey: 'organization.sidebar.strategy',
            defaultLabel: 'Strategy',
            icon: Target,
          },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    const groupContaining = navGroups.find((g) => g.items.some((i) => i.id === activeSection));
    if (!groupContaining) return;
    setExpandedGroups((prev) => {
      if (prev.has(groupContaining.id)) return prev;
      return new Set([...prev, groupContaining.id]);
    });
  }, [activeSection, navGroups]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <div
      className={cn(
        'w-72 shrink-0 border-r border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30',
        className
      )}
    >
      <div className="p-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300">
              <Target size={16} />
            </span>
            {t('organization.sidebar.back', 'Back to Dashboard')}
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500">
          {t('organization.sidebar.title', 'Organization')}
        </div>
      </div>

      <div className="px-3 pb-4 space-y-3">
        {navGroups.map((group) => {
          const isOpen = expandedGroups.has(group.id);
          return (
            <div key={group.id} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white"
              >
                <span>{t(group.labelKey, group.defaultLabel)}</span>
                <ChevronDown
                  size={14}
                  className={cn('transition-transform', isOpen ? 'rotate-180' : 'rotate-0')}
                />
              </button>

              {isOpen && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = item.id === activeSection;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSectionChange(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                          active
                            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-white'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center justify-center w-8 h-8 rounded-lg',
                            active
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                          )}
                        >
                          <item.icon size={18} />
                        </span>
                        <span className="truncate">{t(item.labelKey, item.defaultLabel)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrganizationSidebar;
