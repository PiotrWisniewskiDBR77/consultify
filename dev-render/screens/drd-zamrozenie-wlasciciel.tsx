/**
 * DEV-RENDER — REALNY `<DrdHttpMethodWorkspaceScreen>` w stanie „sesja do
 * przeglądu": przycisk „Zamroź" dla właściciela ORGANIZACJI (blokada odbioru
 * 05.09, naprawa z 05.09).
 *
 * PO CO TEN EKRAN. Do 05.09 warunek widoczności przycisku brzmiał
 * `state.roles.includes('approver')`, a roli `approver` nie ma w tej
 * aplikacji jak nadać (endpoint istnieje, ekranu nie ma; samo-nadanie jest
 * odmawiane). W organizacji z jednym kontem przycisk był wyłączony na
 * zawsze, a razem z nim Output, raport z oceny i prezentacja z oceny.
 *
 * DLACZEGO HARNESS (uczciwie): ta ścieżka jest w całości serwerowa
 * (`POST /api/method/sessions/:id/freeze`), a lokalny frontend chodzi na
 * proxy do backendu STAGINGU, gdzie naprawy jeszcze nie ma; backendu nie da
 * się uruchomić lokalnie (`databaseTargetResolver.ts` odrzuca lokalny
 * DATABASE_URL poza testami). Ten harness mountuje więc PRAWDZIWY komponent
 * i podmienia wyłącznie warstwę HTTP — pokazuje stan przycisku, nie
 * zachowanie serwera (to drugie dowodzi
 * `server/src/method-core/__tests__/ownerFreeze.http.pg.test.ts` na realnym
 * Postgresie).
 *
 * Parametry URL:
 *   ?screen=drd-zamrozenie-wlasciciel
 *   &rola=owner|czlonek   (default owner) — właściciel organizacji vs zwykły
 *                          członek; oba BEZ procesowej roli `approver`
 */
import React from 'react';

import { DrdHttpMethodWorkspaceScreen } from '../../src/components/assessment/drd/DrdHttpMethodWorkspaceScreen';
import { useAppStore } from '../../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const rola = params.get('rola') === 'czlonek' ? 'czlonek' : 'owner';

useAppStore.setState({
  currentUser: {
    id: 'user-piotr-demo',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
    role: rola === 'owner' ? 'OWNER' : 'MEMBER',
  },
  currentOrganization: { id: 'org-dbr77-demo', name: 'DBR77' },
} as never);

const SESSION_ID = 'sesja-drd-blokada-20260905';
const ORG_ID = 'org-dbr77-demo';
const NOW = '2026-09-05T08:00:00.000Z';

const SESJA = {
  id: SESSION_ID,
  organizationId: ORG_ID,
  projectId: null,
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: 'v1',
  state: 'in_review',
  domainStage: null,
  mode: 'guided_manual',
  ownerUserId: 'user-piotr-demo',
  createdAt: NOW,
  updatedAt: NOW,
  version: 4,
  frozenSnapshotId: null,
  revisionOfSessionId: null,
};

const zdarzenie = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  organizationId: ORG_ID,
  sessionId: SESSION_ID,
  actorKind: 'human',
  actorUserId: 'user-piotr-demo',
  methodPackVersion: 'v1',
  occurredAt: NOW,
  payload: {},
  ...extra,
});

const ZDARZENIA = [
  zdarzenie('ev-1', 'EVIDENCE_ATTACHED', {
    unitId: '1A',
    payload: { evidenceId: 'ev-crm-01', evidenceType: 'document', strength: 'E2' },
  }),
  zdarzenie('ev-2', 'ANSWER_CONFIRMED', {
    unitId: '1A',
    level: 3,
    payload: { questionId: '1A-L3-Q1', answerState: 'confirmed' },
  }),
];

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes(`/api/method/sessions/${SESSION_ID}/events`)) return json({ events: ZDARZENIA });
  if (url.includes(`/api/method/sessions/${SESSION_ID}`)) {
    // Role PROCESOWE: właściciel sesji + wiodący asesor. Świadomie BEZ
    // `approver` — to jest dokładnie ta obsada, która blokowała zamrożenie.
    return json({ session: SESJA, roles: ['owner', 'lead_assessor'] });
  }
  if (url.includes('/api/method/outputs')) return json({ outputs: [] });
  return realFetch(input as RequestInfo, init);
}) as typeof window.fetch;

const DrdZamrozenieWlascicielScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <DrdHttpMethodWorkspaceScreen demoSessionId={SESSION_ID} />
  </div>
);

export default DrdZamrozenieWlascicielScreen;
