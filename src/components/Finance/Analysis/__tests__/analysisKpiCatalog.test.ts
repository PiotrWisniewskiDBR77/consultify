import { describe, expect, it } from 'vitest';

import {
  ANALYSIS_INDUSTRY_PRESETS,
  recommendKpisForIndustry,
  validateCustomFormula,
  type AnalysisKpiCatalogEntryLike,
} from '../analysisKpiCatalog';

const CATALOG: AnalysisKpiCatalogEntryLike[] = [
  { kpiCode: 'REVENUE_GROWTH_YOY', tier: 'UNIVERSAL', industryCode: null, status: 'ACTIVE' },
  { kpiCode: 'GROSS_MARGIN_PCT', tier: 'UNIVERSAL', industryCode: null, status: 'ACTIVE' },
  { kpiCode: 'EBITDA_MARGIN_PCT', tier: 'UNIVERSAL', industryCode: null, status: 'ACTIVE' },
  { kpiCode: 'NET_MARGIN_PCT', tier: 'UNIVERSAL', industryCode: null, status: 'ACTIVE' },
  { kpiCode: 'NET_REVENUE_RETENTION', tier: 'INDUSTRY', industryCode: 'SAAS', status: 'ACTIVE' },
  { kpiCode: 'RULE_OF_40', tier: 'INDUSTRY', industryCode: 'SAAS', status: 'ACTIVE' },
  { kpiCode: 'INVENTORY_DAYS', tier: 'INDUSTRY', industryCode: 'MANUFACTURING', status: 'DRAFT' }, // nieaktywny — nie może być rekomendowany
];

describe('ANALYSIS_INDUSTRY_PRESETS', () => {
  it('zawiera GENERAL jako opcję neutralną', () => {
    expect(ANALYSIS_INDUSTRY_PRESETS.some((p) => p.code === 'GENERAL')).toBe(true);
  });
});

describe('recommendKpisForIndustry', () => {
  it('GENERAL ⇒ tylko uniwersalne, dostępne w katalogu', () => {
    const result = recommendKpisForIndustry(CATALOG, 'GENERAL');
    expect(result).toEqual(['REVENUE_GROWTH_YOY', 'GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT', 'NET_MARGIN_PCT']);
  });

  it('SAAS ⇒ uniwersalne + branżowe SAaS, w tej kolejności', () => {
    const result = recommendKpisForIndustry(CATALOG, 'SAAS');
    expect(result).toEqual(['REVENUE_GROWTH_YOY', 'GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT', 'NET_MARGIN_PCT', 'NET_REVENUE_RETENTION', 'RULE_OF_40']);
  });

  it('KONTROLA NEGATYWNA: KPI status!=ACTIVE (DRAFT) NIGDY nie trafia do rekomendacji, nawet jeśli jest na liście preferencji branży', () => {
    const result = recommendKpisForIndustry(CATALOG, 'MANUFACTURING');
    expect(result).not.toContain('INVENTORY_DAYS');
  });

  it('katalog pusty (organizacja bez skonfigurowanych KPI) ⇒ zwraca [], nie rzuca i nie zmyśla kodów', () => {
    expect(recommendKpisForIndustry([], 'SAAS')).toEqual([]);
  });
});

describe('validateCustomFormula — piaskownica bez eval', () => {
  const LINE_CODES = ['REVENUE', 'COGS', 'OPEX'];

  it('formuła poprawna z dwoma składnikami ⇒ ok:true, referencedLineCodes wyłapane', () => {
    const result = validateCustomFormula('(REVENUE - COGS) / REVENUE', LINE_CODES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.referencedLineCodes.sort()).toEqual(['COGS', 'REVENUE']);
    }
  });

  it('formuła z dozwoloną funkcją ROUND ⇒ ok:true', () => {
    expect(validateCustomFormula('ROUND(REVENUE / OPEX)', LINE_CODES).ok).toBe(true);
  });

  it('pusta formuła ⇒ ok:false EMPTY', () => {
    const result = validateCustomFormula('   ', LINE_CODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EMPTY');
  });

  it('KONTROLA NEGATYWNA (bezpieczeństwo): identyfikator spoza dostępnych kodów linii ⇒ odrzucone, nie wykonane', () => {
    const result = validateCustomFormula('REVENUE + SECRET_UNAPPROVED_LINE', LINE_CODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNKNOWN_IDENTIFIER');
  });

  it('KONTROLA NEGATYWNA (bezpieczeństwo): próba wstrzyknięcia kodu (średnik, backticki, wywołanie funkcji JS) ⇒ odrzucona jako UNKNOWN_TOKEN, formuła NIGDY nie trafia do eval/Function', () => {
    const attempts = ['REVENUE; alert(1)', 'REVENUE`+alert(1)`', 'require("fs")', 'REVENUE // COGS', 'REVENUE==COGS'];
    for (const attempt of attempts) {
      const result = validateCustomFormula(attempt, LINE_CODES);
      expect(result.ok).toBe(false);
    }
  });

  it('nawiasy niesparowane ⇒ ok:false UNBALANCED_PARENS', () => {
    const result = validateCustomFormula('(REVENUE - COGS', LINE_CODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNBALANCED_PARENS');
  });

  it('nawias zamykający bez otwierającego ⇒ ok:false UNBALANCED_PARENS', () => {
    const result = validateCustomFormula('REVENUE - COGS)', LINE_CODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNBALANCED_PARENS');
  });

  it('formuła dłuższa niż limit ⇒ ok:false TOO_LONG', () => {
    const huge = 'REVENUE' + ' + REVENUE'.repeat(100);
    const result = validateCustomFormula(huge, LINE_CODES);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('TOO_LONG');
  });
});
