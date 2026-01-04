/**
 * AIMemorySettings - AI memory management
 */

import { Database, RefreshCw, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface AIMemorySettingsProps {
    className?: string;
}

export const AIMemorySettings: React.FC<AIMemorySettingsProps> = ({ className = '' }) => {
    const { t } = useTranslation();
    const [memoryEnabled, setMemoryEnabled] = useState(true);
    const [clearing, setClearing] = useState(false);

    const handleClearMemory = async () => {
        if (!confirm(t('settings.ai.clearMemoryConfirm', 'Are you sure you want to clear AI memory?'))) return;

        setClearing(true);
        try {
            await Api.clearAIMemory();
            toast.success(t('settings.ai.memoryCleared', 'AI memory cleared'));
        } catch (_error) {
            toast.error(t('settings.ai.memoryClearError', 'Failed to clear memory'));
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Database size={20} />
                    {t('settings.ai.memoryTitle', 'AI Memory')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {t('settings.ai.memoryDesc', 'Control how the AI remembers context from your conversations.')}
                </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
                <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                        {t('settings.ai.enableMemory', 'Enable Memory')}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t('settings.ai.enableMemoryDesc', 'AI will remember context across conversations')}
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={memoryEnabled}
                        onChange={(e) => setMemoryEnabled(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
            </div>

            <button
                onClick={handleClearMemory}
                disabled={clearing}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
                {clearing ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {t('settings.ai.clearMemory', 'Clear All Memory')}
            </button>
        </div>
    );
};

export default AIMemorySettings;



