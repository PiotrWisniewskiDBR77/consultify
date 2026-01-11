/**
 * AIMemorySettings - AI memory management
 * Connected to backend API for persistence.
 */

import { Database, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface AIMemoryPreferences {
  enabled: boolean;
  retentionDays: number;
  includeConversations: boolean;
  includePreferences: boolean;
  includeContext: boolean;
}

const defaultPreferences: AIMemoryPreferences = {
  enabled: true,
  retentionDays: 30,
  includeConversations: true,
  includePreferences: true,
  includeContext: true,
};

interface AIMemorySettingsProps {
  className?: string;
}

export const AIMemorySettings: React.FC<AIMemorySettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<AIMemoryPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const response = await Api.getAIMemory();
        if (response?.preferences) {
          setPreferences({ ...defaultPreferences, ...response.preferences });
        }
      } catch (err: any) {
        console.error('Failed to load AI memory settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPreferences();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Api.saveAIMemory(preferences);
      toast.success(t('settings.ai.memorySaved', 'AI memory settings saved'));
    } catch (err: any) {
      toast.error(t('settings.ai.memoryError', 'Failed to save memory settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleClearMemory = async () => {
    if (!confirm(t('settings.ai.clearMemoryConfirm', 'Are you sure you want to clear AI memory?')))
      return;

    setClearing(true);
    try {
      await Api.clearAIMemoryData();
      toast.success(t('settings.ai.memoryCleared', 'AI memory cleared'));
    } catch (_error) {
      toast.error(t('settings.ai.memoryClearError', 'Failed to clear memory'));
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Database size={20} />
            {t('settings.ai.memoryTitle', 'AI Memory')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t(
              'settings.ai.memoryDesc',
              'Control how the AI remembers context from your conversations.'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
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
            checked={preferences.enabled}
            onChange={(e) => setPreferences({ ...preferences, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {/* Retention Period */}
      <div className="p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg space-y-2">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('settings.ai.retentionDays', 'Memory Retention (days)')}
        </label>
        <input
          type="number"
          min="1"
          max="365"
          value={preferences.retentionDays}
          onChange={(e) =>
            setPreferences({ ...preferences, retentionDays: parseInt(e.target.value) || 30 })
          }
          className="w-full px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
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
