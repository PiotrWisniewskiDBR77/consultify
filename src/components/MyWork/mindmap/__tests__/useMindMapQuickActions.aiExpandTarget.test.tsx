/**
 * @vitest-environment jsdom
 *
 * CB-05/RB-011 — `idea.element.add`'s AI-expand sibling, `idea.ai.expand_map`,
 * forwards an explicit `nodeId` through the action registry as
 * `detail.nodeId` on the `idea-workspace-quick-action` CustomEvent for the
 * runtime string `mm_ai_expand`. Before this fix, useMindMapQuickActions
 * called `handlers.handleAIExpand()` with no argument for that action,
 * silently discarding the caller's explicit target and expanding from
 * selection/root instead.
 */
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useMindMapQuickActions } from '../useMindMapQuickActions';

function Harness({ handleAIExpand }: { handleAIExpand: (nodeId?: string) => void }) {
  useMindMapQuickActions({
    ideaId: 'idea-1',
    ideaTitle: 'Test idea',
    isPolish: false,
    locked: false,
    nodes: [],
    edges: [],
    layoutMode: 'tree',
    handlers: { handleAIExpand } as any,
    setters: {} as any,
  });
  return null;
}

describe('useMindMapQuickActions — mm_ai_expand target propagation', () => {
  it('forwards an explicit nodeId to handleAIExpand instead of dropping it', () => {
    const handleAIExpand = vi.fn();
    render(<Harness handleAIExpand={handleAIExpand} />);

    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'mm_ai_expand', nodeId: 'branch-42' },
      })
    );

    expect(handleAIExpand).toHaveBeenCalledWith('branch-42');
  });

  it('still calls handleAIExpand with undefined when no explicit target is given (default selection/root)', () => {
    const handleAIExpand = vi.fn();
    render(<Harness handleAIExpand={handleAIExpand} />);

    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', {
        detail: { action: 'mm_ai_expand' },
      })
    );

    expect(handleAIExpand).toHaveBeenCalledWith(undefined);
  });
});
