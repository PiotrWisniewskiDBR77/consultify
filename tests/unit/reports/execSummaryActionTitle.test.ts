/**
 * Executive Summary — action-title (beat-Gamma, Fala 2).
 * The slide thesis (key_message) becomes the title, consistent with the other
 * layouts; the generic "Executive Summary" label is only a fallback.
 */
import { describe, expect, it } from 'vitest';

import { getDesignTokens } from '../../../server/src/services/report/pptx/designTokens.js';
import { ExecutiveSummaryLayout } from '../../../server/src/services/report/pptx/layouts/ExecutiveSummaryLayout.js';
import type {
  ExecutiveSummaryContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';

const meta: UnifiedReportMeta = {
  client: 'DBR77',
  project: 'AI Readiness',
  date: '2026-06-28',
  author: 'Consultify',
  confidentiality: 'internal',
  language: 'pl',
};

const content: ExecutiveSummaryContent = {
  type: 'executive_summary',
  headline: 'Gotowość AI 41/100 — luka w danych blokuje 3.2M PLN',
  kpis: [{ name: 'Gotowość', value: 41, unit: '/100' }],
  key_findings: ['A', 'B'],
  recommendation: 'Uruchom 3 piloty',
};

function titles(slide: UnifiedSlide): string[] {
  const tokens = getDesignTokens('corporate');
  const result = ExecutiveSummaryLayout(slide, meta, tokens);
  const texts: string[] = [];
  const mock = { addText: (t: any) => texts.push(String(t)), addShape: () => {}, addImage: () => {} };
  for (const el of result.elements) el.apply(mock as any);
  return texts;
}

describe('ExecutiveSummaryLayout — action-title (Fala 2)', () => {
  it('uses key_message (thesis) as the title when present', () => {
    const texts = titles({ intent: 'executive_summary', key_message: 'Trzy ruchy dają 18-mies. payback', content });
    expect(texts).toContain('Trzy ruchy dają 18-mies. payback');
    expect(texts).not.toContain('Podsumowanie Wykonawcze');
  });

  it('falls back to the generic label when key_message is empty', () => {
    const texts = titles({ intent: 'executive_summary', key_message: '', content });
    expect(texts).toContain('Podsumowanie Wykonawcze');
  });

  it('still renders the board headline inside the panel (no duplication)', () => {
    const texts = titles({ intent: 'executive_summary', key_message: 'Teza', content });
    expect(texts).toContain(content.headline);
    expect(texts).toContain('Teza');
  });
});
