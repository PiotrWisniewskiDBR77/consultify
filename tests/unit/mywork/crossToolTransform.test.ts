import { describe, expect, it } from 'vitest';

import { toProcessFlow, toTable, toWhiteboard } from '../../../src/components/MyWork/transforms/crossToolTransform';

const baseNode = {
  id: 'node-1',
  type: 'idea',
  position: { x: 0, y: 0 },
  data: {
    label: 'Root cause branch',
    branchKey: 'risks',
    status: 'validated',
    tags: ['risk', 'priority'],
    evidenceLinks: [{ id: 'ev-1', type: 'url', title: 'Research' }],
    artifactLinks: [{ artifactRef: { type: 'initiative', id: 'init-1' }, label: 'INIT-1' }],
  },
} as any;

describe('crossToolTransform', () => {
  it('keeps source traceability in table output', () => {
    const result = toTable({
      sourceTool: 'mindmap',
      nodes: [baseNode],
      edges: [],
      selectedIds: ['node-1'],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data.sourceTrace).toMatchObject({
      sourceNodeId: 'node-1',
      sourceTool: 'mindmap',
      sourceBranchKey: 'risks',
      sourceStatus: 'validated',
      evidenceCount: 1,
      artifactLinkCount: 1,
    });
    expect(result.rows[0].data.tags).toEqual(['risk', 'priority']);
    expect(result.rows[0].data.artifactLinks).toHaveLength(1);
  });

  it('adds source traceability to whiteboard nodes', () => {
    const result = toWhiteboard({
      sourceTool: 'mindmap',
      nodes: [baseNode],
      edges: [],
      selectedIds: ['node-1'],
    });

    expect(result.nodes[0].data.sourceTrace.sourceNodeId).toBe('node-1');
    expect(result.nodes[0].data.artifactLinks).toHaveLength(1);
  });

  it('adds source traceability to process flow nodes', () => {
    const result = toProcessFlow({
      sourceTool: 'mindmap',
      nodes: [baseNode],
      edges: [],
      selectedIds: ['node-1'],
    });

    const actionNode = result.nodes.find((node: any) => node.data?.sourceTrace);
    expect(actionNode?.data.sourceTrace).toMatchObject({
      sourceNodeId: 'node-1',
      sourceTool: 'mindmap',
    });
    expect(actionNode?.data.tags).toEqual(['risk', 'priority']);
  });
});
