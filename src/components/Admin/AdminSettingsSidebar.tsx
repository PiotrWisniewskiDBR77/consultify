import {
  Activity,
  ArrowLeft,
  CreditCard,
  Gauge,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils/cn';
import { isCommandCenterEnabled } from '../../utils/commandCenterFlag';

export type AdminSettingsSection =
  | 'people'
  | 'billing'
  | 'ai'
  | 'security'
  | 'audit'
  | 'health'
  | 'command';

interface AdminSettingsSidebarProps {
  activeSection: AdminSettingsSection;
  onSectionChange: (section: AdminSettingsSection) => void;
  className?: string;
  onBack?: () => void;
}

interface NavItem {
  id: AdminSettingsSection;
  labelKey: string;
  labelDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'people',
    labelKey: 'admin.nav.people.label',
    labelDefault: 'Team & Access',
    descriptionKey: 'admin.nav.people.description',
    descriptionDefault: 'Members, roles, ownership, and team invite codes',
    icon: Users,
  },
  {
    id: 'billing',
    labelKey: 'admin.nav.billing.label',
    labelDefault: 'Billing & Plans',
    descriptionKey: 'admin.nav.billing.description',
    descriptionDefault: 'Plan, credit & storage limits, seats, invoices',
    icon: CreditCard,
  },
  {
    id: 'ai',
    labelKey: 'admin.nav.ai.label',
    labelDefault: 'AI Controls',
    descriptionKey: 'admin.nav.ai.description',
    descriptionDefault: 'AI governance, model posture, and operations',
    icon: Sparkles,
  },
  {
    id: 'security',
    labelKey: 'admin.nav.security.label',
    labelDefault: 'Security & Identity',
    descriptionKey: 'admin.nav.security.description',
    descriptionDefault: 'Auth policy, SCIM, delegated IAM, API access',
    icon: ShieldCheck,
  },
  {
    id: 'audit',
    labelKey: 'admin.nav.audit.label',
    labelDefault: 'Audit Log',
    descriptionKey: 'admin.nav.audit.description',
    descriptionDefault: 'High-risk admin events and compliance evidence',
    icon: ScrollText,
  },
  {
    id: 'command',
    labelKey: 'admin.nav.command.label',
    labelDefault: 'Command Center',
    descriptionKey: 'admin.nav.command.description',
    descriptionDefault: 'Trust & control posture — SOC2, DLP, residency, retention, AI policy',
    icon: Gauge,
  },
  {
    id: 'health',
    labelKey: 'admin.nav.health.label',
    labelDefault: 'Health',
    descriptionKey: 'admin.nav.health.description',
    descriptionDefault: 'Proof-of-life probes across critical flows',
    icon: Activity,
  },
];

export const AdminSettingsSidebar: React.FC<AdminSettingsSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  onBack,
}) => {
  const { t } = useTranslation();
  const commandCenterEnabled = isCommandCenterEnabled();
  const visibleNavItems = NAV_ITEMS.filter((item) => item.id !== 'command' || commandCenterEnabled);

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-r border-slate-200 bg-white dark:border-white/10 dark:bg-navy-950',
        className
      )}
    >
      <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.back', { defaultValue: 'Back' })}
          </button>
        )}
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('admin.shell.title', { defaultValue: 'Admin panel' })}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('admin.shell.subtitle', {
            defaultValue: 'Manage access, controls, evidence, and system readiness.',
          })}
        </p>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeSection;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-info)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-950',
                isActive
                  ? 'border-slate-200 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-white/[0.08] dark:text-white'
                  : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'rounded-lg p-2',
                    isActive
                      ? 'bg-slate-200 text-[var(--c-info)] dark:bg-white/10 dark:text-[var(--c-info)]'
                      : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {t(item.labelKey, { defaultValue: item.labelDefault })}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {t(item.descriptionKey, { defaultValue: item.descriptionDefault })}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default AdminSettingsSidebar;
