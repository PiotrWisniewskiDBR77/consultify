// @ts-nocheck
/**
 * APIManagementView - Super Admin API Keys Management
 *
 * Enterprise API management:
 * - API key creation and management
 * - Scope-based permissions
 * - Rate limiting configuration
 * - Usage analytics
 * - Webhook management
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Trash2,
  User,
  Webhook,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';

interface APIKey {
  id: string;
  organizationId: string;
  organizationName?: string;
  userId?: string;
  name: string;
  description?: string;
  keyPrefix: string;
  keyType: 'org' | 'user' | 'service';
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  allowedIps: string[];
  lastUsedAt?: string;
  usageCount: number;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (key: { id: string; key: string; name: string }) => void;
  organizations: { id: string; name: string }[];
}

const AVAILABLE_SCOPES = {
  'read:users': 'Read user information',
  'write:users': 'Create/update users',
  'delete:users': 'Delete users',
  'read:organizations': 'Read organization data',
  'write:organizations': 'Update organization settings',
  'read:projects': 'Read projects',
  'write:projects': 'Create/update projects',
  'read:assessments': 'Read assessments',
  'write:assessments': 'Create/update assessments',
  'read:initiatives': 'Read initiatives',
  'write:initiatives': 'Create/update initiatives',
  'read:tasks': 'Read tasks',
  'write:tasks': 'Create/update tasks',
  'read:reports': 'Read reports',
  'export:reports': 'Export reports to PDF/Excel',
  'use:ai': 'Use AI features',
  'read:ai_usage': 'Read AI usage statistics',
  'admin:billing': 'Access billing data',
  'admin:audit': 'Access audit logs',
  'manage:webhooks': 'Create/manage webhooks',
};

const SCOPE_GROUPS = {
  Users: ['read:users', 'write:users', 'delete:users'],
  Organizations: ['read:organizations', 'write:organizations'],
  Projects: ['read:projects', 'write:projects'],
  Assessments: ['read:assessments', 'write:assessments'],
  Initiatives: ['read:initiatives', 'write:initiatives'],
  Tasks: ['read:tasks', 'write:tasks'],
  Reports: ['read:reports', 'export:reports'],
  AI: ['use:ai', 'read:ai_usage'],
  Admin: ['admin:billing', 'admin:audit', 'manage:webhooks'],
};

const CreateKeyModal: React.FC<CreateKeyModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  organizations,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [keyType, setKeyType] = useState<'org' | 'service'>('org');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(60);
  const [rateLimitPerDay, setRateLimitPerDay] = useState(10000);
  const [expiresIn, setExpiresIn] = useState<'never' | '30d' | '90d' | '1y'>('never');
  const [creating, setCreating] = useState(false);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const selectAllInGroup = (group: string) => {
    const groupScopes = SCOPE_GROUPS[group as keyof typeof SCOPE_GROUPS] || [];
    const allSelected = groupScopes.every((s) => selectedScopes.includes(s));
    if (allSelected) {
      setSelectedScopes((prev) => prev.filter((s) => !groupScopes.includes(s)));
    } else {
      setSelectedScopes((prev) => [...new Set([...prev, ...groupScopes])]);
    }
  };

  const handleCreate = async () => {
    if (!name || !organizationId || selectedScopes.length === 0) return;

    setCreating(true);
    try {
      let expiresAt = null;
      if (expiresIn !== 'never') {
        const days = expiresIn === '30d' ? 30 : expiresIn === '90d' ? 90 : 365;
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }

      const result = await Api.post('/api/superadmin/api-keys', {
        organizationId,
        name,
        description,
        keyType,
        scopes: selectedScopes,
        rateLimitPerMinute,
        rateLimitPerDay,
        expiresAt,
      });

      onCreated(result);
    } catch (error) {
      console.error('Failed to create API key:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create API Key</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Generate a new API key for programmatic access
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Key Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production API Key"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Organization *
              </label>
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Select organization...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will this key be used for?"
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Key Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Key Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={keyType === 'org'}
                  onChange={() => setKeyType('org')}
                  className="w-4 h-4 text-violet-600"
                />
                <Building2 size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Organization Key</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={keyType === 'service'}
                  onChange={() => setKeyType('service')}
                  className="w-4 h-4 text-violet-600"
                />
                <Server size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Service Key</span>
              </label>
            </div>
          </div>

          {/* Scopes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Permissions (Scopes) *
            </label>
            <div className="space-y-4 max-h-48 overflow-y-auto border border-slate-200 dark:border-navy-700 rounded-lg p-4">
              {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
                <div key={group}>
                  <button
                    onClick={() => selectAllInGroup(group)}
                    className="text-sm font-medium text-slate-900 dark:text-white mb-2 hover:text-violet-600 dark:hover:text-violet-400"
                  >
                    {group}
                  </button>
                  <div className="grid grid-cols-2 gap-2 ml-4">
                    {scopes.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-violet-600"
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {selectedScopes.length} scopes selected
            </p>
          </div>

          {/* Rate Limits */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Rate Limit (per minute)
              </label>
              <input
                type="number"
                value={rateLimitPerMinute}
                onChange={(e) => setRateLimitPerMinute(parseInt(e.target.value))}
                min={1}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Rate Limit (per day)
              </label>
              <input
                type="number"
                value={rateLimitPerDay}
                onChange={(e) => setRateLimitPerDay(parseInt(e.target.value))}
                min={1}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Expiration
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="never">Never expires</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="1y">1 year</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name || !organizationId || selectedScopes.length === 0}
            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Create Key
          </button>
        </div>
      </div>
    </div>
  );
};

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  events_json?: string;
  events?: string[];
  is_active?: boolean;
  secret?: string;
  created_at?: string;
  last_triggered_at?: string;
  failure_count?: number;
}

