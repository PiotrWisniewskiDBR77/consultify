/**
 * Dev-render: K5-3 — PODGLĄD wiersza banku Realizacji na powłoce kanonu.
 *
 * PO CO (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym testerem wizualnym):
 * zrzut odbiorowy podglądu. `k5-naprawy-realizacja` odwzorowuje ŻYWY staging,
 * gdzie ŻADEN wiersz nie ma bazy odniesienia ani prognozy — na takich danych
 * nie widać, czy blok treści i „Co dalej" działają dla wiersza KOMPLETNEGO.
 * Ten ekran dokłada dokładnie dwa wiersze, o które prosi odbiór:
 *
 *   · „Component stock optimisation" — Z realizacją, z bazą odniesienia,
 *     prognozą, postępem, wariancją +12 d i zgłoszonym zdrowiem,
 *   · „WIP warehouse automation" — BEZ realizacji (inicjatywa w toku, której
 *     nikt jeszcze nie przekazał).
 *
 * Renderuje się PRODUKT: `ExecutionHub` → `buildExecutionBankRows` →
 * `ExecutionBankViews`/`JedenPrawyPanel` → `StandardPreview`. Dane idą przez
 * stub `window.fetch` (tylko odczyt, zero zapisów).
 *
 * `&lang=en` — staging jest po angielsku (DEC-461).
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const ORG_ID = 'org-dbr77-demo';

const EXECUTION_CASES = [
  {
    executionCaseId: 'exec-inventory',
    initiativeId: 'init-inventory',
    initiativeTitle: 'Component stock optimisation',
    version: 2,
    state: 'ACTIVE',
    executionPhase: 'Delivery',
    deliveryProfile: 'Standard',
    executionManagerId: 'user-marek',
    forecastStartDate: '2026-04-01',
    forecastEndDate: '2026-10-12',
    forecastObservedAt: '2026-09-12',
    health: 'AT_RISK',
    blockerCount: 2,
    pendingDecisionCount: 1,
    updatedAt: '2026-09-10T10:00:00.000Z',
  },
];

const INITIATIVES = [
  {
    id: 'init-inventory',
    name: 'Component stock optimisation',
    description: null,
    status: 'IN_EXECUTION',
    priority: 'HIGH',
    progress: 45,
    plannedStartDate: '2026-04-01',
    plannedEndDate: '2026-10-12',
    baselineStartDate: '2026-04-01',
    baselineEndDate: '2026-09-30',
    baselineSetAt: '2026-03-28',
    scheduleBaselineId: 'baseline-inventory-1',
    baselineVersion: 1,
    actualStartDate: '2026-04-03',
    actualEndDate: null,
    updatedAt: '2026-09-10T10:00:00.000Z',
    ownerBusiness: { id: 'user-marek', firstName: 'Marek', lastName: 'Nowak' },
    ownerExecution: null,
  },
  {
    id: 'init-wip',
    name: 'WIP warehouse automation',
    description: null,
    status: 'IN_EXECUTION',
    priority: 'MEDIUM',
    progress: null,
    plannedStartDate: null,
    plannedEndDate: null,
    baselineStartDate: null,
    baselineEndDate: null,
    actualStartDate: null,
    actualEndDate: null,
    updatedAt: '2026-09-09T08:00:00.000Z',
    ownerBusiness: { id: 'user-marta', firstName: 'Marta', lastName: 'Gomez' },
    ownerExecution: null,
  },
];

const MEMBERS = [
  {
    id: 'm-1',
    user_id: 'user-marek',
    first_name: 'Marek',
    last_name: 'Nowak',
    email: 'marek.nowak@dbr77.com',
  },
  {
    id: 'm-2',
    user_id: 'user-marta',
    first_name: 'Marta',
    last_name: 'Gomez',
    email: 'marta.gomez@dbr77.com',
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
  if (url.includes('/runtime-v1/execution-cases')) return json({ cases: EXECUTION_CASES });
  if (url.includes(`/organizations/${ORG_ID}/members`)) return json(MEMBERS);
  if (/\/api\/initiatives(\?|$)/.test(url)) return json(INITIATIVES);
  if (url.startsWith('/api') || url.includes('/api/')) return json({ data: [] });
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function K5PreviewBankScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionHub initialTab={'list' as never} />
      </div>
    </AppProviders>
  );
}
