/**
 * #24b — UI „Połącz kalendarz" (Ustawienia → Calendar Sync).
 * Wierne odwzorowanie markupu src/components/settings/CalendarSyncSettings.tsx
 * z mockiem providerów (Google połączony, Outlook/Apple do połączenia) —
 * zero Api/fetch, żeby nadzorca zrobił zrzut PRZED odbiorem Piotra (CLAUDE.md #7).
 */
import { Calendar, Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';

interface MockProvider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  connection?: {
    externalEmail: string;
    calendarName: string;
  } | null;
}

const PROVIDERS: MockProvider[] = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    icon: '📅',
    connected: true,
    connection: {
      externalEmail: 'piotr.wisniewski@dbr77.com',
      calendarName: 'Główny kalendarz',
    },
  },
  { id: 'outlook_calendar', name: 'Outlook Calendar', icon: '📆', connected: false, connection: null },
  { id: 'apple_calendar', name: 'Apple Calendar (iCal)', icon: '🍎', connected: false, connection: null },
];

const CalendarSyncSettingsScreen: React.FC = () => {
  const [syncTasks, setSyncTasks] = useState(true);
  const [syncMeetings, setSyncMeetings] = useState(true);

  return (
    <div className="min-h-screen bg-c-bg p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
              <Calendar size={20} />
              Synchronizacja kalendarza
            </h3>
            <p className="text-sm text-c-text-muted mt-1">
              Synchronizuj zadania i terminy z zewnętrznymi kalendarzami.
            </p>
          </div>
          <button
            className="p-2 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
            title="Odśwież"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Calendar Services */}
        <div className="space-y-3">
          {PROVIDERS.map((cal) => (
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
                    Połączono
                  </span>
                  <button
                    className="p-1.5 text-c-text-secondary hover:text-danger-500 rounded transition-colors"
                    title="Rozłącz"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button className="flex items-center gap-2 px-3 py-1.5 bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 rounded-lg text-sm hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors">
                  <ExternalLink size={14} />
                  Połącz
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Sync Options */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-c-text-secondary">Opcje synchronizacji</h4>

          <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
            <div>
              <p className="font-medium text-c-text">Synchronizuj zadania</p>
              <p className="text-sm text-c-text-muted">Dodawaj terminy zadań do kalendarza</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={syncTasks}
                onChange={(e) => setSyncTasks(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
            <div>
              <p className="font-medium text-c-text">Synchronizuj spotkania</p>
              <p className="text-sm text-c-text-muted">Dodawaj spotkania projektowe do kalendarza</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={syncMeetings}
                onChange={(e) => setSyncMeetings(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-c-surface-raised peer-focus:ring-2 peer-focus:ring-[color:var(--c-focus)] rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-navy-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-c-surface after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarSyncSettingsScreen;
