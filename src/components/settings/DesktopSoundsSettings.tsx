/**
 * DesktopSoundsSettings - Consolidated Push + Sound notifications
 *
 * Merges PushNotificationsSettings + SoundNotificationsSettings into one card.
 *
 * N3 (DEC-2026-08-25-21): every control this screen ever offered was
 * placebo — confirmed by notyfikacje-audyt.md §1E/§1F/§2.4: no code
 * anywhere reads desktopEnabled/pushEnabled/position/duration to decide
 * whether to show a browser popup (grep across src/ for consumers of
 * these preferences finds none but this component's own state and two
 * other unmounted legacy panels), there is no server-side push
 * infrastructure at all (0 hits for web-push/firebase-admin/
 * push_subscriptions in server/src), the "push" channel doesn't exist in
 * notificationService's dispatchToChannels, and no notification sound is
 * ever played anywhere in src/ (only TTS/voice `new Audio` calls exist).
 * Interactive controls for both sections are hidden behind a single
 * honest notice; the already-correct "Mobile push — coming soon" card
 * is untouched. Preference state/load/save round-trip logic is left
 * intact (still loaded, still persisted unmodified on save) so
 * re-enabling this is a pure UI change once a real delivery backend
 * exists.
 */

import { Bell, Monitor } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState, ReadOnlyState } from '../Admin/AdminState';
import { SettingsSection } from './shared';

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

// N3: SOUND_OPTIONS/POSITION_OPTIONS/NOTIFICATION_TYPES previously
// rendered the per-type sound picker and position/duration controls,
// removed below (see file header comment). The underlying prefs fields
// are kept so re-adding the pickers later is a pure UI change.

const defaultPrefs: CombinedPreferences = {
  pushEnabled: false,
  desktopEnabled: true,
  soundEnabled: true,
  soundPerType: {},
  desktopPosition: 'top-right',
  desktopDuration: 5000,
};

export const DesktopSoundsSettings: React.FC<DesktopSoundsSettingsProps> = ({ currentUser }) => {
  const { t } = useTranslation();

  const [prefs, setPrefs] = useState<CombinedPreferences>({ ...defaultPrefs });
  const [original, setOriginal] = useState<CombinedPreferences>({ ...defaultPrefs });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(original);

  // Load
  useEffect(() => {
    const load = async () => {
      try {
        setLoadError(null);
        const soundRes = await Api.get('/settings/notifications/sounds');
        if (!soundRes || typeof soundRes !== 'object') {
          throw new Error('Desktop sound settings response was missing preferences');
        }
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

        if ('Notification' in window && Notification.permission === 'granted') {
          setPrefs((prev) => ({ ...prev, pushEnabled: true }));
          setOriginal((prev) => ({ ...prev, pushEnabled: true }));
        }
      } catch (err: unknown) {
        setLoadError(normalizeApiErrorMessage(err, 'Failed to load desktop sound settings'));
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
      setActionError(null);
      await Api.put('/settings/notifications/sounds', {
        pushEnabled: prefs.pushEnabled,
        desktopEnabled: prefs.desktopEnabled,
        soundEnabled: prefs.soundEnabled,
        soundPerType: prefs.soundPerType,
        desktopPosition: prefs.desktopPosition,
        desktopDuration: prefs.desktopDuration,
      });
      const persisted = await Api.get('/settings/notifications/sounds');
      if (!persisted || typeof persisted !== 'object') {
        throw new Error('Desktop sound settings save was not confirmed by the server');
      }
      const next =
        persisted && typeof persisted === 'object'
          ? ({
              ...defaultPrefs,
              ...(persisted as Partial<CombinedPreferences>),
            } as CombinedPreferences)
          : { ...prefs };
      if (JSON.stringify(next) !== JSON.stringify(prefs)) {
        throw new Error('Desktop sound settings save was not confirmed by the server');
      }
      setPrefs(next);
      setOriginal(next);
      toast.success(t('settings.desktopSounds.saved', 'Desktop & sound settings saved'));
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(
        err,
        t('settings.desktopSounds.error', 'Failed to save settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [prefs, t]);

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
        {loadError && (
          <DegradedState title="Desktop sound settings unavailable" description={loadError} />
        )}

        {actionError && <Banner variant="danger" title={actionError} />}

        {!loadError && (
          <>
            {/* Mobile push has no delivery backend yet — surfaced as gated
                rather than offering a toggle that records a no-op flag.
                Already honest before N3; left as-is. */}
            <div className="flex items-start justify-between gap-4 p-3.5 bg-c-surface-raised border border-c-border-subtle rounded-lg">
              <div className="flex items-start gap-3">
                <Bell size={16} className="text-c-text-muted mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-c-text">
                    {t('settings.desktopSounds.mobilePush', 'Mobile push notifications')}
                  </p>
                  <p className="text-xs text-c-text-muted">
                    {t(
                      'settings.desktopSounds.mobilePushDesc',
                      'Requires the Consultify mobile app, which is coming soon.'
                    )}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text-secondary flex-shrink-0">
                {t('common.comingSoon', 'Coming soon')}
              </span>
            </div>

            {/* N3 placebo hide (DEC-2026-08-25-21): desktop-popup controls
                (show/position/duration/permission) and sound controls
                (enable/per-type) removed — see file header comment for why.
                One honest notice replaces both, per "jedna notatka". */}
            <ReadOnlyState
              title={t('settings.desktopSounds.plannedTitle', 'Planned — this channel will go live after rollout')}
              description={t(
                'settings.desktopSounds.plannedDesc',
                'Desktop pop-ups and sound alerts are not implemented yet.'
              )}
            />
          </>
        )}
      </div>
    </SettingsSection>
  );
};

export default DesktopSoundsSettings;
