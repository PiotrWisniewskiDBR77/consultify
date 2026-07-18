/**
 * ODB O5 — dev-render host for the REAL `<Sidebar>` component
 * (src/components/navigation/Sidebar/Sidebar.tsx), to screenshot the
 * `navDeclutterFlag` (src/utils/navDeclutterFlag.ts, default OFF) OFF vs ON
 * for Piotr's acceptance (CLAUDE.md #7 — supervisor renders first).
 *
 * The flag is resolved by `isNavDeclutterEnabled()` directly from
 * `window.location.search` (`?ff_navDeclutter=1`) — no FeatureFlagsContext
 * override needed, just pass the query param through to this harness URL:
 *   ?screen=navdeclutter-sidebar               → OFF (today's nav)
 *   ?screen=navdeclutter-sidebar&ff_navDeclutter=1  → ON (decluttered)
 *
 * Seeds an ADMIN session (seedRealisticSession, role: 'ADMIN') because the
 * "too many elements" complaint the flag fixes is specifically an
 * admin-sees-everything problem (BETA_ADMINS_EXEMPT) — the OFF/ON contrast
 * is only visible for an admin role. Forces sidebar EXPANDED
 * (isSidebarCollapsed: false) since the store default is collapsed and the
 * declutter effect (badges, hidden "Meeting" item) is only legible expanded.
 *
 * Mounted inside the real `AppProviders` tree (BrowserRouter included) so
 * NavItem / FloatingSubmenu render exactly as in production. Two network
 * calls fire on mount that would otherwise hit the dev-render vite server
 * and log parse errors (HTML 404 body, not JSON):
 *   1. `Api.get('/api/partners/connection')` — Sidebar's own partner-portal
 *      footer visibility check.
 *   2. `fetch('/api/organizations/current')` — `OrgContext` (mounted by
 *      `AppProviders` because `AuthenticatedProviders` gates on
 *      `Boolean(currentUser?.id)`, which `seedRealisticSession()` sets).
 * Both are short-circuited to resolved mocks — pattern from
 * assessment-initiatives-panel.tsx (window.fetch stub keyed by URL).
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

// Short-circuit the one API call Sidebar fires on mount (partner portal
// connection check) — avoids a real fetch hitting the dev-render vite server.
Api.get = (async (url: string) => {
  if (url.startsWith('/partners/connection') || url.includes('/api/partners/connection')) {
    return { data: { connected: false } };
  }
  return { data: null };
}) as typeof Api.get;

// Short-circuit OrgContext's raw `fetch('/api/organizations/current')` so it
// doesn't hit the dev-render vite server and log a JSON-parse error.
const g = window as unknown as { __NAVDECLUTTER_FETCH__?: boolean };
if (!g.__NAVDECLUTTER_FETCH__) {
  g.__NAVDECLUTTER_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/organizations/current')) {
      return new Response(
        JSON.stringify({
          organizations: [
            {
              id: 'org-dbr77-demo',
              name: 'DBR77 Sp. z o.o.',
              plan: 'enterprise',
              role: 'ADMIN',
            },
          ],
          currentOrganizationId: 'org-dbr77-demo',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return realFetch(input as RequestInfo, init);
  };
}

export function NavDeclutterSidebarScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider showDevTools={false}>
        <div
          style={{
            position: 'relative',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
          }}
          className="bg-white dark:bg-navy-900"
        >
          <Sidebar />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default NavDeclutterSidebarScreen;
