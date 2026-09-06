/**
 * Dowód na defekt #6 audytu FIN 2026-09-06 (karta analizy): 18 wskaźników
 * katalogu P0 ma polską nazwę, polską kategorię i CZYTELNY wzór — a nie
 * angielską nazwę, SCREAMING_CASE i komentarz z kodu źródłowego.
 */
import { describe, expect, it } from 'vitest';

import {
  FINANCE_KPI_LABELS,
  financeKpiCategory,
  financeKpiFormula,
  financeKpiName,
  hasFinanceKpiLabel,
} from '../financeKpiLabels';

/** Kody zmierzone na realnej analizie CD PROJEKT (`business_version_id d7b0b5de-…`). */
const ANALYSIS_KPI_CODES = [
  'CASH_CONVERSION_CYCLE', 'CASH_RATIO', 'CURRENT_RATIO', 'DEBT_TO_EBITDA', 'DEBT_TO_EQUITY',
  'DIO', 'DPO', 'DSO', 'EBITDA_MARGIN_PCT', 'FCF_MARGIN', 'GROSS_MARGIN_PCT',
  'INTEREST_COVERAGE', 'NET_MARGIN_PCT', 'OPERATING_CASH_FLOW_MARGIN', 'QUICK_RATIO',
  'REVENUE_GROWTH_YOY', 'ROA', 'ROE',
];

const LATIN_ONLY = /^[\x20-\x7E]*$/;

describe('financeKpiLabels — analiza CD PROJEKT', () => {
  it('każdy wskaźnik analizy ma wpis w słowniku', () => {
    expect(ANALYSIS_KPI_CODES.filter((code) => !hasFinanceKpiLabel(code))).toEqual([]);
  });

  it('nazwy nie są angielskimi nazwami z katalogu', () => {
    expect(financeKpiName('CASH_RATIO', 'Cash Ratio')).toBe('Wskaźnik gotówkowy');
    expect(financeKpiName('CURRENT_RATIO', 'Current Ratio')).toBe('Wskaźnik płynności bieżącej');
    expect(financeKpiName('ROE', 'Return on Equity')).toBe('Rentowność kapitału własnego (ROE)');
    expect(financeKpiName('DSO', 'Days Sales Outstanding')).toBe('Cykl należności (DSO)');
  });

  it('kategorie nie wychodzą jako SCREAMING_CASE', () => {
    expect(financeKpiCategory('LIQUIDITY')).toBe('Płynność');
    expect(financeKpiCategory('EFFICIENCY')).toBe('Efektywność');
    expect(financeKpiCategory('LEVERAGE')).toBe('Zadłużenie');
    expect(financeKpiCategory('CASH_FLOW')).toBe('Przepływy pieniężne');
    expect(financeKpiCategory('NIEZNANA_KATEGORIA')).not.toMatch(/^[A-Z_]+$/);
  });

  it('kolumna WZÓR dostaje wzór, nie komentarz z kodu ani odwołanie do ADR', () => {
    const current = financeKpiFormula('CURRENT_RATIO');
    expect(current?.formulaPl).toBe('Aktywa obrotowe / Zobowiązania krótkoterminowe');
    for (const code of ANALYSIS_KPI_CODES) {
      const info = financeKpiFormula(code);
      expect(info, code).not.toBeNull();
      expect(info!.formulaPl, code).not.toMatch(/ADR|formula_ref|AST|catalog entries/i);
      expect(info!.interpretationPl, code).not.toMatch(/ADR|formula_ref|AST|catalog entries/i);
      // WZÓR i INTERPRETACJA to DWIE różne treści — audyt zmierzył ten sam
      // tekst zduplikowany w obu kolumnach.
      expect(info!.formulaPl, code).not.toBe(info!.interpretationPl);
    }
  });

  it('żadna nazwa ani interpretacja nie jest czystym ASCII (czyli po angielsku bez polskich znaków)', () => {
    const suspicious = Object.entries(FINANCE_KPI_LABELS).filter(
      ([, label]) => LATIN_ONLY.test(label.namePl) && LATIN_ONLY.test(label.interpretationPl)
    );
    expect(suspicious.map(([code]) => code)).toEqual([]);
  });

  it('KPI spoza katalogu P0 nie dostaje zmyślonego wzoru', () => {
    expect(financeKpiFormula('ORG_CUSTOM_KPI')).toBeNull();
    expect(financeKpiName('ORG_CUSTOM_KPI', 'Mój wskaźnik')).toBe('Mój wskaźnik');
  });
});
