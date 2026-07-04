/**
 * @vitest-environment node
 *
 * STEP 1b — data path: B1 composition → persisted slide → FE DeckCard.
 *
 * Proves the FE side of the flow that lets B1's per-slide composition reach the
 * renderer:
 *   - normalizeSlideComposition guards malformed input (fail-open → null).
 *   - deckFromUnifiedJson carries a valid slide.composition onto DeckCard
 *     (both `composition` and `layout_id` = the archetype), so selectLayout can
 *     honour it.
 *   - a slide WITHOUT composition yields the exact prior card shape
 *     (layout_id 'auto', composition null) — byte-identical back-compat.
 *   - end-to-end: a carried composition makes selectLayout resolve the mapped
 *     template instead of the heuristic.
 *
 * Lives under tests/unit/** so CI collects it (src/**\/__tests__ is skipped).
 */
import { describe, expect, it } from 'vitest';

import {
  deckFromUnifiedJson,
  normalizeSlideComposition,
} from '../../../src/components/Presentations/DeckBuilder/deckData';
import {
  ARCHETYPE_TO_TEMPLATE,
  selectLayout,
} from '../../../src/components/Presentations/DeckBuilder/layouts/LayoutEngine';

describe('STEP 1b — normalizeSlideComposition (fail-open guard)', () => {
  it('returns null for non-object / empty input', () => {
    expect(normalizeSlideComposition(null)).toBeNull();
    expect(normalizeSlideComposition(undefined)).toBeNull();
    expect(normalizeSlideComposition('nope')).toBeNull();
    expect(normalizeSlideComposition({})).toBeNull();
  });

  it('keeps a valid layoutVariantId + regions and drops empty regions', () => {
    const c = normalizeSlideComposition({
      layoutVariantId: '  kpi_grid_2x2  ',
      emphasis: 'data',
      regions: [
        { area: 'left', blockTypes: ['kpi_widget', 'metric_strip'] },
        { area: '  ', blockTypes: ['chart'] }, // blank area → dropped
        { area: 'right' }, // no blockTypes → kept as area-only
      ],
    });
    expect(c).not.toBeNull();
    expect(c!.layoutVariantId).toBe('kpi_grid_2x2');
    expect(c!.emphasis).toBe('data');
    expect(c!.regions).toEqual([
      { area: 'left', blockTypes: ['kpi_widget', 'metric_strip'] },
      { area: 'right' },
    ]);
  });

  it('returns null when nothing useful survives', () => {
    expect(normalizeSlideComposition({ layoutVariantId: '   ' })).toBeNull();
    expect(normalizeSlideComposition({ regions: [{ area: '' }] })).toBeNull();
  });
});

const UNIFIED = (slides: unknown[]) => ({
  meta: { language: 'en' },
  slides,
});

describe('STEP 1b — deckFromUnifiedJson carries composition', () => {
  it('carries a valid composition onto the card (composition + layout_id archetype)', () => {
    const deck = deckFromUnifiedJson({
      deckId: 'd1',
      unifiedJson: UNIFIED([
        {
          intent: 'performance_overview',
          key_message: 'Four metrics + trend',
          content: { title: 'Maturity', type: 'performance_overview' },
          composition: {
            layoutVariantId: 'kpi_grid_2x2',
            emphasis: 'data',
            regions: [{ area: 'left', blockTypes: ['kpi_widget'] }],
          },
        },
      ]),
    });
    expect(deck).not.toBeNull();
    const card = deck!.cards[0];
    expect(card.layout_id).toBe('kpi_grid_2x2');
    expect(card.composition).not.toBeNull();
    expect(card.composition!.layoutVariantId).toBe('kpi_grid_2x2');
    // The carried composition makes selectLayout honour the mapped template.
    expect(selectLayout(card).id).toBe(ARCHETYPE_TO_TEMPLATE['kpi_grid_2x2']);
  });

  it('is byte-identical to prior behaviour when no composition (back-compat)', () => {
    const deck = deckFromUnifiedJson({
      deckId: 'd1',
      unifiedJson: UNIFIED([
        {
          intent: 'key_messages',
          key_message: 'Plain slide',
          content: { title: 'Msg', type: 'key_messages' },
        },
      ]),
    });
    const card = deck!.cards[0];
    expect(card.layout_id).toBe('auto');
    expect(card.composition).toBeNull();
  });

  it('malformed composition falls back to auto/null (never throws)', () => {
    const deck = deckFromUnifiedJson({
      deckId: 'd1',
      unifiedJson: UNIFIED([
        {
          intent: 'key_messages',
          key_message: 'x',
          content: { title: 'x', type: 'key_messages' },
          composition: { regions: 'not-an-array', layoutVariantId: 42 },
        },
      ]),
    });
    const card = deck!.cards[0];
    expect(card.layout_id).toBe('auto');
    expect(card.composition).toBeNull();
  });
});
