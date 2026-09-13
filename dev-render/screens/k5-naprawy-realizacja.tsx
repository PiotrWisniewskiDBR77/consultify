/**
 * Dev-render: K5 — REALNY <ExecutionHub initialTab="list"> na danych
 * ODWZOROWUJĄCYCH ŻYWY STAGING (org DBR77, pomiar 2026-09-13).
 *
 * PO CO: zrzuty odbiorowe K5 (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym
 * testerem wizualnym). Ekran musi pokazać DOKŁADNIE tę konfigurację danych,
 * która wyprodukowała defekty R1–R5:
 *
 *   · 4 realizacje ACTIVE wskazujące na aggregaty `demo-story-…`, których
 *     `/api/initiatives` NIE ZNA (pomiar: `GET /api/initiatives/<id>` → 404,
 *     aggregat żyje tylko w `ie_aggregate_state`) → brak rekordu inicjatywy,
 *     czyli `lifecycleStatus: 'UNKNOWN'`, brak opisu, brak baseline'u;
 *   · `executionManagerId = d2b6a316-08c5-47cf-9bf7-4ba50311d5a2`, dla którego
 *     NIE MA wiersza w tabeli `users` (sprawdzone SELECT-em) → katalog członków
 *     organizacji nie rozwiąże go na nazwisko;
 *   · 8 inicjatyw `IN_EXECUTION` BEZ realizacji — te, które bank chował.
 *
 * Dane idą przez stub `window.fetch` (tylko odczyt, zero zapisów), więc
 * renderuje się PRODUKT, nie atrapa: `ExecutionHub` → `buildExecutionBankRows`
 * → `ExecutionBankViews` → `StandardTable`/`StandardKanban`/`StandardPreview`.
 *
 * `&lang=en` — staging jest po angielsku (DEC-461).
 */
import React from 'react';

import { ExecutionHub } from '../../src/components/Execution/ExecutionHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const ORG_ID = 'org-dbr77-demo';
const ORPHAN_MANAGER_ID = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';

/** Cztery realizacje ACTIVE — tytuły i identyfikatory 1:1 ze stagingu. */
const EXECUTION_CASES = [
  ['demo-story-20260826-execution-inventory', 'demo-story-20260826-initiative-inventory', 'Optymalizacja zapasów komponentów'],
  ['demo-story-20260826-execution-traceability', 'demo-story-20260826-initiative-traceability', 'Pełna identyfikowalność partii'],
  ['demo-story-20260826-execution-oee', 'demo-story-20260826-initiative-oee', 'Program poprawy OEE linii montażowej'],
  ['demo-story-20260826-execution-salesops', 'demo-story-20260826-initiative-salesops', 'S&OP oparty na jednym źródle danych'],
].map(([executionCaseId, initiativeId, initiativeTitle]) => ({
  executionCaseId,
  initiativeId,
  initiativeTitle,
  version: 1,
  state: 'ACTIVE',
  executionManagerId: ORPHAN_MANAGER_ID,
}));

/** Inicjatywy w toku BEZ realizacji — te, których bank nie pokazywał. */
const INITIATIVES = [
  ['seed:automatyzacja-magazynu-wip', 'Automatyzacja magazynu WIP', 'Marek', 'Nowak'],
  ['seed:robotyzacja-gniazda-spawalniczego', 'Robotyzacja gniazda spawalniczego', 'Tomasz', 'Jankowski'],
  ['seed:system-wizyjny-kontroli-jakosci', 'System wizyjny kontroli jakości', null, null],
  ['c55f3b10-e04e-44dd-a2e0-178046902520', 'Process Automation — RPA', 'Jan', 'Zieliński'],
  ['5317c99f-1710-4e92-a65f-c56e5c38b3dd', 'System zarządzania jakością 4.0', 'Piotr', 'Wiśniewski'],
  ['d3bc32b2-ca68-456f-8af9-a432d6f10442', 'Transformacja DevOps', 'Piotr', 'Wiśniewski'],
].map(([id, name, firstName, lastName]) => ({
  id,
  name,
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
  updatedAt: '2026-09-10T10:00:00.000Z',
  ownerBusiness: firstName ? { id: `user-${String(firstName).toLowerCase()}`, firstName, lastName } : null,
  ownerExecution: null,
}));

const MEMBERS = [
  { id: 'm-1', user_id: 'user-marek', first_name: 'Marek', last_name: 'Nowak', email: 'marek.nowak@dbr77.com' },
  { id: 'm-2', user_id: 'user-tomasz', first_name: 'Tomasz', last_name: 'Jankowski', email: 'tomasz.jankowski@dbr77.com' },
  { id: 'm-3', user_id: 'user-jan', first_name: 'Jan', last_name: 'Zieliński', email: 'jan.zielinski@dbr77.com' },
  { id: 'm-4', user_id: 'user-piotr', first_name: 'Piotr', last_name: 'Wiśniewski', email: 'piotr.wisniewski@dbr77.com' },
];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/runtime-v1/execution-cases')) return json({ cases: EXECUTION_CASES });
  if (url.includes(`/organizations/${ORG_ID}/members`)) return json(MEMBERS);
  if (/\/api\/initiatives(\?|$)/.test(url)) return json(INITIATIVES);
  if (url.startsWith('/api') || url.includes('/api/')) return json({ data: [] });
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

export default function K5NaprawyRealizacjaScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionHub initialTab={'list' as never} />
      </div>
    </AppProviders>
  );
}
