/**
 * AIParametersSettings - AI model parameters (temperature, tokens, etc.)
 *
 * Features:
 * - Temperature slider
 * - Max tokens
 * - Context window size
 * - Response speed
 */

import { AlertCircle, CheckCircle, Info, Loader2, Save, Sliders } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface AIParametersSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type ResponseSpeed = 'fast' | 'balanced' | 'detailed';

interface AIParametersPreferences {
  temperature: number;
  maxTokens: number;
  contextWindowSize: number;
  responseSpeed: ResponseSpeed;
}

const RESPONSE_SPEED_OPTIONS = [
  { value: 'fast', label: 'Fast', description: 'Quick responses, less detail' },
  { value: 'balanced', label: 'Balanced', description: 'Good balance of speed and detail' },
  { value: 'detailed', label: 'Detailed', description: 'Slower but more thorough' },
] as const;

export const AIParametersSettings: React.FC<AIParametersSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2000);
  const [contextWindowSize, setContextWindowSize] = useState<number>(4000);
  const [responseSpeed, setResponseSpeed] = useState<ResponseSpeed>('balanced');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await Api.getAIParameters();
        if (response?.preferences && typeof response.preferences === 'object') {
          const prefs = response.preferences;
          setTemperature(prefs.temperature ?? 0.7);
          setMaxTokens(prefs.maxTokens ?? 2000);
          setContextWindowSize(prefs.contextWindowSize ?? 4000);
          setResponseSpeed((prefs.responseSpeed as ResponseSpeed) || 'balanced');
        }
      } catch (err) {
        console.error('Failed to load AI parameters', err);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await Api.saveAIParameters({
        temperature,
        maxTokens,
        contextWindowSize,
        responseSpeed,
      });

      setSaveStatus('success');
      toast.success(t('settings.ai.parameters.saved', 'AI parameters saved'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(
        error.message || t('settings.ai.parameters.error', 'Failed to save AI parameters')
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-c-text mb-2 flex items-center gap-2">
          <Sliders size={20} />
          {t('settings.ai.parameters.title', 'AI Parameters')}
        </h3>
        <p className="text-sm text-c-text-muted">
          {t(
            'settings.ai.parameters.subtitle',
            'Fine-tune AI behavior and response characteristics'
          )}
        </p>
      </div>

      {/* Temperature */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-c-text-secondary">
            {t('settings.ai.parameters.temperature', 'Temperature')}
          </label>
          <span className="text-sm text-c-text-muted">{temperature.toFixed(1)}</span>
        </div>
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-c-text-muted">
            <span>{t('settings.ai.parameters.focused', 'Focused')}</span>
            <span>{t('settings.ai.parameters.creative', 'Creative')}</span>
          </div>
        </div>
        <p className="text-xs text-c-text-muted">
          {t(
            'settings.ai.parameters.temperatureDesc',
            'Lower values make responses more focused, higher values more creative'
          )}
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-c-text-secondary">
            {t('settings.ai.parameters.maxTokens', 'Max Tokens per Response')}
          </label>
          <span className="text-sm text-c-text-muted">{maxTokens.toLocaleString()}</span>
        </div>
        <input
          type="number"
          min="100"
          max="8000"
          step="100"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
      </div>

      {/* Context Window */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-c-text-secondary">
            {t('settings.ai.parameters.contextWindow', 'Context Window Size')}
          </label>
          <span className="text-sm text-c-text-muted">{contextWindowSize.toLocaleString()}</span>
        </div>
        <select
          value={contextWindowSize}
          onChange={(e) => setContextWindowSize(Number(e.target.value))}
          className="w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        >
          <option value="2000">2,000 tokens</option>
          <option value="4000">4,000 tokens</option>
          <option value="8000">8,000 tokens</option>
          <option value="16000">16,000 tokens</option>
          <option value="32000">32,000 tokens</option>
        </select>
      </div>

      {/* Response Speed */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-c-text-secondary">
          {t('settings.ai.parameters.responseSpeed', 'Response Speed')}
        </label>
        <div className="grid grid-cols-3 gap-3">
          {RESPONSE_SPEED_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setResponseSpeed(option.value)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                responseSpeed === option.value
                  ? 'border-c-accent bg-c-accent-soft dark:bg-c-accent-soft'
                  : 'border-c-border-subtle dark:border-navy-700 hover:border-c-accent'
              }`}
            >
              <div
                className={`text-sm font-medium ${
                  responseSpeed === option.value ? 'text-c-accent' : 'text-c-text-secondary'
                }`}
              >
                {option.label}
              </div>
              <div className="text-xs text-c-text-muted mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          {t('settings.ai.parameters.saved', 'AI parameters saved')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.ai.parameters.error', 'Failed to save AI parameters')}
        </div>
      )}
    </div>
  );
};

export default AIParametersSettings;
