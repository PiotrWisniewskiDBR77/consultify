// @vitest-environment node
/**
 * P13 — ekran = eksport PARITY (LayoutEngine ↔ PPTX LAYOUT_REGISTRY).
 *
 * The single biggest structural gap in the presentation program was that the
 * on-screen deck editor and the server PPTX export chose slide layouts through
 * two disconnected code paths: the FE `LayoutEngine.selectLayout` honours a
 * slide's `composition.layoutVariantId` (with W7 guard-split degradation), while
 * the server PPTX pipeline picked a layout from `slide.intent` ALONE — unaware of
 * composition. So the screen and the exported .pptx could visually diverge.
 *
 * This test is the parity guarantee. For the SAME `UnifiedSlide` it computes:
 *   - the ON-SCREEN decision: `deckFromUnifiedJson(slide)` → `selectLayout(card)`
 *     (exactly what the DeckBuilder editor renders), and
 *   - the SERVER PPTX decision: `resolveDeckLayoutTemplateId(slide)` (the port
 *     the PPTX pipeline now consults via `resolveLayoutContext`),
 * and asserts they resolve the SAME canonical layout-template id — including the
 * W7 guard-split fallback case. If the FE `LayoutEngine` decision ever changes,
 * this cross-boundary test fails until the server port is brought back in step.
 *
 * Representative slide types covered: two_column, kpi_grid_2x2, cover_left_image,
 * and a KPI-strip guard-split fallback (sparse two_column → stacked).
 */

import { describe, expect, it } from 'vitest';

// ── ON-SCREEN side (FE) ──────────────────────────────────────────────────────
import { selectLayout } from '@/components/Presentations/DeckBuilder/layouts/LayoutEngine';
import { deckFromUnifiedJson } from '@/components/Presentations/DeckBuilder/deckData';

// ── EXPORT side (server PPTX) ────────────────────────────────────────────────
import {
  resolveDeckLayoutTemplateId,
  resolveTemplateIdFromCardShape,
  topologyOfTemplate,
} from '../../../server/src/services/report/pptx/layouts/deckLayoutDecision.js';
import { resolveLayoutContext } from '../../../server/src/services/report/pptx/layouts/index.js';
import type { UnifiedSlide } from '../../../server/src/services/report/pptx/types.js';

import type { CardBlock, DeckCard } from '@/components/Presentations/wizard/types';

/**
 * Compute the ON-SCREEN layout id for a slide exactly as the DeckBuilder editor
 * does: run the same bridge (`deckFromUnifiedJson`) the FE renderer runs, then
 * `selectLayout` (recentLayoutIds = [] — the per-slide decision, no deck-wide
 * variety bias, which is what the server port models).
 */
function onScreenLayoutId(slide: UnifiedSlide): string {
  const deck = deckFromUnifiedJson({
    deckId: 'parity',
    unifiedJson: { meta: baseMeta(), slides: [slide] },
  });
  expect(deck).not.toBeNull();
  const card = deck!.cards[0];
  return selectLayout(card, []).id;
}

/** Compute the SERVER PPTX layout id (the decision the pipeline now honours). */
function exportLayoutId(slide: UnifiedSlide): string {
  return resolveDeckLayoutTemplateId(slide);
}

function baseMeta() {
  return {
    client: 'Acme',
    project: 'Parity',
    date: '2026-07-05',
    author: 'Consultify',
    confidentiality: 'internal',
    language: 'en',
  };
}

/** A comparison slide with two rich sides — enough to fill a two-column split. */
function twoColumnSlide(): UnifiedSlide {
  return {
    intent: 'comparison',
    key_message: 'Current vs target operating model',
    content: {
      type: 'comparison',
      title: 'Current vs Target',
      left: { label: 'Current', points: ['Manual handoffs', 'Siloed data', 'No SLAs'] },
      right: { label: 'Target', points: ['Automated flow', 'Unified data', 'Tracked SLAs'] },
    } as any,
    composition: { layoutVariantId: 'two_column' },
  } as UnifiedSlide;
}

/** A performance slide the AI planned as a 2×2 KPI dashboard. */
function kpiGridSlide(): UnifiedSlide {
  return {
    intent: 'performance_overview',
    key_message: 'Program is tracking to plan',
    content: {
      type: 'performance_overview',
      title: 'Q3 Scorecard',
      metrics: [
        { label: 'Revenue', value: '$4.2M', trend: 'up' },
        { label: 'NPS', value: '61', trend: 'up' },
        { label: 'Churn', value: '3.1%', trend: 'down' },
        { label: 'CAC', value: '$820', trend: 'flat' },
      ],
    } as any,
    composition: { layoutVariantId: 'kpi_grid_2x2' },
  } as UnifiedSlide;
}

