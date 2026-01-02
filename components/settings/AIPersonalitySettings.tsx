/**
 * AIPersonalitySettings - AI personality presets
 * 
 * Features:
 * - Personality presets (Professional, Casual, Technical)
 * - Custom personality instructions
 */

import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    User as UserIcon,
    Save,
    Loader2,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { Api } from '../../services/api';
import toast from 'react-hot-toast';

interface AIPersonalitySettingsProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

const PERSONALITY_PRESETS = [
    { 
        value: 'professional', 
        label: 'Professional', 
        description: 'Formal, business-appropriate tone',
        example: 'I recommend implementing this solution...'
    },
    { 
        value: 'casual', 
        label: 'Casual', 
        description: 'Friendly, conversational tone',
        example: 'Hey! Here\'s what I think would work...'
    },
    { 
        value: 'technical', 
        label: 'Technical', 
        description: 'Precise, detailed, code-focused',
        example: 'The implementation requires O(n log n) complexity...'
    },
] as const;

export const AIPersonalitySettings: React.FC<AIPersonalitySettingsProps> = ({ 
    currentUser, 
    onUpdateUser 
}) => {
    const { t } = useTranslation();
    const [personality, setPersonality] = useState<'professional' | 'casual' | 'technical'>('professional');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const prefs = await Api.get('/settings/ai/personality');
                if (prefs) {
                    setPersonality(prefs.personality || 'professional');
                }
            } catch (err) {
                console.error('Failed to load AI personality preferences', err);
            }
        };
        loadPreferences();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus('idle');
        
        try {
            await Api.put('/settings/ai/personality', {
                personality
            });
            
            setSaveStatus('success');
            toast.success(t('settings.ai.personality.saved', 'Personality preferences saved'));
            
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error: any) {
            setSaveStatus('error');
            toast.error(error.message || t('settings.ai.personality.error', 'Failed to save personality preferences'));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedPreset = PERSONALITY_PRESETS.find(p => p.value === personality);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <UserIcon size={20} />
                    {t('settings.ai.personality.title', 'AI Personality')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t('settings.ai.personality.subtitle', 'Choose how the AI communicates with you')}
                </p>
            </div>

            {/* Personality Presets */}
            <div className="space-y-3">
                {PERSONALITY_PRESETS.map((preset) => {
                    const isSelected = personality === preset.value;
                    
                    return (
                        <button
                            key={preset.value}
                            onClick={() => setPersonality(preset.value)}
                            className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                isSelected
                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20'
                                    : 'border-slate-200 dark:border-white/10 hover:border-purple-300'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className={`text-sm font-semibold mb-1 ${
                                        isSelected
                                            ? 'text-purple-700 dark:text-purple-300'
                                            : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {preset.label}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                        {preset.description}
                                    </p>
                                    <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                                        "{preset.example}"
                                    </div>
                                </div>
                                {isSelected && (
                                    <CheckCircle size={20} className="text-purple-600 dark:text-purple-400 ml-2" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

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
                    {t('settings.ai.personality.saved', 'Personality preferences saved')}
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {t('settings.ai.personality.error', 'Failed to save personality preferences')}
                </div>
            )}
        </div>
    );
};

export default AIPersonalitySettings;

