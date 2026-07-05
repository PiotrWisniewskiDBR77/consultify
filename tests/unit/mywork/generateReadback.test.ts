import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { generateReadback, readbackToText } from '../../../src/components/MyWork/processflow/generateReadback';

function flowNode(id: string, shape: string, laneId?: string): Node {
  return {
    id,
    type: 'flowNode',
    position: { x: 0, y: 0 },
    data: { shape, label: id, laneId },
  } as Node;
}

function edge(id: string, source: string, target: string, data?: Record<string, unknown>): Edge {
  return { id, source, target, data } as Edge;
}

describe('generateReadback — linear path', () => {
  it('traverses start -> action -> end in order', () => {
    const nodes = [flowNode('start', 'start'), flowNode('action', 'action'), flowNode('end', 'end')];
    const edges = [edge('e1', 'start', 'action'), edge('e2', 'action', 'end')];

    const result = generateReadback(nodes, edges, [], false);

    expect(result.warnings).toEqual([]);
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0].object_id).toBe('start');
    expect(result.paths[0].type).toBe('start');

    // Linear continuation is nested as a single-branch chain.
    const step2 = result.paths[0].branches?.[0]?.[0];
    expect(step2?.object_id).toBe('action');
    const step3 = step2?.branches?.[0]?.[0];
    expect(step3?.object_id).toBe('end');
    expect(step3?.type).toBe('end');
  });
});

describe('generateReadback — decision branching', () => {
  it('fans out into labeled branches at a decision node', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('decision', 'decision'),
      flowNode('yesEnd', 'end'),
      flowNode('noEnd', 'end'),
    ];
    const edges = [
      edge('e1', 'start', 'decision'),
      edge('e2', 'decision', 'yesEnd', { label: 'Yes' }),
      edge('e3', 'decision', 'noEnd', { label: 'No' }),
    ];

    const result = generateReadback(nodes, edges, [], false);
    const decisionStep = result.paths[0].branches?.[0]?.[0];
    expect(decisionStep?.object_id).toBe('decision');
    expect(decisionStep?.type).toBe('decision');
    expect(decisionStep?.branches).toHaveLength(2);

    const branchLabels = decisionStep?.branches?.map((branch) => branch[0]?.label);
    expect(branchLabels).toEqual(expect.arrayContaining([expect.stringContaining('Yes'), expect.stringContaining('No')]));
  });
});

describe('generateReadback — cycle detection', () => {
  it('detects a cycle and closes the branch with a back-reference step', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('a', 'action'),
      flowNode('b', 'action'),
    ];
    const edges = [
      edge('e1', 'start', 'a'),
      edge('e2', 'a', 'b'),
      edge('e3', 'b', 'a'), // cycle back to 'a'
    ];

    const result = generateReadback(nodes, edges, [], false);
    const stepA = result.paths[0].branches?.[0]?.[0];
    expect(stepA?.object_id).toBe('a');
    const stepB = stepA?.branches?.[0]?.[0];
    expect(stepB?.object_id).toBe('b');
    const cycleStep = stepB?.branches?.[0]?.[0];
    expect(cycleStep?.label).toMatch(/back/i);
    // The cycle step should not recurse further.
    expect(cycleStep?.branches).toBeUndefined();
  });
});

describe('generateReadback — unreachable nodes', () => {
  it('lists nodes unreachable from any start node in a separate section', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('end', 'end'),
      flowNode('island', 'action'),
    ];
    const edges = [edge('e1', 'start', 'end')];
    // 'island' has no edges at all -> unreachable AND has no incoming, so it's
    // actually also a root candidate. To force true unreachability, give it an
    // incoming edge from another unreachable node instead.
    const nodes2 = [...nodes, flowNode('island2', 'action')];
    const edges2 = [...edges, edge('e2', 'island', 'island2')];

    const result = generateReadback(nodes2, edges2, [], false);
    expect(result.warnings.some((w) => /unreachable/i.test(w))).toBe(true);
    const unreachableStep = result.paths.find((p) => p.object_id === 'island2');
    expect(unreachableStep?.label).toMatch(/unreachable/i);
  });
});

describe('generateReadback — lane in description', () => {
  it('includes the lane label in the step description when present', () => {
    const lanes = [{ id: 'lane-1', label: 'Sales' }];
    const nodes = [flowNode('start', 'start', 'lane-1'), flowNode('end', 'end', 'lane-1')];
    const edges = [edge('e1', 'start', 'end')];

    const result = generateReadback(nodes, edges, lanes, false);
    expect(result.paths[0].label).toContain('Sales');
  });
});

describe('readbackToText', () => {
  it('flattens a readback result into indented plain text', () => {
    const nodes = [flowNode('start', 'start'), flowNode('end', 'end')];
    const edges = [edge('e1', 'start', 'end')];
    const result = generateReadback(nodes, edges, [], false);

    const text = readbackToText(result, false);
    expect(text).toContain('start');
    expect(text).toContain('end');
    expect(typeof text).toBe('string');
  });
});
