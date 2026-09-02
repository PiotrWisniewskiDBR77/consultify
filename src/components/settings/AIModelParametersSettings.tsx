/**
 * AIModelParametersSettings - Model selection + generation parameters
 *
 * Fetches available models from /api/ai-settings/available-models (real backend).
 * Fetches/saves user preferences via /api/ai-settings/user (real backend).
 * No hardcoded model lists — everything comes from llm_providers table managed by SuperAdmin.
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
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsFormRow, SettingsInput, SettingsSection } from './shared';

interface LLMProvider {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  endpoint: string | null;
  tier: string;
  visibility: string;
  is_active: boolean | number;
  is_default: boolean | number;
  cost_per_1k: number;
  context_window: number;
}

interface UserModelPrefs {
  preferredModelId: string | null;
  visibleModelIds: string[];
  temperature: number;
  maxTokens: number;
}

const TIER_BADGE: Record<string, { label: string; className: string } | null> = {
  PLATFORM: {
    label: 'PLATFORM',
    className: 'bg-navy-900 text-white dark:bg-c-surface dark:text-navy-950',
  },
  PREMIUM: { label: 'PRO', className: 'bg-amber-500/20 text-amber-400' },
  REASONING: { label: 'REASONING', className: 'bg-blue-500/20 text-blue-400' },
  STANDARD: null,
  BUDGET: null,
};

const groupModels = (models: LLMProvider[]) => {
  const platform: LLMProvider[] = [];
  const cloud: LLMProvider[] = [];
  const local: LLMProvider[] = [];

  for (const m of models) {
    if (m.provider === 'dbr77' || m.tier === 'PLATFORM') {
      platform.push(m);
    } else if (m.provider === 'ollama') {
      local.push(m);
    } else {
      cloud.push(m);
    }
  }

  return { platform, cloud, local };
};

const mapUserSettingsToPrefs = (
  userSettings: Record<string, unknown> | null | undefined,
  modelList: LLMProvider[]
): UserModelPrefs => {
  const loaded: UserModelPrefs = {
    preferredModelId:
      typeof userSettings?.preferred_model_id === 'string' ? userSettings.preferred_model_id : null,
    visibleModelIds: Array.isArray(userSettings?.visible_model_ids)
      ? (userSettings.visible_model_ids as string[])
      : [],
    temperature:
      typeof userSettings?.model_temperature === 'number' ? userSettings.model_temperature : 0.7,
    maxTokens: typeof userSettings?.max_tokens === 'number' ? userSettings.max_tokens : 4096,
  };

  if (loaded.visibleModelIds.length === 0 && modelList.length > 0) {
    loaded.visibleModelIds = modelList.map((m) => m.id);
  }

  return loaded;
};

const prefsMatch = (left: UserModelPrefs, right: UserModelPrefs) =>
  JSON.stringify(left) === JSON.stringify(right);

export const AIModelParametersSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [models, setModels] = useState<LLMProvider[]>([]);
  const [prefs, setPrefs] = useState<UserModelPrefs>({
    preferredModelId: null,
    visibleModelIds: [],
    temperature: 0.7,
    maxTokens: 4096,
  });
  const [originalPrefs, setOriginalPrefs] = useState<UserModelPrefs>(prefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(originalPrefs);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const [availableModels, userSettings] = await Promise.all([
          Api.getAIAvailableModels(),
          Api.getAIUserSettings(),
        ]);

        const modelList: LLMProvider[] = Array.isArray(availableModels) ? availableModels : [];
        setModels(modelList);

        const loaded = mapUserSettingsToPrefs(userSettings, modelList);

        setPrefs(loaded);
        setOriginalPrefs(loaded);
      } catch (err: unknown) {
        setModels([]);
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load model settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Api.updateAIUserSettings({
        preferred_model_id: prefs.preferredModelId,
        visible_model_ids: prefs.visibleModelIds,
        model_temperature: prefs.temperature,
        max_tokens: prefs.maxTokens,
      });
      const persistedSettings = await Api.getAIUserSettings();
      const persistedPrefs = mapUserSettingsToPrefs(persistedSettings, models);
      if (!prefsMatch(persistedPrefs, prefs)) {
        throw new Error('Model preferences were not confirmed by the server');
      }
      setPrefs(persistedPrefs);
      setOriginalPrefs(persistedPrefs);
      toast.success(t('settings.ai.modelParamsSaved', 'Model & parameters saved'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.ai.modelParamsError', 'Failed to save model & parameters')
        )
      );
    } finally {
      setSaving(false);
    }
  }, [models, prefs, t]);

  const toggleModel = (modelId: string) => {
    setPrefs((prev) => {
      const isEnabled = prev.visibleModelIds.includes(modelId);
      const visibleModelIds = isEnabled
        ? prev.visibleModelIds.filter((id) => id !== modelId)
        : [...prev.visibleModelIds, modelId];
      const preferredModelId =
        isEnabled && prev.preferredModelId === modelId ? null : prev.preferredModelId;
      return { ...prev, visibleModelIds, preferredModelId };
    });
  };

  const setPreferred = (modelId: string) => {
    setPrefs((prev) => ({
      ...prev,
      preferredModelId: prev.preferredModelId === modelId ? null : modelId,
    }));
  };

  const { platform, cloud, local } = groupModels(models);

  const renderModelRow = (model: LLMProvider) => {
    const isEnabled = prefs.visibleModelIds.includes(model.id);
    const isPreferred = prefs.preferredModelId === model.id;
    const tierBadge = TIER_BADGE[model.tier] || null;
    const isPlatform = model.provider === 'dbr77' || model.tier === 'PLATFORM';
    const isOllama = model.provider === 'ollama';

    return (
      <div
        key={model.id}
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer',
          isEnabled
            ? isPlatform
              ? 'border-c-accent bg-gradient-to-r from-c-accent-soft to-c-accent-soft'
              : 'border-c-accent bg-c-accent-soft'
            : 'border-c-border-subtle bg-c-surface-raised hover:border-c-border-subtle dark:hover:border-white/10'
        )}
        onClick={() => toggleModel(model.id)}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex-shrink-0',
              isEnabled ? (isPlatform ? 'text-c-accent' : 'text-c-accent') : 'text-c-text-secondary'
            )}
          >
            {isEnabled ? <CheckCircle size={18} /> : <Circle size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'text-sm font-medium',
                  isPlatform ? 'text-c-text-muted' : 'text-white'
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
              {isOllama && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded">
                  LOCAL
                </span>
              )}
              {isPreferred && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-navy-900 text-white rounded dark:bg-c-surface dark:text-navy-950">
                  {t('settings.ai.preferred', 'PREFERRED')}
                </span>
              )}
            </div>
            <span className="text-xs text-c-text-muted">
              {model.provider} &middot; {model.model_id}
              {model.context_window > 0 &&
                ` &middot; ${(model.context_window / 1000).toFixed(0)}K ctx`}
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
              'px-2.5 py-1 text-xs rounded-md transition-colors flex-shrink-0',
              isPreferred
                ? 'bg-navy-900 text-white dark:bg-c-surface dark:text-navy-950'
                : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised hover:text-c-text'
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

  const renderSection = (
    title: string,
    icon: React.ElementType,
    iconColor: string,
    sectionModels: LLMProvider[],
    extra?: React.ReactNode
  ) => {
    if (sectionModels.length === 0) return null;
    const Icon = icon;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Icon size={14} className={iconColor} />
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <span className="text-[10px] text-c-text-muted">({sectionModels.length})</span>
        </div>
        <div className="space-y-2">{sectionModels.map(renderModelRow)}</div>
        {extra}
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
          'Choose AI models and fine-tune generation parameters. Models are managed by your organization administrator.'
        )}
        cardId="settings-ai-model-params"
        isDirty={isDirty}
        onSave={loadError ? undefined : handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Error state */}
          {loadError && (
            <DegradedState title="AI model preferences unavailable" description={loadError} />
          )}

          {/* Empty state */}
          {!loadError && models.length === 0 && !loading && (
            <div className="text-center py-8">
              <Brain size={32} className="text-c-text-secondary mx-auto mb-3" />
              <p className="text-sm text-c-text-secondary">
                {t(
                  'settings.ai.noModels',
                  'No AI models are configured yet. Contact your administrator to enable models.'
                )}
              </p>
            </div>
          )}

          {/* Platform models */}
          {!loadError &&
            renderSection(
              t('settings.ai.platformModel', 'Platform Model'),
              Zap,
              'text-c-accent',
              platform,
              platform.length > 0 && (
                <div className="mt-3 p-3 bg-gradient-to-r from-c-accent-soft to-c-accent-soft border border-c-accent rounded-lg">
                  <div className="flex items-start gap-3">
                    <Sparkles size={16} className="text-c-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-c-accent font-medium mb-1">
                        Vector DBR77 — Platform AI
                      </p>
                      <p className="text-xs text-c-text-secondary leading-relaxed">
                        {t(
                          'settings.ai.vectorDesc',
                          'Optimized for consulting workflows: interview analysis, report generation, and strategic recommendations.'
                        )}
                      </p>
                      <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 text-[10px] font-medium bg-c-surface text-c-text-muted rounded-full">
                        {t('settings.ai.platformModelBadge', 'Platform AI model')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}

          {!loadError && platform.length > 0 && (cloud.length > 0 || local.length > 0) && (
            <SettingsDivider />
          )}

          {/* Cloud models */}
          {!loadError &&
            renderSection(
              t('settings.ai.cloudModels', 'Cloud Providers'),
              Globe,
              'text-blue-400',
              cloud
            )}

          {!loadError && cloud.length > 0 && local.length > 0 && <SettingsDivider />}

          {/* Local models */}
          {!loadError &&
            renderSection(
              t('settings.ai.localModels', 'Local Models'),
              HardDrive,
              'text-emerald-400',
              local,
              local.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
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
              )
            )}

          {!loadError && models.length > 0 && (
            <>
              {/* Info box */}
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-3">
                <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-300/80">
                  {t(
                    'settings.ai.modelInfo',
                    'Enable models you want to use and set one as preferred. Available models are managed by your organization administrator via SuperAdmin.'
                  )}
                </p>
              </div>

              <SettingsDivider />

              {/* Generation Parameters */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles size={14} className="text-c-text-secondary" />
                  {t('settings.ai.generationParams', 'Generation Parameters')}
                </h4>

                <div className="space-y-5">
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
                          value={prefs.temperature}
                          onChange={(e) =>
                            setPrefs((prev) => ({ ...prev, temperature: Number(e.target.value) }))
                          }
                          className="flex-1 accent-c-accent"
                        />
                        <span className="text-sm font-mono text-white w-10 text-right">
                          {prefs.temperature.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-c-text-muted">
                        <span>{t('settings.ai.focused', 'Focused')}</span>
                        <span>{t('settings.ai.creative', 'Creative')}</span>
                      </div>
                    </div>
                  </SettingsFormRow>

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
                      value={prefs.maxTokens}
                      onChange={(e) =>
                        setPrefs((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))
                      }
                    />
                  </SettingsFormRow>
                </div>
              </div>
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIModelParametersSettings;
