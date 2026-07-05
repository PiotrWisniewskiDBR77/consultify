/**
 * M07 F2 — applyProposalPatch (pure simulation/acceptance util).
 * Spec coverage: addNodes/addEdges/updateNodes, lane merge (by id + append),
 * unknown laneId → first-lane fallback + warning, idempotence by id.
 */
import type { Edge, Node } from 'reactflow';
import { describe, expect, it } from 'vitest';

import {
  applyProposalPatch,
  mergeLanes,
  type ProposalPatch,
} from '../../../src/components/MyWork/processflow/applyProposalPatch';
import type { Lane } from '../../../src/components/MyWork/processflow/useProcessFlowNodes';

const lanes: Lane[] = [
  { id: 'lane-1', label: 'Main Process', color: '#e0e7ff' },
  { id: 'lane-2', label: 'Support', color: '#dbeafe' },
];

const baseNodes: Node[] = [
  {
    id: 'n-start',
    type: 'flowNode',
    position: { x: 0, y: 0 },
    data: { shape: 'start', label: 'Start', laneId: 'lane-1' },
  },
  {
    id: 'n-end',
    type: 'flowNode',
    position: { x: 400, y: 0 },
    data: { shape: 'end', label: 'End', laneId: 'lane-1' },
  },
];

const baseEdges: Edge[] = [{ id: 'e1', source: 'n-start', target: 'n-end' }];

