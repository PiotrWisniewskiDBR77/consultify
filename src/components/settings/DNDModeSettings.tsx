/**
 * DNDModeSettings - Do Not Disturb mode
 *
 * Features:
 * - Enable/disable DND mode
 * - Set DND until time
 * - Quick presets (1h, 2h, 4h, until tomorrow)
 */

import { AlertCircle, CheckCircle, Clock, Loader2, Moon, Save, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface DNDModeSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface DndPreferences {
  enabled: boolean;
  until: string | null;
}

const DND_PRESETS = [
  { label: '1 hour', hours: 1 },
  { label: '2 hours', hours: 2 },
  { label: '4 hours', hours: 4 },
  { label: 'Until tomorrow 9 AM', hours: null, untilTomorrow: true },
] as const;

export const DNDModeSettings: React.FC<DNDModeSettingsProps> = ({ currentUser, onUpdateUser }) => {
  const { t } = useTranslation();
  const [dndEnabled, setDndEnabled] = useState<boolean>(false);
  const [dndUntil, setDndUntil] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = (await Api.get('/settings/notifications/dnd')) as
          | Partial<DndPreferences>
          | undefined;
        if (prefs && typeof prefs === 'object') {
          setDndEnabled(prefs.enabled ?? false);
          setDndUntil(prefs.until || '');
        }
      } catch (err) {
        console.error('Failed to load DND preferences', err);
      }
    };
    loadPreferences();
  }, []);

  const handlePreset = (preset: (typeof DND_PRESETS)[number]) => {
    const now = new Date();
    let until: Date;

    if ('untilTomorrow' in preset && preset.untilTomorrow) {
      until = new Date(now);
      until.setDate(until.getDate() + 1);
      until.setHours(9, 0, 0, 0);
    } else {
      until = new Date(now.getTime() + preset.hours! * 60 * 60 * 1000);
    }

    setDndUntil(until.toISOString());
    setDndEnabled(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await Api.put('/settings/notifications/dnd', {
        enabled: dndEnabled,
        until: dndEnabled ? dndUntil : null,
      } as DndPreferences);

      setSaveStatus('success');
      toast.success(t('settings.notifications.dnd.saved', 'DND mode updated'));

      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error: any) {
      setSaveStatus('error');
      toast.error(
        error.message || t('settings.notifications.dnd.error', 'Failed to update DND mode')
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    setDndEnabled(false);
    setDndUntil('');
    await handleSave();
  };

  const formatUntil = (until: string) => {
    if (!until) return '';
    const date = new Date(until);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <Moon size={20} />
          {t('settings.notifications.dnd.title', 'Do Not Disturb')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('settings.notifications.dnd.subtitle', 'Temporarily pause all notifications')}
        </p>
      </div>

      {/* Current Status */}
      {dndEnabled && dndUntil && (
        <div className="p-4 bg-primary-50 dark:bg-primary-500/20 border border-primary-200 dark:border-primary-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-900 dark:text-primary-100">
                {t('settings.notifications.dnd.active', 'DND is active')}
              </p>
              <p className="text-xs text-primary-700 dark:text-primary-300 mt-1">
                {t('settings.notifications.dnd.until', 'Until')}: {formatUntil(dndUntil)}
              </p>
            </div>
            <button
              onClick={handleDisable}
              className="p-2 hover:bg-primary-100 dark:hover:bg-primary-500/30 rounded-lg transition-colors"
            >
              <X size={16} className="text-primary-600 dark:text-primary-400" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Presets */}
      {!dndEnabled && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('settings.notifications.dnd.quickPresets', 'Quick Presets')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {DND_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className="px-4 py-3 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-primary-300 transition-colors text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom Time */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Clock size={16} />
          {t('settings.notifications.dnd.customTime', 'Custom End Time')}
        </label>
        <input
          type="datetime-local"
          value={dndUntil ? new Date(dndUntil).toISOString().slice(0, 16) : ''}
          onChange={(e) => {
            if (e.target.value) {
              setDndUntil(new Date(e.target.value).toISOString());
              setDndEnabled(true);
            }
          }}
          min={new Date().toISOString().slice(0, 16)}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none"
        />
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          {t('settings.notifications.dnd.saved', 'DND mode updated')}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm">
          <AlertCircle size={16} />
          {t('settings.notifications.dnd.error', 'Failed to update DND mode')}
        </div>
      )}
    </div>
  );
};

export default DNDModeSettings;
