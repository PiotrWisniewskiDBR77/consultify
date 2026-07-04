import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';

import { serializeFlowJson } from '../../../src/components/MyWork/processflow/useProcessFlowExport';

const nodes: Node[] = [
  { id: 'n1', type: 'flowNode', position: { x: 0, y: 0 }, data: { shape: 'start', label: 'Start' } },
];
const edges: Edge[] = [];
const lanes = [{ id: 'l1', label: 'Lane 1' }];

describe('serializeFlowJson', () => {
  it('serializes nodes/edges/extensions with lanes, flowMode, semanticKit', () => {
    const result = serializeFlowJson(nodes, edges, lanes, 'classic', 'classic');

    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
    expect(result.extensions.processFlow.lanes).toBe(lanes);
    expect(result.extensions.processFlow.flowMode).toBe('classic');
    expect(result.extensions.processFlow.semanticKit).toBe('classic');
    expect(result.version).toBe(1);
    expect(typeof result.exportedAt).toBe('string');
    // exportedAt should be a valid ISO timestamp
    expect(new Date(result.exportedAt).toString()).not.toBe('Invalid Date');
  });

  it('produces a JSON-serializable object', () => {
    const result = serializeFlowJson(nodes, edges, lanes, 'automation', 'bpmn');
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.extensions.processFlow.flowMode).toBe('automation');
    expect(parsed.extensions.processFlow.semanticKit).toBe('bpmn');
  });
});
