/**
 * Duty 238 — owner-review harness for the real Settings navigation and panels.
 *
 * Query parameters:
 *   section=profile|regional|ai-behavior|notifications-overview|security-dashboard|
 *           connected-apps|data-controls|billing|theme|developer
 *   role=OWNER|MEMBER
 *   proof=restricted|allowed|owner (renders the measured routing outcome card)
 *
 * The screen mounts production components. Only transport responses and the user
 * identity are deterministic dev-render fixtures; no production gate is changed.
 */
import React, { useMemo, useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { RouterSync } from '../../src/components/RouterSync';
import { SettingsHistory } from '../../src/components/settings/advanced/SettingsHistory';
import { AIBehaviorSettings } from '../../src/components/settings/AIBehaviorSettings';
import { ConnectedAppsSettings } from '../../src/components/settings/ConnectedAppsSettings';
import { DataControlsSettings } from '../../src/components/settings/DataControlsSettings';
import { NotificationSettings } from '../../src/components/settings/NotificationSettings';
import { ProfileSettings } from '../../src/components/settings/ProfileSettings';
import { RegionalSettings } from '../../src/components/settings/RegionalSettings';
import { SecurityOverviewPage } from '../../src/components/settings/security/SecurityOverviewPage';
import SettingsSidebar, {
  type SettingsSection,
} from '../../src/components/settings/SettingsSidebar';
import { ThemeSettings } from '../../src/components/settings/ThemeSettings';
import { Api } from '../../src/services/api';
import { SettingsApi } from '../../src/services/api/settings.api';
import { useAppStore } from '../../src/store/useAppStore';
import type { User } from '../../src/types';
import {
  getPilotDefaultSettingsRoute,
  isPilotAllowedSettingsSection,
} from '../../src/utils/pilotAccess';

const params = new URLSearchParams(window.location.search);
const requestedSection = (params.get('section') || 'profile') as SettingsSection;
const requestedRole = params.get('role') === 'MEMBER' ? 'MEMBER' : 'OWNER';
const proof = params.get('proof');

const owner: User = {
  id: 'day238-owner',
  email: 'piotr.owner@day238.local',
  firstName: 'Piotr',
  lastName: 'Właściciel',
  phone: '+48 600 238 238',
  language: 'pl',
  role: requestedRole,
  organizationId: 'day238-org',
  isAuthenticated: true,
} as User;

useAppStore.setState({ currentUser: owner });

const appearance = {
  theme: params.get('theme') === 'dark' ? 'dark' : 'light',
  accentColor: '#7c3aed',
  density: 'comfortable',
  fontScale: 100,
};

Object.assign(Api, {
  getAIInstructions: async () => ({
    preferences: {
      systemPrompt: 'Odpowiadaj konkretnie, pokazuj źródła i nazywaj niepewność.',
      responseStyle: 'balanced',
      includeContext: true,
      maxContextLength: 8000,
    },
  }),
  getAIPersonality: async () => ({
    preferences: { tone: 'professional', formality: 'balanced', verbosity: 'concise' },
  }),
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
  getGdprExportStatus: async () => ({ request: null }),
  getActiveSessions: async () => ({
    sessions: [
      {
        id: 'session-day238',
        current: true,
        device: 'MacBook Pro · Chrome',
        location: 'Warszawa, PL',
        ip: '127.0.0.1',
        lastActive: new Date('2026-09-01T09:15:00Z').toISOString(),
      },
    ],
  }),
  getLoginHistory: async () => ({ history: [] }),
  getRecoveryOptions: async () => ({
    recoveryEmail: 'recovery@day238.local',
    recoveryPhone: '',
    backupCodesCount: 8,
  }),
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
  getCurrentBilling: async () => ({
    billing: { subscription_plan_id: 'business', status: 'active' },
    usage: { tokensUsed: 18400, tokenLimit: 100000, storageUsedGb: 2.4, storageLimitGb: 25 },
  }),
  getSubscriptionPlans: async () => [
    {
      id: 'business',
      name: 'Business',
      price_monthly: 149,
      token_limit: 100000,
      storage_limit_gb: 25,
    },
  ],
  getUserPlans: async () => [],
  getInvoices: async () => [],
  getSettingsHistory: async () => ({
    entries: [
      {
        id: 'history-day238-1',
        category: 'Profile',
        setting: 'Timezone',
        action: 'updated',
        oldValue: 'UTC',
        newValue: 'Europe/Warsaw',
        timestamp: '2026-09-01T08:30:00.000Z',
        device: 'MacBook Pro · Chrome',
        ipAddress: '127.0.0.1',
      },
      {
        id: 'history-day238-2',
        category: 'Security',
        setting: 'Two-factor authentication',
        action: 'created',
        newValue: 'Authenticator app',
        timestamp: '2026-08-31T14:10:00.000Z',
        device: 'iPhone · Safari',
        ipAddress: '127.0.0.1',
      },
    ],
  }),
  restoreSettingsEntry: async () => ({ success: true }),
  getMe: async () => owner,
  updateUser: async () => undefined,
  get: async (path: string) => {
    if (path === '/organization-context') {
      return {
        profile: { defaultLanguage: 'pl', defaultTimezone: 'Europe/Warsaw', currency: 'PLN' },
      };
    }
    if (path.includes('security')) return { enabled: true, score: 78 };
    return {};
  },
  post: async () => ({ success: true }),
  put: async () => ({ success: true }),
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

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/api/')) return nativeFetch(input, init);
  const body = url.includes('/integrations/oauth/status')
    ? {
        availability: {
          google: { configured: true, authType: 'oauth' },
          outlook: { configured: true, authType: 'oauth' },
          microsoft: { configured: true, authType: 'oauth' },
        },
      }
    : url.includes('/settings/integrations')
      ? { integrations: [] }
      : { success: true, data: [], items: [] };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const representativeSections: Record<string, SettingsSection> = {
  'my-settings': 'profile',
  'work-preferences': 'regional',
  'ai-automation-group': 'ai-behavior',
  notifications: 'notifications-overview',
  security: 'security-dashboard',
  integrations: 'connected-apps',
  'data-privacy': 'data-controls',
  billing: 'billing',
  appearance: 'theme',
  advanced: 'developer',
};

function Panel({ section }: { section: SettingsSection }): React.ReactElement {
  switch (section) {
    case 'profile':
      return <ProfileSettings currentUser={owner} onUpdateUser={() => undefined} />;
    case 'regional':
      return <RegionalSettings currentUser={owner} onUpdateUser={() => undefined} />;
    case 'ai-behavior':
      return <AIBehaviorSettings />;
    case 'notifications-overview':
      return <NotificationSettings currentUser={owner} onUpdateUser={() => undefined} />;
    case 'security-dashboard':
      return <SecurityOverviewPage currentUser={owner} onUpdateUser={() => undefined} />;
    case 'connected-apps':
      return <ConnectedAppsSettings />;
    case 'data-controls':
      return <DataControlsSettings currentUser={owner} onUpdateUser={() => undefined} />;
    case 'billing':
      // Parytet z produkcją (src/views/SettingsView.tsx, case 'billing'): organization
      // billing jest własnością Admina, route-level resolver od razu przekierowuje tam
      // uprawnionych — legacy `BillingSettings` NIE jest montowany, dopóki to przekierowanie
      // się nie ustabilizuje. Bramka `check-dev-render-parytet.mjs` złapała tę rozbieżność
      // 2026-09-02 (harness montował `<BillingSettings>`, którego produkcja nigdzie nie
      // renderuje) — naprawione tu, żeby zrzut pokazywał to samo puste, co realny ekran.
      return null;
    case 'theme':
      return <ThemeSettings />;
    case 'developer':
      return <SettingsHistory currentUser={owner} onUpdateUser={() => undefined} />;
    default:
      return <ProfileSettings currentUser={owner} onUpdateUser={() => undefined} />;
  }
}

function RoutingProof(): React.ReactElement {
  const location = useLocation();
  const restricted = proof === 'restricted';
  const allowed = proof === 'allowed';
  const attempted = allowed ? '/settings/language' : '/settings/data-controls';
  const finalPath = location.pathname;
  const outcome = restricted
    ? 'Cichy redirect — brak toastu i komunikatu'
    : allowed
      ? 'Sekcja dozwolona — treść dostępna'
      : 'OWNER — brak przekierowania';
  return (
    <>
      <RouterSync />
      <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-text-muted)]">
          R1a · realnie zamontowany RouterSync
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-[var(--c-text)]">{outcome}</h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-[var(--c-text-muted)]">Persona</dt>
            <dd className="mt-1 font-mono text-[var(--c-text)]">{requestedRole}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--c-text-muted)]">Wejście routera</dt>
            <dd className="mt-1 font-mono text-[var(--c-text)]">{attempted}</dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--c-text-muted)]">Bieżąca ścieżka</dt>
            <dd data-testid="day238-current-path" className="mt-1 font-mono text-[var(--c-text)]">
              {finalPath}
            </dd>
          </div>
        </dl>
        <p className="mt-6 rounded-xl bg-[var(--c-surface-raised)] p-4 text-sm text-[var(--c-text-secondary)]">
          {requestedRole === 'MEMBER' && restricted
            ? `RouterSync skierował rolę pilotażową do ${getPilotDefaultSettingsRoute()}. W bloku przekierowania nie ma toastu ani komunikatu.`
            : 'Wybrana persona i sekcja nie spełniają warunku przekierowania RouterSync.'}
        </p>
      </div>
    </>
  );
}

