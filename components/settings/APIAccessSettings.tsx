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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Key, Plus, Copy, Trash2, Eye, EyeOff, Settings, RefreshCw,
  TrendingUp, Shield, Calendar, Loader2, BarChart3, RotateCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { Api } from '../../services/api';

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
  currentUser?: any; // User type
}

const AVAILABLE_SCOPES = [
  { id: 'read', name: 'Read', description: 'Read-only access' },
  { id: 'write', name: 'Write', description: 'Create and update resources' },
  { id: 'delete', name: 'Delete', description: 'Delete resources' },
  { id: 'admin', name: 'Admin', description: 'Full administrative access' }
];

export const APIAccessSettings: React.FC<APIAccessSettingsProps> = ({ className = '', currentUser }) => {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<string | null>(null);
  const [keyUsage, setKeyUsage] = useState<Record<string, any>>({});
  const [rotatingKey, setRotatingKey] = useState<string | null>(null);

  // Settings form state
  const [keySettings, setKeySettings] = useState<Record<string, {
    rateLimit: string;
    quotaLimit: string;
    expiresAt: string;
    ipWhitelist: string;
    scopes: string[];
  }>>({});

  useEffect(() => {
    fetchKeys();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      fetchKeyUsage(selectedKey);
    }
  }, [selectedKey]);

  const fetchKeys = async () => {
    try {
      const data = await Api.getUserApiKeys();
      setKeys(data);
      // Initialize settings for each key
      const settings: Record<string, any> = {};
      data.forEach((key: APIKey) => {
        settings[key.id] = {
          rateLimit: key.rateLimit?.toString() || '',
          quotaLimit: key.quotaLimit?.toString() || '',
          expiresAt: key.expiresAt || '',
          ipWhitelist: (key.ipWhitelist || []).join('\n'),
          scopes: key.scopes || []
        };
      });
      setKeySettings(settings);
    } catch (_error) {
      // Mock data (fallback from original code)
      const mockKeys: APIKey[] = [
        {
          id: '1',
          name: 'Production Key',
          prefix: 'ck_prod_',
          createdAt: '2024-01-15',
          lastUsed: '2 hours ago',
          rateLimit: 1000,
          quotaLimit: 100000,
          quotaUsed: 45000,
          quotaResetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          ipWhitelist: ['192.168.1.1', '10.0.0.1'],
          scopes: ['read', 'write']
        },
        {
          id: '2',
          name: 'Development',
          prefix: 'ck_dev_',
          createdAt: '2024-02-20',
          rateLimit: 100,
          quotaLimit: 10000,
          quotaUsed: 2500
        },
      ];
      setKeys(mockKeys);
      const settings: Record<string, any> = {};
      mockKeys.forEach((key: APIKey) => {
        settings[key.id] = {
          rateLimit: key.rateLimit?.toString() || '',
          quotaLimit: key.quotaLimit?.toString() || '',
          expiresAt: key.expiresAt || '',
          ipWhitelist: (key.ipWhitelist || []).join('\n'),
          scopes: key.scopes || []
        };
      });
      setKeySettings(settings);
    }
  };

  const fetchKeyUsage = async (keyId: string) => {
    try {
      const data = await Api.getApiKeyUsage(keyId);
      setKeyUsage(prev => ({ ...prev, [keyId]: data }));
    } catch (error) {
      // Mock usage data
      setKeyUsage(prev => ({
        ...prev,
        [keyId]: {
          requests: [
            { date: '2024-01-01', count: 1200 },
            { date: '2024-01-02', count: 1500 },
            { date: '2024-01-03', count: 1800 },
            { date: '2024-01-04', count: 1400 },
            { date: '2024-01-05', count: 2000 },
            { date: '2024-01-06', count: 1600 },
            { date: '2024-01-07', count: 1900 }
          ],
          period: '7d'
        }
      }));
    }
  };

  const createKey = async () => {
    if (!newKeyName.trim()) return;

    try {
      const data = await Api.createUserApiKey(newKeyName);

      setNewKey(data.key);
      setKeys(prev => [...prev, data.keyInfo]);
      toast.success(t('settings.api.keyCreated', 'API key created'));
    } catch (_error) {
      // Mock creation
      setNewKey('ck_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      setKeys(prev => [...prev, {
        id: String(Date.now()),
        name: newKeyName,
        prefix: 'ck_live_',
        createdAt: new Date().toISOString().split('T')[0]
      }]);
    }

    setNewKeyName('');
    setShowNew(false);
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm(t('settings.api.deleteConfirm', 'Are you sure you want to delete this API key?'))) return;

    try {
      await Api.deleteUserApiKey(keyId);
      setKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success(t('settings.api.keyDeleted', 'API key deleted'));
    } catch (_error) {
      toast.error(t('settings.api.deleteError', 'Failed to delete key'));
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(t('common.copied', 'Copied to clipboard'));
  };

  const rotateKey = async (keyId: string) => {
    if (!confirm(t('settings.api.rotateConfirm', 'Are you sure you want to rotate this key? The old key will be revoked immediately.'))) {
      return;
    }

    setRotatingKey(keyId);
    try {
      const data = await Api.rotateApiKey(keyId);

      setNewKey(data.newKey);
      toast.success(t('settings.api.keyRotated', 'API key rotated successfully'));
      fetchKeys();
    } catch (error) {
      toast.error(t('settings.api.rotateError', 'Failed to rotate key'));
    } finally {
      setRotatingKey(null);
    }
  };

  const saveKeySettings = async (keyId: string) => {
    const settings = keySettings[keyId];
    if (!settings) return;

    try {
      await Api.updateApiKey(keyId, {
        rateLimit: settings.rateLimit ? parseInt(settings.rateLimit) : null,
        quotaLimit: settings.quotaLimit ? parseInt(settings.quotaLimit) : null,
        expiresAt: settings.expiresAt || null,
        ipWhitelist: settings.ipWhitelist.split('\n').filter(ip => ip.trim()),
        scopes: settings.scopes
      });

      toast.success(t('settings.api.settingsSaved', 'Settings saved'));
      setShowSettings(null);
      fetchKeys();
    } catch (error) {
      toast.error(t('settings.api.saveError', 'Failed to save settings'));
    }
  };

  const toggleScope = (keyId: string, scopeId: string) => {
    setKeySettings(prev => ({
      ...prev,
      [keyId]: {
        ...prev[keyId],
        scopes: prev[keyId].scopes.includes(scopeId)
          ? prev[keyId].scopes.filter(s => s !== scopeId)
          : [...prev[keyId].scopes, scopeId]
      }
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
    const daysUntilExpiry = (new Date(key.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Key size={20} />
            {t('settings.api.title', 'API Access')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.api.desc', 'Manage API keys for programmatic access.')}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
        >
          <Plus size={16} />
          {t('settings.api.createKey', 'Create Key')}
        </button>
      </div>

      {/* New Key Warning */}
      {newKey && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
            {t('settings.api.newKeyWarning', 'Save this key now. You won\'t be able to see it again.')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-white dark:bg-navy-800 rounded text-sm font-mono">
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
            {t('settings.api.dismiss', 'I\'ve saved my key')}
          </button>
        </div>
      )}

      {/* Create Key Form */}
      {showNew && (
        <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('settings.api.keyName', 'Key Name')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t('settings.api.keyNamePlaceholder', 'e.g., Production API')}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
            />
            <button
              onClick={createKey}
              className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark"
            >
              {t('common.create', 'Create')}
            </button>
            <button
              onClick={() => { setShowNew(false); setNewKeyName(''); }}
              className="px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700"
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
              className={`p-4 bg-white dark:bg-navy-900 rounded-lg border transition-all ${isSelected ? 'border-brand' : 'border-slate-200 dark:border-white/10'
                }`}
            >
              {/* Key Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-900 dark:text-white">{key.name}</p>
                    {expired && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                        {t('settings.api.expired', 'Expired')}
                      </span>
                    )}
                    {expiringSoon && !expired && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                        {t('settings.api.expiringSoon', 'Expiring Soon')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {key.prefix}••••••••••••
                  </p>
                  {key.lastUsed && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {t('settings.api.lastUsed', 'Last used')}: {key.lastUsed}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedKey(isSelected ? null : key.id)}
                    className={`p-2 rounded-lg transition-colors ${isSelected
                      ? 'bg-brand text-white'
                      : 'text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-navy-700'
                      }`}
                    title={t('settings.api.viewUsage', 'View usage')}
                  >
                    <BarChart3 size={16} />
                  </button>
                  <button
                    onClick={() => setShowSettings(showKeySettings ? null : key.id)}
                    className={`p-2 rounded-lg transition-colors ${showKeySettings
                      ? 'bg-brand text-white'
                      : 'text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-navy-700'
                      }`}
                    title={t('common.settings', 'Settings')}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    onClick={() => rotateKey(key.id)}
                    disabled={rotatingKey === key.id}
                    className="p-2 text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
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
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                    <span className="text-slate-600 dark:text-slate-400">
                      {t('settings.api.quota', 'Quota')}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {key.quotaUsed?.toLocaleString() || 0} / {key.quotaLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-navy-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${quotaPercent >= 90
                        ? 'bg-red-500'
                        : quotaPercent >= 70
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                        }`}
                      style={{ width: `${quotaPercent}%` }}
                    />
                  </div>
                  {key.quotaResetAt && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                      {t('settings.api.resetsAt', 'Resets')}: {new Date(key.quotaResetAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Rate Limit */}
              {key.rateLimit && (
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <TrendingUp size={12} />
                  <span>
                    {t('settings.api.rateLimit', 'Rate limit')}: {key.rateLimit} {t('settings.api.requestsPerMin', 'requests/min')}
                  </span>
                </div>
              )}

              {/* IP Whitelist */}
              {key.ipWhitelist && key.ipWhitelist.length > 0 && (
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Shield size={12} />
                  <span>
                    {key.ipWhitelist.length} {t('settings.api.allowedIPs', 'allowed IP(s)')}
                  </span>
                </div>
              )}

              {/* Expiration */}
              {key.expiresAt && (
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Calendar size={12} />
                  <span>
                    {t('settings.api.expires', 'Expires')}: {new Date(key.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}

              {/* Usage Dashboard */}
              {isSelected && usage && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-200 dark:border-white/10">
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    {t('settings.api.usageDashboard', 'Usage Dashboard')}
                  </h5>
                  {usage.requests && usage.requests.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={usage.requests}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
                        <YAxis tick={{ fontSize: 10 }} stroke="#64748b" />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* Settings Modal */}
              {showKeySettings && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-200 dark:border-white/10 space-y-4">
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('settings.api.advancedSettings', 'Advanced Settings')}
                  </h5>

                  {/* Rate Limit */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings.api.rateLimit', 'Rate Limit')} ({t('settings.api.requestsPerMin', 'requests/min')})
                    </label>
                    <input
                      type="number"
                      value={keySettings[key.id]?.rateLimit || ''}
                      onChange={(e) => setKeySettings(prev => ({
                        ...prev,
                        [key.id]: { ...prev[key.id], rateLimit: e.target.value }
                      }))}
                      placeholder="1000"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                    />
                  </div>

                  {/* Quota Limit */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings.api.quotaLimit', 'Quota Limit')} ({t('settings.api.requestsPerPeriod', 'requests/period')})
                    </label>
                    <input
                      type="number"
                      value={keySettings[key.id]?.quotaLimit || ''}
                      onChange={(e) => setKeySettings(prev => ({
                        ...prev,
                        [key.id]: { ...prev[key.id], quotaLimit: e.target.value }
                      }))}
                      placeholder="100000"
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                    />
                  </div>

                  {/* Expiration Date */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings.api.expirationDate', 'Expiration Date')}
                    </label>
                    <input
                      type="date"
                      value={keySettings[key.id]?.expiresAt ? new Date(keySettings[key.id].expiresAt).toISOString().split('T')[0] : ''}
                      onChange={(e) => setKeySettings(prev => ({
                        ...prev,
                        [key.id]: { ...prev[key.id], expiresAt: e.target.value }
                      }))}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg"
                    />
                  </div>

                  {/* IP Whitelist */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings.api.ipWhitelist', 'IP Whitelist')} ({t('settings.api.onePerLine', 'one per line')})
                    </label>
                    <textarea
                      value={keySettings[key.id]?.ipWhitelist || ''}
                      onChange={(e) => setKeySettings(prev => ({
                        ...prev,
                        [key.id]: { ...prev[key.id], ipWhitelist: e.target.value }
                      }))}
                      placeholder="192.168.1.1&#10;10.0.0.1"
                      rows={3}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg font-mono"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t('settings.api.ipWhitelistHint', 'Leave empty to allow all IPs')}
                    </p>
                  </div>

                  {/* Scopes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {t('settings.api.scopes', 'Permissions')}
                    </label>
                    <div className="space-y-2">
                      {AVAILABLE_SCOPES.map(scope => (
                        <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={keySettings[key.id]?.scopes?.includes(scope.id) || false}
                            onChange={() => toggleScope(key.id, scope.id)}
                            className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
                          />
                          <div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {scope.name}
                            </span>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {scope.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => saveKeySettings(key.id)}
                      className="flex-1 px-3 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark text-sm font-medium"
                    >
                      {t('common.save', 'Save')}
                    </button>
                    <button
                      onClick={() => setShowSettings(null)}
                      className="px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-sm"
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


