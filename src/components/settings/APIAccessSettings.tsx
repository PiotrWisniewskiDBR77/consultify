/**
 * APIAccessSettings - Enhanced API access and key management
 *
 * Features:
 * - Rate limits per key
 * - Usage quotas with progress bars
 * - Usage dashboard with charts
 * - Key rotation workflow
 * - IP whitelisting
 * - Scopes/permissions selector
 * - Expiration date management
 */

import {
  BarChart3,
  Calendar,
  Copy,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Banner } from '@/components/shared/Banner';
import { EmptyState } from '@/components/ui/composed';
import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';

interface APIKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsed?: string;
  rateLimit?: number;
  quotaLimit?: number;
  quotaUsed?: number;
  quotaResetAt?: string;
  expiresAt?: string;
  ipWhitelist?: string[];
  scopes?: string[];
  usage?: {
    requests: number;
    period: string;
  }[];
}

interface APIAccessSettingsProps {
  className?: string;
  currentUser?: unknown;
}

type ApiKeyRow = {
  id?: string;
  name?: string;
  keyPrefix?: string;
  createdAt?: string;
  lastUsedAt?: string;
  rateLimit?: number;
  expiresAt?: string;
  permissions?: string[] | string;
};

const AVAILABLE_SCOPES = [
  { id: 'read', name: 'Read', description: 'Read-only access' },
  { id: 'write', name: 'Write', description: 'Create and update resources' },
  { id: 'delete', name: 'Delete', description: 'Delete resources' },
  { id: 'admin', name: 'Admin', description: 'Full administrative access' },
];

