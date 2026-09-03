/**
 * Ustawienia użytkownika — 10 grup nawigacji (dyżur odbioru grafiki, runda
 * 150-ustawienia-organizacja, 2026-08-31).
 *
 * PROBLEM: rejestr odbioru miał wyłącznie jeden historyczny, zmigrowany
 * wiersz `settings-full-module-closed-final-20260825` BEZ ŻADNEGO zrzutu w
 * tym drzewie ("9 grup" — liczba nigdy nie zweryfikowana w kodzie). Ten plik
 * montuje REALNY `<SettingsView>` (src/views/SettingsView.tsx) — nie replikę
 * — i zrzuca po jednym ekranie na KAŻDĄ grupę nawigacji faktycznie
 * zdefiniowaną w `src/components/settings/SettingsSidebar.tsx` (`navGroups`).
 *
 * ZWERYFIKOWANE W KODZIE (nie w docu): grup jest DZIESIĘĆ, nie dziewięć:
 *   1. PERSONAL (`my-settings`)              → profile
 *   2. WORKFLOW (`work-preferences`)          → dashboard
 *   3. MODULES: AI & AUTOMATION               → ai-behavior
 *   4. MODULES: NOTIFICATIONS                 → notifications-overview
 *   5. SECURITY                               → security-dashboard
 *   6. MODULES: INTEGRATIONS                  → connected-apps
 *   7. DATA & PRIVACY                         → data-controls
 *   8. BILLING                                → billing (renderContent()
 *      zwraca `null` dla 'billing' — patrz komentarz w SettingsView.tsx:468-472,
 *      "Organization billing is owned by Admin" — realny pusty content pane,
 *      NIE błąd harnessu; zgłoszone jako ZNALEZISKO, nie naprawiane tutaj)
 *   9. APPEARANCE                             → theme
 *  10. ADVANCED & HISTORY                     → import-export
 *
 * Każdy zrzut pokazuje realny sidebar (grupa auto-rozwinięta,
 * `SettingsSidebar.tsx:512-524`) + realny content pane pierwszej pozycji tej
 * grupy — dokładnie to, co użytkownik widzi po kliknięciu w tę grupę.
 *
 * Mockowane wołania — WYŁĄCZNIE substringi realnie wołane przez te 10
 * komponentów (sprawdzone grepem przed napisaniem tego pliku, nie zgadywane):
 *   ProfileSettings            → Api.updateUser / Api.getMe (tylko przy zapisie)
 *   DashboardPreferencesSettings → Api.get('/settings/preferences/dashboard')
 *   AIBehaviorSettings         → Api.getAIInstructions / getAIPersonality
 *   NotificationSettings       → Api.getNotificationPreferences / getIntegrations
 *   SecurityOverviewPage       → Api.getActiveSessions / getLoginHistory (MUSI
 *     być tablicą — realny kod: `!Array.isArray(historyRes)` rzuca błąd, jeśli
 *     nie jest) / Api.get('/settings/recovery') / Api.get('/api/mfa/status')
 *   ConnectedAppsSettings      → SUROWY `window.fetch('/api/settings/integrations')`
 *     i `/api/settings/integrations/oauth/status` — PÓMIJA warstwę Api (pułapka
 *     CLAUDE.md: "część modułów woła surowy window.fetch z pominięciem Api")
 *   DataControlsSettings       → Api.getGdprConsents / getGdprRetention /
 *     getGdprDeletionStatus / getGdprExportStatus
 *   ThemeSettings              → Api.getAppearancePreferences
 *   SettingsExportImport       → brak wołań przy montowaniu (tylko przy klikach)
 *
 * Dane demo: Piotr Wiśniewski, właściciel „Atelier Toys Sp. z o.o." — spójne z
 * `dev-render/screens/admin-team.tsx` (org-atelier-toys-0001) dla jednej
 * rundy 150-ustawienia-organizacja.
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import i18n from '../../src/i18n';
import { Api } from '../../src/services/api';
import { SettingsApi } from '../../src/services/api/settings.api';
import SettingsView from '../../src/views/SettingsView';

// G06 (dyżur 2026-09-03, moduły 13-16): NIE hardkodować 'pl' tutaj — main.tsx
// już woła `i18n.changeLanguage(lang)` globalnie z parametru `?lang=pl|en`, a
// ponieważ ten moduł jest lazy-loadowany, jego import wykonuje się PO
// globalnym wywołaniu i nadpisywał je na sztywno 'pl' — 8 z 9 ekranów
// modułu 15_SETTINGS renderowały PL nawet przy `?lang=en` (fałszywy
// alarm „PL=EN" w REJESTR_G06_JEZYKI_MOTYWY_20260902.md, wiersze
// ustawienia-*). Realne tłumaczenia EN istnieją w src/i18n — harness je
// tylko maskował.
const grupyLang = new URLSearchParams(window.location.search).get('lang');
if (grupyLang === 'en') void i18n.changeLanguage('en');

export type UstawieniaGrupaId =
  | 'personalne'
  | 'workflow'
  | 'ai-automatyzacja'
  | 'powiadomienia'
  | 'bezpieczenstwo'
  | 'integracje'
  | 'dane-prywatnosc'
  | 'billing'
  | 'wyglad'
  | 'zaawansowane';

const GRUPA_DO_SEKCJI: Record<UstawieniaGrupaId, string> = {
  personalne: 'profile',
  workflow: 'dashboard',
  'ai-automatyzacja': 'ai-behavior',
  powiadomienia: 'notifications-overview',
  bezpieczenstwo: 'security-dashboard',
  integracje: 'connected-apps',
  'dane-prywatnosc': 'data-controls',
  billing: 'billing',
  wyglad: 'theme',
  zaawansowane: 'import-export',
};

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
} as any;

const APPEARANCE_PREFS = {
  theme: 'dark',
  accentColor: '#2563eb',
  density: 'comfortable',
  fontScale: 100,
};

const DASHBOARD_PREFS = {
  defaultLandingPage: 'ai-assistant',
  showGreeting: true,
  compactMode: false,
  autoRefreshInterval: 0,
  liveUpdates: false,
  widgets: {
    tasks: true,
    initiatives: true,
    calendar: true,
    aiInsights: true,
    recentActivity: true,
    quickActions: true,
    metrics: true,
  },
};

const LOGIN_HISTORY = [
  {
    id: 'evt-1',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'success',
    location: 'Warszawa, Polska',
    ip: '83.24.11.6',
    device: 'Chrome · macOS',
  },
  {
    id: 'evt-2',
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    status: 'success',
    location: 'Warszawa, Polska',
    ip: '83.24.11.6',
    device: 'Safari · iPhone',
  },
  {
    id: 'evt-3',
    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'failed',
    location: 'Kraków, Polska',
    ip: '188.146.2.90',
    device: 'Chrome · Windows',
  },
];

// --- Connected apps (surowy fetch, mija Api) ---------------------------
const INTEGRATIONS_CATALOG_IDS = [
  'gmail',
  'outlook',
  'slack',
  'teams',
  'google_calendar',
  'outlook_calendar',
  'apple_calendar',
  'calendly',
  'jira',
  'asana',
  'trello',
  'clickup',
  'monday',
  'notion',
  'todoist',
  'linear',
  'google_drive',
  'onedrive',
  'dropbox',
  'box',
];
const CONNECTED_INTEGRATIONS = [
  {
    id: 'int-gmail',
    userId: CURRENT_USER.id,
    provider: 'gmail',
    providerName: 'Gmail',
    externalWorkspaceName: 'piotr@atelier-toys.pl',
    config: {},
    status: 'active' as const,
    lastSyncAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    capabilities: ['email_sync'],
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'int-gcal',
    userId: CURRENT_USER.id,
    provider: 'google_calendar',
    providerName: 'Google Calendar',
    externalWorkspaceName: 'Kalendarz główny',
    config: {},
    status: 'active' as const,
    lastSyncAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    capabilities: ['calendar_sync'],
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: new Date().toISOString(),
  },
];
const INTEGRATIONS_AVAILABILITY = Object.fromEntries(
  INTEGRATIONS_CATALOG_IDS.map((id) => [id, { configured: true, authType: 'oauth2' }])
);

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const g = window as unknown as { __USTAWIENIA_GRUPY_FETCH__?: boolean };
if (!g.__USTAWIENIA_GRUPY_FETCH__) {
  g.__USTAWIENIA_GRUPY_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/api/settings/integrations/oauth/status')) {
        return jsonResponse({ availability: INTEGRATIONS_AVAILABILITY });
      }
      if (url.includes('/api/settings/integrations')) {
        return jsonResponse({
          integrations: CONNECTED_INTEGRATIONS,
          providers: [],
          connectedCount: CONNECTED_INTEGRATIONS.length,
        });
      }
    } catch {
      /* fall through to real fetch (np. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

Object.assign(Api, {
  getAIInstructions: async () => ({
    preferences: {
      systemPrompt: 'Odpowiadaj rzeczowo, po polsku, z naciskiem na konkretne rekomendacje.',
      responseStyle: 'balanced',
      includeContext: true,
      maxContextLength: 4000,
    },
  }),
  getAIPersonality: async () => ({
    preferences: { tone: 'professional', formality: 'balanced', verbosity: 'concise' },
  }),
  saveAIInstructions: async () => ({ success: true }),
  saveAIPersonality: async () => ({ success: true }),
  getGdprConsents: async () => ({
    consents: {
      analytics: true,
      personalization: true,
      marketing: false,
      thirdPartySharing: false,
      aiTraining: false,
    },
  }),
  getGdprRetention: async () => ({ retention: { period: '365', autoDelete: false } }),
  getGdprDeletionStatus: async () => ({ request: null, latestRequest: null }),
  getGdprExportStatus: async () => ({
    request: { id: 'settings-export-atelier-toys', status: 'pending' },
  }),
  getActiveSessions: async () => ({
    sessions: [
      { id: 'sess-1', device: 'Chrome · macOS', location: 'Warszawa, Polska', current: true },
      { id: 'sess-2', device: 'Safari · iPhone', location: 'Warszawa, Polska', current: false },
    ],
  }),
  getLoginHistory: async () => LOGIN_HISTORY,
  getRecoveryOptions: async () => ({
    recoveryEmail: 'piotr.prywatnie@gmail.com',
    recoveryPhone: '+48 601 200 300',
    backupCodesCount: 8,
  }),
  getAppearancePreferences: async () => ({ preferences: APPEARANCE_PREFS }),
  saveAppearancePreferences: async () => ({ success: true, preferences: APPEARANCE_PREFS }),
  getNotificationPreferences: async () => ({
    taskAssignment: { email: true, inApp: true },
    taskUpdates: { email: false, inApp: true },
    milestones: { email: true, inApp: true },
    mentions: { email: true, inApp: true },
  }),
  saveNotificationPreferences: async () => ({ success: true }),
  getIntegrations: async () => ({ integrations: [] }),
  get: async (path: string) => {
    if (path === '/settings/preferences/dashboard') return { preferences: DASHBOARD_PREFS };
    if (path === '/settings/recovery')
      return { recoveryEmail: 'piotr.prywatnie@gmail.com', recoveryPhone: '+48 601 200 300', backupCodesCount: 8 };
    if (path === '/api/mfa/status') return { isEnabled: true, method: 'totp' };
    if (path === '/organization-context')
      return { profile: { defaultLanguage: 'pl', defaultTimezone: 'Europe/Warsaw', currency: 'PLN' } };
    if (path.endsWith('/email')) return { enabled: true, taskUpdates: false, projectAlerts: true };
    if (path.endsWith('/digest')) return { frequency: 'weekly', content: 'summary', format: 'html' };
    return {};
  },
  put: async () => ({ success: true }),
  updateUser: async () => undefined,
  getMe: async () => CURRENT_USER,
});
Object.assign(SettingsApi, {
  getRegionalPreferences: async () => ({
    preferences: {
      timezone: 'Europe/Warsaw',
      currency: 'PLN',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      units: 'metric',
      firstDayOfWeek: 'monday',
      numberFormat: 'pl-PL',
    },
  }),
  updateRegionalPreferences: async () => ({ success: true }),
});

export default function UstawieniaGrupyScreen(props: {
  grupa: UstawieniaGrupaId;
}): React.ReactElement {
  const requested = new URLSearchParams(window.location.search).get(
    'grupa'
  ) as UstawieniaGrupaId | null;
  const grupa = requested || props.grupa;
  const section = GRUPA_DO_SEKCJI[grupa];
  return (
    <MemoryRouter initialEntries={[`/settings/${section}`]}>
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
