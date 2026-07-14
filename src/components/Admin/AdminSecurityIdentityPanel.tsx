import { KeyRound, Link2, Shield, ShieldAlert, UserCog, UsersRound } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { cn } from '../../utils/cn';
import { ApiKeysManagementView } from '../../views/admin/ApiKeysManagementView';
import { AdminCollaborationControlsPanel } from './AdminCollaborationControlsPanel';
import { AdminIamPolicyPanel } from './AdminIamPolicyPanel';
import { AdminRiskSummaryPanel } from './AdminRiskSummaryPanel';
import { AdminScimLifecyclePanel } from './AdminScimLifecyclePanel';
import { AdminSecurityPolicyPanel } from './AdminSecurityPolicyPanel';

type TabId = 'policy' | 'collaboration' | 'api-access' | 'iam' | 'scim' | 'risk';

export const AdminSecurityIdentityPanel: React.FC = () => {
  const { t } = useTranslation();
  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    {
      id: 'policy',
      label: t('admin.security.identityPanel.tabs.policy', 'Security policy'),
      icon: Shield,
    },
    {
      id: 'collaboration',
      label: t('admin.security.identityPanel.tabs.collaboration', 'Collaboration policy'),
      icon: Link2,
    },
    {
      id: 'api-access',
      label: t('admin.security.identityPanel.tabs.apiAccess', 'API access'),
      icon: KeyRound,
    },
    {
      id: 'iam',
      label: t('admin.security.identityPanel.tabs.iam', 'Delegated IAM'),
      icon: UserCog,
    },
    {
      id: 'scim',
      label: t('admin.security.identityPanel.tabs.scim', 'SCIM & lifecycle'),
      icon: UsersRound,
    },
    {
      id: 'risk',
      label: t('admin.security.identityPanel.tabs.risk', 'Risk summary'),
      icon: ShieldAlert,
    },
  ];
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = useMemo(() => {
    const raw = searchParams.get('tab');
    return tabs.some((tab) => tab.id === raw) ? (raw as TabId) : 'policy';
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {t('admin.security.identityPanel.title', 'Security & Identity')}
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          {t(
            'admin.security.identityPanel.description',
            'One tenant-admin surface for authentication policy, collaboration controls, API access, delegated admin governance, SCIM identity lifecycle, and risk follow-up.'
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                  activeTab === tab.id
                    ? 'bg-c-text text-c-bg'
                    : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'policy' && <AdminSecurityPolicyPanel />}
      {activeTab === 'collaboration' && <AdminCollaborationControlsPanel />}
      {activeTab === 'api-access' && <ApiKeysManagementView />}
      {activeTab === 'iam' && <AdminIamPolicyPanel />}
      {activeTab === 'scim' && <AdminScimLifecyclePanel />}
      {activeTab === 'risk' && <AdminRiskSummaryPanel />}
    </div>
  );
};

export default AdminSecurityIdentityPanel;
