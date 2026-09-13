/**
 * Dev-render: K5 — REALNY <InitiativesHub> na danych odwzorowujących żywy
 * staging (org DBR77, pomiar 2026-09-13).
 *
 * PO CO: zrzuty odbiorowe napraw I1 (kropka priorytetu: ta sama „Medium"
 * w siatce, na kanbanie i w panelu Właściwości), I2 (kebab jednym językiem)
 * i I4 (pasek „Top Warnings": cichy tint zamiast wypełnionej czerwieni,
 * „Blocked" tylko dla faktycznie zablokowanych).
 *
 * Dane idą przez stub `window.fetch` (tylko odczyt), więc renderuje się
 * PRODUKT: `InitiativesHub` → `CanonicalInitiativeRegister`/`PortfolioGridView`/
 * `PortfolioKanbanView`/`InitiativesTimelineView`.
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const ORG_ID = 'org-dbr77-demo';

const rows: Array<[string, string, string, string, string | null]> = [
  ['i-inventory', 'Optymalizacja zapasów komponentów', 'IN_EXECUTION', 'MEDIUM', '2026-03-18'],
  ['i-traceability', 'Pełna identyfikowalność partii', 'IN_EXECUTION', 'MEDIUM', null],
  ['i-oee', 'Program poprawy OEE linii montażowej', 'IN_EXECUTION', 'MEDIUM', null],
  ['i-salesops', 'S&OP oparty na jednym źródle danych', 'IN_EXECUTION', 'MEDIUM', null],
  ['i-wip', 'Automatyzacja magazynu WIP', 'IN_EXECUTION', 'HIGH', null],
  ['i-devops', 'Transformacja DevOps', 'IN_EXECUTION', 'MEDIUM', null],
  ['i-rpa', 'Wdrożenie RPA', 'APPROVED', 'MEDIUM', null],
  ['i-iot', 'Wdrożenie sieci czujników IoT', 'PENDING_APPROVAL', 'LOW', null],
  ['i-energy', 'Redukcja zużycia energii w zakładzie', 'DRAFT', 'HIGH', null],
  ['i-quality', 'Automatyzacja kontroli jakości', 'DRAFT', 'CRITICAL', null],
];

const INITIATIVES = rows.map(([id, name, status, priority, plannedEndDate]) => ({
  id,
  name,
  description: null,
  summary: null,
  status,
  priority,
  progress: 0,
  budget: 0,
  axis: 'processes',
  plannedStartDate: '2026-01-05',
  plannedEndDate,
  updatedAt: '2026-09-10T10:00:00.000Z',
  ownerBusiness: { id: 'user-piotr', firstName: 'Piotr', lastName: 'Wiśniewski' },
  ownerExecution: null,
}));

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/\/api\/initiatives(\?|$)/.test(url)) return json(INITIATIVES);
  if (url.includes(`/organizations/${ORG_ID}/members`)) return json([]);
  if (url.startsWith('/api') || url.includes('/api/')) return json({ data: [] });
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function K5NaprawyInicjatywyScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
