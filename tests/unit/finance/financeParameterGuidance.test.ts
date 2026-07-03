import { describe, expect, it } from 'vitest';

import {
  INDUSTRY_PARAMETER_PROFILES,
  gradeWacc,
  getIndustryParameterProfile,
  resolveIndustryClass,
  waccGuidance,
  type FinanceIndustryClass,
} from '../../../server/src/services/financeParameterGuidance.ts';

describe('resolveIndustryClass', () => {
  it('maps free-text PL/EN segments to canonical classes', () => {
    expect(resolveIndustryClass('SaaS startup')).toBe('software-saas');
    expect(resolveIndustryClass('kancelaria prawna')).toBe('professional-services');
    expect(resolveIndustryClass('consulting')).toBe('professional-services');
    expect(resolveIndustryClass('chemia i farmacja')).toBe('process-manufacturing');
    expect(resolveIndustryClass('automotive components')).toBe('discrete-manufacturing');
    expect(resolveIndustryClass('handel detaliczny')).toBe('retail-trade');
    expect(resolveIndustryClass('energetyka / utilities')).toBe('infrastructure-utilities');
  });

  it('falls back to generic for unknown/empty and never throws', () => {
    expect(resolveIndustryClass('')).toBe('generic');
    expect(resolveIndustryClass(undefined)).toBe('generic');
    expect(resolveIndustryClass('spaceship refuelling')).toBe('generic');
  });
});

describe('INDUSTRY_PARAMETER_PROFILES invariants', () => {
  it('every band is ordered low <= mid <= high for wacc and terminal growth', () => {
    for (const p of INDUSTRY_PARAMETER_PROFILES) {
      expect(p.waccBand.low).toBeLessThanOrEqual(p.waccBand.mid);
      expect(p.waccBand.mid).toBeLessThanOrEqual(p.waccBand.high);
      expect(p.terminalGrowthBand.low).toBeLessThanOrEqual(p.terminalGrowthBand.mid);
      expect(p.terminalGrowthBand.mid).toBeLessThanOrEqual(p.terminalGrowthBand.high);
    }
  });

  it('has bilingual label + rationale for every profile', () => {
    for (const p of INDUSTRY_PARAMETER_PROFILES) {
      expect(p.label.pl.length).toBeGreaterThan(2);
      expect(p.label.en.length).toBeGreaterThan(2);
      expect(p.rationale.pl.length).toBeGreaterThan(20);
      expect(p.rationale.en.length).toBeGreaterThan(20);
    }
  });

  it('utilities carry the lowest cost of capital, SaaS the highest', () => {
    const util = getIndustryParameterProfile('infrastructure-utilities').waccBand.mid;
    const saas = getIndustryParameterProfile('software-saas').waccBand.mid;
    const allMids = INDUSTRY_PARAMETER_PROFILES.map((p) => p.waccBand.mid);
    expect(util).toBe(Math.min(...allMids));
    expect(saas).toBe(Math.max(...allMids));
  });
});

describe('waccGuidance', () => {
  it('returns a branżowy zakres, not a flat 10% default', () => {
    const g = waccGuidance({ industrySegment: 'process manufacturing', sizeBand: 'medium' });
    expect(g.industry).toBe('process-manufacturing');
    expect(g.recommendedWaccPct).toBe(g.waccBand.mid);
    // a real band, not a single hardcoded number
    expect(g.waccBand.high).toBeGreaterThan(g.waccBand.low);
    expect(g.confidence).toBe('expert-hypothesis');
    expect(g.disclaimer.pl.length).toBeGreaterThan(20);
  });

  it('shifts the whole band up for smaller companies (size risk premium)', () => {
    const med = waccGuidance({ industrySegment: 'discrete manufacturing', sizeBand: 'medium' });
    const micro = waccGuidance({ industrySegment: 'discrete manufacturing', sizeBand: 'micro' });
    const large = waccGuidance({ industrySegment: 'discrete manufacturing', sizeBand: 'large' });
    expect(micro.waccBand.mid).toBeGreaterThan(med.waccBand.mid);
    expect(large.waccBand.mid).toBeLessThan(med.waccBand.mid);
    // band never goes negative
    expect(large.waccBand.low).toBeGreaterThanOrEqual(0);
  });

  it('defaults size to medium and segment to generic', () => {
    const g = waccGuidance({});
    expect(g.industry).toBe('generic');
    expect(g.sizeBand).toBe('medium');
  });
});

describe('gradeWacc', () => {
  const band = { low: 10, mid: 12, high: 14 };

  it('flags a rate below the band as NPV-overstating', () => {
    const grade = gradeWacc(7, band);
    expect(grade.verdict).toBe('below-band');
    expect(grade.distancePp).toBe(3);
    expect(grade.note.en.toLowerCase()).toContain('overstates');
  });

  it('flags a rate above the band as NPV-understating', () => {
    const grade = gradeWacc(20, band);
    expect(grade.verdict).toBe('above-band');
    expect(grade.distancePp).toBe(6);
    expect(grade.note.en.toLowerCase()).toContain('understates');
  });

  it('accepts an in-band rate', () => {
    const grade = gradeWacc(12, band);
    expect(grade.verdict).toBe('in-band');
    expect(grade.distancePp).toBe(0);
  });
});
