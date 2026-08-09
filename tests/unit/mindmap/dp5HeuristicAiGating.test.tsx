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

  it('renders ctx_dependencies disabled with "Coming soon" badge when listed', () => {
    const onAction = vi.fn();
    render(
      <NodeContextMenu {...baseProps} onAction={onAction} comingSoonIds={['ctx_dependencies']} />
    );
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
    const btn = document.querySelector<HTMLButtonElement>('[data-command-id="ctx_dependencies"]');
    expect(btn).toBeTruthy();
    expect(btn).not.toBeDisabled();
    expect(screen.queryByText('ideas.mindmap.comingSoon')).toBeNull();
    if (btn) fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledWith('ctx_dependencies');
  });

  it('does not gate real-LLM context actions (What if, Competitors)', () => {
    render(<NodeContextMenu {...baseProps} comingSoonIds={['ctx_dependencies']} />);
    for (const commandId of ['ctx_what_if', 'ctx_competitive']) {
      const btn = document.querySelector<HTMLButtonElement>(`[data-command-id="${commandId}"]`);
      expect(btn, commandId).toBeTruthy();
      expect(btn, commandId).not.toBeDisabled();
    }
  });
});
