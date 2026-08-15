/**
 * A2 — useWhiteboardQuickActions AI quick actions.
 *
 * The hook listens to `idea-workspace-quick-action` CustomEvents and must route
 * the wb_ai_* actions to handlers.runAIAction with the backend generatorType
 * (generate→preview→apply flow; whiteboardCanon AC-05 — no silent apply).
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useWhiteboardQuickActions,
  type WhiteboardQuickActionHandlers,
} from '@/components/MyWork/whiteboard/useWhiteboardQuickActions';

function makeHandlers(): WhiteboardQuickActionHandlers {
  return {
    addElement: vi.fn(),
    deleteSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    groupSelected: vi.fn(),
    ungroupSelected: vi.fn(),
    distributeNodes: vi.fn(),
    runAIAction: vi.fn(),
  };
}

const Harness: React.FC<{ open: boolean; handlers: WhiteboardQuickActionHandlers }> = ({
  open,
  handlers,
}) => {
  useWhiteboardQuickActions({ open, handlers });
  return null;
};

function dispatchQuickAction(action: string) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', { detail: { action } })
    );
  });
}

describe('useWhiteboardQuickActions — AI quick actions (A2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const AI_CASES: Array<[string, string]> = [
    ['wb_ai_find_themes', 'wb_find_themes'],
    ['wb_ai_name_clusters', 'wb_name_clusters'],
    ['wb_ai_to_map', 'wb_to_map_branches'],
    ['wb_ai_to_table', 'wb_to_table'],
    ['wb_ai_extract_actions', 'wb_extract_actions'],
  ];

  for (const [action, generatorType] of AI_CASES) {
    it(`routes ${action} → runAIAction('${generatorType}')`, () => {
      const handlers = makeHandlers();
      render(<Harness open handlers={handlers} />);

      dispatchQuickAction(action);

      expect(handlers.runAIAction).toHaveBeenCalledTimes(1);
      expect(handlers.runAIAction).toHaveBeenCalledWith(generatorType);
      // AI actions must not fall through to element creation
      expect(handlers.addElement).not.toHaveBeenCalled();
    });
  }

  it('does nothing when the whiteboard is closed', () => {
    const handlers = makeHandlers();
    render(<Harness open={false} handlers={handlers} />);

    dispatchQuickAction('wb_ai_find_themes');

    expect(handlers.runAIAction).not.toHaveBeenCalled();
  });

  it('ignores unknown actions and tolerates a missing runAIAction handler', () => {
    const handlers = makeHandlers();
    delete (handlers as any).runAIAction;
    render(<Harness open handlers={handlers} />);

    expect(() => {
      dispatchQuickAction('wb_ai_find_themes');
      dispatchQuickAction('wb_ai_unknown_action');
    }).not.toThrow();
    expect(handlers.addElement).not.toHaveBeenCalled();
  });

  it('keeps existing primitive actions working alongside AI routing', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} />);

    dispatchQuickAction('wb_add_sticky');

    expect(handlers.addElement).toHaveBeenCalledWith('sticky', undefined);
    expect(handlers.runAIAction).not.toHaveBeenCalled();
  });

  it('wb_ai_summarize is retired (no UI dispatches it): no longer routes to runAIAction', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} />);

    dispatchQuickAction('wb_ai_summarize');

    expect(handlers.runAIAction).not.toHaveBeenCalled();
    expect(handlers.addElement).not.toHaveBeenCalled();
  });
});
