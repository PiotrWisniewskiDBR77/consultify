import { describe, expect, it } from 'vitest';
import { runBundleDeckQa } from '../deliverables/bundleDeckQa.js';
import type { BusinessPlanSpine } from '../deliverables/businessPlanSpine.js';

function spine(solutionTitle: string, assumptions = 1): BusinessPlanSpine {
  return {
    meta: { company: 'Fixture', language: 'PL', thesis: 'Teza', ask: 'Ask' },
    assumptions: Array.from({ length: assumptions }, (_, index) => ({
      key: `risk.${index}`,
      label: 'Ryzyko retencji',
      base: 1,
      unit: '%',
      range: [0, 2],
      provenance: { source: 'fixture', benchmarked: true },
      sensitivityRank: 1,
      valueClass: 'input',
    })),
    market: {
      tam: {
        value: 1,
        unit: 'PLN',
        method: 'top-down',
        provenance: { source: 'fixture', benchmarked: true },
      },
      sam: { value: 1, unit: 'PLN', provenance: { source: 'fixture', benchmarked: true } },
      som: {
        value: 1,
        unit: 'PLN',
        derivedFromGtm: true,
        provenance: { source: 'fixture', benchmarked: true },
      },
      bottomUp: { value: 1, unit: 'PLN', formula: '1x1' },
      reconciliation: { topDown: 1, bottomUp: 1, gapPct: 0, reconciled: true },
    },
    financials: {
      pnl: [],
      arrBridge: [],
      balanceSheet: [],
      cashFlow: [],
      unitEconomics: [],
      kpis: { nrr: 100, ruleOf40: 0, burnMultiple: 0, magicNumber: 0, cacPaybackMonths: 0 },
      breakEven: { ebitdaPositivePeriod: null, runwayMonths: null },
      valuation: { dcf: 0, comparablesMultiple: 0, vcMethod: 0, low: 0, high: 0 },
      scenarios: {
        base: { pnl: [], note: '' },
        bull: { pnl: [], note: '' },
        bear: { pnl: [], note: '' },
      },
    },
    glossary: {},
    heroNumbers: [],
    sections: [
      {
        id: 'problem',
        actionTitle: 'Problem',
        heroNumberKeys: [],
        deck: { slideIntent: 'key_messages', reusesTable: false, needsProductGraphic: false },
      },
      {
        id: 'solution',
        actionTitle: solutionTitle,
        heroNumberKeys: [],
        deck: { slideIntent: 'key_messages', reusesTable: false, needsProductGraphic: false },
      },
    ],
    validation: { checks: [], antiPatterns: [], passed: true },
  };
}

describe('Day 256 bundle deck source traceability gate', () => {
  it('keeps a clean SPINE valid', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const result = runBundleDeckQa(spine('Brak stwierdzenia sprzecznego ze zrodlem', 1));
    expect(result).not.toBeNull();
    expect(result?.valid).toBe(true);
  });

  it('blocks a SPINE whose slide claims zero risks while source data is non-zero', () => {
    const result = runBundleDeckQa(spine('Diagnoza objela 0 ryzyk', 1));
    expect(result).not.toBeNull();
    expect(result?.valid).toBe(false);
    expect(result?.errorCount).toBeGreaterThanOrEqual(1);
    expect(result?.topViolations).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'ZERO_CLAIM_CONTRADICTS_SOURCE' })])
    );
  });
});
