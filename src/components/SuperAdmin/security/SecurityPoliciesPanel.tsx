/**
 * SecurityPoliciesPanel - Organization Security Policy Management
 *
 * Features:
 * - Password policy editor (min length, complexity rules, expiry)
 * - MFA configuration per organization
 * - Session policy (timeout, concurrent limits)
 * - Compliance presets (SOC2, HIPAA, GDPR)
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  Key,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface SecurityPolicy {
  id?: string;
  organizationId?: string;
  // Password
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecial: boolean;
  passwordExpiryDays: number;
  passwordHistoryCount: number;
  // Login
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  // Session
  sessionTimeoutMinutes: number;
  concurrentSessionsLimit: number;
  requireSessionBinding: boolean;
  // IP
  ipAllowlist: string[];
  ipBlocklist: string[];
  geoRestrictions: string[];
  // MFA
  mfaRequired: boolean;
  mfaMethods: string[];
  mfaRememberDeviceDays: number;
  // Meta
  compliancePreset: string;
}

interface Organization {
  id: string;
  name: string;
}

interface CompliancePreset {
  id: string;
  name: string;
  description: string;
}

const DEFAULT_POLICY: SecurityPolicy = {
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecial: false,
  passwordExpiryDays: 0,
  passwordHistoryCount: 3,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  sessionTimeoutMinutes: 480,
  concurrentSessionsLimit: 5,
  requireSessionBinding: false,
  ipAllowlist: [],
  ipBlocklist: [],
  geoRestrictions: [],
  mfaRequired: false,
  mfaMethods: ['totp'],
  mfaRememberDeviceDays: 30,
  compliancePreset: 'none',
};

export const SecurityPoliciesPanel: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('default');
  const [policy, setPolicy] = useState<SecurityPolicy>(DEFAULT_POLICY);
  const [presets, setPresets] = useState<CompliancePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const result = await Api.get('/security-policies/presets');
      setPresets(result.presets || []);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  }, []);

  const fetchPolicy = useCallback(async (orgId: string) => {
    setLoading(true);
    try {
      const endpoint =
        orgId === 'default' ? '/security-policies/defaults' : `/security-policies/${orgId}`;
      const result = await Api.get(endpoint);
      setPolicy(result.policy || DEFAULT_POLICY);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to fetch policy:', error);
      setPolicy(DEFAULT_POLICY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
    fetchPresets();
    fetchPolicy('default');
  }, [fetchOrganizations, fetchPresets, fetchPolicy]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchPolicy(selectedOrgId);
    }
  }, [selectedOrgId, fetchPolicy]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint =
        selectedOrgId === 'default'
          ? '/security-policies/defaults'
          : `/security-policies/${selectedOrgId}`;
      await Api.put(endpoint, policy);
      toast.success('Security policy saved successfully');
      setHasChanges(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (presetId: string) => {
    if (selectedOrgId === 'default') {
      toast.error('Cannot apply preset to default policy');
      return;
    }

    setSaving(true);
    try {
      await Api.post(`/security-policies/${selectedOrgId}/preset`, { preset: presetId });
      toast.success(`Applied ${presetId} compliance preset`);
      fetchPolicy(selectedOrgId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply preset');
    } finally {
      setSaving(false);
    }
  };

  const updatePolicy = (field: keyof SecurityPolicy, value: any) => {
    setPolicy((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const renderPasswordPolicy = () => (
    <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
          <Key size={20} className="text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-c-text">Password Policy</h3>
          <p className="text-sm text-slate-600 dark:text-slate-500">
            Configure password requirements
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Minimum Length</label>
          <input
            type="number"
            min={6}
            max={32}
            value={policy.passwordMinLength}
            onChange={(e) => updatePolicy('passwordMinLength', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Password History</label>
          <input
            type="number"
            min={0}
            max={24}
            value={policy.passwordHistoryCount}
            onChange={(e) => updatePolicy('passwordHistoryCount', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Prevent reuse of last N passwords
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <h4 className="text-sm font-medium text-slate-600">Character Requirements</h4>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'passwordRequireUppercase', label: 'Uppercase Letters (A-Z)' },
            { key: 'passwordRequireLowercase', label: 'Lowercase Letters (a-z)' },
            { key: 'passwordRequireNumbers', label: 'Numbers (0-9)' },
            { key: 'passwordRequireSpecial', label: 'Special Characters (!@#$%)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={policy[key as keyof SecurityPolicy] as boolean}
                onChange={(e) => updatePolicy(key as keyof SecurityPolicy, e.target.checked)}
                className="w-5 h-5 rounded border-slate-600 bg-c-surface-raised text-primary-500 focus:ring-primary-500/30"
              />
              <span className="text-slate-600 group-hover:text-white transition-colors">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-600 mb-2">
          Password Expiry (days)
        </label>
        <input
          type="number"
          min={0}
          max={365}
          value={policy.passwordExpiryDays}
          onChange={(e) => updatePolicy('passwordExpiryDays', parseInt(e.target.value))}
          className="w-full max-w-xs px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Set to 0 to disable password expiration
        </p>
      </div>
    </div>
  );

  const renderSessionPolicy = () => (
    <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Clock size={20} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-c-text">Session Policy</h3>
          <p className="text-sm text-slate-600 dark:text-slate-500">Configure session management</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Session Timeout (minutes)
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            value={policy.sessionTimeoutMinutes}
            onChange={(e) => updatePolicy('sessionTimeoutMinutes', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {Math.round(policy.sessionTimeoutMinutes / 60)} hours
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Max Concurrent Sessions
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={policy.concurrentSessionsLimit}
            onChange={(e) => updatePolicy('concurrentSessionsLimit', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={policy.requireSessionBinding}
            onChange={(e) => updatePolicy('requireSessionBinding', e.target.checked)}
            className="w-5 h-5 rounded border-slate-600 bg-c-surface-raised text-primary-500 focus:ring-primary-500/30"
          />
          <div>
            <span className="text-slate-600 group-hover:text-white transition-colors">
              Bind Session to Device
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sessions will be invalidated if IP or device changes
            </p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderLoginPolicy = () => (
    <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Lock size={20} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-c-text">Login Policy</h3>
          <p className="text-sm text-slate-600 dark:text-slate-500">Configure login protection</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Max Login Attempts
          </label>
          <input
            type="number"
            min={3}
            max={10}
            value={policy.maxLoginAttempts}
            onChange={(e) => updatePolicy('maxLoginAttempts', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Lockout Duration (minutes)
          </label>
          <input
            type="number"
            min={5}
            max={1440}
            value={policy.lockoutDurationMinutes}
            onChange={(e) => updatePolicy('lockoutDurationMinutes', parseInt(e.target.value))}
            className="w-full px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
        </div>
      </div>
    </div>
  );

  const renderMFAPolicy = () => (
    <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Shield size={20} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-c-text">Multi-Factor Authentication</h3>
          <p className="text-sm text-slate-600 dark:text-slate-500">Configure MFA requirements</p>
        </div>
      </div>

      <div className="space-y-6">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={policy.mfaRequired}
            onChange={(e) => updatePolicy('mfaRequired', e.target.checked)}
            className="w-5 h-5 rounded border-slate-600 bg-c-surface-raised text-primary-500 focus:ring-primary-500/30"
          />
          <div>
            <span className="text-slate-600 group-hover:text-white transition-colors font-medium">
              Require MFA for All Users
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Users must set up MFA before accessing the platform
            </p>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Allowed MFA Methods
          </label>
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'totp', label: 'Authenticator App' },
              { id: 'sms', label: 'SMS' },
              { id: 'email', label: 'Email' },
            ].map(({ id, label }) => (
              <label
                key={id}
                className="flex items-center gap-2 px-3 py-2 bg-c-surface/50 rounded-lg cursor-pointer hover:bg-c-surface transition-colors"
              >
                <input
                  type="checkbox"
                  checked={policy.mfaMethods.includes(id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updatePolicy('mfaMethods', [...policy.mfaMethods, id]);
                    } else {
                      updatePolicy(
                        'mfaMethods',
                        policy.mfaMethods.filter((m) => m !== id)
                      );
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-600 bg-c-surface-raised text-primary-500"
                />
                <span className="text-sm text-slate-600">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Remember Device (days)
          </label>
          <input
            type="number"
            min={0}
            max={90}
            value={policy.mfaRememberDeviceDays}
            onChange={(e) => updatePolicy('mfaRememberDeviceDays', parseInt(e.target.value))}
            className="w-full max-w-xs px-4 py-2.5 bg-c-surface/50 border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Set to 0 to always require MFA
          </p>
        </div>
      </div>
    </div>
  );

  if (loading && !policy) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none min-w-[200px]"
          >
            <option value="default">Platform Defaults</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>

          {selectedOrgId !== 'default' && (
            <select
              value=""
              onChange={(e) => e.target.value && handleApplyPreset(e.target.value)}
              className="px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:border-primary-500/50 outline-none"
            >
              <option value="">Apply Preset...</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPolicy(selectedOrgId)}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Current Preset Badge */}
      {policy.compliancePreset && policy.compliancePreset !== 'none' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg w-fit">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span className="text-sm text-emerald-400">
            {presets.find((p) => p.id === policy.compliancePreset)?.name || policy.compliancePreset}{' '}
            Compliance
          </span>
        </div>
      )}

      {/* Policy Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderPasswordPolicy()}
        {renderSessionPolicy()}
        {renderLoginPolicy()}
        {renderMFAPolicy()}
      </div>
    </div>
  );
};

export default SecurityPoliciesPanel;
