/**
 * AISecuritySettings Component
 *
 * Organization-level AI security and configuration settings.
 */

import {
  AlertCircle,
  Check,
  Clock,
  Eye,
  EyeOff,
  Info,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import api from '../../services/api';
import { Button } from '../ui/primitives/Button';

interface RateLimit {
  id: string;
  rule_name: string;
  limit_type: string;
  limit_value: number;
  applies_to: string;
}

interface OrganizationSettings {
  organization_id: string;
  enabled_features: string[];
  disabled_models: string[];
  max_tokens_per_request: number;
  allow_web_research: boolean;
  allow_tool_calling: boolean;
  data_retention_days: number;
  require_approval_for: string[];
  custom_system_prompt: string | null;
}

/**
 * Etykiety trzymamy PO ANGIELSKU (reguła programu spójności językowej §2.3:
 * `defaultValue` widzi użytkownik EN przy braku klucza i przy pierwszym
 * malowaniu ekranu). Polski żyje wyłącznie w `public/locales/pl/`.
 */
const AVAILABLE_FEATURES = [
  {
    id: 'chat',
    labelKey: 'settings.aiSecurity.features.chat.label',
    label: 'AI Chat',
    descriptionKey: 'settings.aiSecurity.features.chat.description',
    description: 'Conversations with the AI assistant',
  },
  {
    id: 'reports',
    labelKey: 'settings.aiSecurity.features.reports.label',
    label: 'Report generation',
    descriptionKey: 'settings.aiSecurity.features.reports.description',
    description: 'AI-generated audit reports',
  },
  {
    id: 'initiatives',
    labelKey: 'settings.aiSecurity.features.initiatives.label',
    label: 'Initiative generation',
    descriptionKey: 'settings.aiSecurity.features.initiatives.description',
    description: 'AI-suggested initiatives',
  },
  {
    id: 'magic_wand',
    labelKey: 'settings.aiSecurity.features.magicWand.label',
    label: 'Magic Wand',
    descriptionKey: 'settings.aiSecurity.features.magicWand.description',
    description: 'Form field auto-complete',
  },
  {
    id: 'task_advisor',
    labelKey: 'settings.aiSecurity.features.taskAdvisor.label',
    label: 'Task Advisor',
    descriptionKey: 'settings.aiSecurity.features.taskAdvisor.description',
    description: 'Task recommendations',
  },
  {
    id: 'web_research',
    labelKey: 'settings.aiSecurity.features.webResearch.label',
    label: 'Web Research',
    descriptionKey: 'settings.aiSecurity.features.webResearch.description',
    description: 'Web search',
  },
];

const AVAILABLE_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', tier: 'premium' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tier: 'standard' },
  { id: 'claude-3-opus', label: 'Claude 3 Opus', tier: 'premium' },
  { id: 'claude-3-sonnet', label: 'Claude 3 Sonnet', tier: 'standard' },
  { id: 'gemini-pro', label: 'Gemini Pro', tier: 'standard' },
  { id: 'o1-preview', label: 'O1 Preview', tier: 'reasoning' },
];

const LIMIT_TYPES = [
  { id: 'per_minute', labelKey: 'settings.aiSecurity.limits.perMinute', label: 'Per minute' },
  { id: 'per_hour', labelKey: 'settings.aiSecurity.limits.perHour', label: 'Per hour' },
  { id: 'per_day', labelKey: 'settings.aiSecurity.limits.perDay', label: 'Per day' },
  { id: 'per_month', labelKey: 'settings.aiSecurity.limits.perMonth', label: 'Per month' },
];

