/**
 * Tests for FormulaEngineV2 — formula evaluation with cross-row references,
 * aggregations, conditionals, and arithmetic.
 */
import { describe, expect, it } from 'vitest';

import { batchEvaluateFormulas, evaluateFormulaV2 } from '@/components/MyWork/table/FormulaEngineV2';
import type { TableEdge, TableNode } from '@/components/MyWork/table/tableTypes';

function makeNode(id: string, data: Record<string, any> = {}): TableNode {
  return { id, type: 'idea', data, position: { x: 0, y: 0 } };
}

function makeEdge(source: string, target: string): TableEdge {
  return { id: `${source}-${target}`, source, target, type: 'related_to' };
}

describe('FormulaEngineV2', () => {
  describe('evaluateFormulaV2', () => {
    const parent = makeNode('p1', {
      label: 'Parent',
      status: 'Done',
      impact: 8,
      effort: 5,
      children: ['c1', 'c2', 'c3'],
    });
    const child1 = makeNode('c1', { effort: 3, rating: 4 });
    const child2 = makeNode('c2', { effort: 7, rating: 2 });
    const child3 = makeNode('c3', { effort: 5, rating: 5 });
    const related1 = makeNode('r1', { rating: 8, score: 10 });
    const related2 = makeNode('r2', { rating: 6, score: 20 });
    const allNodes = [parent, child1, child2, child3, related1, related2];
    const edges: TableEdge[] = [
      makeEdge('p1', 'r1'),
      makeEdge('p1', 'r2'),
    ];

    it('SUM(children.effort) aggregates child node values', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=SUM(children.effort)', ctx)).toBe(15);
    });

    it('AVG(children.rating) computes average of child values', () => {
      const ctx = { node: parent, allNodes, edges };
      const result = evaluateFormulaV2('=AVG(children.rating)', ctx);
      expect(result).toBeCloseTo(3.67, 1);
    });

    it('MIN(children.effort) returns minimum', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=MIN(children.effort)', ctx)).toBe(3);
    });

    it('MAX(children.effort) returns maximum', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=MAX(children.effort)', ctx)).toBe(7);
    });

    it('COUNT(children) counts child nodes', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=COUNT(children)', ctx)).toBe(3);
    });

    it('AVG(related.rating) aggregates related nodes via edges', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=AVG(related.rating)', ctx)).toBe(7);
    });

    it('SUM(related.score) sums related node values', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=SUM(related.score)', ctx)).toBe(30);
    });

    it('IF(status="Done", 10, 0) returns true branch', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=IF(status="Done", 10, 0)', ctx)).toBe(10);
    });

    it('IF(status="Active", 10, 0) returns false branch', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=IF(status="Active", 10, 0)', ctx)).toBe(0);
    });

    it('CONCAT(label, " - ", status) joins strings', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=CONCAT(label, " - ", status)', ctx)).toBe('Parent - Done');
    });

    it('SCORE(impact*0.4 + effort*0.3) evaluates weighted arithmetic', () => {
      const ctx = { node: parent, allNodes, edges };
      const result = evaluateFormulaV2('=SCORE(impact*0.4 + effort*0.3)', ctx);
      expect(result).toBeCloseTo(4.7, 1);
    });

    it('plain arithmetic: impact + effort * 2', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=impact + effort * 2', ctx)).toBe(18);
    });

    it('simple field reference returns field value', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=impact', ctx)).toBe(8);
    });

    it('returns 0 for missing field in arithmetic', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('=nonexistent + 5', ctx)).toBe(5);
    });

    it('returns 0 for division by zero', () => {
      const nodeZ = makeNode('z', { a: 10, b: 0 });
      const ctx = { node: nodeZ, allNodes: [nodeZ], edges: [] };
      expect(evaluateFormulaV2('=a / b', ctx)).toBe(0);
    });

    it('handles formula without = prefix', () => {
      const ctx = { node: parent, allNodes, edges };
      expect(evaluateFormulaV2('SUM(children.effort)', ctx)).toBe(15);
    });

    it('returns 0 for aggregation with no children', () => {
      const orphan = makeNode('orphan', { children: [] });
      const ctx = { node: orphan, allNodes: [orphan], edges: [] };
      expect(evaluateFormulaV2('=SUM(children.effort)', ctx)).toBe(0);
    });

    it('returns 0 for aggregation with no related nodes', () => {
      const isolated = makeNode('iso', {});
      const ctx = { node: isolated, allNodes: [isolated], edges: [] };
      expect(evaluateFormulaV2('=AVG(related.rating)', ctx)).toBe(0);
    });
  });

  describe('batchEvaluateFormulas', () => {
    it('evaluates multiple formula columns for all nodes', () => {
      const n1 = makeNode('n1', { effort: 10, impact: 8 });
      const n2 = makeNode('n2', { effort: 5, impact: 3 });
      const nodes = [n1, n2];
      const edges: TableEdge[] = [];
      const formulaColumns = [
        { key: 'total', formula: '=effort + impact' },
        { key: 'score', formula: '=SCORE(effort * 0.5 + impact * 0.5)' },
      ];

      const results = batchEvaluateFormulas(nodes, edges, formulaColumns);

      expect(results.get('n1')).toEqual({ total: 18, score: 9 });
      expect(results.get('n2')).toEqual({ total: 8, score: 4 });
    });

    it('returns empty map for empty nodes', () => {
      const results = batchEvaluateFormulas([], [], [{ key: 'x', formula: '=1+1' }]);
      expect(results.size).toBe(0);
    });
  });
});
