/**
 * PushNotificationsSettings — Browser/desktop push preferences.
 *
 * Delivery reality (kept honest, no silent no-ops in the paid path):
 *  - Desktop/browser notifications use the W3C Notification API and DO work in
 *    the browser. The toggle is gated on the OS/browser permission grant and the
 *    preference is persisted to `user_preferences` via the notifications endpoint.
 *  - Mobile push (FCM/APNS) has no delivery backend yet, so the mobile-push row
 *    is explicitly disabled and labelled as "requires the mobile app" instead of
 *    presenting a toggle that records a flag nothing acts on.
 */

import { Bell, BellOff, Smartphone } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { ErrorState, LoadingState } from '../ui/primitives';
import { SettingsDivider, SettingsSection, SettingsToggle } from './shared';

interface PushNotificationsSettingsProps {
  /** Current user id, used to load/persist notification preferences. */
  userId?: string;
  className?: string;
}

type BrowserPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const getPermission = (): BrowserPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as BrowserPermission;
};

export const PushNotificationsSettings: React.FC<PushNotificationsSettingsProps> = ({
  userId,
  className = '',
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<BrowserPermission>(getPermission());
  const [desktopEnabled, setDesktopEnabled] = useState(false);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = (await Api.get('/settings/preferences/notifications')) as {
        preferences?: { desktop?: boolean; push?: boolean };
      };
      const prefs = response?.preferences || {};
      // `desktop` is the dedicated browser-notification flag; fall back to the
      // legacy `push` flag for backwards compatibility with older records.
      setDesktopEnabled(Boolean(prefs.desktop ?? prefs.push ?? false));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences, userId]);

  const persistDesktop = useCallback(
    async (next: boolean) => {
      setSaving(true);
      try {
        // Merge so we never clobber unrelated notification preferences.
        const current = (await Api.get('/settings/preferences/notifications')) as {
          preferences?: Record<string, unknown>;
        };
        const merged = { ...(current?.preferences || {}), desktop: next };
        await Api.put('/settings/preferences/notifications', { preferences: merged });
        setDesktopEnabled(next);
      } catch {
        toast.error(t('settings.notifications.saveFailed', 'Could not save your preference'));
        // Re-sync from server so the toggle never lies about persisted state.
        await loadPreferences();
      } finally {
        setSaving(false);
      }
    },
    [loadPreferences, t]
  );

  const handleDesktopToggle = useCallback(
    async (next: boolean) => {
      if (next && permission !== 'granted') {
        if (permission === 'unsupported') {
          toast.error(
            t('settings.notifications.unsupported', 'Your browser does not support notifications')
          );
          return;
        }
        const result = await Notification.requestPermission();
        setPermission(result as BrowserPermission);
        if (result !== 'granted') {
          toast.error(t('settings.notifications.pushDenied', 'Permission denied'));
          return;
        }
        toast.success(t('settings.notifications.pushEnabled', 'Desktop notifications enabled'));
      }
      await persistDesktop(next);
    },
    [permission, persistDesktop, t]
  );

  if (loading) {
    return (
      <SettingsSection
        icon={Bell}
        title={t('settings.notifications.pushTitle', 'Push Notifications')}
        description={t('settings.notifications.pushDesc', 'Get notified about important updates.')}
        cardId="settings.push-notifications"
        className={className}
      >
        <LoadingState
          label={t('settings.notifications.loading', 'Loading notification preferences…')}
        />
      </SettingsSection>
    );
  }

  if (loadError) {
    return (
      <SettingsSection
        icon={Bell}
        title={t('settings.notifications.pushTitle', 'Push Notifications')}
        description={t('settings.notifications.pushDesc', 'Get notified about important updates.')}
        cardId="settings.push-notifications"
        className={className}
      >
        <ErrorState
          title={t('settings.notifications.loadErrorTitle', 'Could not load preferences')}
          message={t(
            'settings.notifications.loadError',
            'We could not load your notification preferences. Please try again.'
          )}
          retry={loadPreferences}
        />
      </SettingsSection>
    );
  }

  const permissionDenied = permission === 'denied';

  return (
    <SettingsSection
      icon={Bell}
      title={t('settings.notifications.pushTitle', 'Push Notifications')}
      description={t('settings.notifications.pushDesc', 'Get notified about important updates.')}
      cardId="settings.push-notifications"
      className={className}
    >
      <div className="space-y-5">
        {permissionDenied && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
          >
            <BellOff size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {t('settings.notifications.blockedTitle', 'Notifications are blocked')}
              </p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                {t(
                  'settings.notifications.blocked',
                  'Your browser is blocking notifications for this site. Enable them in your browser settings to receive desktop alerts.'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Desktop / browser notifications — real, working delivery path. */}
        <SettingsToggle
          checked={desktopEnabled && permission === 'granted'}
          onChange={handleDesktopToggle}
          disabled={saving || permission === 'unsupported' || permissionDenied}
          label={t('settings.notifications.desktop', 'Desktop Notifications')}
          description={t(
            'settings.notifications.desktopDesc',
            'Show notifications in your browser when something needs your attention.'
          )}
        />

        <SettingsDivider />

        {/* Mobile push — no delivery backend yet, explicitly gated. */}
        <div className="flex items-start justify-between gap-4 opacity-90">
          <div className="flex items-start gap-3 flex-1">
            <Smartphone size={18} className="text-c-text-secondary mt-0.5" />
            <div>
              <span className="text-sm font-medium text-white">
                {t('settings.notifications.mobilePush', 'Mobile Push Notifications')}
              </span>
              <p className="text-xs text-c-text-secondary mt-0.5">
                {t(
                  'settings.notifications.mobilePushDesc',
                  'Mobile push requires the Consultify mobile app, which is coming soon.'
                )}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-c-surface-raised px-2.5 py-1 text-xs font-medium text-c-text-secondary flex-shrink-0">
            {t('common.comingSoon', 'Coming soon')}
          </span>
        </div>
      </div>
    </SettingsSection>
  );
};

export default PushNotificationsSettings;
