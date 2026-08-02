/**
 * @vitest-environment jsdom
 *
 * EXE-008 — ClosureSection component tests.
 *
 * Locks in the honest-failure / no-premature-success contract described in
 * the component's own header (src/components/Initiatives/sections/ClosureSection.tsx):
 *   - readiness checklist renders satisfied/unsatisfied items from the server;
 *   - evidence add on a 404 (bad ref) shows the SERVER error, never adds
 *     optimistically;
 *   - a successful submit flips the section into the read-only "submitted" view;
 *   - a 422 CLOSURE_NOT_READY submit surfaces the SPECIFIC missing checklist
 *     items from `details.checklist`, not a generic error;
 *   - Return is blocked without a rationale, and posts the trimmed rationale
 *     once provided;
 *   - approve is NEVER shown as a success from the mutation response alone —
 *     only once a follow-up GET read-back confirms status === 'done'
 *     (THE most important test in this file — see below);
 *   - a 409 STALE_VERSION on approve surfaces a distinct conflict message,
 *     never a generic/silent failure;
 *   - a closure request that is already `done` on first load (hard reload
 *     after closing) renders the final snapshot immediately, no interaction
 *     required.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// react-i18next — t(key, default) returns the default so assertions read
// naturally, matching the convention used across Initiatives section tests.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, def?: string) => (typeof def === 'string' ? def : _key),
  }),
}));

// framer-motion — plain elements, no animation timing to fight in jsdom.
//
// IMPORTANT: the Proxy getter is memoized per tag (motion.div, motion.button,
// …). A getter that returns a brand-new component function on every access
// gives `motion.div` a different identity on every CollapsibleSection render,
// which makes React unmount/remount that whole subtree on EVERY state update
// (evRefId typing, submit, approve, …) — silently detaching any button/input
// reference a test captured before the interaction, so `fireEvent` on it
// becomes a no-op against a node no longer in the document.
vi.mock('framer-motion', () => {
  const cache = new Map<string | symbol, (props: any) => React.ReactElement>();
  const motion = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (!cache.has(prop)) {
          cache.set(prop, (props: any) => <div {...props} />);
        }
        return cache.get(prop);
      },
    }
  );
  return {
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion,
  };
});

// lucide-react — keep every real export (CollapsibleSection's SectionIcon
// registry imports a large, unrelated set at module scope), but override the
// ones ClosureSection actually renders with testids so satisfied/unsatisfied
// icons are distinguishable.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    AlertTriangle: (p: any) => <span data-testid="icon-alert" {...p} />,
    Check: (p: any) => <span data-testid="icon-check" {...p} />,
    CheckCircle2: (p: any) => <span data-testid="icon-checkcircle" {...p} />,
    Circle: (p: any) => <span data-testid="icon-circle" {...p} />,
    Loader2: (p: any) => <span data-testid="icon-loader" {...p} />,
    ShieldCheck: (p: any) => <span data-testid="icon-shield" {...p} />,
    X: (p: any) => <span data-testid="icon-x" {...p} />,
  };
});

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn() },
}));

const ctxValue: any = {
  initiativeId: 'init-1',
  users: [
    { id: 'user-1', firstName: 'Anna', lastName: 'Kowalska', email: 'anna@example.com' },
    { id: 'user-2', firstName: 'Piotr', lastName: 'Nowak', email: 'piotr@example.com' },
  ],
};
vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { Api } from '@/services/api';
import { ClosureSection } from '@/components/Initiatives/sections/ClosureSection';
import toast from 'react-hot-toast';

const INITIATIVE_ID = 'init-1';
const REQ_ID = 'req-1';
const LIST_URL = `/initiatives/${INITIATIVE_ID}/closure-requests`;
const DETAIL_URL = `/initiatives/${INITIATIVE_ID}/closure-requests/${REQ_ID}`;
const READINESS_URL = `/initiatives/${INITIATIVE_ID}/closure-requests/${REQ_ID}/readiness`;

const SECTION_PROPS: any = {
  sectionType: { id: 'closure', label: 'Closure' },
  expanded: true,
  onToggle: vi.fn(),
};

function apiError(status: number, data: Record<string, unknown>) {
  const err: any = new Error((data?.error as string) || `HTTP ${status}`);
  err.status = status;
  err.data = data;
  return err;
}

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: REQ_ID,
    status: 'draft',
    requestedBy: 'user-1',
    requestedAt: '2026-01-01T00:00:00Z',
    closureRationale: 'Rationale text',
    outcomeSummary: 'Outcome text',
    exceptionsWaivers: null,
    approverId: null,
    approvedAt: null,
    returnedAt: null,
    reviewRationale: null,
    transitionAuditRef: null,
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Wires Api.get to a mutable `state` object so a single test can simulate the
 * server evolving across successive GETs (submit -> submitted, approve ->
 * approved_pending_transition -> done, etc). `state.detail` and `state.list[0]`
 * are the SAME object reference, so mutating one field is visible everywhere,
 * matching how the real backend would return one consistent row.
 */
