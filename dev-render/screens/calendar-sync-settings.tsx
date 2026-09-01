/**
 * #24b — „Synchronizacja kalendarza" (Ustawienia → Integracje → Calendar Sync).
 *
 * ★ NAPRAWA PARYTETU 2026-09-01 (AUDYT_PRZYRZADU_20260901.md, Kategoria 4).
 * Poprzednia wersja tego pliku miała PRZEPISANY markup `CalendarSyncSettings`
 * z tekstami wbitymi na sztywno po polsku i ZEREM wywołań `t()`. Realny
 * `src/components/settings/CalendarSyncSettings.tsx` ma 22 wywołania `t()`
 * i jest montowany przez `src/views/SettingsView.tsx:455` (sekcja
 * `calendar-sync`) WEWNĄTRZ nawigacji Ustawień — czyli właściciel oceniał
 * obraz, którego w aplikacji nie ma (m.in. nie widział, czy ekran jest realnie
 * przetłumaczony, bo harness tłumaczył za niego).
 *
 * Teraz montujemy REALNY `<SettingsView>` na sekcji `calendar-sync` — ten sam
 * wzorzec, co `dev-render/screens/ustawienia-grupy.tsx` (realny sidebar
 * Ustawień + realny content pane), więc na zrzucie widać dokładnie to, co
 * użytkownik po kliknięciu „Calendar Sync" w Ustawieniach.
 *
 * Mockowane są WYŁĄCZNIE wołania, które ten ekran realnie robi przy montażu
 * (sprawdzone w kodzie komponentu, nie zgadywane):
 *   CalendarSyncSettings → Api.getCalendars() (lista dostawców)
 *                        → Api.getCalendarSettings() (pstryczki synchronizacji)
 * plus minimum dla samej powłoki `SettingsView` (Api.getMe / Api.get).
 * Zero prawdziwego backendu — zrzut robi nadzorca przed odbiorem (CLAUDE.md #7).
 *
 * URL: ?screen=calendar-sync-settings[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { Api } from '../../src/services/api';
import SettingsView from '../../src/views/SettingsView';

const CURRENT_USER = {
  id: 'usr-piotr',
  email: 'piotr@atelier-toys.pl',
  firstName: 'Piotr',
  lastName: 'Wiśniewski',
  phone: '+48 601 200 300',
  language: 'pl',
  role: 'OWNER',
  organizationId: 'org-atelier-toys-0001',
  organizationName: 'Atelier Toys Sp. z o.o.',
  companyName: 'Atelier Toys Sp. z o.o.',
} as never;

// Kształt 1:1 z `CalendarProvider` w CalendarSyncSettings.tsx.
const CALENDARS = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    icon: 'calendar',
    connected: true,
    connection: {
      externalEmail: 'piotr@atelier-toys.pl',
      calendarName: 'Kalendarz główny',
      lastSyncAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      syncTasks: true,
      syncMeetings: true,
    },
  },
  {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    icon: 'calendar',
    connected: false,
    connection: null,
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar (iCal)',
    icon: 'calendar',
    connected: false,
    connection: null,
  },
];

const CALENDAR_SETTINGS = { syncTasks: true, syncMeetings: true };

Object.assign(Api, {
  getCalendars: async () => CALENDARS,
  getCalendarSettings: async () => CALENDAR_SETTINGS,
  updateCalendarSettings: async () => ({ success: true }),
  getMe: async () => CURRENT_USER,
  updateUser: async () => undefined,
  get: async (path: string) => {
    if (path === '/organization-context')
      return {
        profile: { defaultLanguage: 'pl', defaultTimezone: 'Europe/Warsaw', currency: 'PLN' },
      };
    return {};
  },
  put: async () => ({ success: true }),
});

export default function CalendarSyncSettingsScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/settings/calendar-sync']}>
      <div className="h-screen overflow-hidden">
        <SettingsView
          currentUser={CURRENT_USER}
          onUpdateUser={() => undefined}
          theme="light"
          toggleTheme={() => undefined}
        />
      </div>
    </MemoryRouter>
  );
}
