/**
 * Behavior-based tests for table row conversion logic.
 * Tests: bulk convert traceability stamping, single-row convert, field integrity.
 *
 * The conversion logic lives inline in IdeaTableTool.tsx. These tests verify
 * the data transformation pattern used for both bulk and single-row conversion.
 */
import { describe, expect, it } from 'vitest';

import type { TableNode } from '@/components/MyWork/table/tableTypes';

function applyBulkConvert(
  nodes: TableNode[],
  selectedIds: Set<string>,
  target: 'initiative' | 'task' | 'decision',
  ideaId: string
): TableNode[] {
  const now = new Date().toISOString();
  return nodes.map((n) => {
    if (!selectedIds.has(n.id)) return n;
    return {
      ...n,
      data: {
        ...(n.data || {}),
        _convertedTo: target,
        _convertedAt: now,
        _sourceRowId: n.id,
        _sourceTable: ideaId,
        last_edited_time: now,
      },
    };
  });
}

function applySingleConvert(
  nodes: TableNode[],
  nodeId: string,
  target: 'initiative' | 'task' | 'decision',
  ideaId: string
): TableNode[] {
  const now = new Date().toISOString();
  return nodes.map((n) =>
    n.id === nodeId
      ? {
          ...n,
          data: {
            ...(n.data || {}),
            _convertedTo: target,
            _convertedAt: now,
            _sourceRowId: n.id,
            _sourceTable: ideaId,
            last_edited_time: now,
          },
        }
      : n
  );
}

function makeNodes(count: number): TableNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `node_${i + 1}`,
    type: 'idea',
    data: { label: `Idea ${i + 1}`, status: 'todo' },
    position: { x: 0, y: 0 },
  }));
}

describe('Conversion traceability', () => {
  describe('bulk convert', () => {
    it('stamps traceability fields on selected rows only', () => {
      const nodes = makeNodes(4);
      const selected = new Set(['node_1', 'node_3']);
      const result = applyBulkConvert(nodes, selected, 'initiative', 'idea_123');

      expect(result[0].data._convertedTo).toBe('initiative');
      expect(result[0].data._sourceRowId).toBe('node_1');
      expect(result[0].data._sourceTable).toBe('idea_123');
      expect(result[0].data._convertedAt).toBeDefined();

      expect(result[1].data._convertedTo).toBeUndefined();
      expect(result[1].data._sourceRowId).toBeUndefined();

      expect(result[2].data._convertedTo).toBe('initiative');
      expect(result[2].data._sourceRowId).toBe('node_3');

      expect(result[3].data._convertedTo).toBeUndefined();
    });

    it('preserves existing data fields during conversion', () => {
      const nodes: TableNode[] = [
        {
          id: 'n1',
          type: 'idea',
          data: { label: 'My Idea', status: 'done', priority: 'High', custom_field: 'value' },
          position: { x: 10, y: 20 },
        },
      ];
      const result = applyBulkConvert(nodes, new Set(['n1']), 'task', 'idea_x');

      expect(result[0].data.label).toBe('My Idea');
      expect(result[0].data.status).toBe('done');
      expect(result[0].data.priority).toBe('High');
      expect(result[0].data.custom_field).toBe('value');
      expect(result[0].data._convertedTo).toBe('task');
      expect(result[0].position).toEqual({ x: 10, y: 20 });
    });

    it('handles empty selection gracefully', () => {
      const nodes = makeNodes(3);
      const result = applyBulkConvert(nodes, new Set(), 'decision', 'idea_y');

      result.forEach((n) => {
        expect(n.data._convertedTo).toBeUndefined();
      });
    });

    it('sets last_edited_time on converted rows', () => {
      const nodes = makeNodes(2);
      const result = applyBulkConvert(nodes, new Set(['node_1']), 'task', 'idea_z');

      expect(result[0].data.last_edited_time).toBeDefined();
      expect(new Date(result[0].data.last_edited_time as string).getTime()).toBeGreaterThan(0);
      expect(result[1].data.last_edited_time).toBeUndefined();
    });

    it('supports all three conversion targets', () => {
      const targets: Array<'initiative' | 'task' | 'decision'> = ['initiative', 'task', 'decision'];
      for (const target of targets) {
        const nodes = makeNodes(1);
        const result = applyBulkConvert(nodes, new Set(['node_1']), target, 'idea_t');
        expect(result[0].data._convertedTo).toBe(target);
      }
    });
  });

  describe('single-row convert', () => {
    it('stamps traceability fields on the target row only', () => {
      const nodes = makeNodes(3);
      const result = applySingleConvert(nodes, 'node_2', 'decision', 'idea_abc');

      expect(result[0].data._convertedTo).toBeUndefined();
      expect(result[1].data._convertedTo).toBe('decision');
      expect(result[1].data._sourceRowId).toBe('node_2');
      expect(result[1].data._sourceTable).toBe('idea_abc');
      expect(result[2].data._convertedTo).toBeUndefined();
    });

    it('preserves existing data on the converted row', () => {
      const nodes: TableNode[] = [
        {
          id: 'r1',
          type: 'idea',
          data: { label: 'Important Idea', impact: 5 },
          position: { x: 0, y: 0 },
        },
      ];
      const result = applySingleConvert(nodes, 'r1', 'initiative', 'idea_p');

      expect(result[0].data.label).toBe('Important Idea');
      expect(result[0].data.impact).toBe(5);
      expect(result[0].data._convertedTo).toBe('initiative');
    });

    it('does nothing when nodeId does not match', () => {
      const nodes = makeNodes(2);
      const result = applySingleConvert(nodes, 'nonexistent', 'task', 'idea_q');

      result.forEach((n, i) => {
        expect(n).toEqual(nodes[i]);
      });
    });
  });
});
