/**
 * Password Policy View
 * Manages password policies for organizations
 */

import { Save } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type OrganizationRow = {
  id: string;
  name: unknown;
};

type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAgeDays: number | null;
  preventReuseCount: number;
  lockoutAttempts: number;
  lockoutDurationMinutes: number;
  requireMfa: boolean;
};

type PasswordPolicyResponse = {
  min_length?: unknown;
  require_uppercase?: unknown;
  require_lowercase?: unknown;
  require_numbers?: unknown;
  require_special_chars?: unknown;
  max_age_days?: unknown;
  prevent_reuse_count?: unknown;
  lockout_attempts?: unknown;
  lockout_duration_minutes?: unknown;
  require_mfa?: unknown;
};

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAgeDays: null,
  preventReuseCount: 5,
  lockoutAttempts: 5,
  lockoutDurationMinutes: 30,
  requireMfa: false,
};

const safeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeNullableNumber = (value: unknown, fallback: number | null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBool = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const POLICY_KEYS = [
  'min_length',
  'require_uppercase',
  'require_lowercase',
  'require_numbers',
  'require_special_chars',
  'max_age_days',
  'prevent_reuse_count',
  'lockout_attempts',
  'lockout_duration_minutes',
  'require_mfa',
];

const hasPolicyShape = (value: unknown) =>
  isRecord(value) && POLICY_KEYS.some((key) => key in value);

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const getPolicyPayload = (value: unknown): PasswordPolicyResponse => {
  if (!isRecord(value)) throw new Error('Password policy response was missing policy data');
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const policy = isRecord(value.policy) ? value.policy : null;
  const nestedPolicy = data && isRecord(data.policy) ? data.policy : null;
  const deeplyNestedPolicy = nestedData && isRecord(nestedData.policy) ? nestedData.policy : null;
  const payload = deeplyNestedPolicy || nestedPolicy || policy || nestedData || data || value;
  if (!hasPolicyShape(payload)) {
    throw new Error('Password policy response was missing policy data');
  }
  return payload as PasswordPolicyResponse;
};

const normalizePolicy = (policy: PasswordPolicyResponse): PasswordPolicy => ({
  minLength: safeNumber(policy.min_length, DEFAULT_POLICY.minLength),
  requireUppercase: toBool(policy.require_uppercase, DEFAULT_POLICY.requireUppercase),
  requireLowercase: toBool(policy.require_lowercase, DEFAULT_POLICY.requireLowercase),
  requireNumbers: toBool(policy.require_numbers, DEFAULT_POLICY.requireNumbers),
  requireSpecialChars: toBool(policy.require_special_chars, DEFAULT_POLICY.requireSpecialChars),
  maxAgeDays: safeNullableNumber(policy.max_age_days, DEFAULT_POLICY.maxAgeDays),
  preventReuseCount: safeNumber(policy.prevent_reuse_count, DEFAULT_POLICY.preventReuseCount),
  lockoutAttempts: safeNumber(policy.lockout_attempts, DEFAULT_POLICY.lockoutAttempts),
  lockoutDurationMinutes: safeNumber(
    policy.lockout_duration_minutes,
    DEFAULT_POLICY.lockoutDurationMinutes
  ),
  requireMfa: toBool(policy.require_mfa, DEFAULT_POLICY.requireMfa),
});

export const PasswordPolicyView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      const normalizedOrgs = getListPayload<OrganizationRow>(orgs, ['organizations', 'items']);
      if (
        !normalizedOrgs.length &&
        !(Array.isArray(orgs) || (isRecord(orgs) && ('data' in orgs || 'organizations' in orgs)))
      ) {
        throw new Error('Organizations response was not a list');
      }
      setOrganizations(normalizedOrgs);
      setSelectedOrgId((current) => current || normalizedOrgs[0]?.id || '');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch organizations');
      setLoadError(message);
      toast.error(message);
    }
  }, []);

  const fetchPolicy = useCallback(async (): Promise<PasswordPolicy | null> => {
    if (!selectedOrgId) return null;
    setLoading(true);
    setLoadError(null);
    try {
      const pol = await Api.getPasswordPolicy(selectedOrgId);
      const next = normalizePolicy(getPolicyPayload(pol));
      setPolicy(next);
      return next;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch password policy');
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      void fetchPolicy();
    }
  }, [selectedOrgId, fetchPolicy]);

  const handleSave = async () => {
    if (!selectedOrgId) {
      toast.error('Please select an organization');
      return;
    }
    if (
      !Number.isInteger(Number(policy.minLength)) ||
      policy.minLength < 6 ||
      policy.minLength > 128
    ) {
      toast.error('Minimum length must be between 6 and 128');
      return;
    }
    try {
      setSaving(true);
      setActionError(null);
      await Api.updatePasswordPolicy(selectedOrgId, policy);
      const persisted = await fetchPolicy();
      if (!persisted || JSON.stringify(persisted) !== JSON.stringify(policy)) {
        throw new Error('Password policy update was not confirmed by the server');
      }
      toast.success('Password policy updated');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to update password policy');
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Password Policy</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Configure password requirements for organizations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
          >
            <option value="">Select Organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {asText(org.name, 'Unknown organization')}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={!selectedOrgId || saving || Boolean(loadError)}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>

      {loadError && <DegradedState title="Password policy unavailable" description={loadError} />}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300"
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Minimum Length
              </label>
              <input
                type="number"
                value={policy.minLength}
                onChange={(e) => setPolicy({ ...policy, minLength: Number(e.target.value) || 6 })}
                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                min="6"
                max="128"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Max Age (days, optional)
              </label>
              <input
                type="number"
                value={policy.maxAgeDays || ''}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    maxAgeDays: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                placeholder="No expiration"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
              Requirements
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.requireUppercase}
                onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-900 dark:text-white">Require uppercase letters</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.requireLowercase}
                onChange={(e) => setPolicy({ ...policy, requireLowercase: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-900 dark:text-white">Require lowercase letters</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.requireNumbers}
                onChange={(e) => setPolicy({ ...policy, requireNumbers: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-900 dark:text-white">Require numbers</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.requireSpecialChars}
                onChange={(e) => setPolicy({ ...policy, requireSpecialChars: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-900 dark:text-white">Require special characters</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={policy.requireMfa}
                onChange={(e) => setPolicy({ ...policy, requireMfa: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              <span className="text-slate-900 dark:text-white">Require MFA</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Prevent Reuse (last N passwords)
              </label>
              <input
                type="number"
                value={policy.preventReuseCount}
                onChange={(e) =>
                  setPolicy({ ...policy, preventReuseCount: Number(e.target.value) || 0 })
                }
                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                min="0"
                max="24"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Lockout Attempts
              </label>
              <input
                type="number"
                value={policy.lockoutAttempts}
                onChange={(e) =>
                  setPolicy({ ...policy, lockoutAttempts: Number(e.target.value) || 3 })
                }
                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                min="3"
                max="10"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Lockout Duration (minutes)
              </label>
              <input
                type="number"
                value={policy.lockoutDurationMinutes}
                onChange={(e) =>
                  setPolicy({ ...policy, lockoutDurationMinutes: Number(e.target.value) || 5 })
                }
                className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                min="5"
                max="1440"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
