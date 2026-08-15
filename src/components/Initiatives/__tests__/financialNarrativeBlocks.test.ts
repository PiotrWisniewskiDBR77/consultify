/**
 * M13 #1 — the two financial sections share the single `market_context` column.
 * These tests prove the upsert keeps both blocks non-overlapping: re-generating
 * one section replaces ONLY its own block and never clobbers the other's content,
 * and pre-existing free-form text is preserved.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  default: {
    t: (key: string) =>
      ({
        'initiatives.financialNarrativeBlocks.financialAnalysisSizingRoi':
          'Financial analysis (sizing + ROI)',
        'initiatives.financialNarrativeBlocks.financialImpact': 'Financial impact',
      })[key] ?? key,
  },
}));

import { FINANCIAL_BLOCK_MARKER, upsertFinancialBlock } from '../financialNarrativeBlocks';

const A = FINANCIAL_BLOCK_MARKER['financial-analysis']; // FIN:ANALYSIS
const I = FINANCIAL_BLOCK_MARKER['financial-impact']; // FIN:IMPACT

describe('upsertFinancialBlock', () => {
  it('creates a labeled block from empty text', () => {
    const out = upsertFinancialBlock('', 'financial-analysis', 'Sizing 1.2 mln zł, ROI 5x.', true);
    expect(out).toContain(`[${A}]`);
    expect(out).toContain('Sizing 1.2 mln zł, ROI 5x.');
  });

  it('keeps both financial sections side by side without overlap', () => {
    let txt = upsertFinancialBlock('', 'financial-analysis', 'ANALIZA-ORIG', true);
    txt = upsertFinancialBlock(txt, 'financial-impact', 'IMPACT-ORIG', true);

    // Both markers present, each with its own body.
    expect(txt).toContain(`[${A}]`);
    expect(txt).toContain(`[${I}]`);
    expect(txt).toContain('ANALIZA-ORIG');
    expect(txt).toContain('IMPACT-ORIG');
    // Exactly one header per section (no duplication).
    expect(txt.match(new RegExp(`\\[${A}\\]`, 'g'))?.length).toBe(1);
    expect(txt.match(new RegExp(`\\[${I}\\]`, 'g'))?.length).toBe(1);
  });

  it('re-generating one section replaces only its own block (no clobber of the other)', () => {
    let txt = upsertFinancialBlock('', 'financial-analysis', 'ANALIZA-ORIG', true);
    txt = upsertFinancialBlock(txt, 'financial-impact', 'IMPACT-ORIG', true);

    // Regenerate ONLY the analysis section.
    const after = upsertFinancialBlock(txt, 'financial-analysis', 'ANALIZA-NOWA', true);

    expect(after).toContain('ANALIZA-NOWA');
    expect(after).not.toContain('ANALIZA-ORIG'); // old analysis body gone
    expect(after).toContain('IMPACT-ORIG'); // impact body untouched
    // Still exactly one of each marker.
    expect(after.match(new RegExp(`\\[${A}\\]`, 'g'))?.length).toBe(1);
    expect(after.match(new RegExp(`\\[${I}\\]`, 'g'))?.length).toBe(1);
  });

  it('idempotent: regenerating the same section twice does not accumulate blocks', () => {
    let txt = upsertFinancialBlock('', 'financial-impact', 'v1', false);
    txt = upsertFinancialBlock(txt, 'financial-impact', 'v2', false);
    txt = upsertFinancialBlock(txt, 'financial-impact', 'v3', false);
    expect(txt).toContain('v3');
    expect(txt).not.toContain('v1');
    expect(txt).not.toContain('v2');
    expect(txt.match(new RegExp(`\\[${I}\\]`, 'g'))?.length).toBe(1);
  });

  it('preserves pre-existing free-form text when appending the first block', () => {
    const out = upsertFinancialBlock('Notatki użytkownika.', 'financial-analysis', 'BODY', true);
    expect(out).toContain('Notatki użytkownika.');
    expect(out).toContain('BODY');
    expect(out.indexOf('Notatki użytkownika.')).toBeLessThan(out.indexOf(`[${A}]`));
  });

  it('language toggle still matches the same block via the stable marker token', () => {
    // First generate in Polish, then regenerate the SAME section in English.
    const pl = upsertFinancialBlock('', 'financial-analysis', 'PL-BODY', true);
    const en = upsertFinancialBlock(pl, 'financial-analysis', 'EN-BODY', false);
    expect(en).toContain('EN-BODY');
    expect(en).not.toContain('PL-BODY');
    expect(en.match(new RegExp(`\\[${A}\\]`, 'g'))?.length).toBe(1);
    // English heading now present.
    expect(en).toContain('Financial analysis (sizing + ROI)');
  });
});
