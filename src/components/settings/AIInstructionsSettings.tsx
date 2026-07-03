/**
 * AIInstructionsSettings - Custom AI instructions
 *
 * Connected to backend API for persistence
 * Uses unified SettingsSection pattern
 *
 * @version 2.0
 */

import { MessageSquare, Sparkles, Wand2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import {
  SettingsButtonGroup,
  SettingsDivider,
  SettingsFormRow,
  SettingsSection,
  SettingsTextarea,
  SettingsToggle,
} from './shared';

interface AIInstructionsPreferences {
  systemPrompt: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  includeContext: boolean;
  maxContextLength: number;
}

interface AIInstructionsSettingsProps {
  className?: string;
}

const defaultPreferences: AIInstructionsPreferences = {
  systemPrompt: '',
  responseStyle: 'balanced',
  includeContext: true,
  maxContextLength: 4000,
};

// Template suggestions for quick start
const PROMPT_TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional',
    prompt:
      'I prefer formal, professional responses. Focus on accuracy and clarity. Use industry-standard terminology.',
  },
  {
    id: 'creative',
    name: 'Creative',
    prompt:
      'Be creative and think outside the box. Suggest innovative solutions. Use analogies and examples.',
  },
  {
    id: 'technical',
    name: 'Technical',
    prompt:
      'Provide detailed technical explanations. Include code examples when relevant. Be precise with specifications.',
  },
  {
    id: 'concise',
    name: 'Concise',
    prompt:
      'Keep responses brief and to the point. Use bullet points. Avoid unnecessary explanations.',
  },
];

export const AIInstructionsSettings: React.FC<AIInstructionsSettingsProps> = ({
  className = '',
}) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIInstructionsPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AIInstructionsPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Check if there are unsaved changes
  const isDirty = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const response = await Api.getAIInstructions();
        if (response?.preferences) {
          const loaded = { ...defaultPreferences, ...response.preferences };
          setPreferences(loaded);
          setOriginalPreferences(loaded);
        }
      } catch (err: any) {
        console.error('Failed to load AI instructions:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Api.saveAIInstructions(preferences);
      const persisted = await Api.getAIInstructions().catch(() => null);
      const next = { ...defaultPreferences, ...(persisted?.preferences || preferences) };
      setPreferences(next);
      setOriginalPreferences(next);
      toast.success(t('settings.ai.instructionsSaved', 'AI instructions saved'));
    } catch (_error) {
      toast.error(t('settings.ai.instructionsError', 'Failed to save instructions'));
    } finally {
      setSaving(false);
    }
  }, [preferences, t]);

  const applyTemplate = (template: (typeof PROMPT_TEMPLATES)[0]) => {
    const templateName = t(`settings.ai.behaviorTemplates.${template.id}.name`, template.name);
    const templatePrompt = t(
      `settings.ai.behaviorTemplates.${template.id}.prompt`,
      template.prompt
    );
    setPreferences((prev) => ({
      ...prev,
      systemPrompt: templatePrompt,
    }));
    toast.success(
      t('settings.ai.templateApplied', '{{name}} template applied', { name: templateName })
    );
  };

  const responseStyleOptions = [
    { value: 'concise', label: t('settings.ai.style.concise', 'Concise') },
    { value: 'balanced', label: t('settings.ai.style.balanced', 'Balanced') },
    { value: 'detailed', label: t('settings.ai.style.detailed', 'Detailed') },
  ];

  const contextLengthOptions = [
    { value: '2000', label: '2K tokens' },
    { value: '4000', label: '4K tokens' },
    { value: '8000', label: '8K tokens' },
    { value: '16000', label: '16K tokens' },
  ];

  return (
    <div className={className}>
      <SettingsSection
        icon={MessageSquare}
        title={t('settings.ai.instructionsTitle', 'Custom Instructions')}
        description={t(
          'settings.ai.instructionsDesc',
          'Tell the AI about yourself, your preferences, or how you want responses formatted.'
        )}
        cardId="settings-ai-instructions"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Quick Templates */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              {t('settings.ai.quickTemplates', 'Quick Templates')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-200/50 dark:bg-navy-700/50 hover:bg-slate-200 dark:hover:bg-navy-700
                                             border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-700 dark:text-slate-300
                                             hover:text-slate-900 dark:hover:text-white transition-all duration-200"
                >
                  <Wand2 size={14} />
                  {t(`settings.ai.behaviorTemplates.${template.id}.name`, template.name)}
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <SettingsFormRow
            label={t('settings.ai.systemPrompt', 'System Prompt')}
            description={t(
              'settings.ai.systemPromptDesc',
              'This will be included in every conversation with the AI.'
            )}
          >
            <SettingsTextarea
              value={preferences.systemPrompt}
              onChange={(e) => setPreferences({ ...preferences, systemPrompt: e.target.value })}
              placeholder={t(
                'settings.ai.instructionsPlaceholder',
                'e.g., "I prefer concise responses with bullet points. Focus on practical solutions."'
              )}
              rows={6}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {preferences.systemPrompt.length}/2000 {t('common.characters', 'characters')}
              </span>
              {preferences.systemPrompt.length > 1800 && (
                <span className="text-xs text-amber-400">
                  {t('settings.ai.nearLimit', 'Approaching limit')}
                </span>
              )}
            </div>
          </SettingsFormRow>

          <SettingsDivider />

          {/* Response Style */}
          <SettingsFormRow
            label={t('settings.ai.responseStyle', 'Response Style')}
            description={t(
              'settings.ai.responseStyleDesc',
              'Choose how detailed you want AI responses to be.'
            )}
          >
            <SettingsButtonGroup
              options={responseStyleOptions}
              value={preferences.responseStyle}
              onChange={(value) =>
                setPreferences({
                  ...preferences,
                  responseStyle: value as AIInstructionsPreferences['responseStyle'],
                })
              }
            />
          </SettingsFormRow>

          <SettingsDivider />

          {/* Context Settings */}
          <div className="space-y-4">
            <SettingsToggle
              checked={preferences.includeContext}
              onChange={(checked) => setPreferences({ ...preferences, includeContext: checked })}
              label={t('settings.ai.includeContext', 'Include Context')}
              description={t(
                'settings.ai.includeContextDesc',
                'Allow AI to use your recent activity and projects as context.'
              )}
            />

            {preferences.includeContext && (
              <SettingsFormRow
                label={t('settings.ai.maxContextLength', 'Max Context Length')}
                description={t(
                  'settings.ai.maxContextLengthDesc',
                  'Maximum tokens of context to include in AI requests.'
                )}
              >
                <select
                  value={preferences.maxContextLength.toString()}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      maxContextLength: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg
                                             text-slate-900 dark:text-white transition-all duration-200
                                             focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)] focus:border-transparent"
                >
                  {contextLengthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </SettingsFormRow>
            )}
          </div>

          {/* AI Tips */}
          <div className="mt-6 p-4 bg-primary-600/5 border border-primary-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="text-primary-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-primary-300 mb-1">
                  {t('settings.ai.tips', 'Pro Tips')}
                </h4>
                <ul className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
                  <li>• {t('settings.ai.tip1', 'Be specific about your role and expertise')}</li>
                  <li>
                    •{' '}
                    {t(
                      'settings.ai.tip2',
                      'Mention preferred formats (bullet points, tables, etc.)'
                    )}
                  </li>
                  <li>• {t('settings.ai.tip3', 'Specify any terminology or jargon to use')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};

export default AIInstructionsSettings;
