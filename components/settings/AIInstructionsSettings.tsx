/**
 * AIInstructionsSettings - Custom AI instructions
 */

import { MessageSquare, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface AIInstructionsSettingsProps {
    className?: string;
}

export const AIInstructionsSettings: React.FC<AIInstructionsSettingsProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const [instructions, setInstructions] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('ai_custom_instructions');
        if (saved) setInstructions(saved);
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            localStorage.setItem('ai_custom_instructions', instructions);
            toast.success(t('settings.ai.instructionsSaved', 'Instructions saved'));
        } catch (_error) {
            toast.error(t('settings.ai.instructionsError', 'Failed to save instructions'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare size={20} />
                    {t('settings.ai.instructionsTitle', 'Custom Instructions')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t(
                        'settings.ai.instructionsDesc',
                        'Tell the AI about yourself, your preferences, or how you want responses formatted.',
                    )}
                </p>
            </div>

            <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={t(
                    'settings.ai.instructionsPlaceholder',
                    'e.g., "I prefer concise responses with bullet points. Focus on practical solutions."',
                )}
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
            />

            <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">{instructions.length}/2000</span>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
                >
                    <Save size={16} />
                    {loading ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </button>
            </div>
        </div>
    );
};

export default AIInstructionsSettings;
