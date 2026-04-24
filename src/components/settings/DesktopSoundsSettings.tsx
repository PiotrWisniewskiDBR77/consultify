/**
 * DesktopSoundsSettings - Consolidated Push + Sound notifications
 *
 * Merges PushNotificationsSettings + SoundNotificationsSettings into one card.
 * Section 1: Desktop Notifications (enable push + position + duration)
 * Section 2: Sound Alerts (enable sounds + sound per type)
 */

import { Bell, Monitor, Volume2, VolumeX } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface DesktopSoundsSettingsProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

type DesktopPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface CombinedPreferences {
  pushEnabled: boolean;
  desktopEnabled: boolean;
  soundEnabled: boolean;
  soundPerType: Record<string, string>;
  desktopPosition: DesktopPosition;
  desktopDuration: number;
}

const SOUND_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'pop', label: 'Pop' },
  { value: 'none', label: 'None' },
] as const;

const POSITION_OPTIONS = [
  { value: 'top-right' as const, label: 'Top Right' },
  { value: 'top-left' as const, label: 'Top Left' },
  { value: 'bottom-right' as const, label: 'Bottom Right' },
  { value: 'bottom-left' as const, label: 'Bottom Left' },
];

const NOTIFICATION_TYPES = [
  { id: 'task_assigned', label: 'Task Assigned' },
  { id: 'task_updated', label: 'Task Updated' },
  { id: 'mention', label: 'Mentions' },
  { id: 'milestone', label: 'Milestones' },
] as const;

const defaultPrefs: CombinedPreferences = {
  pushEnabled: false,
  desktopEnabled: true,
  soundEnabled: true,
  soundPerType: {},
  desktopPosition: 'top-right',
  desktopDuration: 5000,
};

