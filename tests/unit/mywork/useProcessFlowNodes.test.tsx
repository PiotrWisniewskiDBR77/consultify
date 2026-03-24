import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { useProcessFlowNodes } from '../../../src/components/MyWork/processflow/useProcessFlowNodes';

describe('useProcessFlowNodes', () => {
  it('duplicates selected nodes together with internal edges', () => {
    const onNodeDetail = vi.fn();

    const { result } = renderHook(() => {
      const [nodes, setNodes] = useState<Node[]>([
        {
          id: 'n-1',
          type: 'flowNode',
          selected: true,
          position: { x: 0, y: 0 },
          data: { label: 'Start', laneId: 'lane-1', laneColor: '#abc' },
        },
        {
          id: 'n-2',
          type: 'flowNode',
          selected: true,
          position: { x: 120, y: 0 },
          data: { label: 'Next', laneId: 'lane-1', laneColor: '#abc' },
        },
      ]);
      const [edges, setEdges] = useState<Edge[]>([
        {
          id: 'e-1',
          source: 'n-1',
          target: 'n-2',
          type: 'flowEdge',
          selected: false,
        },
      ]);

      const hook = useProcessFlowNodes({
        nodes,
        edges,
        setNodes,
        setEdges,
        lanes: [{ id: 'lane-1', label: 'Lane 1', color: '#abc' }],
        setLanes: vi.fn(),
        locked: false,
        isPl: false,
        pushUndo: vi.fn(),
        onNodeDetail,
      });

      return { ...hook, nodes, edges };
    });

    act(() => {
      result.current.duplicateSelected();
    });

    expect(result.current.nodes).toHaveLength(4);
    expect(result.current.edges).toHaveLength(2);

    const duplicatedNodes = result.current.nodes.filter((node) => !['n-1', 'n-2'].includes(node.id));
    const duplicatedIds = new Set(duplicatedNodes.map((node) => node.id));
    const duplicatedEdge = result.current.edges.find((edge) => edge.id !== 'e-1');

    expect(duplicatedNodes).toHaveLength(2);
    expect(duplicatedEdge).toBeDefined();
    expect(duplicatedIds.has(duplicatedEdge!.source)).toBe(true);
    expect(duplicatedIds.has(duplicatedEdge!.target)).toBe(true);
  });
});
