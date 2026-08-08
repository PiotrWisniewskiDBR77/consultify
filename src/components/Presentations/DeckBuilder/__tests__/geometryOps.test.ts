import { describe, expect, it } from 'vitest';

import type { CardBlock } from '../../wizard/types';
import {
  alignBlocks,
  distributeBlocks,
  expandSelectionToGroups,
  groupBlocks,
  normalizeGeometry,
  ungroupBlocks,
} from '../geometryOps';

const block = (id: string, x: number, y: number): CardBlock => ({
  block_id: id,
  card_id: 'card-1',
  type: 'paragraph',
  content: { text: id },
  is_refreshable: false,
  position: { area: 'full', order: Number(id.slice(1)) },
  geometry: { x, y, width: 20, height: 10, rotation: 0 },
  ai_editable: true,
});

describe('freeform presentation geometry', () => {
  it('clamps geometry inside the slide and normalizes rotation', () => {
    expect(normalizeGeometry({ x: 95, y: -2, width: 20, height: 3, rotation: 270 })).toEqual({
      x: 80,
      y: 0,
      width: 20,
      height: 5,
      rotation: 180,
    });
  });

  it('groups, expands selection to the group and ungroups atomically', () => {
    const grouped = groupBlocks([block('b0', 0, 0), block('b1', 30, 20)], ['b0', 'b1'], 'g1');
    expect(expandSelectionToGroups(grouped, ['b0'])).toEqual(['b0', 'b1']);
    expect(ungroupBlocks(grouped, ['b0']).every((item) => !item.group_id)).toBe(true);
  });

  it('aligns and distributes only selected freeform blocks', () => {
    const blocks = [block('b0', 5, 10), block('b1', 35, 30), block('b2', 75, 50)];
    const aligned = alignBlocks(blocks, ['b0', 'b1', 'b2'], 'middle');
    expect(aligned.map((item) => item.geometry?.y)).toEqual([30, 30, 30]);
    const distributed = distributeBlocks(blocks, ['b0', 'b1', 'b2'], 'horizontal');
    expect(distributed.map((item) => item.geometry?.x)).toEqual([5, 40, 75]);
  });
});
