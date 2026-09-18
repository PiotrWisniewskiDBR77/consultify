/**
 * W51 (DEC-612, wiersz 37, 17.09) — skrzynka „For approval"
 * (PRODUKCYJNY `TransitionInboxSurface`) z JEDNYM wierszem: propozycją
 * przejścia etapu zasianą przez seed demo-en do bazy `consultify_kopia_d3`
 * (09-dosiew-po-tescie.ts, blok DEC-612). Dane wiersza = DOKŁADNY odczyt
 * `GET /api/initiatives/lifecycle-transition-proposals?status=pending`
 * z 2026-09-18T00:03Z (count=1, viewerIsReviewer=true) — bez zmian.
 *
 * Złożona przez INNĄ osobę niż zatwierdzający: proponuje Laura Novak,
 * recenzentem jest James Whitfield (właściciel demo, zalogowany w harnessie
 * przez seedRealisticSession).
 *
 * Wzorzec mechaniczny: `h1b-skrzynka-przejsc.tsx` (proposalsOverride —
 * jedyne przeznaczone do tego wejście; harness nie podszywa się pod fetch).
 *
 * Wymaga serwera dev-render z VITE_TRANSITION_INBOX=true (flaga zakładki
 * w `InitiativesHub`; sam surface montowany bezpośrednio, jak w H1b).
 *
 * Query: &lang=en &theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { TransitionInboxSurface } from '../../src/components/Initiatives/TransitionInboxSurface';
import type { TransitionProposal } from '../../src/services/initiativeTransitionInboxApi';

// Odczyt API z bazy consultify_kopia_d3 (2026-09-18T00:03Z), 1:1.
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

const W51Dec612SkrzynkaScreen: React.FC = () => {
  /* `TableWithPreviewLayout` czyta adres (`useJedenPanel` → `useLocation`),
     więc potrzebuje routera — w aplikacji daje go powłoka. */
  return (
    <MemoryRouter initialEntries={['/initiatives?tab=transitionInbox']}>
      <div className="h-screen bg-c-surface p-4" data-testid="w51-dec612-skrzynka">
        <TransitionInboxSurface proposalsOverride={[SEEDED_PROPOSAL]} />
      </div>
    </MemoryRouter>
  );
};

export default W51Dec612SkrzynkaScreen;
