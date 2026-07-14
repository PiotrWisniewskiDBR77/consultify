/**
 * F-processflow-dead-actions — pf_create / pf_add_step / pf_analyze.
 *
 * processFlowIntentDetector.ts (chat "stwórz proces X" / "analizuj proces" /
 * "dodaj krok") emits pf_create / pf_add_step / pf_analyze, but
 * useProcessFlowQuickActions previously had no branch for them — a silent
 * dead-end (see IdeaMapWorkspace's mm_* equivalent, fixed in parallel).
 *
 * This test locks in the fix: the hook must route these to the real,
 * existing AI handlers (createFromPrompt → flow_generator,
 * runProcessCoach → process_coach) or the plain addNode('action') alias,
 * NOT drop them silently.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useProcessFlowQuickActions,
  type ProcessFlowQuickActionHandlers,
} from '@/components/MyWork/processflow/useProcessFlowQuickActions';

function makeHandlers(): ProcessFlowQuickActionHandlers {
  return {
    addNode: vi.fn(),
    insertAutomationTrigger: vi.fn(),
    addLane: vi.fn(),
    insertBetween: vi.fn(),
    splitPath: vi.fn(),
    deleteSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    openMetricsEditor: vi.fn(),
    runSavingsAnalysis: vi.fn(),
    createFromPrompt: vi.fn(),
    runProcessCoach: vi.fn(),
  };
}

function makeSetters() {
  return {
    setFlowMode: vi.fn(),
    setSemanticKit: vi.fn(),
    setNodes: vi.fn(),
  };
}

const Harness: React.FC<{
  open: boolean;
  handlers: ProcessFlowQuickActionHandlers;
  setters: ReturnType<typeof makeSetters>;
}> = ({ open, handlers, setters }) => {
  useProcessFlowQuickActions({
    open,
    ideaId: 'idea-1',
    isPl: false,
    nodes: [],
    handlers,
    setters: setters as any,
  });
  return null;
};

function dispatchQuickAction(action: string, extra?: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('idea-workspace-quick-action', { detail: { action, ...extra } })
    );
  });
}

describe('useProcessFlowQuickActions — pf_create / pf_add_step / pf_analyze (dead-action fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pf_create routes to createFromPrompt with the chat prompt text', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} setters={makeSetters()} />);

    dispatchQuickAction('pf_create', { prompt: 'stwórz proces onboardingu klienta' });

    expect(handlers.createFromPrompt).toHaveBeenCalledTimes(1);
    expect(handlers.createFromPrompt).toHaveBeenCalledWith(
      'stwórz proces onboardingu klienta'
    );
    expect(handlers.addNode).not.toHaveBeenCalled();
  });

  it('pf_create tolerates a missing prompt (empty string, no throw)', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} setters={makeSetters()} />);

    expect(() => dispatchQuickAction('pf_create')).not.toThrow();
    expect(handlers.createFromPrompt).toHaveBeenCalledWith('');
  });

  it('pf_add_step routes to addNode("action") — same shape as pf_add_action', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} setters={makeSetters()} />);

    dispatchQuickAction('pf_add_step');

    expect(handlers.addNode).toHaveBeenCalledWith('action');
  });

  it('pf_analyze routes to runProcessCoach (real process_coach AI pipeline)', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} setters={makeSetters()} />);

    dispatchQuickAction('pf_analyze');

    expect(handlers.runProcessCoach).toHaveBeenCalledTimes(1);
    expect(handlers.runSavingsAnalysis).not.toHaveBeenCalled();
  });

  it('does nothing when the process flow tool is closed', () => {
    const handlers = makeHandlers();
    render(<Harness open={false} handlers={handlers} setters={makeSetters()} />);

    dispatchQuickAction('pf_create', { prompt: 'x' });
    dispatchQuickAction('pf_analyze');

    expect(handlers.createFromPrompt).not.toHaveBeenCalled();
    expect(handlers.runProcessCoach).not.toHaveBeenCalled();
  });

  it('existing pf_add_action / pf_savings_analysis keep working unchanged', () => {
    const handlers = makeHandlers();
    render(<Harness open handlers={handlers} setters={makeSetters()} />);

    dispatchQuickAction('pf_add_action');
    expect(handlers.addNode).toHaveBeenCalledWith('action');

    dispatchQuickAction('pf_savings_analysis');
    expect(handlers.runSavingsAnalysis).toHaveBeenCalledTimes(1);
  });
});
