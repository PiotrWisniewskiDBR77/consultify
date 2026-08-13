import { describe, expect, it } from 'vitest';

import {
  buildIdeaWorkspaceBreadcrumb,
  buildIdeaWorkspacePath,
  parseIdeaWorkspaceTool,
} from '../ideaWorkspaceNavigation';

describe('idea workspace navigation contract', () => {
  it.each([
    ['mindmap', 'mindmap'],
    ['mind-map', 'mindmap'],
    ['process-flow', 'process_flow'],
    ['process_flow', 'process_flow'],
    ['flow', 'process_flow'],
    ['table', 'table'],
    ['whiteboard', 'whiteboard'],
  ] as const)('normalizes %s to %s', (slug, tool) => {
    expect(parseIdeaWorkspaceTool(slug)).toBe(tool);
  });

  it('builds one canonical, encoded path for every native tool', () => {
    expect(buildIdeaWorkspacePath('idea / 1', 'mindmap')).toBe(
      '/my-work/ideas/idea%20%2F%201/workspace/mindmap'
    );
    expect(buildIdeaWorkspacePath('idea-1', 'process_flow')).toBe(
      '/my-work/ideas/idea-1/workspace/process-flow'
    );
    expect(buildIdeaWorkspacePath('idea-1', 'table')).toBe('/my-work/ideas/idea-1/workspace/table');
    expect(buildIdeaWorkspacePath('idea-1', 'whiteboard')).toBe(
      '/my-work/ideas/idea-1/workspace/whiteboard'
    );
  });

  it('builds the same navigable hierarchy as the Materials studios', () => {
    expect(
      buildIdeaWorkspaceBreadcrumb(
        'My Work',
        'Ideas',
        'Growth plan',
        'idea-1',
        'Process Flow',
        'process_flow'
      )
    ).toEqual([
      { label: 'My Work', to: '/my-work' },
      { label: 'Ideas', to: '/my-work/ideas' },
      { label: 'Growth plan', to: '/my-work/ideas/idea-1' },
      { label: 'Process Flow', to: '/my-work/ideas/idea-1/workspace/process-flow' },
    ]);
  });
});