export function AISecuritySettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState({
    ruleName: '',
    limitType: 'per_day',
    limitValue: 100,
    appliesTo: 'all',
  });
  const [showAddLimit, setShowAddLimit] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, limitsRes] = await Promise.all([
        api.get('/ai-security/organization-settings'),
        api.get('/ai-security/rate-limits'),
      ]);

      if (settingsRes.data.success) {
        setSettings(settingsRes.data.data);
      }
      if (limitsRes.data.success) {
        setRateLimits(limitsRes.data.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    try {
      await api.put('/ai-security/organization-settings', {
        enabledFeatures: settings.enabled_features,
        disabledModels: settings.disabled_models,
        maxTokensPerRequest: settings.max_tokens_per_request,
        allowWebResearch: settings.allow_web_research,
        allowToolCalling: settings.allow_tool_calling,
        dataRetentionDays: settings.data_retention_days,
        requireApprovalFor: settings.require_approval_for,
        customSystemPrompt: settings.custom_system_prompt,
      });
      setSuccess(t('settings.aiSecurity.saved', 'Settings saved'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (featureId: string) => {
    if (!settings) return;
    const features = settings.enabled_features.includes(featureId)
      ? settings.enabled_features.filter((f) => f !== featureId)
      : [...settings.enabled_features, featureId];
    setSettings({ ...settings, enabled_features: features });
  };

  const toggleModel = (modelId: string) => {
    if (!settings) return;
    const models = settings.disabled_models.includes(modelId)
      ? settings.disabled_models.filter((m) => m !== modelId)
      : [...settings.disabled_models, modelId];
    setSettings({ ...settings, disabled_models: models });
  };

  const addRateLimit = async () => {
    try {
      await api.post('/ai-security/rate-limits', newLimit);
      await fetchSettings();
      setShowAddLimit(false);
      setNewLimit({ ruleName: '', limitType: 'per_day', limitValue: 100, appliesTo: 'all' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteRateLimit = async (limitId: string) => {
    try {
      await api.delete(`/ai-security/rate-limits/${limitId}`);
      await fetchSettings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="p-6" />;
  }

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-c-text">
            {t('settings.aiSecurity.title', 'AI Security Settings')}
          </h1>
          <p className="text-sm text-c-text-muted">
            {t('settings.aiSecurity.subtitle', 'AI feature configuration for the organization')}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 text-danger-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 flex items-center gap-2">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}

      {settings && (
        <>
          {/* Features Section */}
          <div className="bg-c-surface rounded-xl p-6 shadow-sm border border-slate-200/60 dark:border-white/[0.03]">
            <h2 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              {t('settings.aiSecurity.featuresTitle', 'Enabled features')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_FEATURES.map((feature) => (
                <label
                  key={feature.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    settings.enabled_features.includes(feature.id)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-c-border-subtle hover:border-c-border-subtle'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={settings.enabled_features.includes(feature.id)}
                    onChange={() => toggleFeature(feature.id)}
                    className="mt-1 rounded border-c-border-subtle"
                  />
                  <div>
                    <p className="font-medium text-c-text">
                      {t(feature.labelKey, feature.label)}
                    </p>
                    <p className="text-sm text-c-text-muted">
                      {t(feature.descriptionKey, feature.description)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Models Section */}
          <div className="bg-c-surface rounded-xl p-6 shadow-sm border border-slate-200/60 dark:border-white/[0.03]">
            <h2 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-c-accent" />
              {t('settings.aiSecurity.modelsTitle', 'Allowed models')}
            </h2>
            <p className="text-sm text-c-text-muted mb-4">
              {t(
                'settings.aiSecurity.modelsHint',
                'Clear the models you want to switch off for users'
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {AVAILABLE_MODELS.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                    settings.disabled_models.includes(model.id)
                      ? 'border-danger-300 bg-danger-50 dark:bg-danger-900/20'
                      : 'border-c-border-subtle'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!settings.disabled_models.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                    className="rounded border-c-border-subtle"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-c-text text-sm">{model.label}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      model.tier === 'premium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : model.tier === 'reasoning'
                          ? 'bg-c-accent-soft text-c-accent'
                          : 'bg-c-surface-raised text-c-text-secondary'
                    }`}
                  >
                    {model.tier}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Limits Section */}
          <div className="bg-c-surface rounded-xl p-6 shadow-sm border border-slate-200/60 dark:border-white/[0.03]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-c-text flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                {t('settings.aiSecurity.limitsTitle', 'Rate limits')}
              </h2>
              <Button variant="outline" size="sm" onClick={() => setShowAddLimit(!showAddLimit)}>
                <Plus className="w-4 h-4 mr-1" />
                {t('settings.aiSecurity.limitAdd', 'Add limit')}
              </Button>
            </div>

            {showAddLimit && (
              <div className="mb-4 p-4 bg-c-surface-raised rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    placeholder={t('settings.aiSecurity.limitRuleName', 'Rule name')}
                    value={newLimit.ruleName}
                    onChange={(e) => setNewLimit({ ...newLimit, ruleName: e.target.value })}
                    className="px-3 py-2 border rounded-lg bg-c-surface"
                  />
                  <select
                    value={newLimit.limitType}
                    onChange={(e) => setNewLimit({ ...newLimit, limitType: e.target.value })}
                    className="px-3 py-2 border rounded-lg bg-c-surface"
                  >
                    {LIMIT_TYPES.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {t(lt.labelKey, lt.label)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder={t('settings.aiSecurity.limitValue', 'Limit')}
                    value={newLimit.limitValue}
                    onChange={(e) =>
                      setNewLimit({ ...newLimit, limitValue: parseInt(e.target.value) })
                    }
                    className="px-3 py-2 border rounded-lg bg-c-surface"
                  />
                  <Button variant="primary" onClick={addRateLimit}>
                    {t('settings.aiSecurity.limitAddShort', 'Add')}
                  </Button>
                </div>
              </div>
            )}

            {rateLimits.length === 0 ? (
              <p className="text-c-text-muted text-sm">
                {t(
                  'settings.aiSecurity.limitsEmpty',
                  'No limits configured. System defaults apply.'
                )}
              </p>
            ) : (
              <div className="space-y-2">
                {rateLimits.map((limit) => (
                  <div
                    key={limit.id}
                    className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-c-text">{limit.rule_name}</p>
                      <p className="text-sm text-c-text-muted">
                        {limit.limit_value}{' '}
                        {(() => {
                          const typ = LIMIT_TYPES.find((lt) => lt.id === limit.limit_type);
                          return typ ? t(typ.labelKey, typ.label) : limit.limit_type;
                        })()}
                        {limit.applies_to !== 'all' && ` (${limit.applies_to})`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteRateLimit(limit.id)}>
                      <Trash2 className="w-4 h-4 text-danger-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="bg-c-surface rounded-xl p-6 shadow-sm border border-slate-200/60 dark:border-white/[0.03]">
            <h2 className="text-lg font-semibold text-c-text mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-c-text-muted" />
              {t('settings.aiSecurity.advancedTitle', 'Advanced settings')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('settings.aiSecurity.maxTokens', 'Maximum tokens per request')}
                </label>
                <input
                  type="number"
                  value={settings.max_tokens_per_request}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_tokens_per_request: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-c-surface-raised"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-c-text-secondary mb-1">
                  {t('settings.aiSecurity.retentionDays', 'Data retention (days)')}
                </label>
                <input
                  type="number"
                  value={settings.data_retention_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      data_retention_days: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg bg-c-surface-raised"
                />
                <p className="text-xs text-c-text-muted mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {t(
                    'settings.aiSecurity.retentionHint',
                    'AI logs older than this number of days are removed automatically'
                  )}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_web_research}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allow_web_research: e.target.checked,
                      })
                    }
                    className="rounded border-c-border-subtle"
                  />
                  <span className="text-sm text-c-text-secondary">
                    {t('settings.aiSecurity.allowWebResearch', 'Allow web search')}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_tool_calling}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        allow_tool_calling: e.target.checked,
                      })
                    }
                    className="rounded border-c-border-subtle"
                  />
                  <span className="text-sm text-c-text-secondary">
                    {t('settings.aiSecurity.allowToolCalling', 'Allow action execution (MCP Tools)')}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleSaveSettings} disabled={saving}>
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {t('settings.aiSecurity.save', 'Save settings')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default AISecuritySettings;
