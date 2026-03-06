// @ts-nocheck
/**
 * SecurityPoliciesView - Super Admin Security Policies Management
 *
 * Enterprise security configuration:
 * - Global defaults & org-specific overrides
 * - Compliance presets (SOC2, HIPAA, GDPR)
 * - Password policies
 * - Session management
 * - IP allowlisting/blocklisting
 * - MFA enforcement
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Globe,
  Info,
  Key,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

interface SecurityPolicy {
  id: string;
  organizationId: string | null;
  organizationName?: string;
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
  hasCustomPolicy: boolean;
}

type TabType = 'global' | 'organizations' | 'presets' | 'lockouts' | 'dataGovernance';

const COMPLIANCE_PRESETS = {
  none: {
    label: 'Standard',
    description: 'Default security settings for general use',
    color: 'slate',
  },
  soc2: {
    label: 'SOC 2 Type II',
    description: 'Strict security controls for service organizations',
    color: 'blue',
  },
  hipaa: {
    label: 'HIPAA',
    description: 'Healthcare data protection compliance',
    color: 'red',
  },
  gdpr: {
    label: 'GDPR',
    description: 'EU data protection regulation compliance',
    color: 'green',
  },
};

export const SecurityPoliciesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('global');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalPolicy, setGlobalPolicy] = useState<SecurityPolicy | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);
  const [lockouts, setLockouts] = useState<any[]>([]);

  // IP input states
  const [newAllowlistIP, setNewAllowlistIP] = useState('');
  const [newBlocklistIP, setNewBlocklistIP] = useState('');

  const [orgPoliciesMap, setOrgPoliciesMap] = useState<Map<string, any>>(new Map());
  const [dataGovPolicies, setDataGovPolicies] = useState<
    Array<{
      id: string;
      organization_id: string;
      retention_days: number | null;
      legal_hold_enabled: number;
      residency_region: string | null;
    }>
  >([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const globalResult = await Api.get('/security-policies/defaults');
      setGlobalPolicy(globalResult.policy);

      const [orgs, policiesResult] = await Promise.all([
        Api.getOrganizations(),
        Api.get('/security-policies/all'),
      ]);

      const policiesMap = new Map(
        (policiesResult.policies || []).map((p: any) => [p.organization_id, p])
      );
      setOrgPoliciesMap(policiesMap);
      const orgsWithPolicy = orgs.map((org: any) => ({
        ...org,
        hasCustomPolicy: policiesMap.has(org.id),
      }));
      setOrganizations(orgsWithPolicy);

      setLockouts([]);

      // V4-ENT-04: Data governance (org policies)
      try {
        const { policies } = await Api.getOrgPolicies();
        setDataGovPolicies(policies || []);
      } catch (_) {
        setDataGovPolicies([]);
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSavePolicy = async (policy: SecurityPolicy) => {
    setSaving(true);
    try {
      if (policy.organizationId) {
        await Api.put(`/security-policies/${policy.organizationId}`, policy);
      } else {
        await Api.put('/security-policies/defaults', policy);
      }
      await fetchData();
    } catch (error) {
      console.error('Failed to save policy:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (organizationId: string | null, preset: string) => {
    setSaving(true);
    try {
      if (organizationId) {
        await Api.post(`/security-policies/${organizationId}/preset`, { preset });
      } else {
        // For global, just update the defaults with preset values
        await Api.put('/security-policies/defaults', { compliancePreset: preset });
      }
      await fetchData();
    } catch (error) {
      console.error('Failed to apply preset:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockAccount = async (email: string) => {
    try {
      await Api.post('/security-policies/unlock-account', { email });
      await fetchData();
    } catch (error) {
      console.error('Failed to unlock account:', error);
    }
  };

  const PolicyEditor: React.FC<{ policy: SecurityPolicy; onSave: (p: SecurityPolicy) => void }> = ({
    policy,
    onSave,
  }) => {
    const [editedPolicy, setEditedPolicy] = useState(policy);

    const updateField = (field: keyof SecurityPolicy, value: any) => {
      setEditedPolicy({ ...editedPolicy, [field]: value });
    };

    const addToList = (field: 'ipAllowlist' | 'ipBlocklist', value: string) => {
      if (value && !editedPolicy[field].includes(value)) {
        updateField(field, [...editedPolicy[field], value]);
      }
    };

    const removeFromList = (field: 'ipAllowlist' | 'ipBlocklist', index: number) => {
      updateField(
        field,
        editedPolicy[field].filter((_, i) => i !== index)
      );
    };

    return (
      <div className="space-y-8">
        {/* Password Policy */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Lock className="text-violet-500" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Password Policy
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure password requirements
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum Length
              </label>
              <input
                type="number"
                min={6}
                max={32}
                value={editedPolicy.passwordMinLength}
                onChange={(e) => updateField('passwordMinLength', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password Expiry (days, 0 = never)
              </label>
              <input
                type="number"
                min={0}
                value={editedPolicy.passwordExpiryDays}
                onChange={(e) => updateField('passwordExpiryDays', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedPolicy.passwordRequireUppercase}
                onChange={(e) => updateField('passwordRequireUppercase', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Uppercase</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedPolicy.passwordRequireLowercase}
                onChange={(e) => updateField('passwordRequireLowercase', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Lowercase</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedPolicy.passwordRequireNumbers}
                onChange={(e) => updateField('passwordRequireNumbers', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Numbers</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedPolicy.passwordRequireSpecial}
                onChange={(e) => updateField('passwordRequireSpecial', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Special chars</span>
            </label>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Password History (prevent reuse of last N passwords)
            </label>
            <input
              type="number"
              min={0}
              max={24}
              value={editedPolicy.passwordHistoryCount}
              onChange={(e) => updateField('passwordHistoryCount', parseInt(e.target.value))}
              className="w-32 px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Session Policy */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="text-blue-500" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Session Policy
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Control session behavior and limits
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                min={5}
                value={editedPolicy.sessionTimeoutMinutes}
                onChange={(e) => updateField('sessionTimeoutMinutes', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Max Concurrent Sessions
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={editedPolicy.concurrentSessionsLimit}
                onChange={(e) => updateField('concurrentSessionsLimit', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Lockout Duration (minutes)
              </label>
              <input
                type="number"
                min={1}
                value={editedPolicy.lockoutDurationMinutes}
                onChange={(e) => updateField('lockoutDurationMinutes', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedPolicy.requireSessionBinding}
                onChange={(e) => updateField('requireSessionBinding', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Bind sessions to IP/device (stricter security)
              </span>
            </label>
          </div>
        </div>

        {/* MFA Policy */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Smartphone className="text-emerald-500" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">MFA Policy</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Multi-factor authentication settings
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedPolicy.mfaRequired}
                onChange={(e) => updateField('mfaRequired', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Require MFA for all users
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Remember Device (days)
              </label>
              <input
                type="number"
                min={0}
                max={90}
                value={editedPolicy.mfaRememberDeviceDays}
                onChange={(e) => updateField('mfaRememberDeviceDays', parseInt(e.target.value))}
                className="w-32 px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* IP Policy */}
        <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Globe className="text-amber-500" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">IP Policy</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Control access by IP address
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Allowlist */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                IP Allowlist (if set, only these IPs can access)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="192.168.1.0/24 or 10.0.0.*"
                  value={newAllowlistIP}
                  onChange={(e) => setNewAllowlistIP(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
                />
                <button
                  onClick={() => {
                    addToList('ipAllowlist', newAllowlistIP);
                    setNewAllowlistIP('');
                  }}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {editedPolicy.ipAllowlist.map((ip, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded text-sm"
                  >
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono">{ip}</span>
                    <button
                      onClick={() => removeFromList('ipAllowlist', idx)}
                      className="text-emerald-600 hover:text-emerald-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Blocklist */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                IP Blocklist (these IPs are always blocked)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={newBlocklistIP}
                  onChange={(e) => setNewBlocklistIP(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
                />
                <button
                  onClick={() => {
                    addToList('ipBlocklist', newBlocklistIP);
                    setNewBlocklistIP('');
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {editedPolicy.ipBlocklist.map((ip, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 bg-red-50 dark:bg-red-500/10 rounded text-sm"
                  >
                    <span className="text-red-700 dark:text-red-400 font-mono">{ip}</span>
                    <button
                      onClick={() => removeFromList('ipBlocklist', idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={() => onSave(editedPolicy)}
            disabled={saving}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Policy
          </button>
        </div>
      </div>
    );
  };

  const renderGlobalTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300">Global Default Policy</h4>
            <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
              These settings apply to all organizations that don't have a custom policy.
              Organizations can override these settings with their own policy.
            </p>
          </div>
        </div>
      </div>

      {globalPolicy && <PolicyEditor policy={globalPolicy} onSave={handleSavePolicy} />}
    </div>
  );

  const renderOrganizationsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((org) => (
          <div
            key={org.id}
            onClick={() => {
              setSelectedOrg(org.id);
              const existingPolicy = orgPoliciesMap.get(org.id);
              if (existingPolicy) {
                setSelectedPolicy(existingPolicy);
              } else if (globalPolicy) {
                setSelectedPolicy({ ...globalPolicy, organizationId: org.id, organizationName: org.name });
              }
            }}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedOrg === org.id
                ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-300 dark:border-violet-500/30'
                : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-violet-300 dark:hover:border-violet-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-white">{org.name}</h4>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
            <div className="flex items-center gap-2">
              {org.hasCustomPolicy ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Settings size={12} />
                  Custom Policy
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-navy-800/10 text-slate-600 dark:text-slate-400">
                  Using Global
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedOrg && selectedPolicy && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Policy for {organizations.find((o) => o.id === selectedOrg)?.name}
            </h3>
            <button
              onClick={() => setSelectedOrg(null)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-300"
            >
              Close
            </button>
          </div>
          <PolicyEditor policy={selectedPolicy} onSave={handleSavePolicy} />
        </div>
      )}
    </div>
  );

  const renderPresetsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(COMPLIANCE_PRESETS).map(([key, preset]) => (
          <div
            key={key}
            className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {preset.label}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {preset.description}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium bg-${preset.color}-500/10 text-${preset.color}-600 dark:text-${preset.color}-400`}
              >
                {key.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
              {key === 'soc2' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 12+ character passwords
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 90-day password rotation
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> MFA required
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 1-hour session timeout
                  </div>
                </>
              )}
              {key === 'hipaa' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 14+ character passwords
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 60-day password rotation
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> MFA required
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 15-minute session
                    timeout
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> Single session only
                  </div>
                </>
              )}
              {key === 'gdpr' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 10+ character passwords
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 180-day password
                    rotation
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 4-hour session timeout
                  </div>
                </>
              )}
              {key === 'none' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 8+ character passwords
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> No expiration
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> MFA optional
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 8-hour session timeout
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => handleApplyPreset(null, key)}
              disabled={saving}
              className="w-full px-4 py-2 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
            >
              Apply as Global Default
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const handleSaveDataGovPolicy = async (
    orgId: string,
    patch: { retentionDays?: number | null; legalHoldEnabled?: boolean; residencyRegion?: string | null }
  ) => {
    setSaving(true);
    try {
      const updated = await Api.putOrgPolicy(orgId, patch);
      setDataGovPolicies((prev) => {
        const idx = prev.findIndex((p) => p.organization_id === orgId);
        const next = [...prev];
        if (idx >= 0) next[idx] = updated;
        else next.push(updated);
        return next;
      });
    } catch (error) {
      console.error('Failed to save data governance policy:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderDataGovernanceTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
        <div className="flex items-start gap-3">
          <Database size={20} className="text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-300">Retention & Legal Hold</h4>
            <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
              Per-organization data governance: retention period (days), legal hold flag, and data
              residency region. Legal hold blocks delete/export operations.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Organization
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Retention (days)
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Legal Hold
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Residency Region
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {organizations.map((org) => {
              const policy = dataGovPolicies.find((p) => p.organization_id === org.id);
              return (
                <DataGovRow
                  key={org.id}
                  org={org}
                  policy={policy ?? null}
                  saving={saving}
                  onSave={handleSaveDataGovPolicy}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const DataGovRow: React.FC<{
    org: Organization;
    policy: {
      retention_days: number | null;
      legal_hold_enabled: number;
      residency_region: string | null;
    } | null;
    saving: boolean;
    onSave: (
      orgId: string,
      patch: {
        retentionDays?: number | null;
        legalHoldEnabled?: boolean;
        residencyRegion?: string | null;
      }
    ) => Promise<void>;
  }> = ({ org, policy, saving, onSave }) => {
    const [retentionDays, setRetentionDays] = useState<string>(
      String(policy?.retention_days ?? '') || ''
    );
    const [legalHold, setLegalHold] = useState<boolean>((policy?.legal_hold_enabled ?? 0) === 1);
    const [residencyRegion, setResidencyRegion] = useState<string>(
      policy?.residency_region ?? ''
    );
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
      setRetentionDays(String(policy?.retention_days ?? '') || '');
      setLegalHold((policy?.legal_hold_enabled ?? 0) === 1);
      setResidencyRegion(policy?.residency_region ?? '');
      setDirty(false);
    }, [policy?.retention_days, policy?.legal_hold_enabled, policy?.residency_region]);

    const handleRetentionChange = (v: string) => {
      setRetentionDays(v);
      setDirty(true);
    };
    const handleLegalHoldChange = (v: boolean) => {
      setLegalHold(v);
      setDirty(true);
    };
    const handleResidencyChange = (v: string) => {
      setResidencyRegion(v);
      setDirty(true);
    };

    const handleSave = () => {
      onSave(org.id, {
        retentionDays:
          retentionDays === '' || retentionDays === null
            ? null
            : Math.max(0, parseInt(retentionDays, 10) || 0),
        legalHoldEnabled: legalHold,
        residencyRegion: residencyRegion.trim() || null,
      });
      setDirty(false);
    };

    return (
      <tr className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
        <td className="px-6 py-4">
          <span className="font-medium text-slate-900 dark:text-white">{org.name}</span>
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-mono">{org.id}</span>
        </td>
        <td className="px-6 py-4">
          <input
            type="number"
            min={0}
            placeholder="None"
            value={retentionDays}
            onChange={(e) => handleRetentionChange(e.target.value)}
            className="w-24 px-3 py-1.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded text-slate-900 dark:text-white text-sm"
          />
        </td>
        <td className="px-6 py-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={legalHold}
              onChange={(e) => handleLegalHoldChange(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-amber-600"
            />
            <span className="text-sm">
              {legalHold ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Active</span>
              ) : (
                <span className="text-slate-500">Off</span>
              )}
            </span>
          </label>
        </td>
        <td className="px-6 py-4">
          <input
            type="text"
            placeholder="e.g. EU-GDPR"
            value={residencyRegion}
            onChange={(e) => handleResidencyChange(e.target.value)}
            className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded text-slate-900 dark:text-white text-sm"
          />
        </td>
        <td className="px-6 py-4 text-right">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-2 ml-auto transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </td>
      </tr>
    );
  };

  const renderLockoutsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                User
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Reason
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                IP Address
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Locked At
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Expires
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {lockouts.map((lockout) => (
              <tr
                key={lockout.id}
                className="hover:bg-slate-50 dark:hover:bg-navy-800/20"
              >
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {lockout.user_email}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                    {lockout.reason}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">
                  {lockout.ip_address}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {new Date(lockout.locked_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {lockout.expires_at
                    ? new Date(lockout.expires_at).toLocaleString()
                    : 'Manual unlock required'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleUnlockAccount(lockout.user_email)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Unlock
                  </button>
                </td>
              </tr>
            ))}
            {lockouts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="text-slate-500 dark:text-slate-400">
                    <Lock size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No locked accounts</p>
                    <p className="text-sm">All accounts are accessible</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <InfoButton cardId="superadmin-security" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Security Policies</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure security settings for organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton
            cardId="superadmin-security"
            position="header-inline"
            size="md"
            showLabel
            label="Help"
          />
          <button
            onClick={fetchData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-slate-400 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-900 p-1 rounded-lg w-fit">
        {[
          { id: 'global', label: 'Global Defaults', icon: <Shield size={16} /> },
          { id: 'organizations', label: 'Organizations', icon: <Building2 size={16} /> },
          { id: 'presets', label: 'Compliance Presets', icon: <ShieldCheck size={16} /> },
          { id: 'lockouts', label: 'Account Lockouts', icon: <Lock size={16} /> },
          { id: 'dataGovernance', label: 'Data Governance', icon: <Database size={16} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-navy-800 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-violet-500" />
        </div>
      ) : (
        <>
          {activeTab === 'global' && renderGlobalTab()}
          {activeTab === 'organizations' && renderOrganizationsTab()}
          {activeTab === 'presets' && renderPresetsTab()}
          {activeTab === 'lockouts' && renderLockoutsTab()}
          {activeTab === 'dataGovernance' && renderDataGovernanceTab()}
        </>
      )}
    </div>
  );
};

export default SecurityPoliciesView;
