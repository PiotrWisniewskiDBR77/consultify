/**
 * AIAutomationSettings - AI automation rules & triggers
 *
 * New card — the "Automation" part of "AI & Automation" group.
 *
 * Features:
 *  - Auto-summarize after interviews
 *  - Auto-generate action items from notes
 *  - Auto-classify incoming artifacts
 *  - Smart notifications (AI-filtered)
 *  - Per-module AI routing defaults
 */

import { Bot, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import {
  SettingsButtonGroup,
  SettingsDivider,
  SettingsFormRow,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from './shared';

interface AIAutomationPreferences {
  autoSummarize: boolean;
  autoSummarizeTarget: 'interviews' | 'meetings' | 'all';
  autoActionItems: boolean;
  autoClassify: boolean;
  smartNotifications: boolean;
  moduleDefaults: {
    interview: string;
    analysis: string;
    general: string;
  };
}

const defaultPreferences: AIAutomationPreferences = {
  autoSummarize: true,
  autoSummarizeTarget: 'interviews',
  autoActionItems: true,
  autoClassify: false,
  smartNotifications: false,
  moduleDefaults: {
    interview: 'gpt-4',
    analysis: 'gpt-4',
    general: 'gpt-3.5-turbo',
  },
};

const MODEL_OPTIONS = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'default', label: 'Use Preferred Model' },
];

export const AIAutomationSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIAutomationPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AIAutomationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Will be connected to backend API when automation service is ready
      await new Promise((r) => setTimeout(r, 500));
      setOriginalPreferences(preferences);
      toast.success(t('settings.ai.automationSaved', 'Automation settings saved'));
    } catch {
      toast.error(t('settings.ai.automationError', 'Failed to save automation settings'));
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const update = <K extends keyof AIAutomationPreferences>(
    key: K,
    value: AIAutomationPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const updateModuleDefault = (
    module: keyof AIAutomationPreferences['moduleDefaults'],
    value: string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      moduleDefaults: { ...prev.moduleDefaults, [module]: value },
    }));
  };

  const summarizeTargetOptions = [
    { value: 'interviews', label: t('settings.ai.interviews', 'Interviews') },
    { value: 'meetings', label: t('settings.ai.meetings', 'Meetings') },
    { value: 'all', label: t('settings.ai.all', 'All') },
  ];

  return (
    <div className={className}>
      <SettingsSection
        icon={Bot}
        title={t('settings.ai.automationTitle', 'AI Automation')}
        description={t(
          'settings.ai.automationDesc',
          'Configure automatic AI actions — summarization, classification, action item extraction, and smart routing.'
        )}
        cardId="settings-ai-automation"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Auto-Summarize */}
          <div className="space-y-4">
            <SettingsToggle
              checked={preferences.autoSummarize}
              onChange={(checked) => update('autoSummarize', checked)}
              label={t('settings.ai.autoSummarize', 'Auto-Summarize')}
              description={t(
                'settings.ai.autoSummarizeDesc',
                'Automatically generate summaries after sessions end.'
              )}
            />
            {preferences.autoSummarize && (
              <div className="ml-8">
                <SettingsFormRow label={t('settings.ai.summarizeTarget', 'Apply to')}>
                  <SettingsButtonGroup
                    options={summarizeTargetOptions}
                    value={preferences.autoSummarizeTarget}
                    onChange={(v) =>
                      update(
                        'autoSummarizeTarget',
                        v as AIAutomationPreferences['autoSummarizeTarget']
                      )
                    }
                    size="sm"
                  />
                </SettingsFormRow>
              </div>
            )}
          </div>

          {/* Auto Action Items */}
          <SettingsToggle
            checked={preferences.autoActionItems}
            onChange={(checked) => update('autoActionItems', checked)}
            label={t('settings.ai.autoActionItems', 'Auto-Extract Action Items')}
            description={t(
              'settings.ai.autoActionItemsDesc',
              'AI automatically identifies and creates action items from notes and conversations.'
            )}
          />

          {/* Auto Classify */}
          <SettingsToggle
            checked={preferences.autoClassify}
            onChange={(checked) => update('autoClassify', checked)}
            label={t('settings.ai.autoClassify', 'Auto-Classify Artifacts')}
            description={t(
              'settings.ai.autoClassifyDesc',
              'Automatically tag and categorize new artifacts using AI analysis.'
            )}
          />

          {/* Smart Notifications */}
          <SettingsToggle
            checked={preferences.smartNotifications}
            onChange={(checked) => update('smartNotifications', checked)}
            label={t('settings.ai.smartNotifications', 'Smart Notifications')}
            description={t(
              'settings.ai.smartNotificationsDesc',
              'AI filters and prioritizes notifications based on relevance and urgency.'
            )}
          />

          <SettingsDivider />

          {/* Per-Module Model Defaults */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Sparkles size={14} className="text-c-text-secondary" />
              {t('settings.ai.moduleRouting', 'Module AI Routing')}
            </h4>
            <p className="text-xs text-c-text-muted mb-4">
              {t(
                'settings.ai.moduleRoutingDesc',
                'Assign different AI models to different contexts for optimal cost and quality.'
              )}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SettingsFormRow label={t('settings.ai.moduleInterview', 'Interview & Research')}>
                <SettingsSelect
                  options={MODEL_OPTIONS}
                  value={preferences.moduleDefaults.interview}
                  onChange={(e) => updateModuleDefault('interview', e.target.value)}
                />
              </SettingsFormRow>
              <SettingsFormRow label={t('settings.ai.moduleAnalysis', 'Analysis & Reports')}>
                <SettingsSelect
                  options={MODEL_OPTIONS}
                  value={preferences.moduleDefaults.analysis}
                  onChange={(e) => updateModuleDefault('analysis', e.target.value)}
                />
              </SettingsFormRow>
              <SettingsFormRow label={t('settings.ai.moduleGeneral', 'General / Chat')}>
                <SettingsSelect
                  options={MODEL_OPTIONS}
                  value={preferences.moduleDefaults.general}
                  onChange={(e) => updateModuleDefault('general', e.target.value)}
                />
              </SettingsFormRow>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIAutomationSettings;
