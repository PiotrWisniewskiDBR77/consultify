/**
 * EnterpriseApiManagement - Comprehensive API Key & Management Panel
 *
 * Features:
 * - API Key CRUD with scopes
 * - Rate limiting configuration
 * - Usage analytics & metrics
 * - API documentation
 * - Webhook management
 */

import {
  Activity,
  BarChart3,
  Check,
  ChevronRight,
  Code,
  Copy,
  Edit,
  ExternalLink,
  FileText,
  Globe,
  Key,
  Loader2,
  Lock,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { EmptyState, LoadingState } from '../../shared/states';

interface ApiKey {
  id: string;
  organizationId?: string;
  organizationName?: string;
  name: string;
  description?: string;
  key_prefix: string;
  key_type: 'org' | 'user' | 'service';
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  allowed_ips: string[];
  last_used_at?: string;
  usage_count: number;
  expires_at?: string;
  is_active: boolean;
  revoked_at?: string;
  created_at: string;
}

interface OrganizationOption {
  id: string;
  name: string;
}

type ApiKeyFormData = {
  organizationId: string;
  name: string;
  description: string;
  key_type: ApiKey['key_type'];
  scopes: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  allowed_ips: string[];
  expires_at: string | null;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const getString = (record: UnknownRecord, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
};

const getNumber = (record: UnknownRecord, keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

const getStringArray = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value))
      return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
};

const normalizeApiKeyList = (payload: unknown) => {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) {
    if (Array.isArray(payload.keys)) return payload.keys;
    if (Array.isArray(payload.apiKeys)) return payload.apiKeys;
    if (Array.isArray(payload.data)) return payload.data;
    if (isRecord(payload.data)) {
      const data = payload.data;
      if (Array.isArray(data.keys)) return data.keys;
      if (Array.isArray(data.apiKeys)) return data.apiKeys;
    }
  }
  throw new Error('API keys response was not a list');
};

const getCreatedApiKeyId = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  const key = isRecord(result.key) ? result.key : null;
  return String(result.id || key?.id || data?.id || (isRecord(data?.key) ? data.key.id : '') || '');
};

const getCreatedPlaintextKey = (result: unknown) => {
  if (!isRecord(result)) return '';
  const data = isRecord(result.data) ? result.data : null;
  return (
    getString(result, ['key', 'plaintextKey', 'apiKey']) ||
    (data ? getString(data, ['key', 'plaintextKey', 'apiKey']) : '')
  );
};

interface ApiKeyUsage {
  usage: Array<{
    date: string;
    requests: number;
    successful: number;
    failed: number;
    avg_response_time: number;
  }>;
  totals: {
    total_requests: number;
    avg_response_time: number;
    total_errors: number;
  };
  endpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
  }>;
}

interface Scope {
  id: string;
  name: string;
  description: string;
  category: string;
}

const AVAILABLE_SCOPES: Scope[] = [
  { id: 'read:users', name: 'Read Users', description: 'Read user information', category: 'Users' },
  { id: 'write:users', name: 'Write Users', description: 'Create/update users', category: 'Users' },
  {
    id: 'read:projects',
    name: 'Read Projects',
    description: 'Read project data',
    category: 'Projects',
  },
  {
    id: 'write:projects',
    name: 'Write Projects',
    description: 'Create/update projects',
    category: 'Projects',
  },
  {
    id: 'read:assessments',
    name: 'Read Assessments',
    description: 'Read assessments',
    category: 'Assessments',
  },
  {
    id: 'write:assessments',
    name: 'Write Assessments',
    description: 'Create/update assessments',
    category: 'Assessments',
  },
  { id: 'read:reports', name: 'Read Reports', description: 'Read reports', category: 'Reports' },
  {
    id: 'export:reports',
    name: 'Export Reports',
    description: 'Export reports to PDF/Excel',
    category: 'Reports',
  },
  { id: 'use:ai', name: 'Use AI', description: 'Access AI features', category: 'AI' },
  {
    id: 'read:ai_usage',
    name: 'Read AI Usage',
    description: 'View AI usage stats',
    category: 'AI',
  },
  {
    id: 'admin:billing',
    name: 'Admin Billing',
    description: 'Access billing data',
    category: 'Admin',
  },
  { id: 'admin:audit', name: 'Admin Audit', description: 'Access audit logs', category: 'Admin' },
  {
    id: 'manage:webhooks',
    name: 'Manage Webhooks',
    description: 'Create/manage webhooks',
    category: 'Integrations',
  },
];