export const APIAccessSettings: React.FC<APIAccessSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [keyUsage, setKeyUsage] = useState<Record<string, any>>({});
  const [rotatingKey, setRotatingKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Settings form state
  const [keySettings, setKeySettings] = useState<
    Record<
      string,
      {
        rateLimit: string;
        quotaLimit: string;
        expiresAt: string;
        ipWhitelist: string;
        scopes: string[];
      }
    >
  >({});

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      fetchKeyUsage(selectedKey);
    }
  }, [selectedKey]);

  const normalizePermissions = (permissions: ApiKeyRow['permissions']) => {
    if (Array.isArray(permissions)) return permissions;
    if (typeof permissions !== 'string') return [];
    try {
      const parsed = JSON.parse(permissions || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  const normalizeApiKeys = (rows: unknown): APIKey[] =>
    Array.isArray(rows)
      ? rows
          .map((k: ApiKeyRow) => ({
            id: String(k.id || ''),
            name: String(k.name || ''),
            prefix: String(k.keyPrefix || ''),
            createdAt: String(k.createdAt || ''),
            lastUsed: k.lastUsedAt,
            rateLimit: k.rateLimit,
            expiresAt: k.expiresAt,
            scopes: normalizePermissions(k.permissions),
          }))
          .filter((key) => key.id)
      : [];

  const stringArraysMatch = (left: string[] = [], right: string[] = []) =>
    left.length === right.length && left.every((item) => right.includes(item));

  const keySettingsMatch = (
    key: APIKey | undefined,
    settings: {
      rateLimit: string;
      scopes: string[];
    }
  ) => {
    if (!key) return false;
    const expectedRateLimit = settings.rateLimit ? parseInt(settings.rateLimit) : undefined;
    const actualRateLimit = key.rateLimit ?? undefined;
    return (
      actualRateLimit === expectedRateLimit && stringArraysMatch(key.scopes || [], settings.scopes)
    );
  };

  const fetchKeys = async (): Promise<APIKey[] | null> => {
    setLoadingKeys(true);
    try {
      setLoadError(null);
      const response = await Api.get('/api/settings/api-keys');
      const data = response?.data?.keys || [];
      const mappedKeys = normalizeApiKeys(data);
      setKeys(mappedKeys);
      const settings: Record<string, any> = {};
      mappedKeys.forEach((key: APIKey) => {
        settings[key.id] = {
          rateLimit: key.rateLimit?.toString() || '',
          quotaLimit: key.quotaLimit?.toString() || '',
          expiresAt: key.expiresAt || '',
          ipWhitelist: (key.ipWhitelist || []).join('\n'),
          scopes: key.scopes || [],
        };
      });
      setKeySettings(settings);
      return mappedKeys;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.api.loadError', 'Failed to load API keys')
      );
      setLoadError(message);
      toast.error(message);
      setKeys([]);
      setKeySettings({});
      return null;
    } finally {
      setLoadingKeys(false);
    }
  };

  const fetchKeyUsage = async (keyId: string) => {
    try {
      const res = await Api.get(`/api/settings/api-keys/${keyId}/usage`);
      setKeyUsage((prev) => ({ ...prev, [keyId]: res?.data }));
    } catch (error) {
      console.error('Failed to load API key usage:', error);
      // Set empty usage data instead of mock
      setKeyUsage((prev) => ({
        ...prev,
        [keyId]: {
          requests: [],
          period: '7d',
        },
      }));
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      setActionError(null);
      const response = await Api.post('/api/settings/api-keys', { name: newKeyName });
      const payload = response?.data;

      if (payload?.key) {
        const refreshed = await fetchKeys();
        const confirmed = refreshed?.some(
          (key) => key.id === payload.key.id || key.prefix === payload.key.keyPrefix
        );
        if (!confirmed) {
          throw new Error('API key creation was not confirmed by the server');
        }
        setNewKey(payload.key.key);
        toast.success(t('settings.api.keyCreated', 'API key created'));
        setNewKeyName('');
        setShowNew(false);
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.api.createError', 'Failed to create API key')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm(t('settings.api.deleteConfirm', 'Are you sure you want to delete this API key?')))
      return;

    try {
      setActionError(null);
      await Api.delete(`/api/settings/api-keys/${keyId}`);
      const refreshed = await fetchKeys();
      if (!refreshed || refreshed.some((key) => key.id === keyId)) {
        throw new Error('API key deletion was not confirmed by the server');
      }
      toast.success(t('settings.api.keyDeleted', 'API key deleted'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.api.deleteError', 'Failed to delete key')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  const rotateKey = async (keyId: string) => {
    if (
      !confirm(
        t(
          'settings.api.rotateConfirm',
          'Are you sure you want to rotate this key? The old key will be revoked immediately.'
        )
      )
    ) {
      return;
    }

    setRotatingKey(keyId);
    try {
      setActionError(null);
      const response = await Api.post(`/api/settings/api-keys/${keyId}/rotate`, {});
      const payload = response?.data;
      const rotatedKey = payload?.key;
      const newSecret = typeof rotatedKey === 'string' ? rotatedKey : rotatedKey?.key;
      const expectedPrefix =
        typeof rotatedKey === 'object' && rotatedKey !== null
          ? rotatedKey.keyPrefix
          : payload?.keyPrefix;

      const refreshed = await fetchKeys();
      const confirmed = expectedPrefix
        ? refreshed?.some((key) => key.id === keyId && key.prefix === expectedPrefix)
        : refreshed?.some((key) => key.id === keyId);
      if (!confirmed) {
        throw new Error('API key rotation was not confirmed by the server');
      }
      if (newSecret) setNewKey(newSecret);
      toast.success(t('settings.api.keyRotated', 'API key rotated successfully'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.api.rotateError', 'Failed to rotate key')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setRotatingKey(null);
    }
  };

  const saveKeySettings = async (keyId: string) => {
    const settings = keySettings[keyId];
    if (!settings) return;

    try {
      setActionError(null);
      await Api.put(`/api/settings/api-keys/${keyId}`, {
        rateLimit: settings.rateLimit ? parseInt(settings.rateLimit) : null,
        permissions: settings.scopes,
      });

      const refreshed = await fetchKeys();
      const persisted = refreshed?.find((key) => key.id === keyId);
      if (!keySettingsMatch(persisted, settings)) {
        throw new Error('API key settings save was not confirmed by the server');
      }
      toast.success(t('settings.api.settingsSaved', 'Settings saved'));
      setShowSettings(null);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.api.saveError', 'Failed to save settings')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const toggleScope = (keyId: string, scopeId: string) => {
    setKeySettings((prev) => ({
      ...prev,
      [keyId]: {
        ...prev[keyId],
        scopes: prev[keyId].scopes.includes(scopeId)
          ? prev[keyId].scopes.filter((s) => s !== scopeId)
          : [...prev[keyId].scopes, scopeId],
      },
    }));
  };

  const getQuotaPercentage = (key: APIKey) => {
    if (!key.quotaLimit || !key.quotaUsed) return 0;
    return Math.min((key.quotaUsed / key.quotaLimit) * 100, 100);
  };

  const isKeyExpired = (key: APIKey) => {
    if (!key.expiresAt) return false;
    return new Date(key.expiresAt) < new Date();
  };

  const isKeyExpiringSoon = (key: APIKey) => {
    if (!key.expiresAt) return false;
    const daysUntilExpiry =
      (new Date(key.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  };

  if (loadingKeys) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Key size={20} />
            {t('settings.api.title', 'API Access')}
          </h3>
        </div>
        <LoadingState variant="spinner" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Key size={20} />
            {t('settings.api.title', 'API Access')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t('settings.api.desc', 'Manage API keys for programmatic access.')}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          disabled={!!loadError}
          className="flex items-center gap-2 px-3 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] transition-colors"
        >
          <Plus size={16} />
          {t('settings.api.createKey', 'Create Key')}
        </button>
      </div>

      {loadError && <DegradedState title="API keys unavailable" description={loadError} />}

      {actionError && <Banner variant="danger" title={actionError} />}

      {/* Empty state */}
      {keys.length === 0 && !showNew && !loadError && (
        <EmptyState
          icon={<Key />}
          title={t('settings.api.noKeys', 'No API keys yet. Create one to get started.')}
          action={{
            label: t('settings.api.createKey', 'Create Key'),
            onClick: () => setShowNew(true),
          }}
        />
      )}

      {/* New Key Warning */}
      {newKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
            {t(
              'settings.api.newKeyWarning',
              "Save this key now. You won't be able to see it again."
            )}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-c-surface rounded text-sm font-mono">
              {newKey}
            </code>
            <button
              onClick={() => copyKey(newKey)}
              className="p-2 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded"
            >
              <Copy size={16} />
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-sm text-amber-700 dark:text-amber-300 underline"
          >
            {t('settings.api.dismiss', "I've saved my key")}
          </button>
        </div>
      )}

      {/* Create Key Form */}
      {showNew && (
        <div className="p-4 bg-c-surface-raised rounded-lg">
          <label className="block text-sm font-medium text-c-text-secondary mb-2">
            {t('settings.api.keyName', 'Key Name')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t('settings.api.keyNamePlaceholder', 'e.g., Production API')}
              className="flex-1 px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-600 rounded-lg bg-c-surface"
            />
            <button
              onClick={createKey}
              className="px-4 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF]"
            >
              {t('common.create', 'Create')}
            </button>
            <button
              onClick={() => {
                setShowNew(false);
                setNewKeyName('');
              }}
              className="px-4 py-2 border border-c-border-subtle dark:border-navy-600 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-4">
        {keys.map((key) => {
          const quotaPercent = getQuotaPercentage(key);
          const expired = isKeyExpired(key);
          const expiringSoon = isKeyExpiringSoon(key);
          const usage = keyUsage[key.id];
          const isSelected = selectedKey === key.id;
          const showKeySettings = showSettings === key.id;

          return (
            <div
              key={key.id}
              className={`p-4 bg-c-surface rounded-lg border transition-all ${
                isSelected
                  ? 'border-c-border-strong'
                  : 'border-c-border-subtle dark:border-navy-700'
              }`}
            >
              {/* Key Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-c-text">{key.name}</p>
                    {expired && (
                      <StatusChip tone="danger" label={t('settings.api.expired', 'Expired')} />
                    )}
                    {expiringSoon && !expired && (
                      <StatusChip
                        tone="warning"
                        label={t('settings.api.expiringSoon', 'Expiring Soon')}
                      />
                    )}
                  </div>
                  <p className="text-sm text-c-text-muted font-mono">{key.prefix}••••••••••••</p>
                  {key.lastUsed && (
                    <p className="text-xs text-c-text-secondary mt-1">
                      {t('settings.api.lastUsed', 'Last used')}: {key.lastUsed}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedKey(isSelected ? null : key.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-navy-900 text-white'
                        : 'text-c-text-secondary hover:text-brand hover:bg-c-surface-raised dark:hover:bg-navy-700'
                    }`}
                    title={t('settings.api.viewUsage', 'View usage')}
                  >
                    <BarChart3 size={16} />
                  </button>
                  <button
                    onClick={() => setShowSettings(showKeySettings ? null : key.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      showKeySettings
                        ? 'bg-navy-900 text-white'
                        : 'text-c-text-secondary hover:text-brand hover:bg-c-surface-raised dark:hover:bg-navy-700'
                    }`}
                    title={t('common.settings', 'Settings')}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    onClick={() => rotateKey(key.id)}
                    disabled={rotatingKey === key.id}
                    className="p-2 text-c-text-secondary hover:text-brand hover:bg-c-surface-raised dark:hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
                    title={t('settings.api.rotate', 'Rotate key')}
                  >
                    {rotatingKey === key.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RotateCw size={16} />
                    )}
                  </button>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                    title={t('common.delete', 'Delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Quota Progress */}
              {key.quotaLimit && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-c-text-secondary">
                      {t('settings.api.quota', 'Quota')}
                    </span>
                    <span className="text-c-text-secondary">
                      {key.quotaUsed?.toLocaleString() || 0} / {key.quotaLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-c-surface-raised rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        quotaPercent >= 90
                          ? 'bg-danger-500'
                          : quotaPercent >= 70
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                  {key.quotaResetAt && (
                    <p className="text-xs text-c-text-secondary mt-1">
                      {t('settings.api.resetsAt', 'Resets')}:{' '}
                      {new Date(key.quotaResetAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Rate Limit */}
              {key.rateLimit && (
                <div className="mb-3 flex items-center gap-2 text-xs text-c-text-secondary">
                  <TrendingUp size={12} />
                  <span>
                    {t('settings.api.rateLimit', 'Rate limit')}: {key.rateLimit}{' '}
                    {t('settings.api.requestsPerMin', 'requests/min')}
                  </span>
                </div>
              )}

              {/* IP Whitelist */}
              {key.ipWhitelist && key.ipWhitelist.length > 0 && (
                <div className="mb-3 flex items-center gap-2 text-xs text-c-text-secondary">
                  <Shield size={12} />
                  <span>
                    {key.ipWhitelist.length} {t('settings.api.allowedIPs', 'allowed IP(s)')}
                  </span>
                </div>
              )}

              {/* Expiration */}
              {key.expiresAt && (
                <div className="mb-3 flex items-center gap-2 text-xs text-c-text-secondary">
                  <Calendar size={12} />
                  <span>
                    {t('settings.api.expires', 'Expires')}:{' '}
                    {new Date(key.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Usage Dashboard */}
              {isSelected && usage && (
                <div className="mt-4 p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle dark:border-navy-700">
                  <h5 className="text-sm font-semibold text-c-text mb-3">
                    {t('settings.api.usageDashboard', 'Usage Dashboard')}
                  </h5>
                  {usage.requests && usage.requests.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={usage.requests}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-strong)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          stroke="var(--c-text-muted)"
                        />
                        <YAxis tick={{ fontSize: 10 }} stroke="var(--c-text-muted)" />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="var(--color-brand, #7C3AED)"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* Settings Modal */}
              {showKeySettings && (
                <div className="mt-4 p-4 bg-c-surface-raised rounded-lg border border-c-border-subtle dark:border-navy-700 space-y-4">
                  <h5 className="text-sm font-semibold text-c-text">
                    {t('settings.api.advancedSettings', 'Advanced Settings')}
                  </h5>

                  {/* Rate Limit */}
                  <div>
                    <label className="block text-xs font-medium text-c-text-secondary mb-1">
                      {t('settings.api.rateLimit', 'Rate Limit')} (
                      {t('settings.api.requestsPerMin', 'requests/min')})
                    </label>
                    <input
                      type="number"
                      value={keySettings[key.id]?.rateLimit || ''}
                      onChange={(e) =>
                        setKeySettings((prev) => ({
                          ...prev,
                          [key.id]: { ...prev[key.id], rateLimit: e.target.value },
                        }))
                      }
                      placeholder="1000"
                      className="w-full px-3 py-2 text-sm bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg"
                    />
                  </div>

                  {/* Scopes */}
                  <div>
                    <label className="block text-xs font-medium text-c-text-secondary mb-2">
                      {t('settings.api.scopes', 'Permissions')}
                    </label>
                    <div className="space-y-2">
                      {AVAILABLE_SCOPES.map((scope) => (
                        <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={keySettings[key.id]?.scopes?.includes(scope.id) || false}
                            onChange={() => toggleScope(key.id, scope.id)}
                            className="w-4 h-4 rounded border-c-border-subtle dark:border-navy-700 text-brand focus:ring-[color:var(--c-focus)]"
                          />
                          <div>
                            <span className="text-sm font-medium text-c-text-secondary">
                              {scope.name}
                            </span>
                            <p className="text-xs text-c-text-muted">{scope.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => saveKeySettings(key.id)}
                      className="flex-1 px-3 py-2 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] text-sm font-medium"
                    >
                      {t('common.save', 'Save')}
                    </button>
                    <button
                      onClick={() => setShowSettings(null)}
                      className="px-3 py-2 border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 text-sm"
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default APIAccessSettings;
