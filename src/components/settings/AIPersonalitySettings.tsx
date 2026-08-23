/**
 * AIPersonalitySettings - Dedicated screen to define AI tone and communication style
 *
 * Connected to backend API for persistence.
 */

import { Loader2, MessageSquare, Save, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface AIPersonalityPreferences {
  tone: string;
  formality: string;
  verbosity: string;
  creativity: string;
  customInstructions: string;
}

const defaultPreferences: AIPersonalityPreferences = {
  tone: 'professional',
  formality: 'balanced',
  verbosity: 'concise',
  creativity: 'moderate',
  customInstructions: '',
};

export const AIPersonalitySettings: React.FC = () => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIPersonalityPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load from API
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const response = await Api.getAIPersonality();
        if (response?.preferences) {
          setPreferences({ ...defaultPreferences, ...response.preferences });
        }
      } catch (err: any) {
        console.error('Failed to load AI personality:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.saveAIPersonality(preferences);
      toast.success(t('settings.ai.personalitySaved', 'AI personality saved'));
    } catch (err: any) {
      toast.error(t('settings.ai.personalityError', 'Failed to save AI personality'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-c-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text flex items-center gap-2">
            <Sparkles size={22} className="text-c-accent" />
            {t('settings.ai.personalityTitle', 'AI Personality')}
          </h2>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.ai.personalitySubtitle',
              'Set tone, voice and communication style for AI responses.'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text text-c-surface rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="animate-spin h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full" />
              {t('settings.saving', 'Saving...')}
            </>
          ) : (
            <>
              <Save size={16} />
              {t('settings.save', 'Save Changes')}
            </>
          )}
        </button>
      </div>

      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-500" />
          <h3 className="text-lg font-semibold text-c-text">
            {t('settings.ai.personalityInstructions', 'Custom Instructions')}
          </h3>
        </div>
        <p className="text-sm text-c-text-muted">
          {t(
            'settings.ai.personalityHelp',
            'Describe tone, style, dos and don’ts (e.g., concise, bullet lists, formal, playful).'
          )}
        </p>
        <textarea
          value={preferences.customInstructions}
          onChange={(e) => setPreferences({ ...preferences, customInstructions: e.target.value })}
          rows={8}
          className="w-full rounded-xl border border-c-border-subtle dark:border-navy-700 bg-c-surface-raised text-c-text p-4 focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
          placeholder={t(
            'settings.ai.personalityPlaceholder',
            'e.g., Friendly, concise, focus on practical solutions. Avoid long paragraphs.'
          )}
          maxLength={2000}
        />
        <div className="text-right text-xs text-c-text-muted">
          {preferences.customInstructions.length}/2000
        </div>
      </div>
    </div>
  );
};

export default AIPersonalitySettings;
