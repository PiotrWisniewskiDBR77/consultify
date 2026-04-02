/**
 * AIModelParametersSettings - Unified model selection + parameters
 *
 * Merges former AIModelSelectionSettings + AIParametersSettings.
 * Removes duplicate "Response Speed" (now in AIBehaviorSettings as "Response Style").
 * Removes duplicate "Context Window Size" (now in AIBehaviorSettings as "Max Context Length").
 *
 * Sections:
 *  1. Model Selection (enable/disable, set preferred)
 *  2. Generation Parameters (temperature, max tokens)
 */

import { Brain, CheckCircle, Circle, Info, Sparkles } from 'lucide-react';
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
} from './shared';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  tier: 'standard' | 'premium';
}

interface ModelParametersPreferences {
  enabledModels: string[];
  preferredModel: string | null;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_MODELS: ModelInfo[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', description: 'Most capable model', tier: 'premium' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', description: 'Fast and efficient', tier: 'standard' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', description: 'Best for complex tasks', tier: 'premium' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', description: 'Balanced performance', tier: 'standard' },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', description: "Google's latest model", tier: 'standard' },
];

const defaultPreferences: ModelParametersPreferences = {
  enabledModels: ['gpt-4', 'gpt-3.5-turbo'],
  preferredModel: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
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
          enabledModels: modelRes?.preferences?.enabledModels || defaultPreferences.enabledModels,
          preferredModel: modelRes?.preferences?.preferredModel || defaultPreferences.preferredModel,
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
          {/* Model Selection */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">
              {t('settings.ai.availableModels', 'Available Models')}
            </h4>
            <div className="space-y-2">
              {DEFAULT_MODELS.map((model) => {
                const isEnabled = preferences.enabledModels.includes(model.id);
                const isPreferred = preferences.preferredModel === model.id;

                return (
                  <div
                    key={model.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer',
                      isEnabled
                        ? 'border-violet-500/40 bg-violet-600/5'
                        : 'border-white/5 bg-navy-900/30 hover:border-white/10'
                    )}
                    onClick={() => toggleModel(model.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex-shrink-0',
                          isEnabled ? 'text-violet-400' : 'text-slate-600'
                        )}
                      >
                        {isEnabled ? <CheckCircle size={18} /> : <Circle size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{model.name}</span>
                          {model.tier === 'premium' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                              PRO
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
                    {isEnabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreferred(model.id);
                        }}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md transition-colors',
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
              })}
            </div>
          </div>

          {/* Info box */}
          <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-3">
            <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-300/80">
              {t(
                'settings.ai.modelInfo',
                'Enable multiple models and switch between them. The preferred model is used by default across all AI features.'
              )}
            </p>
          </div>

          <SettingsDivider />

          {/* Generation Parameters */}
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
