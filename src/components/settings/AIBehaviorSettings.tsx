/**
 * AIBehaviorSettings - Unified AI behavior, instructions & personality
 *
 * Merges former AIInstructionsSettings + AIPersonalitySettings into one coherent screen.
 * Eliminates duplicate "system prompt" vs "custom instructions" confusion.
 *
 * Sections:
 *  1. System Prompt (with quick templates)
 *  2. Response Style (concise / balanced / detailed)
 *  3. Tone & Communication (structured selectors instead of second textarea)
 *  4. Context Settings (include context toggle + max context length)
 */

import { Briefcase, MessageSquare, Palette, Sparkles, Wrench, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import {
  SettingsButtonGroup,
  SettingsDivider,
  SettingsFormRow,
  SettingsSection,
  SettingsSelect,
  SettingsTextarea,
  SettingsToggle,
} from './shared';

interface AIBehaviorPreferences {
  systemPrompt: string;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone: 'professional' | 'friendly' | 'casual' | 'academic';
  formality: 'formal' | 'balanced' | 'informal';
  verbosity: 'minimal' | 'concise' | 'detailed' | 'comprehensive';
  includeContext: boolean;
  maxContextLength: number;
}

const defaultPreferences: AIBehaviorPreferences = {
  systemPrompt: '',
  responseStyle: 'balanced',
  tone: 'professional',
  formality: 'balanced',
  verbosity: 'concise',
  includeContext: true,
  maxContextLength: 4000,
};

const PROMPT_TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional',
    icon: Briefcase,
    prompt:
      'I prefer formal, professional responses. Focus on accuracy and clarity. Use industry-standard terminology.',
  },
  {
    id: 'creative',
    name: 'Creative',
    icon: Palette,
    prompt:
      'Be creative and think outside the box. Suggest innovative solutions. Use analogies and examples.',
  },
  {
    id: 'technical',
    name: 'Technical',
    icon: Wrench,
    prompt:
      'Provide detailed technical explanations. Include code examples when relevant. Be precise with specifications.',
  },
  {
    id: 'concise',
    name: 'Concise',
    icon: Zap,
    prompt:
      'Keep responses brief and to the point. Use bullet points. Avoid unnecessary explanations.',
  },
];

