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
    intents: ['cover'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1,
    maxBlocks: 3,
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
    minBlocks: 2,
    maxBlocks: 4,
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
    minBlocks: 2,
    maxBlocks: 4,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['data', 'corporate'],
  },

  // ─── Executive Summary ─────────────────────────────
  {
    id: 'exec_full',
    name: 'Executive Summary Full',
    intents: ['executive_summary', 'key_messages'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 2,
    maxBlocks: 6,
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
      {
        area: 'left',
        gridArea: 'left',
        preferredBlockTypes: ['heading', 'bullet_list', 'paragraph'],
      },
      {
        area: 'right',
        gridArea: 'right',
        preferredBlockTypes: ['kpi_widget', 'chart', 'metric_strip'],
      },
    ],
    minBlocks: 3,
    maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['balanced', 'data'],
  },
  {
    id: 'exec_top_kpi',
    name: 'KPI Strip + Content',
    intents: ['executive_summary', 'performance_overview'],
    gridTemplate: `"kpi" "content"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      {
        area: 'kpi',
        gridArea: 'kpi',
        maxBlocks: 1,
        preferredBlockTypes: ['metric_strip', 'kpi_widget'],
      },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['data-first', 'dashboard'],
  },

  // ─── Content layouts ───────────────────────────────
  {
    id: 'content_full',
    name: 'Content Full Width',
    intents: ['key_messages', 'comparison', 'recommendation_portfolio'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1,
    maxBlocks: 8,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['versatile', 'clean'],
  },
  {
    id: 'content_left_right',
    name: 'Content Split L/R',
    intents: ['key_messages', 'comparison'],
    gridTemplate: `"left right"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'left', gridArea: 'left' },
      { area: 'right', gridArea: 'right' },
    ],
    minBlocks: 2,
    maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['balanced', 'comparison'],
  },
  {
    id: 'content_right_image',
    name: 'Content + Right Image',
    intents: ['key_messages', 'recommendation_portfolio'],
    gridTemplate: `"content image"`,
    gridTemplateColumns: '55% 45%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'content', gridArea: 'content' },
      {
        area: 'image',
        gridArea: 'image',
        maxBlocks: 1,
        preferredBlockTypes: ['image', 'chart', 'smart_diagram'],
      },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    contentDensity: 'medium',
    hasImageSlot: true,
    tags: ['visual', 'engaging'],
  },
  {
    id: 'content_left_image',
    name: 'Left Image + Content',
    intents: ['key_messages'],
    gridTemplate: `"image content"`,
    gridTemplateColumns: '45% 55%',
    gridTemplateRows: '1fr',
    regions: [
      {
        area: 'image',
        gridArea: 'image',
        maxBlocks: 1,
        preferredBlockTypes: ['image', 'smart_diagram'],
      },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    contentDensity: 'medium',
    hasImageSlot: true,
    tags: ['visual', 'reversed'],
  },
  {
    id: 'content_top_bottom',
    name: 'Content Top + Bottom',
    intents: ['key_messages', 'roadmap'],
    gridTemplate: `"top" "bottom"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr 1fr',
    regions: [
      { area: 'top', gridArea: 'top' },
      { area: 'bottom', gridArea: 'bottom' },
    ],
    minBlocks: 2,
    maxBlocks: 6,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['layered', 'structured'],
  },
  {
    id: 'content_overlay',
    name: 'Content Overlay on Image',
    intents: ['key_messages', 'single_insight'],
    gridTemplate: `"overlay"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'overlay', gridArea: 'overlay' }],
    minBlocks: 1,
    maxBlocks: 3,
    contentDensity: 'low',
    hasImageSlot: true,
    tags: ['dramatic', 'visual'],
  },

  // ─── Data / KPI layouts ────────────────────────────
  {
    id: 'kpi_grid_4',
    name: 'KPI Grid 2x2',
    intents: ['performance_overview', 'single_insight'],
    gridTemplate: `"heading heading" "kpi1 kpi2" "kpi3 kpi4"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto 1fr 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'kpi1', gridArea: 'kpi1', maxBlocks: 1, preferredBlockTypes: ['kpi_widget'] },
      { area: 'kpi2', gridArea: 'kpi2', maxBlocks: 1, preferredBlockTypes: ['kpi_widget'] },
      {
        area: 'kpi3',
        gridArea: 'kpi3',
        maxBlocks: 1,
        preferredBlockTypes: ['kpi_widget', 'chart'],
      },
      {
        area: 'kpi4',
        gridArea: 'kpi4',
        maxBlocks: 1,
        preferredBlockTypes: ['kpi_widget', 'chart'],
      },
    ],
    minBlocks: 3,
    maxBlocks: 5,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['dashboard', 'data-heavy'],
  },
  {
    id: 'data_strip_chart',
    name: 'Metric Strip + Chart',
    intents: ['performance_overview', 'single_insight'],
    gridTemplate: `"heading" "strip" "chart"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'strip', gridArea: 'strip', maxBlocks: 1, preferredBlockTypes: ['metric_strip'] },
      { area: 'chart', gridArea: 'chart', maxBlocks: 1, preferredBlockTypes: ['chart'] },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['metrics-first', 'analytical'],
  },
  {
    id: 'data_dual_chart',
    name: 'Dual Chart',
    intents: ['single_insight', 'comparison'],
    gridTemplate: `"heading heading" "chart1 chart2"`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'chart1', gridArea: 'chart1', maxBlocks: 1, preferredBlockTypes: ['chart'] },
      { area: 'chart2', gridArea: 'chart2', maxBlocks: 1, preferredBlockTypes: ['chart'] },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['comparison', 'data'],
  },

  // ─── Section Divider ───────────────────────────────
  {
    id: 'divider_centered',
    name: 'Section Divider Centered',
    intents: ['section_intro'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1,
    maxBlocks: 2,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['minimal', 'divider'],
  },
  {
    id: 'divider_numbered',
    name: 'Section Divider with Number',
    intents: ['section_intro'],
    gridTemplate: `"number content"`,
    gridTemplateColumns: '30% 70%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'number', gridArea: 'number', maxBlocks: 1 },
      { area: 'content', gridArea: 'content' },
    ],
    minBlocks: 1,
    maxBlocks: 2,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['numbered', 'structured'],
  },

  // ─── Timeline / Process ────────────────────────────
  {
    id: 'timeline_full',
    name: 'Timeline Full',
    intents: ['roadmap'],
    gridTemplate: `"heading" "timeline"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      {
        area: 'timeline',
        gridArea: 'timeline',
        maxBlocks: 1,
        preferredBlockTypes: ['timeline_block', 'smart_diagram'],
      },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['sequential', 'process'],
  },
  {
    id: 'process_top_steps_bottom_detail',
    name: 'Process Steps + Detail',
    intents: ['roadmap'],
    gridTemplate: `"steps" "detail"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '40% 60%',
    regions: [
      { area: 'steps', gridArea: 'steps', maxBlocks: 1, preferredBlockTypes: ['smart_diagram'] },
      { area: 'detail', gridArea: 'detail' },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['process', 'detailed'],
  },

  // ─── Risk / SWOT ───────────────────────────────────
  {
    id: 'risk_matrix',
    name: 'Risk Matrix',
    intents: ['risk_management'],
    gridTemplate: `"heading" "matrix"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      {
        area: 'matrix',
        gridArea: 'matrix',
        maxBlocks: 1,
        preferredBlockTypes: ['smart_diagram', 'table'],
      },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['risk', 'matrix'],
  },
  {
    id: 'risk_left_matrix_right_list',
    name: 'Risk Matrix + Mitigations',
    intents: ['risk_management'],
    gridTemplate: `"matrix list"`,
    gridTemplateColumns: '55% 45%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'matrix', gridArea: 'matrix', preferredBlockTypes: ['smart_diagram'] },
      { area: 'list', gridArea: 'list', preferredBlockTypes: ['bullet_list', 'callout'] },
    ],
    minBlocks: 2,
    maxBlocks: 4,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['risk', 'actionable'],
  },

  // ─── Recommendation / Next Steps ───────────────────
  {
    id: 'recommendation_callout',
    name: 'Recommendation with Callout',
    intents: ['recommendation_portfolio', 'next_steps'],
    gridTemplate: `"heading" "content" "callout"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr auto',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'content', gridArea: 'content' },
      { area: 'callout', gridArea: 'callout', maxBlocks: 1, preferredBlockTypes: ['callout'] },
    ],
    minBlocks: 2,
    maxBlocks: 5,
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
    minBlocks: 2,
    maxBlocks: 4,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['checklist', 'actionable'],
  },

  // ─── Single Insight ────────────────────────────────
  {
    id: 'quote_centered',
    name: 'Quote Centered',
    intents: ['single_insight'],
    gridTemplate: `"full"`,
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    regions: [{ area: 'full', gridArea: 'full' }],
    minBlocks: 1,
    maxBlocks: 2,
    contentDensity: 'low',
    hasImageSlot: false,
    tags: ['minimal', 'impactful'],
  },
  {
    id: 'quote_with_image',
    name: 'Quote with Side Image',
    intents: ['single_insight'],
    gridTemplate: `"image quote"`,
    gridTemplateColumns: '40% 60%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'image', gridArea: 'image', maxBlocks: 1, preferredBlockTypes: ['image'] },
      { area: 'quote', gridArea: 'quote' },
    ],
    minBlocks: 2,
    maxBlocks: 3,
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
    minBlocks: 3,
    maxBlocks: 7,
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
    minBlocks: 4,
    maxBlocks: 8,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['comparison', 'options'],
  },

  // ─── Generic "smart" layouts ───────────────────────
  {
    id: 'smart_60_40',
    name: '60/40 Split',
    intents: ['key_messages', 'recommendation_portfolio', 'executive_summary'],
    gridTemplate: `"main side"`,
    gridTemplateColumns: '60% 40%',
    gridTemplateRows: '1fr',
    regions: [
      { area: 'main', gridArea: 'main' },
      { area: 'side', gridArea: 'side' },
    ],
    minBlocks: 2,
    maxBlocks: 6,
    contentDensity: 'medium',
    hasImageSlot: false,
    tags: ['asymmetric', 'professional'],
  },
  {
    id: 'smart_header_three_col',
    name: 'Header + 3 Columns',
    intents: ['key_messages', 'roadmap', 'comparison'],
    gridTemplate: `"heading heading heading" "a b c"`,
    gridTemplateColumns: '1fr 1fr 1fr',
    gridTemplateRows: 'auto 1fr',
    regions: [
      { area: 'heading', gridArea: 'heading', maxBlocks: 1 },
      { area: 'a', gridArea: 'a' },
      { area: 'b', gridArea: 'b' },
      { area: 'c', gridArea: 'c' },
    ],
    minBlocks: 4,
    maxBlocks: 7,
    contentDensity: 'high',
    hasImageSlot: false,
    tags: ['columns', 'structured'],
  },
];

