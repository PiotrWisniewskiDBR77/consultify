/**
 * Render-verify jednorazowy (2026-07-26): potwierdzenie że sidebar NIE ma już
 * osobnej pozycji "Excel" po fali feat/materials-menu-canon-5-tabs (kanon
 * MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md §3). Wzorowane 1:1
 * na dev-render/screens/navdeclutter-sidebar.tsx.
 */
import React from 'react';

import { Sidebar } from '../../src/components/navigation/Sidebar/Sidebar';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
  isSidebarCollapsed: false,
  isSidebarOpen: true,
} as any);

Api.get = (async (url: string) => {
  if (url.startsWith('/partners/connection') || url.includes('/api/partners/connection')) {
    return { data: { connected: false } };
  }
  return { data: null };
}) as typeof Api.get;

const g = window as unknown as { __MENUCANON_FETCH__?: boolean };
if (!g.__MENUCANON_FETCH__) {
  g.__MENUCANON_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/organizations/current')) {
      return new Response(
        JSON.stringify({
          organizations: [
            { id: 'org-dbr77-demo', name: 'DBR77 Sp. z o.o.', plan: 'enterprise', role: 'ADMIN' },
          ],
          currentOrganizationId: 'org-dbr77-demo',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function MenuCanonSidebarCheckScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}
          className="bg-white dark:bg-navy-900"
        >
          <Sidebar />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default MenuCanonSidebarCheckScreen;
