/**
 * Dev-render: P-T06 (uwaga testera VI) — suwaki „Widoczności widgetów" w
 * POWŁOCE Ustawień (REALNY `<AppearanceModule initialTab="dashboard">` →
 * `DashboardPreferencesSettings`).
 *
 * PO CO (CLAUDE.md §7): tester zgłosił „suwaki niewidoczne w trybie jasnym gdy
 * OFF". Premisa zmierzona: tor w stanie OFF miał `bg-c-surface-raised`
 * (#f8fafc), gałka `bg-c-surface` (#ffffff), a kafelek pod spodem też
 * `c-surface-raised` — kontrast toru do tła 1,00:1. Ten ekran pokazuje
 * PRZED/PO na tym samym zestawie widżetów.
 *
 * MIESZANE STANY CELOWO: cztery widżety ON, trzy OFF — na jednym zrzucie
 * widać oba stany obok siebie, więc nie da się „przyzwyczaić oka" do jednego.
 *
 * Atrapa transportu: GET oddaje preferencje, PUT potwierdza (bez backendu).
 *
 * URL: ?screen=pt06-ustawienia-suwaki[&lang=pl|en][&theme=light|dark]
 */
import React from 'react';

import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import type { User } from '../../src/types';
import { AppearanceModule } from '../../src/views/settings/AppearanceModule';

const uzytkownik = {
  id: 'pt06-owner',
  email: 'owner@pt06.local',
  firstName: 'Piotr',
  lastName: 'Właściciel',
  language: 'en',
  role: 'OWNER',
  organizationId: 'pt06-org',
  isAuthenticated: true,
} as User;

useAppStore.setState({ currentUser: uzytkownik });

/** Cztery ON i trzy OFF — oba stany na jednym zrzucie. */
const PREFERENCJE = {
  defaultLandingPage: 'ai-assistant',
  showGreeting: true,
  compactMode: false,
  autoRefreshInterval: 0,
  liveUpdates: false,
  widgets: {
    tasks: true,
    initiatives: true,
    calendar: false,
    aiInsights: false,
    recentActivity: true,
    quickActions: false,
    metrics: true,
  },
};

const realApiGet = Api.get.bind(Api);
Api.get = (async (url: string, ...reszta: unknown[]) => {
  if (url.includes('/settings/preferences/dashboard')) return { preferences: PREFERENCJE };
  return (realApiGet as (u: string, ...r: unknown[]) => unknown)(url, ...reszta);
}) as typeof Api.get;

const realApiPut = Api.put.bind(Api);
Api.put = (async (url: string, body?: unknown, ...reszta: unknown[]) => {
  if (url.includes('/settings/preferences/dashboard')) return { preferences: PREFERENCJE };
  return (realApiPut as (u: string, b?: unknown, ...r: unknown[]) => unknown)(
    url,
    body,
    ...reszta
  );
}) as typeof Api.put;

export default function Pt06UstawieniaSuwakiScreen(): React.ReactElement {
  const motyw = new URLSearchParams(window.location.search).get('theme') === 'dark'
    ? 'dark'
    : 'light';
  return (
    <AppProviders>
      <div style={{ height: '100vh', overflow: 'auto' }} className="bg-c-bg">
        <AppearanceModule
          initialTab="dashboard"
          currentUser={uzytkownik}
          onUpdateUser={() => {}}
          theme={motyw as 'light' | 'dark'}
          toggleTheme={() => {}}
        />
      </div>
    </AppProviders>
  );
}