const KEY_TYPE_CONFIG = {
  org: { label: 'Organization', color: 'bg-c-accent-soft text-c-accent' },
  user: { label: 'User', color: 'bg-c-info/20 text-c-info' },
  service: { label: 'Service', color: 'bg-c-success/20 text-c-success' },
};

export const EnterpriseApiManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'keys' | 'usage' | 'docs'>('keys');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [organizationsLoadError, setOrganizationsLoadError] = useState<string | null>(null);
  const [usageLoadError, setUsageLoadError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [selectedKeyUsage, setSelectedKeyUsage] = useState<{
    key: ApiKey;
    usage: ApiKeyUsage;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeyVisible, setNewKeyVisible] = useState<{ id: string; key: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizeApiKey = (raw: unknown): ApiKey => {
    const record = isRecord(raw) ? raw : {};
    const keyType = getString(record, ['key_type', 'keyType'], 'org') as ApiKey['key_type'];

    return {
      id: getString(record, ['id']),
      organizationId: getString(record, ['organizationId', 'organization_id']),
      organizationName: getString(record, ['organizationName', 'organization_name']),
      name: getString(record, ['name'], 'Unnamed API key'),
      description: getString(record, ['description']),
      key_prefix: getString(record, ['key_prefix', 'keyPrefix']),
      key_type: keyType === 'user' || keyType === 'service' ? keyType : 'org',
      scopes: getStringArray(record, ['scopes']),
      rate_limit_per_minute: getNumber(record, ['rate_limit_per_minute', 'rateLimitPerMinute'], 60),
      rate_limit_per_day: getNumber(record, ['rate_limit_per_day', 'rateLimitPerDay'], 10000),
      allowed_ips: getStringArray(record, ['allowed_ips', 'allowedIps']),
      last_used_at: getString(record, ['last_used_at', 'lastUsedAt']),
      usage_count: getNumber(record, ['usage_count', 'usageCount'], 0),
      expires_at: getString(record, ['expires_at', 'expiresAt']),
      is_active:
        record.is_active === undefined
          ? Boolean(record.isActive ?? true)
          : Boolean(record.is_active),
      revoked_at: getString(record, ['revoked_at', 'revokedAt']),
      created_at: getString(record, ['created_at', 'createdAt']),
    };
  };

  const normalizeUsage = (raw: unknown): ApiKeyUsage => {
    const record = isRecord(raw) ? raw : {};
    const usageRows = Array.isArray(record.usage)
      ? record.usage
      : Array.isArray(record.daily)
        ? record.daily
        : [];
    const totals = isRecord(record.totals) ? record.totals : {};

    return {
      usage: usageRows.map((day) => {
        const dayRecord = isRecord(day) ? day : {};
        const requests = getNumber(dayRecord, ['requests'], 0);
        const errors = getNumber(dayRecord, ['failed', 'errors'], 0);
        return {
          date: getString(dayRecord, ['date']),
          requests,
          successful: Math.max(0, requests - errors),
          failed: errors,
          avg_response_time: getNumber(dayRecord, ['avg_response_time'], 0),
        };
      }),
      totals: {
        total_requests: getNumber(totals, ['total_requests'], 0),
        avg_response_time: getNumber(totals, ['avg_response_time'], 0),
        total_errors: getNumber(totals, ['total_errors'], 0),
      },
      endpoints: (Array.isArray(record.endpoints) ? record.endpoints : []).map((endpoint) => {
        const endpointRecord = isRecord(endpoint) ? endpoint : {};
        return {
          endpoint: getString(endpointRecord, ['endpoint']),
          method: getString(endpointRecord, ['method'], 'GET'),
          count: getNumber(endpointRecord, ['count', 'requests'], 0),
        };
      }),
    };
  };

  const formatDate = (value?: string) => {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
  };

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await Api.get('/superadmin/api-keys');
      const normalized = normalizeApiKeyList(data).map(normalizeApiKey);
      setApiKeys(normalized);
      return normalized;
    } catch (error: unknown) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to load API keys'));
      setApiKeys([]);
      toast.error(normalizeApiErrorMessage(error, 'Failed to load API keys'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrganizations = useCallback(async () => {
    try {
      setOrganizationsLoadError(null);
      const data = await Api.getOrganizations();
      const dataRecord: UnknownRecord = isRecord(data) ? data : {};
      const list = Array.isArray(data) ? data : dataRecord.organizations;
      setOrganizations(
        (Array.isArray(list) ? list : [])
          .map((org) => {
            const orgRecord = isRecord(org) ? org : {};
            return {
              id: getString(orgRecord, ['id']),
              name: getString(orgRecord, ['name', 'id']),
            };
          })
          .filter((org) => org.id)
      );
    } catch (error: unknown) {
      setOrganizations([]);
      setOrganizationsLoadError(
        normalizeApiErrorMessage(error, 'Organizations are required to create API keys')
      );
    }
  }, []);

  useEffect(() => {
    void fetchApiKeys();
    void fetchOrganizations();
  }, [fetchApiKeys, fetchOrganizations]);

  const handleCreateKey = async (formData: ApiKeyFormData) => {
    try {
      setActionError(null);
      if (editingKey) {
        toast.error(
          'API key editing is read-only until the superadmin update workflow is connected'
        );
        return;
      } else {
        const result = await Api.post('/superadmin/api-keys', {
          organizationId: formData.organizationId,
          name: formData.name,
          description: formData.description,
          keyType: formData.key_type,
          scopes: formData.scopes,
          rateLimitPerMinute: formData.rate_limit_per_minute,
          rateLimitPerDay: formData.rate_limit_per_day,
          allowedIps: formData.allowed_ips,
          expiresAt: formData.expires_at,
        });
        const createdId = getCreatedApiKeyId(result);
        const plaintextKey = getCreatedPlaintextKey(result);
        if (!createdId || !plaintextKey) {
          throw new Error('API key creation response was incomplete');
        }
        const refreshed = await fetchApiKeys();
        if (!refreshed?.some((key) => key.id === createdId)) {
          throw new Error('API key creation was not confirmed by the server');
        }
        setNewKeyVisible({ id: createdId, key: plaintextKey });
      }
      toast.success('API key saved successfully');
      setShowCreateModal(false);
      setEditingKey(null);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to save API key');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.'))
      return;

    try {
      setActionError(null);
      await Api.delete(`/superadmin/api-keys/${id}`);
      const refreshed = await fetchApiKeys();
      if (
        !refreshed ||
        refreshed.some((key) => key.id === id && !key.revoked_at && key.is_active)
      ) {
        throw new Error('API key revoke was not confirmed by the server');
      }
      toast.success('API key revoked');
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to revoke API key');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleViewUsage = async (key: ApiKey) => {
    try {
      setUsageLoadError(null);
      const usage = await Api.get(`/superadmin/api-keys/${key.id}/usage`);
      setSelectedKeyUsage({ key, usage: normalizeUsage(usage) });
      setActiveTab('usage');
    } catch (error: unknown) {
      setUsageLoadError(normalizeApiErrorMessage(error, 'Failed to load usage data'));
      setSelectedKeyUsage(null);
      toast.error(normalizeApiErrorMessage(error, 'Failed to load usage data'));
    }
  };

  const handleCopyKey = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredKeys = apiKeys.filter(
    (key) =>
      key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.key_prefix.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text">API Management</h2>
          <p className="text-c-text-secondary text-sm">
            Manage API keys, view usage analytics, and access documentation
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!!loadError || !!organizationsLoadError || organizations.length === 0}
          title={loadError || organizationsLoadError || undefined}
          className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger/30 bg-c-danger/5 p-4 text-sm text-c-danger"
        >
          {actionError}
        </div>
      )}

      {/* New Key Alert */}
      {newKeyVisible && (
        <div className="p-4 bg-c-success/10 border border-c-success/30 rounded-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-c-success mt-0.5" />
              <div>
                <h4 className="font-medium text-c-success">API Key Created Successfully</h4>
                <p className="text-sm text-c-text-secondary mt-1 mb-3">
                  Save this key now - it won't be shown again!
                </p>
                <div className="flex items-center gap-2 p-3 bg-c-surface-raised rounded-lg">
                  <code className="text-sm text-c-text font-mono flex-1 break-all">
                    {newKeyVisible.key}
                  </code>
                  <button
                    onClick={() => handleCopyKey(newKeyVisible.key)}
                    className="p-2 hover:bg-c-surface-raised rounded"
                  >
                    {copiedKey === newKeyVisible.key ? (
                      <Check className="w-4 h-4 text-c-success" />
                    ) : (
                      <Copy className="w-4 h-4 text-c-text-secondary" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setNewKeyVisible(null)}
              className="p-1 hover:bg-c-surface-raised rounded"
            >
              <X className="w-4 h-4 text-c-text-secondary" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle pb-1">
        {[
          { id: 'keys', label: 'API Keys', icon: Key },
          { id: 'usage', label: 'Usage Analytics', icon: BarChart3 },
          { id: 'docs', label: 'Documentation', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as 'keys' | 'usage' | 'docs')}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? 'bg-c-surface-raised text-c-text border-b-2 border-c-accent'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Keys Tab */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-c-text-muted"
              size={16}
            />
            <input
              type="text"
              placeholder="Search API keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!!loadError}
              className="w-full pl-10 pr-4 py-2 bg-c-surface border border-c-border rounded-lg text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </div>

          {/* Keys List */}
          {loading ? (
            <LoadingState template="list" />
          ) : loadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState title="API keys unavailable" description={loadError} />
            </div>
          ) : filteredKeys.length === 0 ? (
            <EmptyState
              variant="new"
              icon={Key}
              title="No API keys found"
              description="Create your first API key to get started."
            />
          ) : (
            <div className="space-y-2">
              {filteredKeys.map((key) => (
                <div
                  key={key.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    key.revoked_at
                      ? 'bg-c-danger/5 border-c-danger/20 opacity-60'
                      : 'bg-c-surface border-c-border hover:border-c-border-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-lg ${key.revoked_at ? 'bg-c-danger/20' : 'bg-c-accent-soft'}`}
                      >
                        {key.revoked_at ? (
                          <Lock className="w-5 h-5 text-c-danger" />
                        ) : (
                          <Key className="w-5 h-5 text-c-accent" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-c-text">
                            {key.name}
                          </span>
                          <code className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded font-mono">
                            {key.key_prefix}...
                          </code>
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${KEY_TYPE_CONFIG[key.key_type].color}`}
                          >
                            {KEY_TYPE_CONFIG[key.key_type].label}
                          </span>
                          {key.revoked_at && (
                            <span className="px-2 py-0.5 text-xs bg-c-danger/20 text-c-danger rounded">
                              Revoked
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-c-text-muted mt-1">
                          <span>{key.scopes.length} scopes</span>
                          <span>•</span>
                          {key.organizationName && (
                            <>
                              <span>•</span>
                              <span>{key.organizationName}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{key.rate_limit_per_minute}/min</span>
                          <span>•</span>
                          <span>{key.usage_count.toLocaleString()} requests</span>
                          {key.last_used_at && (
                            <>
                              <span>•</span>
                              <span>Last used: {formatDate(key.last_used_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!key.revoked_at && (
                        <>
                          <button
                            onClick={() => handleViewUsage(key)}
                            className="p-2 hover:bg-c-surface-raised rounded-lg transition-colors"
                            title="View Usage"
                          >
                            <BarChart3 className="w-4 h-4 text-c-text-secondary" />
                          </button>
                          <button
                            disabled
                            className="p-2 rounded-lg opacity-50 cursor-not-allowed"
                            title="API key editing requires an audited superadmin update workflow."
                          >
                            <Edit className="w-4 h-4 text-c-text-secondary" />
                          </button>
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="p-2 hover:bg-c-danger/20 rounded-lg transition-colors"
                            title="Revoke"
                          >
                            <Trash2 className="w-4 h-4 text-c-danger" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Scopes Preview */}
                  <div className="mt-3 pt-3 border-t border-c-border-subtle">
                    <div className="flex flex-wrap gap-1">
                      {key.scopes.slice(0, 5).map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded"
                        >
                          {scope}
                        </span>
                      ))}
                      {key.scopes.length > 5 && (
                        <span className="text-xs text-c-text-muted">
                          +{key.scopes.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Usage Analytics Tab */}
      {activeTab === 'usage' && (
        <div className="space-y-6">
          {loadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState
                title="API key usage unavailable"
                description="API key usage cannot be inspected because the API key list did not load."
              />
            </div>
          ) : usageLoadError ? (
            <div className="rounded-xl border border-c-border bg-c-surface p-6">
              <DegradedState title="API key usage unavailable" description={usageLoadError} />
            </div>
          ) : selectedKeyUsage ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedKeyUsage(null)}
                    className="p-2 hover:bg-c-surface-raised rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4 text-c-text-secondary rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-lg font-medium text-c-text">{selectedKeyUsage.key.name}</h3>
                    <code className="text-sm text-c-text-muted">
                      {selectedKeyUsage.key.key_prefix}...
                    </code>
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
                  <div className="text-sm text-c-text-secondary">Total Requests</div>
                  <div className="text-2xl font-bold text-c-text">
                    {selectedKeyUsage.usage.totals?.total_requests?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
                  <div className="text-sm text-c-text-secondary">
                    Avg Response Time
                  </div>
                  <div className="text-2xl font-bold text-c-text">
                    {Math.round(selectedKeyUsage.usage.totals?.avg_response_time || 0)}ms
                  </div>
                </div>
                <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
                  <div className="text-sm text-c-text-secondary">Error Rate</div>
                  <div className="text-2xl font-bold text-c-text">
                    {selectedKeyUsage.usage.totals?.total_requests
                      ? (
                          (selectedKeyUsage.usage.totals.total_errors /
                            selectedKeyUsage.usage.totals.total_requests) *
                          100
                        ).toFixed(2)
                      : 0}
                    %
                  </div>
                </div>
                <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
                  <div className="text-sm text-c-text-secondary">Total Errors</div>
                  <div className="text-2xl font-bold text-c-danger">
                    {selectedKeyUsage.usage.totals?.total_errors || 0}
                  </div>
                </div>
              </div>

              {/* Usage Chart */}
              <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
                <h4 className="text-sm font-medium text-c-text mb-4">Requests Over Time</h4>
                <div className="flex items-end gap-2 h-32">
                  {selectedKeyUsage.usage.usage?.length > 0 ? (
                    selectedKeyUsage.usage.usage.map((day, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-c-accent rounded-t-sm"
                          style={{
                            height: `${Math.max(5, (day.requests / Math.max(1, ...selectedKeyUsage.usage.usage.map((d) => d.requests))) * 100)}%`,
                          }}
                        />
                        <div className="text-xs text-c-text-muted mt-2">
                          {formatDate(day.date)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="w-full text-center text-c-text-secondary">
                      No usage data
                    </div>
                  )}
                </div>
              </div>

              {/* Top Endpoints */}
              {selectedKeyUsage.usage.endpoints?.length > 0 && (
                <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
                  <h4 className="text-sm font-medium text-c-text mb-4">Top Endpoints</h4>
                  <div className="space-y-2">
                    {selectedKeyUsage.usage.endpoints.map((endpoint, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-c-surface rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-mono rounded ${
                              endpoint.method === 'GET'
                                ? 'bg-c-info/20 text-c-info'
                                : endpoint.method === 'POST'
                                  ? 'bg-c-success/20 text-c-success'
                                  : endpoint.method === 'PUT'
                                    ? 'bg-c-warning/20 text-c-warning'
                                    : 'bg-c-danger/20 text-c-danger'
                            }`}
                          >
                            {endpoint.method}
                          </span>
                          <code className="text-sm text-c-text-secondary">{endpoint.endpoint}</code>
                        </div>
                        <span className="text-sm text-c-text-secondary">
                          {endpoint.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-c-text-secondary">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select an API key to view usage analytics</p>
              <button
                onClick={() => setActiveTab('keys')}
                className="mt-4 px-4 py-2 bg-c-surface-raised hover:bg-c-surface text-c-text rounded-lg transition-colors"
              >
                Go to API Keys
              </button>
            </div>
          )}
        </div>
      )}

      {/* Documentation Tab */}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className="p-6 bg-c-accent-soft rounded-xl border border-c-accent/20">
            <h3 className="text-xl font-bold text-c-text mb-2">Consultify API</h3>
            <p className="text-c-text-secondary mb-4">
              Build powerful integrations with the Consultify REST API. Access projects,
              assessments, reports, and more.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                View API Docs
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised hover:bg-c-surface text-c-text rounded-lg transition-colors"
              >
                <Code className="w-4 h-4" />
                OpenAPI Spec
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
              <h4 className="font-medium text-c-text mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-c-accent" />
                Authentication
              </h4>
              <p className="text-sm text-c-text-secondary mb-3">
                All API requests require authentication using an API key in the Authorization
                header.
              </p>
              <div className="p-3 bg-c-surface rounded-lg">
                <code className="text-sm text-c-info">Authorization: Bearer ck_live_xxx...</code>
              </div>
            </div>

            <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
              <h4 className="font-medium text-c-text mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-c-warning" />
                Rate Limits
              </h4>
              <p className="text-sm text-c-text-secondary mb-3">
                API requests are rate limited based on your key configuration.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-c-text-secondary">Default per minute:</span>
                  <span className="text-c-text">60 requests</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-c-text-secondary">Default per day:</span>
                  <span className="text-c-text">10,000 requests</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
              <h4 className="font-medium text-c-text mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-c-success" />
                Base URL
              </h4>
              <div className="p-3 bg-c-surface rounded-lg">
                <code className="text-sm text-c-success">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1
                </code>
              </div>
            </div>

            <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
              <h4 className="font-medium text-c-text mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-c-info" />
                Response Format
              </h4>
              <p className="text-sm text-c-text-secondary mb-3">
                All responses are returned in JSON format.
              </p>
              <div className="p-3 bg-c-surface rounded-lg">
                <pre className="text-sm text-c-info">
                  {`{
  "success": true,
  "data": { ... }
}`}
                </pre>
              </div>
            </div>
          </div>

          <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border">
            <h4 className="font-medium text-c-text mb-4">Available Scopes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <div key={scope.id} className="p-3 bg-c-surface rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-sm text-c-info">{scope.id}</code>
                    <span className="text-xs text-c-text-muted">
                      {scope.category}
                    </span>
                  </div>
                  <p className="text-xs text-c-text-secondary">{scope.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingKey) && (
        <ApiKeyModal
          key={editingKey?.id}
          editKey={editingKey}
          onClose={() => {
            setShowCreateModal(false);
            setEditingKey(null);
          }}
          onSave={handleCreateKey}
          availableScopes={AVAILABLE_SCOPES}
          organizations={organizations}
        />
      )}
    </div>
  );
};

// API Key Modal Component
const ApiKeyModal: React.FC<{
  editKey?: ApiKey | null;
  onClose: () => void;
  onSave: (data: ApiKeyFormData) => void;
  availableScopes: Scope[];
  organizations: OrganizationOption[];
}> = ({ editKey, onClose, onSave, availableScopes, organizations }) => {
  const [formData, setFormData] = useState({
    organizationId: editKey?.organizationId || organizations[0]?.id || '',
    name: editKey?.name || '',
    description: editKey?.description || '',
    key_type: editKey?.key_type || 'org',
    scopes: editKey?.scopes || [],
    rate_limit_per_minute: editKey?.rate_limit_per_minute || 60,
    rate_limit_per_day: editKey?.rate_limit_per_day || 10000,
    allowed_ips: editKey?.allowed_ips?.join(', ') || '',
    expires_at: editKey?.expires_at ? editKey.expires_at.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...formData,
        allowed_ips: formData.allowed_ips
          ? formData.allowed_ips.split(',').map((ip) => ip.trim())
          : [],
        expires_at: formData.expires_at || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleScope = (scopeId: string) => {
    setFormData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scopeId)
        ? prev.scopes.filter((s) => s !== scopeId)
        : [...prev.scopes, scopeId],
    }));
  };

  const scopesByCategory = availableScopes.reduce(
    (acc, scope) => {
      if (!acc[scope.category]) acc[scope.category] = [];
      acc[scope.category].push(scope);
      return acc;
    },
    {} as Record<string, Scope[]>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-c-surface rounded-xl border border-c-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-c-text">
            {editKey ? 'Edit API Key' : 'Create API Key'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-c-surface-raised rounded-lg"
          >
            <X className="w-5 h-5 text-c-text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">Organization *</label>
            <select
              required
              value={formData.organizationId}
              disabled={!!editKey}
              onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              placeholder="My API Key"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">Key Type</label>
              <select
                value={formData.key_type}
                onChange={(e) =>
                  setFormData({ ...formData, key_type: e.target.value as ApiKey['key_type'] })
                }
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              >
                <option value="org">Organization</option>
                <option value="user">User</option>
                <option value="service">Service</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">Expires</label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Rate Limit (per minute)
              </label>
              <input
                type="number"
                value={formData.rate_limit_per_minute}
                onChange={(e) =>
                  setFormData({ ...formData, rate_limit_per_minute: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                Rate Limit (per day)
              </label>
              <input
                type="number"
                value={formData.rate_limit_per_day}
                onChange={(e) =>
                  setFormData({ ...formData, rate_limit_per_day: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              Allowed IPs (comma separated)
            </label>
            <input
              type="text"
              value={formData.allowed_ips}
              onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
              className="w-full px-3 py-2 bg-c-surface-raised border border-c-border rounded-lg text-c-text"
              placeholder="Leave empty for all IPs"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-2">Scopes</label>
            <div className="space-y-4 max-h-60 overflow-y-auto p-2 bg-c-surface-raised rounded-lg">
              {Object.entries(scopesByCategory).map(([category, scopes]) => (
                <div key={category}>
                  <div className="text-xs text-c-text-muted mb-2">{category}</div>
                  <div className="flex flex-wrap gap-2">
                    {scopes.map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => toggleScope(scope.id)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          formData.scopes.includes(scope.id)
                            ? 'bg-c-surface text-c-text'
                            : 'bg-c-surface text-c-text-secondary hover:bg-c-surface-raised'
                        }`}
                      >
                        {scope.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-c-text-secondary hover:text-c-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editKey ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnterpriseApiManagement;
