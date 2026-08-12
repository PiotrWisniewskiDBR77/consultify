/**
 * @vitest-environment jsdom
 *
 * ★ Gate E FIXA — DEFEKT 2: `FinanceStatusAnnouncer`'s `role="status"` in
 * `FinanceCommentsPanel`/`FinanceSavedViewsPanel` (same defect, same fix
 * shape applied to `FinanceComparePanel`/`FinanceLineageNavigator`) was NOT
 * a single, persistently-mounted live region whose TEXT mutates — it was
 * re-created from scratch every time the panel transitioned through its
 * `loading` state, because `loading`/`error` returned one JSX ROOT
 * (`<>...</>`) while `loaded` returned a DIFFERENT root
 * (`<div data-testid="...">`). React unmounts the whole previous subtree
 * (including the announcer) whenever the root element TYPE changes between
 * renders at that tree position, and mounts a brand-new node for the next
 * state — so screen readers relying on an EXISTING node's `characterData`
 * mutating (the only reliable live-region announcement mechanism across
 * NVDA/JAWS/VoiceOver) may never fire.
 *
 * A plain `toHaveTextContent()` assertion CANNOT tell the two cases apart —
 * `screen.getByTestId(...)` re-queries the DOM by testid every time, so it
 * finds the right text whether it's the SAME node mutated or a brand NEW
 * node inserted elsewhere carrying the same testid. This suite proves the
 * distinction the only way that actually matters: capture the announcer
 * node BEFORE the action, attach a `MutationObserver` to THAT exact node,
 * force the intermediate `loading` state to actually commit (held open with
 * a manually-controlled promise — an instantly-resolving mock races through
 * `loading` inside one React 18 batch and never gives it its own commit,
 * which produced a FALSE NEGATIVE the first time this suite was written),
 * inspect the DOM while `loading` is showing, then release and settle.
 *   - Defect present: mid-`loading`, `getByTestId('finance-status-announcer')`
 *     is a DIFFERENT node object than the one captured before the click —
 *     the old node was abandoned by an unmount, a new one was inserted.
 *   - Fixed: it is the SAME node object throughout, and the observer
 *     attached to it recorded a real `characterData` mutation.
 *
 * This exact asymmetry is the empirical reproduction from the verifier's own
 * measurement: "Oznacz jako rozwiązany" (goes through `loading`) → 0
 * mutations under the defect; "Kopiuj link" (never leaves `loaded`, so was
 * never actually broken) → real `characterData` mutation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockListFinanceComments = vi.fn();
const mockListFinanceReviewChecklist = vi.fn();
const mockHasUnresolvedBlocking = vi.fn();
const mockResolveFinanceComment = vi.fn();
const mockListFinanceSavedViews = vi.fn();
const mockDeleteFinanceSavedView = vi.fn();

// Single `vi.mock` for the whole file — vitest hoists `vi.mock` calls to the
// top of the module, so more than one call for the SAME module path would
// silently shadow each other. Both panels under test share this one mock.
vi.mock('@/services/api/financeV2.api', () => ({
  listFinanceComments: (...args: unknown[]) => mockListFinanceComments(...args),
  listFinanceReviewChecklist: (...args: unknown[]) => mockListFinanceReviewChecklist(...args),
  hasUnresolvedBlockingFinanceComments: (...args: unknown[]) => mockHasUnresolvedBlocking(...args),
  createFinanceComment: vi.fn(),
  resolveFinanceComment: (...args: unknown[]) => mockResolveFinanceComment(...args),
  reopenFinanceComment: vi.fn(),
  addFinanceReviewChecklistItem: vi.fn(),
  checkFinanceReviewChecklistItem: vi.fn(),
  uncheckFinanceReviewChecklistItem: vi.fn(),
  listFinanceSavedViews: (...args: unknown[]) => mockListFinanceSavedViews(...args),
  createFinanceSavedView: vi.fn(),
  deleteFinanceSavedView: (...args: unknown[]) => mockDeleteFinanceSavedView(...args),
}));

import { emptyGridViewStateSnapshot } from '@/services/api/financeV2.types';

import { FinanceCommentsPanel } from '../../comments/FinanceCommentsPanel';
import { FinanceSavedViewsPanel } from '../../savedViews/FinanceSavedViewsPanel';

const SAMPLE_COMMENT = {
  id: 'c-1',
  artifactId: 'art-1',
  businessVersionId: 'bv-1',
  anchor: null,
  authorId: 'u-1',
  body: 'Sprawdź linię COGS',
  mentions: [] as string[],
  isBlocking: false,
  resolvedBy: null,
  resolvedAt: null,
  createdBy: 'u-1',
  createdAt: 't',
  updatedAt: 't',
};

function sampleView(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'view-1',
    artifactId: 'art-1',
    artifactType: 'HISTORICAL_ANALYSIS',
    scope: 'PERSONAL',
    ownerUserId: 'u-1',
    name: 'Mój widok kwartalny',
    viewState: { schemaVersion: 1, gridViewState: emptyGridViewStateSnapshot(), filters: [] },
    shareToken: 'tok-1',
    createdBy: 'u-1',
    createdAt: 't',
    updatedAt: 't',
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  for (const m of [
    mockListFinanceComments,
    mockListFinanceReviewChecklist,
    mockHasUnresolvedBlocking,
    mockResolveFinanceComment,
    mockListFinanceSavedViews,
    mockDeleteFinanceSavedView,
  ]) {
    m.mockReset();
  }
});
afterEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('FinanceStatusAnnouncer — MutationObserver proof (Gate E FIXA, defekt 2)', () => {
  it('FinanceCommentsPanel: "Oznacz jako rozwiązany" MUTATES the existing role="status" node, never remounts it', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeCommentsV1: true }));

    mockListFinanceComments.mockResolvedValueOnce([SAMPLE_COMMENT]);
    mockListFinanceReviewChecklist.mockResolvedValueOnce([]);
    mockHasUnresolvedBlocking.mockResolvedValueOnce({ hasUnresolvedBlockingComments: false });
    mockResolveFinanceComment.mockResolvedValueOnce(undefined);

    // The `load()` re-fetch triggered by `handleResolve` is held open with
    // manually-controlled promises — an instantly-resolving mock lets React
    // 18 batch straight through the intermediate `loading` render inside a
    // single commit, which never actually mounts/unmounts anything and would
    // make this test pass EVEN AGAINST THE UNFIXED CODE (verified by hand:
    // first draft of this test used `mockResolvedValueOnce` and produced a
    // false negative — negative control did not go red). Holding the
    // promises open forces `loading` to genuinely commit, so this test
    // actually exercises the unmount/remount the fix addresses.
    let releaseComments!: (v: unknown[]) => void;
    let releaseChecklist!: (v: unknown[]) => void;
    let releaseBlocking!: (v: { hasUnresolvedBlockingComments: boolean }) => void;
    mockListFinanceComments.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseComments = resolve;
      })
    );
    mockListFinanceReviewChecklist.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseChecklist = resolve;
      })
    );
    mockHasUnresolvedBlocking.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseBlocking = resolve;
      })
    );

    render(<FinanceCommentsPanel artifactId="art-1" businessVersionId="bv-1" />);
    await screen.findByTestId('finance-comments-panel');

    const announcerBefore = screen.getByTestId('finance-status-announcer');
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    // Observe the node CAPTURED NOW — if this exact node gets unmounted and a
    // structurally-similar replacement appears elsewhere, THIS observer sees
    // nothing (it is watching an abandoned node), which is precisely the
    // distinction a plain text-content assertion cannot make.
    observer.observe(announcerBefore, { characterData: true, childList: true, subtree: true });

    fireEvent.click(screen.getByText('Oznacz jako rozwiązany'));

    // Force the intermediate `loading` state to actually commit and be
    // inspectable before moving on.
    await waitFor(() => expect(screen.getByTestId('comments-panel-loading')).toBeInTheDocument());
    // ★ The core assertion: mid-flight, while `loading` is genuinely showing,
    // is the announcer STILL the exact node object captured before the click?
    expect(screen.getByTestId('finance-status-announcer')).toBe(announcerBefore);

    releaseComments([{ ...SAMPLE_COMMENT, resolvedAt: 't', resolvedBy: 'u-2' }]);
    releaseChecklist([]);
    releaseBlocking({ hasUnresolvedBlockingComments: false });

    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Komentarz oznaczony jako rozwiązany.'));
    observer.disconnect();

    // The node currently bearing the testid must STILL be the SAME node
    // instance we captured before the click — proof React reused it
    // (updated props/text) instead of tearing down and remounting new ones
    // for `loading` and then again for `loaded`.
    expect(screen.getByTestId('finance-status-announcer')).toBe(announcerBefore);
    // And the observer attached to that exact node must have actually fired —
    // this is the real MutationObserver evidence, not just a content check.
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((r) => r.type === 'characterData')).toBe(true);
  });
});

describe('FinanceStatusAnnouncer — MutationObserver proof (Gate E FIXA, defekt 2), SavedViews', () => {
  it('FinanceSavedViewsPanel: "Usuń" (goes through loading) MUTATES the existing role="status" node, never remounts it', async () => {
    window.localStorage.setItem('consultify_feature_flags', JSON.stringify({ financeSavedViewsV1: true }));

    mockListFinanceSavedViews.mockResolvedValueOnce([sampleView()]);
    mockDeleteFinanceSavedView.mockResolvedValueOnce(undefined);

    let releaseViews!: (v: unknown[]) => void;
    mockListFinanceSavedViews.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseViews = resolve;
      })
    );

    render(<FinanceSavedViewsPanel artifactId="art-1" />);
    await screen.findByTestId('finance-saved-views-panel');

    const announcerBefore = screen.getByTestId('finance-status-announcer');
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((list) => records.push(...list));
    observer.observe(announcerBefore, { characterData: true, childList: true, subtree: true });

    fireEvent.click(screen.getByTestId('saved-view-delete'));

    await waitFor(() => expect(screen.getByTestId('saved-views-panel-loading')).toBeInTheDocument());
    expect(screen.getByTestId('finance-status-announcer')).toBe(announcerBefore);

    releaseViews([]);

    await waitFor(() => expect(screen.getByTestId('finance-status-announcer')).toHaveTextContent('Widok usunięty.'));
    observer.disconnect();

    expect(screen.getByTestId('finance-status-announcer')).toBe(announcerBefore);
    expect(records.length).toBeGreaterThan(0);
    expect(records.some((r) => r.type === 'characterData')).toBe(true);
  });
});
