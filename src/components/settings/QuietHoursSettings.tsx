import {
  AlertTriangle,
  Bell,
  BellOff,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  MessageCircle,
  Moon,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { QuietHoursSettingsType as QuietHoursType, User } from '../../types';

interface QuietHoursSettingsProps {
  currentUser: User;
  onUpdate?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
];

export const QuietHoursSettings: React.FC<QuietHoursSettingsProps> = ({
  currentUser,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [quietHours, setQuietHours] = useState<QuietHoursType>({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    daysOfWeek: [0, 6], // Weekend by default
    allowUrgent: true,
    allowMentions: false,
    allowDirectMessages: false,
    autoReplyEnabled: false,
    autoReplyMessage: '',
  });

  // Load preferences
  useEffect(() => {
    loadQuietHours();
  }, [currentUser.id]);

  const loadQuietHours = async () => {
    try {
      const response = await Api.get('/settings/preferences/quietHours');
      if (response?.preferences) {
        setQuietHours(response.preferences as QuietHoursType);
      }
    } catch (error) {
      console.error('Failed to load quiet hours:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Api.put('/settings/preferences/quietHours', quietHours);
      setSaveStatus('success');
      onUpdate?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save quiet hours:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setQuietHours((prev: any) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d: any) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  };

  // Styling
  const cardClass =
    'bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-lg p-6';
  const sectionTitleClass =
    'text-sm font-bold text-navy-900 mb-4 uppercase tracking-wider flex items-center gap-2';
  const inputClass =
    'w-full px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-md text-navy-900 focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none transition-all';
  const labelClass = 'text-xs font-medium text-c-text-muted';
  const toggleClass = (enabled: boolean) =>
    `relative w-12 h-6 rounded-full transition-colors ${
      enabled ? 'bg-c-accent' : 'bg-c-surface-raised'
    }`;
  const toggleKnobClass = (enabled: boolean) =>
    `absolute top-1 w-4 h-4 rounded-full bg-c-surface shadow transition-all ${enabled ? 'left-7' : 'left-1'}`;

  const ToggleSwitch = ({
    enabled,
    onChange,
    label,
    description,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-c-border-subtle dark:border-navy-700 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-navy-900">{label}</p>
        <p className="text-xs text-c-text-muted mt-0.5">{description}</p>
      </div>
      <button onClick={() => onChange(!enabled)} className={toggleClass(enabled)}>
        <span className={toggleKnobClass(enabled)} />
      </button>
    </div>
  );

  // Calculate if currently in quiet hours
  const isCurrentlyQuiet = (): boolean => {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = quietHours.startTime.split(':').map(Number);
    const [endH, endM] = quietHours.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (!quietHours.daysOfWeek.includes(currentDay)) return false;

    if (startMinutes < endMinutes) {
      return currentTime >= startMinutes && currentTime < endMinutes;
    } else {
      return currentTime >= startMinutes || currentTime < endMinutes;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-navy-900">
            {t('settings.quietHours.title', 'Quiet Hours / Do Not Disturb')}
          </h3>
          <p className="text-c-text-muted text-sm mt-1">
            {t(
              'settings.quietHours.description',
              'Schedule times when you want to minimize notifications'
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-c-accent hover:bg-c-accent text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-c-accent"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>

      {/* Current Status */}
      {quietHours.enabled && isCurrentlyQuiet() && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
              <Moon size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="font-medium text-indigo-900 dark:text-indigo-300">
                {t('settings.quietHours.currentlyActive', 'Quiet Hours are currently active')}
              </p>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">
                {t('settings.quietHours.activeUntil', 'Active until')} {quietHours.endTime}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enable Toggle */}
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${quietHours.enabled ? 'bg-indigo-100 dark:bg-indigo-500/20' : 'bg-c-surface-raised'}`}
            >
              {quietHours.enabled ? (
                <BellOff size={20} className="text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Bell size={20} className="text-c-text-secondary" />
              )}
            </div>
            <div>
              <p className="font-medium text-navy-900">
                {t('settings.quietHours.enable', 'Enable Quiet Hours')}
              </p>
              <p className="text-sm text-c-text-muted">
                {t('settings.quietHours.enableDesc', 'Pause notifications during scheduled times')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setQuietHours((prev: any) => ({ ...prev, enabled: !prev.enabled }))}
            className={toggleClass(quietHours.enabled)}
          >
            <span className={toggleKnobClass(quietHours.enabled)} />
          </button>
        </div>
      </div>

      {quietHours.enabled && (
        <>
          {/* Schedule */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <Clock size={16} className="text-c-accent" />
              {t('settings.quietHours.schedule', 'Schedule')}
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className={labelClass}>
                  {t('settings.quietHours.startTime', 'Start Time')}
                </label>
                <input
                  type="time"
                  value={quietHours.startTime}
                  onChange={(e) =>
                    setQuietHours((prev: any) => ({ ...prev, startTime: e.target.value }))
                  }
                  className={inputClass + ' mt-1.5'}
                />
              </div>
              <div>
                <label className={labelClass}>{t('settings.quietHours.endTime', 'End Time')}</label>
                <input
                  type="time"
                  value={quietHours.endTime}
                  onChange={(e) =>
                    setQuietHours((prev: any) => ({ ...prev, endTime: e.target.value }))
                  }
                  className={inputClass + ' mt-1.5'}
                />
              </div>
            </div>

            {/* Days */}
            <div>
              <label className={labelClass + ' mb-2 block'}>
                {t('settings.quietHours.activeDays', 'Active on these days')}
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      quietHours.daysOfWeek.includes(day.value)
                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500'
                        : 'bg-c-surface-raised text-c-text-secondary border-2 border-transparent hover:border-c-border-subtle dark:border-navy-700'
                    }`}
                    title={day.fullLabel}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Exceptions */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <AlertTriangle size={16} className="text-c-accent" />
              {t('settings.quietHours.exceptions', 'Exceptions')}
            </h4>

            <p className="text-sm text-c-text-muted mb-4">
              {t(
                'settings.quietHours.exceptionsDesc',
                'Allow certain types of notifications even during quiet hours'
              )}
            </p>

            <div className="space-y-1">
              <ToggleSwitch
                enabled={quietHours.allowUrgent}
                onChange={(val) => setQuietHours((prev: any) => ({ ...prev, allowUrgent: val }))}
                label={t('settings.quietHours.allowUrgent', 'Allow urgent notifications')}
                description={t(
                  'settings.quietHours.allowUrgentDesc',
                  'High-priority alerts will still come through'
                )}
              />
              <ToggleSwitch
                enabled={quietHours.allowMentions}
                onChange={(val) => setQuietHours((prev: any) => ({ ...prev, allowMentions: val }))}
                label={t('settings.quietHours.allowMentions', 'Allow @mentions')}
                description={t(
                  'settings.quietHours.allowMentionsDesc',
                  'Get notified when someone mentions you'
                )}
              />
              <ToggleSwitch
                enabled={quietHours.allowDirectMessages}
                onChange={(val) =>
                  setQuietHours((prev: any) => ({ ...prev, allowDirectMessages: val }))
                }
                label={t('settings.quietHours.allowDMs', 'Allow direct messages')}
                description={t(
                  'settings.quietHours.allowDMsDesc',
                  'Private messages will still notify you'
                )}
              />
            </div>
          </div>

          {/* Auto Reply */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              <MessageCircle size={16} className="text-c-accent" />
              {t('settings.quietHours.autoReply', 'Auto Reply')}
            </h4>

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-navy-900">
                  {t('settings.quietHours.enableAutoReply', 'Enable auto-reply')}
                </p>
                <p className="text-xs text-c-text-muted">
                  {t(
                    'settings.quietHours.enableAutoReplyDesc',
                    'Automatically respond to messages during quiet hours'
                  )}
                </p>
              </div>
              <button
                onClick={() =>
                  setQuietHours((prev: any) => ({
                    ...prev,
                    autoReplyEnabled: !prev.autoReplyEnabled,
                  }))
                }
                className={toggleClass(quietHours.autoReplyEnabled)}
              >
                <span className={toggleKnobClass(quietHours.autoReplyEnabled)} />
              </button>
            </div>

            {quietHours.autoReplyEnabled && (
              <div>
                <label className={labelClass}>
                  {t('settings.quietHours.autoReplyMessage', 'Auto-reply message')}
                </label>
                <textarea
                  value={quietHours.autoReplyMessage}
                  onChange={(e) =>
                    setQuietHours((prev: any) => ({ ...prev, autoReplyMessage: e.target.value }))
                  }
                  placeholder={t(
                    'settings.quietHours.autoReplyPlaceholder',
                    "I'm currently unavailable. I'll respond when I return."
                  )}
                  rows={3}
                  className={inputClass + ' resize-none mt-1.5'}
                />
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div className={cardClass}>
            <h4 className={sectionTitleClass}>
              {t('settings.quietHours.quickPresets', 'Quick Presets')}
            </h4>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setQuietHours((prev: any) => ({
                    ...prev,
                    startTime: '22:00',
                    endTime: '08:00',
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                  }))
                }
                className="px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-800 text-c-text-secondary rounded-lg text-sm transition-colors"
              >
                {t('settings.quietHours.presetNights', 'Nights (10pm-8am, every day)')}
              </button>
              <button
                onClick={() =>
                  setQuietHours((prev: any) => ({
                    ...prev,
                    startTime: '00:00',
                    endTime: '23:59',
                    daysOfWeek: [0, 6],
                  }))
                }
                className="px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-800 text-c-text-secondary rounded-lg text-sm transition-colors"
              >
                {t('settings.quietHours.presetWeekends', 'Weekends only')}
              </button>
              <button
                onClick={() =>
                  setQuietHours((prev: any) => ({
                    ...prev,
                    startTime: '18:00',
                    endTime: '09:00',
                    daysOfWeek: [1, 2, 3, 4, 5],
                  }))
                }
                className="px-4 py-2 bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-navy-800 text-c-text-secondary rounded-lg text-sm transition-colors"
              >
                {t('settings.quietHours.presetAfterWork', 'After work hours (6pm-9am, weekdays)')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Success Toast */}
      {saveStatus === 'success' && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
          <CheckCircle size={16} />
          {t('common.saved', 'Saved!')}
        </div>
      )}
    </div>
  );
};

export default QuietHoursSettings;
