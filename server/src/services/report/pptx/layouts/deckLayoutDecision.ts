/**
 * deckLayoutDecision — SERVER-SIDE PORT of the on-screen deck layout decision.
 *
 * WHY (P13 — ekran = eksport parity):
 * The on-screen deck editor selects a slide's layout template via
 * `src/components/Presentations/DeckBuilder/layouts/LayoutEngine.ts`
 * (`selectLayout` → `resolveExplicitLayout`), which HONOURS a slide's
 * `composition.layoutVariantId` (B1's per-slide plan) and degrades split/
 * two-column templates when content is too sparse (W7 guard-split).
 *
 * The PPTX export pipeline (`PptxPipelineService` → `resolveLayout(intent)`)
 * was COMPLETELY UNAWARE of `composition`/`layoutVariantId`: it picked a layout
 * purely from `slide.intent`. So a slide the screen renders as, e.g., a
 * left-image cover exported as a plain centered cover — screen ≠ export.
 *
 * This module ports the FE decision so the server resolves the SAME canonical
 * layout-template id for the SAME `UnifiedSlide`. It mirrors, in decision
 * semantics:
 *   - `ARCHETYPE_TO_TEMPLATE` (14 B1 archetype ids → LAYOUT_TEMPLATES ids)
 *   - `LAYOUT_TEMPLATES` topology needed for split detection + intent fallback
 *   - `estimateBlockWeight` / split detection / `shouldAvoidSplit` (W7 guard)
 *   - the block-derivation the FE bridge (`deckFromUnifiedJson`) applies to a
 *     `UnifiedSlide` before `selectLayout` runs.
 *
 * The FE `LayoutEngine.ts` is the SSOT; this port is kept in lock-step by the
 * cross-boundary parity test `tests/unit/deliverables/deckPptxLayoutParity.test.ts`,
 * which feeds identical `UnifiedSlide`s to both and asserts the resolved
 * template ids agree.
 *
 * Pure, dependency-free, deterministic (no LLM, no I/O).
 */

import type { SlideIntent, UnifiedSlide } from '../types.js';

// ── Card intents mirrored from FE `CardIntent` (LayoutEngine only reads the
//    subset that intents map to templates; the rest fall through to fallback). ──
type DeckCardIntent = SlideIntent | 'assessment' | 'prioritization_matrix';

/** Minimal block shape the decision core operates on (mirrors FE CardBlock). */
export interface DecisionBlock {
  type: string;
  content?: Record<string, unknown>;
  position: { area: string };
}

/** Mirror of FE `AssignableComposition`. */
export interface AssignableComposition {
  regions?: { area: string; blockTypes?: string[] }[];
}

interface LayoutRegion {
  area: string;
  maxBlocks?: number;
  preferredBlockTypes?: string[];
}

