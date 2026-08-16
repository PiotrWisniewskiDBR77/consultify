/**
 * SWOTBuildPhase — accessibility & state coverage (TLS-UI-CANON-001).
 *
 * Context: this repo's lane lease for the closure task TLS-UI-CANON-001
 * (Dynamic SWOT UI canon) contains ZERO Tools/SWOT Playwright specs — the
 * only existing browser spec, tests/e2e/tools/swot-real-pg-resume.spec.ts,
 * is read-only for this lane (may run it, may not edit it or add a sibling).
 * That spec only exercises ONE viewport (1680x1050, the Playwright config
 * default), ONE theme (whatever the app defaults to) and ONE language
 * (English UI copy — the fixture text is English and the spec never flips
 * i18n). It cannot prove keyboard traversal order, visible-focus retention,
 * focus return after a disclosure closes, or PL-language rendering.
 *
 * These component tests are a PARTIAL substitute for that missing browser
 * coverage — they exercise the real zustand store (not a mock) through the
 * same thin harness pattern as SWOTBuildPhase.interaction.test.tsx. What
 * they DO close:
 *   - keyboard-only add-item flow already covered by the sibling file;
 *     here we additionally cover Tab order across a populated card and
 *     the disclosure toggle's aria-expanded + focus-return contract.
 *   - accessible names for the impact <select> (sr-only <label> via
 *     htmlFor/id) and the evidence-editor toggle button.
 *   - the CLIENT-SIDE reject/conflict state: `evaluateSwotAcceptGate`'s
 *     UNVALIDATED_CLASSIFICATION rule surfaces a `role="alert"` inline
 *     error when a proposal claims "core competency"/"niche strength"
 *     with zero linked evidence — the same gate family as the server's
 *     409 EMPTY_TOOL_OUTPUT (TLS-BVP-001) this closure task's brief
 *     pointed at, but reachable synchronously at the component level.
 *   - PL-language rendering of the quadrant chrome.
 *   - the empty-quadrant default/empty state copy.
 *
 * What they explicitly do NOT close (see UI_INVENTORY.md for the full
 * list): real viewport reflow (jsdom has no layout engine), dark-theme
 * *rendering* (only that dark: Tailwind classes are present in markup —
 * jsdom does not evaluate `prefers-color-scheme` or resolve Tailwind
 * classes to colors), color-contrast (an axe "serious" rule that needs a
 * real renderer), and anything server-mediated (autosave, real 409s).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useToolStore } from '@/store/useToolStore';

import { SWOTBuildPhase } from '../SWOTBuildPhase';

const KEYS = {
  addPointPlaceholder: 'discoveryToolsTools.dynamicSwot.buildPhase.addPointPlaceholder',
  swotPoint: 'discoveryToolsTools.dynamicSwot.buildPhase.swotPoint',
  noPoints: 'discoveryToolsTools.dynamicSwot.buildPhase.noPoints',
  accept: 'discoveryToolsTools.dynamicSwot.buildPhase.accept',
  reject: 'discoveryToolsTools.dynamicSwot.buildPhase.reject',
  highImpact: 'discoveryToolsTools.dynamicSwot.quadrantStep.highImpact',
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

describe('SWOTBuildPhase — default/empty state', () => {
  beforeEach(() => {
    resetStore();
  });

  it('shows the empty-quadrant placeholder in all four quadrants when the session has no items', () => {
    render(<Harness />);
    const emptyPlaceholders = screen.getAllByText(KEYS.noPoints);
    expect(emptyPlaceholders).toHaveLength(4);
  });
});

describe('SWOTBuildPhase — accessible names', () => {
  beforeEach(() => {
    resetStore();
  });

  it('associates the impact <select> with its sr-only <label> via htmlFor/id (real accessible name, not just visual text)', () => {
    // Item exists before mount (same convention as the sibling interaction
    // test file) — the store update must be settled before we query, so
    // querying post-mount (rather than post-addSWOTItem-after-render,
    // which requires an explicit act() to avoid a stale query) stays simple.
    useToolStore.getState().addSWOTItem({
      text: 'Accessible-name probe item',
      quadrant: 'strengths',
      impact: 'medium',
      source: 'user',
      confidence: 4,
      status: 'accepted',
      proposalStatus: 'accepted',
    });
    render(<Harness />);

    // getByLabelText only succeeds if the <label htmlFor> / <select id> pair
    // resolves — this is the DOM-level equivalent of axe's "select-name" /
    // "label" rule for this one control.
    const select = screen.getByLabelText(KEYS.highImpact) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('medium');
  });

  it('gives the evidence/classification disclosure toggle an accessible name and aria-expanded state', () => {
    useToolStore.getState().addSWOTItem({
      text: 'Disclosure probe item',
      quadrant: 'strengths',
      impact: 'medium',
      source: 'user',
      confidence: 4,
      status: 'accepted',
      proposalStatus: 'accepted',
    });
    render(<Harness />);

    const toggle = screen.getByRole('button', { name: /Evidence & classification|Dowód i klasyfikacja/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('SWOTBuildPhase — keyboard traversal and focus', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Tab reaches the Strengths add-input, then its Add button, in that order once the button is enabled', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const [strengthsInput] = screen.getAllByPlaceholderText(KEYS.addPointPlaceholder);
    const addButton = strengthsInput.parentElement?.querySelector('button') as HTMLButtonElement;
    expect(addButton).toBeTruthy();

    // The Add button is `disabled` while the input is empty (QuadrantCard's
    // `disabled={!draft.trim()}`) — a disabled control is correctly skipped
    // by Tab, so proving traversal order requires typing first, exactly as
    // a real user would before ever reaching the button. Verified here
    // structurally: without text, Tab does NOT land on the (disabled) button.
    strengthsInput.focus();
    await user.tab();
    expect(document.activeElement).not.toBe(addButton);

    await user.click(strengthsInput);
    await user.type(strengthsInput, 'Traversal probe');
    expect(addButton.disabled).toBe(false);

    await user.tab();
    expect(document.activeElement).toBe(addButton);
  });

  it('keeps focus on the evidence-editor toggle across an open -> close cycle (no focus loss when the disclosure collapses)', async () => {
    const user = userEvent.setup();
    useToolStore.getState().addSWOTItem({
      text: 'Focus-return probe item',
      quadrant: 'strengths',
      impact: 'medium',
      source: 'user',
      confidence: 4,
      status: 'accepted',
      proposalStatus: 'accepted',
    });
    render(<Harness />);

    const toggle = screen.getByRole('button', { name: /Evidence & classification|Dowód i klasyfikacja/i });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);

    // Open.
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(toggle);

    // Close. This is the exact gap named in the closure brief ("focus
    // return after a modal/drawer closes") — EvidenceEditor is a disclosure,
    // not a modal, so there is no separate trigger to return focus TO; the
    // contract that matters here is that closing it never silently drops
    // focus to <body>.
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggle);
    expect(document.activeElement).not.toBe(document.body);
  });
});

describe('SWOTBuildPhase — client-side conflict/reject state (evaluateSwotAcceptGate)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('blocks accepting a proposal that claims "core competency" with zero linked evidence, and surfaces an actionable role="alert"', () => {
    useToolStore.getState().addSWOTItem({
      text: 'Unproven core-competency claim',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
      // Deliberately no linkedSignalIds / evidenceNote / staircase.factRefs —
      // this is what makes evaluateSwotAcceptGate return
      // UNVALIDATED_CLASSIFICATION (src/config/swot/swotAcceptGate.ts).
    });

    render(<Harness />);

    const acceptButtons = screen.getAllByRole('button', { name: KEYS.accept });
    expect(acceptButtons).toHaveLength(1);
    fireEvent.click(acceptButtons[0]);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      /core competency|niche strength|rdzeń kompetencji|nisza/i
    );

    // The item must still be a pending proposal — the gate blocked the
    // transition to accepted, exactly like the server's 409 EMPTY_TOOL_OUTPUT
    // blocks an unqualified promotion (same "no unearned conclusion" family
    // of rule, enforced at two different layers).
    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Unproven core-competency claim');
    expect(item.status).toBe('proposed');
    expect(item.proposalStatus).toBe('ai-proposed');
  });

  it('accepts the same proposal once it carries an evidence note (gate clears, alert disappears)', () => {
    useToolStore.getState().addSWOTItem({
      text: 'Now-evidenced core-competency claim',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
      evidenceNote: 'Confirmed via three independent client interviews.',
    });

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: KEYS.accept }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const items = useToolStore.getState().currentSession?.inputData as any;
    const item = items.items.find((i: any) => i.text === 'Now-evidenced core-competency claim');
    expect(item.status).toBe('accepted');
    expect(item.proposalStatus).toBe('accepted');
    expect(item.evidenceStatus).toBe('confirmed');
  });
});

describe('SWOTBuildPhase — PL language rendering', () => {
  beforeEach(() => {
    resetStore();
  });

  it('renders Polish quadrant titles and subtitles when isPolish=true', () => {
    render(<Harness isPolish />);
    expect(screen.getByText('Mocne strony')).toBeInTheDocument();
    expect(screen.getByText('Wewnętrzne przewagi')).toBeInTheDocument();
    expect(screen.getByText('Słabe strony')).toBeInTheDocument();
    expect(screen.getByText('Szanse')).toBeInTheDocument();
    expect(screen.getByText('Zagrożenia')).toBeInTheDocument();
  });

  it('renders the Polish gate message for the same core-competency conflict state', () => {
    useToolStore.getState().addSWOTItem({
      text: 'Niepotwierdzona kompetencja rdzeniowa',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 3,
      status: 'proposed',
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
    });

    render(<Harness isPolish />);
    fireEvent.click(screen.getByRole('button', { name: KEYS.accept }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/rdzeń kompetencji|nisza/i);
  });
});

describe('SWOTBuildPhase — dark-theme class presence (structural only, not rendered color)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('emits dark: Tailwind variants on the quadrant surface and the empty-state placeholder', () => {
    const { container } = render(<Harness />);
    // jsdom does not apply CSS, so this cannot prove contrast or the actual
    // rendered dark palette — it only proves the component AUTHORS a dark
    // variant at all, which is the one thing a static DOM check can honestly
    // assert. Real dark-theme verification belongs to the browser evidence
    // this lane could not obtain (see UI_INVENTORY.md).
    const html = container.innerHTML;
    expect(html).toMatch(/dark:border-emerald-900/);
    expect(html).toMatch(/dark:bg-navy-950\/30/);
  });
});
