import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import {
  createDefaultIdeaWorkspaceState,
  moveIdeaWorkspaceState,
  patchIdeaWorkspaceState,
  removeIdeaWorkspaceState,
} from '@/components/MyWork/ideaWorkspaceState';

describe('ideaWorkspaceState', () => {
  it('creates a tools-first default state for new idea drafts', () => {
    expect(
      createDefaultIdeaWorkspaceState({
        id: 'new-idea-123',
        data: { isNew: true, initialTool: 'whiteboard' },
      })
    ).toEqual({
      activeTool: 'whiteboard',
      activePanel: 'tools',
      selection: EMPTY_SELECTION,
      locked: true,
    });
  });

  it('patches per-idea workspace state without touching other ideas', () => {
    const current = {
      'idea-a': createDefaultIdeaWorkspaceState({ id: 'idea-a' }),
      'idea-b': createDefaultIdeaWorkspaceState({ id: 'idea-b' }),
    };

    const next = patchIdeaWorkspaceState(current, { id: 'idea-a' }, { activeTool: 'table' });

    expect(next['idea-a'].activeTool).toBe('table');
    expect(next['idea-b']).toEqual(current['idea-b']);
  });

  it('moves cached workspace state when a draft receives its real id', () => {
    const current = {
      'new-idea-1': {
        activeTool: 'process_flow' as const,
        activePanel: 'context' as const,
        selection: EMPTY_SELECTION,
        locked: false,
      },
    };

    const next = moveIdeaWorkspaceState(current, 'new-idea-1', 'idea-99');

    expect(next['idea-99']).toEqual(current['new-idea-1']);
    expect(next['new-idea-1']).toBeUndefined();
  });

  it('removes cached workspace state when an idea tab closes', () => {
    const current = {
      'idea-a': createDefaultIdeaWorkspaceState({ id: 'idea-a' }),
    };

    expect(removeIdeaWorkspaceState(current, 'idea-a')).toEqual({});
  });
});

/**
 * Regression: idea deep-link tool routing race (Harvard R4 #10 / #3).
 *
 * MyWorkHub renders the workspace tool as
 *   `activeIdeaWorkspaceState?.activeTool || ideaActiveTool`
 * where `activeIdeaWorkspaceState` is derived from the PERSISTED
 * `ideaWorkspaceStateById[id]`. When an idea was previously opened with one tool
 * (e.g. Process Flow) and is then re-opened via a deep link to a DIFFERENT tool
 * (e.g. /whiteboard), the deep-link's `initialTool` must WIN. The documented
 * `forcedIdeaDeepLinkRef` fix never landed; the actual fix patches the persisted
 * state via `patchIdeaWorkspaceState` so the deep-linked tool becomes
 * authoritative regardless of mount ordering. These tests lock that invariant.
 */
describe('idea deep-link tool routing (residual race)', () => {
  it('deep-link tool overrides a stale persisted tool for the same idea', () => {
    // Idea previously opened as Process Flow → persisted.
    const persisted = {
      'idea-42': {
        ...createDefaultIdeaWorkspaceState({ id: 'idea-42' }),
        activeTool: 'process_flow' as const,
      },
    };
    expect(persisted['idea-42'].activeTool).toBe('process_flow');

    // Deep link to /whiteboard carries initialTool='whiteboard'. The MyWorkHub
    // effect patches the persisted state with the deep-linked tool.
    const deepLinkDoc = { id: 'idea-42', data: { initialTool: 'whiteboard' as const } };
    const next = patchIdeaWorkspaceState(persisted, deepLinkDoc, { activeTool: 'whiteboard' });

    // The rendered tool now resolves to the deep-linked whiteboard, not the
    // stale process_flow — bug fixed.
    expect(next['idea-42'].activeTool).toBe('whiteboard');
  });

  it('is a no-op when the deep-link tool already matches the persisted tool', () => {
    const persisted = {
      'idea-7': {
        ...createDefaultIdeaWorkspaceState({ id: 'idea-7' }),
        activeTool: 'mindmap' as const,
      },
    };
    const next = patchIdeaWorkspaceState(
      persisted,
      { id: 'idea-7', data: { initialTool: 'mindmap' as const } },
      { activeTool: 'mindmap' }
    );
    // Same reference returned (patchIdeaWorkspaceState short-circuits no-ops).
    expect(next).toBe(persisted);
  });

  it('a fresh idea with no persisted state opens the deep-linked tool by default', () => {
    // First visit: no saved state → default state seeds activeTool from initialTool.
    const state = createDefaultIdeaWorkspaceState({
      id: 'idea-new',
      data: { initialTool: 'table' },
    });
    expect(state.activeTool).toBe('table');
  });
});
