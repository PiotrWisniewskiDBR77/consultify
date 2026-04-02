/**
 * AIModelParametersSettings - Unified model selection + parameters
 *
 * Models grouped into 3 sections:
 *  1. Platform — Vector DBR77 (beta, managed by SuperAdmin)
 *  2. Cloud Providers — OpenAI, Anthropic, Google
 *  3. Local — Ollama (user-configured endpoint)
 *
 * Generation parameters: temperature, max tokens
 */

import {
  Brain,
  CheckCircle,
  Circle,
  ExternalLink,
  Globe,
  HardDrive,
  Info,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import {
  SettingsDivider,
  SettingsFormRow,
  SettingsInput,
  SettingsSection,
  SettingsToggle,
} from './shared';

type ModelTier = 'platform' | 'standard' | 'premium' | 'local';
type ModelStatus = 'available' | 'beta' | 'coming-soon' | 'requires-setup';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  tier: ModelTier;
  status: ModelStatus;
  icon?: React.ElementType;
}

interface ModelParametersPreferences {
  enabledModels: string[];
  preferredModel: string | null;
  temperature: number;
  maxTokens: number;
  ollamaEnabled: boolean;
  ollamaEndpoint: string;
  ollamaModel: string;
}

const PLATFORM_MODELS: ModelInfo[] = [
  {
    id: 'vector-dbr77',
    name: 'Vector DBR77',
    provider: 'DBR77',
    description: 'Platform-native AI model optimized for consulting workflows',
    tier: 'platform',
    status: 'beta',
    icon: Zap,
  },
];

const CLOUD_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'Most capable model',
    tier: 'premium',
    status: 'available',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Faster GPT-4 with 128K context',
    tier: 'premium',
    status: 'available',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and cost-efficient',
    tier: 'standard',
    status: 'available',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Best for complex reasoning',
    tier: 'premium',
    status: 'available',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance',
    tier: 'standard',
    status: 'available',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    description: "Google's latest model",
    tier: 'standard',
    status: 'available',
  },
];

const LOCAL_MODELS: ModelInfo[] = [
  {
    id: 'ollama-local',
    name: 'Ollama',
    provider: 'Local',
    description: 'Run open-source models locally — Llama 3, Mistral, Phi-3, etc.',
    tier: 'local',
    status: 'requires-setup',
    icon: HardDrive,
  },
];

const defaultPreferences: ModelParametersPreferences = {
  enabledModels: ['vector-dbr77', 'gpt-4', 'gpt-3.5-turbo'],
  preferredModel: 'vector-dbr77',
  temperature: 0.7,
  maxTokens: 2000,
  ollamaEnabled: false,
  ollamaEndpoint: 'http://localhost:11434',
  ollamaModel: 'llama3',
};

