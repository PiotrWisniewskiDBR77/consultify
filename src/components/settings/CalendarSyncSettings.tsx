/**
 * CalendarSyncSettings - Calendar synchronization settings
 */

import { Calendar, Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';

interface CalendarSyncSettingsProps {
  className?: string;
}

interface CalendarProvider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  connection?: {
    externalEmail: string;
    calendarName: string;
    lastSyncAt: string;
    syncTasks: boolean;
    syncMeetings: boolean;
  } | null;
}

export const CalendarSyncSettings: React.FC<CalendarSyncSettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [calendars, setCalendars] = useState<CalendarProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncTasks, setSyncTasks] = useState(true);
  const [syncMeetings, setSyncMeetings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchCalendars();
    fetchSettings();
  }, []);

  const fetchCalendars = async (): Promise<CalendarProvider[] | null> => {
    try {
      setLoadError(null);
      const calendars = await Api.getCalendars();
      const nextCalendars = Array.isArray(calendars) ? calendars : [];
      setCalendars(nextCalendars);
      return nextCalendars;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load calendars');
      setLoadError(message);
      setCalendars([]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const settings = await Api.getCalendarSettings();
      if (settings) {
        setSyncTasks(settings.syncTasks);
        setSyncMeetings(settings.syncMeetings);
      }
    } catch {
      // Use defaults
    }
  };

  const connectCalendar = async (calendarId: string) => {
    try {
      setActionError(null);
      const data = await Api.connectCalendar(calendarId);
      if (data?.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      const refreshed = await fetchCalendars();
      if (!refreshed?.some((calendar) => calendar.id === calendarId && calendar.connected)) {
        throw new Error('Calendar connection was not confirmed by the server');
      }
      toast.success(t('settings.integrations.connected', 'Calendar connected'));
    } catch (error: unknown) {
      // Graceful handling for not-yet-implemented providers (server 501):
      // show a clear "Coming soon" instead of a scary "Failed to connect".
      const status =
        (error as { status?: number; statusCode?: number })?.status ??
        (error as { statusCode?: number })?.statusCode;
      const rawMsg = String((error as { message?: string })?.message || '');
      const isNotImplemented = status === 501 || /501|not implemented|coming soon/i.test(rawMsg);
      if (isNotImplemented) {
        const comingSoon = t(
          'settings.integrations.comingSoon',
          'This calendar integration is coming soon.'
        );
        setActionError(comingSoon);
        toast(comingSoon);
        return;
      }
      const message = normalizeApiErrorMessage(
        error,
        t('settings.integrations.connectError', 'Failed to connect calendar')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const disconnectCalendar = async (calendarId: string) => {
    if (!confirm(t('settings.integrations.disconnectConfirm', 'Disconnect this calendar?'))) return;

    try {
      setActionError(null);
      await Api.disconnectCalendar(calendarId);
      const refreshed = await fetchCalendars();
      if (
        !refreshed ||
        refreshed.some((calendar) => calendar.id === calendarId && calendar.connected)
      ) {
        throw new Error('Calendar disconnection was not confirmed by the server');
      }
      toast.success(t('settings.integrations.disconnected', 'Calendar disconnected'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.integrations.disconnectError', 'Failed to disconnect')
      );
      setActionError(message);
      toast.error(message);
    }
  };

  const handleSaveSettings = async (tasks: boolean, meetings: boolean) => {
    setSavingSettings(true);
    try {
      setActionError(null);
      await Api.updateCalendarSettings({
        syncTasks: tasks,
        syncMeetings: meetings,
      });
      const persisted = await Api.getCalendarSettings();
      if (!persisted || persisted.syncTasks !== tasks || persisted.syncMeetings !== meetings) {
        throw new Error('Calendar sync settings save was not confirmed by the server');
      }
      setSyncTasks(persisted.syncTasks);
      setSyncMeetings(persisted.syncMeetings);
      toast.success(t('settings.saved', 'Settings saved'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.saveError', 'Failed to save settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <Calendar size={20} />
            {t('settings.integrations.calendarTitle', 'Calendar Sync')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.integrations.calendarDesc',
              'Sync your tasks and deadlines with external calendars.'
            )}
          </p>
        </div>
        <button
          onClick={fetchCalendars}
          className="p-2 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loadError && <DegradedState title="Calendar sync unavailable" description={loadError} />}

      {actionError && <Banner variant="danger" title={actionError} />}

      {/* Calendar Services */}
      {!loadError && (
        <div className="space-y-3">
          {calendars.map((cal) => (
            <div
              key={cal.id}
              className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                cal.connected
                  ? 'bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30'
                  : 'bg-c-surface-raised'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cal.icon}</span>
                <div>
                  <span className="font-medium text-c-text">{cal.name}</span>
                  {cal.connected && cal.connection && (
                    <div className="text-sm text-c-text-muted">
                      {cal.connection.externalEmail} • {cal.connection.calendarName}
                    </div>
                  )}
                </div>
              </div>
              {cal.connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                    <Check size={16} />
                    {t('common.connected', 'Connected')}
                  </span>
                  <button
                    onClick={() => disconnectCalendar(cal.id)}
                    className="p-1.5 text-c-text-secondary hover:text-danger-500 rounded transition-colors"
                    title={t('common.disconnect', 'Disconnect')}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => connectCalendar(cal.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg text-sm hover:bg-navy-800 dark:hover:bg-[#DDE5EF] dark:hover:bg-[#DDE5EF] transition-colors"
                >
                  <ExternalLink size={14} />
                  {t('common.connect', 'Connect')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sync Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-c-text-secondary">
          {t('settings.integrations.syncOptions', 'Sync Options')}
        </h4>

        <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
          <div>
            <p className="font-medium text-c-text">
              {t('settings.integrations.syncTasks', 'Sync Tasks')}
            </p>
            <p className="text-sm text-c-text-muted">
              {t('settings.integrations.syncTasksDesc', 'Add task deadlines to your calendar')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={syncTasks}
              onChange={(e) => handleSaveSettings(e.target.checked, syncMeetings)}
              disabled={savingSettings}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
          <div>
            <p className="font-medium text-c-text">
              {t('settings.integrations.syncMeetings', 'Sync Meetings')}
            </p>
            <p className="text-sm text-c-text-muted">
              {t('settings.integrations.syncMeetingsDesc', 'Add project meetings to your calendar')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={syncMeetings}
              onChange={(e) => handleSaveSettings(syncTasks, e.target.checked)}
              disabled={savingSettings}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default CalendarSyncSettings;
