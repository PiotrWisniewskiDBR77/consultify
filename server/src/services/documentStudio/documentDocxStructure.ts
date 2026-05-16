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

import type { DocumentSection, FormattingSchema } from './documentStudioTypes.js';

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
