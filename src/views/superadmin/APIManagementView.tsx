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
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Webhook,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState, ReadOnlyState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

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

interface APIManagementSnapshot {
  keys: APIKey[];
  organizations: { id: string; name: string }[];
  keysLoaded: boolean;
}

type RawAPIKey = Omit<Partial<APIKey>, 'isActive'> & {
  isActive?: boolean | number | string;
  key_prefix?: string;
  key_type?: APIKey['keyType'];
  allowed_ips?: string[];
  usage_count?: number | string;
  rate_limit_per_minute?: number | string;
  rate_limit_per_day?: number | string;
  last_used_at?: string;
  expires_at?: string;
  created_at?: string;
};

type ExpirationOption = 'never' | '30d' | '90d' | '1y';

interface UsageData {
  totals?: {
    total_requests?: number;
    avg_response_time?: number;
    total_errors?: number;
  };
  endpoints?: Array<{
    method: string;
    endpoint: string;
    count: number;
  }>;
}

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (key: { id: string; key: string; name: string }) => Promise<void>;
  organizations: { id: string; name: string }[];
}

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

const webhookWorkflowUnavailableReason =
  'Webhook management is disabled until the superadmin webhook routes are reconciled with one audited backend workflow.';

function formatDate(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleDateString();
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

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

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => Array.isArray(value[key])) ||
    Boolean(
      data &&
      (Array.isArray(data.data) ||
        keys.some((key) => Array.isArray(data[key])) ||
        Boolean(nestedData && keys.some((key) => Array.isArray(nestedData[key]))))
    )
  );
};

function formatInteger(value: unknown): string {
  return Math.round(safeNumber(value)).toLocaleString();
}

function parseScopes(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeApiKeys(rawKeys: RawAPIKey[]): APIKey[] {
  return rawKeys.map((k) => ({
    ...k,
    id: k.id || '',
    organizationId: k.organizationId || '',
    name: k.name || '',
    keyPrefix: k.keyPrefix || k.key_prefix || '',
    keyType: k.keyType || k.key_type || 'org',
    scopes: parseScopes(k.scopes),
    allowedIps: Array.isArray(k.allowedIps) ? k.allowedIps : k.allowed_ips || [],
    usageCount: Number(k.usageCount ?? k.usage_count) || 0,
    rateLimitPerMinute: Number(k.rateLimitPerMinute ?? k.rate_limit_per_minute) || 60,
    rateLimitPerDay: Number(k.rateLimitPerDay ?? k.rate_limit_per_day) || 10000,
    lastUsedAt: k.lastUsedAt || k.last_used_at,
    expiresAt: k.expiresAt || k.expires_at,
    createdAt: k.createdAt || k.created_at || '',
    isActive: k.isActive === true || k.isActive === 1 || k.isActive === '1',
  }));
}

function keyMatchesCreate(key: APIKey, expected: { id?: string; name: string }) {
  return !!expected.id && key.id === expected.id;
}

function normalizeCreatedKeyPayload(result: unknown) {
  const payload = getObjectPayload(result);
  return {
    id: isRecord(payload) ? String(payload.id || '') : '',
    key: isRecord(payload) ? String(payload.key || '') : '',
    name: isRecord(payload) ? String(payload.name || '') : '',
  };
}

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
  const [expiresIn, setExpiresIn] = useState<ExpirationOption>('never');
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

      const createdKey = normalizeCreatedKeyPayload(result);
      if (!createdKey.id || !createdKey.key || !createdKey.name) {
        throw new Error('API key creation response was incomplete');
      }
      await onCreated(createdKey);
      toast.success('API key created');
    } catch (error) {
      toast.error(normalizeApiErrorMessage(error, 'Failed to create API key'));
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
                  className="w-4 h-4 text-primary-600"
                />
                <Building2 size={16} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Organization Key</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={keyType === 'service'}
                  onChange={() => setKeyType('service')}
                  className="w-4 h-4 text-primary-600"
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
                    className="text-sm font-medium text-slate-900 dark:text-white mb-2 hover:text-primary-600 dark:hover:text-primary-400"
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
                          className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600"
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
                onChange={(e) => setExpiresIn(e.target.value as ExpirationOption)}
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
            className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Create Key
          </button>
        </div>
      </div>
    </div>
  );
};

