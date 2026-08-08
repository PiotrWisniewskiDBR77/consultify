/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BlockToolbar } from '../../../src/components/Presentations/DeckBuilder/BlockToolbar';
import { CardFloatingToolbar } from '../../../src/components/Presentations/DeckBuilder/CardFloatingToolbar';
import type { CardBlock, DeckCard } from '../../../src/components/Presentations/wizard/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

const block: CardBlock = {
  block_id: 'block-1',
  card_id: 'card-1',
  type: 'paragraph',
  content: { text: 'Manual paragraph' },
  is_refreshable: false,
  position: { area: 'full', order: 0 },
  ai_editable: true,
};

const card = {
  card_id: 'card-1',
  deck_id: 'deck-1',
  order_index: 0,
  intent: 'content',
  layout_id: 'auto',
  title: 'Slide',
  blocks: [block],
  background: { type: 'theme' },
  animations: { entrance: 'none', block_stagger: false },
  source_refs: [],
  speaker_notes: '',
} as DeckCard;

describe('PowerPoint manual layout and typography', () => {
  it('persists typography, region, layer and model-safe sizing updates', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<BlockToolbar selectedBlock={block} onSelectedBlockUpdate={onUpdate} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Font family' }), 'Georgia');
    expect(onUpdate).toHaveBeenCalledWith({
      content: { text: 'Manual paragraph', style: { fontFamily: 'Georgia' } },
    });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Layout region' }), 'left');
    expect(onUpdate).toHaveBeenCalledWith({ position: { area: 'left', order: 0 } });

    fireEvent.change(screen.getByRole('textbox', { name: 'Width (%)' }), {
      target: { value: '60' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({ style_overrides: { widthPercent: '60' } });
  });

  it('uses renderer-supported layout ids and cycles content distribution', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<CardFloatingToolbar card={card} onUpdateCard={onUpdate} />);

    await user.click(screen.getByRole('button', { name: 'Choose slide layout' }));
    await user.click(screen.getByRole('button', { name: 'Use Left / Right layout' }));
    expect(onUpdate).toHaveBeenCalledWith({ layout_id: 'content_left_right' });

    await user.click(
      screen.getByRole('button', { name: 'Change content distribution (currently top)' })
    );
    expect(onUpdate).toHaveBeenCalledWith({ content_alignment: 'center' });
  });
});
