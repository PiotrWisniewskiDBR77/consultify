/**
 * SuperAdminAISettings - Global AI Platform Settings
 *
 * SuperAdmin interface for managing platform-wide AI configuration:
 * - Default provider selection
 * - Fallback chain configuration
 * - Global rate limits
 * - PII detection sensitivity
 * - Data residency settings
 * - Circuit breaker configuration
 */

import { AnimatePresence, Reorder } from 'framer-motion';
import {
  Activity,
  CheckCircle,
  Gauge,
  Globe,
  GripVertical,
  Lock,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';

import { InfoButton } from '../shared/InfoButton';

interface SuperAdminSettings {
  id: string;
  defaultProvider: string | null;
  fallbackChain: string[];
  circuitBreakerConfig: {
    failureThreshold: number;
    cooldownSeconds: number;
  };
  globalTokenLimit: number;
  globalRateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  maxContextWindowSize: number;
  maxTokensPerRequest: number;
  piiDetectionSensitivity: 'low' | 'medium' | 'high';
  requireEncryption: boolean;
  dataResidency: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

interface LLMProvider {
  id: string;
  name: string;
  provider: string;
  is_active: boolean;
}

const DATA_RESIDENCY_OPTIONS = [
  { value: null, label: 'No Restriction', description: 'Data can be processed globally' },
  { value: 'EU', label: 'European Union', description: 'Data stays within EU boundaries' },
  { value: 'US', label: 'United States', description: 'Data processed in US data centers' },
  { value: 'APAC', label: 'Asia Pacific', description: 'Data processed in APAC region' },
];

const PII_SENSITIVITY_OPTIONS = [
  {
    value: 'low',
    label: 'Low',
    description: 'Basic PII detection (emails, phone numbers)',
    color: 'text-green-400',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Standard detection (+ names, addresses)',
    color: 'text-yellow-400',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Aggressive detection (+ financial, health data)',
    color: 'text-rose-400',
  },
];

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
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

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean'
    ? value
    : value === undefined || value === null
      ? fallback
      : value === 1 || value === '1' || value === 'true';

const toNumber = (value: unknown, fallback: number) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeSettings = (value: unknown): SuperAdminSettings => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !('id' in payload)) {
    throw new Error('AI settings response was incomplete');
  }

  const globalRateLimit = isRecord(payload.globalRateLimit) ? payload.globalRateLimit : {};
  const circuitBreakerConfig = isRecord(payload.circuitBreakerConfig)
    ? payload.circuitBreakerConfig
    : {};
  const piiDetectionSensitivity =
    payload.piiDetectionSensitivity === 'low' ||
    payload.piiDetectionSensitivity === 'medium' ||
    payload.piiDetectionSensitivity === 'high'
      ? payload.piiDetectionSensitivity
      : 'medium';

  return {
    id: asText(payload.id, ''),
    defaultProvider:
      payload.defaultProvider === null || payload.defaultProvider === undefined
        ? null
        : asText(payload.defaultProvider, ''),
    fallbackChain: Array.isArray(payload.fallbackChain)
      ? payload.fallbackChain.map((item) => asText(item, '')).filter(Boolean)
      : [],
    circuitBreakerConfig: {
      failureThreshold: toNumber(circuitBreakerConfig.failureThreshold, 5),
      cooldownSeconds: toNumber(circuitBreakerConfig.cooldownSeconds, 60),
    },
    globalTokenLimit: toNumber(payload.globalTokenLimit, 10000000),
    globalRateLimit: {
      requestsPerMinute: toNumber(globalRateLimit.requestsPerMinute, 60),
      requestsPerHour: toNumber(globalRateLimit.requestsPerHour, 1000),
    },
    maxContextWindowSize: toNumber(payload.maxContextWindowSize, 128000),
    maxTokensPerRequest: toNumber(payload.maxTokensPerRequest, 8192),
    piiDetectionSensitivity,
    requireEncryption: toBool(payload.requireEncryption, false),
    dataResidency:
      payload.dataResidency === null || payload.dataResidency === undefined
        ? null
        : asText(payload.dataResidency, ''),
    updatedAt:
      payload.updatedAt === null || payload.updatedAt === undefined
        ? undefined
        : asText(payload.updatedAt, ''),
    updatedBy:
      payload.updatedBy === null || payload.updatedBy === undefined
        ? undefined
        : asText(payload.updatedBy, ''),
  };
};