const STATUS_BADGE: Record<ModelStatus, { label: string; className: string } | null> = {
  available: null,
  beta: {
    label: 'BETA',
    className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  'coming-soon': {
    label: 'COMING SOON',
    className: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  },
  'requires-setup': {
    label: 'SETUP REQUIRED',
    className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  },
};

const TIER_BADGE: Record<ModelTier, { label: string; className: string } | null> = {
  platform: {
    label: 'PLATFORM',
    className: 'bg-violet-600 text-white',
  },
  premium: {
    label: 'PRO',
    className: 'bg-amber-500/20 text-amber-400',
  },
  standard: null,
  local: {
    label: 'LOCAL',
    className: 'bg-emerald-500/20 text-emerald-400',
  },
};

export const AIModelParametersSettings: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<ModelParametersPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<ModelParametersPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [modelRes, paramRes] = await Promise.all([
          Api.getAIModelPreferences(),
          Api.getAIParameters(),
        ]);
        const merged: ModelParametersPreferences = {
          ...defaultPreferences,
          enabledModels: modelRes?.preferences?.enabledModels || defaultPreferences.enabledModels,
          preferredModel:
            modelRes?.preferences?.preferredModel || defaultPreferences.preferredModel,
          temperature: paramRes?.preferences?.temperature ?? defaultPreferences.temperature,
          maxTokens: paramRes?.preferences?.maxTokens ?? defaultPreferences.maxTokens,
        };
        setPreferences(merged);
        setOriginalPreferences(merged);
      } catch (err) {
        console.error('Failed to load model/parameters:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Promise.all([
        Api.saveAIModelPreferences({
          enabledModels: preferences.enabledModels,
          preferredModel: preferences.preferredModel,
        }),
        Api.saveAIParameters({
          temperature: preferences.temperature,
          maxTokens: preferences.maxTokens,
        }),
      ]);
      setOriginalPreferences(preferences);
      toast.success(t('settings.ai.modelParamsSaved', 'Model & parameters saved'));
    } catch {
      toast.error(t('settings.ai.modelParamsError', 'Failed to save model & parameters'));
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const toggleModel = (modelId: string) => {
    setPreferences((prev) => {
      const isEnabled = prev.enabledModels.includes(modelId);
      const enabledModels = isEnabled
        ? prev.enabledModels.filter((id) => id !== modelId)
        : [...prev.enabledModels, modelId];
      const preferredModel =
        isEnabled && prev.preferredModel === modelId ? null : prev.preferredModel;
      return { ...prev, enabledModels, preferredModel };
    });
  };

  const setPreferred = (modelId: string) => {
    setPreferences((prev) => ({
      ...prev,
      preferredModel: prev.preferredModel === modelId ? null : modelId,
    }));
  };

  const renderModelRow = (model: ModelInfo) => {
    const isEnabled = preferences.enabledModels.includes(model.id);
    const isPreferred = preferences.preferredModel === model.id;
    const statusBadge = STATUS_BADGE[model.status];
    const tierBadge = TIER_BADGE[model.tier];
    const isPlatform = model.tier === 'platform';
    const isLocal = model.id === 'ollama-local';
    const isDisabledToggle = isLocal && !preferences.ollamaEnabled;

    return (
      <div
        key={model.id}
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border transition-all duration-200',
          isLocal && !preferences.ollamaEnabled
            ? 'border-white/5 bg-navy-900/20 opacity-60'
            : isEnabled
              ? isPlatform
                ? 'border-violet-500/50 bg-gradient-to-r from-violet-600/10 to-violet-500/5'
                : 'border-violet-500/40 bg-violet-600/5'
              : 'border-white/5 bg-navy-900/30 hover:border-white/10 cursor-pointer'
        )}
        onClick={() => {
          if (!isDisabledToggle) toggleModel(model.id);
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex-shrink-0',
              isEnabled ? (isPlatform ? 'text-violet-300' : 'text-violet-400') : 'text-slate-600'
            )}
          >
            {isEnabled ? <CheckCircle size={18} /> : <Circle size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'text-sm font-medium',
                  isPlatform ? 'text-violet-200' : 'text-white'
                )}
              >
                {model.name}
              </span>
              {tierBadge && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-semibold rounded',
                    tierBadge.className
                  )}
                >
                  {tierBadge.label}
                </span>
              )}
              {statusBadge && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-medium rounded',
                    statusBadge.className
                  )}
                >
                  {statusBadge.label}
                </span>
              )}
              {isPreferred && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-600 text-white rounded">
                  {t('settings.ai.preferred', 'PREFERRED')}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {model.provider} &middot; {model.description}
            </span>
          </div>
        </div>
        {isEnabled && !isDisabledToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreferred(model.id);
            }}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md transition-colors flex-shrink-0',
              isPreferred
                ? 'bg-violet-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-violet-600/20 hover:text-violet-300'
            )}
          >
            {isPreferred
              ? t('settings.ai.preferred', 'Preferred')
              : t('settings.ai.setPreferred', 'Set Preferred')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <SettingsSection
        icon={Brain}
        title={t('settings.ai.modelParamsTitle', 'Model & Parameters')}
        description={t(
          'settings.ai.modelParamsDesc',
          'Choose AI models and fine-tune generation parameters like temperature and token limits.'
        )}
        cardId="settings-ai-model-params"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* ── Section 1: Platform Model ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-violet-400" />
              <h4 className="text-sm font-semibold text-white">
                {t('settings.ai.platformModel', 'Platform Model')}
              </h4>
            </div>
            <div className="space-y-2">{PLATFORM_MODELS.map(renderModelRow)}</div>

            {/* Vector DBR77 info callout */}
            <div className="mt-3 p-3 bg-gradient-to-r from-violet-600/10 to-indigo-600/5 border border-violet-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-violet-300 font-medium mb-1">
                    {t('settings.ai.vectorInfo', 'Vector DBR77 — Platform AI')}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t(
                      'settings.ai.vectorDesc',
                      'Optimized for consulting workflows: interview analysis, report generation, and strategic recommendations. Currently in beta for early adopters — will be available to all users soon.'
                    )}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      {t('settings.ai.betaActive', 'Beta active for your account')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <SettingsDivider />

          {/* ── Section 2: Cloud Providers ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-blue-400" />
              <h4 className="text-sm font-semibold text-white">
                {t('settings.ai.cloudModels', 'Cloud Providers')}
              </h4>
            </div>
            <div className="space-y-2">{CLOUD_MODELS.map(renderModelRow)}</div>
          </div>

          <SettingsDivider />

          {/* ── Section 3: Local Models (Ollama) ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={14} className="text-emerald-400" />
              <h4 className="text-sm font-semibold text-white">
                {t('settings.ai.localModels', 'Local Models')}
              </h4>
            </div>

            <div className="space-y-3">
              <SettingsToggle
                checked={preferences.ollamaEnabled}
                onChange={(checked) =>
                  setPreferences((prev) => ({
                    ...prev,
                    ollamaEnabled: checked,
                    enabledModels: checked
                      ? [...prev.enabledModels, 'ollama-local']
                      : prev.enabledModels.filter((id) => id !== 'ollama-local'),
                    preferredModel:
                      !checked && prev.preferredModel === 'ollama-local'
                        ? null
                        : prev.preferredModel,
                  }))
                }
                label={t('settings.ai.enableOllama', 'Enable Ollama')}
                description={t(
                  'settings.ai.enableOllamaDesc',
                  'Connect to a local Ollama instance for private, offline AI inference.'
                )}
              />

              {preferences.ollamaEnabled && (
                <div className="ml-0 p-4 bg-navy-900/50 border border-white/5 rounded-lg space-y-4">
                  {renderModelRow(LOCAL_MODELS[0])}

                  <SettingsFormRow
                    label={t('settings.ai.ollamaEndpoint', 'Ollama Endpoint')}
                    description={t(
                      'settings.ai.ollamaEndpointDesc',
                      'URL of your running Ollama server (default: http://localhost:11434).'
                    )}
                  >
                    <SettingsInput
                      value={preferences.ollamaEndpoint}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          ollamaEndpoint: e.target.value,
                        }))
                      }
                      placeholder="http://localhost:11434"
                    />
                  </SettingsFormRow>

                  <SettingsFormRow
                    label={t('settings.ai.ollamaModel', 'Model Name')}
                    description={t(
                      'settings.ai.ollamaModelDesc',
                      'Name of the model to use (e.g., llama3, mistral, phi3, codellama).'
                    )}
                  >
                    <SettingsInput
                      value={preferences.ollamaModel}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          ollamaModel: e.target.value,
                        }))
                      }
                      placeholder="llama3"
                    />
                  </SettingsFormRow>

                  <div className="flex items-center gap-2">
                    <a
                      href="https://ollama.com/library"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink size={12} />
                      {t('settings.ai.browseOllamaModels', 'Browse Ollama model library')}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <SettingsDivider />

          {/* Info box */}
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-3">
            <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-300/80">
              {t(
                'settings.ai.modelInfo',
                'Enable multiple models and switch between them. The preferred model is used by default across all AI features. Platform and local models keep your data private.'
              )}
            </p>
          </div>

          <SettingsDivider />

          {/* ── Generation Parameters ── */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-violet-400" />
              {t('settings.ai.generationParams', 'Generation Parameters')}
            </h4>

            <div className="space-y-5">
              {/* Temperature */}
              <SettingsFormRow
                label={t('settings.ai.temperature', 'Temperature')}
                description={t(
                  'settings.ai.temperatureDesc',
                  'Lower values produce more focused responses, higher values are more creative.'
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={preferences.temperature}
                      onChange={(e) =>
                        setPreferences((prev) => ({
                          ...prev,
                          temperature: Number(e.target.value),
                        }))
                      }
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-sm font-mono text-white w-10 text-right">
                      {preferences.temperature.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{t('settings.ai.focused', 'Focused')}</span>
                    <span>{t('settings.ai.creative', 'Creative')}</span>
                  </div>
                </div>
              </SettingsFormRow>

              {/* Max Tokens */}
              <SettingsFormRow
                label={t('settings.ai.maxTokens', 'Max Tokens per Response')}
                description={t(
                  'settings.ai.maxTokensDesc',
                  'Maximum number of tokens the AI can generate in a single response (100–8000).'
                )}
              >
                <SettingsInput
                  type="number"
                  min={100}
                  max={8000}
                  step={100}
                  value={preferences.maxTokens}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      maxTokens: Number(e.target.value),
                    }))
                  }
                />
              </SettingsFormRow>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIModelParametersSettings;
