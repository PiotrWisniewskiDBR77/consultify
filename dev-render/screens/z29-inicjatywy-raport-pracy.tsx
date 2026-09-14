/**
 * Z-29 (14.09) — REALNY <InitiativesHub> (Menu 1/2/3 w komplecie) z aktywną
 * zakładką Menu 2 „Work report" (`InitiativeWorkReportView`, P1/Codex S2).
 *
 * CLAUDE.md §7: właściciel NIGDY nie jest pierwszym testerem wizualnym. Ten
 * ekran montuje CAŁĄ powłokę modułu Inicjatywy (Menu 1/2/3), nie sam
 * `InitiativeWorkReportView` w oderwaniu — zrzut ma dowodzić, że zakładka
 * żyje wewnątrz prawdziwego Menu 2 obok „Initiatives"/„Plan"/„Load".
 *
 * Wzorzec 1:1 z `z27-inicjatywy-skrzynka.tsx`: `seedRealisticSession()` +
 * wyłączenie `isDemoMode` w store i w localStorage (zustand `persist`
 * nadpisuje sam zapis do localStorage po ~300ms, patrz komentarz w
 * `dec495-inicjatywy-archiwum.tsx`).
 *
 * Zakładka „Work report" istnieje w Menu 2 TYLKO przy
 * `VITE_INITIATIVES_WORK_REPORT=true` (patrz `InitiativesHub.tsx` —
 * `WORK_REPORT_ENABLED`). To jest flaga ODCZYTYWANA W BUDOWIE
 * (import.meta.env), więc harness NIE potrafi jej przełączyć przez URL —
 * trzeba uruchomić serwer dev-render z tą zmienną env ustawioną (parytet
 * OFF = osobne uruchomienie serwera bez niej):
 *
 *   VITE_INITIATIVES_WORK_REPORT=true \
 *     npx vite --config dev-render/vite.config.ts --port <PORT> --strictPort
 *
 * Atrapa API (kontrakt z `runtimeApi.ts` — `/api/initiatives/runtime-v1/...`):
 *   - GET  report-definitions            -> 2 definicje PUBLISHED
 *   - GET  report-definitions/:id        -> szczegół z wersją PUBLISHED
 *   - GET  report-runs                   -> 1 przebieg PUBLISHED (doręczono),
 *                                            1 przebieg APPROVED (doręczenie FAILED)
 *   - GET  /api/organizations/:id/members -> 1 uprawniony zatwierdzający (admin,
 *                                            inny niż zalogowany użytkownik)
 *
 * UWAGA (do raportu, nie do naprawy tutaj): `InitiativeWorkReportView.tsx`
 * NIE ma osobnego panelu podglądu przebiegu z rozbiciem doręczeń per adresat
 * ani widocznego linku do PDF — jest tylko wiersz `StandardTable` ze
 * statusem (`status`) i przyciskami „PDF"/„Send" działającymi na całym
 * przebiegu naraz. Zrzut 03 pokazuje więc realny stan (wiersz PUBLISHED w
 * tabeli), nie wymyśloną funkcję.
 *
 * Query:
 *   &lang=pl|en &theme=light|dark — jak wszędzie w harnessie
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Patrz `dec495-inicjatywy-archiwum.tsx` / `z27-inicjatywy-skrzynka.tsx`: sam
// localStorage nie wystarcza, bo zustand persist nadpisuje go po ~300 ms i
// rejestr po cichu wraca na demo.
useAppStore.setState({ isDemoMode: false });
try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // brak localStorage nie powinien wywalic harnessu
}

const OWNER_ID = 'user-piotr-demo';
const APPROVER_ID = 'user-anna-admin';
const ORG_ID = 'org-dbr77-demo';

const DEFINITIONS = [
  {
    definitionId: 'def-weekly-update',
    version: 2,
    currentVersion: 2,
    versions: [
      {
        definitionVersion: 1,
        state: 'DRAFT',
        name: 'Cotygodniowa aktualizacja zespołu',
        ownerId: OWNER_ID,
        approverId: APPROVER_ID,
      },
      {
        definitionVersion: 2,
        state: 'PUBLISHED',
        name: 'Cotygodniowa aktualizacja zespołu',
        ownerId: OWNER_ID,
        approverId: APPROVER_ID,
      },
    ],
  },
  {
    definitionId: 'def-decision-backlog',
    version: 1,
    currentVersion: 1,
    versions: [
      {
        definitionVersion: 1,
        state: 'PUBLISHED',
        name: 'Zaległe decyzje',
        ownerId: OWNER_ID,
        approverId: APPROVER_ID,
      },
    ],
  },
];

const RUNS = [
  {
    reportRunId: 'run-published-01',
    status: 'PUBLISHED',
    version: 5,
    ownerId: OWNER_ID,
    approverId: APPROVER_ID,
    updatedAt: '2026-09-13T07:05:00.000Z',
    audience: ['anna.kowalska@dbr77.com', 'marek.zielinski@dbr77.com'],
    delivery: { state: 'DELIVERED', deliveredCount: 2, failedCount: 0 },
    workReport: {
      title: 'Cotygodniowa aktualizacja zespołu — 8–14 wrz',
      templateId: 'WEEKLY_TEAM_UPDATE',
      cadence: 'WEEKLY',
      projectIds: [],
    },
  },
  {
    reportRunId: 'run-approved-01',
    status: 'APPROVED',
    version: 4,
    ownerId: OWNER_ID,
    approverId: APPROVER_ID,
    updatedAt: '2026-09-12T15:40:00.000Z',
    audience: ['tomasz.duda@dbr77.com'],
    delivery: { state: 'FAILED', deliveredCount: 0, failedCount: 1 },
    workReport: {
      title: 'Zaległe decyzje — przegląd wrzesień',
      templateId: 'DECISION_BACKLOG',
      cadence: 'ON_DEMAND',
      projectIds: [],
    },
  },
];

const MEMBERS = [
  {
    userId: APPROVER_ID,
    firstName: 'Anna',
    lastName: 'Nowak',
    email: 'anna.nowak@dbr77.com',
    role: 'admin',
    status: 'active',
  },
  {
    userId: OWNER_ID,
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    role: 'owner',
    status: 'active',
  },
];

// Rejestr (Menu 1 „Initiatives") — kilka wierszy, żeby pozostałe zakładki nie
// pokazywały pustego stanu w tle (InitiativesHub woła rejestr bezwarunkowo
// przy montowaniu, niezależnie od aktywnej zakładki).
const REGISTER_ROWS = [
  {
    id: 'ini-1',
    organizationId: ORG_ID,
    name: 'ERP rollout — phase 2 (finance close)',
    title: 'ERP rollout — phase 2 (finance close)',
    summary: 'Finance close automation, phase 2 of the ERP rollout.',
    status: 'APPROVED',
    archived: false,
    onHold: false,
    priority: 'HIGH',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-09-12T09:30:00.000Z',
  },
  {
    id: 'ini-2',
    organizationId: ORG_ID,
    name: 'Warehouse automation pilot',
    title: 'Warehouse automation pilot',
    summary: 'Pilot automation across two picking lanes.',
    status: 'SCHEDULED',
    archived: false,
    onHold: false,
    priority: 'MEDIUM',
    createdAt: '2026-08-05T09:00:00.000Z',
    updatedAt: '2026-09-13T14:05:00.000Z',
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const method = (init?.method || 'GET').toUpperCase();

  if (url.includes('/report-definitions/') && method === 'GET') {
    const id = decodeURIComponent(url.split('/report-definitions/')[1].split(/[?/]/)[0]);
    const found = DEFINITIONS.find((d) => d.definitionId === id);
    if (found) return json(found);
    return json({ error: 'not_found' }, 404);
  }
  if (url.endsWith('/report-definitions') && method === 'GET') {
    return json({ items: DEFINITIONS.map((d) => ({ definitionId: d.definitionId })) });
  }
  if (url.endsWith('/report-runs') && method === 'GET') {
    return json({ items: RUNS });
  }
  if (url.includes(`/organizations/${ORG_ID}/members`)) {
    return json(MEMBERS);
  }
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) {
    return json({ proposals: [] });
  }
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    return json({ initiatives: [], nextCursor: null });
  }
  if (url.includes('/my-work/definition-approvals')) {
    return json({ enabled: false, items: [] });
  }
  if (url.includes('/capabilities')) {
    return json({ canUpdate: true, canReview: true, canSelfApprove: true });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    return json(REGISTER_ROWS);
  }
  return originalFetch(input, init);
};

export default function Z29InicjatywyRaportPracyScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="z29-inicjatywy-raport-pracy">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
