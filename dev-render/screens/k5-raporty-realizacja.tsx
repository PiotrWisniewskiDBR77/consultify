/**
 * K5-6 — Realizacja → zakładka „Reports" (REALNY `<ExecutionHub initialTab="reports">`).
 *
 * PO CO: odbiór właściciela 13.09 na stagingu (`cf3fded7e4`, org DBR77) —
 * „tu nie widzę": pusty rejestr migawek (`All 0 · Needs review 0 ·
 * Published 0 · Definitions 12`) i ZERO widocznej akcji. Ten ekran odtwarza
 * DOKŁADNIE tę konfigurację danych: katalog 12 definicji
 * (`/api/execution-reports/definitions`, klucze 1:1 z migracjami 910 i
 * 20262104) + rejestr migawek pusty (`?runs=0`, domyślnie) albo z dwiema
 * migawkami (`?runs=2`).
 *
 * Wszystko idzie przez stub `window.fetch` (tylko odczyt), więc renderuje się
 * PRODUKT: ExecutionHub → StandardModuleBar (Menu 2 z primary CTA) →
 * ExecutionReportsSurface → StandardTable.
 *
 * Query: `&runs=0|2` · `&lang=en` (staging jest po angielsku, DEC-461) ·
 * `&theme=light|dark`.
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // ignore
}

/** Katalog serwera 1:1 (`EXECUTION_REPORT_CATALOG` + `report_definitions`). */
const DEFINITIONS = [
  ['initiative-card', 'Initiative Delivery Card', 'OWNER', true, 'Weekly', 'Initiative Owner'],
  ['weekly-exec', 'Weekly Execution Pack', 'PMO', true, 'Weekly', 'PMO'],
  ['program-health', 'Program Health Summary', 'STEERCO', true, 'Monthly', 'Steering Committee'],
  ['sponsor-onepager', 'Sponsor-Ready One-Pager', 'BOARD', true, 'Monthly', 'Executive sponsor'],
  ['milestone-slippage', 'Milestone Slippage Report', 'PMO', false, 'Weekly', 'PMO'],
  ['decision-backlog', 'Decision Backlog & Approval Aging', 'PMO', false, 'Weekly', 'PMO'],
  ['capacity-utilization', 'Capacity Utilization Report', 'PMO', false, 'Monthly', 'PMO'],
  ['blockers-recovery', 'Blockers & Recovery Report', 'PMO', false, 'Weekly', 'PMO'],
  ['cross-dependency', 'Cross-Initiative Dependency Report', 'PMO', false, 'Monthly', 'PMO'],
  ['delivery-confidence', 'Delivery Confidence Report', 'STEERCO', false, 'Monthly', 'Steering Committee'],
  ['budget-variance', 'Budget Variance Report', 'STEERCO', false, 'Monthly', 'Steering Committee'],
  ['monthly-pmo', 'Monthly PMO Review', 'BOARD', false, 'Monthly', 'Board'],
].map(([key, name, level, mvp, cadence, audience]) => ({
  key,
  name,
  audience,
  cadence,
  scope: 'Delivery portfolio',
  sections: ['Progress and schedule', 'Milestones', 'Blockers'],
  level,
  mvp,
  formats: ['SCREEN'],
}));

const RUNS = [
  {
    id: 'run-1',
    definitionKey: 'weekly-exec',
    level: 'PMO',
    title: 'Weekly Execution Pack',
    status: 'PUBLISHED',
    rag: 'AMBER',
    period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:59.000Z' },
    asOf: '2026-09-08T06:00:00.000Z',
    createdAt: '2026-09-08T06:00:00.000Z',
    createdByName: 'Paweł Kowalski',
    publishedAt: '2026-09-08T08:00:00.000Z',
  },
  {
    id: 'run-2',
    definitionKey: 'program-health',
    level: 'STEERCO',
    title: 'Program Health Summary',
    status: 'DRAFT',
    rag: 'GREEN',
    period: { start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T23:59:59.000Z' },
    asOf: '2026-09-01T06:00:00.000Z',
    createdAt: '2026-09-01T06:00:00.000Z',
    createdByName: 'Paweł Kowalski',
    publishedAt: null,
  },
];

const runsWanted = Number(new URLSearchParams(window.location.search).get('runs') ?? '0');

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/execution-reports/definitions')) return json({ definitions: DEFINITIONS });
  if (url.includes('/api/execution-reports/runs')) {
    return json({ items: runsWanted > 0 ? RUNS.slice(0, runsWanted) : [] });
  }
  if (url.includes('/runtime-v1/execution-cases')) return json({ cases: [] });
  if (/\/api\/initiatives(\?|$)/.test(url)) return json({ initiatives: [] });
  if (url.startsWith('/api') || url.includes('/api/')) {
    return json({ items: [], cases: [], data: [], definitions: [] });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function K5RaportyRealizacjaScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="k5-raporty-realizacja">
        <ExecutionHub initialTab={'reports' as never} />
      </div>
    </AppProviders>
  );
}