export const AIBehaviorSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIBehaviorPreferences>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] =
    useState<AIBehaviorPreferences>(defaultPreferences);
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
        const [instrRes, persRes] = await Promise.all([
          Api.getAIInstructions(),
          Api.getAIPersonality(),
        ]);
        if (!instrRes?.preferences || !persRes?.preferences) {
          throw new Error('AI behavior response was missing instructions or personality');
        }
        const merged: AIBehaviorPreferences = {
          ...defaultPreferences,
          ...(instrRes?.preferences || {}),
          tone: persRes?.preferences?.tone || defaultPreferences.tone,
          formality: persRes?.preferences?.formality || defaultPreferences.formality,
          verbosity: persRes?.preferences?.verbosity || defaultPreferences.verbosity,
        };
        setPreferences(merged);
        setOriginalPreferences(merged);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load AI behavior settings'));
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
      await Promise.all([
        Api.saveAIInstructions({
          systemPrompt: preferences.systemPrompt,
          responseStyle: preferences.responseStyle,
          includeContext: preferences.includeContext,
          maxContextLength: preferences.maxContextLength,
        }),
        Api.saveAIPersonality({
          tone: preferences.tone,
          formality: preferences.formality,
          verbosity: preferences.verbosity,
          customInstructions: preferences.systemPrompt,
        }),
      ]);
      const [instrRes, persRes] = await Promise.all([
        Api.getAIInstructions(),
        Api.getAIPersonality(),
      ]);
      if (!instrRes?.preferences || !persRes?.preferences) {
        throw new Error('AI behavior settings save was not confirmed by the server');
      }
      const persisted: AIBehaviorPreferences = {
        ...defaultPreferences,
        ...instrRes.preferences,
        tone: persRes.preferences.tone || defaultPreferences.tone,
        formality: persRes.preferences.formality || defaultPreferences.formality,
        verbosity: persRes.preferences.verbosity || defaultPreferences.verbosity,
      };
      if (JSON.stringify(persisted) !== JSON.stringify(preferences)) {
        throw new Error('AI behavior settings save was not confirmed by the server');
      }
      setPreferences(persisted);
      setOriginalPreferences(persisted);
      toast.success(t('settings.ai.behaviorSaved', 'AI behavior settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.ai.behaviorError', 'Failed to save AI behavior settings')
      );
      setActionError(message);
      toast.error(message);
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
    setPreferences((prev) => ({ ...prev, systemPrompt: templatePrompt }));
    toast.success(
      t('settings.ai.templateApplied', '{{name}} template applied', {
        name: templateName,
      })
    );
  };

  const update = <K extends keyof AIBehaviorPreferences>(
    key: K,
    value: AIBehaviorPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const responseStyleOptions = [
    { value: 'concise', label: t('settings.ai.style.concise', 'Concise') },
    { value: 'balanced', label: t('settings.ai.style.balanced', 'Balanced') },
    { value: 'detailed', label: t('settings.ai.style.detailed', 'Detailed') },
  ];

  const toneOptions = [
    { value: 'professional', label: t('settings.ai.tone.professional', 'Professional') },
    { value: 'friendly', label: t('settings.ai.tone.friendly', 'Friendly') },
    { value: 'casual', label: t('settings.ai.tone.casual', 'Casual') },
    { value: 'academic', label: t('settings.ai.tone.academic', 'Academic') },
  ];

  const formalityOptions = [
    { value: 'formal', label: t('settings.ai.formality.formal', 'Formal') },
    { value: 'balanced', label: t('settings.ai.formality.balanced', 'Balanced') },
    { value: 'informal', label: t('settings.ai.formality.informal', 'Informal') },
  ];

  const verbosityOptions = [
    { value: 'minimal', label: t('settings.ai.verbosity.minimal', 'Minimal') },
    { value: 'concise', label: t('settings.ai.verbosity.concise', 'Concise') },
    { value: 'detailed', label: t('settings.ai.verbosity.detailed', 'Detailed') },
    { value: 'comprehensive', label: t('settings.ai.verbosity.comprehensive', 'Comprehensive') },
  ];

  const contextLengthOptions = [
    { value: '2000', label: '2K tokens' },
    { value: '4000', label: '4K tokens' },
    { value: '8000', label: '8K tokens' },
    { value: '16000', label: '16K tokens' },
  ];

  if (loadError) {
    return (
      <div className={className}>
        <DegradedState title="AI behavior settings unavailable" description={loadError} />
      </div>
    );
  }

  return (
    <div className={className}>
      {actionError && <Banner variant="danger" title={actionError} className="mb-4" />}

      <SettingsSection
        icon={MessageSquare}
        title={t('settings.ai.behaviorTitle', 'AI Behavior & Instructions')}
        description={t(
          'settings.ai.behaviorDesc',
          'Define how the AI communicates with you — system prompt, tone, style, and context preferences.'
        )}
        cardId="settings-ai-behavior"
        isDirty={isDirty}
        onSave={handleSave}
        saving={saving}
        loading={loading}
      >
        <div className="space-y-6">
          {/* Quick Templates */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-3">
              {t('settings.ai.quickTemplates', 'Quick Templates')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PROMPT_TEMPLATES.map((tpl) => {
                const TplIcon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-700
                      border border-c-border-subtle rounded-lg text-sm text-c-text-secondary
                      hover:text-c-text dark:hover:text-white transition-all duration-200"
                  >
                    <TplIcon size={14} />
                    {t(`settings.ai.behaviorTemplates.${tpl.id}.name`, tpl.name)}
                  </button>
                );
              })}
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
              onChange={(e) => update('systemPrompt', e.target.value)}
              placeholder={t(
                'settings.ai.instructionsPlaceholder',
                'e.g., "I prefer concise responses with bullet points. Focus on practical solutions."'
              )}
              rows={5}
              maxLength={2000}
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-c-text-muted">
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
              onChange={(v) => update('responseStyle', v as AIBehaviorPreferences['responseStyle'])}
            />
          </SettingsFormRow>

          <SettingsDivider />

          {/* Tone & Communication */}
          <div>
            <h4 className="text-sm font-semibold text-c-text mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-c-accent" />
              {t('settings.ai.toneSection', 'Tone & Communication')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SettingsFormRow label={t('settings.ai.toneLabel', 'Tone')}>
                <SettingsSelect
                  options={toneOptions}
                  value={preferences.tone}
                  onChange={(e) => update('tone', e.target.value as AIBehaviorPreferences['tone'])}
                />
              </SettingsFormRow>

              <SettingsFormRow label={t('settings.ai.formalityLabel', 'Formality')}>
                <SettingsButtonGroup
                  options={formalityOptions}
                  value={preferences.formality}
                  onChange={(v) => update('formality', v as AIBehaviorPreferences['formality'])}
                  size="sm"
                />
              </SettingsFormRow>

              <SettingsFormRow label={t('settings.ai.verbosityLabel', 'Verbosity')}>
                <SettingsSelect
                  options={verbosityOptions}
                  value={preferences.verbosity}
                  onChange={(e) =>
                    update('verbosity', e.target.value as AIBehaviorPreferences['verbosity'])
                  }
                />
              </SettingsFormRow>
            </div>
          </div>

          <SettingsDivider />

          {/* Context Settings */}
          <div className="space-y-4">
            <SettingsToggle
              checked={preferences.includeContext}
              onChange={(checked) => update('includeContext', checked)}
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
                <SettingsSelect
                  options={contextLengthOptions}
                  value={preferences.maxContextLength.toString()}
                  onChange={(e) => update('maxContextLength', parseInt(e.target.value))}
                />
              </SettingsFormRow>
            )}
          </div>

          {/* Tips */}
          <div className="p-4 bg-c-accent-soft border border-c-accent rounded-lg">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="text-c-accent flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-c-accent mb-1">
                  {t('settings.ai.tips', 'Pro Tips')}
                </h4>
                <ul className="text-xs text-c-text-muted space-y-1">
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

export default AIBehaviorSettings;