/**
 * STEP 1b — map B1's composition archetype ids → existing LAYOUT_TEMPLATES.
 *
 * B1 emits one of 14 archetype ids (see COMPOSITION_LAYOUT_VARIANTS in
 * presentationLayoutDirectorService). The renderer honours that choice by
 * resolving the archetype to a concrete template. Many archetypes map 1:1 to
 * an existing template id; the rest are APPROXIMATED to the closest template by
 * topology/tags. When an archetype is unknown, the caller falls back to the
 * heuristic (back-compat).
 *
 * Mapping honesty (1:1 vs approximated) is documented per entry below.
 */
const ARCHETYPE_TO_TEMPLATE: Record<string, string> = {
  // ── 1:1 / very close ──────────────────────────────────────
  centered: 'cover_centered', // 1:1 — full-bleed centered hero
  left_image: 'cover_left_image', // 1:1 — image | content split
  bottom_strip: 'cover_bottom_strip', // 1:1 — main + bottom metric strip
  two_column: 'content_left_right', // 1:1 — symmetric L/R columns
  kpi_grid_2x2: 'kpi_grid_4', // 1:1 — 2×2 KPI dashboard
  split_lr: 'content_left_right', // ~1:1 — generic left/right split
  timeline_strip: 'timeline_full', // 1:1 — heading + timeline
  numbered_stack: 'next_steps_checklist', // ~ — ordered list + sidebar (closest ordered layout)
  // ── approximated (no exact template; closest by tags/topology) ──
  stacked: 'content_full', // approx — single stacked column (full width)
  chart_left_text_right: 'exec_left_bullets', // approx — left text + right chart/KPI (mirror of L-bullets/R-data)
  big_number: 'quote_centered', // approx — single dramatic metric, centered (no dedicated big-number template)
  table: 'comparison_two_col', // approx — tabular/2-col compare (no generic table template)
  smart_diagram: 'process_top_steps_bottom_detail', // approx — diagram-led process (smart_diagram preferred region)
  icon_row_grid: 'smart_header_three_col', // approx — heading + N columns (icon row grid)
};

