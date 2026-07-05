/**
 * W7 fill-canvas + guard-split — LayoutEngine unit tests.
 *
 * Guard-split: sparse content that would render as a half-empty second column
 * must be downgraded to a stacked/full-width layout (the slide1 regression from
 * the P1.2 shots: two_column with a light right column).
 *
 * Fill-canvas: the vertical-fill mode must spread/center sparse content so it is
 * not glued to the top with a dead bottom (M17-DECK-PERFEKCJA §rytm pionowy,
 * DoD#2). Asserted on the pure decision function, not on pixels.
 */
import { describe, it, expect, afterEach } from 'vitest';

import type { CardBlock, DeckCard } from '@/components/Presentations/wizard/types';
import {
  countSideBySideColumns,
  estimateBlockWeight,
  getLayoutById,
  isSplitLikeLayout,
  resolveExplicitLayout,
  selectLayout,
  setW7FillCanvas,
  shouldAvoidSplit,
  verticalFillMode,
} from '@/components/Presentations/DeckBuilder/layouts/LayoutEngine';

let uid = 0;
const bid = () => `blk-${++uid}`;

function block(
  type: CardBlock['type'],
  content: Record<string, unknown>
): CardBlock {
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
    intent: 'executive_summary',
    layout_id: 'auto',
    composition: null,
    title: 't',
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'none', block_stagger: false },
    is_locked: false,
    ...partial,
  } as DeckCard;
}

afterEach(() => setW7FillCanvas(true));

describe('W7 column detection', () => {
  it('flags a two-column template as split-like (2 side-by-side columns)', () => {
    const two = getLayoutById('content_left_right')!;
    expect(countSideBySideColumns(two)).toBe(2);
    expect(isSplitLikeLayout(two)).toBe(true);
  });

  it('does NOT flag a full-width stacked template as split-like', () => {
    const full = getLayoutById('content_full')!;
    expect(countSideBySideColumns(full)).toBe(1);
    expect(isSplitLikeLayout(full)).toBe(false);
  });

  it('counts three-column templates as 3 columns', () => {
    const three = getLayoutById('comparison_three_col')!;
    expect(countSideBySideColumns(three)).toBe(3);
  });
});

describe('W7 guard-split — sparse content avoids split', () => {
  // Reproduces slide1: two_column, heading + 3-item bullets (left) + short
  // callout + short paragraph (right). The right column is far lighter → the
  // split must be rejected.
  const sparseBlocks = [
    block('heading', { text: 'Streszczenie wykonawcze', level: 2 }),
    block('bullet_list', {
      items: [
        'Zaledwie 18% procesów jest zautomatyzowanych.',
        'Dane rozproszone w 7 systemach.',
        'Adopcja spadła o 12 p.p.',
      ],
    }),
    block('callout', { text: 'Rekomendacja: platforma w 90 dni.', variant: 'recommendation' }),
    block('paragraph', { text: 'Priorytet wynika z ROI.' }),
  ];
  const composition = {
    layoutVariantId: 'two_column',
    regions: [
      { area: 'left', blockTypes: ['heading', 'bullet_list'] },
      { area: 'right', blockTypes: ['callout', 'paragraph'] },
    ],
  };

  it('shouldAvoidSplit=true when one column is far lighter than the other', () => {
    const two = getLayoutById('content_left_right')!;
    expect(shouldAvoidSplit(sparseBlocks, two, composition)).toBe(true);
  });

  it('resolveExplicitLayout downgrades two_column → a non-split (stacked) layout', () => {
    const c = card({
      intent: 'executive_summary',
      composition,
      blocks: sparseBlocks,
    });
    const resolved = resolveExplicitLayout(c);
    expect(resolved).toBeDefined();
    expect(isSplitLikeLayout(resolved!)).toBe(false);
  });

  it('selectLayout never returns a split-like layout for this sparse card', () => {
    const c = card({ intent: 'executive_summary', composition, blocks: sparseBlocks });
    expect(isSplitLikeLayout(selectLayout(c))).toBe(false);
  });
});