interface LayoutTemplate {
  id: string;
  intents: string[];
  gridTemplate: string;
  regions: LayoutRegion[];
  minBlocks: number;
  maxBlocks: number;
  hasImageSlot: boolean;
  tags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT_TEMPLATES — PORT of the subset of fields the DECISION reads from
// `src/components/Presentations/DeckBuilder/layouts/LayoutEngine.ts`. Grid
// geometry/naming and region topology must stay identical for split detection
// and region assignment to match. (Cosmetic fields the decision never reads —
// gridTemplateColumns/Rows, name, contentDensity — are intentionally omitted.)
// ─────────────────────────────────────────────────────────────────────────────
const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // Cover
  {
    id: 'cover_centered',
    intents: ['cover'],
    gridTemplate: `"full"`,
    regions: [{ area: 'full' }],
    minBlocks: 1,
    maxBlocks: 3,
    hasImageSlot: false,
    tags: ['clean', 'dramatic'],
  },
  {
    id: 'cover_left_image',
    intents: ['cover'],
    gridTemplate: `"image content"`,
    regions: [{ area: 'image', maxBlocks: 1, preferredBlockTypes: ['image'] }, { area: 'content' }],
    minBlocks: 2,
    maxBlocks: 4,
    hasImageSlot: true,
    tags: ['visual', 'professional'],
  },
  {
    id: 'cover_bottom_strip',
    intents: ['cover'],
    gridTemplate: `"main" "strip"`,
    regions: [
      { area: 'main' },
      { area: 'strip', maxBlocks: 1, preferredBlockTypes: ['metric_strip'] },
    ],
    minBlocks: 2,
    maxBlocks: 4,
    hasImageSlot: false,
    tags: ['data', 'corporate'],
  },
  // Executive summary
  {
    id: 'exec_full',
    intents: ['executive_summary', 'key_messages'],
    gridTemplate: `"full"`,
    regions: [{ area: 'full' }],
    minBlocks: 2,
    maxBlocks: 6,
    hasImageSlot: false,
    tags: ['clean', 'text-focused'],
  },
  {
    id: 'exec_left_bullets',
    intents: ['executive_summary'],
    gridTemplate: `"left right"`,
    regions: [
      { area: 'left', preferredBlockTypes: ['heading', 'bullet_list', 'paragraph'] },
      { area: 'right', preferredBlockTypes: ['kpi_widget', 'chart', 'metric_strip'] },
    ],
    minBlocks: 3,
    maxBlocks: 6,
    hasImageSlot: false,
    tags: ['balanced', 'data'],
  },
  {
    id: 'exec_top_kpi',
    intents: ['executive_summary', 'performance_overview'],
    gridTemplate: `"kpi" "content"`,
    regions: [
      { area: 'kpi', maxBlocks: 1, preferredBlockTypes: ['metric_strip', 'kpi_widget'] },
      { area: 'content' },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    hasImageSlot: false,
    tags: ['data-first', 'dashboard'],
  },
  // Content
  {
    id: 'content_full',
    intents: ['key_messages', 'comparison', 'recommendation_portfolio'],
    gridTemplate: `"full"`,
    regions: [{ area: 'full' }],
    minBlocks: 1,
    maxBlocks: 8,
    hasImageSlot: false,
    tags: ['versatile', 'clean'],
  },
  {
    id: 'content_left_right',
    intents: ['key_messages', 'comparison'],
    gridTemplate: `"left right"`,
    regions: [{ area: 'left' }, { area: 'right' }],
    minBlocks: 2,
    maxBlocks: 6,
    hasImageSlot: false,
    tags: ['balanced', 'comparison'],
  },
  {
    id: 'content_right_image',
    intents: ['key_messages', 'recommendation_portfolio'],
    gridTemplate: `"content image"`,
    regions: [
      { area: 'content' },
      { area: 'image', maxBlocks: 1, preferredBlockTypes: ['image', 'chart', 'smart_diagram'] },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    hasImageSlot: true,
    tags: ['visual', 'engaging'],
  },
  {
    id: 'content_left_image',
    intents: ['key_messages'],
    gridTemplate: `"image content"`,
    regions: [
      { area: 'image', maxBlocks: 1, preferredBlockTypes: ['image', 'smart_diagram'] },
      { area: 'content' },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    hasImageSlot: true,
    tags: ['visual', 'reversed'],
  },
  {
    id: 'content_top_bottom',
    intents: ['key_messages', 'roadmap'],
    gridTemplate: `"top" "bottom"`,
    regions: [{ area: 'top' }, { area: 'bottom' }],
    minBlocks: 2,
    maxBlocks: 6,
    hasImageSlot: false,
    tags: ['layered', 'structured'],
  },
  {
    id: 'content_overlay',
    intents: ['key_messages', 'single_insight'],
    gridTemplate: `"overlay"`,
    regions: [{ area: 'overlay' }],
    minBlocks: 1,
    maxBlocks: 3,
    hasImageSlot: true,
    tags: ['dramatic', 'visual'],
  },
  // Data / KPI
  {
    id: 'kpi_grid_4',
    intents: ['performance_overview', 'single_insight'],
    gridTemplate: `"heading heading" "kpi1 kpi2" "kpi3 kpi4"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'kpi1', maxBlocks: 1, preferredBlockTypes: ['kpi_widget'] },
      { area: 'kpi2', maxBlocks: 1, preferredBlockTypes: ['kpi_widget'] },
      { area: 'kpi3', maxBlocks: 1, preferredBlockTypes: ['kpi_widget', 'chart'] },
      { area: 'kpi4', maxBlocks: 1, preferredBlockTypes: ['kpi_widget', 'chart'] },
    ],
    minBlocks: 3,
    maxBlocks: 5,
    hasImageSlot: false,
    tags: ['dashboard', 'data-heavy'],
  },
  {
    id: 'data_strip_chart',
    intents: ['performance_overview', 'single_insight'],
    gridTemplate: `"heading" "strip" "chart"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'strip', maxBlocks: 1, preferredBlockTypes: ['metric_strip'] },
      { area: 'chart', maxBlocks: 1, preferredBlockTypes: ['chart'] },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    hasImageSlot: false,
    tags: ['metrics-first', 'analytical'],
  },
  {
    id: 'data_dual_chart',
    intents: ['single_insight', 'comparison'],
    gridTemplate: `"heading heading" "chart1 chart2"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'chart1', maxBlocks: 1, preferredBlockTypes: ['chart'] },
      { area: 'chart2', maxBlocks: 1, preferredBlockTypes: ['chart'] },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    hasImageSlot: false,
    tags: ['comparison', 'data'],
  },
  // Section divider
  {
    id: 'divider_centered',
    intents: ['section_intro'],
    gridTemplate: `"full"`,
    regions: [{ area: 'full' }],
    minBlocks: 1,
    maxBlocks: 2,
    hasImageSlot: false,
    tags: ['minimal', 'divider'],
  },
  {
    id: 'divider_numbered',
    intents: ['section_intro'],
    gridTemplate: `"number content"`,
    regions: [{ area: 'number', maxBlocks: 1 }, { area: 'content' }],
    minBlocks: 1,
    maxBlocks: 2,
    hasImageSlot: false,
    tags: ['numbered', 'structured'],
  },
  // Timeline / process
  {
    id: 'timeline_full',
    intents: ['roadmap'],
    gridTemplate: `"heading" "timeline"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'timeline', maxBlocks: 1, preferredBlockTypes: ['timeline_block', 'smart_diagram'] },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    hasImageSlot: false,
    tags: ['sequential', 'process'],
  },
  {
    id: 'process_top_steps_bottom_detail',
    intents: ['roadmap'],
    gridTemplate: `"steps" "detail"`,
    regions: [
      { area: 'steps', maxBlocks: 1, preferredBlockTypes: ['smart_diagram'] },
      { area: 'detail' },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    hasImageSlot: false,
    tags: ['process', 'detailed'],
  },
  // Risk
  {
    id: 'risk_matrix',
    intents: ['risk_management'],
    gridTemplate: `"heading" "matrix"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'matrix', maxBlocks: 1, preferredBlockTypes: ['smart_diagram', 'table'] },
    ],
    minBlocks: 2,
    maxBlocks: 3,
    hasImageSlot: false,
    tags: ['risk', 'matrix'],
  },
  {
    id: 'risk_left_matrix_right_list',
    intents: ['risk_management'],
    gridTemplate: `"matrix list"`,
    regions: [
      { area: 'matrix', preferredBlockTypes: ['smart_diagram'] },
      { area: 'list', preferredBlockTypes: ['bullet_list', 'callout'] },
    ],
    minBlocks: 2,
    maxBlocks: 4,
    hasImageSlot: false,
    tags: ['risk', 'actionable'],
  },
  // Recommendation / next steps
  {
    id: 'recommendation_callout',
    intents: ['recommendation_portfolio', 'next_steps'],
    gridTemplate: `"heading" "content" "callout"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'content' },
      { area: 'callout', maxBlocks: 1, preferredBlockTypes: ['callout'] },
    ],
    minBlocks: 2,
    maxBlocks: 5,
    hasImageSlot: false,
    tags: ['actionable', 'structured'],
  },
  {
    id: 'next_steps_checklist',
    intents: ['next_steps'],
    gridTemplate: `"heading heading" "list sidebar"`,
    regions: [
      { area: 'heading', maxBlocks: 1 },
      { area: 'list', preferredBlockTypes: ['bullet_list', 'numbered_list'] },
      { area: 'sidebar', preferredBlockTypes: ['callout', 'kpi_widget'] },
    ],
    minBlocks: 2,
    maxBlocks: 4,
    hasImageSlot: false,
    tags: ['checklist', 'actionable'],
  },
  // Single insight
  {
    id: 'quote_centered',
    intents: ['single_insight'],
    gridTemplate: `"full"`,
    regions: [{ area: 'full' }],
    minBlocks: 1,
    maxBlocks: 2,
    hasImageSlot: false,
    tags: ['minimal', 'impactful'],
  },
  {
    id: 'quote_with_image',
    intents: ['single_insight'],
    gridTemplate: `"image quote"`,
    regions: [{ area: 'image', maxBlocks: 1, preferredBlockTypes: ['image'] }, { area: 'quote' }],
    minBlocks: 2,
    maxBlocks: 3,
    hasImageSlot: true,
    tags: ['visual', 'personal'],
  },
  // Comparison
  {
    id: 'comparison_two_col',
    intents: ['comparison'],
    gridTemplate: `"heading heading" "left right"`,
    regions: [{ area: 'heading', maxBlocks: 1 }, { area: 'left' }, { area: 'right' }],
    minBlocks: 3,
    maxBlocks: 7,
    hasImageSlot: false,
    tags: ['comparison', 'balanced'],
  },
  {
    id: 'comparison_three_col',
    intents: ['comparison'],
    gridTemplate: `"heading heading heading" "a b c"`,
    regions: [{ area: 'heading', maxBlocks: 1 }, { area: 'a' }, { area: 'b' }, { area: 'c' }],
    minBlocks: 4,
    maxBlocks: 8,
    hasImageSlot: false,
    tags: ['comparison', 'options'],
  },
  // Generic "smart"
  {
    id: 'smart_60_40',
    intents: ['key_messages', 'recommendation_portfolio', 'executive_summary'],
    gridTemplate: `"main side"`,
    regions: [{ area: 'main' }, { area: 'side' }],
    minBlocks: 2,
    maxBlocks: 6,
    hasImageSlot: false,
    tags: ['asymmetric', 'professional'],
  },
  {
    id: 'smart_header_three_col',
    intents: ['key_messages', 'roadmap', 'comparison'],
    gridTemplate: `"heading heading heading" "a b c"`,
    regions: [{ area: 'heading', maxBlocks: 1 }, { area: 'a' }, { area: 'b' }, { area: 'c' }],
    minBlocks: 4,
    maxBlocks: 7,
    hasImageSlot: false,
    tags: ['columns', 'structured'],
  },
];