/**
 * W7 GUARD-SPLIT — heuristics that keep sparse content off multi-column
 * templates (a split/two-column layout with too little content renders as a
 * "half-empty second column", the slide1 regression seen on the P1.2 shots).
 *
 * A template is "split-like" when it exposes ≥2 content columns side by side
 * (regions that share the same grid row across distinct columns). We detect
 * that cheaply from the grid template string: a row with ≥2 named areas.
 */
export function countSideBySideColumns(layout: LayoutTemplate): number {
  // gridTemplate rows look like `"heading heading" "left right"`. Split each
  // quoted row into its area tokens; the widest row (most distinct non-`.`
  // areas) is the column count of the busiest band.
  const rows = layout.gridTemplate.match(/"[^"]*"/g) || [];
  let maxCols = 1;
  for (const row of rows) {
    const areas = row
      .replace(/"/g, '')
      .trim()
      .split(/\s+/)
      .filter((a) => a && a !== '.');
    const distinct = new Set(areas);
    if (distinct.size > maxCols) maxCols = distinct.size;
  }
  return maxCols;
}

export function isSplitLikeLayout(layout: LayoutTemplate): boolean {
  return countSideBySideColumns(layout) >= 2;
}

/**
 * Estimate a block's rendered "weight" (rough vertical footprint, arbitrary
 * units). Used only to compare relative column fill — not pixel-accurate.
 * Heavier blocks (charts, KPIs, long lists) count for more than a one-line
 * heading or callout.
 */
export function estimateBlockWeight(block: { type: string; content?: Record<string, unknown> }): number {
  const c = (block.content || {}) as Record<string, unknown>;
  const textLen = (v: unknown): number => (typeof v === 'string' ? v.length : 0);
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  switch (block.type) {
    case 'heading':
      return 1;
    case 'divider':
    case 'icon_row':
      return 0.6;
    case 'paragraph':
      return 1 + textLen(c.text) / 120;
    case 'callout':
    case 'quote_block':
      return 1.4 + textLen(c.text) / 120;
    case 'bullet_list':
    case 'numbered_list':
      return 0.6 + arr(c.items).length * 0.9;
    case 'kpi_widget':
      return 2.4;
    case 'metric_strip':
      return 1.8;
    case 'chart':
      return 4;
    case 'table':
      return 2 + arr(c.rows).length * 0.6;
    case 'timeline_block':
      return 1 + arr(c.events).length * 0.8;
    case 'smart_diagram':
    case 'smart_layout':
      return 3;
    case 'image':
      return 4;
    default:
      return 1.2;
  }
}

/**
 * W7 GUARD-SPLIT decision. Given the blocks and a split-like candidate layout,
 * project the blocks into that layout's regions (using the SAME assigner the
 * renderer uses) and measure column balance + total fill. A split is REJECTED
 * (→ fallback to stacked/full) when:
 *   (a) any side-by-side column ends up EMPTY, or
 *   (b) the lightest column carries < 35% of the heaviest column's weight
 *       (i.e. one column is more than ~3× the other → half-empty look), or
 *   (c) total content is too thin to justify two tracks (weight < 5 units), or
 *   (d) BOTH columns are just short text (no tall-fill block like a chart/image)
 *       AND the fullest column is still under the fills-a-column weight (~6) →
 *       two short columns with dead bottoms (the slide1 two_column regression).
 * Returns true when the split should be AVOIDED.
 */
export function shouldAvoidSplit(
  blocks: { type: string; content?: Record<string, unknown>; position: { area: string } }[],
  layout: LayoutTemplate,
  composition?: AssignableComposition | null
): boolean {
  if (!isSplitLikeLayout(layout)) return false;

  const cols = countSideBySideColumns(layout);
  const totalWeight = blocks.reduce((s, b) => s + estimateBlockWeight(b), 0);

  // (c) Too thin overall for a two-track layout.
  if (totalWeight < 5) return true;

  // Identify the side-by-side column areas (the busiest band's areas).
  const rows = layout.gridTemplate.match(/"[^"]*"/g) || [];
  let bandAreas: string[] = [];
  for (const row of rows) {
    const areas = Array.from(
      new Set(
        row
          .replace(/"/g, '')
          .trim()
          .split(/\s+/)
          .filter((a) => a && a !== '.')
      )
    );
    if (areas.length === cols) {
      bandAreas = areas;
      break;
    }
  }
  if (bandAreas.length < 2) return false;

  // Project blocks into regions via the real assigner, then inspect columns.
  const assigned = assignBlocksToRegions(
    blocks.map((b) => ({ ...b })),
    layout,
    composition
  );
  const colBlocks = bandAreas.map((area) => assigned.get(area) || []);
  const colWeights = colBlocks.map((bs) =>
    bs.reduce((s, b) => s + estimateBlockWeight(b), 0)
  );

  // (a) any column empty → half-empty look.
  if (colWeights.some((w) => w <= 0)) return true;

  // (b) imbalance: lightest < 35% of heaviest.
  const maxW = Math.max(...colWeights);
  const minW = Math.min(...colWeights);
  if (maxW > 0 && minW / maxW < 0.35) return true;

  // (d) "TWO SHORT COLUMNS" — the slide1 case. A split is only justified when at
  // least one column carries a TALL-FILL block (chart/image/diagram/kpi/table/
  // timeline) that naturally fills the column height. When BOTH columns are just
  // short text (heading/bullets/callout/paragraph) AND no column reaches the
  // "fills-a-column" weight (~6), the split renders as two half-empty columns →
  // stack it so W7 fill-canvas can spread the content down the full width.
  const TALL_FILL = new Set([
    'chart',
    'image',
    'smart_diagram',
    'smart_layout',
    'kpi_widget',
    'table',
    'timeline_block',
    'metric_strip',
  ]);
  const anyColumnHasTallFill = colBlocks.some((bs) => bs.some((b) => TALL_FILL.has(b.type)));
  const COLUMN_FILL_WEIGHT = 6;
  if (!anyColumnHasTallFill && maxW < COLUMN_FILL_WEIGHT) return true;

  return false;
}

/** Nearest stacked/full-width fallback for a rejected split, by intent. */
function stackedFallbackFor(intent: CardIntent): LayoutTemplate {
  const byIntent = LAYOUT_TEMPLATES.filter(
    (l) => l.intents.includes(intent) && !isSplitLikeLayout(l)
  );
  // Prefer a full-width stacked layout for the intent; else global content_full.
  const preferredIds = ['exec_full', 'content_full', 'quote_centered', 'recommendation_callout'];
  for (const id of preferredIds) {
    const hit = byIntent.find((l) => l.id === id);
    if (hit) return hit;
  }
  if (byIntent.length) return byIntent[0];
  return LAYOUT_TEMPLATES.find((l) => l.id === 'content_full')!;
}

/**
 * STEP 1b — resolve an explicit layout choice (from card.layout_id or
 * card.composition.layoutVariantId) to a concrete template. Tries, in order:
 *   1. a direct LAYOUT_TEMPLATES id match (exact),
 *   2. an archetype → template mapping (1:1 or approximated).
 * Returns undefined when nothing maps → caller keeps the heuristic.
 *
 * W7 GUARD-SPLIT — if the resolved template is split-like but the card's
 * content is too sparse to fill two columns, downgrade to a stacked/full-width
 * fallback so no slide renders a half-empty second column.
 */
export function resolveExplicitLayout(card: DeckCard): LayoutTemplate | undefined {
  const candidates: string[] = [];
  const layoutId = (card.layout_id || '').trim();
  if (layoutId && layoutId !== 'auto') candidates.push(layoutId);
  const variantId = card.composition?.layoutVariantId?.trim();
  if (variantId && !candidates.includes(variantId)) candidates.push(variantId);

  for (const id of candidates) {
    const direct = LAYOUT_TEMPLATES.find((l) => l.id === id);
    const mapped =
      direct || LAYOUT_TEMPLATES.find((l) => l.id === ARCHETYPE_TO_TEMPLATE[id]);
    if (mapped) {
      if (shouldAvoidSplit(card.blocks, mapped, card.composition)) {
        return stackedFallbackFor(card.intent);
      }
      return mapped;
    }
  }
  return undefined;
}

/**
 * Select the best layout for a given card.
 *
 * STEP 1b — when the card carries an explicit, mappable layout choice
 * (`layout_id` or `composition.layoutVariantId` from B1), HONOUR it and skip
 * the heuristic. Otherwise (absent/unknown/'auto') fall back to the existing
 * intent + block-count + variety heuristic — byte-identical to today.
 * Considers intent, block count, visual variety (avoiding repeats).
 */
export function selectLayout(card: DeckCard, recentLayoutIds: string[] = []): LayoutTemplate {
  const explicit = resolveExplicitLayout(card);
  if (explicit) return explicit;

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

  // W7 GUARD-SPLIT (heuristic path) — if the top pick is split-like but the
  // content can't fill two columns, prefer the best-scoring stacked candidate.
  const top = scored[0].layout;
  if (isSplitLikeLayout(top) && shouldAvoidSplit(card.blocks, top, card.composition)) {
    const stacked = scored.find((s) => !isSplitLikeLayout(s.layout));
    if (stacked) return stacked.layout;
    return stackedFallbackFor(card.intent);
  }
  return top;
}

/** STEP 1b — minimal shape of the per-card composition the assigner honours. */
export interface AssignableComposition {
  regions?: { area: string; blockTypes?: string[] }[];
}

/**
 * Assign blocks to layout regions based on block type preferences.
 *
 * STEP 1b — when `composition.regions` is present (B1's AI plan), PREFER the
 * AI's area→blockType assignment: a block whose type is named in a region the
 * layout also exposes is routed there first. Anything not covered by the AI
 * plan (or when no composition is given) falls back to the existing
 * preferred-block-type heuristic — byte-identical to today when composition is
 * absent. The layout's regions remain the authority on which areas exist, so a
 * malformed/mismatched composition cannot break the grid.
 */
export function assignBlocksToRegions<T extends { type: string; position: { area: string } }>(
  blocks: T[],
  layout: LayoutTemplate,
  composition?: AssignableComposition | null
): Map<string, T[]> {
  const regionMap = new Map<string, T[]>();
  layout.regions.forEach((r) => regionMap.set(r.area, []));

  // Build AI block-type → area hints, but only for areas the layout actually
  // exposes (guards malformed composition from poisoning the grid).
  const layoutAreas = new Set(layout.regions.map((r) => r.area));
  const aiTypeToArea = new Map<string, string>();
  if (composition?.regions?.length) {
    for (const reg of composition.regions) {
      if (!reg || typeof reg.area !== 'string' || !layoutAreas.has(reg.area)) continue;
      for (const bt of reg.blockTypes || []) {
        if (typeof bt === 'string' && bt && !aiTypeToArea.has(bt)) {
          aiTypeToArea.set(bt, reg.area);
        }
      }
    }
  }

  const sorted = [...blocks].sort((a, b) => {
    const aOrder = a.type === 'heading' ? 0 : a.type === 'metric_strip' ? 1 : 2;
    const bOrder = b.type === 'heading' ? 0 : b.type === 'metric_strip' ? 1 : 2;
    return aOrder - bOrder;
  });

  for (const block of sorted) {
    // (1) AI's area assignment wins when it names this block type AND the
    //     target region still has capacity.
    const aiArea = aiTypeToArea.get(block.type);
    if (aiArea) {
      const region = layout.regions.find((r) => r.area === aiArea);
      const current = region ? regionMap.get(region.area)! : undefined;
      if (region && current && !(region.maxBlocks && current.length >= region.maxBlocks)) {
        current.push(block);
        continue;
      }
    }

    // (2) Fallback — existing preferred-block-type heuristic (unchanged).
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

/**
 * W7 FILL-CANVAS flag. ON by default in the app. The step1b/W7 render harness
 * flips it OFF (via `setW7FillCanvas(false)` before mount, driven by ?mode=
 * before) so a single codebase produces a truthful BEFORE (top-glued, dead
 * bottom) vs AFTER (canvas filled) proof on identical content.
 */
let _w7FillCanvas = true;
export function isW7FillCanvasEnabled(): boolean {
  return _w7FillCanvas;
}
export function setW7FillCanvas(on: boolean): void {
  _w7FillCanvas = on;
}

/**
 * GROW-CONTENT flag. ON by default in the app. The grow-content proof harness
 * flips it OFF (`setGrowContent(false)`, driven by ?mode=before) so BEFORE shows
 * the W7 rhythm ALONE (blocks centered but rendered at their old small scale) and
 * AFTER adds the grow (hero metrics / dashboard tiles / tall charts) — isolating
 * exactly this package's contribution on top of W7.
 */
let _growContent = true;
export function isGrowContentEnabled(): boolean {
  return _growContent;
}
export function setGrowContent(on: boolean): void {
  _growContent = on;
}

/**
 * W7 FILL-CANVAS — decide how a column/stack of blocks should distribute
 * itself down the available height, so sparse content is not glued to the top
 * with a dead bottom (M17-DECK-PERFEKCJA §rytm pionowy, DoD#2). Pure function
 * of the blocks; the renderer maps the result to `justify-content`.
 *
 *  - 'top'          : content is dense enough to (nearly) fill on its own —
 *                     keep natural top-alignment (no change from today).
 *  - 'center'       : one dominant block (e.g. a big KPI/quote) — center it
 *                     vertically instead of pinning it to the top.
 *  - 'space-between': several light blocks — spread them with breathing room so
 *                     the first sits near the top and the last near the bottom.
 *
 * `capacity` is the rough weight that fills the region at a comfortable
 * density; tuned so a full content slide (~2–3 substantial blocks) reads as
 * 'top' and a 1–2 block sparse slide spreads/centers.
 */
export type VerticalFillMode = 'top' | 'center' | 'space-between';

/**
 * Intents whose design language GROUPS the title block (cover / section
 * dividers). We never spread these — the accepted baseline keeps the title +
 * subtitle together; stretching them floats an orphan subtitle mid-canvas.
 * Fill-canvas targets content slides (the "dead bottom" problem), not covers.
 */
const GROUPED_INTENTS = new Set<string>(['cover', 'section_intro', 'section_divider']);

export function verticalFillMode(
  blocks: { type: string; content?: Record<string, unknown> }[],
  capacity = 9,
  intent?: string
): VerticalFillMode {
  if (!_w7FillCanvas) return 'top';
  if (intent && GROUPED_INTENTS.has(intent)) return 'top';
  const substantial = blocks.filter((b) => b.type !== 'divider' && b.type !== 'icon_row');
  if (substantial.length === 0) return 'top';
  const totalWeight = blocks.reduce((s, b) => s + estimateBlockWeight(b), 0);

  // Dense enough — leave as-is (avoid stretching a full slide).
  if (totalWeight >= capacity) return 'top';

  // Sparse content — CENTER the block as a group. VisionQA (2026-07-04) showed
  // that flinging blocks to opposite ends with `space-between` kills perceived
  // hierarchy/readability (large voids read as broken grouping), which is worse
  // than a dead bottom. Centering the grouped content removes the top-glue
  // asymmetry (balanced top/bottom margins) WITHOUT breaking the reading order
  // — the premium "sparse but composed" look (M17-DECK-PERFEKCJA §rytm pionowy:
  // "rozłóż bloki, dodaj oddech" — NOT "rozciągaj absurdalnie").
  return 'center';
}

/**
 * GROW-CONTENT (2026-07-05) — decide whether a block should render at 'hero'
 * density (much larger type / taller chart) because it is the DOMINANT content
 * of its region. Gated on the SAME `_w7FillCanvas` flag as the rhythm work so
 * the proof harness can toggle grow-content on/off on one axis, and so that with
 * the flag off (`?mode=before`) the render is byte-identical to pre-grow.
 *
 * A block is dominant when it is a single big-signal block (a lone metric, or a
 * chart that owns a tall slot) and the region carries little competing text —
 * exactly the slides W7 could only center, not fill.
 *
 * `siblings` = the blocks that share this block's region (INCLUDING the block
 * itself). `intent`/`variant` come from the card so `big_number` / single-insight
 * slides promote their metric even when a short callout shares the region.
 */
export function blockDensityFor(
  block: { type: string; content?: Record<string, unknown> },
  siblings: { type: string; content?: Record<string, unknown> }[],
  opts: { intent?: string; variant?: string } = {}
): 'default' | 'hero' {
  if (!_growContent) return 'default';

  const isHeroMetric = block.type === 'kpi_widget';
  const isStrip = block.type === 'metric_strip';
  const isChart = block.type === 'chart';
  if (!isHeroMetric && !isStrip && !isChart) return 'default';

  // How much OTHER weight competes in the region (excludes this block + chrome).
  const competing = siblings
    .filter((b) => b !== block && b.type !== 'divider' && b.type !== 'icon_row' && b.type !== 'heading')
    .reduce((s, b) => s + estimateBlockWeight(b), 0);

  // A hero metric on a single-insight / big_number slide is the archetype's
  // whole point — promote it even when supporting narrative (callout / bullets)
  // shares the slide. Off-archetype, only promote when it is truly alone.
  if (isHeroMetric) {
    const bigNumberContext = opts.variant === 'big_number' || opts.intent === 'single_insight';
    if (bigNumberContext) return 'hero';
    if (competing === 0) return 'hero';
    return 'default';
  }

  // A KPI strip that owns its region (only a heading beside it) reads as a
  // dashboard row — give the tiles real weight.
  if (isStrip) {
    return competing <= 2 ? 'hero' : 'default';
  }

  // A chart fills its region tall unless it competes with ANOTHER tall block
  // (chart / image / table / diagram) that would also want the height. A short
  // metric strip or a caption paragraph beside it does not block the grow.
  if (isChart) {
    const TALL = new Set(['chart', 'image', 'table', 'smart_diagram', 'smart_layout']);
    const competingTall = siblings.some((b) => b !== block && TALL.has(b.type));
    const competingText = siblings
      .filter((b) => b !== block && b.type !== 'divider' && b.type !== 'icon_row' && b.type !== 'heading')
      .reduce((s, b) => s + estimateBlockWeight(b), 0);
    return !competingTall && competingText <= 3 ? 'hero' : 'default';
  }

  return 'default';
}

export function getLayoutById(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((l) => l.id === id);
}

export function getLayoutsForIntent(intent: CardIntent): LayoutTemplate[] {
  return LAYOUT_TEMPLATES.filter((l) => l.intents.includes(intent));
}

export { ARCHETYPE_TO_TEMPLATE, LAYOUT_TEMPLATES };