type TabType = 'keys' | 'usage' | 'webhooks';

export const APIManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('keys');
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    id: string;
    key: string;
    name: string;
  } | null>(null);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [selectedKeyForUsage, setSelectedKeyForUsage] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<any>(null);

  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: '' as string,
    secret: '',
  });
  const [creatingWebhook, setCreatingWebhook] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysResult, orgsResult] = await Promise.all([
        Api.get('/api/superadmin/api-keys'),
        Api.getOrganizations(),
      ]);

      const rawKeys = Array.isArray(keysResult) ? keysResult : keysResult?.keys || [];
      const keys = rawKeys.map((k: any) => ({
        ...k,
        keyType: k.keyType || 'org',
        scopes: Array.isArray(k.scopes)
          ? k.scopes
          : typeof k.scopes === 'string'
            ? JSON.parse(k.scopes || '[]')
            : [],
        allowedIps: Array.isArray(k.allowedIps) ? k.allowedIps : [],
        usageCount: Number(k.usageCount) || 0,
        rateLimitPerMinute: Number(k.rateLimitPerMinute) || 60,
        rateLimitPerDay: Number(k.rateLimitPerDay) || 10000,
        isActive: k.isActive === true || k.isActive === 1 || k.isActive === '1',
      }));
      setApiKeys(keys);
      setOrganizations(orgsResult);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleKeyCreated = (key: { id: string; key: string; name: string }) => {
    setNewlyCreatedKey(key);
    setShowCreateModal(false);
    fetchData();
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.'))
      return;

    try {
      await Api.delete(`/api/superadmin/api-keys/${keyId}`);
      fetchData();
    } catch (error) {
      console.error('Failed to revoke key:', error);
    }
  };

  const handleViewUsage = async (keyId: string) => {
    setSelectedKeyForUsage(keyId);
    try {
      const result = await Api.get(`/api/superadmin/api-keys/${keyId}/usage`);
      setUsageData(result);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const stats = {
    total: apiKeys.length,
    active: apiKeys.filter((k) => k.isActive).length,
    totalUsage: apiKeys.reduce((sum, k) => sum + k.usageCount, 0),
  };

  const renderKeysTab = () => (
    <div className="space-y-6">
      {/* Newly Created Key Alert */}
      {newlyCreatedKey && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-6 border border-emerald-200 dark:border-emerald-500/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="text-white" size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-300">
                API Key Created: {newlyCreatedKey.name}
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-400 mt-1">
                Copy this key now. You won't be able to see it again!
              </p>
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 px-4 py-2 bg-white dark:bg-navy-900 rounded-lg text-sm font-mono text-slate-900 dark:text-white border border-emerald-200 dark:border-emerald-500/30">
                  {newlyCreatedKey.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey.key)}
                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="text-emerald-600 hover:text-emerald-800"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <KeyRound className="text-violet-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Total Keys</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="text-emerald-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.active}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Active</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="text-blue-500" size={20} />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalUsage.toLocaleString()}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Total API Calls</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          Create API Key
        </button>
      </div>

      {/* Keys Table */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Key
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Organization
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Scopes
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Usage
              </th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/10">
            {apiKeys.map((key) => (
              <tr key={key.id} className="hover:bg-slate-50 dark:hover:bg-navy-800/20">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">{key.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {key.keyPrefix}...
                      </code>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          key.keyType === 'org'
                            ? 'bg-violet-500/10 text-violet-600'
                            : key.keyType === 'service'
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {(key.keyType || 'org').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {key.organizationName ||
                      organizations.find((o) => o.id === key.organizationId)?.name ||
                      'Unknown'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {key.scopes.slice(0, 3).map((scope) => (
                      <span
                        key={scope}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400"
                      >
                        {scope}
                      </span>
                    ))}
                    {key.scopes.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
                        +{key.scopes.length - 3} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {key.usageCount.toLocaleString()}
                    </div>
                    {key.lastUsedAt && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Last: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {key.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 size={12} />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600">
                      <XCircle size={12} />
                      Revoked
                    </span>
                  )}
                  {key.expiresAt &&
                    new Date(key.expiresAt) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 ml-1">
                        <Clock size={12} />
                        Expiring soon
                      </span>
                    )}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleViewUsage(key.id)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                      title="View Usage"
                    >
                      <BarChart3 size={16} className="text-slate-400 dark:text-slate-500" />
                    </button>
                    {key.isActive && (
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Revoke Key"
                      >
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {apiKeys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="text-slate-500 dark:text-slate-400">
                    <KeyRound size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No API keys created yet</p>
                    <p className="text-sm">
                      Create your first API key to enable programmatic access
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsageTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          API Usage Analytics
        </h3>

        {selectedKeyForUsage && usageData ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {usageData.totals?.total_requests?.toLocaleString() || 0}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Total Requests (30 days)
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {Math.round(usageData.totals?.avg_response_time || 0)}ms
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Avg Response Time</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {usageData.totals?.total_errors || 0}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Errors</div>
              </div>
            </div>

            {/* Top Endpoints */}
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Top Endpoints</h4>
              <div className="space-y-2">
                {usageData.endpoints?.map((ep: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-navy-700"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          ep.method === 'GET'
                            ? 'bg-blue-500/10 text-blue-600'
                            : ep.method === 'POST'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : ep.method === 'PUT'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-red-500/10 text-red-600'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                        {ep.endpoint}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {ep.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
            <p>Select an API key to view its usage analytics</p>
          </div>
        )}
      </div>
    </div>
  );

  const fetchWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const result = await Api.get('/api/superadmin/webhooks');
      const raw = Array.isArray(result) ? result : (result as any)?.webhooks || [];
      setWebhooks(
        raw.map((w: any) => ({
          ...w,
          events: w.events || (w.events_json ? JSON.parse(w.events_json) : []),
          is_active: w.is_active !== false && w.is_active !== 0,
        }))
      );
    } catch {
      setWebhooks([]);
    } finally {
      setWebhooksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'webhooks' && webhooks.length === 0 && !webhooksLoading) {
      fetchWebhooks();
    }
  }, [activeTab]);

  const handleCreateWebhook = async () => {
    if (!webhookForm.name || !webhookForm.url) return;
    setCreatingWebhook(true);
    try {
      const events = webhookForm.events
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      await Api.post('/api/superadmin/webhooks', {
        name: webhookForm.name,
        url: webhookForm.url,
        events,
        secret: webhookForm.secret || undefined,
      });
      setShowCreateWebhook(false);
      setWebhookForm({ name: '', url: '', events: '', secret: '' });
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to create webhook:', error);
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    try {
      await Api.delete(`/api/superadmin/webhooks/${id}`);
      fetchWebhooks();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      await Api.post(`/api/superadmin/webhooks/${id}/test`, {});
      alert('Test event sent');
    } catch {
      alert('Test failed');
    }
  };

  const renderWebhooksTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Webhooks</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure outbound webhooks for real-time event notifications
            </p>
          </div>
          <button
            onClick={() => setShowCreateWebhook(true)}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <Plus size={16} />
            Add Webhook
          </button>
        </div>

        {webhooksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-violet-500" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Webhook size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No webhooks configured</p>
            <p className="text-sm">Create webhooks to receive real-time notifications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{wh.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        wh.is_active
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      {wh.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    {wh.url}
                  </div>
                  {wh.events && wh.events.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(wh.events as string[]).slice(0, 4).map((ev) => (
                        <span
                          key={ev}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400"
                        >
                          {ev}
                        </span>
                      ))}
                      {(wh.events as string[]).length > 4 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-navy-700 text-slate-500">
                          +{(wh.events as string[]).length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleTestWebhook(wh.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                    title="Send test event"
                  >
                    <Activity size={16} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteWebhook(wh.id)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete webhook"
                  >
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateWebhook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 dark:border-navy-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Webhook</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Configure an endpoint to receive event notifications
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  placeholder="My Webhook"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Events (comma-separated)
                </label>
                <input
                  type="text"
                  value={webhookForm.events}
                  onChange={(e) => setWebhookForm({ ...webhookForm, events: e.target.value })}
                  placeholder="user.created, subscription.updated, invoice.paid"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Signing Secret (optional)
                </label>
                <input
                  type="text"
                  value={webhookForm.secret}
                  onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                  placeholder="whsec_..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white font-mono text-sm"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-navy-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateWebhook(false)}
                className="px-4 py-2.5 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/20"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWebhook}
                disabled={creatingWebhook || !webhookForm.name || !webhookForm.url}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {creatingWebhook ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Webhook size={18} />
                )}
                Create Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 relative">
      <InfoButton cardId="settings-api-keys" position="top-right" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage API keys and integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton
            cardId="settings-api-keys"
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
          { id: 'keys', label: 'API Keys', icon: <KeyRound size={16} /> },
          { id: 'usage', label: 'Usage Analytics', icon: <BarChart3 size={16} /> },
          { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
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
          {activeTab === 'keys' && renderKeysTab()}
          {activeTab === 'usage' && renderUsageTab()}
          {activeTab === 'webhooks' && renderWebhooksTab()}
        </>
      )}

      {/* Create Key Modal */}
      <CreateKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleKeyCreated}
        organizations={organizations}
      />
    </div>
  );
};

export default APIManagementView;
