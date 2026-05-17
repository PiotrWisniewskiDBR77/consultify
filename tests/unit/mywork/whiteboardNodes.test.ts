import { describe, expect, it } from 'vitest';

import {
  buildDuplicateSelection,
} from '../../../src/components/MyWork/whiteboard/useWhiteboardNodes';

describe('buildDuplicateSelection', () => {
  it('remaps duplicated edges to duplicated node ids', () => {
    const result = buildDuplicateSelection(
      [
        {
          id: 'node-a',
          selected: true,
          position: { x: 10, y: 20 },
          data: { label: 'A' },
        },
        {
          id: 'node-b',
          selected: true,
          position: { x: 120, y: 20 },
          data: { label: 'B' },
        },
      ] as any,
      [
        {
          id: 'edge-a-b',
          source: 'node-a',
          target: 'node-b',
          data: { label: 'rel' },
        },
      ] as any
    );

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source).toBe(result.nodes[0].id);
    expect(result.edges[0].target).toBe(result.nodes[1].id);
    expect(result.edges[0].source).not.toBe('node-a');
    expect(result.edges[0].target).not.toBe('node-b');
  });

  it('skips locked nodes when duplicating a selection', () => {
    const result = buildDuplicateSelection(
      [
        {
          id: 'locked-node',
          selected: true,
          position: { x: 10, y: 20 },
          data: { label: 'Locked', locked: true },
        },
        {
          id: 'open-node',
          selected: true,
          position: { x: 120, y: 20 },
          data: { label: 'Open' },
        },
      ] as any,
      [] as any
    );

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].data.locked).toBe(false);
    expect(result.nodes[0].data.sourceNodeId).toBe('open-node');
  });

  it('keeps duplicated edge endpoints aligned with duplicated nodes when ids are generated once', () => {
    const result = buildDuplicateSelection(
      [
        {
          id: 'node-1',
          selected: true,
          position: { x: 40, y: 40 },
          data: { label: 'One' },
        },
        {
          id: 'node-2',
          selected: true,
          position: { x: 240, y: 40 },
          data: { label: 'Two' },
        },
      ] as any,
      [
        {
          id: 'edge-1-2',
          source: 'node-1',
          target: 'node-2',
          data: { relation: 'depends_on' },
        },
      ] as any
    );

    const duplicatedIds = new Set(result.nodes.map((node) => node.id));
    expect(duplicatedIds.has(result.edges[0].source)).toBe(true);
    expect(duplicatedIds.has(result.edges[0].target)).toBe(true);
  });
});
