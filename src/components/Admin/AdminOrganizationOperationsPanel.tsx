import { Building2, ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';
import { cn } from '../../utils/cn';
import { OrganizationAdminPanel } from '../Organization/OrganizationAdminPanel';

type OperationsTab = 'domains' | 'branding' | 'competencies';

const tabs: Array<{ id: OperationsTab; label: string; description: string }> = [
  { id: 'domains', label: 'Domains', description: 'Tenant domain verification and routing' },
  { id: 'branding', label: 'Branding', description: 'Identity, locale, and trust posture' },
  {
    id: 'competencies',
    label: 'Competencies',
    description: 'Capability catalog used across the tenant',
  },
];

export const AdminOrganizationOperationsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<OperationsTab>('domains');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Building2 className="h-5 w-5 text-primary-500" />
              Organization Operations
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Tenant-critical organization operations are available from P32, while deeper business
              profile editing still remains accessible in the Organization workspace.
            </p>
          </div>
          <button
            onClick={() => navigate(ROUTES.ORGANIZATION.PROFILE)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200"
          >
            Open organization profile
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'rounded-2xl border p-4 text-left transition',
              tab === item.id
                ? 'border-primary-200 bg-primary-50 dark:border-primary-500/30 dark:bg-primary-500/10'
                : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/5'
            )}
          >
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {item.description}
            </div>
          </button>
        ))}
      </div>

      <OrganizationAdminPanel section={tab} />
    </div>
  );
};

export default AdminOrganizationOperationsPanel;
