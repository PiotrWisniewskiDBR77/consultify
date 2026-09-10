/**
 * P13 — dowód wizualny przycisku eksportu danych organizacji (DEC-460,
 * koszyk 2 kryterium 12, S2.7). Fixture-only: montuje REALNY
 * <OrganizationsView> (src/views/superadmin/OrganizationsView.tsx) — bez
 * logowania, bez backendu, bez bazy — dokładnie wzorzec z
 * dev-render/screens/superadmin-platform-operations-day15.tsx.
 *
 * URL: ?screen=p13-eksport-organizacje&lang=pl|en&theme=light|dark
 *
 * `window.fetch` jest podmieniony na fixture: lista organizacji (2 wiersze),
 * pusta lista wniosków/kodów dostępu (inne zakładki tego samego ekranu), i
 * `GET /api/superadmin/organizations/:id/export` — endpoint P5, już gotowy
 * i przetestowany na Postgresie (evidence/p5-eksport-20260910/), tu tylko
 * fixture zwracająca realny kształt JSON, żeby przycisk miał co pobrać.
 */
import React from 'react';

import { OrganizationsView } from '../../src/views/superadmin/OrganizationsView';

const readyPayloads: Record<string, unknown> = {
  '/api/superadmin/organizations': {
    organizations: [
      {
        id: 'org-northstar',
        name: 'Northstar Manufacturing',
        status: 'active',
        plan: 'pro',
        discount_percent: 0,
        created_at: '2026-06-01T09:00:00.000Z',
      },
      {
        id: 'org-vistula',
        name: 'Vistula Operations',
        status: 'active',
        plan: 'enterprise',
        discount_percent: 10,
        created_at: '2026-05-12T09:00:00.000Z',
      },
    ],
  },
  '/api/superadmin/access-requests': { requests: [] },
  '/api/superadmin/access-codes': { codes: [] },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const globalState = window as typeof window & { __P13_ORGANIZATIONS_FIXTURE__?: boolean };
if (!globalState.__P13_ORGANIZATIONS_FIXTURE__) {
  globalState.__P13_ORGANIZATIONS_FIXTURE__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(url, window.location.origin).pathname;
    if (path in readyPayloads) return json(readyPayloads[path]);
    // P5 — GET /api/superadmin/organizations/:id/export?format=json|csv
    const exportMatch = path.match(/^\/api\/superadmin\/organizations\/([^/]+)\/export$/);
    if (exportMatch) {
      return json({
        organization: { id: exportMatch[1], name: 'Northstar Manufacturing' },
        exported_at: new Date().toISOString(),
        tables: { users: [], initiatives: [] },
      });
    }
    if (path.startsWith('/api/superadmin/') && (init?.method || 'GET') !== 'GET') {
      return json({ success: true });
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function P13EksportOrganizacjeScreen(): React.ReactElement {
  React.useEffect(() => {
    const root = document.getElementById('dev-render-root');
    if (!root) return;
    const previousWidth = root.style.width;
    const previousHeight = root.style.height;
    root.style.width = '100%';
    root.style.height = 'auto';
    return () => {
      root.style.width = previousWidth;
      root.style.height = previousHeight;
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto">
        <OrganizationsView />
      </main>
    </div>
  );
}
