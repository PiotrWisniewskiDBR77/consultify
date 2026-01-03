/**
 * Password Policy View
 * Manages password policies for organizations
 */

import React, { useState, useEffect } from 'react';
import { Lock, Save } from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

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
        requireMfa: false
    });
    const [loading, setLoading] = useState(false);

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
        } catch (err) {
            console.error('Failed to fetch organizations:', err);
        }
    };

    const fetchPolicy = async () => {
        if (!selectedOrgId) return;
        setLoading(true);
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
                    requireMfa: pol.require_mfa === 1
                });
            }
        } catch (err) {
            // Policy might not exist yet
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedOrgId) {
            toast.error('Please select an organization');
            return;
        }
        try {
            await Api.updatePasswordPolicy(selectedOrgId, policy);
            toast.success('Password policy updated');
        } catch (err) {
            toast.error('Failed to update password policy');
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Password Policy</h2>
                    <p className="text-slate-400 text-sm mt-1">Configure password requirements for organizations</p>
                </div>
                <div className="flex items-center gap-4">
                    <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="bg-navy-800 border border-slate-700 text-white px-4 py-2 rounded-lg"
                    >
                        <option value="">Select Organization</option>
                        {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
                    >
                        <Save size={18} />
                        Save Policy
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="bg-navy-800 rounded-xl border border-slate-700 p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Minimum Length</label>
                            <input
                                type="number"
                                value={policy.minLength}
                                onChange={(e) => setPolicy({ ...policy, minLength: parseInt(e.target.value) })}
                                className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                min="6"
                                max="128"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Max Age (days, optional)</label>
                            <input
                                type="number"
                                value={policy.maxAgeDays || ''}
                                onChange={(e) => setPolicy({ ...policy, maxAgeDays: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                placeholder="No expiration"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm text-slate-300 mb-2">Requirements</label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policy.requireUppercase}
                                onChange={(e) => setPolicy({ ...policy, requireUppercase: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700"
                            />
                            <span className="text-white">Require uppercase letters</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policy.requireLowercase}
                                onChange={(e) => setPolicy({ ...policy, requireLowercase: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700"
                            />
                            <span className="text-white">Require lowercase letters</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policy.requireNumbers}
                                onChange={(e) => setPolicy({ ...policy, requireNumbers: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700"
                            />
                            <span className="text-white">Require numbers</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policy.requireSpecialChars}
                                onChange={(e) => setPolicy({ ...policy, requireSpecialChars: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700"
                            />
                            <span className="text-white">Require special characters</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={policy.requireMfa}
                                onChange={(e) => setPolicy({ ...policy, requireMfa: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-700"
                            />
                            <span className="text-white">Require MFA</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Prevent Reuse (last N passwords)</label>
                            <input
                                type="number"
                                value={policy.preventReuseCount}
                                onChange={(e) => setPolicy({ ...policy, preventReuseCount: parseInt(e.target.value) })}
                                className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                min="0"
                                max="24"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Lockout Attempts</label>
                            <input
                                type="number"
                                value={policy.lockoutAttempts}
                                onChange={(e) => setPolicy({ ...policy, lockoutAttempts: parseInt(e.target.value) })}
                                className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                min="3"
                                max="10"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-300 mb-2">Lockout Duration (minutes)</label>
                            <input
                                type="number"
                                value={policy.lockoutDurationMinutes}
                                onChange={(e) => setPolicy({ ...policy, lockoutDurationMinutes: parseInt(e.target.value) })}
                                className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
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

