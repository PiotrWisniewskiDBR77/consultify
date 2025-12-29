import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../../types';
import { AIConfigCore } from '../shared/AIConfigCore';
import { usePermissions } from '../../hooks/usePermissions';
import { InfoButton } from '../shared/InfoButton';
import { useTranslation } from 'react-i18next';
import { Bot, MessageSquare, Zap, Brain, Save, Check, FileText, ExternalLink, Shield } from 'lucide-react';
import { Api } from '../../services/api';

interface AISettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface AIPreferences {
    responseStyle: 'concise' | 'balanced' | 'detailed';
    writingTone: 'professional' | 'casual' | 'technical';
    autoSuggestions: boolean;
    contextRetention: 'session' | 'persistent' | 'minimal';
    preferredLanguage: 'auto' | 'en' | 'pl';
    codeExplanations: boolean;
    showSources: boolean;
}

const defaultPreferences: AIPreferences = {
    responseStyle: 'balanced',
    writingTone: 'professional',
    autoSuggestions: true,
    contextRetention: 'session',
    preferredLanguage: 'auto',
    codeExplanations: true,
    showSources: true
};

export const AISettings: React.FC<AISettingsProps> = ({ currentUser, onUpdateUser }) => {
    const { t } = useTranslation();
    const { isAdmin, canConfigureOrgAI } = usePermissions();
    const [preferences, setPreferences] = useState<AIPreferences>(defaultPreferences);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Load AI preferences from user's extended preferences
        const loadPreferences = async () => {
            try {
                const res = await Api.get('/settings/preferences');
                if (res.data?.ai) {
                    setPreferences(prev => ({ ...prev, ...res.data.ai }));
                }
            } catch {
                // Use defaults
            }
        };
        loadPreferences();
    }, []);

    const savePreferences = async () => {
        setSaving(true);
        try {
            await Api.put('/settings/preferences/ai', preferences);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            // Handle error
        } finally {
            setSaving(false);
        }
    };

    const handleChange = <K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    return (
        <div className="space-y-6">
            {/* AI Configuration Core */}
            <div className="relative">
                <InfoButton cardId="settings-ai" position="top-right" />
                <AIConfigCore
                    mode={isAdmin ? 'org-admin' : 'user'}
                    currentUser={currentUser}
                    onUpdateUser={onUpdateUser}
                    showProviderSelection={true}
                    showModelPreferences={true}
                    showOrgPolicy={canConfigureOrgAI}
                    showSystemHealth={false}
                />
            </div>

            {/* AI Behavior Preferences */}
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {t('settings.ai.behaviorTitle', 'AI Behavior Preferences')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('settings.ai.behaviorDesc', 'Customize how AI responds to your requests')}
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Response Style */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                {t('settings.ai.responseStyle', 'Response Style')}
                            </div>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: 'concise', label: t('settings.ai.concise', 'Concise'), desc: t('settings.ai.conciseDesc', 'Short and direct') },
                                { value: 'balanced', label: t('settings.ai.balanced', 'Balanced'), desc: t('settings.ai.balancedDesc', 'Clear explanations') },
                                { value: 'detailed', label: t('settings.ai.detailed', 'Detailed'), desc: t('settings.ai.detailedDesc', 'In-depth analysis') }
                            ].map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleChange('responseStyle', option.value as AIPreferences['responseStyle'])}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                        preferences.responseStyle === option.value
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-700'
                                    }`}
                                >
                                    <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{option.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Writing Tone */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                {t('settings.ai.writingTone', 'Writing Tone')}
                            </div>
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { value: 'professional', label: t('settings.ai.professional', 'Professional'), desc: t('settings.ai.professionalDesc', 'Formal and business-like') },
                                { value: 'casual', label: t('settings.ai.casual', 'Casual'), desc: t('settings.ai.casualDesc', 'Friendly and approachable') },
                                { value: 'technical', label: t('settings.ai.technical', 'Technical'), desc: t('settings.ai.technicalDesc', 'Precise and domain-specific') }
                            ].map(option => (
                                <button
                                    key={option.value}
                                    onClick={() => handleChange('writingTone', option.value as AIPreferences['writingTone'])}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                        preferences.writingTone === option.value
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                            : 'border-slate-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-700'
                                    }`}
                                >
                                    <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{option.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Context Retention */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                {t('settings.ai.contextRetention', 'Context Retention')}
                            </div>
                        </label>
                        <select
                            value={preferences.contextRetention}
                            onChange={(e) => handleChange('contextRetention', e.target.value as AIPreferences['contextRetention'])}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="session">{t('settings.ai.session', 'Session Only - Reset on logout')}</option>
                            <option value="persistent">{t('settings.ai.persistent', 'Persistent - Remember across sessions')}</option>
                            <option value="minimal">{t('settings.ai.minimal', 'Minimal - Basic context only')}</option>
                        </select>
                    </div>

                    {/* Toggle Options */}
                    <div className="space-y-4">
                        <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {t('settings.ai.autoSuggestions', 'Auto Suggestions')}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {t('settings.ai.autoSuggestionsDesc', 'Show proactive suggestions while working')}
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.autoSuggestions}
                                onChange={(e) => handleChange('autoSuggestions', e.target.checked)}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {t('settings.ai.codeExplanations', 'Code Explanations')}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {t('settings.ai.codeExplanationsDesc', 'Add explanatory comments to generated code')}
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.codeExplanations}
                                onChange={(e) => handleChange('codeExplanations', e.target.checked)}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                            />
                        </label>

                        <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
                            <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                    {t('settings.ai.showSources', 'Show Sources')}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {t('settings.ai.showSourcesDesc', 'Display references and citations in responses')}
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={preferences.showSources}
                                onChange={(e) => handleChange('showSources', e.target.checked)}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                            />
                        </label>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10">
                        <button
                            onClick={savePreferences}
                            disabled={saving || saved}
                            className={`px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                                saved
                                    ? 'bg-green-500 text-white'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                            } disabled:opacity-50`}
                        >
                            {saved ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    {t('common.saved', 'Saved')}
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {saving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Policy Documents */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    {t('settings.ai.documents', 'AI Transparency & Policy')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('settings.ai.documentsDescription', 'Learn about how AI features work and how your data is handled')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AIDocLink
                        to="/legal/ai-policy"
                        icon={<Bot className="w-4 h-4" />}
                        title="AI Usage Policy"
                        description="BYOK, data handling, AI transparency"
                    />
                    <AIDocLink
                        to="/legal/customer-security"
                        icon={<Shield className="w-4 h-4" />}
                        title="Customer Data Security"
                        description="AI processing security measures"
                    />
                </div>
            </div>
        </div>
    );
};

interface AIDocLinkProps {
    to: string;
    icon: React.ReactNode;
    title: string;
    description: string;
}

const AIDocLink: React.FC<AIDocLinkProps> = ({ to, icon, title, description }) => (
    <Link
        to={to}
        className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
    >
        <div className="text-slate-400 dark:text-slate-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 mt-0.5">
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                    {title}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
        </div>
    </Link>
);
