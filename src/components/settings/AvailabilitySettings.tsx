/**
 * AvailabilitySettings - Consolidated DND + Quiet Hours
 *
 * Merges DNDModeSettings + QuietHoursSettings into a single professional card.
 * Section 1: Do Not Disturb (temporary mute — "right now" action)
 * Section 2: Scheduled Quiet Hours (recurring schedule + exceptions + auto-reply)
 */

import { AlertTriangle, BellOff, Clock, MessageCircle, Moon, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { QuietHoursSettingsType as QuietHoursType, User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface AvailabilitySettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface DndPreferences {
  enabled: boolean;
  until: string | null;
}

const DND_PRESETS = [
  { labelKey: 'preset1h', label: '1 hour', hours: 1 },
  { labelKey: 'preset2h', label: '2 hours', hours: 2 },
  { labelKey: 'preset4h', label: '4 hours', hours: 4 },
  {
    labelKey: 'presetTomorrow',
    label: 'Until tomorrow 9 AM',
    hours: null as number | null,
    untilTomorrow: true,
  },
] as const;

const DAYS_OF_WEEK = [
  { value: 0, key: 'sun', label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, key: 'mon', label: 'Mon', fullLabel: 'Monday' },
  { value: 2, key: 'tue', label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, key: 'wed', label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, key: 'thu', label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, key: 'fri', label: 'Fri', fullLabel: 'Friday' },
  { value: 6, key: 'sat', label: 'Sat', fullLabel: 'Saturday' },
];

const QUIET_PRESETS = [
  {
    key: 'nights',
    label: 'Nights (10pm–8am)',
    start: '22:00',
    end: '08:00',
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  { key: 'weekends', label: 'Weekends only', start: '00:00', end: '23:59', days: [0, 6] },
  {
    key: 'afterWork',
    label: 'After work (6pm–9am, weekdays)',
    start: '18:00',
    end: '09:00',
    days: [1, 2, 3, 4, 5],
  },
] as const;

export const AvailabilitySettings: React.FC<AvailabilitySettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();

  // --- DND state ---
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndUntil, setDndUntil] = useState('');

  // --- Quiet Hours state ---
  const [quietHours, setQuietHours] = useState<QuietHoursType>({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    daysOfWeek: [0, 6],
    allowUrgent: true,
    allowMentions: false,
    allowDirectMessages: false,
    autoReplyEnabled: false,
    autoReplyMessage: '',
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Track original for dirty detection
  const [originalDnd, setOriginalDnd] = useState<DndPreferences>({ enabled: false, until: null });
  const [originalQuiet, setOriginalQuiet] = useState<QuietHoursType>(quietHours);

  useEffect(() => {
    const dirty =
      JSON.stringify({ enabled: dndEnabled, until: dndUntil || null }) !==
        JSON.stringify(originalDnd) || JSON.stringify(quietHours) !== JSON.stringify(originalQuiet);
    setIsDirty(dirty);
  }, [dndEnabled, dndUntil, quietHours, originalDnd, originalQuiet]);

  // --- Load ---
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const [dndRes, qhRes] = await Promise.all([
          Api.get('/settings/notifications/dnd'),
          Api.get('/settings/preferences/quietHours'),
        ]);
        if (!dndRes || typeof dndRes !== 'object' || !qhRes?.preferences) {
          throw new Error('Availability response was missing DND or quiet hours settings');
        }
        const d = dndRes as Partial<DndPreferences>;
        const nextDnd = { enabled: d.enabled ?? false, until: d.until || null };
        const qh = qhRes.preferences as QuietHoursType;
        setDndEnabled(nextDnd.enabled);
        setDndUntil(nextDnd.until || '');
        setOriginalDnd(nextDnd);
        setQuietHours(qh);
        setOriginalQuiet(qh);
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load availability settings'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser.id]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      setActionError(null);
      const expectedDnd = {
        enabled: dndEnabled,
        until: dndEnabled ? dndUntil || null : null,
      };
      await Promise.all([
        Api.put('/settings/notifications/dnd', expectedDnd),
        Api.put('/settings/preferences/quietHours', quietHours),
      ]);
      const [dndRes, qhRes] = await Promise.all([
        Api.get('/settings/notifications/dnd'),
        Api.get('/settings/preferences/quietHours'),
      ]);
      if (!dndRes || typeof dndRes !== 'object' || !qhRes?.preferences) {
        throw new Error('Availability settings save was not confirmed by the server');
      }
      const nextDnd =
        dndRes && typeof dndRes === 'object'
          ? ({
              enabled: (dndRes as Partial<DndPreferences>).enabled ?? false,
              until: (dndRes as Partial<DndPreferences>).until || null,
            } satisfies DndPreferences)
          : { enabled: dndEnabled, until: dndUntil || null };
      const nextQuiet = qhRes?.preferences ? (qhRes.preferences as QuietHoursType) : quietHours;
      if (
        JSON.stringify(nextDnd) !== JSON.stringify(expectedDnd) ||
        JSON.stringify(nextQuiet) !== JSON.stringify(quietHours)
      ) {
        throw new Error('Availability settings save was not confirmed by the server');
      }
      setDndEnabled(nextDnd.enabled);
      setDndUntil(nextDnd.until || '');
      setQuietHours(nextQuiet);
      setOriginalDnd(nextDnd);
      setOriginalQuiet(nextQuiet);
      toast.success(t('settings.availability.saved', 'Availability settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.availability.error', 'Failed to save availability settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [dndEnabled, dndUntil, quietHours, t]);

  // --- DND preset handler ---
  const handleDndPreset = (preset: (typeof DND_PRESETS)[number]) => {
    const now = new Date();
    let until: Date;
    if ('untilTomorrow' in preset && preset.untilTomorrow) {
      until = new Date(now);
      until.setDate(until.getDate() + 1);
      until.setHours(9, 0, 0, 0);
    } else {
      until = new Date(now.getTime() + (preset.hours ?? 0) * 60 * 60 * 1000);
    }
    setDndUntil(until.toISOString());
    setDndEnabled(true);
  };

  const handleDisableDnd = () => {
    setDndEnabled(false);
    setDndUntil('');
  };

  // --- Quiet Hours helpers ---
  const toggleDay = (day: number) => {
    setQuietHours((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d: number) => d !== day)
        : [...prev.daysOfWeek, day].sort(),
    }));
  };

  const applyQuietPreset = (preset: (typeof QUIET_PRESETS)[number]) => {
    setQuietHours((prev) => ({
      ...prev,
      enabled: true,
      startTime: preset.start,
      endTime: preset.end,
      daysOfWeek: [...preset.days],
    }));
  };

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
    return startMinutes < endMinutes
      ? currentTime >= startMinutes && currentTime < endMinutes
      : currentTime >= startMinutes || currentTime < endMinutes;
  };

  const formatUntil = (until: string) => {
    if (!until) return '';
    const date = new Date(until);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
  };

  const cardClass = 'bg-c-surface-raised border border-c-border-subtle rounded-lg p-5';
  const sectionLabel =
    'text-xs font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-2 mb-4';
  const inputClass =
    'w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text focus:ring-2 focus:ring-[color:var(--c-focus)] outline-none transition-all';

  return (
    <SettingsSection
      icon={Moon}
      title={t('settings.availability.title', 'Availability & Focus')}
      description={t(
        'settings.availability.description',
        'Control when notifications reach you — temporary mute or recurring schedule'
      )}
      cardId="settings-availability"
      isDirty={isDirty}
      onSave={handleSave}
      saving={saving}
      loading={loading}
    >
      <div className="space-y-6">
        {loadError && (
          <DegradedState title="Availability settings unavailable" description={loadError} />
        )}

        {actionError && <Banner variant="danger" title={actionError} />}

        {!loadError && (
          <>
            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 1: Do Not Disturb                      */}
            {/* ═══════════════════════════════════════════════ */}
            <div>
              <h4 className={sectionLabel}>
                <Moon size={14} className="text-c-text-secondary" />
                {t('settings.availability.dnd', 'Do Not Disturb')}
              </h4>
              <p className="text-xs text-c-text-muted mb-4">
                {t('settings.availability.dndDesc', 'Temporarily pause all notifications')}
              </p>

              {/* Active DND banner */}
              {dndEnabled && dndUntil && (
                <div className="p-3 mb-4 bg-c-accent-soft border border-c-accent rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-c-accent">
                      {t('settings.availability.dndActive', 'DND is active')}
                    </p>
                    <p className="text-xs text-c-accent mt-0.5">
                      {t('settings.availability.until', 'Until')}: {formatUntil(dndUntil)}
                    </p>
                  </div>
                  <button
                    onClick={handleDisableDnd}
                    className="p-1.5 hover:bg-c-accent-soft rounded-lg transition-colors"
                  >
                    <X size={14} className="text-c-text-secondary" />
                  </button>
                </div>
              )}

              {/* Quick presets */}
              {!dndEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  {DND_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => handleDndPreset(preset)}
                      className="px-4 py-2.5 bg-c-surface-raised border border-c-border-subtle rounded-lg hover:border-c-accent hover:bg-c-accent-soft transition-all text-sm text-c-text-secondary"
                    >
                      {t(`settings.availability.${preset.labelKey}`, preset.label)}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom end time */}
              <div className="mt-4">
                <label className="text-xs font-medium text-c-text-secondary flex items-center gap-1.5 mb-1.5">
                  <Clock size={12} />
                  {t('settings.availability.customEndTime', 'Custom End Time')}
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
                  className={inputClass}
                />
              </div>
            </div>

            <SettingsDivider />

            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 2: Scheduled Quiet Hours               */}
            {/* ═══════════════════════════════════════════════ */}
            <div>
              <h4 className={sectionLabel}>
                <BellOff size={14} className="text-c-text-secondary" />
                {t('settings.availability.quietHours', 'Scheduled Quiet Hours')}
              </h4>

              {/* Currently active banner */}
              {quietHours.enabled && isCurrentlyQuiet() && (
                <div className="p-3 mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center gap-3">
                  <Moon size={16} className="text-indigo-400" />
                  <div>
                    <p className="text-sm font-medium text-indigo-300">
                      {t('settings.availability.quietActive', 'Quiet Hours are currently active')}
                    </p>
                    <p className="text-xs text-indigo-400">
                      {t('settings.availability.activeUntil', 'Active until')} {quietHours.endTime}
                    </p>
                  </div>
                </div>
              )}

              {/* Enable toggle */}
              <SettingsToggle
                checked={quietHours.enabled}
                onChange={(val) => setQuietHours((prev) => ({ ...prev, enabled: val }))}
                label={t('settings.availability.enableQuiet', 'Enable Quiet Hours')}
                description={t(
                  'settings.availability.enableQuietDesc',
                  'Pause notifications during scheduled times'
                )}
              />

              {quietHours.enabled && (
                <div className="mt-5 space-y-5">
                  {/* Schedule */}
                  <div className={cardClass}>
                    <h5 className={sectionLabel}>
                      <Clock size={14} className="text-c-text-secondary" />
                      {t('settings.availability.schedule', 'Schedule')}
                    </h5>
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="text-xs font-medium text-c-text-muted mb-1 block">
                          {t('settings.availability.startTime', 'Start Time')}
                        </label>
                        <input
                          type="time"
                          value={quietHours.startTime}
                          onChange={(e) =>
                            setQuietHours((prev) => ({ ...prev, startTime: e.target.value }))
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-c-text-muted mb-1 block">
                          {t('settings.availability.endTime', 'End Time')}
                        </label>
                        <input
                          type="time"
                          value={quietHours.endTime}
                          onChange={(e) =>
                            setQuietHours((prev) => ({ ...prev, endTime: e.target.value }))
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Days */}
                    <label className="text-xs font-medium text-c-text-muted mb-2 block">
                      {t('settings.availability.activeDays', 'Active on these days')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => toggleDay(day.value)}
                          title={t(`settings.availability.days.${day.key}.full`, day.fullLabel)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                            quietHours.daysOfWeek.includes(day.value)
                              ? 'bg-c-accent-soft text-c-accent border-c-accent'
                              : 'bg-c-surface-raised text-c-text-secondary border-c-border-subtle hover:border-c-border-subtle dark:hover:border-white/20'
                          )}
                        >
                          {t(`settings.availability.days.${day.key}.short`, day.label)}
                        </button>
                      ))}
                    </div>

                    {/* Quick presets */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {QUIET_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          onClick={() => applyQuietPreset(preset)}
                          className="px-3 py-1.5 text-xs bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text-secondary hover:text-c-text dark:hover:text-white hover:border-c-accent transition-all"
                        >
                          {t(`settings.availability.preset_${preset.key}`, preset.label)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exceptions */}
                  <div className={cardClass}>
                    <h5 className={sectionLabel}>
                      <AlertTriangle size={14} className="text-c-text-secondary" />
                      {t('settings.availability.exceptions', 'Exceptions')}
                    </h5>
                    <p className="text-xs text-c-text-muted mb-4">
                      {t(
                        'settings.availability.exceptionsDesc',
                        'Allow certain notifications even during quiet hours'
                      )}
                    </p>
                    <div className="space-y-3">
                      <SettingsToggle
                        checked={quietHours.allowUrgent}
                        onChange={(val) => setQuietHours((prev) => ({ ...prev, allowUrgent: val }))}
                        label={t('settings.availability.allowUrgent', 'Allow urgent notifications')}
                        description={t(
                          'settings.availability.allowUrgentDesc',
                          'High-priority alerts will still come through'
                        )}
                      />
                      <SettingsToggle
                        checked={quietHours.allowMentions}
                        onChange={(val) =>
                          setQuietHours((prev) => ({ ...prev, allowMentions: val }))
                        }
                        label={t('settings.availability.allowMentions', 'Allow @mentions')}
                        description={t(
                          'settings.availability.allowMentionsDesc',
                          'Get notified when someone mentions you'
                        )}
                      />
                      <SettingsToggle
                        checked={quietHours.allowDirectMessages}
                        onChange={(val) =>
                          setQuietHours((prev) => ({ ...prev, allowDirectMessages: val }))
                        }
                        label={t('settings.availability.allowDMs', 'Allow direct messages')}
                        description={t(
                          'settings.availability.allowDMsDesc',
                          'Private messages will still notify you'
                        )}
                      />
                    </div>
                  </div>

                  {/* Auto Reply */}
                  <div className={cardClass}>
                    <h5 className={sectionLabel}>
                      <MessageCircle size={14} className="text-c-text-secondary" />
                      {t('settings.availability.autoReply', 'Auto Reply')}
                    </h5>
                    <SettingsToggle
                      checked={quietHours.autoReplyEnabled}
                      onChange={(val) =>
                        setQuietHours((prev) => ({ ...prev, autoReplyEnabled: val }))
                      }
                      label={t('settings.availability.enableAutoReply', 'Enable auto-reply')}
                      description={t(
                        'settings.availability.enableAutoReplyDesc',
                        'Automatically respond to messages during quiet hours'
                      )}
                    />
                    {quietHours.autoReplyEnabled && (
                      <div className="mt-3">
                        <label className="text-xs font-medium text-c-text-muted mb-1 block">
                          {t('settings.availability.autoReplyMessage', 'Auto-reply message')}
                        </label>
                        <textarea
                          value={quietHours.autoReplyMessage}
                          onChange={(e) =>
                            setQuietHours((prev) => ({ ...prev, autoReplyMessage: e.target.value }))
                          }
                          placeholder={t(
                            'settings.availability.autoReplyPlaceholder',
                            "I'm currently unavailable. I'll respond when I return."
                          )}
                          rows={3}
                          className={cn(inputClass, 'resize-none')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
};

export default AvailabilitySettings;
