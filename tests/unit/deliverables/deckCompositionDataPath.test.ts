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
          // W7 guard-split reconciliation (2026-07-05): include a realistic
          // metrics payload (deckFromUnifiedJson only emits this block for
          // performance_overview slides) so the card isn't a bare heading.
          content: {
            title: 'Maturity',
            type: 'performance_overview',
            metrics: [
              { label: 'Automation', value: '18%', trend: 'down' },
              { label: 'Adoption', value: '42%', trend: 'up' },
              { label: 'Data sources', value: '7', trend: 'flat' },
              { label: 'ROI', value: '3.2x', trend: 'up' },
            ],
          },
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
    // W7 guard-split (2acec9fc46, intentional) downgrades this to a stacked
    // KPI layout: deckFromUnifiedJson's performance_overview path emits a
    // SINGLE metric_strip block (heading + metric_strip, weight ~2.8), never
    // 4 distinct kpi blocks — not enough to fill kpi_grid_4's four cells
    // (kpi2/kpi3/kpi4 land empty → guard-split rule "any column empty").
    // exec_top_kpi ("KPI Strip + Content") is the correct, non-split fallback
    // for real content of this shape; it still honours the metric_strip in
    // its dedicated `kpi` region rather than falling through to the pure
    // heuristic. This does NOT regress composition-carrying (asserted above)
    // — only the final template resolution for genuinely sparse content.
    expect(selectLayout(card).id).toBe('exec_top_kpi');
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
