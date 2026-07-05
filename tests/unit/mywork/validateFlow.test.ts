import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';

import {
  validateFlow,
  validateFlowWarnings,
} from '../../../src/components/MyWork/processflow/validateFlow';

function flowNode(id: string, shape: string, overrides: Partial<Node> = {}): Node {
  return {
    id,
    type: 'flowNode',
    position: { x: 0, y: 0 },
    data: { shape, label: id },
    ...overrides,
  } as Node;
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target } as Edge;
}

describe('validateFlowWarnings (classic kit)', () => {
  it('happy path: start -> action -> decision -> (yes/no) -> end has no warnings', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('action', 'action'),
      flowNode('decision', 'decision'),
      flowNode('end1', 'end'),
      flowNode('end2', 'end'),
    ];
    const edges = [
      edge('e1', 'start', 'action'),
      edge('e2', 'action', 'decision'),
      edge('e3', 'decision', 'end1'),
      edge('e4', 'decision', 'end2'),
    ];

    const warnings = validateFlowWarnings(nodes, edges, 'classic');
    expect(warnings).toEqual([]);
  });

  it('flags missing Start node', () => {
    const nodes = [flowNode('action', 'action'), flowNode('end', 'end')];
    const edges = [edge('e1', 'action', 'end')];

    const warnings = validateFlowWarnings(nodes, edges, 'classic');
    expect(warnings.some((w) => w.id === 'no-start')).toBe(true);
  });

  it('flags missing End node', () => {
    const nodes = [flowNode('start', 'start'), flowNode('action', 'action')];
    const edges = [edge('e1', 'start', 'action')];

    const warnings = validateFlowWarnings(nodes, edges, 'classic');
    expect(warnings.some((w) => w.id === 'no-end')).toBe(true);
  });

  it('flags a dangling node (no incoming connections)', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('action', 'action'),
      flowNode('orphan', 'action'),
      flowNode('end', 'end'),
    ];
    const edges = [edge('e1', 'start', 'action'), edge('e2', 'action', 'end')];

    const warnings = validateFlowWarnings(nodes, edges, 'classic');
    expect(warnings.some((w) => w.id === 'dangling-orphan')).toBe(true);
  });

  it('flags a decision node with fewer than 2 exits', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('decision', 'decision'),
      flowNode('end', 'end'),
    ];
    const edges = [edge('e1', 'start', 'decision'), edge('e2', 'decision', 'end')];

    const warnings = validateFlowWarnings(nodes, edges, 'classic');
    expect(warnings.some((w) => w.id === 'decision-exits-decision')).toBe(true);
  });

  it('does not flag a decision node with 2+ exits', () => {
    const nodes = [
      flowNode('start', 'start'),
      flowNode('decision', 'decision'),
      flowNode('end1', 'end'),
      flowNode('end2', 'end'),
    ];
    const edges = [
      edge('e1', 'start', 'decision'),
      edge('e2', 'decision', 'end1'),
      edge('e3', 'decision', 'end2'),
    ];

    const warnings = validateFlowWarnings(nodes, edges, 'classic');
    expect(warnings.some((w) => w.id === 'decision-exits-decision')).toBe(false);
  });
});

describe('validateFlow (ValidationResult shape for ValidationResultsPanel)', () => {
  it('valid=true and empty issues on a clean flow', () => {
    const nodes = [flowNode('start', 'start'), flowNode('end', 'end')];
    const edges = [edge('e1', 'start', 'end')];

    const result = validateFlow(nodes, edges, 'classic');
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(typeof result.validated_at).toBe('string');
  });

  it('maps missing-start to a semantic_first error issue', () => {
    const nodes = [flowNode('end', 'end')];
    const result = validateFlow(nodes, [], 'classic');

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.rule === 'no-start');
    expect(issue).toBeTruthy();
    expect(issue?.layer).toBe('semantic_first');
    expect(issue?.severity).toBe('error');
  });

  it('maps dangling node to a structural_bounded warning issue with object_id', () => {
    const nodes = [flowNode('start', 'start'), flowNode('orphan', 'action'), flowNode('end', 'end')];
    const edges = [edge('e1', 'start', 'end')];

    const result = validateFlow(nodes, edges, 'classic');
    const issue = result.issues.find((i) => i.rule === 'dangling_node');
    expect(issue).toBeTruthy();
    expect(issue?.layer).toBe('structural_bounded');
    expect(issue?.severity).toBe('warning');
    expect(issue?.object_id).toBe('orphan');
  });
});
