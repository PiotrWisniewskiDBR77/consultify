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
    t: (key: string) => key,
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
    expect(screen.getByText('ideas.mindmap.comingSoon')).toBeTruthy();
    if (btn) fireEvent.click(btn);
    expect(onAction).not.toHaveBeenCalledWith('mm_ai_cluster');
  });

  it('renders Auto-clustering enabled without badge when flag is ON', () => {
    const onAction = vi.fn();
    render(<AIActionsPopover {...baseProps} onAction={onAction} heuristicAiEnabled />);
    const btn = screen.getByText('Auto-clustering').closest('button');
    expect(btn).toBeTruthy();
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('ideas.mindmap.comingSoon')).toBeNull();
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
    expect(screen.getByText('ideas.mindmap.comingSoon')).toBeTruthy();
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

  // MM-P2 (2026-08-10): `ctx_dependencies`/`ctx_what_if`/`ctx_competitive`
  // moved from the flat first level into the AI flyout submenu (PPM
  // reduction, `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md` §6). They only exist
  // in the DOM once that submenu is open — open it the same way a user
  // would (click the `ctx_group_ai` trigger row) before asserting on them.
  const openAiSubmenu = () => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-command-id="ctx_group_ai"]');
    if (!trigger) throw new Error('AI submenu trigger not found');
    fireEvent.click(trigger);
  };

  it('renders ctx_dependencies disabled with "Coming soon" badge when listed', () => {
    const onAction = vi.fn();
    render(
      <NodeContextMenu {...baseProps} onAction={onAction} comingSoonIds={['ctx_dependencies']} />
    );
    openAiSubmenu();
    const btn = document.querySelector<HTMLButtonElement>('[data-command-id="ctx_dependencies"]');
    expect(btn).toBeTruthy();
    expect(btn).toBeDisabled();
    expect(screen.getByText('ideas.mindmap.comingSoon')).toBeTruthy();
    if (btn) fireEvent.click(btn);
    expect(onAction).not.toHaveBeenCalledWith('ctx_dependencies');
  });

  it('leaves ctx_dependencies clickable when comingSoonIds is empty', () => {
    const onAction = vi.fn();
    render(<NodeContextMenu {...baseProps} onAction={onAction} comingSoonIds={[]} />);
    openAiSubmenu();
    const btn = document.querySelector<HTMLButtonElement>('[data-command-id="ctx_dependencies"]');
    expect(btn).toBeTruthy();
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('ideas.mindmap.comingSoon')).toBeNull();
    if (btn) fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('ctx_dependencies');
  });

  it('does not gate real-LLM context actions (What if, Competitors)', () => {
    render(<NodeContextMenu {...baseProps} comingSoonIds={['ctx_dependencies']} />);
    openAiSubmenu();
    for (const commandId of ['ctx_what_if', 'ctx_competitive']) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-command-id="${commandId}"]`);
      expect(btn, commandId).toBeTruthy();
      expect(btn, commandId).not.toBeDisabled();
    }
  });

  it('MM-P2-03: every AI row exposes its real scope via the shortcut slot', () => {
    render(<NodeContextMenu {...baseProps} comingSoonIds={[]} />);
    openAiSubmenu();
    const expectedScopeByCommandId: Record<string, string> = {
      ctx_ai_rewrite_node: 'myWorkMindmap.ctxMenu.scopeSelection',
      ctx_ai_expand: 'myWorkMindmap.ctxMenu.scopeBranch',
      ctx_ai_deepen: 'myWorkMindmap.ctxMenu.scopeBranch',
      ctx_what_if: 'myWorkMindmap.ctxMenu.scopeSelection',
      ctx_summarize_branch: 'myWorkMindmap.ctxMenu.scopeBranch',
      ctx_dependencies: 'myWorkMindmap.ctxMenu.scopeDocument',
      ctx_priority: 'myWorkMindmap.ctxMenu.scopeDocument',
      ctx_competitive: 'myWorkMindmap.ctxMenu.scopeDocument',
      ai_suggest_links: 'myWorkMindmap.ctxMenu.scopeSelection',
    };
    for (const [commandId, expectedKey] of Object.entries(expectedScopeByCommandId)) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-command-id="${commandId}"]`);
      expect(btn, commandId).toBeTruthy();
      // The i18n mock in this file returns the raw key, so the rendered
      // `<kbd>` text IS the translation key — asserting on it still proves
      // each row asked for the right scope label, not just SOME label.
      expect(btn?.querySelector('kbd')?.textContent, commandId).toBe(expectedKey);
    }
  });
});
