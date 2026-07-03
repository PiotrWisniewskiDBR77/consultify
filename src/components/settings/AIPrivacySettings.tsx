/**
 * AIPrivacySettings - AI data & privacy controls
 *
 * New card — critical for consulting platform.
 *
 * Features:
 *  - Data access scope (which data AI can see)
 *  - Training opt-out
 *  - Data retention policy
 *  - Audit log access
 */

import { Eye, EyeOff, Shield } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import {
  SettingsDivider,
  SettingsFormRow,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from './shared';

interface AIPrivacyPreferences {
  allowProjectData: boolean;
  allowClientData: boolean;
  allowFinancialData: boolean;
  allowPersonalNotes: boolean;
  optOutTraining: boolean;
  dataRetention: 'session' | '7d' | '30d' | '90d' | 'unlimited';
  auditLogEnabled: boolean;
  anonymizeExports: boolean;
}

const defaultPreferences: AIPrivacyPreferences = {
  allowProjectData: true,
  allowClientData: true,
  allowFinancialData: false,
  allowPersonalNotes: false,
  optOutTraining: true,
  dataRetention: '30d',
  auditLogEnabled: true,
  anonymizeExports: false,
};

const preferencesMatch = (left: AIPrivacyPreferences, right: AIPrivacyPreferences) =>
  JSON.stringify(left) === JSON.stringify(right);

export const AIPrivacySettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIPrivacyPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AIPrivacyPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const response = await Api.getAIPrivacyPreferences();
        if (!response?.preferences) {
          throw new Error('AI privacy preferences were not returned by the server');
        }
        const merged = { ...defaultPreferences, ...response.preferences };
        setPreferences(merged);
        setOriginalPreferences(merged);
      } catch (error: unknown) {
        setLoadError(normalizeApiErrorMessage(error, 'Failed to load AI privacy settings'));
      } finally {
        setLoading(false);
      }
    };

    void loadPreferences();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Api.saveAIPrivacyPreferences(preferences);
      const response = await Api.getAIPrivacyPreferences();
      if (!response?.preferences) {
        throw new Error('AI privacy save was not confirmed by the server');
      }
      const persisted = { ...defaultPreferences, ...response.preferences };
      if (!preferencesMatch(persisted, preferences)) {
        throw new Error('AI privacy settings were not confirmed by the server');
      }
      setPreferences(persisted);
      setOriginalPreferences(persisted);
      toast.success(t('settings.ai.privacySaved', 'AI privacy settings saved'));
    } catch (error: unknown) {
      toast.error(
        normalizeApiErrorMessage(
          error,
          t('settings.ai.privacyError', 'Failed to save AI privacy settings')
        )
      );
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const update = <K extends keyof AIPrivacyPreferences>(key: K, value: AIPrivacyPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const retentionOptions = [
    { value: 'session', label: t('settings.ai.retentionSession', 'Current session only') },
    { value: '7d', label: t('settings.ai.retention7d', '7 days') },
    { value: '30d', label: t('settings.ai.retention30d', '30 days') },
    { value: '90d', label: t('settings.ai.retention90d', '90 days') },
    { value: 'unlimited', label: t('settings.ai.retentionUnlimited', 'Unlimited') },
  ];

  return (
    <div className={className}>
      <SettingsSection
        icon={Shield}
        title={t('settings.ai.privacyTitle', 'AI Data & Privacy')}
        description={t(
          'settings.ai.privacyDesc',
          'Control what data the AI can access, how it is retained, and whether it is used for model training.'
        )}
        cardId="settings-ai-privacy"
        isDirty={isDirty}
        onSave={loadError ? undefined : handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {loadError && (
            <DegradedState title="AI privacy settings unavailable" description={loadError} />
          )}

          {!loadError && (
            <>
              {/* Data Access Scope */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Eye size={14} className="text-c-accent" />
                  {t('settings.ai.dataAccessScope', 'Data Access Scope')}
                </h4>
                <p className="text-xs text-c-text-muted mb-4">
                  {t(
                    'settings.ai.dataAccessScopeDesc',
                    'Choose which types of data the AI is allowed to access for context and analysis.'
                  )}
                </p>
                <div className="space-y-4">
                  <SettingsToggle
                    checked={preferences.allowProjectData}
                    onChange={(checked) => update('allowProjectData', checked)}
                    label={t('settings.ai.allowProjects', 'Projects & Initiatives')}
                    description={t(
                      'settings.ai.allowProjectsDesc',
                      'AI can reference project details, timelines, and deliverables.'
                    )}
                  />
                  <SettingsToggle
                    checked={preferences.allowClientData}
                    onChange={(checked) => update('allowClientData', checked)}
                    label={t('settings.ai.allowClients', 'Client Information')}
                    description={t(
                      'settings.ai.allowClientsDesc',
                      'AI can access client names, contacts, and engagement details.'
                    )}
                  />
                  <SettingsToggle
                    checked={preferences.allowFinancialData}
                    onChange={(checked) => update('allowFinancialData', checked)}
                    label={t('settings.ai.allowFinancial', 'Financial Data')}
                    description={t(
                      'settings.ai.allowFinancialDesc',
                      'AI can access budgets, invoices, and financial metrics.'
                    )}
                  />
                  <SettingsToggle
                    checked={preferences.allowPersonalNotes}
                    onChange={(checked) => update('allowPersonalNotes', checked)}
                    label={t('settings.ai.allowNotes', 'Personal Notes')}
                    description={t(
                      'settings.ai.allowNotesDesc',
                      'AI can read your private notes and journal entries.'
                    )}
                  />
                </div>
              </div>

              <SettingsDivider />

              {/* Training Opt-out */}
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <SettingsToggle
                  checked={preferences.optOutTraining}
                  onChange={(checked) => update('optOutTraining', checked)}
                  label={t('settings.ai.optOutTraining', 'Opt Out of Model Training')}
                  description={t(
                    'settings.ai.optOutTrainingDesc',
                    'Your data will NOT be used to train or improve AI models. Recommended for sensitive consulting data.'
                  )}
                />
              </div>

              <SettingsDivider />

              {/* Data Retention */}
              <SettingsFormRow
                label={t('settings.ai.aiDataRetention', 'AI Data Retention')}
                description={t(
                  'settings.ai.aiDataRetentionDesc',
                  'How long AI interaction data (prompts, responses) is stored before automatic deletion.'
                )}
              >
                <SettingsSelect
                  options={retentionOptions}
                  value={preferences.dataRetention}
                  onChange={(e) =>
                    update('dataRetention', e.target.value as AIPrivacyPreferences['dataRetention'])
                  }
                />
              </SettingsFormRow>

              <SettingsDivider />

              {/* Audit & Compliance */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <EyeOff size={14} className="text-c-accent" />
                  {t('settings.ai.auditCompliance', 'Audit & Compliance')}
                </h4>
                <div className="space-y-4">
                  <SettingsToggle
                    checked={preferences.auditLogEnabled}
                    onChange={(checked) => update('auditLogEnabled', checked)}
                    label={t('settings.ai.auditLog', 'AI Audit Log')}
                    description={t(
                      'settings.ai.auditLogDesc',
                      'Log all AI interactions (who, when, what was asked) for compliance review.'
                    )}
                  />
                  <SettingsToggle
                    checked={preferences.anonymizeExports}
                    onChange={(checked) => update('anonymizeExports', checked)}
                    label={t('settings.ai.anonymizeExports', 'Anonymize AI Exports')}
                    description={t(
                      'settings.ai.anonymizeExportsDesc',
                      'Strip personal and client identifiers from AI-generated exports and reports.'
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

export default AIPrivacySettings;
