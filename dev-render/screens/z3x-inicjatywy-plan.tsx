/** DEC-497 P2: full InitiativesHub shell for EN/PL, light/dark and empty/full evidence. */
import React from 'react';

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
  // The harness can still render when storage is unavailable.
}

const query = new URLSearchParams(window.location.search);
const empty = query.get('state') === 'empty';
/**
 * DEC-608/DEC-615 (PL3 etap 1): `&plan=draft|published` — cztery zrzuty
 * dowodowe to light/dark × DRAFT/PUBLISHED. Domyślnie DRAFT, czyli stan
 * sprzed tej zmiany (żaden istniejący zrzut nie zmienia znaczenia).
 */
const published = query.get('plan') === 'published';
/**
 * D-96 (Wpis 102): `&windows=0` = szkic BEZ okien, czyli stan po „New plan"
 * (`PlanScenarioSurface.tsx` tworzy agregat z `windows: []`). Bez okien oś
 * rysowała się jako pusty tor — wariant `&windows=0` dowodzi, że pod flagą
 * `VITE_PLAN_TIMELINE_V2` karta ląduje NA OSI i ma paski z terminów inicjatyw.
 * Brak parametru = fikstura bez zmian (8 okien), więc istniejące zrzuty
 * `pl3-*` zachowują znaczenie.
 */
const windowless = query.get('windows') === '0';
const ORG_ID = 'org-dbr77-demo';

/**
 * Fikstura = 8 inicjatyw Northwind z zaakceptowanej makiety PL3
 * (`~/Developer/cto-codex/makieta-pl3-20260917/makieta.html`, wiersze `.lrow`
 * i `.bar`). Cztery w realizacji (zamrożone), trzy planowane w horyzoncie,
 * jedna planowana poza horyzontem (Scrap Reduction, start 2027-01-12).
 */
const NORTHWIND: Array<{
  id: string;
  name: string;
  start: string;
  end: string;
  exec: boolean;
  dependsOn: string[];
  priority: 'HIGH' | 'MEDIUM';
  role: string;
}> = [
  { id: 'energy', name: 'Energy Monitoring and ISO 50001', start: '2026-09-28', end: '2026-10-26', exec: false, dependsOn: [], priority: 'HIGH', role: 'Energy lead' },
  { id: 'supplier', name: 'Supplier Quality Gate', start: '2026-11-02', end: '2026-11-30', exec: false, dependsOn: ['energy'], priority: 'HIGH', role: 'Quality lead' },
  { id: 'scrap', name: 'Scrap Reduction Programme', start: '2027-01-12', end: '2027-06-30', exec: false, dependsOn: [], priority: 'MEDIUM', role: 'Ops lead' },
  { id: 'shift', name: 'Shift Handover Digitisation', start: '2026-11-09', end: '2026-12-07', exec: false, dependsOn: ['cnc'], priority: 'MEDIUM', role: 'Ops lead' },
  { id: 'cnc', name: 'Predictive Maintenance for CNC Line', start: '2026-06-02', end: '2026-11-02', exec: true, dependsOn: [], priority: 'HIGH', role: 'Maintenance' },
  { id: 'mes', name: 'MES Rollout Line 3', start: '2026-04-07', end: '2027-03-01', exec: true, dependsOn: [], priority: 'HIGH', role: 'IT / MES' },
  { id: 'warehouse', name: 'Warehouse Automation Pilot', start: '2026-07-21', end: '2026-10-26', exec: true, dependsOn: [], priority: 'MEDIUM', role: 'Logistics' },
  { id: 'skills', name: 'Skills Matrix and Upskilling', start: '2026-09-21', end: '2026-11-30', exec: true, dependsOn: [], priority: 'MEDIUM', role: 'Quality lead' },
];

