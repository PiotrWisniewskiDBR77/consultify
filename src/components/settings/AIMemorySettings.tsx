/**
 * AIMemorySettings - AI memory & context management
 *
 * Rebuilt to use unified SettingsSection pattern.
 *
 * Features:
 *  - Enable/disable memory
 *  - Retention period
 *  - What to remember (conversations, preferences, context)
 *  - Clear memory (destructive action)
 *  - Memory stats
 */

import { AlertTriangle, Database, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import {
  SettingsDivider,
  SettingsFormRow,
  SettingsInput,
  SettingsSection,
  SettingsToggle,
} from './shared';

interface AIMemoryPreferences {
  enabled: boolean;
  retentionDays: number;
  includeConversations: boolean;
  includePreferences: boolean;
  includeContext: boolean;
}

const defaultPreferences: AIMemoryPreferences = {
  enabled: true,
  retentionDays: 30,
  includeConversations: true,
  includePreferences: true,
  includeContext: true,
};

const preferencesMatch = (left: AIMemoryPreferences, right: AIMemoryPreferences) =>
  JSON.stringify(left) === JSON.stringify(right);

export const AIMemorySettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIMemoryPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AIMemoryPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await Api.getAIMemory();
        if (!response?.preferences) {
          throw new Error('AI memory preferences were not returned by the server');
        }
        const merged = { ...defaultPreferences, ...response.preferences };
        setPreferences(merged);
        setOriginalPreferences(merged);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load AI memory settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Api.saveAIMemory(preferences);
      const response = await Api.getAIMemory();
      if (!response?.preferences) {
        throw new Error('AI memory save was not confirmed by the server');
      }
      const persisted = { ...defaultPreferences, ...response.preferences };
      if (!preferencesMatch(persisted, preferences)) {
        throw new Error('AI memory settings were not confirmed by the server');
      }
      setPreferences(persisted);
      setOriginalPreferences(persisted);
      toast.success(t('settings.ai.memorySaved', 'AI memory settings saved'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.ai.memoryError', 'Failed to save memory settings')
        )
      );
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const handleClearMemory = async () => {
    setClearing(true);
    try {
      await Api.clearAIMemoryData();
      toast.success(t('settings.ai.memoryCleared', 'AI memory cleared'));
      setShowClearConfirm(false);
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(error, t('settings.ai.memoryClearError', 'Failed to clear memory'))
      );
    } finally {
      setClearing(false);
    }
  };

  const update = <K extends keyof AIMemoryPreferences>(key: K, value: AIMemoryPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className={className}>
      <SettingsSection
        icon={Database}
        title={t('settings.ai.memoryTitle', 'Memory & Context')}
        description={t(
          'settings.ai.memoryDesc',
          'Control how the AI remembers and uses context from your conversations and activity.'
        )}
        cardId="settings-ai-memory"
        isDirty={isDirty}
        onSave={loadError ? undefined : handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {loadError && (
            <DegradedState title="AI memory settings unavailable" description={loadError} />
          )}

          {!loadError && (
            <>
              {/* Master toggle */}
              <SettingsToggle
                checked={preferences.enabled}
                onChange={(checked) => update('enabled', checked)}
                label={t('settings.ai.enableMemory', 'Enable Memory')}
                description={t(
                  'settings.ai.enableMemoryDesc',
                  'AI will remember context across conversations to provide more personalized responses.'
                )}
              />

              {preferences.enabled && (
                <>
                  <SettingsDivider />

                  {/* Retention */}
                  <SettingsFormRow
                    label={t('settings.ai.retentionDays', 'Memory Retention')}
                    description={t(
                      'settings.ai.retentionDaysDesc',
                      'Number of days to retain AI memory before automatic cleanup (1–365).'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <SettingsInput
                        type="number"
                        min={1}
                        max={365}
                        value={preferences.retentionDays}
                        onChange={(e) => update('retentionDays', parseInt(e.target.value) || 30)}
                        className="w-28"
                      />
                      <span className="text-sm text-slate-500">
                        {t('settings.ai.days', 'days')}
                      </span>
                    </div>
                  </SettingsFormRow>

                  <SettingsDivider />

                  {/* What to remember */}
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-4">
                      {t('settings.ai.whatToRemember', 'What to Remember')}
                    </h4>
                    <div className="space-y-4">
                      <SettingsToggle
                        checked={preferences.includeConversations}
                        onChange={(checked) => update('includeConversations', checked)}
                        label={t('settings.ai.rememberConversations', 'Conversations')}
                        description={t(
                          'settings.ai.rememberConversationsDesc',
                          'Remember key points and decisions from past AI conversations.'
                        )}
                      />
                      <SettingsToggle
                        checked={preferences.includePreferences}
                        onChange={(checked) => update('includePreferences', checked)}
                        label={t('settings.ai.rememberPreferences', 'User Preferences')}
                        description={t(
                          'settings.ai.rememberPreferencesDesc',
                          'Learn your preferences over time (formatting, terminology, workflow).'
                        )}
                      />
                      <SettingsToggle
                        checked={preferences.includeContext}
                        onChange={(checked) => update('includeContext', checked)}
                        label={t('settings.ai.rememberContext', 'Project Context')}
                        description={t(
                          'settings.ai.rememberContextDesc',
                          'Retain context about your projects, tasks, and organizational structure.'
                        )}
                      />
                    </div>
                  </div>
                </>
              )}

              <SettingsDivider />

              {/* Danger zone: Clear Memory */}
              <div className="p-4 border border-rose-500/20 rounded-lg bg-rose-500/5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-rose-300">
                        {t('settings.ai.dangerZone', 'Danger Zone')}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {t(
                          'settings.ai.clearMemoryWarning',
                          'Permanently delete all AI memory data. This action cannot be undone.'
                        )}
                      </p>
                    </div>
                  </div>
                  {!showClearConfirm ? (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                    border border-rose-500/30 text-rose-400 rounded-lg
                    hover:bg-rose-500/10 transition-colors flex-shrink-0"
                    >
                      <Trash2 size={14} />
                      {t('settings.ai.clearMemory', 'Clear All Memory')}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={handleClearMemory}
                        disabled={clearing}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium
                      bg-rose-600 text-white rounded-lg hover:bg-rose-500
                      disabled:opacity-50 transition-colors"
                      >
                        {clearing ? (
                          <span className="animate-spin h-3 w-3 border-2 border-white/60 border-t-transparent rounded-full" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        {t('settings.ai.confirmClear', 'Yes, Clear Everything')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIMemorySettings;
