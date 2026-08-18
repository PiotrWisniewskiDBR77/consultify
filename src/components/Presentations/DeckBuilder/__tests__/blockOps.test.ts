import { describe, expect, it } from 'vitest';

import type { CardBlock } from '../../wizard/types';
import {
  canMoveBlock,
  deleteBlockFromList,
  duplicateBlockInList,
  moveBlockInList,
} from '../blockOps';

function block(id: string, order: number, area: CardBlock['position']['area'] = 'full'): CardBlock {
  return {
    block_id: id,
    card_id: 'card-1',
    type: 'paragraph',
    content: { text: id },
    is_refreshable: false,
    position: { area, order },
    ai_editable: true,
  };
}

describe('blockOps (Fala 1 — manual block editing, no data-model change)', () => {
  it('deleteBlockFromList removes only the targeted block', () => {
    const blocks = [block('a', 0), block('b', 1), block('c', 2)];
    const next = deleteBlockFromList(blocks, 'b');
    expect(next.map((b) => b.block_id)).toEqual(['a', 'c']);
  });

  it('duplicateBlockInList inserts a clone with a new id directly after the original', () => {
    const blocks = [block('a', 0), block('b', 1)];
    const next = duplicateBlockInList(blocks, 'a');
    expect(next).toHaveLength(3);
    expect(next[0].block_id).toBe('a');
    expect(next[1].block_id).not.toBe('a');
    expect(next[1].content.text).toBe('a'); // deep-cloned content
    expect(next[2].block_id).toBe('b');
    // order renumbered 0..n-1 within the region so sort-by-order matches array order
    expect(next.map((b) => b.position.order)).toEqual([0, 1, 2]);
  });

  it('moveBlockInList swaps order with the previous/next sibling in the same region only', () => {
    const blocks = [
      block('a', 0, 'full'),
      block('b', 1, 'full'),
      block('side', 0, 'left'), // different region — must not affect 'full' siblings
    ];
    const movedDown = moveBlockInList(blocks, 'a', 'down');
    const sorted = [...movedDown]
      .filter((b) => b.position.area === 'full')
      .sort((x, y) => x.position.order - y.position.order);
    expect(sorted.map((b) => b.block_id)).toEqual(['b', 'a']);
    // untouched region is unaffected
    expect(movedDown.find((b) => b.block_id === 'side')?.position.order).toBe(0);
  });

  it('canMoveBlock reports the region boundary correctly', () => {
    const blocks = [block('a', 0), block('b', 1), block('c', 2)];
    expect(canMoveBlock(blocks, 'a', 'up')).toBe(false);
    expect(canMoveBlock(blocks, 'a', 'down')).toBe(true);
    expect(canMoveBlock(blocks, 'c', 'down')).toBe(false);
    expect(canMoveBlock(blocks, 'c', 'up')).toBe(true);
  });

  it('moving a block at the boundary is a no-op', () => {
    const blocks = [block('a', 0), block('b', 1)];
    const next = moveBlockInList(blocks, 'a', 'up');
    expect(next).toBe(blocks); // unchanged reference — nothing to swap with
  });

  it('fails closed for a persisted legacy block without position', () => {
    const malformed = { ...block('legacy', 0), position: undefined } as unknown as CardBlock;
    const blocks = [malformed, block('valid', 1)];

    expect(canMoveBlock(blocks, 'legacy', 'up')).toBe(false);
    expect(canMoveBlock(blocks, 'legacy', 'down')).toBe(false);
    expect(moveBlockInList(blocks, 'legacy', 'down')).toBe(blocks);
    expect(duplicateBlockInList(blocks, 'legacy')).toHaveLength(3);
  });
});
