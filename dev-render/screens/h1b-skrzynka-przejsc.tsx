/**
 * H1b — harness odbiorowy SKRZYNKI RECENZENTA (Inicjatywy → „Do akceptacji").
 *
 * CLAUDE.md §7: właściciel NIGDY nie jest pierwszym testerem wizualnym.
 * Ten ekran montuje PRODUKCYJNY `TransitionInboxSurface` — a w nim realny
 * `StandardTable`, realny `TableWithPreviewLayout` i realny `StandardPreview`.
 * To nie jest kopia wyglądu: gdyby kolumna, pastylka albo kolejność bloków
 * podglądu były zepsute, zepsują się TUTAJ, na zrzucie, a nie u właściciela.
 *
 * Dane wstrzykiwane są jedynym przeznaczonym do tego wejściem
 * (`proposalsOverride`) — harness nie podszywa się pod `fetch`, więc zrzut
 * pokazuje tę samą ścieżkę renderu co aplikacja po odpowiedzi serwera.
 *
 * URL:
 *   &lang=pl|en &theme=light|dark  — jak wszędzie w harnessie
 *   &case=empty                    — pusty stan skrzynki („nic do zatwierdzenia")
 *   &case=off                      — PARYTET: flaga `VITE_TRANSITION_INBOX`
 *                                    wyłączona, czyli ekranu nie ma wcale
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { TransitionInboxSurface } from '../../src/components/Initiatives/TransitionInboxSurface';
import type { TransitionProposal } from '../../src/services/initiativeTransitionInboxApi';

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

const ROWS: TransitionProposal[] = [
  proposal({}),
  proposal({
    proposalVersionId: 'pv-2',
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

const H1bSkrzynkaPrzejscScreen: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const variant = params.get('case') || 'default';

  /* PARYTET: przy fladze OFF `InitiativesHub` nie rejestruje ani zakładki
     „Do akceptacji", ani jej adresu — użytkownik nie ma jak tu trafić.
     Harness pokazuje ten stan wprost, żeby zrzut OFF dowodził braku, a nie
     tylko go sugerował. */
  if (variant === 'off') {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center text-sm text-c-text-muted">
        VITE_TRANSITION_INBOX=OFF — zakładka „Do akceptacji" nie istnieje w Menu 1 Inicjatyw.
      </div>
    );
  }

  /* `TableWithPreviewLayout` czyta adres (`useJedenPanel` → `useLocation`),
     więc potrzebuje routera — w aplikacji daje go powłoka. */
  return (
    <MemoryRouter initialEntries={['/initiatives?tab=transitionInbox']}>
      <div className="h-screen bg-c-surface p-4">
        <TransitionInboxSurface proposalsOverride={variant === 'empty' ? [] : ROWS} />
      </div>
    </MemoryRouter>
  );
};

export default H1bSkrzynkaPrzejscScreen;
