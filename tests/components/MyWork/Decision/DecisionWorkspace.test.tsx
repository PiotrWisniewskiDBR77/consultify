/**
 * MW-DEC-001 — DecisionWorkspace core lifecycle tests.
 *
 * Real-mounts the actual `DecisionWorkspace` component tree (header, decide
 * bar, alternatives/risks sections, comments, audit trail). The ONLY thing
 * mocked is the HTTP boundary (`Api.get/post/put/delete/getUsers` from
 * `@/services/api`) — everything else (ConfirmDialog, chips, EmptyState,
 * LoadingState, decisionWorkspaceApi) is the real, shipped code.
 *
 * Covers:
 *  1. Loading state (pending GET /detail).
 *  2. 403 on decide() → distinct "not authorized" message, no false success.
 *  3. 404 on GET /detail → honest empty state, not a stuck spinner.
 *  4. 409 STALE_VERSION on decide() → "changed since you opened it" message
 *     + a real refetch (second GET /detail call).
 *  5. Terminal (APPROVED) lifecycle → frozen dossier sections + decide bar
 *     shows the final state instead of action controls.
 *  10. Decide (approve) success → PUT /decide called with the rationale, UI
 *      only flips to "Approved" after both the decide() call AND the
 *      subsequent refetch resolve.
 *  11. No premature/optimistic success — manually-controlled promise proves
 *      the UI does NOT show the approved state before the network call
 *      resolves. See the red/green sabotage proof recorded in the MW-DEC-001
 *      deliverable report (temporarily reverted local edit to
 *      DecisionDecideBar.tsx, not part of this commit).
 *  12. No localStorage/sessionStorage as a business-state source anywhere in
 *      the workspace, across a real comment+alternative+risk+decide flow.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiError,
  makeDecideResult,
  makeDetail,
  makeUsers,
} from './fixtures';

// ── react-i18next ────────────────────────────────────────────────────────
// The repo-wide setup.ts mock only supports the 2-arg `t(key, options)`
// call shape. The Decision workspace components use i18next's 3-arg form
// `t(key, defaultValueString, interpolationOptions)` (e.g.
// `t('...', 'Reloading at {{current}}', { current })`) in several places —
// this local mock (overriding the global one for this file) supports BOTH
// shapes and performs real `{{var}}` interpolation so assertions on the
// actual rendered message text are meaningful.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg2?: unknown, arg3?: unknown) => {
      let template: string = key;
      let opts: Record<string, unknown> | undefined;
      if (typeof arg2 === 'string') {
        template = arg2;
        opts = (arg3 as Record<string, unknown>) || undefined;
      } else if (arg2 && typeof arg2 === 'object') {
        const o = arg2 as Record<string, unknown>;
        template = typeof o.defaultValue === 'string' ? o.defaultValue : key;
        opts = o;
      }
      if (opts) {
        for (const k of Object.keys(opts)) {
          if (k === 'defaultValue') continue;
          template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(opts[k]));
        }
      }
      return template;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
  Trans: ({ children }: { children?: React.ReactNode }) => children,
}));

// ── App store ────────────────────────────────────────────────────────────
// `user-1` matches `decisionOwnerId` in the fixtures, so `canDecide` /
// `canEditDossier` are true by default — the point of the 403 test is that
// the SERVER still authoritatively rejects even though the client thinks
// it's allowed (see DecisionDecideBar.tsx's own header comment).
const userState = vi.hoisted(() => ({
  currentUser: { id: 'user-1', role: 'MEMBER' } as { id: string; role?: string } | null,
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: userState.currentUser }),
}));

// ── react-hot-toast (only used to assert NO success toast fires early) ────
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), loading: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: mockToast, toast: mockToast }));

// ── HTTP boundary ────────────────────────────────────────────────────────
const { mockGet, mockPost, mockPut, mockDelete, mockGetUsers } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockGetUsers: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    getUsers: (...args: unknown[]) => mockGetUsers(...args),
  },
}));

import { DecisionWorkspace } from '@/components/MyWork/Decision';

function renderWorkspace(
  props: Partial<React.ComponentProps<typeof DecisionWorkspace>> = {}
) {
  return render(
    <MemoryRouter>
      <DecisionWorkspace
        decisionId="dec-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
        {...props}
      />
    </MemoryRouter>
  );
}

/**
 * "Approved"/"Pending" etc. appear BOTH in the header's EntityStatusChip and
 * (once finalized) in DecisionDecideBar's own final-state block, so plain
 * `screen.getByText` is ambiguous once both exist. The footer wrapper
 * (`border-t`, unique in this tree — the header uses `border-b`) always
 * hosts exactly the DecideBar, finalized or not — scope assertions about
 * ITS content to that element.
 */
function decideBarOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector('.border-t.border-c-border-subtle');
  if (!el) throw new Error('DecisionDecideBar footer not found');
  return el as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  userState.currentUser = { id: 'user-1', role: 'MEMBER' };
  mockGetUsers.mockResolvedValue(makeUsers());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DecisionWorkspace — loading state', () => {
  it('shows a loading indicator while GET /detail is pending, with no error/content flash', async () => {
    let resolveGet: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveGet = resolve;
    });
    mockGet.mockReturnValue(pending);

    renderWorkspace();

    // Loading indicator present (LoadingState wraps a Spinner, which is
    // ALSO its own `role="status"` element — assert on the visible label
    // text plus at least one status role, rather than a single ambiguous
    // `getByRole('status')`).
    expect(screen.getByText('Loading decision…')).toBeInTheDocument();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);

    // No error / no content flashed while pending.
    expect(screen.queryByText(/decision not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Adopt Vendor X for billing')).not.toBeInTheDocument();

    // Clean up the pending promise so it doesn't leak into other tests.
    resolveGet!(makeDetail());
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
  });
});

describe('DecisionWorkspace — 403 on decide()', () => {
  it('shows a distinct "not authorized" message and renders NO success state', async () => {
    mockGet.mockResolvedValue(makeDetail({ status: 'PENDING' }));
    mockPut.mockRejectedValue(apiError(403, { error: 'Forbidden' }));

    renderWorkspace();

    await screen.findByText('Adopt Vendor X for billing');

    const rationale = screen.getByPlaceholderText(/rationale \(required/i);
    fireEvent.change(rationale, { target: { value: 'Looks solid, approving.' } });

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    // Confirm dialog appears — confirm it.
    const confirmHeading = await screen.findByText('Approve this decision?');
    const modal = confirmHeading.closest('.rounded-2xl') as HTMLElement;
    fireEvent.click(within(modal).getByRole('button', { name: 'Approve' }));

    // Distinct forbidden message — not a generic failure string.
    await screen.findByText(
      'You are not authorized to decide this — only the decision maker or an admin can.'
    );

    // Absence of the success UI: status is still Pending, decide bar still
    // shows action controls (not the "Approved" final block), no toast.
    expect(screen.getByText(/^Pending$/)).toBeInTheDocument();
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(mockToast.success).not.toHaveBeenCalled();

    // Only one decide() call was made — the failed one.
    expect(mockPut).toHaveBeenCalledTimes(1);
  });
});

describe('DecisionWorkspace — 404 on GET /detail', () => {
  it('shows the honest "no longer exists" empty state, not a stuck spinner', async () => {
    mockGet.mockRejectedValue(apiError(404, { error: 'Not found' }));

    renderWorkspace();

    const heading = await screen.findByRole('heading', { name: 'Decision not found' });
    expect(heading).toBeInTheDocument();
    expect(
      screen.getByText('This decision no longer exists or you do not have access to it.')
    ).toBeInTheDocument();

    // Not an infinite/stuck spinner.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // Not the generic network-error branch either — this is the specific 404 copy.
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

describe('DecisionWorkspace — 409 STALE_VERSION on decide()', () => {
  it('shows the "changed since you opened it" message and triggers a real refetch', async () => {
    const pending = makeDetail({ status: 'PENDING', version: 3 });
    const refetched = makeDetail({ status: 'PENDING', version: 5 });
    mockGet.mockResolvedValueOnce(pending).mockResolvedValueOnce(refetched);
    mockPut.mockRejectedValue(
      apiError(409, { code: 'STALE_VERSION', currentVersion: 5, expectedVersion: 3 })
    );

    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');
    expect(mockGet).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Return for clarification' })
    );

    await screen.findByText(
      'This decision changed since you opened it (now at version 5). Reloading the latest state — review it before deciding again.'
    );

    // A REAL refetch was triggered (onDecided → loadDetail({silent:true})).
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });
});

describe('DecisionWorkspace — terminal/finalized lifecycle', () => {
  it('freezes alternatives/risks and shows the final decide state instead of action controls', async () => {
    const finalized = makeDetail({
      status: 'APPROVED',
      decidedBy: 'user-1',
      decidedAt: '2026-07-05T12:00:00Z',
      rationale: 'Vendor X is cheaper and faster to integrate.',
      dossierAlternatives: [
        {
          id: 'alt-1',
          decisionId: 'dec-1',
          title: 'Stay with current vendor',
          description: null,
          benefits: null,
          drawbacks: null,
          costOrFeasibility: null,
          isRecommended: false,
          createdBy: 'user-1',
          createdAt: '2026-07-02T10:00:00Z',
          updatedAt: '2026-07-02T10:00:00Z',
        },
      ],
      dossierRisks: [
        {
          id: 'risk-1',
          decisionId: 'dec-1',
          description: 'Migration could cause a billing outage.',
          severity: 'MEDIUM',
          likelihood: 'MEDIUM',
          mitigation: null,
          ownerId: null,
          createdBy: 'user-1',
          createdAt: '2026-07-02T10:00:00Z',
          updatedAt: '2026-07-02T10:00:00Z',
        },
      ],
    });
    mockGet.mockResolvedValue(finalized);

    const { container } = renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    // Frozen banners.
    expect(
      screen.getByText(
        'This decision is finalized — alternatives are frozen and can no longer be edited.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('This decision is finalized — risks are frozen and can no longer be edited.')
    ).toBeInTheDocument();

    // Add/edit/delete controls are hidden.
    expect(screen.queryByText('Add alternative')).not.toBeInTheDocument();
    expect(screen.queryByText('Add risk')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete')).not.toBeInTheDocument();

    // Decide bar shows the final state, not action buttons.
    const decideBar = decideBarOf(container);
    expect(within(decideBar).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(within(decideBar).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(
      within(decideBar).queryByRole('button', { name: 'Return for clarification' })
    ).not.toBeInTheDocument();
    expect(within(decideBar).getByText('Approved')).toBeInTheDocument();
    expect(within(decideBar).getByText(/Ada Owner/)).toBeInTheDocument();
    expect(
      within(decideBar).getByText('"Vendor X is cheaper and faster to integrate."')
    ).toBeInTheDocument();
  });
});

describe('DecisionWorkspace — decide (approve) success', () => {
  it('calls PUT /decide with the rationale and only shows "Approved" after both calls resolve', async () => {
    const pending = makeDetail({ status: 'PENDING', version: 3 });
    const approved = makeDetail({
      status: 'APPROVED',
      version: 4,
      decidedBy: 'user-1',
      decidedAt: '2026-07-05T12:00:00Z',
      rationale: 'Ship it.',
    });
    mockGet.mockResolvedValueOnce(pending).mockResolvedValueOnce(approved);
    mockPut.mockResolvedValue(makeDecideResult({ status: 'APPROVED' }));

    const { container } = renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    fireEvent.change(screen.getByPlaceholderText(/rationale \(required/i), {
      target: { value: 'Ship it.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const confirmHeading = await screen.findByText('Approve this decision?');
    const modal = confirmHeading.closest('.rounded-2xl') as HTMLElement;
    fireEvent.click(within(modal).getByRole('button', { name: 'Approve' }));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith('/decisions/dec-1/decide', {
        status: 'APPROVED',
        rationale: 'Ship it.',
        notes: undefined,
        expectedVersion: 3,
      })
    );

    // Only after both the decide() call and the follow-up refetch resolve.
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(decideBarOf(container)).getByText('Approved')).toBeInTheDocument());
  });
});

describe('DecisionWorkspace — no premature/optimistic success (#11)', () => {
  it('does NOT show the approved state before decide() resolves; shows it after', async () => {
    const pending = makeDetail({ status: 'PENDING', version: 3 });
    const approved = makeDetail({
      status: 'APPROVED',
      version: 4,
      decidedBy: 'user-1',
      decidedAt: '2026-07-05T12:00:00Z',
    });
    mockGet.mockResolvedValueOnce(pending).mockResolvedValueOnce(approved);

    let resolveDecide: (v: unknown) => void;
    const decidePromise = new Promise((resolve) => {
      resolveDecide = resolve;
    });
    mockPut.mockReturnValue(decidePromise);

    const { container } = renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    fireEvent.change(screen.getByPlaceholderText(/rationale \(required/i), {
      target: { value: 'Ship it.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const confirmHeading = await screen.findByText('Approve this decision?');
    const modal = confirmHeading.closest('.rounded-2xl') as HTMLElement;
    fireEvent.click(within(modal).getByRole('button', { name: 'Approve' }));

    // decide() has been called but has NOT resolved yet.
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));

    // Assert IMMEDIATELY (before resolving) — still the pending state.
    expect(within(decideBarOf(container)).queryByText('Approved')).not.toBeInTheDocument();
    expect(mockToast.success).not.toHaveBeenCalled();
    expect(screen.getByText(/^Pending$/)).toBeInTheDocument();
    expect(within(decideBarOf(container)).getByRole('button', { name: 'Approve' })).toBeInTheDocument();

    // Now let the server "respond".
    resolveDecide!(makeDecideResult({ status: 'APPROVED' }));

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(decideBarOf(container)).getByText('Approved')).toBeInTheDocument()
    );
  });
});

describe('DecisionWorkspace — no localStorage/sessionStorage as business-state source', () => {
  it('never touches Storage while driving comment + alternative + risk + decide actions', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

    const pending = makeDetail({ status: 'PENDING', version: 1 });
    const afterComment = makeDetail({
      status: 'PENDING',
      version: 1,
      comments: [
        {
          id: 'comment-1',
          decisionId: 'dec-1',
          authorId: 'user-1',
          body: 'Looping in finance.',
          createdAt: '2026-07-02T10:00:00Z',
          updatedAt: '2026-07-02T10:00:00Z',
        },
      ],
    });
    mockGet.mockResolvedValueOnce(pending);
    mockPost.mockResolvedValueOnce(afterComment.comments[0]);
    mockPost.mockResolvedValueOnce({
      id: 'alt-1',
      decisionId: 'dec-1',
      title: 'New alternative',
      description: null,
      benefits: null,
      drawbacks: null,
      costOrFeasibility: null,
      isRecommended: false,
      createdBy: 'user-1',
      createdAt: '2026-07-02T10:00:00Z',
      updatedAt: '2026-07-02T10:00:00Z',
    });
    mockPost.mockResolvedValueOnce({
      id: 'risk-1',
      decisionId: 'dec-1',
      description: 'New risk',
      severity: 'MEDIUM',
      likelihood: 'MEDIUM',
      mitigation: null,
      ownerId: null,
      createdBy: 'user-1',
      createdAt: '2026-07-02T10:00:00Z',
      updatedAt: '2026-07-02T10:00:00Z',
    });
    mockPut.mockResolvedValueOnce(makeDecideResult({ status: 'RETURNED_FOR_CLARIFICATION' }));
    mockGet.mockResolvedValueOnce(
      makeDetail({ status: 'RETURNED_FOR_CLARIFICATION', version: 2 })
    );

    renderWorkspace();
    await screen.findByText('Adopt Vendor X for billing');

    // Comment.
    fireEvent.change(screen.getByPlaceholderText('Add a comment…'), {
      target: { value: 'Looping in finance.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));
    await screen.findByText('Looping in finance.');

    // Alternative.
    fireEvent.click(screen.getByRole('button', { name: 'Add alternative' }));
    fireEvent.change(screen.getByPlaceholderText('Alternative title'), {
      target: { value: 'New alternative' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add alternative' }));
    await screen.findByText('New alternative');

    // Risk.
    fireEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    fireEvent.change(screen.getByPlaceholderText('Risk description'), {
      target: { value: 'New risk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add risk' }));
    await screen.findByText('New risk');

    // Decide (no confirm dialog for RETURNED_FOR_CLARIFICATION).
    fireEvent.click(screen.getByRole('button', { name: 'Return for clarification' }));
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    expect(setItemSpy).not.toHaveBeenCalled();
    // getItem is allowed only if truly nothing reads storage either — grep of
    // the Decision/ directory confirms zero localStorage/sessionStorage
    // usage anywhere in this component tree, so assert zero calls, full stop.
    expect(getItemSpy).not.toHaveBeenCalled();
  });
});
