/**
 * IPAccessRulesPanel - IP Allowlist/Blocklist Management
 *
 * Features:
 * - Allowlist/Blocklist management
 * - CIDR notation support
 * - Geo restrictions
 */

import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  Edit2,
  Globe,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';

interface IPRule {
  id: string;
  organization_id: string;
  ip_address: string;
  rule_type: 'allow' | 'block';
  description?: string;
  is_active: number;
  expires_at?: string;
  created_at: string;
  created_by?: string;
  created_by_email?: string;
}

interface Organization {
  id: string;
  name: string;
}

interface AddRuleForm {
  ipAddress: string;
  ruleType: 'allow' | 'block';
  description: string;
  expiresAt: string;
}

export const IPAccessRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<IPRule[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddRuleForm>({
    ipAddress: '',
    ruleType: 'block',
    description: '',
    expiresAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0 && !selectedOrgId) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  }, [selectedOrgId]);

  const fetchRules = useCallback(async () => {
    if (!selectedOrgId) return;

    setLoading(true);
    try {
      const result = await Api.get(`/security-policies/${selectedOrgId}/ip-rules`);
      setRules(result.rules || []);
    } catch (error) {
      console.error('Failed to fetch IP rules:', error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      fetchRules();
    }
  }, [selectedOrgId, fetchRules]);

  const handleAddRule = async () => {
    if (!addForm.ipAddress) {
      toast.error('IP address is required');
      return;
    }

    // Validate IP format (basic validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^\*$/;
    if (!ipRegex.test(addForm.ipAddress) && !addForm.ipAddress.includes('*')) {
      toast.error(
        'Invalid IP address format. Use IP, CIDR (e.g., 192.168.1.0/24), or wildcard (*)'
      );
      return;
    }

    setSaving(true);
    try {
      await Api.post(`/security-policies/${selectedOrgId}/ip-rules`, {
        ipAddress: addForm.ipAddress,
        ruleType: addForm.ruleType,
        description: addForm.description || undefined,
        expiresAt: addForm.expiresAt || undefined,
      });
      toast.success('IP rule added successfully');
      setShowAddForm(false);
      setAddForm({ ipAddress: '', ruleType: 'block', description: '', expiresAt: '' });
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add IP rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingIds((prev) => new Set(prev).add(ruleId));
    try {
      await Api.delete(`/security-policies/${selectedOrgId}/ip-rules/${ruleId}`);
      toast.success('IP rule deleted');
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete rule');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
    }
  };

  const handleToggleRule = async (rule: IPRule) => {
    try {
      await Api.put(`/security-policies/${selectedOrgId}/ip-rules/${rule.id}`, {
        isActive: !rule.is_active,
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: r.is_active ? 0 : 1 } : r))
      );
      toast.success(`Rule ${rule.is_active ? 'disabled' : 'enabled'}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update rule');
    }
  };

  const allowRules = rules.filter((r) => r.rule_type === 'allow');
  const blockRules = rules.filter((r) => r.rule_type === 'block');

  const renderRuleCard = (rule: IPRule) => (
    <div
      key={rule.id}
      className={`flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border ${
        rule.is_active
          ? rule.rule_type === 'allow'
            ? 'border-emerald-500/20'
            : 'border-danger-500/20'
          : 'border-white/[0.04] opacity-60'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            rule.rule_type === 'allow' ? 'bg-emerald-500/20' : 'bg-danger-500/20'
          }`}
        >
          {rule.rule_type === 'allow' ? (
            <Shield size={18} className="text-emerald-400" />
          ) : (
            <ShieldOff size={18} className="text-danger-400" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-0.5 bg-c-surface-raised rounded font-mono text-c-text">
              {rule.ip_address}
            </code>
            {!rule.is_active && (
              <span className="px-2 py-0.5 bg-c-surface-raised rounded text-xs text-slate-600 dark:text-slate-500">
                Disabled
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-slate-600 dark:text-slate-500 mt-1">{rule.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {new Date(rule.created_at).toLocaleDateString()}
            </span>
            {rule.expires_at && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle size={12} />
                Expires {new Date(rule.expires_at).toLocaleDateString()}
              </span>
            )}
            {rule.created_by_email && (
              <span className="flex items-center gap-1">
                <User size={12} />
                {rule.created_by_email}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleToggleRule(rule)}
          className={`p-2 rounded-lg transition-colors ${
            rule.is_active
              ? 'bg-c-surface-raised hover:bg-c-surface-raised text-slate-600 dark:text-slate-500'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
          }`}
          title={rule.is_active ? 'Disable' : 'Enable'}
        >
          {rule.is_active ? <X size={16} /> : <Check size={16} />}
        </button>
        <button
          onClick={() => handleDeleteRule(rule.id)}
          disabled={deletingIds.has(rule.id)}
          className="p-2 hover:bg-danger-500/10 text-slate-600 dark:text-slate-500 hover:text-danger-400 rounded-lg transition-colors disabled:opacity-50"
          title="Delete"
        >
          {deletingIds.has(rule.id) ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:border-c-focus-solid outline-none min-w-[200px]"
          >
            <option value="" disabled>
              Select Organization
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRules}
            className="p-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={!selectedOrgId}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
          >
            <Plus size={18} />
            Add Rule
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
        <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-300">
            <strong>How IP rules work:</strong>
          </p>
          <ul className="text-sm text-blue-300/80 mt-2 space-y-1 list-disc list-inside">
            <li>
              <strong>Blocklist</strong> rules are evaluated first - matching IPs are denied access
            </li>
            <li>
              <strong>Allowlist</strong> rules restrict access to only listed IPs (if any exist)
            </li>
            <li>Supports CIDR notation (e.g., 192.168.1.0/24) and wildcards</li>
          </ul>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-c-text mb-6">Add IP Rule</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  IP Address / CIDR
                </label>
                <input
                  type="text"
                  value={addForm.ipAddress}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, ipAddress: e.target.value }))}
                  placeholder="192.168.1.1 or 192.168.0.0/24"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-c-focus-solid outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Rule Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAddForm((prev) => ({ ...prev, ruleType: 'allow' }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      addForm.ruleType === 'allow'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-c-surface-raised border-c-border-subtle text-slate-600 dark:text-slate-500 hover:border-c-border'
                    }`}
                  >
                    <Shield size={18} />
                    Allow
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddForm((prev) => ({ ...prev, ruleType: 'block' }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                      addForm.ruleType === 'block'
                        ? 'bg-danger-500/20 border-danger-500/50 text-danger-400'
                        : 'bg-c-surface-raised border-c-border-subtle text-slate-600 dark:text-slate-500 hover:border-c-border'
                    }`}
                  >
                    <ShieldOff size={18} />
                    Block
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Office network, VPN"
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text placeholder:text-slate-500 dark:text-slate-400 focus:border-c-focus-solid outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Expires (optional)
                </label>
                <input
                  type="datetime-local"
                  value={addForm.expiresAt}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text focus:border-c-focus-solid outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 bg-c-surface-raised hover:bg-c-surface-raised rounded-lg text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRule}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!selectedOrgId ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600 dark:text-slate-500">
          <Building2 size={48} className="mb-4 opacity-50" />
          <p>Select an organization to manage IP rules</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Blocklist */}
          <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-danger-500/20 flex items-center justify-center">
                <ShieldOff size={20} className="text-danger-400" />
              </div>
              <div>
                <h3 className="font-semibold text-c-text">Blocklist</h3>
                <p className="text-sm text-slate-600 dark:text-slate-500">
                  {blockRules.length} blocked IPs
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {blockRules.length === 0 ? (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No blocked IPs
                </p>
              ) : (
                blockRules.map(renderRuleCard)
              )}
            </div>
          </div>

          {/* Allowlist */}
          <div className="bg-c-surface-raised/50 border border-white/[0.06] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Shield size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-c-text">Allowlist</h3>
                <p className="text-sm text-slate-600 dark:text-slate-500">
                  {allowRules.length === 0
                    ? 'All IPs allowed (except blocked)'
                    : `${allowRules.length} allowed IPs`}
                </p>
              </div>
            </div>

            {allowRules.length > 0 && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertTriangle size={14} />
                  <span>Allowlist is active - only listed IPs can access</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {allowRules.length === 0 ? (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No allowlist restrictions
                </p>
              ) : (
                allowRules.map(renderRuleCard)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IPAccessRulesPanel;
