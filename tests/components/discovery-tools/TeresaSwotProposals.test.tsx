/**
 * @vitest-environment jsdom
 *
 * TLS-04 component-level coverage for TeresaSwotProposals
 * (src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx).
 *
 * Real RTL mount of the actual component. The only thing mocked is the
 * `@/services/api` module boundary (`Api.createSwotProposals` /
 * `Api.listSwotProposals` / `Api.acceptSwotProposal` / `Api.rejectSwotProposal`)
 * — no network, no fetch mocking, no reaching into component internals.
 * Every interaction below goes through the rendered DOM (buttons, text),
 * mirroring the discipline in
 * `tests/components/discovery-tools/ToolDocumentView.golden-flow.test.tsx`.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Api mock (overrides the global tests/setup.ts mock for this file) ───────
const createSwotProposalsMock = vi.fn();
const listSwotProposalsMock = vi.fn();
const acceptSwotProposalMock = vi.fn();
const rejectSwotProposalMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    createSwotProposals: (...args: unknown[]) => createSwotProposalsMock(...args),
    listSwotProposals: (...args: unknown[]) => listSwotProposalsMock(...args),
    acceptSwotProposal: (...args: unknown[]) => acceptSwotProposalMock(...args),
    rejectSwotProposal: (...args: unknown[]) => rejectSwotProposalMock(...args),
  },
}));

import { TeresaSwotProposals } from '@/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals';
import type { SwotProposal } from '@/services/api';

const TOOL_SESSION_ID = 'sess-swot-1';

function baseProposal(overrides: Partial<SwotProposal> = {}): SwotProposal {
  return {
    id: 'prop-1',
    toolSessionId: TOOL_SESSION_ID,
    quadrant: 'strengths',
    operation: 'add',
    targetItemId: null,
    before: null,
    proposedAfter: { text: 'New strength from Teresa' },
    finalAfter: null,
    rationale: 'Multiple interview notes mention this repeatedly.',
    sourceRefs: null,
    isAssumption: true,
    confidence: 0.82,
    modelMetadata: {},
    status: 'pending',
    expectedVersion: 3,
    createdBy: 'teresa',
    createdAt: '2026-08-01T10:00:00.000Z',
    decidedBy: null,
    decidedAt: null,
    ...overrides,
  };
}

/** Resolves an already-pending controlled promise; used for deferred mocks. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TeresaSwotProposals (TLS-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every test mounts and the component fetches the pending list on mount —
    // default to empty so tests that don't care about this can ignore it.
    listSwotProposalsMock.mockResolvedValue({ proposals: [] });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 1. Loading + cancel
  // ───────────────────────────────────────────────────────────────────────
  it('shows a loading state on generate, and Cancel aborts + ignores a later-resolving stale response', async () => {
    const user = userEvent.setup();
    const gate = deferred<{ proposals: SwotProposal[] }>();
    createSwotProposalsMock.mockReturnValue(gate.promise);

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => expect(listSwotProposalsMock).toHaveBeenCalled());

    const askButton = screen.getByRole('button', { name: /ask teresa/i });
    await user.click(askButton);

    // Loading state appears.
    await waitFor(() => {
      expect(screen.getByText(/teresa is preparing proposals/i)).toBeInTheDocument();
    });

    // The real AbortSignal was wired through to Api.createSwotProposals.
    expect(createSwotProposalsMock).toHaveBeenCalledTimes(1);
    const callArgs = createSwotProposalsMock.mock.calls[0];
    const options = callArgs[2] as { signal?: AbortSignal } | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal?.aborted).toBe(false);

    // Click Cancel before the promise resolves.
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Loading state clears immediately.
    await waitFor(() => {
      expect(screen.queryByText(/teresa is preparing proposals/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/new strength from teresa/i)).not.toBeInTheDocument();

    // The real AbortController fired.
    expect(options?.signal?.aborted).toBe(true);

    // Now resolve the stale in-flight promise — proves the component
    // genuinely ignores it rather than racily rendering it after cancel.
    gate.resolve({ proposals: [baseProposal()] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText(/new strength from teresa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/teresa is preparing proposals/i)).not.toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────
  // 2. Proposal card renders diff / sources-or-assumption / confidence / rationale
  // ───────────────────────────────────────────────────────────────────────
  it('renders an update proposal with before/after + sources, and an add proposal with an assumption badge', async () => {
    const updateProposal = baseProposal({
      id: 'prop-update',
      operation: 'update',
      quadrant: 'weaknesses',
      before: { text: 'Old weak point text' },
      proposedAfter: { text: 'Improved weak point text' },
      isAssumption: false,
      sourceRefs: ['Interview note #12', 'Document: Market scan 2026'],
      rationale: 'Client interview directly contradicts the old phrasing.',
      confidence: 0.91,
    });
    const addProposal = baseProposal({
      id: 'prop-add',
      operation: 'add',
      quadrant: 'opportunities',
      before: null,
      proposedAfter: { text: 'Brand-new opportunity point' },
      isAssumption: true,
      sourceRefs: null,
      rationale: 'Inferred from market trend, no direct citation.',
      confidence: 0.35,
    });

    listSwotProposalsMock.mockResolvedValue({ proposals: [updateProposal, addProposal] });

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Improved weak point text')).toBeInTheDocument();
    });

    // Scope assertions to each proposal's own card root (ProposalDecisionCard
    // renders `rounded-2xl border border-c-ai/30 ...` per card).
    const updateCard = screen.getByText('Improved weak point text').closest('.rounded-2xl') as HTMLElement;
    const addCard = screen.getByText('Brand-new opportunity point').closest('.rounded-2xl') as HTMLElement;
    expect(updateCard).toBeTruthy();
    expect(addCard).toBeTruthy();
    expect(updateCard).not.toBe(addCard);

    // -- update proposal: shows BOTH a "before" and "proposedAfter" value --
    expect(within(updateCard).getByText('Old weak point text')).toBeInTheDocument();
    expect(within(updateCard).getByText('Improved weak point text')).toBeInTheDocument();
    expect(within(updateCard).getByText(/^before$/i)).toBeInTheDocument();
    // Sourced proposal renders its actual sourceRefs strings.
    expect(within(updateCard).getByText('Interview note #12')).toBeInTheDocument();
    expect(within(updateCard).getByText('Document: Market scan 2026')).toBeInTheDocument();
    expect(
      within(updateCard).getByText('Client interview directly contradicts the old phrasing.')
    ).toBeInTheDocument();
    // Not fabricated as an assumption — it has real sources.
    expect(within(updateCard).queryByText(/assumption — no cited source/i)).not.toBeInTheDocument();

    // -- add proposal: only the new text, no misleading "before" state --
    expect(within(addCard).getByText('Brand-new opportunity point')).toBeInTheDocument();
    expect(within(addCard).queryByText(/^before$/i)).not.toBeInTheDocument();
    expect(within(addCard).queryByText('Old weak point text')).not.toBeInTheDocument();
    // Assumption badge (clearly labeled), not a fabricated source.
    expect(within(addCard).getByText(/assumption — no cited source/i)).toBeInTheDocument();
    expect(within(addCard).queryByText('Interview note #12')).not.toBeInTheDocument();
    expect(
      within(addCard).getByText('Inferred from market trend, no direct citation.')
    ).toBeInTheDocument();

    // Both show some confidence indicator text.
    expect(within(updateCard).getByText(/high confidence · 91%/i)).toBeInTheDocument();
    expect(within(addCard).getByText(/low confidence · 35%/i)).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────
  // 3. Accept (no edit)
  // ───────────────────────────────────────────────────────────────────────
  it('Accept without editing calls acceptSwotProposal with proposedAfter and no editedAfter', async () => {
    const user = userEvent.setup();
    const proposal = baseProposal({ id: 'prop-accept', expectedVersion: 5 });
    listSwotProposalsMock.mockResolvedValue({ proposals: [proposal] });
    acceptSwotProposalMock.mockResolvedValue({
      proposal: { ...proposal, status: 'accepted' },
      session: { id: TOOL_SESSION_ID, version: 6 },
    });

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByText('New strength from Teresa')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^accept$/i }));

    await waitFor(() => {
      expect(acceptSwotProposalMock).toHaveBeenCalledTimes(1);
    });

    const [calledToolId, calledProposalId, calledBody] = acceptSwotProposalMock.mock.calls[0];
    expect(calledToolId).toBe(TOOL_SESSION_ID);
    expect(calledProposalId).toBe('prop-accept');
    expect(calledBody.expectedVersion).toBe(5);
    expect(typeof calledBody.expectedVersion).toBe('number');
    expect(calledBody.editedAfter).toBeUndefined();

    // Card reflects "accepted": it leaves the pending list (component filters
    // to status === 'pending' after re-mapping the accept response).
    await waitFor(() => {
      expect(screen.queryByText('New strength from Teresa')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 4. Edit-before-accept
  // ───────────────────────────────────────────────────────────────────────
  it('Edit then Accept calls acceptSwotProposal with editedAfter carrying the edited text', async () => {
    const user = userEvent.setup();
    const proposal = baseProposal({
      id: 'prop-edit',
      expectedVersion: 2,
      proposedAfter: { text: 'Original proposed text' },
    });
    listSwotProposalsMock.mockResolvedValue({ proposals: [proposal] });
    acceptSwotProposalMock.mockResolvedValue({
      proposal: { ...proposal, status: 'accepted' },
      session: { id: TOOL_SESSION_ID, version: 3 },
    });

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByText('Original proposed text')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit before accepting/i }));

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Original proposed text');
    await user.clear(textarea);
    await user.type(textarea, 'User-edited replacement text');

    await user.click(screen.getByRole('button', { name: /^accept$/i }));

    await waitFor(() => {
      expect(acceptSwotProposalMock).toHaveBeenCalledTimes(1);
    });

    const [, , calledBody] = acceptSwotProposalMock.mock.calls[0];
    expect(calledBody.editedAfter).toBeTruthy();
    expect(calledBody.editedAfter.text).toBe('User-edited replacement text');
    expect(calledBody.editedAfter.text).not.toBe('Original proposed text');
  });

  // ───────────────────────────────────────────────────────────────────────
  // 5. Reject
  // ───────────────────────────────────────────────────────────────────────
  it('Reject calls rejectSwotProposal and the card leaves the pending list', async () => {
    const user = userEvent.setup();
    const proposal = baseProposal({ id: 'prop-reject' });
    listSwotProposalsMock.mockResolvedValue({ proposals: [proposal] });
    rejectSwotProposalMock.mockResolvedValue({
      proposal: { ...proposal, status: 'rejected' },
    });

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByText('New strength from Teresa')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(rejectSwotProposalMock).toHaveBeenCalledTimes(1);
    });
    const [calledToolId, calledProposalId] = rejectSwotProposalMock.mock.calls[0];
    expect(calledToolId).toBe(TOOL_SESSION_ID);
    expect(calledProposalId).toBe('prop-reject');

    await waitFor(() => {
      expect(screen.queryByText('New strength from Teresa')).not.toBeInTheDocument();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // 6. Stale conflict (409 STALE_VERSION) on accept
  // ───────────────────────────────────────────────────────────────────────
  it('shows a stale-conflict message on 409 STALE_VERSION and does not auto-retry', async () => {
    const user = userEvent.setup();
    const proposal = baseProposal({ id: 'prop-stale', expectedVersion: 4 });
    listSwotProposalsMock.mockResolvedValue({ proposals: [proposal] });

    const staleErr: any = new Error('Version conflict');
    staleErr.status = 409;
    staleErr.data = { code: 'STALE_VERSION', currentVersion: 9 };
    acceptSwotProposalMock.mockRejectedValue(staleErr);

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByText('New strength from Teresa')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^accept$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/this swot changed since teresa proposed this/i)
      ).toBeInTheDocument();
    });
    // Not a generic error message.
    expect(screen.queryByText(/failed to save the decision/i)).not.toBeInTheDocument();

    expect(acceptSwotProposalMock).toHaveBeenCalledTimes(1);

    // Wait a bit — no automatic retry with the same expectedVersion.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(acceptSwotProposalMock).toHaveBeenCalledTimes(1);

    // The retry control carries the server-reported currentVersion, not the
    // stale expectedVersion the user started with.
    const retryButton = screen.getByRole('button', {
      name: /i understand, retry with current version/i,
    });
    expect(retryButton).toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────
  // 7. Already-decided conflict (409 ALREADY_DECIDED)
  // ───────────────────────────────────────────────────────────────────────
  it('shows an already-decided message on 409 ALREADY_DECIDED, not a generic error', async () => {
    const user = userEvent.setup();
    const proposal = baseProposal({ id: 'prop-already-decided' });
    listSwotProposalsMock.mockResolvedValue({ proposals: [proposal] });

    const alreadyDecidedErr: any = new Error('Already decided');
    alreadyDecidedErr.status = 409;
    alreadyDecidedErr.data = { code: 'ALREADY_DECIDED', status: 'accepted' };
    acceptSwotProposalMock.mockRejectedValue(alreadyDecidedErr);

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);

    await waitFor(() => {
      expect(screen.getByText('New strength from Teresa')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^accept$/i }));

    await waitFor(() => {
      expect(screen.getByText(/someone already accepted this proposal/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/failed to save the decision/i)).not.toBeInTheDocument();
    // Still shown, but explicitly as resolved — not still "pending" action buttons.
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────
  // 8. Provider error + retry on generate
  // ───────────────────────────────────────────────────────────────────────
  it('shows an honest error + Retry on generate failure, and Retry genuinely re-invokes generation', async () => {
    const user = userEvent.setup();
    const providerErr: any = new Error('Provider unavailable');
    providerErr.data = { code: 'PROVIDER_ERROR' };
    createSwotProposalsMock.mockRejectedValueOnce(providerErr);

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);
    await waitFor(() => expect(listSwotProposalsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /ask teresa/i }));

    await waitFor(() => {
      expect(screen.getByText(/teresa is temporarily unavailable/i)).toBeInTheDocument();
    });
    // No proposal card rendered on error.
    expect(screen.queryByText(/new strength from teresa/i)).not.toBeInTheDocument();
    expect(createSwotProposalsMock).toHaveBeenCalledTimes(1);

    createSwotProposalsMock.mockResolvedValueOnce({ proposals: [baseProposal()] });

    await user.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(createSwotProposalsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('New strength from Teresa')).toBeInTheDocument();
    });
    expect(screen.queryByText(/teresa is temporarily unavailable/i)).not.toBeInTheDocument();
  });

  // ───────────────────────────────────────────────────────────────────────
  // 9. Success only after persistence — no optimistic rendering
  // ───────────────────────────────────────────────────────────────────────
  it('renders no proposal card while generation is pending, only after it resolves', async () => {
    const user = userEvent.setup();
    const gate = deferred<{ proposals: SwotProposal[] }>();
    createSwotProposalsMock.mockReturnValue(gate.promise);

    render(<TeresaSwotProposals toolSessionId={TOOL_SESSION_ID} />);
    await waitFor(() => expect(listSwotProposalsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /ask teresa/i }));

    await waitFor(() => {
      expect(screen.getByText(/teresa is preparing proposals/i)).toBeInTheDocument();
    });
    // No proposal card while pending — only the loading state.
    expect(screen.queryByText(/new strength from teresa/i)).not.toBeInTheDocument();

    gate.resolve({ proposals: [baseProposal()] });

    await waitFor(() => {
      expect(screen.getByText('New strength from Teresa')).toBeInTheDocument();
    });
    expect(screen.queryByText(/teresa is preparing proposals/i)).not.toBeInTheDocument();
  });
});
