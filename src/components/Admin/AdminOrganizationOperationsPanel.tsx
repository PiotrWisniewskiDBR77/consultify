import { Building2, ExternalLink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '../../routes/routeConfig';
import { cn } from '../../utils/cn';
import { OrganizationAdminPanel } from '../Organization/OrganizationAdminPanel';

type OperationsTab = 'domains' | 'branding' | 'competencies';

export const AdminOrganizationOperationsPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<OperationsTab>('domains');

  const tabs: Array<{ id: OperationsTab; label: string; description: string }> = [
    {
      id: 'domains',
      label: t('admin.operations.tabs.domains.label', 'Domains'),
      description: t('admin.operations.tabs.domains.desc', 'Tenant domain verification and routing'),
    },
    {
      id: 'branding',
      label: t('admin.operations.tabs.branding.label', 'Branding'),
      description: t('admin.operations.tabs.branding.desc', 'Identity, locale, and trust posture'),
    },
    {
      id: 'competencies',
      label: t('admin.operations.tabs.competencies.label', 'Competencies'),
      description: t(
        'admin.operations.tabs.competencies.desc',
        'Capability catalog used across the tenant'
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border-subtle bg-c-surface p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-c-text">
              <Building2 className="h-5 w-5 text-c-accent" />
              {t('admin.operations.title', 'Organization Operations')}
            </div>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t(
                'admin.operations.subtitle',
                'Tenant-critical organization operations are available from P32, while deeper business profile editing still remains accessible in the Organization workspace.'
              )}
            </p>
          </div>
          <button
            onClick={() => navigate(ROUTES.ORGANIZATION.PROFILE)}
            className="inline-flex items-center gap-2 rounded-lg border border-c-border-subtle px-4 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('admin.operations.openProfile', 'Open organization profile')}
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
                ? 'border-c-accent bg-c-accent-soft'
                : 'border-c-border-subtle bg-c-surface hover:bg-c-surface-raised'
            )}
          >
            <div className="text-sm font-semibold text-c-text">{item.label}</div>
            <div className="mt-1 text-sm text-c-text-secondary">{item.description}</div>
          </button>
        ))}
      </div>

      <OrganizationAdminPanel section={tab} />
    </div>
  );
};

export default AdminOrganizationOperationsPanel;