/**
 * ARCHETYPE_TO_TEMPLATE — PORT of the identical map in FE LayoutEngine.ts.
 * B1's 14 archetype ids → concrete LAYOUT_TEMPLATES ids. Keep in lock-step.
 */
export const ARCHETYPE_TO_TEMPLATE: Record<string, string> = {
  centered: 'cover_centered',
  left_image: 'cover_left_image',
  bottom_strip: 'cover_bottom_strip',
  two_column: 'content_left_right',
  kpi_grid_2x2: 'kpi_grid_4',
  split_lr: 'content_left_right',
  timeline_strip: 'timeline_full',
  numbered_stack: 'next_steps_checklist',
  stacked: 'content_full',
  chart_left_text_right: 'exec_left_bullets',
  big_number: 'quote_centered',
  table: 'comparison_two_col',
  smart_diagram: 'process_top_steps_bottom_detail',
  icon_row_grid: 'smart_header_three_col',
};

// ── Split detection (PORT) ───────────────────────────────────────────────────
function countSideBySideColumns(layout: LayoutTemplate): number {
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

function isSplitLikeLayout(layout: LayoutTemplate): boolean {
  return countSideBySideColumns(layout) >= 2;
}

// ── Block weight (PORT of estimateBlockWeight) ───────────────────────────────
function estimateBlockWeight(block: { type: string; content?: Record<string, unknown> }): number {
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
      return 1 + Math.max(arr(c.items).length, arr(c.events).length) * 0.8;
    case 'smart_diagram':
    case 'smart_layout':
      return 3;
    case 'image':
      return 4;
    default:
      return 1.2;
  }
}

