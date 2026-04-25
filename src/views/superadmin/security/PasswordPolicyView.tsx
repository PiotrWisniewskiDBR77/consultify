/**
 * Password Policy View
 * Manages password policies for organizations
 */

import { Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

export const PasswordPolicyView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any>({
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
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchPolicy();
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      setLoadError(err?.message || 'Failed to fetch organizations');
      toast.error(err?.message || 'Failed to fetch organizations');
    }
  };

  const fetchPolicy = async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const pol = await Api.getPasswordPolicy(selectedOrgId);
      if (pol) {
        setPolicy({
          minLength: pol.min_length,
          requireUppercase: pol.require_uppercase === 1,
          requireLowercase: pol.require_lowercase === 1,
          requireNumbers: pol.require_numbers === 1,
          requireSpecialChars: pol.require_special_chars === 1,
          maxAgeDays: pol.max_age_days,
          preventReuseCount: pol.prevent_reuse_count,
          lockoutAttempts: pol.lockout_attempts,
          lockoutDurationMinutes: pol.lockout_duration_minutes,
          requireMfa: pol.require_mfa === 1,
        });
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to fetch password policy');
      toast.error(err?.message || 'Failed to fetch password policy');
    } finally {
      setLoading(false);
    }
  };

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
      await Api.updatePasswordPolicy(selectedOrgId, policy);
      toast.success('Password policy updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update password policy');
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
                {org.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={!selectedOrgId || saving}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : (
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
