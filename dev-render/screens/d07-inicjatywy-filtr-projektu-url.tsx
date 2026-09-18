/**
 * D-07 (DLUG-PO-MVP, 18.09) — REALNY <InitiativesHub> przy fladze
 * `VITE_INITIATIVES_FOUR_BUTTONS=true`: filtr projektami (L3, Menu 2)
 * ZAPAMIĘTANY W ADRESIE. Dowód wizualny, że deep-link `?project=<id>`:
 *   (1) przywraca wybór w selekcie „Project" bez żadnego kliknięcia,
 *   (2) zawęża rejestr do tego projektu (3 z 5 wierszy),
 *   (3) adres niesie `project=<id>` — widoczne w pasku „Address" na dole
 *       (sonda `useLocation`, ten sam mechanizm, który mierzy test wpięcia
 *       `InitiativesHub.fourButtonsE1.test.tsx`).
 *
 * Wzorzec mocków: `z30-inicjatywy-obciazenie.tsx` (seedRealisticSession +
 * wyłączenie isDemoMode w STORZE i localStorage, bo zustand persist nadpisuje
 * sam localStorage po ~300 ms). Różnica: projekcja runtime-v1 zwraca PIĘĆ
 * zarejestrowanych inicjatyw w DWÓCH projektach (z `projectId` i `projectName`,
 * żeby filtr miał czytelne etykiety — `resolveProjectFilterLabel`), a katalog
 * `/api/projects` dokłada nazwy jako drugą deskę ratunku.
 *
 * Flaga `VITE_INITIATIVES_FOUR_BUTTONS` jest odczytywana W BUDOWIE, więc
 * harness musi wystartować z tą zmienną env:
 *   VITE_INITIATIVES_FOUR_BUTTONS=true \
 *     npx vite --config dev-render/vite.config.ts --port <PORT> --strictPort
 *
 * Query:
 *   &project=proj-digital   — deep-link filtra (bez tego: „All projects", 5 wierszy)
 *   &lang=en|pl &theme=light|dark
 */
import React from 'react';
import { useLocation } from 'react-router-dom';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

useAppStore.setState({ isDemoMode: false });
try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // brak localStorage nie powinien wywalic harnessu
}

/* MUSI być równy id z `seedRealisticSession()` (org-dbr77-demo): gdyby mock
   `/api/organizations/current` zwrócił INNY org, AppProviders zmieniłby zakres
   po montowaniu, a Hub SŁUSZNIE wyczyściłby deep-link `?project=` jako prawdziwą
   zmianę org. Tu nie chcemy sztucznej zmiany zakresu — mierzymy przeżycie
   deep-linka, nie reset przy przełączeniu organizacji. */
const ORG_ID = 'org-dbr77-demo';

const registered = (
  id: string,
  title: string,
  lifecycleState: string,
  priority: string,
  projectId: string,
  projectName: string
) => ({
  version: 1,
  updatedAt: '2026-09-15T09:00:00.000Z',
  initiative: {
    initiativeId: id,
    lifecycleState,
    title,
    priority,
    projectId,
    projectName,
    readiness: 'NOT_EVALUATED',
  },
});

const DIGITAL = 'proj-digital';
const OPS = 'proj-ops';
const DIGITAL_NAME = 'Digital & Automation Roadmap';
const OPS_NAME = 'Operations Excellence';

const REGISTERED = [
  registered('ini-d1', 'Self-service customer portal', 'SCHEDULED', 'HIGH', DIGITAL, DIGITAL_NAME),
  registered('ini-d2', 'Invoice intake automation (RPA)', 'EXECUTING', 'MEDIUM', DIGITAL, DIGITAL_NAME),
  registered('ini-d3', 'Data warehouse migration', 'SCHEDULED', 'HIGH', DIGITAL, DIGITAL_NAME),
  registered('ini-o1', 'Management reporting consolidation', 'EXECUTING', 'MEDIUM', OPS, OPS_NAME),
  registered('ini-o2', 'Energy savings programme 2026', 'SCHEDULED', 'LOW', OPS, OPS_NAME),
];

const PROJECTS = [
  { id: DIGITAL, name: DIGITAL_NAME },
  { id: OPS, name: OPS_NAME },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const path = new URL(url, window.location.origin).pathname;
  if (path === '/api/organizations/current') {
    return json({
      organizations: [
        { id: ORG_ID, name: 'Northwind Traders', role: 'OWNER', access_type: 'OWNER', is_current: true },
      ],
    });
  }
  if (/^\/api\/organizations\/[^/]+\/members$/.test(path)) {
    return json([
      {
        userId: 'user-owner-demo',
        name: 'Piotr Wiśniewski',
        email: 'owner@example.test',
        role: 'OWNER',
        status: 'active',
        joinedAt: '2026-08-01T08:00:00.000Z',
      },
    ]);
  }
  if (path === '/api/users') {
    return json({
      users: [
        {
          id: 'user-owner-demo',
          firstName: 'Piotr',
          lastName: 'Wiśniewski',
          email: 'owner@example.test',
          role: 'ADMIN',
        },
      ],
      total: 1,
    });
  }
  if (path === '/api/projects' || path === '/api/pmo/projects') {
    return json(PROJECTS);
  }
  if (path === '/api/v8/planning/pending-decisions') {
    return json({ pendingDecisionChains: [] });
  }
  if (path === '/api/v8/admin/flags') {
    return json({ flags: [] });
  }
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) {
    return json({ proposals: [] });
  }
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    return json({ initiatives: REGISTERED, nextCursor: null });
  }
  if (url.includes('/my-work/definition-approvals')) {
    return json({ enabled: false, items: [] });
  }
  if (url.includes('/capabilities')) {
    return json({ canUpdate: true, canReview: true, canSelfApprove: true });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    // Projekcja legacy pusta — rejestr żyje wyłącznie z runtime-v1 (kanoniczne).
    return json([]);
  }
  return originalFetch(input, init);
};

/* Pasek „Address" — czyta REALNY `location.search` z BrowserRouter w
   AppProviders, więc pokazuje dokładnie to, co Hub zapisał przez
   `setSearchParams` (deep-link `?project=` przeżywa odświeżenie). */
function AddressReadout(): React.ReactElement {
  const location = useLocation();
  return (
    <div
      data-testid="d07-address"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        background: 'rgba(15,23,42,0.92)',
        color: '#e2e8f0',
        borderTop: '1px solid rgba(148,163,184,0.4)',
      }}
    >
      <span style={{ opacity: 0.7 }}>Address</span>
      <span style={{ fontWeight: 600 }}>{`/initiatives${location.search}`}</span>
    </div>
  );
}

export default function D07InicjatywyFiltrProjektuUrlScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="d07-inicjatywy-filtr-projektu-url">
        <InitiativesHub />
        <AddressReadout />
      </div>
    </AppProviders>
  );
}
