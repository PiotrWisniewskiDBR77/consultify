import { describe, expect, it } from 'vitest';

import { applyAIProposalRuntime } from '../../../src/components/MyWork/aiProposalRuntime';

describe('applyAIProposalRuntime', () => {
  it('preserves parent linkage when moving nodes into a frame', () => {
    const result = applyAIProposalRuntime({
      proposals: [
        {
          id: 'proposal-1',
          type: 'graph_patch',
          rationale: 'group notes',
          confidence: 0.8,
          status: 'accepted',
          patch: {
            moveNodes: [
              {
                nodeId: 'sticky-1',
                parentId: 'frame-1',
                position: { x: 36, y: 88 },
              },
            ],
          },
        },
      ] as any,
      nodes: [
        {
          id: 'sticky-1',
          type: 'stickyNote',
          position: { x: 0, y: 0 },
          data: { label: 'Idea' },
        },
      ],
      edges: [],
      extensions: {},
      activeTool: 'whiteboard',
    });

    expect(result.nodes[0].parentNode).toBe('frame-1');
    expect(result.nodes[0].parentId).toBe('frame-1');
    expect(result.nodes[0].data.parentId).toBe('frame-1');
    expect(result.nodes[0].position).toEqual({ x: 36, y: 88 });
  });

  it('hydrates generated table rows into runtime nodes and switches to table', () => {
    const result = applyAIProposalRuntime({
      proposals: [
        {
          id: 'proposal-2',
          type: 'view_patch',
          rationale: 'convert to table',
          confidence: 0.8,
          status: 'accepted',
          targetTool: 'table',
          patch: {
            extensions: {
              table: {
                columns: [{ key: 'title', header: 'Title' }],
                rows: [{ cells: { title: 'Action 1', owner: 'Ada' }, sourceNodeId: 'sticky-1' }],
                generatedRowNodes: [
                  {
                    id: 'row-1',
                    type: 'idea',
                    position: { x: 120, y: 120 },
                    data: { label: 'Action 1', title: 'Action 1', owner: 'Ada' },
                  },
                ],
              },
            },
          },
        },
      ] as any,
      nodes: [],
      edges: [],
      extensions: {},
      activeTool: 'whiteboard',
    });

    expect(result.nextTool).toBe('table');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.title).toBe('Action 1');
    expect((result.extensions.table as any).generatedRowIds).toEqual(['row-1']);
  });

  it('normalizes parentId from addNodes and exposes cross-tool focus metadata', () => {
    const result = applyAIProposalRuntime({
      proposals: [
        {
          id: 'proposal-3',
          type: 'graph_patch',
          rationale: 'convert to map',
          confidence: 0.9,
          status: 'accepted',
          targetTool: 'mindmap',
          focusNodeId: 'root-1',
          patch: {
            addNodes: [
              {
                id: 'child-1',
                label: 'Child',
                type: 'stickyNote',
                position: { x: 40, y: 60 },
                data: { parentId: 'frame-2' },
              },
            ],
          },
        },
      ] as any,
      nodes: [],
      edges: [],
      extensions: {},
      activeTool: 'whiteboard',
    });

    expect(result.nextTool).toBe('mindmap');
    expect(result.focusObjectId).toBe('root-1');
    expect(result.nodes[0].parentNode).toBe('frame-2');
    expect(result.nodes[0].parentId).toBe('frame-2');
  });
});