function makeState(detailOverrides: Record<string, unknown> = {}) {
  const detail = makeDetail(detailOverrides);
  const state = {
    detail,
    list: [detail] as any[],
    evidence: [] as any[],
    readiness: { items: [], ready: true, incompleteTaskCount: 0, incompleteMilestoneCount: 0 } as any,
  };
  return state;
}

function wireGet(state: ReturnType<typeof makeState>) {
  (Api.get as any).mockImplementation((url: string) => {
    if (url === LIST_URL) return Promise.resolve({ closureRequests: state.list });
    if (url === DETAIL_URL) {
      return Promise.resolve({ closureRequest: state.detail, evidence: state.evidence });
    }
    if (url === READINESS_URL) return Promise.resolve(state.readiness);
    return Promise.resolve({});
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ClosureSection', () => {
  it('renders the readiness checklist with satisfied/unsatisfied items from the server', async () => {
    const state = makeState({ status: 'submitted' });
    state.readiness = {
      items: [
        { key: 'closureRationale', label: 'Closure rationale provided', satisfied: true },
        { key: 'evidenceMinimumTwo', label: 'At least two evidence references attached', satisfied: false },
      ],
      ready: false,
      incompleteTaskCount: 0,
      incompleteMilestoneCount: 0,
    };
    wireGet(state);

    render(<ClosureSection {...SECTION_PROPS} />);

    expect(await screen.findByText('Readiness checklist')).toBeInTheDocument();
    expect(screen.getByText('Not ready')).toBeInTheDocument();

    const satisfiedRow = screen.getByText('Closure rationale provided').closest('li')!;
    expect(satisfiedRow.querySelector('[data-testid="icon-checkcircle"]')).not.toBeNull();
    expect(satisfiedRow.querySelector('[data-testid="icon-circle"]')).toBeNull();

    const unsatisfiedRow = screen
      .getByText('At least two evidence references attached')
      .closest('li')!;
    expect(unsatisfiedRow.querySelector('[data-testid="icon-circle"]')).not.toBeNull();
    expect(unsatisfiedRow.querySelector('[data-testid="icon-checkcircle"]')).toBeNull();
  });

  it('evidence validation: a 404 on a bad reference shows the server error and does NOT add optimistically', async () => {
    const state = makeState({ status: 'draft' });
    wireGet(state);
    (Api.post as any).mockImplementation((url: string) => {
      if (url.endsWith('/evidence')) {
        return Promise.reject(
          apiError(404, {
            error: 'Evidence reference (task:ghost-task-1) was not found in this organization',
            code: 'EVIDENCE_REF_NOT_FOUND',
          })
        );
      }
      return Promise.resolve({ success: true });
    });

    render(<ClosureSection {...SECTION_PROPS} />);

    const addBtn = (await screen.findByText('Add evidence')).closest('button')!;
    expect(screen.getByText('No evidence attached yet')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Reference id'), {
      target: { value: 'ghost-task-1' },
    });
    expect(addBtn).not.toBeDisabled();

    const getCallsBefore = (Api.get as any).mock.calls.length;
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Evidence reference (task:ghost-task-1) was not found in this organization'
      );
    });

    // No optimistic add — the empty-state copy is still shown.
    expect(screen.getByText('No evidence attached yet')).toBeInTheDocument();
    expect(screen.queryByText('ghost-task-1')).not.toBeInTheDocument();
    // And no refetch was triggered by the failure path either.
    expect((Api.get as any).mock.calls.length).toBe(getCallsBefore);
  });

  it('submitted state: a successful submit flips to the read-only "waiting for approval" view', async () => {
    const state = makeState({ status: 'draft' });
    wireGet(state);
    (Api.post as any).mockImplementation((url: string) => {
      if (url.endsWith('/submit')) {
        state.detail.status = 'submitted';
        return Promise.resolve({ success: true, id: REQ_ID, status: 'submitted' });
      }
      return Promise.resolve({ success: true });
    });

    const { container } = render(<ClosureSection {...SECTION_PROPS} />);

    const submitBtn = (await screen.findByText('Submit for approval')).closest('button')!;
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
    // Fields become read-only — no textarea left on the page.
    expect(container.querySelectorAll('textarea').length).toBe(0);
    expect(screen.getByText('Rationale text')).toBeInTheDocument();
    expect(screen.queryByText('Submit for approval')).not.toBeInTheDocument();
  });

  it('submit rejected (422 CLOSURE_NOT_READY): shows the SPECIFIC missing checklist items, not a generic error', async () => {
    const state = makeState({ status: 'draft' });
    wireGet(state);
    (Api.post as any).mockImplementation((url: string) => {
      if (url.endsWith('/submit')) {
        return Promise.reject(
          apiError(422, {
            error: 'Closure request is not ready to submit',
            code: 'CLOSURE_NOT_READY',
            details: {
              checklist: [
                { key: 'evidenceMinimumTwo', label: 'Evidence pack incomplete', satisfied: false },
                { key: 'closureRationale', label: 'Rationale already on file', satisfied: true },
              ],
            },
          })
        );
      }
      return Promise.resolve({ success: true });
    });

    render(<ClosureSection {...SECTION_PROPS} />);

    const submitBtn = (await screen.findByText('Submit for approval')).closest('button')!;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Closure is not ready yet — see the checklist below');
    });

    expect(await screen.findByText('Missing before submit')).toBeInTheDocument();
    // Only the UNSATISFIED item from the server response is listed...
    expect(screen.getByText('Evidence pack incomplete')).toBeInTheDocument();
    // ...the satisfied one is filtered out of the "missing" panel.
    expect(screen.queryByText('Rationale already on file')).not.toBeInTheDocument();
  });

  it('return: blocked without a rationale, posts the trimmed rationale once provided', async () => {
    const state = makeState({ status: 'submitted' });
    wireGet(state);
    (Api.post as any).mockImplementation((url: string) => {
      if (url.endsWith('/return')) {
        state.detail.status = 'returned';
        return Promise.resolve({ success: true, id: REQ_ID, status: 'returned' });
      }
      return Promise.resolve({ success: true });
    });

    render(<ClosureSection {...SECTION_PROPS} />);

    const returnToggle = (await screen.findByText('Return')).closest('button')!;
    fireEvent.click(returnToggle);

    const confirmBtn = (await screen.findByText('Confirm return')).closest('button')!;
    expect(confirmBtn).toBeDisabled();

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: '  Client agreed to close  ' } });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        `/initiatives/${INITIATIVE_ID}/closure-requests/${REQ_ID}/return`,
        { reviewRationale: 'Client agreed to close' }
      );
    });
  });

  it('approve: NEVER shows success from the mutation alone — only after a GET read-back confirms status="done"', async () => {
    const state = makeState({ status: 'submitted' });
    wireGet(state);
    (Api.post as any).mockImplementation((url: string) => {
      if (url.endsWith('/approve')) {
        // Mirrors the real backend: unit 1 commits durably as
        // 'approved_pending_transition' before the engine call is awaited.
        state.detail.status = 'approved_pending_transition';
        return Promise.resolve({
          success: true,
          ok: true,
          idempotent: false,
          status: 'approved_pending_transition',
        });
      }
      return Promise.resolve({ success: true });
    });

    render(<ClosureSection {...SECTION_PROPS} />);

    const approveBtn = (await screen.findByText('Approve')).closest('button')!;

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(approveBtn);
        // Flush the POST /approve microtask chain.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      // The POST alone must never be treated as success.
      expect(toast.success).not.toHaveBeenCalledWith('Closure approved and finalized');
      expect(screen.queryByText('Closure snapshot')).not.toBeInTheDocument();

      // First self-heal poll tick — backend is STILL only pending-transition.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(toast.success).not.toHaveBeenCalledWith('Closure approved and finalized');
      expect(screen.queryByText('Closure snapshot')).not.toBeInTheDocument();
      expect(screen.getByText('Processing the transition to closed…')).toBeInTheDocument();

      // Now the backend self-heals to 'done' on the next read.
      state.detail.status = 'done';
      state.detail.approverId = 'user-1';
      state.detail.approvedAt = '2026-01-02T00:00:00Z';
      state.detail.transitionAuditRef = 'hist-1';

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });

      expect(toast.success).toHaveBeenCalledWith('Closure approved and finalized');
      expect(screen.getByText('Closure snapshot')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('approve conflict/retry: a 409 STALE_VERSION shows a distinct conflict message, never a silent/generic failure', async () => {
    const state = makeState({ status: 'submitted' });
    wireGet(state);
    (Api.post as any).mockImplementation((url: string) => {
      if (url.endsWith('/approve')) {
        return Promise.reject(
          apiError(409, { code: 'STALE_VERSION', expected: 'v-old', actual: 'v-new' })
        );
      }
      return Promise.resolve({ success: true });
    });

    render(<ClosureSection {...SECTION_PROPS} />);

    const approveBtn = (await screen.findByText('Approve')).closest('button')!;
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Initiative changed since this request was created — reload and try again'
      );
    });
    // Never claims success on a conflict.
    expect(toast.success).not.toHaveBeenCalled();
    // The action is not left permanently stuck — the user can retry.
    await waitFor(() => expect(approveBtn).not.toBeDisabled());
  });

  it('reopen DONE snapshot: a request already "done" on first load renders the final snapshot immediately (no interaction)', async () => {
    const state = makeState({
      status: 'done',
      closureRationale: 'Initiative delivered as planned',
      outcomeSummary: 'All success criteria met',
      approverId: 'user-2',
      approvedAt: '2026-02-01T00:00:00Z',
      transitionAuditRef: 'hist-99',
    });
    state.evidence = [
      {
        id: 'ev-1',
        evidenceType: 'task',
        evidenceRefId: 'task-42',
        notes: 'Completed on schedule',
        addedBy: 'user-1',
        addedAt: '2026-01-15T00:00:00Z',
      },
    ];
    state.readiness = {
      items: [{ key: 'closureRationale', label: 'Closure rationale provided', satisfied: true }],
      ready: true,
      incompleteTaskCount: 0,
      incompleteMilestoneCount: 0,
    };
    wireGet(state);

    const { container } = render(<ClosureSection {...SECTION_PROPS} />);

    // No click, no button — this is what a hard reload after closure looks like.
    expect(await screen.findByText('Closure snapshot')).toBeInTheDocument();
    expect(screen.getByText('Initiative delivered as planned')).toBeInTheDocument();
    expect(screen.getByText('All success criteria met')).toBeInTheDocument();
    expect(screen.getByText('Piotr Nowak')).toBeInTheDocument(); // resolved approver name
    expect(screen.getByText('hist-99', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('task-42')).toBeInTheDocument();
    expect(screen.getByText('Completed on schedule')).toBeInTheDocument();

    // Fully read-only — nothing left to edit on a done request.
    expect(container.querySelectorAll('textarea').length).toBe(0);
  });
});
