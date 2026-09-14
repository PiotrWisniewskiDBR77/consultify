/**
 * Z-27 (14.09) — REALNY <InitiativesHub> (Menu 1/2/3 w komplecie) z aktywną
 * zakładką Menu 1 „Do akceptacji" (`TransitionInboxSurface`).
 *
 * CLAUDE.md §7: właściciel NIGDY nie jest pierwszym testerem wizualnym. Ten
 * ekran montuje CAŁĄ powłokę modułu Inicjatywy — nie sam `TransitionInboxSurface`
 * (to już pokazuje `h1b-skrzynka-przejsc.tsx`) — żeby zrzut dowodził, że
 * zakładka żyje WEWNĄTRZ prawdziwego Menu 1 (obok „Initiatives"/„Plan"/„Load"),
 * z prawdziwym Menu 2/3 nad nią, a nie w oderwanej kompozycji.
 *
 * Wzorzec danych 1:1 z `f2-inicjatywy-analiza.tsx` i `dec495-inicjatywy-archiwum.tsx`:
 * `seedRealisticSession()` + wyłączenie `isDemoMode` W STORZE i w localStorage
 * (sam zapis do localStorage NIE wystarcza — zustand `persist` nadpisuje go po
 * ~300 ms i rejestr po cichu wraca na wbudowane dane demo, patrz komentarz w
 * `dec495-inicjatywy-archiwum.tsx`).
 *
 * Zakładka „Do akceptacji" istnieje w Menu 1 TYLKO przy
 * `VITE_TRANSITION_INBOX=true` (patrz `InitiativesHub.tsx` — `TRANSITION_INBOX_ENABLED`).
 * To jest flaga ODCZYTYWANA W BUDOWIE (import.meta.env), więc harness NIE
 * potrafi jej przełączyć przez URL — trzeba uruchomić serwer dev-render z tą
 * zmienną env ustawioną (parytet OFF = osobne uruchomienie serwera bez niej):
 *
 *   VITE_TRANSITION_INBOX=true VITE_INITIATIVES_FOUR_BUTTONS=true \
 *     npx vite --config dev-render/vite.config.ts --port <PORT> --strictPort
 *
 * Atrapa `/api/initiatives/lifecycle-transition-proposals` zwraca 2 propozycje
 * w kształcie z `TransitionInboxSurface.behavior.test.tsx` / `h1b-skrzynka-przejsc.tsx`
 * (jeden „ERP rollout — phase 2", jeden „Warehouse automation pilot").
 *
 * Query:
 *   &tab=transitionInbox  — wymagane, żeby Menu 1 od razu otworzyło zakładkę
 *   &lang=pl|en &theme=light|dark  — jak wszędzie w harnessie
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import type { TransitionProposal } from '../../src/services/initiativeTransitionInboxApi';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// Patrz `dec495-inicjatywy-archiwum.tsx`: sam localStorage nie wystarcza, bo
// zustand persist nadpisuje go po ~300 ms i rejestr po cichu wraca na demo.
useAppStore.setState({ isDemoMode: false });
try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // brak localStorage nie powinien wywalic harnessu
}

const proposal = (over: Partial<TransitionProposal>): TransitionProposal => ({
  proposalVersionId: 'pv-1',
  proposalId: 't01-lifecycle:case-1:SCHEDULE_MILESTONES:pv-1',
  status: 'pending_review',
  initiativeId: 'ini-1',
  initiativeName: 'ERP rollout — phase 2 (finance close)',
  initiativeStatus: 'APPROVED',
  transformationCaseId: 'case-1',
  fromStatus: 'APPROVED',
  toStatus: 'SCHEDULED',
  pmoDomain: 'SCHEDULE_MILESTONES',
  scopeKey: 'initiative_lifecycle:schedule_milestones',
  reason:
    'Milestones are locked against the signed schedule baseline and the sponsor confirmed the November window in writing.',
  proposerUserId: 'u-1',
  proposerName: 'Katarzyna Wójcik',
  createdAt: '2026-09-12T09:30:00.000Z',
  expiresAt: '2026-09-19T09:30:00.000Z',
  reviewDecision: null,
  reviewedAt: null,
  reviewedByUserId: null,
  viewerIsReviewer: true,
  executable: false,
  ...over,
});

const PROPOSALS: TransitionProposal[] = [
  proposal({}),
  proposal({
    proposalVersionId: 'pv-2',
    proposalId: 't01-lifecycle:case-2:GOVERNANCE_DECISION_MAKING:pv-2',
    initiativeId: 'ini-2',
    initiativeName: 'Warehouse automation pilot',
    initiativeStatus: 'SCHEDULED',
    fromStatus: 'SCHEDULED',
    toStatus: 'EXECUTING',
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
    scopeKey: 'initiative_lifecycle:governance_decision_making',
    reason: 'Both picking lanes passed the acceptance run; the team and funding are in place.',
    proposerUserId: 'u-2',
    proposerName: 'Tomasz Nowak',
    createdAt: '2026-09-13T14:05:00.000Z',
    expiresAt: '2026-09-20T14:05:00.000Z',
  }),
];

// Rejestr (Menu 1 „Initiatives") — kilka wierszy, żeby pozostałe zakładki nie
// pokazywały pustego stanu w tle (Menu 1 renderuje tylko jedną naraz, ale
// `fetchData` woła rejestr bezwarunkowo przy montowaniu, niezależnie od
// aktywnej zakładki — patrz `InitiativesHub.tsx` linia 801).
const REGISTER_ROWS = [
  {
    id: 'ini-1',
    organizationId: 'org-z27',
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
    organizationId: 'org-z27',
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
  if (url.includes('/api/initiatives/lifecycle-transition-proposals')) {
    return json({ proposals: PROPOSALS });
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

export default function Z27InicjatywySkrzynkaScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="z27-inicjatywy-skrzynka">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
