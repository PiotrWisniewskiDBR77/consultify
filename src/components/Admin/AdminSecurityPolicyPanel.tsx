import { KeyRound, Loader2, Lock, Save, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';

type SecurityPolicyState = {
  mfaRequired: boolean;
  mfaGracePeriodDays: number;
  ssoEnabled: boolean;
  ssoEnforced: boolean;
  allowPasswordLogin: boolean;
  ssoProvider: string;
  ssoProviderType: string;
  ssoProtocol: 'saml' | 'oidc';
  sessionTimeoutMinutes: number;
  passwordPolicy: string;
};

const DEFAULT_POLICY: SecurityPolicyState = {
  mfaRequired: false,
  mfaGracePeriodDays: 7,
  ssoEnabled: false,
  ssoEnforced: false,
  allowPasswordLogin: true,
  ssoProvider: 'Custom SSO',
  ssoProviderType: 'custom',
  ssoProtocol: 'saml',
  sessionTimeoutMinutes: 60,
  passwordPolicy: 'standard',
};

export const AdminSecurityPolicyPanel: React.FC = () => {
  const [policy, setPolicy] = useState<SecurityPolicyState>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await Api.getAdminSecurityPolicy();
        setPolicy({ ...DEFAULT_POLICY, ...(response?.policy || {}) });
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load security policy');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await Api.updateAdminSecurityPolicy(policy);
      toast.success('Security policy saved');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save security policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-56" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-c-border-subtle dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <KeyRound className="h-4 w-4 text-primary-500" />
            MFA enforcement
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Require multi-factor authentication across the workspace.
          </p>
          <label className="mt-4 flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-300">Enabled</span>
            <input
              type="checkbox"
              checked={policy.mfaRequired}
              onChange={(event) =>
                setPolicy((prev) => ({ ...prev, mfaRequired: event.target.checked }))
              }
            />
          </label>
          <label className="mt-4 block text-sm text-slate-600 dark:text-slate-300">
            Grace period (days)
            <input
              type="number"
              min={0}
              value={policy.mfaGracePeriodDays}
              onChange={(event) =>
                setPolicy((prev) => ({
                  ...prev,
                  mfaGracePeriodDays: Number(event.target.value || 0),
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-c-border-subtle dark:bg-navy-900 dark:text-white"
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-c-border-subtle dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Shield className="h-4 w-4 text-primary-500" />
            SSO posture
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Configure provider state and password fallback for identity flows.
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>SSO enabled</span>
              <input
                type="checkbox"
                checked={policy.ssoEnabled}
                onChange={(event) =>
                  setPolicy((prev) => ({ ...prev, ssoEnabled: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Enforce SSO login</span>
              <input
                type="checkbox"
                checked={policy.ssoEnforced}
                onChange={(event) =>
                  setPolicy((prev) => ({ ...prev, ssoEnforced: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>Allow password fallback</span>
              <input
                type="checkbox"
                checked={policy.allowPasswordLogin}
                onChange={(event) =>
                  setPolicy((prev) => ({ ...prev, allowPasswordLogin: event.target.checked }))
                }
              />
            </label>
            <input
              type="text"
              value={policy.ssoProvider}
              onChange={(event) =>
                setPolicy((prev) => ({ ...prev, ssoProvider: event.target.value }))
              }
              placeholder="Okta"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-c-border-subtle dark:bg-navy-900 dark:text-white"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={policy.ssoProviderType}
                onChange={(event) =>
                  setPolicy((prev) => ({ ...prev, ssoProviderType: event.target.value }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-c-border-subtle dark:bg-navy-900 dark:text-white"
              >
                <option value="custom">Custom</option>
                <option value="okta">Okta</option>
                <option value="azure_ad">Azure AD</option>
                <option value="google">Google</option>
              </select>
              <select
                value={policy.ssoProtocol}
                onChange={(event) =>
                  setPolicy((prev) => ({
                    ...prev,
                    ssoProtocol: event.target.value === 'oidc' ? 'oidc' : 'saml',
                  }))
                }
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-c-border-subtle dark:bg-navy-900 dark:text-white"
              >
                <option value="saml">SAML</option>
                <option value="oidc">OIDC</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-c-border-subtle dark:bg-white/5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Lock className="h-4 w-4 text-primary-500" />
            Session and password
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Canonical tenant policy surfaced through Admin instead of personal settings.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Session timeout (minutes)
              <select
                value={policy.sessionTimeoutMinutes}
                onChange={(event) =>
                  setPolicy((prev) => ({
                    ...prev,
                    sessionTimeoutMinutes: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-c-border-subtle dark:bg-navy-900 dark:text-white"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={120}>120 minutes</option>
                <option value={240}>240 minutes</option>
              </select>
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-300">
              Password policy
              <select
                value={policy.passwordPolicy}
                onChange={(event) =>
                  setPolicy((prev) => ({ ...prev, passwordPolicy: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-c-border-subtle dark:bg-navy-900 dark:text-white"
              >
                <option value="standard">Standard</option>
                <option value="strong">Strong</option>
                <option value="strict">Strict</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save security policy
        </button>
      </div>
    </div>
  );
};

export default AdminSecurityPolicyPanel;
