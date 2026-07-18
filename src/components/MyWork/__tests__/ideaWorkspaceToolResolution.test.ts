/**
 * H2.3 (M06 "Mind Map otwiera Process Flow") — FE tool-resolution mapping.
 *
 * The initial active tool of the idea workspace is a pure mapping over the
 * opened doc's `initialTool` (createDefaultIdeaWorkspaceState). Contract:
 *   - an explicit deep-link tool (`initialTool`) is AUTHORITATIVE and maps 1:1
 *     (mindmap→mindmap, process_flow→process_flow — never crossed);
 *   - with NO `initialTool`, the default is `mindmap` so that the idea's real,
 *     server-saved `preferredTool` (restored async in IdeaMapWorkspace.hydrate)
 *     governs which tool actually opens.
 *
 * The H2.3 bug was NOT in this mapping but in IdeaMapWorkspace: a stale `?tool=`
 * URL query param (written by setActiveTool as a cosmetic mirror, and surviving
 * the per-idea remount) was read on mount and set `userSelectedToolRef=true`,
 * which SUPPRESSED the async `savedPref` restore — so opening a Process-Flow
 * idea then a Mind-Map idea left the Mind-Map idea stuck on Process Flow. The
 * fix removes that stale param read. This test locks the mapping contract the
 * fix relies on.
 */
import { describe, expect, it } from 'vitest';

import type { CanvasToolType } from '../ideaSelectionTypes';
import { createDefaultIdeaWorkspaceState } from '../ideaWorkspaceState';

describe('H2.3 — idea workspace initial tool resolution', () => {
  it('maps an explicit mindmap deep-link to the mindmap tool (never process_flow)', () => {
    const state = createDefaultIdeaWorkspaceState({
      id: 'idea-1',
      data: { initialTool: 'mindmap' },
    });
    expect(state.activeTool).toBe('mindmap');
  });

  it('maps an explicit process_flow deep-link to the process_flow tool (the inverse)', () => {
    const state = createDefaultIdeaWorkspaceState({
      id: 'idea-2',
      data: { initialTool: 'process_flow' },
    });
    expect(state.activeTool).toBe('process_flow');
  });

  it('maps table and whiteboard deep-links 1:1 as well', () => {
    const cases: CanvasToolType[] = ['table', 'whiteboard'];
    for (const tool of cases) {
      const state = createDefaultIdeaWorkspaceState({
        id: `idea-${tool}`,
        data: { initialTool: tool },
      });
      expect(state.activeTool).toBe(tool);
    }
  });

  it('defaults to mindmap when no deep-link tool is provided, so server preferredTool governs', () => {
    expect(createDefaultIdeaWorkspaceState({ id: 'idea-3' }).activeTool).toBe('mindmap');
    expect(createDefaultIdeaWorkspaceState({ id: 'idea-4', data: {} }).activeTool).toBe('mindmap');
    expect(createDefaultIdeaWorkspaceState(null).activeTool).toBe('mindmap');
  });
});
