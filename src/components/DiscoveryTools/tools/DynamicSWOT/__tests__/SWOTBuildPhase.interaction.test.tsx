/**
 * SWOTBuildPhase — interaction regression tests.
 *
 * Context (F4 sprint, 2026-08-13): a browser E2E run reported that a
 * "nested-scroll canvas" defeated automation's coordinate-based `scroll`
 * gesture when trying to type into the SWOT quadrants (30s timeouts), and
 * that step was worked around with a direct authenticated HTTP PUT — not
 * acceptable as UI evidence.
 *
 * Live-browser investigation (own harness, own DB, real login, real
 * backend) found:
 *   - The quadrant inputs ARE reachable and typeable via real mouse clicks,
 *     keyboard Tab order, and Enter-to-submit — verified end to end
 *     including autosave -> full page reload -> identical state restored.
 *   - The "nested scroll" is real (NModeShell wraps this canvas with two
 *     extra ancestors that also declare `overflow-auto`/`overflow-y-auto`),
 *     but only ONE of the three is ever actually overflowing
 *     (scrollHeight > clientHeight); the other two are inert by
 *     measurement. Real browsers route wheel/keyboard scroll to the correct
 *     (innermost overflowing) ancestor automatically — this is standard
 *     platform behavior, not something the app implements. The failure was
 *     traced to the browser-automation harness's coordinate-based scroll
 *     simulation getting confused by the inert wrapper divs, not to a
 *     genuine trap for real users.
 *   - Gap found and fixed here: the live SWOT Build phase (`QuadrantCard`
 *     in SWOTBuildPhase.tsx) rendered NO impact selector at all, even
 *     though `SWOTItem.impact` and its i18n labels
 *     (`discoveryToolsTools.dynamicSwot.quadrantStep.*Impact`) already
 *     existed and are used by the disconnected legacy `SWOTQuadrantStep`.
 *     These tests guard the fix.
 *
 * These tests exercise the REAL zustand store (not a mock) through a thin
 * harness that mirrors how `ToolWorkspace` wires `session` from
 * `useToolStore().currentSession`, so add/update/remove actions round-trip
 * exactly like production.
 *
 * i18n note: `tests/setup.ts` mocks `react-i18next` so `t(key)` returns the
 * raw KEY, not the translated string (see that file's comment on avoiding
 * OOM from proxy allocation). Queries below match on those raw keys, same
 * convention as other DiscoveryTools tests in this repo.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

// Teresa proposal loading has its own real-component/API lifecycle suite in
// tests/components/discovery-tools/TeresaSwotProposals.test.tsx. These tests
// target only the synchronous SWOT matrix/store contract, so keep the sibling
// network-backed panel out of this mount and avoid unrelated post-render state
// updates leaking across assertions.
vi.mock('../TeresaSwotProposals', () => ({
  TeresaSwotProposals: () => <div data-testid="teresa-swot-proposals-stub" />,
}));

import { SWOTBuildPhase } from '../SWOTBuildPhase';

const KEYS = {
  addPointPlaceholder: 'discoveryToolsTools.dynamicSwot.buildPhase.addPointPlaceholder',
  swotPoint: 'discoveryToolsTools.dynamicSwot.buildPhase.swotPoint',
  accept: 'discoveryToolsTools.dynamicSwot.buildPhase.accept',
  reject: 'discoveryToolsTools.dynamicSwot.buildPhase.reject',
  highImpact: 'discoveryToolsTools.dynamicSwot.quadrantStep.highImpact',
  mediumImpact: 'discoveryToolsTools.dynamicSwot.quadrantStep.mediumImpact',
};

function Harness({ isPolish = false }: { isPolish?: boolean }) {
  const session = useToolStore((s) => s.currentSession);
  if (!session) return null;
  return <SWOTBuildPhase session={session} isPolish={isPolish} />;
}

function resetStore() {
  useToolStore.setState({ currentSession: null, currentStep: 1, savedSessions: [] });
  useToolStore.getState().createSession('dynamic-swot');
}

describe('SWOTBuildPhase — quadrant inputs are reachable and editable', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders four category tabs and exactly one active add-point workspace', () => {
    render(<Harness />);
    const inputs = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    expect(inputs).toHaveLength(1);
    expect(screen.getByRole('tab', { name: /Strengths/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Weaknesses/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Opportunities/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Threats/ })).toBeInTheDocument();
  });

  it('adds an item to Strengths via keyboard Enter (no mouse needed)', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);

    fireEvent.change(strengthsInput, { target: { value: 'Experienced delivery team' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });

    expect(screen.getByDisplayValue('Experienced delivery team')).toBeInTheDocument();
    // Input clears after a successful add.
    expect((strengthsInput as HTMLInputElement).value).toBe('');
  });

  it('adds an item via the mouse-driven "+" button', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: /Weaknesses/ }));
    const weaknessesInput = screen.getByPlaceholderText(KEYS.addPointPlaceholder);
    const addButton = weaknessesInput.parentElement?.querySelector('button');
    expect(addButton).toBeTruthy();

    fireEvent.change(weaknessesInput, { target: { value: 'Slow implementation cycle' } });
    fireEvent.click(addButton as HTMLButtonElement);

    expect(screen.getByDisplayValue('Slow implementation cycle')).toBeInTheDocument();
  });

  it('places typed items in the correct quadrant, independently', () => {
    render(<Harness />);
    (
      [
        ['Strengths', 'S item'],
        ['Weaknesses', 'W item'],
        ['Opportunities', 'O item'],
        ['Threats', 'T item'],
      ] as const
    ).forEach(([label, text]) => {
      fireEvent.click(screen.getByRole('tab', { name: new RegExp(label) }));
      const input = screen.getByPlaceholderText(KEYS.addPointPlaceholder);
      fireEvent.change(input, { target: { value: text } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    const items = useToolStore.getState().currentSession?.inputData as any;
    const byQuadrant = (q: string) => items.items.filter((i: any) => i.quadrant === q);
    expect(byQuadrant('strengths').map((i: any) => i.text)).toEqual(['S item']);
    expect(byQuadrant('weaknesses').map((i: any) => i.text)).toEqual(['W item']);
    expect(byQuadrant('opportunities').map((i: any) => i.text)).toEqual(['O item']);
    expect(byQuadrant('threats').map((i: any) => i.text)).toEqual(['T item']);
  });

  it('deletes an item via the trash button', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    fireEvent.change(strengthsInput, { target: { value: 'Temp item' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });
    expect(screen.getByDisplayValue('Temp item')).toBeInTheDocument();

    const cardLabel = screen.getByText(KEYS.swotPoint);
    // The label sits in a header row alongside the impact <select> and the
    // trash button — scope to that row and grab its one <button>.
    const headerRow = cardLabel.closest('div')?.parentElement as HTMLElement;
    const trashButton = within(headerRow).getAllByRole('button')[0];
    fireEvent.click(trashButton);

    expect(screen.queryByDisplayValue('Temp item')).not.toBeInTheDocument();
  });
});

describe('SWOTBuildPhase — accepted-signal import is replay-idempotent', () => {
  beforeEach(() => {
    resetStore();
  });

  const addAcceptedSignal = (title: string) =>
    useToolStore.getState().addSWOTSignal({
      type: 'ai',
      sourceLabel: title,
      content: `${title} evidence`,
      confidence: 4,
      tags: ['strengths', 'input-proposal', 'confirmed-for-matrix'],
      evidenceType: 'observation',
      state: 'accepted',
      proposalStatus: 'accepted',
    });

  it('imports two signals once under StrictMode and a later third signal once', async () => {
    addAcceptedSignal('First stable strength');
    addAcceptedSignal('Second stable strength');

    render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>
    );

    await waitFor(() => {
      const data = useToolStore.getState().currentSession?.inputData as any;
      expect(data.items.map((item: any) => item.text)).toEqual([
        'First stable strength',
        'Second stable strength',
      ]);
    });

    act(() => addAcceptedSignal('Later stable strength'));

    await waitFor(() => {
      const data = useToolStore.getState().currentSession?.inputData as any;
      expect(data.items.map((item: any) => item.text)).toEqual([
        'First stable strength',
        'Second stable strength',
        'Later stable strength',
      ]);
    });
  });
});

describe('SWOTBuildPhase — impact classification (fixed gap)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('defaults a newly-added item to medium impact and exposes a selector to change it', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    fireEvent.change(strengthsInput, { target: { value: 'Some strength' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });

    const select = screen.getByDisplayValue(KEYS.mediumImpact) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'high' } });

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Some strength');
    expect(item.impact).toBe('high');
    expect(screen.getByDisplayValue(KEYS.highImpact)).toBeInTheDocument();
  });
});

describe('SWOTBuildPhase — AI proposal accept/reject', () => {
  beforeEach(() => {
    resetStore();
  });

  it('accepting a proposal promotes it into a regular, editable SWOT point', () => {
    useToolStore.getState().addSWOTItem({
      text: 'AI suggested strength',
      quadrant: 'strengths',
      impact: 'medium',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
    });

    render(<Harness />);
    expect(screen.getByText('AI suggested strength')).toBeInTheDocument();

    const acceptButton = screen.getByRole('button', { name: KEYS.accept });
    fireEvent.click(acceptButton);

    expect(screen.getByDisplayValue('AI suggested strength')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: KEYS.accept })).not.toBeInTheDocument();

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'AI suggested strength');
    expect(item.proposalStatus).toBe('accepted');
  });

  // M13 (2026-08-25): rejecting used to hard-delete the item
  // (`removeSWOTItem`) — a decision with no trace. It now stamps
  // `proposalStatus: 'rejected'` (the schema already had this status) so the
  // record survives for audit while still disappearing from the active
  // proposal queue — same UI-visible outcome, different persistence.
  it('rejecting a proposal hides it from the queue but keeps a rejected record', () => {
    useToolStore.getState().addSWOTItem({
      text: 'AI suggested weakness',
      quadrant: 'weaknesses',
      impact: 'medium',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
    });

    render(<Harness />);
    const rejectButton = screen.getByRole('button', { name: KEYS.reject });
    fireEvent.click(rejectButton);

    expect(screen.queryByText('AI suggested weakness')).not.toBeInTheDocument();
    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'AI suggested weakness');
    expect(item).toBeDefined();
    expect(item.proposalStatus).toBe('rejected');
  });
});

/**
 * STREAM G1 (2026-08-13): before the fix, `acceptProposal()` here called
 * `updateSWOTItem(id, {status:'accepted', proposalStatus:'accepted'})`
 * directly, bypassing the evidence gate entirely — an AI proposal claiming
 * `classification: 'core-competency'` with zero linked evidence sailed
 * straight through to `accepted`. These tests prove the fix: the SAME
 * canonical gate (config/swot/swotAcceptGate.ts) the store's own `acceptCard`
 * uses now runs here too.
 */
