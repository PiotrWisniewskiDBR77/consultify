/**
 * M06 Fala 3.2 — multi-select styling toolbar.
 * Pure-function coverage for applyStyleToNodes (mindMapNodeModel.ts):
 * applying the same style patch to every selected node while leaving
 * everything else referentially untouched.
 */
import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';

import { applyStyleToNodes, applyNodeStyle } from '@/components/MyWork/mindmap/mindMapNodeModel';
import { DEFAULT_FLAGS } from '@/hooks/useFeatureFlags';

function makeNode(id: string, data: Record<string, any> = {}): Node {
  return { id, type: 'idea', position: { x: 0, y: 0 }, data: { label: id, ...data } } as Node;
}

describe('mindmapMultiToolbar flag definition', () => {
  it('is registered and OFF by default (flag OFF = pre-Fala-3.2 single-node-only toolbar)', () => {
    const flag = DEFAULT_FLAGS.find((f) => f.id === 'mindmapMultiToolbar');
    expect(flag).toBeTruthy();
    expect(flag?.defaultValue).toBe(false);
    expect(flag?.allowLocalOverride).toBe(true);
  });
});

describe('applyStyleToNodes', () => {
  it('applies the style patch to every node whose id is in the selection', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const result = applyStyleToNodes(nodes, ['a', 'c'], { color: '#ff0000', shape: 'rounded' });

    expect(result.find((n) => n.id === 'a')?.data.color).toBe('#ff0000');
    expect(result.find((n) => n.id === 'a')?.data.shape).toBe('rounded');
    expect(result.find((n) => n.id === 'c')?.data.color).toBe('#ff0000');
    // Untouched node is the exact same reference (no unnecessary re-render).
    expect(result.find((n) => n.id === 'b')).toBe(nodes[1]);
  });

  it('accepts a Set of ids as well as an array', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const result = applyStyleToNodes(nodes, new Set(['b']), { priority: 3 });
    expect(result.find((n) => n.id === 'b')?.data.priority).toBe(3);
    expect(result.find((n) => n.id === 'a')?.data.priority).toBeUndefined();
  });

  it('returns the same array reference when the selection is empty', () => {
    const nodes = [makeNode('a')];
    const result = applyStyleToNodes(nodes, [], { color: '#000' });
    expect(result).toBe(nodes);
  });

  it('preserves each node identity and only overwrites patched fields (matches applyNodeStyle for a single id)', () => {
    const nodes = [makeNode('a', { label: 'Alpha', notes: 'keep me' })];
    const single = applyNodeStyle(nodes[0], { branchTheme: 'straight' });
    const multi = applyStyleToNodes(nodes, ['a'], { branchTheme: 'straight' })[0];
    expect(multi.data).toEqual(single.data);
    expect(multi.data.notes).toBe('keep me');
  });

  it('applies semantic style fields uniformly across a 3+ node selection (multi-toolbar scenario)', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3'), makeNode('n4')];
    const selected = ['n1', 'n2', 'n3'];
    const result = applyStyleToNodes(nodes, selected, {
      semanticType: 'risk',
      bold: true,
      fontSize: 18,
    });
    for (const id of selected) {
      const n = result.find((r) => r.id === id)!;
      expect(n.data.semanticType).toBe('risk');
      expect(n.data.bold).toBe(true);
      expect(n.data.fontSize).toBe(18);
    }
    // n4 was not selected — untouched.
    const n4 = result.find((r) => r.id === 'n4')!;
    expect(n4.data.semanticType).toBeUndefined();
  });
});