describe('W7 guard-split — balanced content KEEPS the split (slide4)', () => {
  // Reproduces slide4 split_lr: a chart (tall-fill) on the left, heading+bullets
  // on the right. Both columns are substantial and balanced → split is justified
  // and MUST be kept (zero-regression guard for a legitimately-split slide).
  const balanced = [
    block('heading', { text: 'Porównanie z konkurencją', level: 2 }),
    block('chart', {
      chartType: 'bar',
      series: [
        { name: 'VTS', data: [3, 2, 4, 2, 3] },
        { name: 'Konkurent A', data: [4, 4, 4, 3, 4] },
      ],
    }),
    block('bullet_list', {
      items: [
        'VTS wyprzedza rynek tylko w kulturze danych.',
        'Największa luka: automatyzacja procesów (-2 pkt).',
        'Konkurent B lideruje w integracji systemów.',
      ],
    }),
  ];
  const comp = {
    layoutVariantId: 'split_lr',
    regions: [
      { area: 'left', blockTypes: ['chart'] },
      { area: 'right', blockTypes: ['heading', 'bullet_list'] },
    ],
  };
  it('shouldAvoidSplit=false — chart-bearing column + balanced text column', () => {
    const two = getLayoutById('content_left_right')!;
    expect(shouldAvoidSplit(balanced, two, comp)).toBe(false);
  });
  it('resolveExplicitLayout KEEPS a split-like layout for slide4', () => {
    const c = card({ intent: 'comparison', composition: comp, blocks: balanced });
    expect(isSplitLikeLayout(resolveExplicitLayout(c)!)).toBe(true);
  });
});

describe('W7 guard-split — kpi_grid_2x2 with strip+chart avoids the grid (slide2)', () => {
  // Reproduces slide2: B1 picks variant kpi_grid_2x2, but the content is a SINGLE
  // metric_strip (already a horizontal 4-KPI row) + a chart — NOT four separate
  // kpi_widget blocks. Routed into kpi_grid_4's 2×2 the strip lands in one cell
  // and the twin cell renders EMPTY, squeezing everything to the left half with a
  // dead vertical gap (the −0.04 regression on the P1.2 shots). The guard must
  // reject the grid and stack it full-width (heading → strip → chart).
  const stripChartBlocks = [
    block('heading', { text: 'Stan obecny — wskaźniki dojrzałości', level: 2 }),
    block('metric_strip', {
      metrics: [
        { label: 'Automatyzacja', value: '18%', trend: 'down' },
        { label: 'NPS klienta', value: '31', trend: 'flat' },
        { label: 'Adopcja narzędzi', value: '54%', trend: 'down' },
        { label: 'Koszt operacyjny', value: '+9%', trend: 'up' },
      ],
    }),
    block('chart', {
      chartType: 'line',
      title: 'Trend adopcji narzędzi (12 mies.)',
      series: [{ name: 'Adopcja', data: [66, 63, 61, 59, 58, 56, 55, 54, 54, 53, 54, 54] }],
    }),
  ];
  const comp = {
    layoutVariantId: 'kpi_grid_2x2',
    regions: [
      { area: 'top', blockTypes: ['heading', 'metric_strip'] },
      { area: 'bottom', blockTypes: ['chart'] },
    ],
  };

  it('shouldAvoidSplit=true — kpi_grid_4 leaves an empty twin cell for strip+chart', () => {
    const grid = getLayoutById('kpi_grid_4')!;
    expect(isSplitLikeLayout(grid)).toBe(true);
    expect(shouldAvoidSplit(stripChartBlocks, grid, comp)).toBe(true);
  });

  it('resolveExplicitLayout downgrades kpi_grid_2x2 → a non-split (stacked) layout', () => {
    const c = card({ intent: 'performance_overview', composition: comp, blocks: stripChartBlocks });
    const resolved = resolveExplicitLayout(c);
    expect(resolved).toBeDefined();
    expect(isSplitLikeLayout(resolved!)).toBe(false);
  });

  it('selectLayout never returns a split-like layout for this strip+chart card', () => {
    const c = card({ intent: 'performance_overview', composition: comp, blocks: stripChartBlocks });
    expect(isSplitLikeLayout(selectLayout(c))).toBe(false);
  });
});

