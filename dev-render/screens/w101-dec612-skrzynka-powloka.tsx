/**
 * W101 (DEC-612, P2 pkt 3, 17.09) — skrzynka „For approval" w REALNEJ powłoce.
 *
 * `w51-dec612-skrzynka.tsx` montował sam `TransitionInboxSurface` w `MemoryRouter`
 * (goła powierzchnia — CTO odrzucił ten zrzut). Użytkownik widzi tę skrzynkę
 * jako zakładkę Menu 1 „Do akceptacji" w `InitiativesHub`
 * (`src/components/Initiatives/InitiativesHub.tsx:2106` — jedyny wołacz
 * produkcyjny w `src/`; plik Codexa-1, więc montujemy go w harnessie BEZ edycji).
 *
 * Wzorzec mechaniczny: `z27-inicjatywy-skrzynka.tsx` (realny Hub + atrapa fetch).
 * Dane wiersza: DOKŁADNY odczyt `GET /api/initiatives/lifecycle-transition-proposals
 * ?status=pending` z bazy `consultify_kopia_d3` (2026-09-18T00:03Z, count=1) —
 * ten sam zestaw co w `w51-dec612-skrzynka.tsx`, bez zmian: proponuje Laura Novak,
 * recenzentem jest James Whitfield (zalogowany przez `seedRealisticSession`).
 *
 * Wymaga serwera dev-render z flagami zakładki:
 *   VITE_TRANSITION_INBOX=true VITE_INITIATIVES_FOUR_BUTTONS=true \
 *     npx vite --config dev-render/vite.config.ts --port <PORT> --strictPort
 *
 * Query: &tab=transitionInbox &lang=en &theme=light|dark
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

// Odczyt API z bazy consultify_kopia_d3 (2026-09-18T00:03Z), 1:1 — JEDEN wiersz,
// bo seed demo-en (DEC-612) daje dokładnie jedną propozycję pending.
const SEEDED_PROPOSAL: TransitionProposal = {
  proposalVersionId: 'pv-seed-dec612-nw-001',
  proposalId: 't01-lifecycle:dec612-nw:CLOSURE:pv-seed-dec612-nw-001',
  status: 'pending_review',
  initiativeId: 'd06a7a14-afe8-559e-a8ef-1ab7606e1c7c',
  initiativeName: 'MES Rollout Line 3',
  initiativeStatus: 'IN_EXECUTION',
  transformationCaseId: 'dec612-nw-case',
  fromStatus: 'EXECUTING',
  toStatus: 'DONE',
  pmoDomain: 'CLOSURE',
  scopeKey: 'initiative_lifecycle:closure',
  reason:
    'Line 3 MES rollout passed its last quality gate; closure review moves benefit tracking to finance ownership.',
  proposerUserId: '78b08b13-887e-5446-b80c-8647d3fc9e0f',
  proposerName: 'Laura Novak',
  createdAt: '2026-09-17T23:54:04.793Z',
  expiresAt: '2027-09-17T23:54:04.793Z',
  reviewDecision: null,
  reviewedAt: null,
  reviewedByUserId: null,
  viewerIsReviewer: true,
  executable: false,
};

const PROPOSALS: TransitionProposal[] = [SEEDED_PROPOSAL];

// Rejestr (Menu 1 „Initiatives") — inicjatywa z propozycji plus sąsiad z seeda,
// żeby pozostałe zakładki nie świeciły pustym stanem w tle (`InitiativesHub`
// woła rejestr bezwarunkowo przy montowaniu, niezależnie od aktywnej zakładki).
const REGISTER_ROWS = [
  {
    id: 'd06a7a14-afe8-559e-a8ef-1ab7606e1c7c',
    organizationId: 'org-northwind',
    name: 'MES Rollout Line 3',
    title: 'MES Rollout Line 3',
    summary: 'Manufacturing execution system rollout across line 3.',
    status: 'IN_EXECUTION',
    archived: false,
    onHold: false,
    priority: 'HIGH',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-09-17T23:54:04.793Z',
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
    return json({ canUpdate: true, canReview: true, canSelfApprove: false });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    return json(REGISTER_ROWS);
  }
  return originalFetch(input, init);
};

export default function W101Dec612SkrzynkaPowlokaScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="w101-dec612-skrzynka-powloka">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