const normalizeProviders = (value: unknown): LLMProvider[] => {
  if (!hasListShape(value, ['providers', 'items'])) {
    throw new Error('LLM providers response was not a list');
  }
  return getListPayload<Record<string, unknown>>(value, ['providers', 'items'])
    .map((provider) => ({
      id: asText(provider.id, ''),
      name: asText(provider.name, ''),
      provider: asText(provider.provider, ''),
      is_active: toBool(provider.is_active, true),
    }))
    .filter((provider) => provider.id);
};

const settingsConfirmSaved = (expected: SuperAdminSettings, actual: SuperAdminSettings) =>
  expected.defaultProvider === actual.defaultProvider &&
  JSON.stringify(expected.fallbackChain) === JSON.stringify(actual.fallbackChain) &&
  expected.globalTokenLimit === actual.globalTokenLimit &&
  expected.globalRateLimit.requestsPerMinute === actual.globalRateLimit.requestsPerMinute &&
  expected.globalRateLimit.requestsPerHour === actual.globalRateLimit.requestsPerHour &&
  expected.maxContextWindowSize === actual.maxContextWindowSize &&
  expected.maxTokensPerRequest === actual.maxTokensPerRequest &&
  expected.piiDetectionSensitivity === actual.piiDetectionSensitivity &&
  expected.requireEncryption === actual.requireEncryption &&
  expected.dataResidency === actual.dataResidency &&
  expected.circuitBreakerConfig.failureThreshold === actual.circuitBreakerConfig.failureThreshold &&
  expected.circuitBreakerConfig.cooldownSeconds === actual.circuitBreakerConfig.cooldownSeconds;

