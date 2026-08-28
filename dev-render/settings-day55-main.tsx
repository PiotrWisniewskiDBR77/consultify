/** DEV-ONLY Settings harness for duty 55 visual self-QA. */
import '../src/index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { EmailDigestSettings } from '../src/components/settings/EmailDigestSettings';
import { AIBehaviorSettings } from '../src/components/settings/AIBehaviorSettings';
import { CalendarSyncSettings } from '../src/components/settings/CalendarSyncSettings';
import { DataControlsSettings } from '../src/components/settings/DataControlsSettings';
import { NotificationSettings } from '../src/components/settings/NotificationSettings';
import { ProfileSettings } from '../src/components/settings/ProfileSettings';
import { RegionalSettings } from '../src/components/settings/RegionalSettings';
import { ThemeSettings } from '../src/components/settings/ThemeSettings';
import { AuthenticationAccessPage } from '../src/components/settings/security/AuthenticationAccessPage';
import i18n from '../src/i18n';
import { Api } from '../src/services/api';
import { SettingsApi } from '../src/services/api/settings.api';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const operation = params.get('op') || 'auth';
const demoState = params.get('demo') === 'empty' ? 'empty' : 'seeded';
document.documentElement.classList.toggle('dark', theme === 'dark');
document.documentElement.style.colorScheme = theme;
void i18n.changeLanguage('pl');

const appearance = {
  theme: 'dark',
  accentColor: '#2563eb',
  density: 'comfortable',
  fontScale: 100,
};
const regional =
  demoState === 'empty'
    ? {}
    : {
        timezone: 'Europe/Warsaw',
        currency: 'PLN',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        units: 'metric',
        firstDayOfWeek: 'monday',
        numberFormat: 'pl-PL',
      };
const currentUser = {
  id: 'day55-owner',
  email: 'owner@local.test',
  firstName: 'Piotr',
  lastName: 'Reloaded',
  phone: '+48 000 000 000',
  language: 'pl',
  role: 'OWNER',
  organizationId: 'day55-local-org',
} as any;

Object.assign(Api, {
  getAIInstructions: async () => ({
    preferences: { systemPrompt: '', responseStyle: 'balanced', includeContext: true, maxContextLength: 4000 },
  }),
  getAIPersonality: async () => ({
    preferences: { tone: 'professional', formality: 'balanced', verbosity: 'concise' },
  }),
  getGdprConsents: async () => ({
    consents: { analytics: true, personalization: true, marketing: false, thirdPartySharing: false, aiTraining: false },
  }),
  getGdprRetention: async () => ({ retention: { period: '365', autoDelete: false } }),
  getGdprDeletionStatus: async () => ({ request: null, latestRequest: null }),
  getGdprExportStatus: async () => ({ request: { id: 'settings-day55-demo-export', status: 'pending' } }),
  getCalendars: async () => [
    { id: 'google', name: 'Google Calendar', icon: '📅', connected: true, connection: { externalEmail: 'owner@local.test', calendarName: 'Kalendarz główny', lastSyncAt: new Date().toISOString(), syncTasks: true, syncMeetings: true } },
    { id: 'outlook', name: 'Outlook Calendar', icon: '📆', connected: false, connection: null },
  ],
  getCalendarSettings: async () => ({ syncTasks: true, syncMeetings: true }),
  getActiveSessions: async () => ({ sessions: [] }),
  getLoginHistory: async () => ({ history: [] }),
  getRecoveryOptions: async () => ({ recoveryEmail: '', recoveryPhone: '', backupCodesCount: 0 }),
  getAppearancePreferences: async () => ({ preferences: appearance }),
  saveAppearancePreferences: async () => ({ success: true, preferences: appearance }),
  getNotificationPreferences: async () => ({
    taskAssignment: { email: true, inApp: true },
    taskUpdates: { email: false, inApp: true },
    milestones: { email: true, inApp: true },
    mentions: { email: true, inApp: true },
  }),
  saveNotificationPreferences: async () => ({ success: true }),
  getIntegrations: async () => ({ integrations: [] }),
  get: async (path: string) => {
    if (path === '/organization-context')
      return {
        profile: { defaultLanguage: 'pl', defaultTimezone: 'Europe/Warsaw', currency: 'PLN' },
      };
    if (path.endsWith('/email')) return { enabled: true, taskUpdates: false, projectAlerts: true };
    if (path.endsWith('/digest'))
      return { frequency: 'weekly', content: 'summary', format: 'html' };
    return {};
  },
  put: async () => ({ success: true }),
  updateUser: async () => undefined,
  getMe: async () => currentUser,
});
Object.assign(SettingsApi, {
  getRegionalPreferences: async () => ({ preferences: regional }),
  updateRegionalPreferences: async () => ({ success: true }),
});

const renderOperation = () => {
  switch (operation) {
    case 'profile':
      return <ProfileSettings currentUser={currentUser} onUpdateUser={() => undefined} />;
    case 'language-theme':
      return (
        <div className="space-y-6">
          <div className="rounded-xl border border-c-border bg-c-surface p-4">
            <div className="text-sm text-c-text-muted">Język konta po przeładowaniu</div>
            <div className="text-xl font-semibold text-c-text">Polski (pl)</div>
          </div>
          <ThemeSettings />
        </div>
      );
    case 'regional':
      return <RegionalSettings currentUser={currentUser} onUpdateUser={() => undefined} />;
    case 'notifications':
      return (
        <div className="space-y-8">
          <NotificationSettings currentUser={currentUser} onUpdateUser={() => undefined} />
          <EmailDigestSettings currentUser={currentUser} onUpdateUser={() => undefined} />
        </div>
      );
    case 'ai':
      return <AIBehaviorSettings />;
    case 'security':
      return <AuthenticationAccessPage currentUser={currentUser} />;
    case 'integrations':
      return <CalendarSyncSettings />;
    case 'data-privacy':
      return <DataControlsSettings currentUser={currentUser} onUpdateUser={() => undefined} />;
    default:
      return <AuthenticationAccessPage currentUser={currentUser} />;
  }
};

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <BrowserRouter>
        <main className="min-h-screen bg-canvas p-8 text-c-text">
          <div className="mx-auto max-w-5xl">{renderOperation()}</div>
        </main>
      </BrowserRouter>
    </React.StrictMode>
  );
}
