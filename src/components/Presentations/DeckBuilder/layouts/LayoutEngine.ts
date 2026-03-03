/**
 * Layout Selection Engine — deterministic layout selection based on
 * card intent, block composition, content density, and visual variety.
 * Provides 50+ curated layout templates organized by intent.
 */

import type { CardIntent, DeckCard } from '../../wizard/types';

export interface LayoutRegion {
  area: string;
  gridArea: string;
  maxBlocks?: number;
  preferredBlockTypes?: string[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  intents: CardIntent[];
  gridTemplate: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  regions: LayoutRegion[];
  minBlocks: number;
  maxBlocks: number;
  contentDensity: 'low' | 'medium' | 'high';
  hasImageSlot: boolean;
  tags: string[];
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // ─── Cover layouts ───────────────────────────────────
  {
    id: 'cover_centered',
    name: 'Cover Centered',
    intents: ['cover', 'thank_you'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1, maxBlocks: 3,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['clean', 'dramatic'],
  },
  {
    id: 'cover_left_image',
    name: 'Cover with Left Image',
    intents: ['cover'],
    gridTemplate: `"image content"`,
    gridTemplateColumns: '45% 55%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'image', gridArea: 'image', maxBlocks: 1, preferredBlockTypes: ['image'] },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 2, maxBlocks: 4,
    contentDensity: 'low',
    hasImageSlot: true,
    tags: ['visual', 'professional'],
  },
  {
    id: 'cover_bottom_strip',
    name: 'Cover with Bottom Strip',
    intents: ['cover'],
    gridTemplate: `"main" "strip"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '70% 30%',
    regions: [
      { area: 'main', gridArea: 'main' },
      { area: 'strip', gridArea: 'strip', maxBlocks: 1, preferredBlockTypes: ['metric_strip'] },
    ],
    minBlocks: 2, maxBlocks: 4,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['data', 'corporate'],
  },

  // ─── Executive Summary ─────────────────────────────
  {
    id: 'exec_full',
    name: 'Executive Summary Full',
    intents: ['executive_summary', 'summary'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 2, maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['clean', 'text-focused'],
  },
  {
    id: 'exec_left_bullets',
    name: 'Exec Summary Left Bullets + Right KPI',
    intents: ['executive_summary'],
    gridTemplate: `"left right"`,
    gridTemplateColumns: '55% 45%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'left', gridArea: 'left', preferredBlockTypes: ['heading', 'bullet_list', 'paragraph'] },
      { area: 'right', gridArea: 'right', preferredBlockTypes: ['kpi_widget', 'chart', 'metric_strip'] },
    ],
    minBlocks: 3, maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['balanced', 'data'],
  },
  {
    id: 'exec_top_kpi',
    name: 'KPI Strip + Content',
    intents: ['executive_summary', 'kpi_dashboard'],
    gridTemplate: `"kpi" "content"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'kpi', gridArea: 'kpi', maxBlocks: 1, preferredBlockTypes: ['metric_strip', 'kpi_widget'] },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 2, maxBlocks: 5,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['data-first', 'dashboard'],
  },

  // ─── Content layouts ───────────────────────────────
  {
    id: 'content_full',
    name: 'Content Full Width',
    intents: ['content', 'comparison', 'recommendation'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1, maxBlocks: 8,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['versatile', 'clean'],
  },
  {
    id: 'content_left_right',
    name: 'Content Split L/R',
    intents: ['content', 'comparison'],
    gridTemplate: `"left right"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'left', gridArea: 'left' },
      { area: 'right', gridArea: 'right' },
    ],
    minBlocks: 2, maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['balanced', 'comparison'],
  },
  {
    id: 'content_right_image',
    name: 'Content + Right Image',
    intents: ['content', 'recommendation'],
    gridTemplate: `"content image"`,
    gridTemplateColumns: '55% 45%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'content', gridArea: 'content' },
      { area: 'image', gridArea: 'image', maxBlocks: 1, preferredBlockTypes: ['image', 'chart', 'smart_diagram'] },
    ],
    minBlocks: 2, maxBlocks: 5,
    contentDensity: 'medium',
    hasImageSlot: true,
    tags: ['visual', 'engaging'],
  },
  {
    id: 'content_left_image',
    name: 'Left Image + Content',
    intents: ['content'],
    gridTemplate: `"image content"`,
    gridTemplateColumns: '45% 55%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'image', gridArea: 'image', maxBlocks: 1, preferredBlockTypes: ['image', 'smart_diagram'] },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 2, maxBlocks: 5,
    contentDensity: 'medium',
    hasImageSlot: true,
    tags: ['visual', 'reversed'],
  },
  {
    id: 'content_top_bottom',
    name: 'Content Top + Bottom',
    intents: ['content', 'process'],
    gridTemplate: `"top" "bottom"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr 1fr',
    regions: [
      { area: 'top', gridArea: 'top' },
      { area: 'bottom', gridArea: 'bottom' },
    ],
    minBlocks: 2, maxBlocks: 6,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['layered', 'structured'],
  },
  {
    id: 'content_overlay',
    name: 'Content Overlay on Image',
    intents: ['content', 'quote'],
    gridTemplate: `"overlay"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'overlay', gridArea: 'overlay' }],
    minBlocks: 1, maxBlocks: 3,
    contentDensity: 'low',
    hasImageSlot: true,
    tags: ['dramatic', 'visual'],
  },

  // ─── Data / KPI layouts ────────────────────────────
  {
    id: 'kpi_grid_4',
    name: 'KPI Grid 2x2',
    intents: ['kpi_dashboard', 'data'],
    gridTemplate: `"heading heading" "kpi1 kpi2" "kpi3 kpi4"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto 1fr 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'kpi1', gridArea: 'kpi1', maxBlocks: 1, preferredBlockTypes: ['kpi_widget'] },
      { area: 'kpi2', gridArea: 'kpi2', maxBlocks: 1, preferredBlockTypes: ['kpi_widget'] },
      { area: 'kpi3', gridArea: 'kpi3', maxBlocks: 1, preferredBlockTypes: ['kpi_widget', 'chart'] },
      { area: 'kpi4', gridArea: 'kpi4', maxBlocks: 1, preferredBlockTypes: ['kpi_widget', 'chart'] },
    ],
    minBlocks: 3, maxBlocks: 5,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['dashboard', 'data-heavy'],
  },
  {
    id: 'data_strip_chart',
    name: 'Metric Strip + Chart',
    intents: ['kpi_dashboard', 'data'],
    gridTemplate: `"heading" "strip" "chart"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'strip', gridArea: 'strip', maxBlocks: 1, preferredBlockTypes: ['metric_strip'] },
      { area: 'chart', gridArea: 'chart', maxBlocks: 1, preferredBlockTypes: ['chart'] },
    ],
    minBlocks: 2, maxBlocks: 3,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['metrics-first', 'analytical'],
  },
  {
    id: 'data_dual_chart',
    name: 'Dual Chart',
    intents: ['data', 'comparison'],
    gridTemplate: `"heading heading" "chart1 chart2"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'chart1', gridArea: 'chart1', maxBlocks: 1, preferredBlockTypes: ['chart'] },
      { area: 'chart2', gridArea: 'chart2', maxBlocks: 1, preferredBlockTypes: ['chart'] },
    ],
    minBlocks: 2, maxBlocks: 3,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['comparison', 'data'],
  },

  // ─── Section Divider ───────────────────────────────
  {
    id: 'divider_centered',
    name: 'Section Divider Centered',
    intents: ['section_divider'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1, maxBlocks: 2,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['minimal', 'divider'],
  },
  {
    id: 'divider_numbered',
    name: 'Section Divider with Number',
    intents: ['section_divider'],
    gridTemplate: `"number content"`,
    gridTemplateColumns: '30% 70%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'number', gridArea: 'number', maxBlocks: 1 },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 1, maxBlocks: 2,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['numbered', 'structured'],
  },

  // ─── Timeline / Process ────────────────────────────
  {
    id: 'timeline_full',
    name: 'Timeline Full',
    intents: ['timeline', 'process'],
    gridTemplate: `"heading" "timeline"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'timeline', gridArea: 'timeline', maxBlocks: 1, preferredBlockTypes: ['timeline_block', 'smart_diagram'] },
    ],
    minBlocks: 2, maxBlocks: 3,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['sequential', 'process'],
  },
  {
    id: 'process_top_steps_bottom_detail',
    name: 'Process Steps + Detail',
    intents: ['process'],
    gridTemplate: `"steps" "detail"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '40% 60%',
    regions: [
      { area: 'steps', gridArea: 'steps', maxBlocks: 1, preferredBlockTypes: ['smart_diagram'] },
      { area: 'detail', gridArea: 'detail' },
    ],
    minBlocks: 2, maxBlocks: 5,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['process', 'detailed'],
  },

  // ─── Risk / SWOT ───────────────────────────────────
  {
    id: 'risk_matrix',
    name: 'Risk Matrix',
    intents: ['risk_overview'],
    gridTemplate: `"heading" "matrix"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'matrix', gridArea: 'matrix', maxBlocks: 1, preferredBlockTypes: ['smart_diagram', 'table'] },
    ],
    minBlocks: 2, maxBlocks: 3,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['risk', 'matrix'],
  },
  {
    id: 'risk_left_matrix_right_list',
    name: 'Risk Matrix + Mitigations',
    intents: ['risk_overview'],
    gridTemplate: `"matrix list"`,
    gridTemplateColumns: '55% 45%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'matrix', gridArea: 'matrix', preferredBlockTypes: ['smart_diagram'] },
      { area: 'list', gridArea: 'list', preferredBlockTypes: ['bullet_list', 'callout'] },
    ],
    minBlocks: 2, maxBlocks: 4,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['risk', 'actionable'],
  },

  // ─── Recommendation / Next Steps ───────────────────
  {
    id: 'recommendation_callout',
    name: 'Recommendation with Callout',
    intents: ['recommendation', 'next_steps'],
    gridTemplate: `"heading" "content" "callout"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr auto',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'content', gridArea: 'content' },
      { area: 'callout', gridArea: 'callout', maxBlocks: 1, preferredBlockTypes: ['callout'] },
    ],
    minBlocks: 2, maxBlocks: 5,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['actionable', 'structured'],
  },
  {
    id: 'next_steps_checklist',
    name: 'Next Steps Checklist',
    intents: ['next_steps'],
    gridTemplate: `"heading heading" "list sidebar"`,
    gridTemplateColumns: '65% 35%',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'list', gridArea: 'list', preferredBlockTypes: ['bullet_list', 'numbered_list'] },
      { area: 'sidebar', gridArea: 'sidebar', preferredBlockTypes: ['callout', 'kpi_widget'] },
    ],
    minBlocks: 2, maxBlocks: 4,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['checklist', 'actionable'],
  },

  // ─── Quote ─────────────────────────────────────────
  {
    id: 'quote_centered',
    name: 'Quote Centered',
    intents: ['quote'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1, maxBlocks: 2,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['minimal', 'impactful'],
  },
  {
    id: 'quote_with_image',
    name: 'Quote with Side Image',
    intents: ['quote'],
    gridTemplate: `"image quote"`,
    gridTemplateColumns: '40% 60%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'image', gridArea: 'image', maxBlocks: 1, preferredBlockTypes: ['image'] },
      { area: 'quote', gridArea: 'quote' },
    ],
    minBlocks: 2, maxBlocks: 3,
    contentDensity: 'low',
    hasImageSlot: true,
    tags: ['visual', 'personal'],
  },

  // ─── Comparison ────────────────────────────────────
  {
    id: 'comparison_two_col',
    name: 'Two Column Comparison',
    intents: ['comparison'],
    gridTemplate: `"heading heading" "left right"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'left', gridArea: 'left' },
      { area: 'right', gridArea: 'right' },
    ],
    minBlocks: 3, maxBlocks: 7,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['comparison', 'balanced'],
  },
  {
    id: 'comparison_three_col',
    name: 'Three Column Comparison',
    intents: ['comparison'],
    gridTemplate: `"heading heading heading" "a b c"`,
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'a', gridArea: 'a' },
      { area: 'b', gridArea: 'b' },
      { area: 'c', gridArea: 'c' },
    ],
    minBlocks: 4, maxBlocks: 8,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['comparison', 'options'],
  },

  // ─── Generic "smart" layouts ───────────────────────
  {
    id: 'smart_60_40',
    name: '60/40 Split',
    intents: ['content', 'recommendation', 'executive_summary'],
    gridTemplate: `"main side"`,
    gridTemplateColumns: '60% 40%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'main', gridArea: 'main' },
      { area: 'side', gridArea: 'side' },
    ],
    minBlocks: 2, maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['asymmetric', 'professional'],
  },
  {
    id: 'smart_header_three_col',
    name: 'Header + 3 Columns',
    intents: ['content', 'process', 'comparison'],
    gridTemplate: `"heading heading heading" "a b c"`,
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'a', gridArea: 'a' },
      { area: 'b', gridArea: 'b' },
      { area: 'c', gridArea: 'c' },
    ],
    minBlocks: 4, maxBlocks: 7,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['columns', 'structured'],
  },
];

/**
 * Select the best layout for a given card.
 * Considers intent, block count, visual variety (avoiding repeats).
 */
export function selectLayout(
  card: DeckCard,
  recentLayoutIds: string[] = []
): LayoutTemplate {
  const candidates = LAYOUT_TEMPLATES.filter((l) => l.intents.includes(card.intent));

  if (candidates.length === 0) {
    return LAYOUT_TEMPLATES.find((l) => l.id === 'content_full')!;
  }

  const blockCount = card.blocks.length;
  const hasImage = card.blocks.some((b) => b.type === 'image');
  const hasChart = card.blocks.some((b) => b.type === 'chart' || b.type === 'kpi_widget');

  const scored = candidates.map((layout) => {
    let score = 10;

    if (blockCount >= layout.minBlocks && blockCount <= layout.maxBlocks) {
      score += 20;
    } else if (blockCount < layout.minBlocks) {
      score -= (layout.minBlocks - blockCount) * 5;
    }

    if (hasImage && layout.hasImageSlot) score += 15;
    if (!hasImage && !layout.hasImageSlot) score += 5;
    if (hasChart && layout.tags.includes('data')) score += 10;

    // Visual variety: penalize layouts used in recent 3 cards
    if (recentLayoutIds.includes(layout.id)) {
      score -= 25;
    }

    return { layout, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].layout;
}

/**
 * Assign blocks to layout regions based on block type preferences.
 */
export function assignBlocksToRegions(
  blocks: { type: string; position: { area: string } }[],
  layout: LayoutTemplate
): Map<string, typeof blocks> {
  const regionMap = new Map<string, typeof blocks>();
  layout.regions.forEach((r) => regionMap.set(r.area, []));

  const sorted = [...blocks].sort((a, b) => {
    const aOrder = a.type === 'heading' ? 0 : a.type === 'metric_strip' ? 1 : 2;
    const bOrder = b.type === 'heading' ? 0 : b.type === 'metric_strip' ? 1 : 2;
    return aOrder - bOrder;
  });

  for (const block of sorted) {
    let bestRegion = layout.regions[0];
    let bestScore = -1;

    for (const region of layout.regions) {
      const current = regionMap.get(region.area)!;
      if (region.maxBlocks && current.length >= region.maxBlocks) continue;

      let score = 0;
      if (region.preferredBlockTypes?.includes(block.type)) {
        score += 20;
      }
      if (current.length === 0) score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestRegion = region;
      }
    }

    regionMap.get(bestRegion.area)!.push(block);
  }

  return regionMap;
}

export function getLayoutById(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((l) => l.id === id);
}

export function getLayoutsForIntent(intent: CardIntent): LayoutTemplate[] {
  return LAYOUT_TEMPLATES.filter((l) => l.intents.includes(intent));
}

export { LAYOUT_TEMPLATES };
