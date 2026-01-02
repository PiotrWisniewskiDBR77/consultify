/**
 * CalendarSyncSettings - Calendar synchronization settings
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';

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

  useEffect(() => {
    fetchCalendars();
    fetchSettings();
  }, []);

  const fetchCalendars = async () => {
    try {
      const data = await Api.get('/api/integrations/calendar');
      if (data?.calendars) {
        setCalendars(data.calendars);
      }
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      // Fallback to defaults
      setCalendars([
        { id: 'google', name: 'Google Calendar', icon: '📅', connected: false },
        { id: 'outlook', name: 'Outlook', icon: '📆', connected: false },
        { id: 'apple', name: 'Apple Calendar', icon: '🍎', connected: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await Api.get('/api/integrations/calendar/settings');
      if (data?.settings) {
        setSyncTasks(data.settings.syncTasks);
        setSyncMeetings(data.settings.syncMeetings);
      }
    } catch (error) {
      // Use defaults
    }
  };

  const connectCalendar = async (calendarId: string) => {
    try {
      const data = await Api.post(`/api/integrations/calendar/${calendarId}/connect`, {});
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast.error(t('settings.integrations.connectError', 'Failed to connect calendar'));
    }
  };

  const disconnectCalendar = async (calendarId: string) => {
    if (!confirm(t('settings.integrations.disconnectConfirm', 'Disconnect this calendar?'))) return;
    
    try {
      await Api.delete(`/api/integrations/calendar/${calendarId}`);
      setCalendars(prev => prev.map(c => 
        c.id === calendarId ? { ...c, connected: false, connection: null } : c
      ));
      toast.success(t('settings.integrations.disconnected', 'Calendar disconnected'));
    } catch (error) {
      toast.error(t('settings.integrations.disconnectError', 'Failed to disconnect'));
    }
  };

  const handleSaveSettings = async (tasks: boolean, meetings: boolean) => {
    setSavingSettings(true);
    try {
      await Api.put('/api/integrations/calendar/settings', {
        syncTasks: tasks,
        syncMeetings: meetings
      });
      setSyncTasks(tasks);
      setSyncMeetings(meetings);
      toast.success(t('settings.saved', 'Settings saved'));
    } catch (error) {
      toast.error(t('settings.saveError', 'Failed to save settings'));
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} />
            {t('settings.integrations.calendarTitle', 'Calendar Sync')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.integrations.calendarDesc', 'Sync your tasks and deadlines with external calendars.')}
          </p>
        </div>
        <button
          onClick={fetchCalendars}
          className="p-2 text-slate-400 hover:text-brand rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          title={t('common.refresh', 'Refresh')}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Calendar Services */}
      <div className="space-y-3">
        {calendars.map((cal) => (
          <div
            key={cal.id}
            className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
              cal.connected 
                ? 'bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30'
                : 'bg-slate-50 dark:bg-navy-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{cal.icon}</span>
              <div>
                <span className="font-medium text-slate-900 dark:text-white">{cal.name}</span>
                {cal.connected && cal.connection && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
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
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                  title={t('common.disconnect', 'Disconnect')}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => connectCalendar(cal.id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-brand text-white rounded-lg text-sm hover:bg-brand-dark transition-colors"
              >
                <ExternalLink size={14} />
                {t('common.connect', 'Connect')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Sync Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('settings.integrations.syncOptions', 'Sync Options')}
        </h4>
        
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.integrations.syncTasks', 'Sync Tasks')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.integrations.syncMeetings', 'Sync Meetings')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
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
            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default CalendarSyncSettings;