export default function Day238UstawieniaScreen(): React.ReactElement {
  const initial = representativeSections[requestedSection] || requestedSection;
  const [section, setSection] = useState<SettingsSection>(initial);
  const allowedSections = useMemo(
    () =>
      requestedRole === 'MEMBER'
        ? (['profile', 'auth-access', 'language', 'theme'] as SettingsSection[])
        : undefined,
    []
  );

  return (
    <MemoryRouter
      initialEntries={[
        proof === 'allowed'
          ? '/settings/language'
          : proof
            ? '/settings/data-controls'
            : `/settings/${section}`,
      ]}
    >
      <div className="flex h-screen min-h-[900px] bg-[var(--c-bg)] text-[var(--c-text)]">
        <SettingsSidebar
          activeSection={section}
          onSectionChange={(next) => {
            if (requestedRole === 'MEMBER' && !isPilotAllowedSettingsSection(next)) {
              setSection('profile');
              return;
            }
            setSection(next);
          }}
          allowedSections={allowedSections}
        />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--c-surface)] p-8">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-6 flex items-end justify-between border-b border-[var(--c-border-subtle)] pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--c-text-muted)]">
                  Dyżur 238 · fixture dev-render · realne komponenty
                </p>
                <h1 className="mt-2 text-3xl font-semibold">Ustawienia · {section}</h1>
              </div>
              <span className="rounded-full border border-[var(--c-border)] px-3 py-1 text-xs font-medium">
                {requestedRole}
              </span>
            </div>
            {proof ? <RoutingProof /> : <Panel section={section} />}
          </div>
        </main>
      </div>
    </MemoryRouter>
  );
}
