/**
 * Consultify Document Studio — DOCX structural numbering & appendix
 * detection (Epic E8, Slice 8.2).
 *
 * The renderer needs three structural decisions before it can stamp
 * out section headings:
 *
 *   1. Which sections are body sections vs appendices.
 *   2. How body sections should be numbered ("1.", "2.", "3.", …).
 *   3. How appendix sections should be labelled, driven by
 *      `formattingSchema.appendixStyle` (`'lettered'` → "Appendix A —",
 *      `'numbered'` → "Appendix 1 —", `'none'` → no prefix).
 *
 * This module owns those decisions so the renderer stays a pure
 * "schema → docx tree" translator and tests can pin every numbering
 * rule down without booting the docx packer. The same primitives are
 * reused by the PDF renderer in Slice 8.4 to keep both renderers'
 * structural output in sync.
 */

import type {
  DocumentBlock,
  DocumentSchema,
  DocumentSection,
  FormattingSchema,
} from './documentStudioTypes.js';
import { summarizeDocumentChartBlock } from './documentStudioTypes.js';

/**
 * Title prefixes the heuristic falls back on when a section does not
 * carry an explicit `kind: 'appendix'`. Localised so PL deliverables
 * authored before E8 ("Załącznik A — Słownik") still flow into the
 * appendix block without a schema migration.
 */
const APPENDIX_TITLE_PREFIXES = ['appendix', 'annex', 'załącznik', 'zalacznik'];

export function isAppendixSection(section: DocumentSection): boolean {
  if (section.kind === 'appendix') return true;
  if (section.kind === 'body') return false;
  const title = String(section.title || '')
    .trim()
    .toLowerCase();
  return APPENDIX_TITLE_PREFIXES.some((prefix) => title.startsWith(prefix));
}

export interface PartitionedSections {
  body: DocumentSection[];
  appendix: DocumentSection[];
}

/**
 * Partition a section list into body + appendix groups while
 * preserving the original ordering inside each group. Body sections
 * always render before any appendix regardless of where the appendix
 * appeared in the source schema (Word's outline / reader expectations
 * are clearer when appendices land at the end of the document).
 */
export function partitionSections(sections: readonly DocumentSection[]): PartitionedSections {
  const body: DocumentSection[] = [];
  const appendix: DocumentSection[] = [];
  for (const section of sections) {
    if (isAppendixSection(section)) appendix.push(section);
    else body.push(section);
  }
  return { body, appendix };
}

/**
 * Detect a TABLE block that carries no data rows. The renderers accept
 * two shapes: keyed `{rows:[{cells:{col:{value}}}]}` and legacy
 * array-of-arrays `{headers, rows:[[...]]}`. A block with an empty (or
 * absent) `rows` array — under either shape — has nothing to draw.
 */
function isEmptyTableBlock(block: DocumentBlock): boolean {
  if (block.type !== 'table' && block.type !== 'risk_table') return false;
  const content = block.content as { rows?: unknown } | undefined | null;
  const rows = content && typeof content === 'object' ? content.rows : undefined;
  return !Array.isArray(rows) || rows.length === 0;
}

function isEmptyKpiStripBlock(block: DocumentBlock): boolean {
  if (block.type !== 'kpi_strip') return false;
  const content = block.content as { items?: unknown; rows?: unknown } | undefined | null;
  if (!content || typeof content !== 'object') return true;
  const hasItems = Array.isArray(content.items) && content.items.length > 0;
  // Preserve the supported legacy table-shaped KPI contract.
  const hasLegacyRows = Array.isArray(content.rows) && content.rows.length > 0;
  return !hasItems && !hasLegacyRows;
}

/**
 * Detect a CHART block with no plottable data (zero valid numeric
 * values across all series). Rasterization cannot draw such a chart, so
 * the renderers fall through to a `[chart placeholder]` line — a
 * fidelity regression (G4/K6) in a *generated* export. Pruning the block
 * upstream removes the placeholder entirely.
 */
function isEmptyChartBlock(block: DocumentBlock): boolean {
  if (block.type !== 'chart') return false;
  return summarizeDocumentChartBlock(block).totalValueCount === 0;
}