type TabType = 'keys' | 'usage' | 'webhooks';

export const APIManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('keys');
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [organizationsLoadError, setOrganizationsLoadError] = useState<string | null>(null);
  const [usageLoadError, setUsageLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    id: string;
    key: string;
    name: string;
  } | null>(null);
  const [selectedKeyForUsage, setSelectedKeyForUsage] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [keyPendingRevoke, setKeyPendingRevoke] = useState<APIKey | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setOrganizationsLoadError(null);
    setActionError(null);
    let keys: APIKey[] = [];
    let organizationsSnapshot: { id: string; name: string }[] = [];
    let keysLoaded = false;
    try {
      const [keysResult, orgsResult] = await Promise.allSettled([
        Api.get('/api/superadmin/api-keys'),
        Api.getOrganizations(),
      ]);

      if (keysResult.status === 'fulfilled') {
        if (!hasListShape(keysResult.value, ['keys', 'items'])) {
          setApiKeys([]);
          setLoadError('API keys response was not a list');
        } else {
          const rawKeys = getListPayload<RawAPIKey>(keysResult.value, ['keys', 'items']);
          keys = normalizeApiKeys(rawKeys);
          keysLoaded = true;
          setApiKeys(keys);
        }
      } else {
        setApiKeys([]);
        setLoadError(normalizeApiErrorMessage(keysResult.reason, 'Failed to fetch API keys'));
      }

      if (orgsResult.status === 'fulfilled') {
        if (!hasListShape(orgsResult.value, ['organizations', 'items'])) {
          setOrganizations([]);
          setOrganizationsLoadError('Organizations response was not a list');
        } else {
          organizationsSnapshot = getListPayload<{ id: string; name: string }>(orgsResult.value, [
            'organizations',
            'items',
          ]);
          setOrganizations(organizationsSnapshot);
        }
      } else {
        setOrganizations([]);
        setOrganizationsLoadError(
          normalizeApiErrorMessage(orgsResult.reason, 'Failed to fetch organizations')
        );
      }
      return {
        keys,
        organizations: organizationsSnapshot,
        keysLoaded,
      } satisfies APIManagementSnapshot;
    } catch (error) {
      setApiKeys([]);
      setOrganizations([]);
      setLoadError(normalizeApiErrorMessage(error, 'Failed to fetch API keys'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleKeyCreated = async (key: { id: string; key: string; name: string }) => {
    setActionError(null);
    const refreshed = await fetchData();
    if (
      !refreshed?.keysLoaded ||
      !refreshed.keys.some((refreshedKey) => keyMatchesCreate(refreshedKey, key))
    ) {
      const message = 'API key creation was not confirmed by the server';
      setActionError(message);
      throw new Error(message);
    }
    setNewlyCreatedKey(key);
    setShowCreateModal(false);
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await Api.delete(`/api/superadmin/api-keys/${keyId}`);
      const refreshed = await fetchData();
      if (
        !refreshed ||
        !refreshed.keysLoaded ||
        refreshed.keys.some((key) => key.id === keyId && key.isActive)
      ) {
        throw new Error('API key revoke was not confirmed by the server');
      }
      toast.success('API key revoked');
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to revoke key');
      setActionError(message);
      toast.error(message);
    } finally {
      setKeyPendingRevoke(null);
    }
  };

  const handleViewUsage = async (keyId: string) => {
    setSelectedKeyForUsage(keyId);
    setUsageData(null);
    setUsageLoadError(null);
    try {
      const result = await Api.get(`/api/superadmin/api-keys/${keyId}/usage`);
      setUsageData(result);
    } catch (error) {
      setUsageLoadError(normalizeApiErrorMessage(error, 'Failed to fetch API key usage'));
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
              <CheckCircle2 className="text-c-text" size={20} />
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

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-danger-600 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {/* Stats */}
      {loadError ? (
        <DegradedState title="API keys unavailable" description={loadError} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <KeyRound className="text-primary-500" size={20} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {stats.total}
                  </div>
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
              disabled={!!loadError || !!organizationsLoadError || organizations.length === 0}
              title={
                loadError ||
                organizationsLoadError ||
                (organizations.length === 0
                  ? 'No organizations available for API key creation'
                  : 'Create API Key')
              }
              className="px-4 py-2.5 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2"
            >
              <Plus size={18} />
              Create API Key
            </button>
          </div>
          {organizationsLoadError && (
            <DegradedState title="Organizations unavailable" description={organizationsLoadError} />
          )}

          {/* Keys Table */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <table
              /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
            >
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
                                ? 'bg-primary-500/10 text-primary-600'
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
                            Last: {formatDate(key.lastUsedAt)}
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger-500/10 text-danger-600">
                          <XCircle size={12} />
                          Revoked
                        </span>
                      )}
                      {key.expiresAt &&
                        !Number.isNaN(new Date(key.expiresAt).getTime()) &&
                        new Date(key.expiresAt) <
                          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) && (
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
                          aria-label={`View usage for API key ${key.id}`}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                          title="View Usage"
                        >
                          <BarChart3 size={16} className="text-slate-600 dark:text-slate-500" />
                        </button>
                        {key.isActive && (
                          <button
                            onClick={() => setKeyPendingRevoke(key)}
                            aria-label={`Revoke API key ${key.id}`}
                            className="p-2 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-lg transition-colors"
                            title="Revoke Key"
                          >
                            <Trash2 size={16} className="text-danger-400" />
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
        </>
      )}
    </div>
  );

  const renderUsageTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-navy-800 rounded-xl p-6 border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          API Usage Analytics
        </h3>

        {loadError ? (
          <DegradedState title="API key usage unavailable" description={loadError} />
        ) : usageLoadError ? (
          <DegradedState title="API key usage unavailable" description={usageLoadError} />
        ) : selectedKeyForUsage && usageData ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatInteger(usageData.totals?.total_requests)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Total Requests (30 days)
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatInteger(usageData.totals?.avg_response_time)}ms
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Avg Response Time</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
                <div className="text-2xl font-bold text-danger-600">
                  {formatInteger(usageData.totals?.total_errors)}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Errors</div>
              </div>
            </div>

            {/* Top Endpoints */}
            <div>
              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Top Endpoints</h4>
              <div className="space-y-2">
                {usageData.endpoints?.map((ep, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-navy-700"
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
                                : 'bg-danger-500/10 text-danger-600'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                        {ep.endpoint}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatInteger(ep.count)}
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
            disabled
            title={webhookWorkflowUnavailableReason}
            className="px-4 py-2 bg-c-text text-c-bg rounded-lg font-medium flex items-center gap-2 opacity-50 cursor-not-allowed"
          >
            <Plus size={16} />
            Add Webhook
          </button>
        </div>

        <ReadOnlyState
          title="Webhook management unavailable"
          description={webhookWorkflowUnavailableReason}
        />
      </div>
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
              className={`text-slate-600 dark:text-slate-500 ${loading ? 'animate-spin' : ''}`}
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
                ? 'bg-white dark:bg-navy-800 text-[var(--c-info)] shadow-sm'
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
          <Loader2 size={32} className="animate-spin text-primary-500" />
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
      {keyPendingRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-navy-700 dark:bg-navy-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Revoke API key?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              This will revoke <span className="font-medium">{keyPendingRevoke.name}</span>. The
              secret cannot be used after revocation.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setKeyPendingRevoke(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRevokeKey(keyPendingRevoke.id)}
                className="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700"
              >
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default APIManagementView;