export const DesktopSoundsSettings: React.FC<DesktopSoundsSettingsProps> = ({
  currentUser,
  onUpdateUser,
}) => {
  const { t } = useTranslation();

  const [prefs, setPrefs] = useState<CombinedPreferences>({ ...defaultPrefs });
  const [original, setOriginal] = useState<CombinedPreferences>({ ...defaultPrefs });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(original);

  // Load
  useEffect(() => {
    const load = async () => {
      try {
        const soundRes = await Api.get('/settings/notifications/sounds').catch(() => null);
        if (soundRes && typeof soundRes === 'object') {
          const s = soundRes as Partial<CombinedPreferences>;
          const loaded: CombinedPreferences = {
            pushEnabled: s.pushEnabled ?? false,
            desktopEnabled: s.desktopEnabled !== false,
            soundEnabled: s.soundEnabled !== false,
            soundPerType: s.soundPerType || {},
            desktopPosition: (s.desktopPosition as DesktopPosition) || 'top-right',
            desktopDuration: typeof s.desktopDuration === 'number' ? s.desktopDuration : 5000,
          };
          setPrefs(loaded);
          setOriginal(loaded);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
          setPrefs((prev) => ({ ...prev, pushEnabled: true }));
          setOriginal((prev) => ({ ...prev, pushEnabled: true }));
        }
      } catch (err) {
        console.error('Failed to load desktop/sound settings', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser.id]);

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await Api.put('/settings/notifications/sounds', {
        pushEnabled: prefs.pushEnabled,
        desktopEnabled: prefs.desktopEnabled,
        soundEnabled: prefs.soundEnabled,
        soundPerType: prefs.soundPerType,
        desktopPosition: prefs.desktopPosition,
        desktopDuration: prefs.desktopDuration,
      });
      setOriginal({ ...prefs });
      toast.success(t('settings.desktopSounds.saved', 'Desktop & sound settings saved'));
    } catch (err) {
      toast.error(t('settings.desktopSounds.error', 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  }, [prefs, t]);

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPrefs((prev) => ({ ...prev, pushEnabled: true }));
        toast.success(t('settings.desktopSounds.pushEnabled', 'Push notifications enabled'));
      } else {
        toast.error(t('settings.desktopSounds.pushDenied', 'Permission denied by browser'));
      }
    }
  };

  const sectionLabel =
    'text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4';

  return (
    <SettingsSection
      icon={Monitor}
      title={t('settings.desktopSounds.title', 'Desktop & Sounds')}
      description={t(
        'settings.desktopSounds.description',
        'Configure how notifications appear on your screen and what sounds they play'
      )}
      cardId="settings-desktop-sounds"
      isDirty={isDirty}
      onSave={handleSave}
      saving={saving}
      loading={loading}
    >
      <div className="space-y-6">
        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION 1: Desktop Notifications               */}
        {/* ═══════════════════════════════════════════════ */}
        <div>
          <h4 className={sectionLabel}>
            <Bell size={14} className="text-violet-400" />
            {t('settings.desktopSounds.desktopNotifications', 'Desktop Notifications')}
          </h4>

          <div className="space-y-4">
            <SettingsToggle
              checked={prefs.desktopEnabled}
              onChange={(val) => setPrefs((prev) => ({ ...prev, desktopEnabled: val }))}
              label={t('settings.desktopSounds.showDesktop', 'Show desktop notifications')}
              description={t(
                'settings.desktopSounds.showDesktopDesc',
                'Display notifications in your browser'
              )}
            />

            {!prefs.pushEnabled &&
              'Notification' in window &&
              Notification.permission !== 'granted' && (
                <button
                  onClick={requestPushPermission}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors text-sm"
                >
                  <Bell size={14} />
                  {t('settings.desktopSounds.enablePush', 'Enable Push Notifications')}
                </button>
              )}

            {prefs.desktopEnabled && (
              <>
                {/* Position */}
                <div>
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-2">
                    <Monitor size={12} />
                    {t('settings.desktopSounds.position', 'Notification Position')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setPrefs((prev) => ({ ...prev, desktopPosition: opt.value }))
                        }
                        className={cn(
                          'px-3 py-2 rounded-lg border-2 transition-all text-sm',
                          prefs.desktopPosition === opt.value
                            ? 'border-violet-500 bg-violet-600/10 text-violet-300'
                            : 'border-white/5 text-slate-400 hover:border-violet-500/30'
                        )}
                      >
                        {t(`settings.desktopSounds.pos_${opt.value}`, opt.label)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-2 block">
                    {t('settings.desktopSounds.duration', 'Notification Duration')}
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1000"
                      max="10000"
                      step="500"
                      value={prefs.desktopDuration}
                      onChange={(e) =>
                        setPrefs((prev) => ({ ...prev, desktopDuration: Number(e.target.value) }))
                      }
                      className="flex-1 accent-violet-500"
                    />
                    <span className="text-sm text-slate-400 w-12 text-right tabular-nums">
                      {prefs.desktopDuration / 1000}s
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <SettingsDivider />

        {/* ═══════════════════════════════════════════════ */}
        {/* SECTION 2: Sound Alerts                        */}
        {/* ═══════════════════════════════════════════════ */}
        <div>
          <h4 className={sectionLabel}>
            <Volume2 size={14} className="text-violet-400" />
            {t('settings.desktopSounds.soundAlerts', 'Sound Alerts')}
          </h4>

          <div className="space-y-4">
            {/* Master toggle */}
            <div className="flex items-center justify-between p-3.5 bg-navy-900/30 border border-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                {prefs.soundEnabled ? (
                  <Volume2 size={18} className="text-violet-400" />
                ) : (
                  <VolumeX size={18} className="text-slate-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">
                    {t('settings.desktopSounds.enableSounds', 'Enable Sounds')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t(
                      'settings.desktopSounds.enableSoundsDesc',
                      'Play sound alerts for notifications'
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPrefs((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-navy-900',
                  prefs.soundEnabled ? 'bg-violet-600' : 'bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-navy-900 transition-transform duration-200',
                    prefs.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Per-type sounds */}
            {prefs.soundEnabled && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-slate-400 block">
                  {t('settings.desktopSounds.soundPerType', 'Sound per Notification Type')}
                </label>
                {NOTIFICATION_TYPES.map((type) => (
                  <div key={type.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      {t(`settings.desktopSounds.type_${type.id}`, type.label)}
                    </span>
                    <select
                      value={prefs.soundPerType[type.id] || 'default'}
                      onChange={(e) =>
                        setPrefs((prev) => ({
                          ...prev,
                          soundPerType: { ...prev.soundPerType, [type.id]: e.target.value },
                        }))
                      }
                      className="px-3 py-1.5 bg-navy-800 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none"
                    >
                      {SOUND_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
};

export default DesktopSoundsSettings;
