/**
 * STEP 1b — deck renderer honours B1's per-slide composition.
 *
 * Proves:
 *   - selectLayout HONOURS an explicit/archetype layout choice (skips heuristic).
 *   - selectLayout WITHOUT a layout choice is byte-identical to the heuristic.
 *   - assignBlocksToRegions PREFERS the AI's region plan when present, and is
 *     unchanged when composition is absent (back-compat).
 *
 * Lives under tests/unit/** so it runs in CI (src/**\/__tests__ is skipped).
 */
import { describe, expect, it } from 'vitest';

import type { CardBlock, DeckCard } from '../../../src/components/Presentations/wizard/types';
import {
  ARCHETYPE_TO_TEMPLATE,
  assignBlocksToRegions,
  selectLayout,
  type LayoutTemplate,
} from '../../../src/components/Presentations/DeckBuilder/layouts/LayoutEngine';

function block(type: CardBlock['type'], order = 0, content: Record<string, unknown> = {}): CardBlock {
  return {
    block_id: `b-${type}-${order}`,
    card_id: 'c1',
    type,
    content,
    is_refreshable: false,
    position: { area: 'full', order },
    ai_editable: true,
  };
}

/**
 * W7 GUARD-SPLIT reconciliation (2026-07-05) — these fixtures prove selectLayout
 * HONOURS an explicit/archetype layout choice. W7 (guard-split, 2acec9fc46) added
 * a legitimate degradation of split/two-column templates when content is too
 * sparse to fill both columns (see LayoutEngine.ts shouldAvoidSplit). A single
 * `block('heading')` is exactly the sparse case W7 targets, so it now degrades
 * — correctly. RICH_BLOCKS below gives each archetype enough weight/variety
 * (chart + bullet_list + 2 kpi_widgets) to clear the guard-split thresholds
 * (totalWeight ≥ 5, column balance ≥ 35%, a tall-fill block per column) so the
 * explicit-layout-choice behaviour under test is observed without tripping W7.
 */
function richBlocks(): CardBlock[] {
  return [
    block('heading', 0),
    block('chart', 1),
    block('bullet_list', 2, { items: ['Finding one', 'Finding two', 'Finding three'] }),
    block('kpi_widget', 3),
    block('kpi_widget', 4),
  ];
}

/**
 * cover_left_image is the one archetype target where RICH_BLOCKS's `heading`
 * claims the image region's single slot before the real `image` block does
 * (assignBlocksToRegions always places `heading` first). Swap the leading
 * `heading` for an `image` so the image slot is filled by an actual image
 * block and the two columns balance — same total weight/variety otherwise.
 */
function richBlocksForLeftImage(): CardBlock[] {
  return [
    block('image', 0),
    block('chart', 1),
    block('bullet_list', 2, { items: ['Finding one', 'Finding two', 'Finding three'] }),
    block('kpi_widget', 3),
  ];
}

function card(partial: Partial<DeckCard>): DeckCard {
  return {
    card_id: 'c1',
    deck_id: 'd1',
    order_index: 0,
    intent: 'performance_overview',
    layout_id: 'auto',
    title: 'T',
    blocks: [],
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'fade', block_stagger: true },
    is_locked: false,
    ...partial,
  } as DeckCard;
}

