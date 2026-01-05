/**
 * AIAutoCompleteSettings - Auto-complete configuration
 *
 * Features:
 * - Enable/disable auto-complete
 * - Sensitivity slider
 * - Suggestions in comments toggle
 */

import { AlertCircle, CheckCircle, Loader2, Save, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface AIAutoCompleteSettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

export const AIAutoCompleteSettings: React.FC<AIAutoCompleteSettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const [autoSuggestions, setAutoSuggestions] = useState(true);
    const [sensitivity, setSensitivity] = useState(0.5);
    const [suggestionsInComments, setSuggestionsInComments] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const prefs = await Api.get('/settings/ai/autocomplete');
                if (prefs) {
                    setAutoSuggestions(prefs.enabled !== false);
                    setSensitivity(prefs.sensitivity ?? 0.5);
                    setSuggestionsInComments(prefs.suggestionsInComments !== false);
                }
            } catch (err) {
                console.error('Failed to load auto-complete preferences', err);
            }
        };
        loadPreferences();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');

        try {
            await Api.put('/settings/ai/autocomplete', {
                enabled: autoSuggestions,
                sensitivity,
                suggestionsInComments,
            });

            setSaveStatus('success');
            toast.success(t('settings.ai.autocomplete.saved', 'Auto-complete preferences saved'));

            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error: any) {
            setSaveStatus('error');
            toast.error(
                error.message || t('settings.ai.autocomplete.error', 'Failed to save auto-complete preferences'),
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Zap size={20} />
                    {t('settings.ai.autocomplete.title', 'Auto-Complete & Suggestions')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.ai.autocomplete.subtitle', 'Configure AI-powered auto-complete and suggestions')}
                </p>
            </div>

            {/* Auto-Suggestions Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10">
                <div>
                    <label className="text-sm font-medium text-slate-900 dark:text-white">
                        {t('settings.ai.autocomplete.enable', 'Enable Auto-Suggestions')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('settings.ai.autocomplete.enableDesc', 'Get AI-powered suggestions as you type')}
                    </p>
                </div>
                <button
                    onClick={() => setAutoSuggestions(!autoSuggestions)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoSuggestions ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            autoSuggestions ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {autoSuggestions && (
                <>
                    {/* Sensitivity */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {t('settings.ai.autocomplete.sensitivity', 'Suggestion Sensitivity')}
                            </label>
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                {Math.round(sensitivity * 100)}%
                            </span>
                        </div>
                        <div className="space-y-2">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={sensitivity}
                                onChange={(e) => setSensitivity(Number(e.target.value))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>{t('settings.ai.autocomplete.less', 'Less Frequent')}</span>
                                <span>{t('settings.ai.autocomplete.more', 'More Frequent')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Suggestions in Comments */}
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-white/10">
                        <div>
                            <label className="text-sm font-medium text-slate-900 dark:text-white">
                                {t('settings.ai.autocomplete.comments', 'Suggestions in Comments')}
                            </label>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t(
                                    'settings.ai.autocomplete.commentsDesc',
                                    'Show AI suggestions when writing comments',
                                )}
                            </p>
                        </div>
                        <button
                            onClick={() => setSuggestionsInComments(!suggestionsInComments)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                suggestionsInComments ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    suggestionsInComments ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    {t('settings.ai.autocomplete.saved', 'Auto-complete preferences saved')}
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {t('settings.ai.autocomplete.error', 'Failed to save auto-complete preferences')}
                </div>
            )}
        </div>
    );
};

export default AIAutoCompleteSettings;
