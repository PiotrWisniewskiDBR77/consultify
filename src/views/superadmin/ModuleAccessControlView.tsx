import { CheckCircle2, KeyRound, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import { Api } from '@/services/api';
import { apiGet, apiPost } from '@/services/api/baseClient';

type ScopeType = 'organization' | 'user';
type ModuleKey = 'wordy' | 'excele' | 'prezentacje';

interface ModuleAccessGrant {
  id: string;
  module_key: ModuleKey;
  scope_type: ScopeType;
  organization_id: string | null;
  organization_name?: string | null;
  user_id: string | null;
  user_email?: string | null;
  access_level: string;
  is_active: boolean;
  notes?: string | null;
  updated_at: string;
}

interface OrganizationsResponse {
  id: string;
  name: string;
}

const MODULE_LABELS: Record<ModuleKey, string> = {
  wordy: 'Wordy (Documents)',
  excele: 'Excele (Tables)',
  prezentacje: 'Prezentacje (Presentations)',
};

export const ModuleAccessControlView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<ModuleAccessGrant[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationsResponse[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [scopeType, setScopeType] = useState<ScopeType>('organization');
  const [moduleKey, setModuleKey] = useState<ModuleKey>('prezentacje');
  const [organizationId, setOrganizationId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [notes, setNotes] = useState('');

  const dbr77Org = useMemo(
    () => organizations.find((org) => org.name.toLowerCase().includes('dbr77')) || null,
    [organizations]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [grantData, orgs] = await Promise.all([
        apiGet<{ grants: ModuleAccessGrant[] }>('/module-access/admin/grants'),
        Api.getOrganizations(),
      ]);
      setGrants(grantData.grants || []);
      setOrganizations((orgs || []) as OrganizationsResponse[]);
      if (!organizationId) {
        const defaultOrg = (orgs || []).find((org: any) =>
          String(org?.name || '')
            .toLowerCase()
            .includes('dbr77')
        );
        if (defaultOrg?.id) setOrganizationId(String(defaultOrg.id));
      }
    } catch (error) {
      console.error('[ModuleAccessControlView] load failed', error);
      toast.error('Failed to load module access grants');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleGrant = async () => {
    setSubmitting(true);
    try {
      if (scopeType === 'organization' && !organizationId) {
        toast.error('Select organization for organization-level grant');
        return;
      }
      if (scopeType === 'user' && !userEmail.trim()) {
        toast.error('Provide user email for user-level grant');
        return;
      }

      await apiPost('/module-access/admin/grants', {
        moduleKey,
        scopeType,
        organizationId: scopeType === 'organization' ? organizationId : undefined,
        userEmail: scopeType === 'user' ? userEmail.trim().toLowerCase() : undefined,
        notes: notes.trim() || null,
        isActive: true,
      });
      toast.success('Access grant saved');
      setNotes('');
      await loadData();
    } catch (error) {
      console.error('[ModuleAccessControlView] grant failed', error);
      toast.error('Failed to save grant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrapDbr77 = async () => {
    setSubmitting(true);
    try {
      await apiPost('/module-access/admin/bootstrap/dbr77', {});
      toast.success('DBR77 org grants ensured');
      await loadData();
    } catch (error) {
      console.error('[ModuleAccessControlView] bootstrap failed', error);
      toast.error('Failed to ensure DBR77 grants');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleGrant = async (grantId: string, current: boolean) => {
    try {
      await apiPost(`/module-access/admin/grants/${grantId}/toggle`, { isActive: !current });
      toast.success(current ? 'Grant disabled' : 'Grant enabled');
      await loadData();
    } catch (error) {
      console.error('[ModuleAccessControlView] toggle failed', error);
      toast.error('Failed to toggle grant');
    }
  };

  const grantColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'module',
        label: 'Module',
        render: (row: TableRow) => MODULE_LABELS[row.module_key as ModuleKey] || row.module_key,
      },
      {
        id: 'scope',
        label: 'Scope',
        render: (row: TableRow) => <span className="capitalize">{row.scope_type}</span>,
      },
      {
        id: 'target',
        label: 'Target',
        render: (row: TableRow) =>
          row.scope_type === 'organization' ? (
            <span>{row.organization_name || row.organization_id || 'Unknown org'}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={13} />
              {row.user_email || row.user_id || 'Unknown user'}
            </span>
          ),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row: TableRow) => (
          <span
            className={`inline-flex px-2 py-0.5 rounded-md text-xs ${
              row.is_active
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-500/10 text-slate-500'
            }`}
          >
            {row.is_active ? 'ACTIVE' : 'DISABLED'}
          </span>
        ),
      },
      {
        id: 'updated',
        label: 'Updated',
        render: (row: TableRow) => (
          <span className="text-xs text-slate-500">
            {new Date(row.updated_at).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        align: 'right',
        render: (row: TableRow) => (
          <button
            onClick={() => void toggleGrant(row.id, Boolean(row.is_active))}
            className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-navy-700"
          >
            {row.is_active ? 'Disable' : 'Enable'}
          </button>
        ),
      },
    ],
    [toggleGrant]
  );

  const grantRows: TableRow[] = useMemo(() => grants.map((grant) => ({ ...grant })), [grants]);

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Module Access Control
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Grant access per user or whole organization for Wordy, Excele and Prezentacje.
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-navy-700"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
          <KeyRound size={16} />
          Create / Update Grant
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value as ScopeType)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
          >
            <option value="organization">Organization scope</option>
            <option value="user">User scope</option>
          </select>

          <select
            value={moduleKey}
            onChange={(e) => setModuleKey(e.target.value as ModuleKey)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
          >
            {Object.entries(MODULE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {scopeType === 'organization' ? (
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
            >
              <option value="">Select organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="user@email.com"
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
            />
          )}

          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note"
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleGrant()}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            Save Grant
          </button>
          <button
            onClick={() => void handleBootstrapDbr77()}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          >
            <ShieldCheck size={14} />
            Ensure DBR77 Default Grants
          </button>
          {dbr77Org && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              DBR77 org detected: {dbr77Org.name}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 text-sm font-medium">
          Active Grants
        </div>
        <StandardTable
          columns={grantColumns}
          data={grantRows}
          loading={loading}
          empty={{ title: 'No grants configured yet.' }}
          persistKey="superadmin.moduleAccessGrants"
          canvasClassName="p-0"
        />
      </div>
    </div>
  );
};

export default ModuleAccessControlView;