describe('SWOTBuildPhase — AI proposal accept is gated (STREAM G1 fix)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('BLOCKS accepting a strengths proposal that claims core-competency with no evidence', () => {
    useToolStore.getState().addSWOTItem({
      text: 'We are unmatched in the market',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 5,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
    });

    render(<Harness />);
    const acceptButton = screen.getByRole('button', { name: KEYS.accept });
    fireEvent.click(acceptButton);

    // Still a proposal — the Accept/Reject buttons are still there, proving
    // the item did NOT transition to 'accepted'.
    expect(screen.getByRole('button', { name: KEYS.accept })).toBeInTheDocument();

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'We are unmatched in the market');
    expect(item.proposalStatus).toBe('ai-proposed');
    expect(item.status).not.toBe('accepted');

    // An actionable message is shown inline.
    expect(screen.getByText(/core competency|niche strength/i)).toBeInTheDocument();
  });

  it('ALLOWS accepting the same claim once a linked signal exists, and stamps evidenceStatus honestly', () => {
    useToolStore.getState().addSWOTItem({
      text: 'We are unmatched in the market',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 5,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
      linkedSignalIds: ['signal-abc'],
    });

    render(<Harness />);
    const acceptButton = screen.getByRole('button', { name: KEYS.accept });
    fireEvent.click(acceptButton);

    expect(screen.queryByRole('button', { name: KEYS.accept })).not.toBeInTheDocument();
    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'We are unmatched in the market');
    expect(item.proposalStatus).toBe('accepted');
    expect(item.status).toBe('accepted');
    expect(item.evidenceStatus).toBe('confirmed');
  });

  it('a plain proposal with no classification claim is stamped "declared" honestly (never blocked)', () => {
    useToolStore.getState().addSWOTItem({
      text: 'Emerging regulatory opportunity',
      quadrant: 'opportunities',
      impact: 'medium',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
    });

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: KEYS.accept }));

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Emerging regulatory opportunity');
    expect(item.proposalStatus).toBe('accepted');
    expect(item.evidenceStatus).toBe('declared');
  });

  it('a quick-typed item (quick-add) is also stamped evidenceStatus: "declared"', () => {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    fireEvent.change(strengthsInput, { target: { value: 'Quickly typed strength' } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Quickly typed strength');
    expect(item.status).toBe('accepted');
    expect(item.proposalStatus).toBe('accepted');
    expect(item.evidenceStatus).toBe('declared');
  });
});

