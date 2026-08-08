import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CardBlock, DeckCard } from '../../wizard/types';
import { BlockToolbar } from '../BlockToolbar';
import { CardCanvas } from '../CardCanvas';

vi.mock('../CardRenderer', () => ({
  CardRenderer: ({ onBlockClick }: { onBlockClick?: (id: string, additive?: boolean) => void }) => (
    <button onClick={() => onBlockClick?.('block-2', true)}>Select another block</button>
  ),
}));

const block = (id: string, groupId?: string): CardBlock => ({
  block_id: id,
  card_id: 'slide-1',
  type: 'paragraph',
  content: { text: id },
  position: { area: 'full', order: 0 },
  geometry: { x: 5, y: 5, width: 20, height: 10, rotation: 0 },
  group_id: groupId,
  is_refreshable: false,
  ai_editable: true,
});

const card: DeckCard = {
  card_id: 'slide-1',
  deck_id: 'deck-1',
  order_index: 0,
  intent: 'key_messages',
  layout_id: 'content_full',
  title: 'Manual slide',
  blocks: [],
  source_refs: [],
  has_refreshable_data: false,
  background: { type: 'theme' },
  animations: { entrance: 'fade', block_stagger: false },
  is_locked: false,
};

describe('manual presentation multiselect', () => {
  it('forwards additive selection through CardCanvas with the owning slide id', () => {
    const onBlockClick = vi.fn();
    render(
      <CardCanvas
        cards={[card]}
        activeCardIndex={0}
        onSelectCard={vi.fn()}
        onBlockClick={onBlockClick}
        showNotes={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select another block' }));
    expect(onBlockClick).toHaveBeenCalledWith('slide-1', 'block-2', true);
  });

  it('exposes accessible group, align and distribute actions for a multi-selection', () => {
    const onGroup = vi.fn();
    const onUngroup = vi.fn();
    const onAlign = vi.fn();
    const onDistribute = vi.fn();
    render(
      <BlockToolbar
        selectedBlock={block('b1', 'g1')}
        selectedBlocks={[block('b1', 'g1'), block('b2'), block('b3')]}
        onSelectedBlockUpdate={vi.fn()}
        onGroup={onGroup}
        onUngroup={onUngroup}
        onAlign={onAlign}
        onDistribute={onDistribute}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Group selected blocks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ungroup selected blocks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Align middle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Distribute horizontally' }));
    expect(onGroup).toHaveBeenCalledOnce();
    expect(onUngroup).toHaveBeenCalledOnce();
    expect(onAlign).toHaveBeenCalledWith('middle');
    expect(onDistribute).toHaveBeenCalledWith('horizontal');
  });
});
