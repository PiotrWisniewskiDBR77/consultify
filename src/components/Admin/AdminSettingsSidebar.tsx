import { ArrowLeft, CreditCard, RefreshCw, Users } from 'lucide-react';
import React from 'react';

import { cn } from '../../utils/cn';

export type AdminSettingsSection = 'people' | 'billing' | 'operations';

interface AdminSettingsSidebarProps {
  activeSection: AdminSettingsSection;
  onSectionChange: (section: AdminSettingsSection) => void;
  className?: string;
  onBack?: () => void;
}

const NAV_ITEMS: Array<{
  id: AdminSettingsSection;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'people',
    label: 'Team & Access',
    description: 'Members, roles, ownership, and team invite codes',
    icon: Users,
  },
  {
    id: 'billing',
    label: 'Billing & FinOps',
    description: 'Plans, invoices, payment methods, and spend controls',
    icon: CreditCard,
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Context worker queue, processing jobs, and explicit runs',
    icon: RefreshCw,
  },
];

export const AdminSettingsSidebar: React.FC<AdminSettingsSidebarProps> = ({
  activeSection,
  onSectionChange,
  className,
  onBack,
}) => {
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
            Back
          </button>
        )}
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Admin Panel</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage team access and commercial controls for your organization.
        </p>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeSection;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                'w-full rounded-xl border px-3 py-3 text-left transition',
                isActive
                  ? 'border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-100'
                  : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-white/10 dark:hover:bg-white/5'
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'rounded-lg p-2',
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.description}
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
