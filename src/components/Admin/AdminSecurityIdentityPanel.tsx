import { KeyRound, Link2, Shield, ShieldAlert, UserCog, UsersRound } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { cn } from '../../utils/cn';
import { ApiKeysManagementView } from '../../views/admin/ApiKeysManagementView';
import { AdminCollaborationControlsPanel } from './AdminCollaborationControlsPanel';
import { AdminIamPolicyPanel } from './AdminIamPolicyPanel';
import { AdminRiskSummaryPanel } from './AdminRiskSummaryPanel';
import { AdminScimLifecyclePanel } from './AdminScimLifecyclePanel';
import { AdminSecurityPolicyPanel } from './AdminSecurityPolicyPanel';

export type AdminSecurityIdentityTabId =
  | 'policy'
  | 'collaboration'
  | 'api-access'
  | 'iam'
  | 'scim'
  | 'risk';
type TabId = AdminSecurityIdentityTabId;

interface AdminSecurityIdentityPanelProps {
  // Admin komplet 55, Fala 1 — lets AdminSettingsModule open this panel on a
  // specific tab when a caller navigates to a WIRE_ONLY nav slot that has no
  // AdminScreen of its own (e.g. "SSO", "API access"). The `?tab=` URL param
  // set by clicking a tab inside the panel still wins, so in-panel
  // navigation keeps working exactly as before.
  initialTab?: TabId;
}

export const AdminSecurityIdentityPanel: React.FC<AdminSecurityIdentityPanelProps> = ({
  initialTab,
}) => {
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
    if (tabs.some((tab) => tab.id === raw)) return raw as TabId;
    if (initialTab && tabs.some((tab) => tab.id === initialTab)) return initialTab;
    return 'policy';
  }, [searchParams, initialTab]);
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    handleTabChange(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
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
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('admin.security.identityPanel.tabs.label', 'Security and identity sections')}>
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(node) => { tabRefs.current[index] = node; }}
                id={`admin-security-tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`admin-security-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
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

      <div role="tabpanel" id={`admin-security-panel-${activeTab}`} aria-labelledby={`admin-security-tab-${activeTab}`}>
        {activeTab === 'policy' && <AdminSecurityPolicyPanel />}
        {activeTab === 'collaboration' && <AdminCollaborationControlsPanel />}
        {activeTab === 'api-access' && <ApiKeysManagementView />}
        {activeTab === 'iam' && <AdminIamPolicyPanel />}
        {activeTab === 'scim' && <AdminScimLifecyclePanel />}
        {activeTab === 'risk' && <AdminRiskSummaryPanel />}
      </div>
    </div>
  );
};

export default AdminSecurityIdentityPanel;
