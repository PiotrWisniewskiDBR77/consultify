/**
 * AIModelSelectionSettings - AI model selection
 *
 * Features:
 * - Select enabled models
 * - Set preferred model
 * - Model information display
 */

import { AlertCircle, Brain, CheckCircle, Circle, Info, Loader2, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface AIModelSelectionSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface AIModelPreferences {
  enabledModels: string[];
  preferredModel: string | null;
}

// Available models - fetched from API in component
// Fallback list if API is unavailable
const DEFAULT_MODELS = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', description: 'Most capable model' },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    description: 'Fast and efficient',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    description: 'Best for complex tasks',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    description: 'Balanced performance',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    description: "Google's latest model",
  },
] as const;

export const AIModelSelectionSettings: React.FC<AIModelSelectionSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [preferredModel, setPreferredModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await Api.getAIModelPreferences();
        if (response?.preferences && typeof response.preferences === 'object') {
          const prefs = response.preferences;
          setEnabledModels(Array.isArray(prefs.enabledModels) ? prefs.enabledModels : []);
          setPreferredModel(prefs.preferredModel || '');
        }
      } catch (err) {
        console.error('Failed to load AI model preferences', err);
      }
    };
    loadPreferences();
  }, []);

  const toggleModel = (modelId: string) => {
    if (enabledModels.includes(modelId)) {
      setEnabledModels(enabledModels.filter((id) => id !== modelId));
      if (preferredModel === modelId) {
        setPreferredModel('');
      }
    } else {
      setEnabledModels([...enabledModels, modelId]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await Api.saveAIModelPreferences({
        enabledModels,
        preferredModel: preferredModel || null,
      });

      setSaveStatus('success');
      toast.success(t('settings.ai.modelSelection.saved', 'Model preferences saved'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(
        error.message || t('settings.ai.modelSelection.error', 'Failed to save model preferences')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2 flex items-center gap-2">
          <Brain size={20} />
          {t('settings.ai.modelSelection.title', 'AI Model Selection')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t(
            'settings.ai.modelSelection.subtitle',
            'Choose which AI models are available and set your preferred model'
          )}
        </p>
      </div>

      {/* Available Models */}
      <div className="space-y-3">
        {DEFAULT_MODELS.map((model) => {
          const isEnabled = enabledModels.includes(model.id);
          const isPreferred = preferredModel === model.id;

          return (
            <div
              key={model.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                isEnabled
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => toggleModel(model.id)}
                    className={`mt-0.5 ${isEnabled ? 'text-c-accent' : 'text-c-text-muted'}`}
                  >
                    {isEnabled ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-c-text">
                        {model.name}
                      </h4>
                      {isPreferred && (
                        <span className="px-2 py-0.5 bg-navy-900 text-white text-xs rounded-full dark:bg-c-surface dark:text-navy-950">
                          {t('settings.ai.modelSelection.preferred', 'Preferred')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-c-text-muted mt-0.5">
                      {model.provider} • {model.description}
                    </p>
                  </div>
                </div>
                {isEnabled && (
                  <button
                    onClick={() => setPreferredModel(isPreferred ? '' : model.id)}
                    className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                      isPreferred
                        ? 'bg-navy-900 text-white dark:bg-c-surface dark:text-navy-950'
                        : 'bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                    }`}
                  >
                    {isPreferred
                      ? t('settings.ai.modelSelection.setAsPreferred', 'Preferred')
                      : t('settings.ai.modelSelection.setPreferred', 'Set as Preferred')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="p-4 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg flex items-start gap-3">
        <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">
            {t('settings.ai.modelSelection.infoTitle', 'About Model Selection')}
          </p>
          <p className="text-xs">
            {t(
              'settings.ai.modelSelection.infoDesc',
              'You can enable multiple models and switch between them. The preferred model will be used by default.'
            )}
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving || enabledModels.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('common.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save size={16} />
              {t('common.save', 'Save')}
            </>
          )}
        </button>
      </div>

      {/* Success/Error Messages */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
          <CheckCircle size={16} />
          {t('settings.ai.modelSelection.saved', 'Model preferences saved')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.ai.modelSelection.error', 'Failed to save model preferences')}
        </div>
      )}
    </div>
  );
};

export default AIModelSelectionSettings;
