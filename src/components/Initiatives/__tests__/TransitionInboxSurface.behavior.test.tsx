/**
 * H1b — SKRZYNKA RECENZENTA: test RENDERU i PRZEWODU, nie obecności napisów.
 *
 * Broni czterech rzeczy, każdej z powodu:
 *  1. WIERSZ MÓWI, CO SIĘ ZMIENI — kolumna „Transition" pokazuje `z → do`.
 *     Skrzynka bez tej informacji zmusza recenzenta do klikania w każdy wiersz,
 *     żeby dowiedzieć się, o czym w ogóle decyduje.
 *  2. ZATWIERDŹ WOŁA ISTNIEJĄCY SILNIK — i przekazuje POWÓD wpisany w oknie.
 *     Powód nie jest ozdobą: `executeApprovedEarlyInitiativeTransition` wpisuje
 *     go do `rationale` kanonicznej, niezmienialnej decyzji bramkowej.
 *  3. ODRZUCENIE NIE WYKONUJE PRZEJŚCIA — zapisuje wyłącznie recenzję odmowną.
 *     Pomylenie tych dwóch ścieżek zmieniłoby „nie" w „tak".
 *  4. NIE-RECENZENT NIE MA CZYM KLIKNĄĆ — autor propozycji widzi wiersz (ślad),
 *     ale obie akcje są wyłączone; serwer i tak odmówi
 *     (`initiative_lifecycle_self_review_denied`), a interfejs nie ma prawa
 *     obiecywać czegoś, co na pewno się nie uda.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransitionProposal } from '@/services/initiativeTransitionInboxApi';

import { TransitionInboxSurface } from '../TransitionInboxSurface';

const approveMock = vi.fn(async () => ({}));
const rejectMock = vi.fn(async () => ({}));

vi.mock('@/services/initiativeTransitionInboxApi', () => ({
  listTransitionProposals: vi.fn(async () => []),
  listTransitionProposalsForInitiative: vi.fn(async () => []),
  approveTransitionProposal: (...args: unknown[]) => approveMock(...(args as [])),
  rejectTransitionProposal: (...args: unknown[]) => rejectMock(...(args as [])),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string, vars?: Record<string, unknown>) =>
      String(defaultValue ?? '').replace(/\{\{(\w+)\}\}/g, (_m, n) => String(vars?.[n] ?? '')),
    i18n: { language: 'en' },
  }),
}));

const proposal = (over: Partial<TransitionProposal> = {}): TransitionProposal => ({
  proposalVersionId: 'pv-1',
  proposalId: 't01-lifecycle:case-1:SCHEDULE_MILESTONES:pv-1',
  status: 'pending_review',
  initiativeId: 'ini-1',
  initiativeName: 'ERP rollout',
  initiativeStatus: 'APPROVED',
  transformationCaseId: 'case-1',
  fromStatus: 'APPROVED',
  toStatus: 'SCHEDULED',
  pmoDomain: 'SCHEDULE_MILESTONES',
  scopeKey: 'initiative_lifecycle:schedule_milestones',
  reason: 'Baseline locked with the sponsor.',
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

const mount = (rows: TransitionProposal[]) =>
  render(
    <MemoryRouter>
      <TransitionInboxSurface proposalsOverride={rows} />
    </MemoryRouter>
  );

const openPreview = async (label: string) => {
  fireEvent.click(screen.getByText(label));
  await waitFor(() => expect(screen.getByText('Why')).toBeTruthy());
};

const decide = async (button: 'Approve' | 'Reject with a reason', reason: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(button, 'i') }));
  const input = await screen.findByTestId('initiative-reason-input');
  fireEvent.change(input, { target: { value: reason } });
  fireEvent.click(screen.getByTestId('initiative-reason-confirm'));
};

beforeEach(() => {
  approveMock.mockClear();
  rejectMock.mockClear();
});

describe('H1b — skrzynka recenzenta przejść', () => {
  it('wiersz pokazuje przejście z→do, inicjatywę i proponującego', () => {
    mount([proposal()]);
    const row = screen.getByText('ERP rollout').closest('tr') as HTMLElement;
    /* [ODMROZENIE 05_INITIATIVES DEC-507] H1f: kanon §7.3 zakazuje surowych
       kodów UPPER_SNAKE na ekranie — `APPROVED`/`SCHEDULED` renderują się
       jako etykiety i18n (`initiativeStatusLabel`), kod surowy zostaje w
       `title` (asercja niżej). */
    expect(within(row).getByText('Approved → Scheduled')).toBeTruthy();
    expect(within(row).getByTitle('APPROVED → SCHEDULED')).toBeTruthy();
    expect(within(row).getByText('Katarzyna Wójcik')).toBeTruthy();
  });

  it('„Zatwierdź" woła istniejące wykonanie przejścia i niesie wpisany powód', async () => {
    mount([proposal()]);
    await openPreview('ERP rollout');
    await decide('Approve', 'Schedule baseline verified.');
    await waitFor(() => expect(approveMock).toHaveBeenCalledTimes(1));
    expect(approveMock.mock.calls[0][1]).toBe('Schedule baseline verified.');
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it('„Odrzuć z powodem" NIE wykonuje przejścia', async () => {
    mount([proposal()]);
    await openPreview('ERP rollout');
    await decide('Reject with a reason', 'Milestones are not signed off.');
    await waitFor(() => expect(rejectMock).toHaveBeenCalledTimes(1));
    expect(approveMock).not.toHaveBeenCalled();
  });

  it('autor propozycji widzi wiersz, ale obie akcje są wyłączone', async () => {
    mount([proposal({ viewerIsReviewer: false })]);
    await openPreview('ERP rollout');
    expect(screen.getByRole('button', { name: /Approve/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Reject with a reason/i })).toHaveProperty(
      'disabled',
      true
    );
  });
});