/** A cover the AI planned as a left-image cover. */
function coverLeftImageSlide(): UnifiedSlide {
  return {
    intent: 'cover',
    key_message: '',
    content: {
      type: 'cover',
      title: 'Operating Model Transformation',
      subtitle: 'Board review',
      organization: 'Acme Corp',
      date: 'July 2026',
    } as any,
    composition: {
      layoutVariantId: 'left_image',
      regions: [{ area: 'image', blockTypes: ['image'] }],
    },
  } as UnifiedSlide;
}

/**
 * A two_column slide whose content is too SPARSE to fill two columns — the W7
 * guard-split case. Both sides must degrade to the SAME stacked fallback.
 */
function sparseTwoColumnSlide(): UnifiedSlide {
  return {
    intent: 'key_messages',
    key_message: 'One thin point',
    content: {
      type: 'key_messages',
      title: 'A single message',
      // no bullets / no rich blocks → only heading (+ maybe one light block)
    } as any,
    composition: { layoutVariantId: 'two_column' },
  } as UnifiedSlide;
}

describe('P13 — screen ↔ export layout parity', () => {
  /**
   * Expected resolved template ids are the ACTUAL on-screen decision for each
   * `UnifiedSlide` after the FE bridge (`deckFromUnifiedJson`) derives its blocks
   * and W7 guard-split runs. They are asserted here so the parity is pinned to a
   * concrete, human-readable outcome — not just "both sides agree with each
   * other". (E.g. the comparison slide's derived blocks are heading + a 2-row
   * table; the split `content_left_right` guard-splits down to `content_full`,
   * and the export must land on the same `content_full`.)
   */
  const cases: Array<{ name: string; slide: UnifiedSlide; expectTemplate: string }> = [
    { name: 'two_column (comparison → guard-split → full)', slide: twoColumnSlide(), expectTemplate: 'content_full' },
    { name: 'kpi_grid_2x2 (performance → metric-strip dashboard)', slide: kpiGridSlide(), expectTemplate: 'exec_top_kpi' },
    { name: 'cover left_image (no image block → centered)', slide: coverLeftImageSlide(), expectTemplate: 'cover_centered' },
    { name: 'sparse two_column → guard-split fallback', slide: sparseTwoColumnSlide(), expectTemplate: 'exec_full' },
  ];

  for (const { name, slide, expectTemplate } of cases) {
    it(`agrees on the layout template for: ${name}`, () => {
      const screen = onScreenLayoutId(slide);
      const exported = exportLayoutId(slide);
      // The core parity assertion: screen and export resolve the SAME template.
      expect(exported).toBe(screen);
      // …and it is the concrete template the on-screen editor renders.
      expect(exported).toBe(expectTemplate);
    });
  }

  it('guard-split degrades the sparse two_column to a NON-split template on both sides', () => {
    const slide = sparseTwoColumnSlide();
    const screen = onScreenLayoutId(slide);
    const exported = exportLayoutId(slide);
    expect(exported).toBe(screen);
    // The sparse slide must NOT stay on the split template.
    expect(exported).not.toBe('content_left_right');
    // …and the server topology agrees it is now stacked (single column).
    expect(topologyOfTemplate(exported)).toBe('stacked');
  });

  it('resolveLayoutContext exposes the same decision + a matching topology', () => {
    const slide = kpiGridSlide();
    const ctx = resolveLayoutContext(slide);
    expect(ctx.resolvedLayoutTemplateId).toBe(onScreenLayoutId(slide));
    expect(ctx.resolvedLayoutTemplateId).toBe('exec_top_kpi');
    // exec_top_kpi is a stacked kpi-strip topology (single column), not a split.
    expect(ctx.topology).toBe('stacked');
  });

  it('maps the cover_left_image template to the image_split topology (Cover honours it)', () => {
    // The `cover_left_image` template — when a slide legitimately resolves to it
    // (a cover carrying an actual image block, which the CoverLayout renderer
    // reads via `ctx.resolvedLayoutTemplateId`) — is an image-split topology, so
    // the PPTX Cover renders the left image band instead of a centered hero.
    expect(topologyOfTemplate('cover_left_image')).toBe('image_split');
    expect(topologyOfTemplate('cover_bottom_strip')).toBe('stacked');
    expect(topologyOfTemplate('cover_centered')).toBe('stacked');
    expect(topologyOfTemplate('kpi_grid_4')).toBe('kpi_grid');
    expect(topologyOfTemplate('content_left_right')).toBe('split');
    expect(topologyOfTemplate('comparison_three_col')).toBe('three_col');
  });

  // ── RICH content: split / kpi-grid / image templates SURVIVE guard-split ──
  // The bridge-derived (UnifiedSlide) cases above are intentionally sparse, so
  // splits degrade. These prove the decision CORE also AGREES on RICH content
  // where the chosen template legitimately survives — i.e. the archetype map +
  // guard-split thresholds match FE `selectLayout` exactly, not just the
  // degraded outcomes.
  describe('rich content (template survives guard-split)', () => {
    let uid = 0;
    const bid = () => `blk-${++uid}`;
    function block(type: CardBlock['type'], content: Record<string, unknown> = {}): CardBlock {
      return {
        block_id: bid(),
        card_id: 'c',
        type,
        content,
        is_refreshable: false,
        position: { area: 'full', order: 0 },
        ai_editable: true,
      };
    }
    function card(partial: Partial<DeckCard> & { blocks: CardBlock[] }): DeckCard {
      return {
        card_id: 'c',
        deck_id: 'd',
        order_index: 0,
        intent: 'key_messages',
        layout_id: 'auto',
        title: 'T',
        blocks: partial.blocks,
        source_refs: [],
        has_refreshable_data: false,
        background: { type: 'theme' },
        animations: { entrance: 'fade', block_stagger: true },
        is_locked: false,
        ...partial,
      } as DeckCard;
    }

    const richCases: Array<{ name: string; card: DeckCard; expect: string }> = [
      {
        name: 'two_column survives with two balanced tall-fill columns',
        card: card({
          intent: 'comparison',
          layout_id: 'two_column',
          composition: {
            layoutVariantId: 'two_column',
            regions: [
              { area: 'left', blockTypes: ['chart'] },
              { area: 'right', blockTypes: ['bullet_list'] },
            ],
          },
          blocks: [
            block('chart'),
            block('bullet_list', { items: ['a', 'b', 'c', 'd', 'e', 'f'] }),
          ],
        }),
        expect: 'content_left_right',
      },
      {
        name: 'kpi_grid_2x2 survives with four kpi widgets',
        card: card({
          intent: 'performance_overview',
          layout_id: 'kpi_grid_2x2',
          composition: { layoutVariantId: 'kpi_grid_2x2' },
          blocks: [
            block('heading', { text: 'Scorecard' }),
            block('kpi_widget'),
            block('kpi_widget'),
            block('kpi_widget'),
            block('kpi_widget'),
          ],
        }),
        expect: 'kpi_grid_4',
      },
      {
        // NOTE: no leading `heading` block. assignBlocksToRegions always sorts
        // `heading` first, so a heading would claim the single-slot `image`
        // region before the real image block and imbalance the columns (see the
        // same caveat in deckLayoutEngineHonor.test.ts). Leading with the image
        // block lets the left-image cover survive guard-split.
        name: 'cover left_image survives with an actual image block',
        card: card({
          intent: 'cover',
          layout_id: 'left_image',
          composition: {
            layoutVariantId: 'left_image',
            regions: [
              { area: 'image', blockTypes: ['image'] },
              { area: 'content', blockTypes: ['paragraph', 'bullet_list'] },
            ],
          },
          blocks: [
            block('image'),
            block('bullet_list', { items: ['Board review', 'FY26 plan', 'Three horizons'] }),
          ],
        }),
        expect: 'cover_left_image',
      },
    ];

    for (const rc of richCases) {
      it(`FE selectLayout == server decision core: ${rc.name}`, () => {
        const feId = selectLayout(rc.card, []).id;
        const serverId = resolveTemplateIdFromCardShape({
          intent: rc.card.intent,
          layout_id: rc.card.layout_id,
          composition: rc.card.composition ?? null,
          blocks: rc.card.blocks.map((b) => ({ type: b.type, content: b.content, position: { area: 'full' } })),
        });
        expect(serverId).toBe(feId);
        expect(serverId).toBe(rc.expect);
      });
    }
  });

  it('falls back to the intent heuristic (parity preserved) when no composition is present', () => {
    const slide: UnifiedSlide = {
      intent: 'performance_overview',
      key_message: 'Scorecard',
      content: {
        type: 'performance_overview',
        title: 'Scorecard',
        metrics: [{ label: 'Revenue', value: '$4.2M', trend: 'up' }],
      } as any,
      // no composition → both sides use the intent heuristic
    } as UnifiedSlide;
    expect(exportLayoutId(slide)).toBe(onScreenLayoutId(slide));
  });
});
