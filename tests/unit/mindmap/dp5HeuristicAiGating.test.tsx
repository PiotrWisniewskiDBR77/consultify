/**
 * DP-5 (honest AI overlays) — gating tests for heuristic mind-map AI actions.
 *
 * Heuristic components (result NOT real LLM output) are hidden behind the
 * `mindmapHeuristicAiOverlays` feature flag (default OFF):
 * - AIBranchBalancer   — no LLM call at all (pure node/edge arithmetic)
 * - AISentimentOverlay — sentiment = client confidence-threshold mapping
 * - AIAutoClustering   — cluster membership = client substring matching
 * - AIDependencyDetector — node pairs default to indices backend never returns
 *
 * Entry points show a bilingual "Wkrótce / Coming soon" label while gated.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

// useFeatureFlags imports @/services/api (remote flag fetch) — keep the test hermetic.
vi.mock('@/services/api', () => ({
  API_URL: 'http://localhost/test-api',
  getHeaders: () => ({}),
}));

import { DEFAULT_FLAGS } from '@/hooks/useFeatureFlags';
import { AIActionsPopover } from '@/components/MyWork/mindmap/toolbar-popovers/AIActionsPopover';
import { NodeContextMenu } from '@/components/MyWork/mindmap/NodeContextMenu';
import { PaneContextMenu } from '@/components/MyWork/mindmap/PaneContextMenu';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

describe('DP-5: mindmapHeuristicAiOverlays flag definition', () => {
  it('is registered and OFF by default', () => {
    const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapHeuristicAiOverlays');
    expect(flag).toBeTruthy();
    expect(flag?.defaultValue).toBe(false);
    expect(flag?.category).toBe('ai');
  });
});

describe('DP-5: AIActionsPopover heuristic action gating', () => {
  const baseProps = {
    isPl: false,
    selection: EMPTY_SELECTION,
    onAction: vi.fn(),
    onOpenChat: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders Auto-clustering disabled with "Coming soon" when flag is OFF (default)', () => {
    const onAction = vi.fn();
    render(<AIActionsPopover {...baseProps} onAction={onAction} />);
    const btn = screen.getByText('Auto-clustering').closest('button');
    expect(btn).toBeTruthy();
    expect(btn).toBeDisabled();
    expect(screen.getByText('Coming soon')).toBeTruthy();
    if (btn) fireEvent.click(btn);
    expect(onAction).not.toHaveBeenCalledWith('mm_ai_cluster');
  });

  it('renders Auto-clustering enabled without badge when flag is ON', () => {
    const onAction = vi.fn();
    render(<AIActionsPopover {...baseProps} onAction={onAction} heuristicAiEnabled />);
    const btn = screen.getByText('Auto-clustering').closest('button');
    expect(btn).toBeTruthy();
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('Coming soon')).toBeNull();
    if (btn) fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('mm_ai_cluster');
  });

  it('does not gate real-LLM generators (gap analysis, expand, summary)', () => {
    render(<AIActionsPopover {...baseProps} />);
    for (const label of ['Gap analysis', 'Expand map (AI)', 'Map summary']) {
      const btn = screen.getByText(label).closest('button');
      expect(btn, label).toBeTruthy();
      expect(btn, label).not.toBeDisabled();
    }
  });

  it('renders the comingSoon badge key when isPl (badge text now flows through t(), not the isPl prop)', () => {
    render(<AIActionsPopover {...baseProps} isPl />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});

describe('DP-5: NodeContextMenu comingSoonIds gating', () => {
  const baseProps = {
    x: 10,
    y: 10,
    nodeId: 'node-1',
    nodeType: 'idea',
    isLocked: false,
    isPl: false,
    onClose: vi.fn(),
    onAction: vi.fn(),
  };

  // MM-P2 (2026-08-10): AI rows moved from the flat first level into the AI
  // flyout submenu (PPM reduction, `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md`
  // §6). They only exist in the DOM once that submenu is open — open it the
  // same way a user would (click the `ctx_group_ai` trigger row) before
  // asserting on them.
  const openAiSubmenu = () => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-command-id="ctx_group_ai"]');
    if (!trigger) throw new Error('AI submenu trigger not found');
    fireEvent.click(trigger);
  };

  // E10 (2026-08-10): `ctx_dependencies`/`ctx_priority`/`ctx_competitive`
  // MOVED to PaneContextMenu (`pane_dependencies`/`pane_priority`/
  // `pane_competitive`, see the "DP-5: PaneContextMenu" describe block
  // below) — those generators take the whole map regardless of which node
  // was clicked, so they no longer render inside NodeContextMenu at all.
  // `ctx_ai_deepen` was REMOVED entirely (byte-identical duplicate of
  // `ctx_ai_expand`, see NodeContextMenu.tsx's header comment) — the AI
  // submenu now has one fewer row for both reasons.

  it('MM-P2-03/E10: every remaining AI row exposes its real scope via the shortcut slot', () => {
    render(<NodeContextMenu {...baseProps} comingSoonIds={[]} />);
    openAiSubmenu();
    const expectedScopeByCommandId: Record<string, string> = {
      ctx_ai_rewrite_node: 'Selection',
      ctx_ai_expand: 'Branch',
      ctx_what_if: 'Selection',
      ctx_summarize_branch: 'Branch',
      ai_suggest_links: 'Selection',
    };
    for (const [commandId, expectedKey] of Object.entries(expectedScopeByCommandId)) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-command-id="${commandId}"]`);
      expect(btn, commandId).toBeTruthy();
      // Assert the rendered scope label, not an internal translation key.
      expect(btn?.querySelector('kbd')?.textContent, commandId).toBe(expectedKey);
    }
  });

  it('E10: ctx_ai_deepen no longer exists (merged into ctx_ai_expand)', () => {
    render(<NodeContextMenu {...baseProps} comingSoonIds={[]} />);
    openAiSubmenu();
    expect(document.querySelector('[data-command-id="ctx_ai_deepen"]')).toBeNull();
  });

  it('E10: whole-map AI generators no longer render inside the node menu', () => {
    render(<NodeContextMenu {...baseProps} comingSoonIds={[]} />);
    openAiSubmenu();
    for (const commandId of ['ctx_dependencies', 'ctx_priority', 'ctx_competitive']) {
      expect(document.querySelector(`[data-command-id="${commandId}"]`), commandId).toBeNull();
    }
  });
});

describe('DP-5/E10: PaneContextMenu comingSoonIds gating (canvas-background AI)', () => {
  const baseProps = {
    x: 10,
    y: 10,
    canvasX: 0,
    canvasY: 0,
    isPl: false,
    isLocked: false,
    canUndo: false,
    canRedo: false,
    canPaste: false,
    hasSelection: false,
    onClose: vi.fn(),
    onAction: vi.fn(),
  };

  it('renders pane_dependencies disabled with "Coming soon" badge when listed', () => {
    const onAction = vi.fn();
    render(
      <PaneContextMenu {...baseProps} onAction={onAction} comingSoonIds={['pane_dependencies']} />
    );
    const btn = document.querySelector<HTMLButtonElement>('[data-command-id="pane_dependencies"]');
    expect(btn).toBeTruthy();
    expect(btn).toBeDisabled();
    expect(screen.getByText('Coming soon')).toBeTruthy();
    if (btn) fireEvent.click(btn);
    expect(onAction).not.toHaveBeenCalledWith('pane_dependencies');
  });

  it('leaves pane_dependencies clickable when comingSoonIds is empty', () => {
    const onAction = vi.fn();
    render(<PaneContextMenu {...baseProps} onAction={onAction} comingSoonIds={[]} />);
    const btn = document.querySelector<HTMLButtonElement>('[data-command-id="pane_dependencies"]');
    expect(btn).toBeTruthy();
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('Coming soon')).toBeNull();
    if (btn) fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('pane_dependencies');
  });

  it('does not gate real-LLM pane actions (Prioritize, Competitors)', () => {
    render(<PaneContextMenu {...baseProps} comingSoonIds={['pane_dependencies']} />);
    for (const commandId of ['pane_priority', 'pane_competitive']) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-command-id="${commandId}"]`);
      expect(btn, commandId).toBeTruthy();
      expect(btn, commandId).not.toBeDisabled();
    }
  });
});
