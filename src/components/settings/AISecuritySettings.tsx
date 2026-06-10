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

const AVAILABLE_FEATURES = [
  { id: 'chat', label: 'AI Chat', description: 'Konwersacje z asystentem AI' },
  { id: 'reports', label: 'Generowanie raportów', description: 'AI-generowane raporty audytu' },
  { id: 'initiatives', label: 'Generowanie inicjatyw', description: 'AI-sugerowane inicjatywy' },
  { id: 'magic_wand', label: 'Magic Wand', description: 'Autouzupełnianie pól formularzy' },
  { id: 'task_advisor', label: 'Task Advisor', description: 'Rekomendacje zadań' },
  { id: 'web_research', label: 'Web Research', description: 'Wyszukiwanie w internecie' },
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
  { id: 'per_minute', label: 'Na minutę' },
  { id: 'per_hour', label: 'Na godzinę' },
  { id: 'per_day', label: 'Na dzień' },
  { id: 'per_month', label: 'Na miesiąc' },
];

export function AISecuritySettings() {
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
      setSuccess('Ustawienia zapisane');
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ustawienia bezpieczeństwa AI
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Konfiguracja funkcji AI dla organizacji
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-700 flex items-center gap-2">
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
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Włączone funkcje
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_FEATURES.map((feature) => (
                <label
                  key={feature.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    settings.enabled_features.includes(feature.id)
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={settings.enabled_features.includes(feature.id)}
                    onChange={() => toggleFeature(feature.id)}
                    className="mt-1 rounded border-gray-300 dark:border-gray-600"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{feature.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Models Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-500" />
              Dozwolone modele
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Odznacz modele, które chcesz wyłączyć dla użytkowników
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {AVAILABLE_MODELS.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                    settings.disabled_models.includes(model.id)
                      ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!settings.disabled_models.includes(model.id)}
                    onChange={() => toggleModel(model.id)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {model.label}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      model.tier === 'premium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : model.tier === 'reasoning'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {model.tier}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Limits Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Limity zapytań
              </h2>
              <Button variant="outline" size="sm" onClick={() => setShowAddLimit(!showAddLimit)}>
                <Plus className="w-4 h-4 mr-1" />
                Dodaj limit
              </Button>
            </div>

            {showAddLimit && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    placeholder="Nazwa reguły"
                    value={newLimit.ruleName}
                    onChange={(e) => setNewLimit({ ...newLimit, ruleName: e.target.value })}
                    className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  />
                  <select
                    value={newLimit.limitType}
                    onChange={(e) => setNewLimit({ ...newLimit, limitType: e.target.value })}
                    className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  >
                    {LIMIT_TYPES.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Limit"
                    value={newLimit.limitValue}
                    onChange={(e) =>
                      setNewLimit({ ...newLimit, limitValue: parseInt(e.target.value) })
                    }
                    className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                  />
                  <Button variant="primary" onClick={addRateLimit}>
                    Dodaj
                  </Button>
                </div>
              </div>
            )}

            {rateLimits.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Brak skonfigurowanych limitów. Używane są domyślne limity systemowe.
              </p>
            ) : (
              <div className="space-y-2">
                {rateLimits.map((limit) => (
                  <div
                    key={limit.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{limit.rule_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {limit.limit_value}{' '}
                        {LIMIT_TYPES.find((t) => t.id === limit.limit_type)?.label}
                        {limit.applies_to !== 'all' && ` (${limit.applies_to})`}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteRateLimit(limit.id)}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              Ustawienia zaawansowane
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maksymalna liczba tokenów na zapytanie
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
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Retencja danych (dni)
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
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Logi AI starsze niż ta liczba dni będą automatycznie usuwane
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
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Pozwól na wyszukiwanie w internecie
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
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Pozwól na wykonywanie akcji (MCP Tools)
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
              Zapisz ustawienia
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default AISecuritySettings;