// ── Region assignment (PORT of assignBlocksToRegions) ────────────────────────
function assignBlocksToRegions<T extends { type: string; position: { area: string } }>(
  blocks: T[],
  layout: LayoutTemplate,
  composition?: AssignableComposition | null
): Map<string, T[]> {
  const regionMap = new Map<string, T[]>();
  layout.regions.forEach((r) => regionMap.set(r.area, []));

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
    const aiArea = aiTypeToArea.get(block.type);
    if (aiArea) {
      const region = layout.regions.find((r) => r.area === aiArea);
      const current = region ? regionMap.get(region.area)! : undefined;
      if (region && current && !(region.maxBlocks && current.length >= region.maxBlocks)) {
        current.push(block);
        continue;
      }
    }

    let bestRegion = layout.regions[0];
    let bestScore = -1;
    for (const region of layout.regions) {
      const current = regionMap.get(region.area)!;
      if (region.maxBlocks && current.length >= region.maxBlocks) continue;
      let score = 0;
      if (region.preferredBlockTypes?.includes(block.type)) score += 20;
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

// ── Guard-split (PORT of shouldAvoidSplit) ───────────────────────────────────
function shouldAvoidSplit(
  blocks: DecisionBlock[],
  layout: LayoutTemplate,
  composition?: AssignableComposition | null
): boolean {
  if (!isSplitLikeLayout(layout)) return false;

  const cols = countSideBySideColumns(layout);
  const totalWeight = blocks.reduce((s, b) => s + estimateBlockWeight(b), 0);
  if (totalWeight < 5) return true;

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

  const assigned = assignBlocksToRegions(
    blocks.map((b) => ({ ...b })),
    layout,
    composition
  );
  const colBlocks = bandAreas.map((area) => assigned.get(area) || []);
  const colWeights = colBlocks.map((bs) => bs.reduce((s, b) => s + estimateBlockWeight(b), 0));

  if (colWeights.some((w) => w <= 0)) return true;

  const maxW = Math.max(...colWeights);
  const minW = Math.min(...colWeights);
  if (maxW > 0 && minW / maxW < 0.35) return true;

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

// ── Stacked fallback (PORT of stackedFallbackFor) ────────────────────────────
function stackedFallbackFor(intent: string): LayoutTemplate {
  const byIntent = LAYOUT_TEMPLATES.filter(
    (l) => l.intents.includes(intent) && !isSplitLikeLayout(l)
  );
  const preferredIds = ['exec_full', 'content_full', 'quote_centered', 'recommendation_callout'];
  for (const id of preferredIds) {
    const hit = byIntent.find((l) => l.id === id);
    if (hit) return hit;
  }
  if (byIntent.length) return byIntent[0];
  return LAYOUT_TEMPLATES.find((l) => l.id === 'content_full')!;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK DERIVATION — PORT of the block-building path in the FE bridge
// `src/components/Presentations/DeckBuilder/deckData.ts` (`deckFromUnifiedJson`).
// The screen runs `selectLayout` on the card built by that bridge, so the layout
// decision only matches if we derive the SAME blocks from the SAME UnifiedSlide.
// ─────────────────────────────────────────────────────────────────────────────

/** intentMap — PORT of `deckFromUnifiedJson`'s intent→CardIntent normalization. */
const INTENT_MAP: Record<string, DeckCardIntent> = {
  cover: 'cover',
  executive_summary: 'executive_summary',
  section_intro: 'section_intro',
  key_messages: 'key_messages',
  performance_overview: 'performance_overview',
  single_insight: 'single_insight',
  comparison: 'comparison',
  assessment: 'assessment',
  roadmap: 'roadmap',
  risk_management: 'risk_management',
  recommendation_portfolio: 'recommendation_portfolio',
  recommendation_single: 'recommendation_portfolio',
  initiative_portfolio: 'initiative_portfolio',
  next_steps: 'next_steps',
  appendix: 'appendix',
  root_cause: 'assessment',
  prioritization_matrix: 'prioritization_matrix',
};

/** Normalized decision intent for a slide (mirrors the bridge). */
export function decisionIntentFor(slide: UnifiedSlide): DeckCardIntent {
  return INTENT_MAP[String(slide.intent || '')] || 'key_messages';
}

/**
 * blocksFromUnifiedSlide — PORT of the `pushBlock(...)` sequence in
 * `deckFromUnifiedJson`. Produces the same block list (types + minimal content
 * the weight/region logic reads) the FE bridge produces for a `UnifiedSlide`,
 * so the decision core sees the same input the screen does.
 */
export function blocksFromUnifiedSlide(slide: UnifiedSlide): DecisionBlock[] {
  const anySlide = slide as unknown as {
    intent?: string;
    key_message?: string;
    content?: Record<string, unknown>;
  };
  const content = (anySlide.content || {}) as Record<string, unknown>;
  const contentType = String(content.type || anySlide.intent || '');
  const blocks: DecisionBlock[] = [];
  const push = (type: string, c: Record<string, unknown> = {}) =>
    blocks.push({ type, content: c, position: { area: 'full' } });

  const str = (v: unknown): string => (v == null ? '' : String(v));
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  const headingText =
    str(content.title) ||
    str(content.headline) ||
    str(content.section_title) ||
    str(anySlide.key_message) ||
    str(anySlide.intent) ||
    'Slide';
  push('heading', { text: headingText, level: 2 });

  if (contentType === 'cover') {
    const parts = [content.subtitle, content.organization, content.date, content.confidentiality]
      .map(str)
      .filter(Boolean);
    if (parts.length) push('paragraph', { text: parts.join(' · ') });
  } else if (contentType === 'executive_summary') {
    const findings = arr(content.key_findings);
    if (findings.length) push('bullet_list', { items: findings.map(str) });
  } else if (contentType === 'performance_overview') {
    const metrics = arr(content.metrics);
    if (metrics.length) {
      push('metric_strip', {
        metrics: metrics.map((m: unknown) => {
          const mm = (m || {}) as Record<string, unknown>;
          return {
            label: str(mm.label || mm.name || 'Metric'),
            value: str(mm.value ?? ''),
            trend: mm.trend,
          };
        }),
      });
    }
  } else if (contentType === 'comparison') {
    const left = content.left ?? content.before;
    const right = content.right ?? content.after;
    if (left || right) push('table', { rows: [left || {}, right || {}] });
  } else if (arr(content.bullets).length) {
    push('bullet_list', { items: arr(content.bullets).map(str) });
  } else if (content.text || anySlide.key_message) {
    push('paragraph', { text: str(content.text || anySlide.key_message) });
  }

  return blocks;
}

/** Structured composition carried on the slide (mirror of normalizeSlideComposition input). */
function compositionFor(
  slide: UnifiedSlide
): { layoutVariantId?: string; regions?: { area: string; blockTypes?: string[] }[] } | null {
  const comp = (slide as { composition?: unknown }).composition;
  if (!comp || typeof comp !== 'object') return null;
  const c = comp as { layoutVariantId?: unknown; regions?: unknown };
  const out: { layoutVariantId?: string; regions?: { area: string; blockTypes?: string[] }[] } = {};
  if (typeof c.layoutVariantId === 'string' && c.layoutVariantId.trim()) {
    out.layoutVariantId = c.layoutVariantId.trim().slice(0, 60);
  }
  if (Array.isArray(c.regions)) {
    const regions = c.regions
      .filter(
        (r): r is { area: string; blockTypes?: unknown } =>
          !!r && typeof (r as { area?: unknown }).area === 'string'
      )
      .map((r) => {
        const bt = (r as { blockTypes?: unknown }).blockTypes;
        return {
          area: (r as { area: string }).area,
          blockTypes: Array.isArray(bt)
            ? bt.filter((x): x is string => typeof x === 'string')
            : undefined,
        };
      });
    if (regions.length) out.regions = regions;
  }
  return out.layoutVariantId === undefined && out.regions === undefined ? null : out;
}

/**
 * resolveExplicitLayoutId — PORT. Resolve an explicit layout choice (from
 * `composition.layoutVariantId`) to a concrete template id, with W7 guard-split
 * degradation. Returns undefined → caller falls back to the heuristic.
 *
 * NOTE: the FE also considers a persisted `card.layout_id` before the variant.
 * `UnifiedSlide` carries no separate `layout_id`; the FE bridge derives that
 * field *from* `composition.layoutVariantId` (else `'auto'`), so resolving the
 * variant directly is equivalent to the on-screen behaviour.
 */
function resolveExplicitLayoutId(slide: UnifiedSlide): string | undefined {
  const comp = compositionFor(slide);
  const variantId = comp?.layoutVariantId?.trim();
  if (!variantId) return undefined;

  const direct = LAYOUT_TEMPLATES.find((l) => l.id === variantId);
  const mapped = direct || LAYOUT_TEMPLATES.find((l) => l.id === ARCHETYPE_TO_TEMPLATE[variantId]);
  if (!mapped) return undefined;

  const blocks = blocksFromUnifiedSlide(slide);
  if (shouldAvoidSplit(blocks, mapped, comp)) {
    return stackedFallbackFor(decisionIntentFor(slide)).id;
  }
  return mapped.id;
}

/**
 * selectHeuristicLayoutId — PORT of the heuristic branch of FE `selectLayout`
 * (intent + block-count + image/chart affinity, then W7 guard-split). No
 * "recent layout ids" input server-side (deck-wide variety is a FE render-time
 * concern); the FE parity test asserts equality with recentLayoutIds = [],
 * which is the per-slide decision this export models.
 */
function selectHeuristicLayoutId(slide: UnifiedSlide): string {
  const intent = decisionIntentFor(slide);
  const blocks = blocksFromUnifiedSlide(slide);
  const candidates = LAYOUT_TEMPLATES.filter((l) => l.intents.includes(intent));
  if (candidates.length === 0) return 'content_full';

  const blockCount = blocks.length;
  const hasImage = blocks.some((b) => b.type === 'image');
  const hasChart = blocks.some((b) => b.type === 'chart' || b.type === 'kpi_widget');

  const scored = candidates.map((layout) => {
    let score = 10;
    if (blockCount >= layout.minBlocks && blockCount <= layout.maxBlocks) score += 20;
    else if (blockCount < layout.minBlocks) score -= (layout.minBlocks - blockCount) * 5;
    if (hasImage && layout.hasImageSlot) score += 15;
    if (!hasImage && !layout.hasImageSlot) score += 5;
    if (hasChart && layout.tags.includes('data')) score += 10;
    return { layout, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0].layout;
  if (isSplitLikeLayout(top) && shouldAvoidSplit(blocks, top, compositionFor(slide))) {
    const stacked = scored.find((s) => !isSplitLikeLayout(s.layout));
    if (stacked) return stacked.layout.id;
    return stackedFallbackFor(intent).id;
  }
  return top.id;
}

/**
 * resolveDeckLayoutTemplateId — SSOT of the on-screen layout decision, server
 * side. Returns the canonical `LAYOUT_TEMPLATES` id the FE editor renders for
 * this slide: honours `composition.layoutVariantId` (with W7 guard-split), else
 * falls back to the intent heuristic. Mirrors FE `selectLayout(...).id` with
 * `recentLayoutIds = []`.
 */
export function resolveDeckLayoutTemplateId(slide: UnifiedSlide): string {
  return resolveExplicitLayoutId(slide) ?? selectHeuristicLayoutId(slide);
}

/**
 * resolveTemplateIdFromCardShape — the SAME decision, but from an already-built
 * card shape (intent + blocks + composition), matching FE `selectLayout(card).id`
 * exactly (recentLayoutIds = []). This is the decision CORE that the
 * `UnifiedSlide` entrypoint funnels into after deriving blocks; it is exported so
 * the parity test can prove FE and server agree on RICH content (where a split /
 * kpi-grid template legitimately survives guard-split), not only on the sparse
 * bridge-derived cases. Not used by the pipeline directly.
 */
export function resolveTemplateIdFromCardShape(card: {
  intent: string;
  layout_id?: string;
  blocks: DecisionBlock[];
  composition?: {
    layoutVariantId?: string;
    regions?: { area: string; blockTypes?: string[] }[];
  } | null;
}): string {
  const comp = card.composition ?? null;
  // Explicit choice (layout_id OR composition.layoutVariantId), mirroring FE.
  const candidates: string[] = [];
  const layoutId = (card.layout_id || '').trim();
  if (layoutId && layoutId !== 'auto') candidates.push(layoutId);
  const variantId = comp?.layoutVariantId?.trim();
  if (variantId && !candidates.includes(variantId)) candidates.push(variantId);
  for (const id of candidates) {
    const direct = LAYOUT_TEMPLATES.find((l) => l.id === id);
    const mapped = direct || LAYOUT_TEMPLATES.find((l) => l.id === ARCHETYPE_TO_TEMPLATE[id]);
    if (mapped) {
      if (shouldAvoidSplit(card.blocks, mapped, comp)) {
        return stackedFallbackFor(card.intent).id;
      }
      return mapped.id;
    }
  }
  // Heuristic branch.
  const candidatesByIntent = LAYOUT_TEMPLATES.filter((l) => l.intents.includes(card.intent));
  if (candidatesByIntent.length === 0) return 'content_full';
  const blockCount = card.blocks.length;
  const hasImage = card.blocks.some((b) => b.type === 'image');
  const hasChart = card.blocks.some((b) => b.type === 'chart' || b.type === 'kpi_widget');
  const scored = candidatesByIntent.map((layout) => {
    let score = 10;
    if (blockCount >= layout.minBlocks && blockCount <= layout.maxBlocks) score += 20;
    else if (blockCount < layout.minBlocks) score -= (layout.minBlocks - blockCount) * 5;
    if (hasImage && layout.hasImageSlot) score += 15;
    if (!hasImage && !layout.hasImageSlot) score += 5;
    if (hasChart && layout.tags.includes('data')) score += 10;
    return { layout, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0].layout;
  if (isSplitLikeLayout(top) && shouldAvoidSplit(card.blocks, top, comp)) {
    const stacked = scored.find((s) => !isSplitLikeLayout(s.layout));
    if (stacked) return stacked.layout.id;
    return stackedFallbackFor(card.intent).id;
  }
  return top.id;
}

/**
 * Coarse topology of a resolved template — what the PPTX pipeline needs to
 * render the same *shape* (split vs stacked vs kpi-grid vs image-cover) within
 * the content-type constraints of the intent-bound PPTX layouts.
 */
export type LayoutTopology =
  | 'stacked' // single full-width column
  | 'split' // two side-by-side content columns
  | 'kpi_grid' // 2×2 KPI dashboard
  | 'image_split' // one column is an image slot
  | 'three_col'; // three side-by-side columns

export function topologyOfTemplate(templateId: string): LayoutTopology {
  const layout = LAYOUT_TEMPLATES.find((l) => l.id === templateId);
  if (!layout) return 'stacked';
  if (templateId === 'kpi_grid_4') return 'kpi_grid';
  if (layout.hasImageSlot && isSplitLikeLayout(layout)) return 'image_split';
  const cols = countSideBySideColumns(layout);
  if (cols >= 3) return 'three_col';
  if (cols === 2) return 'split';
  return 'stacked';
}

export const __TEST_ONLY__ = {
  LAYOUT_TEMPLATES,
  shouldAvoidSplit,
  isSplitLikeLayout,
  estimateBlockWeight,
};
