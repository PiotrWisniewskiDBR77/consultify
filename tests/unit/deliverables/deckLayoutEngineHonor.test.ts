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

function block(type: CardBlock['type'], order = 0): CardBlock {
  return {
    block_id: `b-${type}-${order}`,
    card_id: 'c1',
    type,
    content: {},
    is_refreshable: false,
    position: { area: 'full', order },
    ai_editable: true,
  };
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
      // Only ONE block: the heuristic (which rewards block-count fit) would NOT
      // pick the data-heavy 2x2 grid here. Proving the AI choice overrides it.
      blocks: [block('heading')],
    });
    const layout = selectLayout(c);
    expect(layout.id).toBe(ARCHETYPE_TO_TEMPLATE['kpi_grid_2x2']); // 'kpi_grid_4'
    expect(layout.id).toBe('kpi_grid_4');
    expect(layout.tags).toContain('data-heavy');
  });

  it('honours an explicit direct template id in layout_id', () => {
    const c = card({ intent: 'key_messages', layout_id: 'content_left_right', blocks: [block('heading')] });
    expect(selectLayout(c).id).toBe('content_left_right');
  });

  it('honours composition.layoutVariantId when layout_id is the auto sentinel', () => {
    const c = card({
      intent: 'roadmap',
      layout_id: 'auto',
      composition: { layoutVariantId: 'timeline_strip' },
      blocks: [block('heading')],
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
      const layout = selectLayout(card({ layout_id: archetype, blocks: [block('heading')] }));
      expect(layout.id, `archetype ${archetype}`).toBe(templateId);
    }
  });
});

describe('STEP 1b — assignBlocksToRegions honours composition.regions', () => {
  const twoCol = selectLayout(
    card({ intent: 'key_messages', layout_id: 'content_left_right', blocks: [block('heading')] })
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
