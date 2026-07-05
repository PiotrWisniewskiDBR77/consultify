/**
 * AIAutoCompleteSettings - Auto-complete & suggestions configuration
 *
 * Rebuilt to use unified SettingsSection pattern.
 *
 * Features:
 *  - Enable/disable auto-suggestions
 *  - Sensitivity slider
 *  - Suggestions in comments toggle
 *  - Trigger contexts (fields, documents, chat)
 */

import { Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsFormRow, SettingsSection, SettingsToggle } from './shared';

interface AutoCompletePreferences {
  enabled: boolean;
  sensitivity: number;
  suggestionsInComments: boolean;
  suggestInDocuments: boolean;
  suggestInChat: boolean;
}

const defaultPreferences: AutoCompletePreferences = {
  enabled: true,
  sensitivity: 0.5,
  suggestionsInComments: true,
  suggestInDocuments: true,
  suggestInChat: true,
};

export const AIAutoCompleteSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AutoCompletePreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AutoCompletePreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await Api.getAIAutoComplete();
        if (!response?.preferences) {
          throw new Error('AI auto-complete response was missing preferences');
        }
        const merged = { ...defaultPreferences, ...response.preferences };
        setPreferences(merged);
        setOriginalPreferences(merged);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load auto-complete settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      setActionError(null);
      await Api.saveAIAutoComplete(preferences);
      const response = await Api.getAIAutoComplete();
      if (!response?.preferences) {
        throw new Error('AI auto-complete save was not confirmed by the server');
      }
      const next = { ...defaultPreferences, ...response.preferences };
      if (JSON.stringify(next) !== JSON.stringify(preferences)) {
        throw new Error('AI auto-complete save was not confirmed by the server');
      }
      setPreferences(next);
      setOriginalPreferences(preferences);
      toast.success(t('settings.ai.autocompleteSaved', 'Auto-complete settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.ai.autocompleteError', 'Failed to save auto-complete settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const update = <K extends keyof AutoCompletePreferences>(
    key: K,
    value: AutoCompletePreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  if (loadError) {
    return (
      <div className={className}>
        <DegradedState title="AI auto-complete unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className={className}>
      {actionError && <Banner variant="danger" title={actionError} className="mb-4" />}

      <SettingsSection
        icon={Zap}
        title={t('settings.ai.autocompleteTitle', 'Auto-Complete & Suggestions')}
        description={t(
          'settings.ai.autocompleteDesc',
          'Configure AI-powered auto-complete behavior and where suggestions appear.'
        )}
        cardId="settings-ai-autocomplete"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Master toggle */}
          <SettingsToggle
            checked={preferences.enabled}
            onChange={(checked) => update('enabled', checked)}
            label={t('settings.ai.enableAutoSuggestions', 'Enable Auto-Suggestions')}
            description={t(
              'settings.ai.enableAutoSuggestionsDesc',
              'Get AI-powered suggestions as you type across the application.'
            )}
          />

          {preferences.enabled && (
            <>
              <SettingsDivider />

              {/* Sensitivity */}
              <SettingsFormRow
                label={t('settings.ai.sensitivity', 'Suggestion Sensitivity')}
                description={t(
                  'settings.ai.sensitivityDesc',
                  'Higher sensitivity triggers suggestions more frequently.'
                )}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={preferences.sensitivity}
                      onChange={(e) => update('sensitivity', Number(e.target.value))}
                      className="flex-1 accent-c-accent"
                    />
                    <span className="text-sm font-mono text-white w-12 text-right">
                      {Math.round(preferences.sensitivity * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-c-text-muted">
                    <span>{t('settings.ai.lessFrequent', 'Less Frequent')}</span>
                    <span>{t('settings.ai.moreFrequent', 'More Frequent')}</span>
                  </div>
                </div>
              </SettingsFormRow>

              <SettingsDivider />

              {/* Context toggles */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-4">
                  {t('settings.ai.suggestIn', 'Show Suggestions In')}
                </h4>
                <div className="space-y-4">
                  <SettingsToggle
                    checked={preferences.suggestionsInComments}
                    onChange={(checked) => update('suggestionsInComments', checked)}
                    label={t('settings.ai.suggestComments', 'Comments & Discussions')}
                    description={t(
                      'settings.ai.suggestCommentsDesc',
                      'Show AI suggestions when writing comments on tasks and artifacts.'
                    )}
                  />
                  <SettingsToggle
                    checked={preferences.suggestInDocuments}
                    onChange={(checked) => update('suggestInDocuments', checked)}
                    label={t('settings.ai.suggestDocuments', 'Documents & Reports')}
                    description={t(
                      'settings.ai.suggestDocumentsDesc',
                      'Suggest completions when editing documents and report content.'
                    )}
                  />
                  <SettingsToggle
                    checked={preferences.suggestInChat}
                    onChange={(checked) => update('suggestInChat', checked)}
                    label={t('settings.ai.suggestChat', 'AI Chat Input')}
                    description={t(
                      'settings.ai.suggestChatDesc',
                      'Auto-complete prompts in the AI chat interface.'
                    )}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIAutoCompleteSettings;
