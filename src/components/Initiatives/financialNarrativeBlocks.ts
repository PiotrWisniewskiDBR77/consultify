/**
 * Shared-field helpers for the two financial narrative sections.
 *
 * M13 finding #1: both `financial-analysis` and `financial-impact` AI-fill persist
 * into the SINGLE `market_context` column (the initiatives schema has no second
 * narrative column, and `business_value` is a numeric ROI field — not prose). So
 * AI-filling the second section used to prepend its text and clobber/duplicate the
 * first. We instead upsert each section under a visible, language-stable header
 * line `=== [FIN:…] Heading ===`; the bracketed token is the parse anchor (survives
 * a PL/EN language toggle), the heading is for the human. Each block owns a
 * contiguous, non-overlapping region so re-generating one section replaces ONLY its
 * own block.
 *
 * Pure module (no React) so it unit-tests without mounting the heavy document view.
 */

import i18n from '@/i18n';

export type FinancialSection = 'financial-analysis' | 'financial-impact';

export const FINANCIAL_BLOCK_MARKER: Record<FinancialSection, string> = {
  'financial-analysis': 'FIN:ANALYSIS',
  'financial-impact': 'FIN:IMPACT',
};

function headingFor(section: FinancialSection): string {
  if (section === 'financial-analysis') {
    return i18n.t('initiatives.financialNarrativeBlocks.financialAnalysisSizingRoi');
  }
  return i18n.t('initiatives.financialNarrativeBlocks.financialImpact');
}

/**
 * Insert/replace a section's labeled block inside the shared market_context text.
 * - Existing block for the same section → replaced in place (idempotent regen).
 * - No block yet → appended, preserving any free-form text already present.
 * The block runs from its `=== [marker] … ===` header up to the next such header
 * (or end of text). Returns the trimmed combined text.
 */
export function upsertFinancialBlock(
  existing: string,
  section: FinancialSection,
  content: string,
  _isPolish?: boolean
): string {
  const marker = FINANCIAL_BLOCK_MARKER[section];
  const heading = headingFor(section);
  const body = String(content || '').trim();
  const headerLine = `=== [${marker}] ${heading} ===`;
  const block = `${headerLine}\n${body}`;

  const prev = String(existing || '');
  // Replace from THIS section's header up to the next `=== [FIN:…] ===` header or
  // end-of-text. `esc` escapes the marker defensively (`:` is literal here).
  const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRe = new RegExp(
    `=== \\[${esc}\\][^\\n]*\\n[\\s\\S]*?(?=\\n=== \\[FIN:[^\\]]+\\]|$)`,
    'm'
  );

  if (blockRe.test(prev)) {
    return prev.replace(blockRe, block).trim();
  }
  return (prev.trim() ? `${prev.trim()}\n\n${block}` : block).trim();
}
