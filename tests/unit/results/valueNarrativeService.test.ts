import { describe, it, expect } from 'vitest';

import {
  buildNarrative,
  executiveSummary,
  formatValue,
  type ValueNarrativeInput,
} from '../../../server/src/services/results/valueNarrativeService';

const baseInput: ValueNarrativeInput = {
  banked: 2_400_000,
  inFlight: 1_200_000,
  atRisk: 350_000,
  totalTarget: 5_000_000,
  pctOfTarget: 48,
  topBenefits: [
    { name: 'Automatyzacja faktur', realizedValue: 1_100_000 },
    { name: 'Redukcja przestojów', realizedValue: 800_000 },
  ],
  topRisks: [{ name: 'Opóźnienie migracji ERP', atRiskValue: 350_000 }],
  decisions: [
    { action: 'DOŁÓŻ', name: 'Skalowanie pilota' },
    { action: 'ZABIJ', name: 'Inicjatywa X' },
    { action: 'DOŁÓŻ', name: 'Rozszerzenie na region 2' },
  ],
};

describe('valueNarrativeService.formatValue', () => {
  it('formats millions with M suffix', () => {
    expect(formatValue(2_400_000)).toBe('2,4 M');
    expect(formatValue(5_000_000)).toBe('5 M');
  });

  it('formats thousands with k suffix', () => {
    expect(formatValue(350_000)).toBe('350 k');
    expect(formatValue(1_200)).toBe('1,2 k');
  });

  it('formats small numbers as integers', () => {
    expect(formatValue(750)).toBe('750');
    expect(formatValue(0)).toBe('0');
  });

  it('handles nullish / non-finite safely', () => {
    expect(formatValue(null)).toBe('0');
    expect(formatValue(undefined)).toBe('0');
    expect(formatValue(NaN)).toBe('0');
  });

  it('preserves sign for negatives', () => {
    expect(formatValue(-2_400_000)).toBe('-2,4 M');
  });
});

describe('valueNarrativeService.buildNarrative', () => {
  it('headline contains formatted amount and percentage', () => {
    const out = buildNarrative(baseInput);
    expect(out.headline).toContain('2,4 M PLN');
    expect(out.headline).toContain('48%');
    expect(out.headline).toMatch(/Transformacja dostarczyła/);
  });

  it('paragraphs and bullets are non-empty', () => {
    const out = buildNarrative(baseInput);
    expect(out.paragraphs.length).toBeGreaterThan(0);
    expect(out.bullets.length).toBeGreaterThan(0);
    expect(out.paragraphs.every((p) => p.trim().length > 0)).toBe(true);
    expect(out.bullets.every((b) => b.trim().length > 0)).toBe(true);
  });

  it('bullets include top benefits, top risks and decision counts', () => {
    const out = buildNarrative(baseInput);
    const joined = out.bullets.join('\n');
    expect(joined).toContain('Automatyzacja faktur');
    expect(joined).toContain('Opóźnienie migracji ERP');
    expect(joined).toContain('2 × DOŁÓŻ');
    expect(joined).toContain('1 × ZABIJ');
  });

  it('describes at-risk value when present and otherwise notes control', () => {
    const withRisk = buildNarrative(baseInput);
    expect(withRisk.paragraphs.join(' ')).toContain('Zagrożone jest');

    const noRisk = buildNarrative({ ...baseInput, atRisk: 0 });
    expect(noRisk.paragraphs.join(' ')).toContain('żadna wartość nie jest oznaczona jako zagrożona');
  });

  it('is deterministic: same input -> same output', () => {
    const a = buildNarrative(baseInput);
    const b = buildNarrative(baseInput);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('handles missing optional arrays without throwing', () => {
    const minimal: ValueNarrativeInput = {
      banked: 100,
      inFlight: 0,
      atRisk: 0,
      totalTarget: 1000,
      pctOfTarget: 10,
    };
    const out = buildNarrative(minimal);
    expect(out.headline).toContain('100 PLN');
    expect(out.paragraphs.length).toBeGreaterThan(0);
    // No benefits/risks/decisions => no bullets
    expect(out.bullets.length).toBe(0);
  });
});

describe('valueNarrativeService.executiveSummary', () => {
  it('returns a single non-empty paragraph with key figures', () => {
    const summary = executiveSummary(baseInput);
    expect(summary.trim().length).toBeGreaterThan(0);
    expect(summary).toContain('2,4 M PLN');
    expect(summary).toContain('48%');
    expect(summary).toContain('1,2 M PLN'); // inFlight
    expect(summary).toContain('350 k PLN'); // atRisk
    // single paragraph (no hard line breaks)
    expect(summary).not.toContain('\n');
  });

  it('is deterministic', () => {
    expect(executiveSummary(baseInput)).toBe(executiveSummary(baseInput));
  });

  it('notes absence of risk when atRisk is zero', () => {
    const summary = executiveSummary({ ...baseInput, atRisk: 0 });
    expect(summary).toContain('braku wartości oznaczonej jako zagrożona');
  });
});
