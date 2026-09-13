/**
 * Dev-render: K5-5 — GÓRA podglądów Realizacji (bloki 1–2) po wyrównaniu do kanonu.
 *
 * PO CO (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym testerem wizualnym):
 * właściciel odrzucił górę podglądu zadania na stagingu („tutaj preview też na
 * górze nie jest zgodne"). Ten ekran daje zrzut odbiorowy PRODUKTU —
 * `ExecutionHub` → `ExecutionWorkSurface`/`ExecutionControlSurface`/
 * `ExecutionReportsSurface` → `StandardPreview` — na danych, które pokazują
 * dokładnie te dwa przypadki, o które prosi odbiór:
 *
 *   · „Close the security audit" — zadanie ZAMKNIĘTE (status done, bez osoby),
 *     czyli wiersz, w którym właściciel widział „v0", zdanie w karcie meta i
 *     zdanie luzem pod tabelą („The task is already closed.");
 *   · „Approve the supplier data scope" — zadanie OTWARTE, z osobą i terminem.
 *
 * Zakładki przełącza się Menu 1 (Execution bank · Work · Risk management ·
 * Reports) — ten sam ekran obsługuje wszystkie trzy podglądy objęte K5-5.
 * Wiersze rejestru ryzyka/decyzji i raportów dochodzą ze ścieżek degradacji
 * produktu (lokalny przegląd w DEV), tak jak w `execution-tab-work`.
 *
 * Dane idą przez stub `window.fetch` (tylko odczyt, zero zapisów).
 * `&lang=en` — oprogramowanie jest po angielsku (DEC-461).
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const ORG_ID = 'org-dbr77-demo';

const INITIATIVES = [
  {
    id: 'init-security',
    name: 'Security programme 2026',
    description: null,
    status: 'IN_EXECUTION',
    priority: 'HIGH',
    progress: 62,
    plannedStartDate: '2026-04-01',
    plannedEndDate: '2026-10-12',
    updatedAt: '2026-09-10T10:00:00.000Z',
    ownerBusiness: { id: 'user-anna', firstName: 'Anna', lastName: 'Kowalska' },
    ownerExecution: null,
  },
];

/** Dwa wiersze z `/api/tasks` — zamknięty i otwarty (osoba + termin). */
const TASKS = [
  {
    id: 'task-security-audit',
    title: 'Close the security audit',
    status: 'done',
    assigneeId: '',
    dueDate: '2026-08-27T00:00:00.000Z',
    initiativeId: 'init-security',
    description:
      'Collect the auditor findings, confirm every remediation owner signed off and archive the evidence pack.',
  },
  {
    id: 'task-supplier-scope',
    title: 'Approve the supplier data scope',
    status: 'in_progress',
    assigneeId: 'user-anna',
    dueDate: '2026-09-30T00:00:00.000Z',
    initiativeId: 'init-security',
    description:
      'Agree with procurement which supplier attributes leave the organisation and record the approval.',
  },
];

const DECISIONS = [
  {
    id: 'dec-canonical-source',
    title: 'Choose the canonical demand forecast source',
    status: 'pending',
    dueDate: '2026-08-25T00:00:00.000Z',
    decisionMakerId: 'user-anna',
    initiativeId: 'init-security',
    description: 'Two systems publish a forecast; the delivery needs one source of record.',
  },
];

const RAID = [
  {
    id: 'raid-vendor-lock',
    title: 'Vendor lock-in on the audit toolchain',
    type: 'RISK',
    status: 'OPEN',
    probability: 'HIGH',
    impact: 'HIGH',
    dueDate: '2026-09-05T00:00:00.000Z',
    ownerId: 'user-anna',
    initiativeId: 'init-security',
    description: 'One supplier holds both the scanner and the evidence store.',
  },
];

const MEMBERS = [
  {
    id: 'm-1',
    user_id: 'user-anna',
    first_name: 'Anna',
    last_name: 'Kowalska',
    email: 'anna.kowalska@dbr77.com',
  },
];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/\/api\/tasks(\?|$)/.test(url)) return json(TASKS);
  if (/\/api\/decisions(\?|$)/.test(url)) return json(DECISIONS);
  if (/\/api\/raid(\?|$)/.test(url)) return json(RAID);
  if (url.includes(`/organizations/${ORG_ID}/members`)) return json(MEMBERS);
  if (/\/api\/initiatives(\?|$)/.test(url)) return json(INITIATIVES);
  /*
   * Reszta tras zostaje bez atrapy CELOWO: harness odpowiada na nie uczciwym
   * 404 (`apiNoBackendPlugin`), a produkt ma dla nich własne ścieżki
   * degradacji (`executionLocalReviewEnabled`) — to nimi wypełnia się rejestr
   * raportów. Podstawienie tu pustego 200 wygasiłoby te ścieżki i zrzut
   * pokazywałby puste tabele zamiast treści.
   */
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function K5PreviewWorkScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionHub initialTab={'work' as never} />
      </div>
    </AppProviders>
  );
}
