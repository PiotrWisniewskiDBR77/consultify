import { KeyRound, RefreshCw, Shield, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

export const AdminScimLifecyclePanel: React.FC = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<any>(null);
  const [tokenName, setTokenName] = useState(
    t('admin.security.scimLifecycle.defaults.tokenName', 'Tenant SCIM Token')
  );
  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [internalRole, setInternalRole] = useState('member');

  const load = async () => {
    try {
      const result = await Api.getAdminScimSummary();
      setSummary(result?.summary || null);
    } catch (error: any) {
      toast.error(
        error?.message ||
          t('admin.security.scimLifecycle.errors.load', 'Failed to load SCIM summary')
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createToken = async () => {
    try {
      const result = await Api.createAdminScimToken({
        name: tokenName,
        scopes: ['users:read', 'users:write', 'groups:read'],
      });
      await load();
      toast.success(
        t('admin.security.scimLifecycle.toasts.tokenCreated', 'SCIM token created: {{prefix}}', {
          prefix:
            result?.token?.tokenPrefix ||
            t('admin.security.scimLifecycle.defaults.newToken', 'new token'),
        })
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          t('admin.security.scimLifecycle.errors.createToken', 'Failed to create SCIM token')
      );
    }
  };

  const createGroupMapping = async () => {
    try {
      await Api.createAdminScimGroupMapping({
        externalGroupName: groupName,
        externalGroupId: groupId,
        internalRole,
      });
      setGroupName('');
      setGroupId('');
      await load();
      toast.success(
        t('admin.security.scimLifecycle.toasts.mappingCreated', 'SCIM group mapping created')
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          t(
            'admin.security.scimLifecycle.errors.createMapping',
            'Failed to create SCIM group mapping'
          )
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <KeyRound className="h-4 w-4" />
            {t('admin.security.scimLifecycle.stats.activeTokens', 'Active SCIM tokens')}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary?.tokens?.length || 0}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Users className="h-4 w-4" />
            {t('admin.security.scimLifecycle.stats.groupMappings', 'Group mappings')}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary?.groupMappings?.length || 0}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Shield className="h-4 w-4" />
            {t('admin.security.scimLifecycle.stats.openConflicts', 'Open conflicts')}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {(summary?.conflicts || []).filter((item: any) => !item.resolution).length}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('admin.security.scimLifecycle.title', 'SCIM self-service lifecycle')}
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t(
                'admin.security.scimLifecycle.description',
                'Tenant admins can now generate SCIM tokens and maintain group mappings from P32.'
              )}
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            {t('admin.security.scimLifecycle.actions.refresh', 'Refresh')}
          </button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('admin.security.scimLifecycle.createToken.title', 'Create SCIM token')}
            </div>
            <input
              type="text"
              value={tokenName}
              onChange={(event) => setTokenName(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <button
              onClick={() => void createToken()}
              className="rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary"
            >
              {t('admin.security.scimLifecycle.createToken.generate', 'Generate token')}
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('admin.security.scimLifecycle.createMapping.title', 'Create group mapping')}
            </div>
            <input
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Azure AD - Billing Admins"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <input
              type="text"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              placeholder="external-group-id"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <input
              type="text"
              value={internalRole}
              onChange={(event) => setInternalRole(event.target.value)}
              placeholder="billing_admin"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
            />
            <button
              onClick={() => void createGroupMapping()}
              className="rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary"
            >
              {t('admin.security.scimLifecycle.createMapping.save', 'Save mapping')}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('admin.security.scimLifecycle.lists.tokens', 'Tokens')}
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {(summary?.tokens || []).map((token: any) => (
                <div key={token.id}>
                  {t(
                    'admin.security.scimLifecycle.lists.tokenRow',
                    '{{name}} | {{prefix}} | used {{count}} times',
                    {
                      name: token.name,
                      prefix: token.token_prefix,
                      count: token.usage_count || 0,
                    }
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('admin.security.scimLifecycle.lists.groupMappings', 'Group mappings')}
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {(summary?.groupMappings || []).map((mapping: any) => (
                <div key={mapping.id}>
                  {mapping.external_group_name} <span aria-hidden="true">&rarr;</span>{' '}
                  {mapping.internal_role}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminScimLifecyclePanel;