describe('W7 block-weight estimator', () => {
  it('weights a chart heavier than a one-line heading', () => {
    expect(estimateBlockWeight(block('chart', { series: [] }))).toBeGreaterThan(
      estimateBlockWeight(block('heading', { text: 'x' }))
    );
  });
  it('a longer bullet list weighs more than a short one', () => {
    const short = block('bullet_list', { items: ['a'] });
    const long = block('bullet_list', { items: ['a', 'b', 'c', 'd', 'e'] });
    expect(estimateBlockWeight(long)).toBeGreaterThan(estimateBlockWeight(short));
  });
});

describe('W7 fill-canvas — vertical rhythm mode', () => {
  it('sparse single block → CENTER (not glued to top)', () => {
    // Reproduces slide3 big_number: one dominant KPI on a stacked full region.
    const blocks = [block('kpi_widget', { value: '18%', label: 'procesów' })];
    expect(verticalFillMode(blocks)).toBe('center');
  });

  it('several light blocks → CENTER (grouped + balanced margins, not top-glued)', () => {
    const blocks = [
      block('heading', { text: 'Rekomendacja' }),
      block('callout', { text: 'Wdrożyć platformę.' }),
      block('paragraph', { text: 'Efekt: 18% → 50%.' }),
    ];
    // Sparse content is centered as a group, NOT flung apart with space-between
    // (that broke perceived hierarchy per 2026-07-04 VisionQA).
    expect(verticalFillMode(blocks)).toBe('center');
  });

  it('dense content → TOP (do not stretch a full slide)', () => {
    const blocks = [
      block('chart', { series: [{ data: [1, 2, 3] }] }),
      block('bullet_list', { items: ['a', 'b', 'c', 'd', 'e'] }),
      block('paragraph', { text: 'x'.repeat(200) }),
    ];
    expect(verticalFillMode(blocks)).toBe('top');
  });

  it('flag OFF → always TOP (harness BEFORE mode / fail-open)', () => {
    setW7FillCanvas(false);
    const blocks = [block('kpi_widget', { value: '18%' })];
    expect(verticalFillMode(blocks)).toBe('top');
  });
});

describe('W7 fail-open — cover/quote untouched', () => {
  it('cover intent (centered) still resolves to a cover template', () => {
    const c = card({
      intent: 'cover',
      composition: { layoutVariantId: 'centered' },
      blocks: [block('heading', { text: 'Title', level: 1 })],
    });
    const resolved = resolveExplicitLayout(c);
    expect(resolved?.intents).toContain('cover');
    // cover_centered is single-region → not split-like, never downgraded.
    expect(isSplitLikeLayout(resolved!)).toBe(false);
  });

  it('cover/section intents are EXCLUDED from fill-canvas (stay grouped → top)', () => {
    const coverBlocks = [
      block('heading', { text: 'Diagnoza transformacji cyfrowej', level: 1 }),
      block('paragraph', { text: 'Ustalenia i rekomendacja dla zarządu.' }),
      block('divider', {}),
    ];
    // Without an intent these light blocks would center; with 'cover' they stay top-grouped.
    expect(verticalFillMode(coverBlocks)).toBe('center');
    expect(verticalFillMode(coverBlocks, undefined, 'cover')).toBe('top');
    expect(verticalFillMode(coverBlocks, undefined, 'section_intro')).toBe('top');
  });
});
