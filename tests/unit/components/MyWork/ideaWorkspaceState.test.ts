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