export const SuperAdminAISettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SuperAdminSettings | null>(null);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fallback chain management
  const [fallbackChain, setFallbackChain] = useState<string[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading !== false) setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const [settingsRes, providersRes] = await Promise.all([
        fetch('/api/ai-settings/superadmin', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/llm/providers', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (!settingsRes.ok) {
        throw new Error('AI settings endpoint returned an error');
      }
      if (!providersRes.ok) {
        throw new Error('LLM providers endpoint returned an error');
      }

      const data = await settingsRes.json();
      const provData = await providersRes.json();
      const nextSettings = normalizeSettings(data);
      const nextProviders = normalizeProviders(provData);

      setSettings(nextSettings);
      setFallbackChain(nextSettings.fallbackChain);
      setProviders(nextProviders.filter((p) => p.is_active));
      return { settings: nextSettings, providers: nextProviders };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load AI settings';
      setLoadError(message);
      setSettings(null);
      setProviders([]);
      setFallbackChain([]);
      toast.error(message);
      return null;
    } finally {
      if (options.showLoading !== false) setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setSaveError(null);
    try {
      const payload: SuperAdminSettings = {
        ...settings,
        fallbackChain,
      };

      const res = await fetch('/api/ai-settings/superadmin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('AI settings save endpoint returned an error');
      }

      const refreshed = await loadSettings({ showLoading: false });
      if (!refreshed || !settingsConfirmSaved(payload, refreshed.settings)) {
        throw new Error('AI settings save was not confirmed by the server');
      }
      setHasChanges(false);
      toast.success('Settings saved successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof SuperAdminSettings>(
    key: K,
    value: SuperAdminSettings[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
    setHasChanges(true);
  };

  const updateNestedSetting = <K extends 'circuitBreakerConfig' | 'globalRateLimit'>(
    parent: K,
    key: keyof SuperAdminSettings[K],
    value: number
  ) => {
    setSettings((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [parent]: {
          ...prev[parent],
          [key]: value,
        },
      };
    });
    setHasChanges(true);
  };

  const addToFallbackChain = (providerId: string) => {
    if (!fallbackChain.includes(providerId)) {
      setFallbackChain([...fallbackChain, providerId]);
      setHasChanges(true);
    }
  };

  const removeFromFallbackChain = (providerId: string) => {
    setFallbackChain(fallbackChain.filter((id) => id !== providerId));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw size={32} className="animate-spin text-primary-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6 max-w-xl w-full">
          <DegradedState
            title="AI settings unavailable"
            description={loadError || 'Failed to load settings'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full relative text-slate-900 dark:text-slate-100">
      <InfoButton cardId="superadmin-ai-global-settings" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/20 to-primary-600/10">
              <Settings size={24} className="text-primary-400" />
            </div>
            Global AI Settings
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Platform-wide AI configuration and constraints
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadSettings()}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 p-4 py-2.5 rounded-xl font-medium transition-all ${
              hasChanges
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:shadow-primary-500/25'
                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>

      {saveError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {saveError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Default Provider & Fallback Chain */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Server size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Provider Configuration
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Default model and fallback chain
              </p>
            </div>
          </div>

          {/* Default Provider */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Default Provider
            </label>
            <select
              value={settings.defaultProvider || ''}
              onChange={(e) => updateSetting('defaultProvider', e.target.value || null)}
              className="w-full px-4 py-3 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            >
              <option value="">Auto-select</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.provider})
                </option>
              ))}
            </select>
          </div>

          {/* Fallback Chain */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Fallback Chain
              <span className="text-slate-500 dark:text-slate-400 font-normal ml-2">
                (drag to reorder)
              </span>
            </label>

            <Reorder.Group
              axis="y"
              values={fallbackChain}
              onReorder={(newOrder) => {
                setFallbackChain(newOrder);
                setHasChanges(true);
              }}
              className="space-y-2 mb-3"
            >
              <AnimatePresence>
                {fallbackChain.map((providerId, index) => {
                  const provider = providers.find((p) => p.id === providerId);
                  return (
                    <Reorder.Item
                      key={providerId}
                      value={providerId}
                      className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-navy-800/50 border border-slate-200 dark:border-white/10 rounded-xl cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical size={16} className="text-slate-500 dark:text-slate-400" />
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-6">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-slate-900 dark:text-slate-100">
                        {provider?.name || providerId}
                      </span>
                      <button
                        onClick={() => removeFromFallbackChain(providerId)}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </Reorder.Item>
                  );
                })}
              </AnimatePresence>
            </Reorder.Group>

            {/* Add to chain */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addToFallbackChain(e.target.value);
              }}
              className="w-full px-4 py-2 bg-navy-900/30 border border-dashed border-white/20 rounded-xl text-slate-400 dark:text-slate-500 text-sm"
            >
              <option value="">+ Add provider to fallback chain</option>
              {providers
                .filter((p) => !fallbackChain.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Gauge size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Rate Limits</h3>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Global request throttling
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Requests per Minute
              </label>
              <input
                type="number"
                value={settings.globalRateLimit?.requestsPerMinute || 60}
                onChange={(e) =>
                  updateNestedSetting(
                    'globalRateLimit',
                    'requestsPerMinute',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-4 py-3 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Requests per Hour
              </label>
              <input
                type="number"
                value={settings.globalRateLimit?.requestsPerHour || 1000}
                onChange={(e) =>
                  updateNestedSetting(
                    'globalRateLimit',
                    'requestsPerHour',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-4 py-3 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Global Token Limit (monthly)
              </label>
              <input
                type="number"
                value={settings.globalTokenLimit || 10000000}
                onChange={(e) => updateSetting('globalTokenLimit', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {((settings.globalTokenLimit || 10000000) / 1000000).toFixed(1)}M tokens
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Max Tokens per Request
              </label>
              <input
                type="number"
                value={settings.maxTokensPerRequest || 8192}
                onChange={(e) => updateSetting('maxTokensPerRequest', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                Max Context Window Size
              </label>
              <input
                type="number"
                value={settings.maxContextWindowSize || 128000}
                onChange={(e) => updateSetting('maxContextWindowSize', parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-navy-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {((settings.maxContextWindowSize || 128000) / 1000).toFixed(0)}K context
              </p>
            </div>
          </div>
        </div>

        {/* Security & PII */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-rose-500/20">
              <Shield size={20} className="text-rose-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Security & Privacy
              </h3>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                PII detection and encryption
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* PII Sensitivity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
                PII Detection Sensitivity
              </label>
              <div className="space-y-2">
                {PII_SENSITIVITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                      settings.piiDetectionSensitivity === option.value
                        ? 'bg-primary-500/10 border-primary-500/50'
                        : 'bg-navy-900/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="piiSensitivity"
                      value={option.value}
                      checked={settings.piiDetectionSensitivity === option.value}
                      onChange={(e) =>
                        updateSetting(
                          'piiDetectionSensitivity',
                          e.target.value as SuperAdminSettings['piiDetectionSensitivity']
                        )
                      }
                      className="sr-only"
                    />
                    <div
                      className={`w-3 h-3 rounded-full ${option.color.replace('text-', 'bg-')}`}
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${option.color}`}>{option.label}</div>
                      <div className="text-sm text-slate-400 dark:text-slate-500">
                        {option.description}
                      </div>
                    </div>
                    {settings.piiDetectionSensitivity === option.value && (
                      <CheckCircle size={20} className="text-primary-400" />
                    )}
                  </label>
                ))}
              </div>
            </div>

            {/* Require Encryption */}
            <div className="flex items-center justify-between p-4 bg-navy-900/30 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-emerald-400" />
                <div>
                  <div className="font-medium text-white">Require Encryption</div>
                  <div className="text-sm text-slate-400 dark:text-slate-500">
                    Encrypt all AI requests/responses
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireEncryption}
                  onChange={(e) => updateSetting('requireEncryption', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Circuit Breaker & Data Residency */}
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Activity size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Resilience & Compliance
              </h3>
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Circuit breaker and data residency
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Circuit Breaker */}
            <div className="p-4 bg-navy-900/30 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-amber-400" />
                <span className="font-medium text-white">Circuit Breaker</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                    Failure Threshold
                  </label>
                  <input
                    type="number"
                    value={settings.circuitBreakerConfig?.failureThreshold || 5}
                    onChange={(e) =>
                      updateNestedSetting(
                        'circuitBreakerConfig',
                        'failureThreshold',
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 bg-navy-900/50 border border-white/10 rounded-lg text-white text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    failures before trip
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 dark:text-slate-500 mb-1">
                    Cooldown (seconds)
                  </label>
                  <input
                    type="number"
                    value={settings.circuitBreakerConfig?.cooldownSeconds || 60}
                    onChange={(e) =>
                      updateNestedSetting(
                        'circuitBreakerConfig',
                        'cooldownSeconds',
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 bg-navy-900/50 border border-white/10 rounded-lg text-white text-sm"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">before retry</p>
                </div>
              </div>
            </div>

            {/* Data Residency */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
                Data Residency
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DATA_RESIDENCY_OPTIONS.map((option) => (
                  <label
                    key={option.value || 'none'}
                    className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                      settings.dataResidency === option.value
                        ? 'bg-primary-500/10 border-primary-500/50'
                        : 'bg-navy-900/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="dataResidency"
                      value={option.value || ''}
                      checked={settings.dataResidency === option.value}
                      onChange={(e) => updateSetting('dataResidency', e.target.value || null)}
                      className="sr-only"
                    />
                    <div className="flex items-center gap-2 mb-1">
                      <Globe
                        size={16}
                        className={
                          settings.dataResidency === option.value
                            ? 'text-primary-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }
                      />
                      <span className="font-medium text-white">{option.label}</span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {option.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated Info */}
      {settings.updatedAt && (
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          Last updated: {new Date(settings.updatedAt).toLocaleString()}
          {settings.updatedBy && ` by ${settings.updatedBy}`}
        </div>
      )}
    </div>
  );
};

export default SuperAdminAISettings;
