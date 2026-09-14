/**
 * Dev-render: U2 (DEC-491 §2.7) — podgląd DECYZJI w powłoce Realizacji, po
 * usunięciu tekstowego „What's next".
 *
 * PO CO (CLAUDE.md #7 — Piotr nigdy nie jest pierwszym testerem wizualnym):
 * właściciel zgłosił ze stagingu „«What's next» tekstowe w podglądzie
 * Decisions" — ramkę z nagłówkiem WHAT'S NEXT, zerem przycisków w środku i
 * szarym dopiskiem 10 px pod spodem. `TABLE_AND_PREVIEW_CANON.md` §7.3 pkt 4.4
 * („Reguła strefy «Co dalej»") mówi: strefa jest create-stripem i należy się
 * WYŁĄCZNIE encji z zaimplementowaną konwersją na artefakt innego modułu, a
 * „encja bez konwersji: strefa NIEOBECNA, nie pusta". Decyzja konwersji nie ma
 * (tabela zakładek w tej samej sekcji: Decisions → „✖ brak konwersji").
 *
 * Ten ekran montuje PRODUKT — `ExecutionHub initialTab="control"` →
 * `ExecutionControlSurface` → `StandardPreview` — na trzech wierszach, które
 * pokazują wszystkie gałęzie zdania „następnego kroku" z tego podglądu:
 *
 *   · „Choose the canonical demand forecast source" — decyzja PO TERMINIE
 *     (zdanie „Overdue by … days — resolve or escalate.");
 *   · „Approve the two-supplier fallback" — decyzja W TERMINIE
 *     (zdanie „The due date hasn't passed yet.");
 *   · „Vendor lock-in on the audit toolchain" — pozycja RAID (rodzeństwo tej
 *     samej deklaracji podglądu; zdanie o terminie pozycji).
 *
 * Zdanie NIE ZNIKA — stoi jako ostatnie zdanie prozy bloku 3, dokładnie tak
 * jak w banku Realizacji przyjętym przez właściciela (K5-4).
 *
 * Dane idą przez stub `window.fetch` (tylko odczyt, zero zapisów).
 * `&lang=en` — oprogramowanie jest po angielsku (DEC-461); `&lang=pl` pokazuje
 * ten sam ekran po polsku.
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
  {
    id: 'dec-supplier-fallback',
    title: 'Approve the two-supplier fallback',
    status: 'pending',
    dueDate: '2026-12-18T00:00:00.000Z',
    decisionMakerId: 'user-anna',
    initiativeId: 'init-security',
    description:
      'The audit toolchain sits with one vendor; a second supplier removes the single point of failure.',
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

export default function U2RealizacjaDecyzjeScreen() {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }}>
        <ExecutionHub initialTab={'control' as never} />
      </div>
    </AppProviders>
  );
}