describe('applyProposalPatch — add operations', () => {
  it('adds nodes and edges from the patch', () => {
    const patch: ProposalPatch = {
      addNodes: [
        {
          id: 'n-review',
          label: 'Review request',
          data: { shape: 'action', laneId: 'lane-2' },
        },
      ],
      addEdges: [{ id: 'e-new', source: 'n-start', target: 'n-review', label: 'submit' }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.addedNodeIds).toEqual(['n-review']);
    expect(result.addedEdgeIds).toEqual(['e-new']);
    expect(result.warnings).toEqual([]);

    const added = result.nodes.find((n) => n.id === 'n-review');
    expect(added).toBeTruthy();
    expect(added?.data.label).toBe('Review request');
    expect(added?.data.laneId).toBe('lane-2');
    expect(added?.data.laneColor).toBe('#dbeafe');
    expect(added?.type).toBe('flowNode');

    const addedEdge = result.edges.find((e) => e.id === 'e-new');
    expect(addedEdge?.source).toBe('n-start');
    expect(addedEdge?.target).toBe('n-review');
    expect(addedEdge?.type).toBe('flowEdge');
    expect(addedEdge?.data?.label).toBe('submit');
  });

  it('updates node data via updateNodes and moves via moveNodes', () => {
    const patch: ProposalPatch = {
      updateNodes: [{ id: 'n-start', data: { label: 'Kick-off', cost: 120 } }],
      moveNodes: [{ nodeId: 'n-end', position: { x: 999, y: 42 } }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    const updated = result.nodes.find((n) => n.id === 'n-start');
    expect(updated?.data.label).toBe('Kick-off');
    expect(updated?.data.cost).toBe(120);
    expect(updated?.data.shape).toBe('start'); // untouched fields preserved

    const moved = result.nodes.find((n) => n.id === 'n-end');
    expect(moved?.position).toEqual({ x: 999, y: 42 });
    expect(result.warnings).toEqual([]);
  });

  it('does not mutate its inputs (pure function)', () => {
    const nodesCopy = JSON.parse(JSON.stringify(baseNodes));
    const edgesCopy = JSON.parse(JSON.stringify(baseEdges));
    const lanesCopy = JSON.parse(JSON.stringify(lanes));

    applyProposalPatch(baseNodes, baseEdges, lanes, {
      addNodes: [{ id: 'n-x', label: 'X', data: { laneId: 'lane-1' } }],
      updateNodes: [{ id: 'n-start', data: { label: 'Changed' } }],
      extensions: { processFlow: { lanes: [{ id: 'lane-1', label: 'Renamed' }] } },
    });

    expect(baseNodes).toEqual(nodesCopy);
    expect(baseEdges).toEqual(edgesCopy);
    expect(lanes).toEqual(lanesCopy);
  });
});

describe('applyProposalPatch — lane safety (decision 3)', () => {
  it('merges patch lanes with existing (by id) and appends new ones', () => {
    const patch: ProposalPatch = {
      extensions: {
        processFlow: {
          lanes: [
            { id: 'lane-2', label: 'Support (renamed)' },
            { id: 'lane-3', label: 'Finance', color: '#d1fae5' },
          ],
        },
      },
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.lanes).toHaveLength(3);
    expect(result.lanes[0]).toEqual(lanes[0]); // untouched
    expect(result.lanes[1].label).toBe('Support (renamed)');
    expect(result.lanes[1].color).toBe('#dbeafe'); // color preserved when patch omits it
    expect(result.lanes[2]).toEqual({ id: 'lane-3', label: 'Finance', color: '#d1fae5' });
  });

  it('validates addNodes laneId against MERGED lanes (new lane usable in same patch)', () => {
    const patch: ProposalPatch = {
      addNodes: [{ id: 'n-fin', label: 'Approve budget', data: { laneId: 'lane-3' } }],
      extensions: {
        processFlow: { lanes: [{ id: 'lane-3', label: 'Finance', color: '#d1fae5' }] },
      },
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.warnings).toEqual([]);
    const added = result.nodes.find((n) => n.id === 'n-fin');
    expect(added?.data.laneId).toBe('lane-3');
    expect(added?.data.laneColor).toBe('#d1fae5');
  });

  it('falls back to the first lane and warns on unknown laneId', () => {
    const patch: ProposalPatch = {
      addNodes: [{ id: 'n-ghost', label: 'Orphan step', data: { laneId: 'lane-does-not-exist' } }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    const added = result.nodes.find((n) => n.id === 'n-ghost');
    expect(added?.data.laneId).toBe('lane-1');
    expect(added?.data.laneColor).toBe('#e0e7ff');
    expect(result.warnings).toEqual([
      { code: 'unknown_lane_fallback', objectId: 'n-ghost', detail: 'lane-does-not-exist' },
    ]);
  });

  it('guards laneId changes coming through updateNodes too', () => {
    const patch: ProposalPatch = {
      updateNodes: [{ id: 'n-start', data: { laneId: 'nope' } }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    const updated = result.nodes.find((n) => n.id === 'n-start');
    expect(updated?.data.laneId).toBe('lane-1');
    expect(result.warnings[0]?.code).toBe('unknown_lane_fallback');
  });

  it('assigns the first lane when addNodes has no laneId at all (no warning)', () => {
    const patch: ProposalPatch = {
      addNodes: [{ id: 'n-nolane', label: 'Laneless' }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    const added = result.nodes.find((n) => n.id === 'n-nolane');
    expect(added?.data.laneId).toBe('lane-1');
    expect(result.warnings).toEqual([]);
  });
});

describe('applyProposalPatch — idempotence and referential integrity', () => {
  it('skips addNodes whose id already exists (idempotent by id)', () => {
    const patch: ProposalPatch = {
      addNodes: [{ id: 'n-start', label: 'Duplicate start' }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.nodes).toHaveLength(baseNodes.length);
    expect(result.addedNodeIds).toEqual([]);
    expect(result.warnings).toEqual([{ code: 'duplicate_node_skipped', objectId: 'n-start' }]);
    // original node untouched
    expect(result.nodes.find((n) => n.id === 'n-start')?.data.label).toBe('Start');
  });

  it('re-applying the same patch is a no-op for the graph shape', () => {
    const patch: ProposalPatch = {
      addNodes: [{ id: 'n-a', label: 'A', data: { laneId: 'lane-1' } }],
      addEdges: [{ id: 'e-a', source: 'n-start', target: 'n-a' }],
    };

    const once = applyProposalPatch(baseNodes, baseEdges, lanes, patch);
    const twice = applyProposalPatch(once.nodes, once.edges, once.lanes, patch);

    expect(twice.nodes).toHaveLength(once.nodes.length);
    expect(twice.edges).toHaveLength(once.edges.length);
    expect(twice.addedNodeIds).toEqual([]);
    expect(twice.addedEdgeIds).toEqual([]);
    expect(twice.warnings.map((w) => w.code).sort()).toEqual([
      'duplicate_edge_skipped',
      'duplicate_node_skipped',
    ]);
  });

  it('skips edges that reference missing nodes (no dangling references)', () => {
    const patch: ProposalPatch = {
      addEdges: [{ id: 'e-dangling', source: 'n-start', target: 'n-missing' }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.edges).toHaveLength(baseEdges.length);
    expect(result.warnings).toEqual([
      {
        code: 'dangling_edge_skipped',
        objectId: 'e-dangling',
        detail: 'n-start → n-missing',
      },
    ]);
  });

  it('warns on update/move targets that do not exist', () => {
    const patch: ProposalPatch = {
      updateNodes: [{ id: 'n-missing', data: { label: 'X' } }],
      moveNodes: [{ nodeId: 'n-missing-2', position: { x: 1, y: 1 } }],
    };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.nodes).toEqual(baseNodes);
    expect(result.warnings.map((w) => w.code)).toEqual([
      'unknown_update_target',
      'unknown_move_target',
    ]);
  });

  it('removes nodes together with their connected edges', () => {
    const patch: ProposalPatch = { removeNodeIds: ['n-end'] };

    const result = applyProposalPatch(baseNodes, baseEdges, lanes, patch);

    expect(result.nodes.map((n) => n.id)).toEqual(['n-start']);
    expect(result.edges).toEqual([]); // e1 targeted the removed node
  });

  it('handles a null/undefined patch gracefully', () => {
    const result = applyProposalPatch(baseNodes, baseEdges, lanes, undefined);
    expect(result.nodes).toEqual(baseNodes);
    expect(result.edges).toEqual(baseEdges);
    expect(result.lanes).toEqual(lanes);
    expect(result.warnings).toEqual([]);
  });
});

describe('mergeLanes', () => {
  it('returns the existing array untouched for empty input', () => {
    expect(mergeLanes(lanes, [])).toBe(lanes);
  });

  it('ignores malformed lane entries', () => {
    const merged = mergeLanes(lanes, [null, 42, { label: 'no-id' }, { id: '' }] as unknown[]);
    expect(merged).toEqual(lanes);
  });

  it('assigns a palette color to appended lanes without a color', () => {
    const merged = mergeLanes(lanes, [{ id: 'lane-9', label: 'New' }]);
    const appended = merged.find((l) => l.id === 'lane-9');
    expect(appended?.label).toBe('New');
    expect(typeof appended?.color).toBe('string');
    expect(appended?.color.length).toBeGreaterThan(0);
  });
});