describe('SWOTBuildPhase — Evidence & classification editor (STREAM G1, Deliverable A)', () => {
  beforeEach(() => {
    resetStore();
  });

  function addAndOpenEvidencePanel(text: string) {
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    fireEvent.change(strengthsInput, { target: { value: text } });
    fireEvent.keyDown(strengthsInput, { key: 'Enter', code: 'Enter' });
    const toggle = screen
      .getByText('discoveryToolsTools.dynamicSwot.buildPhase.swotPoint')
      .closest('div')?.parentElement?.parentElement as HTMLElement;
    const evidenceToggle = within(toggle).getByRole('button', {
      name: /Evidence & classification|Dowód i klasyfikacja/i,
    });
    fireEvent.click(evidenceToggle);
    return toggle;
  }

  it('lets the user choose an evidence type, description, source, credibility and classification, and persists them', () => {
    const card = addAndOpenEvidencePanel('Best delivery speed in the segment');

    fireEvent.change(within(card).getByLabelText(/Evidence type|Typ dowodu/i), {
      target: { value: 'fact' },
    });
    fireEvent.change(within(card).getByLabelText(/Evidence description|Opis dowodu/i), {
      target: { value: '3 clients cited this in Q2 renewal calls.' },
    });
    fireEvent.change(within(card).getByLabelText(/^Source|Źródło/i), {
      target: { value: 'Q2 renewal call notes' },
    });
    fireEvent.change(within(card).getByLabelText(/Strength \/ credibility|Siła \/ wiarygodność/i), {
      target: { value: '5' },
    });
    fireEvent.change(within(card).getByLabelText(/Strength classification|Klasyfikacja siły/i), {
      target: { value: 'niche-strength' },
    });

    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Best delivery speed in the segment');
    expect(item.evidenceType).toBe('fact');
    expect(item.evidenceNote).toBe('3 clients cited this in Q2 renewal calls.');
    expect(item.evidenceSource).toBe('Q2 renewal call notes');
    expect(item.confidence).toBe(5);
    expect(item.classification).toBe('niche-strength');
  });

  it('round-trips through a save/reload cycle (JSON serialize -> normalize) with identical evidence fields', () => {
    useToolStore.getState().addSWOTItem({
      text: 'Reload-proof item',
      quadrant: 'strengths',
      impact: 'medium',
      confidence: 4,
      status: 'accepted',
      proposalStatus: 'accepted',
      evidenceType: 'observation',
      evidenceNote: 'Seen in three client calls this quarter.',
      evidenceSource: 'Sales call transcripts',
      classification: 'niche-strength',
    });

    const before = useToolStore.getState().currentSession?.inputData;
    // Simulate exactly what crosses the wire on save + reload: the session's
    // inputData is JSON-serialized to the backend (ToolWorkspace.tsx's
    // `Api.updateToolSession({ answers: currentSession.inputData, ... })`)
    // and JSON-parsed back on load — no schema in between strips fields
    // (server/src/validators/tool.validators.ts's `UpdateToolSessionSchema`
    // treats `answers` as an opaque `z.record(string, unknown)`).
    const roundTripped = JSON.parse(JSON.stringify(before));

    const beforeItem = (before as any).items.find((i: any) => i.text === 'Reload-proof item');
    const afterItem = (roundTripped as any).items.find((i: any) => i.text === 'Reload-proof item');
    expect(afterItem).toEqual(beforeItem);
    expect(afterItem.evidenceType).toBe('observation');
    expect(afterItem.evidenceSource).toBe('Sales call transcripts');
    expect(afterItem.classification).toBe('niche-strength');
  });
});
