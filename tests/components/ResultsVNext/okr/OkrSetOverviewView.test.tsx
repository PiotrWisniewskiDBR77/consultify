/**
 * @vitest-environment jsdom
 *
 * RN-G6 lane `okrtext` (2026-08-12) — regression coverage for two
 * user-visible copy defects on `OkrSetOverviewView.tsx`'s lifecycle footer,
 * found in a real render (not from reading the diff):
 *
 *  - Defect 1: the "how gating works" footer note under the lifecycle
 *    action buttons used to read (PL) "...patrz cytaty plik:linia w
 *    okrWorkspaceMappers.ts." / (EN) "...see file:line citations in
 *    okrWorkspaceMappers.ts." — a developer note (source filename) leaked
 *    into client-facing copy. Fixed by dropping the file reference and
 *    keeping only the user-meaningful half of the sentence (gating mirrors
 *    a server rule).
 *  - Defect 2: `okrWorkspaceMappers.ts`'s `reasonWrongStatus()` (and
 *    `gateApprove`'s self-approval-denial branch) already bake the action
 *    name into the returned `{pl,en}` reason text (e.g. "Approve: requires
 *    status submitted..."). The view ALSO prefixed the button's own label
 *    when rendering the reason list (`{a.label}: {gate.pl}`), producing a
 *    doubled prefix — "Approve: Approve: requires status submitted...".
 *    `title` (the button's hover tooltip) never double-prefixed — it was
 *    always `gate.pl`/`gate.en` alone — proving the mapper already owns the
 *    prefix; the view's extra prefix in the reason-list paragraph was the
 *    bug. Fixed by rendering the bare gate text there too (matching
 *    `title`, and matching the sibling `OkrReviewReflectionView.tsx`'s own
 *    gate-paragraph convention, which never added a second prefix).
 *
 * This is a pure-prop component (no fetch on initial render — actions are
 * only invoked on click), so no network mocking is needed for these
 * assertions.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OkrSetOverviewView } from '@/components/ResultsVNext/okr/OkrSetOverviewView';
import type { OkrSetDto } from '@/components/ResultsVNext/okr/okrApi';

function makeSet(overrides: Partial<OkrSetDto> = {}): OkrSetDto {
  return {
    setId: 'set-1',
    organizationId: 'org-1',
    programId: 'program-1',
    cycleId: 'cycle-1',
    scopeType: 'individual',
    scopeId: 'user-owner',
    ownerUserId: 'user-owner',
    reviewerUserId: 'user-reviewer',
    title: 'Test set',
    // `draft` leaves submit/cancel allowed and approve/requestChanges/
    // activate/openReview all blocked on a wrong-status gate — enough
    // simultaneous blocked actions to prove defect 2 isn't approve-only.
    status: 'draft',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 1,
    createdBy: 'user-owner',
    createdAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderOverview(isPolish: boolean) {
  return render(
    <OkrSetOverviewView
      set={makeSet()}
      isPolish={isPolish}
      currentUserId="user-someone-else"
      onSetChanged={() => undefined}
    />
  );
}

describe('OkrSetOverviewView — defect 1: no source-file leak in the lifecycle footer note', () => {
  it('PL: footer note has no source-file reference', () => {
    const { container } = renderOverview(true);
    const text = container.textContent ?? '';
    expect(text).not.toContain('okrWorkspaceMappers.ts');
    expect(text).not.toMatch(/plik:linia/i);
    // Still says SOMETHING meaningful — this isn't a test that the note
    // was blanked out, only that the dev citation is gone.
    expect(text).toMatch(/serwer/i);
  });

  it('EN: footer note has no source-file reference', () => {
    const { container } = renderOverview(false);
    const text = container.textContent ?? '';
    expect(text).not.toContain('okrWorkspaceMappers.ts');
    expect(text).not.toMatch(/file:line/i);
    expect(text).toMatch(/server/i);
  });
});

describe('OkrSetOverviewView — defect 2: gate reason prefix appears exactly once per action', () => {
  it('PL: approve/request-changes/activate/open-review reasons are not double-prefixed', () => {
    const { container } = renderOverview(true);
    const text = container.textContent ?? '';

    // The bug produced "Zaakceptuj: Akceptacja: wymaga..." — the button's
    // own label glued in front of the mapper's already-prefixed text.
    expect(text).not.toMatch(/Zaakceptuj:\s*Akceptacja:/);
    expect(text).not.toMatch(/Żądaj poprawek:\s*Żądanie poprawek:/);
    expect(text).not.toMatch(/Aktywuj:\s*Aktywacja:/);
    expect(text).not.toMatch(/Otwórz przegląd:\s*Otwarcie przeglądu:/);

    // The mapper's own single prefix must still be there (not stripped to
    // nothing — the fix relocates ownership, it doesn't delete the label).
    expect(text).toContain('Akceptacja: wymaga statusu');
    expect(text).toContain('Aktywacja: wymaga statusu');
    expect(text).toContain('Otwarcie przeglądu: wymaga statusu');
  });

  it('EN: approve/request-changes/activate/open-review reasons are not double-prefixed', () => {
    const { container } = renderOverview(false);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/Approve:\s*Approve:/);
    expect(text).not.toMatch(/Request changes:\s*Request changes:/);
    expect(text).not.toMatch(/Activate:\s*Activate:/);
    expect(text).not.toMatch(/Open review:\s*Open review:/);

    expect(text).toContain('Approve: requires status');
    expect(text).toContain('Activate: requires status');
    expect(text).toContain('Open review: requires status');
  });

  it('PL: the self-approval-denial gate text (a non-reasonWrongStatus gate) is also single-prefixed', () => {
    // `submitted` + actor === submittedBy triggers `gateApprove`'s custom
    // self-denial branch (not `reasonWrongStatus`) — a second code path in
    // the mapper that also bakes in its own "Akceptacja:" prefix.
    const { container } = render(
      <OkrSetOverviewView
        set={makeSet({ status: 'submitted', submittedBy: 'user-someone-else' })}
        isPolish
        currentUserId="user-someone-else"
        onSetChanged={() => undefined}
      />
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Zaakceptuj:\s*Akceptacja:/);
    expect(text).toContain('Akceptacja: autor złożenia nie może zaakceptować własnego zestawu');
  });
});