const initiatives = empty
  ? []
  : NORTHWIND.map((row) => ({
      id: row.id,
      organizationId: ORG_ID,
      name: row.name,
      title: row.name,
      summary: `${row.name} — Northwind 2027 portfolio plan.`,
      status: row.exec ? 'IN_EXECUTION' : 'APPROVED',
      lifecycle: row.exec ? 'IN_EXECUTION' : 'APPROVED',
      archived: false,
      onHold: false,
      priority: row.priority,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-09-14T09:00:00.000Z',
    }));
const periods = Array.from({ length: 12 }, (_, index) => ({
  periodId: `W${index + 1}`,
  start: new Date(Date.UTC(2026, 8, 14 + index * 7)).toISOString(),
  end: new Date(Date.UTC(2026, 8, 21 + index * 7)).toISOString(),
}));
const windows = NORTHWIND.map((row) => ({
  initiativeId: row.id,
  initiativeVersion: 1,
  // Północ CZASU LOKALNEGO (bez `Z`): na maszynie pomiarowej (America/Chicago)
  // `T00:00:00.000Z` to 19:00 POPRZEDNIEGO dnia i każdy pasek siada dzień w
  // lewo od makiety. Bez sufiksu geometria jest identyczna w każdym TZ.
  earliest: `${row.start}T00:00:00`,
  target: `${row.start}T00:00:00`,
  latest: `${row.end}T00:00:00`,
  confidence: row.exec ? 'HIGH' : 'MEDIUM',
  rationale: 'PLAN_REASON:{"code":"DEPENDENCIES_PRECEDE"}',
  dependencySnapshot: row.dependsOn,
  constraintSnapshot: [],
  // P3 (Wpis 74): rola z makiety (`.lmeta` „Planned · <rola>") — bez tego druga
  // linia etykiety w kolumnie nazw nigdy się nie renderowała w dowodzie.
  roleDemand: [{ roleId: `role-${row.id}`, roleLabel: row.role, fte: 1 }],
}));
const scenario = {
  scenarioId: 'plan-us-launch',
  name: 'Northwind 2027 portfolio plan',
  scenarioVersion: 4,
  status: published ? 'PUBLISHED' : 'DRAFT',
  portfolioScenarioId: 'portfolio-us',
  portfolioScenarioVersion: 3,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods,
  windows: windowless ? [] : windows,
  assumptions: [],
  createdBy: 'Piotr Wisniewski',
  updatedBy: 'Piotr Wisniewski',
  publishedBy: published ? 'Piotr Wisniewski' : null,
  publishedAt: published ? '2026-09-16T14:00:00.000Z' : null,
};
const proposal = {
  proposalId: 'proposal-us-launch', inputAggregateVersion: 4, inputScenarioVersion: 4, status: 'PENDING_REVIEW',
  assumptions: [], rationale: 'AI dependency analysis', conflicts: [], changes: [], analysisSource: 'AI', analysisModel: 'consultify-plan-premium',
  dependencyObservations: empty ? [] : [
    { observationId: 'obs-1', predecessorId: 'energy', successorId: 'supplier', kind: 'ABSOLUTE', condition: null, rationale: 'The supplier gate audits the metering baseline produced by Energy Monitoring.', evidenceRefs: ['deliverables', 'scopeIn'], confidence: 'HIGH' },
    { observationId: 'obs-2', predecessorId: 'cnc', successorId: 'shift', kind: 'CONDITIONAL', condition: 'When the handover runs on the CNC line data.', rationale: 'Shift handover digitisation reuses the CNC condition signal; a sandbox pilot may start earlier.', evidenceRefs: ['summary', 'plannedStartDate'], confidence: 'MEDIUM' },
  ],
  criticalPaths: empty ? [] : [
    { pathId: 'absolute', kind: 'ABSOLUTE', initiativeIds: ['energy', 'supplier'], condition: null, rationale: 'Hard delivery gate.' },
    { pathId: 'conditional', kind: 'CONDITIONAL', initiativeIds: ['cnc', 'shift'], condition: 'When the handover runs on the CNC line data.', rationale: 'Conditional adoption path.' },
  ],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  const method = (init?.method ?? 'GET').toUpperCase();
  /**
   * PL3 etap 2 (DEC-627): zapis okna przez przeciąganie. `writePlanScenario`
   * POST-uje na `…/plan-scenarios/plan-us-launch`; bez tej gałęzi POST wpadłby
   * w niżej dopasowany GET (ta sama ścieżka) i zwrócił 200, więc ścieżka 409
   * (CAS) nigdy by się nie odtworzyła w dowodzie. `?conflict=1` → 409 →
   * `persistScenario` stawia `writeState='CONFLICT'`, a pasek wraca.
   */
  if (
    (method === 'POST' || method === 'PUT' || method === 'PATCH') &&
    url.includes('/api/initiatives/runtime-v1/plan-scenarios/plan-us-launch')
  ) {
    if (query.get('conflict') === '1') {
      return json({ error: { code: 'CONFLICT', rule: 'PLAN_SCENARIO_VERSION_CONFLICT' } }, 409);
    }
    return json({ aggregateVersion: 5, response: { ...scenario, scenarioVersion: 5 } });
  }
  if (url.includes('/api/organizations/') && url.includes('/members')) return json({ members: [] });
  if (url.includes('/api/v8/planning/pending-decisions')) return json([]);
  if (url.includes('/api/users')) return json([]);
  if (url.includes('/api/organizations/current')) return json({ id: ORG_ID, name: 'DBR77' });
  if (url.includes('/api/v8/admin/flags')) return json({ flags: {} });
  if (url.includes('/api/initiatives/runtime-v1/plan-scenarios/plan-us-launch/analysis-proposals')) return json({ items: [proposal] });
  if (url.includes('/api/initiatives/runtime-v1/plan-scenarios/plan-us-launch')) return json({ version: 4, scenario });
  if (url.includes('/api/initiatives/runtime-v1/plan-scenarios')) return json({ scenarios: empty ? [] : [{ id: scenario.scenarioId, name: scenario.name, state: scenario.status, version: scenario.scenarioVersion, portfolioRef: { scenarioId: scenario.portfolioScenarioId, scenarioVersion: scenario.portfolioScenarioVersion, name: 'US launch portfolio' }, window: { earliest: windows[0]?.earliest ?? null, latest: windows.at(-1)?.latest ?? null }, updatedAt: '2026-09-14T10:00:00.000Z', timeBasis: { windowUnit: 'WEEK', timezone: scenario.timezone, periods, knowledgeState: 'KNOWN' }, initiativeCount: windows.length, conflicts: 0, author: 'Piotr Wisniewski' }] });
  if (url.includes('/api/initiatives/runtime-v1/planning/'))
    return json({
      /**
       * D-96 (Wpis 102): szkic bez okien rysuje paski z terminów inicjatyw
       * dostępnych po stronie klienta (most `plannable-initiatives`), więc ten
       * wariant musi je mieć — poza nim zostaje pusta lista jak dotąd.
       */
      initiatives: windowless
        ? NORTHWIND.map((row) => ({
            id: row.id,
            name: row.name,
            status: row.exec ? 'APPROVED' : 'PENDING_APPROVAL',
            conditional: false,
            projectId: null,
            plannedStartDate: `${row.start}T00:00:00`,
            plannedEndDate: `${row.end}T00:00:00`,
            requiredCapacityFte: 1,
          }))
        : [],
    });
  if (url.includes('/api/initiatives/runtime-v1/capacity-scenarios')) return json({ scenarios: [] });
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) return json({ proposals: [] });
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) return json({ initiatives: [], nextCursor: null });
  if (url.includes('/my-work/definition-approvals')) return json({ enabled: false, items: [] });
  if (url.includes('/capabilities')) return json({ canUpdate: true, canReview: true, canSelfApprove: true });
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) return json(initiatives);
  return originalFetch(input, init);
};

export default function Z3xInicjatywyPlanScreen(): React.ReactElement {
  return <AppProviders><div className="h-screen" data-testid="z3x-inicjatywy-plan"><InitiativesHub /></div></AppProviders>;
}