/**
 * Remove visual blocks that would render as a bare placeholder line:
 * data-less tables and data-less charts. Content generation is
 * LLM-driven and occasionally emits an empty visual shell; surfacing
 * "[Table placeholder …]" / "[Figure N chart placeholder …]" in a
 * client-grade DOCX/PDF export fails rubric K4 (no placeholders), K5
 * (tables fed), K6 (charts render) and G4 (charts render visually).
 *
 * The prune is render-time only: it never mutates the stored schema, so
 * the editor still shows the empty block as an affordance ("populate
 * this table"). It is deliberately conservative — it drops ONLY blocks
 * with no data at all, never a block that has partial content.
 */
export function pruneUnrenderableBlocks(schema: DocumentSchema): DocumentSchema {
  let dropped = 0;
  const sections = schema.sections.map((section) => {
    const kept = section.blocks.filter((block) => {
      if (isEmptyTableBlock(block) || isEmptyKpiStripBlock(block) || isEmptyChartBlock(block)) {
        dropped += 1;
        return false;
      }
      return true;
    });
    return kept.length === section.blocks.length ? section : { ...section, blocks: kept };
  });
  if (dropped === 0) return schema;
  return { ...schema, sections };
}

/**
 * Format a body section heading. Always uses Arabic numerals; the
 * caller supplies the running counter (0-based) so heading levels
 * deeper than 1 (which we do not currently number) can opt out.
 */
export function formatBodyHeading(section: DocumentSection, bodyIndex: number): string {
  return `${bodyIndex + 1}. ${section.title}`;
}

/**
 * Format an appendix heading per the document's `appendixStyle`.
 *
 * Idempotency: if the section's title already begins with the prefix
 * we would add (e.g. the author wrote "Appendix A — Glossary"), we
 * leave it untouched so the renderer never produces "Appendix A —
 * Appendix A — Glossary".
 */
export function formatAppendixHeading(
  section: DocumentSection,
  appendixIndex: number,
  formatting: FormattingSchema
): string {
  const rawTitle = String(section.title || '').trim();
  const lower = rawTitle.toLowerCase();
  const prefixedAlready =
    lower.startsWith('appendix ') ||
    lower.startsWith('annex ') ||
    lower.startsWith('załącznik ') ||
    lower.startsWith('zalacznik ');

  if (prefixedAlready || formatting.appendixStyle === 'none') {
    return rawTitle;
  }

  if (formatting.appendixStyle === 'lettered') {
    const letter = letterForIndex(appendixIndex);
    return `Appendix ${letter} — ${rawTitle}`;
  }

  // formatting.appendixStyle === 'numbered'
  return `Appendix ${appendixIndex + 1} — ${rawTitle}`;
}

/**
 * Convert a 0-based index to an uppercase letter sequence:
 *   0 → A, 1 → B, …, 25 → Z, 26 → AA, 27 → AB, …
 *
 * Spreadsheet-style — supports more than 26 appendices without
 * collapsing into a numeric form.
 */
export function letterForIndex(index: number): string {
  if (!Number.isFinite(index) || index < 0) return 'A';
  let n = Math.floor(index);
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Pure helper consumed by tests + audit panels: surface every section
 * heading the renderer would emit, paired with whether it landed in
 * the body or appendix block. Lets us assert the *full* numbering
 * contract from a single fixture.
 */
export interface RenderedHeadingPlan {
  sectionId: string;
  kind: 'body' | 'appendix';
  heading: string;
}

export function planSectionHeadings(
  sections: readonly DocumentSection[],
  formatting: FormattingSchema
): RenderedHeadingPlan[] {
  const partitioned = partitionSections(sections);
  const plans: RenderedHeadingPlan[] = [];
  partitioned.body.forEach((section, idx) => {
    plans.push({
      sectionId: section.sectionId,
      kind: 'body',
      heading: formatBodyHeading(section, idx),
    });
  });
  partitioned.appendix.forEach((section, idx) => {
    plans.push({
      sectionId: section.sectionId,
      kind: 'appendix',
      heading: formatAppendixHeading(section, idx, formatting),
    });
  });
  return plans;
}