describe('STEP 1b — selectLayout honours composition', () => {
  it('honours layout_id=kpi_grid_2x2 archetype → mapped 2x2 KPI grid template (not heuristic)', () => {
    const c = card({
      intent: 'performance_overview',
      layout_id: 'kpi_grid_2x2',
      // RICH_BLOCKS (not a lone heading): the heuristic (which rewards
      // block-count fit) would NOT pick the data-heavy 2x2 grid here, and W7
      // guard-split would degrade a sparse split — this fixture clears both
      // bars so the AI choice-override behaviour under test is observable.
      blocks: richBlocks(),
    });
    const layout = selectLayout(c);
    expect(layout.id).toBe(ARCHETYPE_TO_TEMPLATE['kpi_grid_2x2']); // 'kpi_grid_4'
    expect(layout.id).toBe('kpi_grid_4');
    expect(layout.tags).toContain('data-heavy');
  });

  it('honours an explicit direct template id in layout_id', () => {
    const c = card({ intent: 'key_messages', layout_id: 'content_left_right', blocks: richBlocks() });
    expect(selectLayout(c).id).toBe('content_left_right');
  });

  it('honours composition.layoutVariantId when layout_id is the auto sentinel', () => {
    const c = card({
      intent: 'roadmap',
      layout_id: 'auto',
      composition: { layoutVariantId: 'timeline_strip' },
      blocks: richBlocks(),
    });
    expect(selectLayout(c).id).toBe(ARCHETYPE_TO_TEMPLATE['timeline_strip']); // 'timeline_full'
  });

  it('falls back to heuristic when layout_id is auto and no composition (UNCHANGED)', () => {
    const c = card({
      intent: 'performance_overview',
      layout_id: 'auto',
      blocks: [block('heading'), block('metric_strip'), block('chart'), block('kpi_widget')],
    });
    const honored = selectLayout(c);
    // Recompute the pure heuristic result by stripping any explicit choice.
    const heuristicOnly = selectLayout({ ...c, layout_id: '', composition: null });
    expect(honored.id).toBe(heuristicOnly.id);
    // And it stays within the intent's candidate set (not forced anywhere).
    expect(heuristicOnly.intents).toContain('performance_overview');
  });

  it('falls back to heuristic when layout_id is an UNKNOWN archetype', () => {
    const heuristic = selectLayout(
      card({ intent: 'comparison', layout_id: 'auto', blocks: [block('heading'), block('paragraph')] })
    );
    const unknown = selectLayout(
      card({ intent: 'comparison', layout_id: 'not_a_real_archetype', blocks: [block('heading'), block('paragraph')] })
    );
    expect(unknown.id).toBe(heuristic.id);
  });

  it('every archetype in the map resolves to a real template', () => {
    for (const [archetype, templateId] of Object.entries(ARCHETYPE_TO_TEMPLATE)) {
      // cover_left_image is the one target whose image region needs an actual
      // `image` block to land there first (see richBlocksForLeftImage above).
      const blocks = archetype === 'left_image' ? richBlocksForLeftImage() : richBlocks();
      const layout = selectLayout(card({ layout_id: archetype, blocks }));
      expect(layout.id, `archetype ${archetype}`).toBe(templateId);
    }
  });
});

describe('STEP 1b — assignBlocksToRegions honours composition.regions', () => {
  const twoCol = selectLayout(
    card({ intent: 'key_messages', layout_id: 'content_left_right', blocks: richBlocks() })
  ) as LayoutTemplate;

  it('prefers the AI area assignment for a block type', () => {
    const blocks = [block('chart'), block('paragraph')];
    const map = assignBlocksToRegions(blocks, twoCol, {
      regions: [
        { area: 'left', blockTypes: ['paragraph'] },
        { area: 'right', blockTypes: ['chart'] },
      ],
    });
    expect(map.get('right')!.some((b) => b.type === 'chart')).toBe(true);
    expect(map.get('left')!.some((b) => b.type === 'paragraph')).toBe(true);
  });

  it('is byte-identical to the heuristic when composition is absent', () => {
    const blocks = [block('heading'), block('metric_strip'), block('paragraph')];
    const withNothing = assignBlocksToRegions(blocks, twoCol);
    const withNull = assignBlocksToRegions(blocks, twoCol, null);
    expect(JSON.stringify([...withNothing])).toBe(JSON.stringify([...withNull]));
  });

  it('ignores composition regions naming areas the layout does not expose', () => {
    const blocks = [block('chart')];
    // 'sidebar' is not a region of content_left_right → must not crash / leak.
    const map = assignBlocksToRegions(blocks, twoCol, {
      regions: [{ area: 'sidebar', blockTypes: ['chart'] }],
    });
    expect([...map.keys()].sort()).toEqual(['left', 'right']);
    const placed = [...map.values()].flat();
    expect(placed).toHaveLength(1);
  });
});
