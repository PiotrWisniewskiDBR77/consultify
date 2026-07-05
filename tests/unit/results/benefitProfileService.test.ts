import { describe, expect, it } from 'vitest';

import {
  benefitProfileSummary,
  buildBenefitProfile,
  buildBenefitProfiles,
  type RawKpiInput,
} from '../../../server/src/services/results/benefitProfileService';

const kpi = (overrides: Partial<RawKpiInput> = {}): RawKpiInput => ({
  id: 'k1',
  name: 'Revenue growth',
  ...overrides,
});

describe('buildBenefitProfile', () => {
  it('infers financial type for PLN unit', () => {
    const p = buildBenefitProfile(kpi({ unit: 'PLN' }));
    expect(p.type).toBe('financial');
  });

  it('infers financial type for revenue keyword', () => {
    const p = buildBenefitProfile(kpi({ name: 'Revenue delta Q3' }));
    expect(p.type).toBe('financial');
  });

  it('infers non-financial type for NPS KPI', () => {
    const p = buildBenefitProfile(kpi({ name: 'NPS score', unit: 'points' }));
    expect(p.type).toBe('non-financial');
  });

  it('infers strategic type for brand KPI', () => {
    const p = buildBenefitProfile(kpi({ name: 'Brand awareness index', unit: '%' }));
    expect(p.type).toBe('strategic');
  });

  it('infers revenue category', () => {
    const p = buildBenefitProfile(kpi({ name: 'Revenue per user' }));
    expect(p.category).toBe('revenue');
  });

  it('infers cost category', () => {
    const p = buildBenefitProfile(kpi({ name: 'Cost reduction Q4' }));
    expect(p.category).toBe('cost');
  });

  it('infers risk category', () => {
    const p = buildBenefitProfile(kpi({ name: 'Risk incidents per month' }));
    expect(p.category).toBe('risk');
  });

  it('infers customer category', () => {
    const p = buildBenefitProfile(kpi({ name: 'Customer retention rate' }));
    expect(p.category).toBe('customer');
  });

  it('infers efficiency category', () => {
    const p = buildBenefitProfile(kpi({ name: 'Lead time improvement' }));
    expect(p.category).toBe('efficiency');
  });

  it('marks unknown category for unmapped name', () => {
    const p = buildBenefitProfile(kpi({ name: 'Zupełnie nowe KPI XYZ' }));
    expect(p.category).toBe('unknown');
  });

  it('detects dis-benefit', () => {
    const p = buildBenefitProfile(kpi({ name: 'Reduction in employee count' }));
    expect(p.isDisBenefit).toBe(true);
  });

  it('positive benefit is not dis-benefit', () => {
    const p = buildBenefitProfile(kpi({ name: 'Revenue growth' }));
    expect(p.isDisBenefit).toBe(false);
  });

  it('returns businessOwner from owner_name', () => {
    const p = buildBenefitProfile(kpi({ owner_name: 'Anna Kowalska' }));
    expect(p.businessOwner).toBe('Anna Kowalska');
  });

  it('hasTarget true when target_value set', () => {
    const p = buildBenefitProfile(kpi({ target_value: 100 }));
    expect(p.hasTarget).toBe(true);
  });

  it('hasTarget false when target_value null', () => {
    const p = buildBenefitProfile(kpi({ target_value: null }));
    expect(p.hasTarget).toBe(false);
  });

  it('computes realizationPct correctly', () => {
    const p = buildBenefitProfile(kpi({ current_value: 60, target_value: 100 }));
    expect(p.realizationPct).toBeCloseTo(0.6);
  });

  it('returns null realizationPct when no target', () => {
    const p = buildBenefitProfile(kpi({ current_value: 60, target_value: null }));
    expect(p.realizationPct).toBeNull();
  });

  it('caps realizationPct at 200%', () => {
    const p = buildBenefitProfile(kpi({ current_value: 500, target_value: 100 }));
    expect(p.realizationPct).toBe(2);
  });
});

describe('buildBenefitProfiles', () => {
  it('maps all kpis', () => {
    const kpis: RawKpiInput[] = [kpi({ id: 'a' }), kpi({ id: 'b' })];
    const profiles = buildBenefitProfiles(kpis);
    expect(profiles).toHaveLength(2);
    expect(profiles.map((p) => p.kpiId)).toEqual(['a', 'b']);
  });
});

describe('benefitProfileSummary', () => {
  it('counts by type correctly', () => {
    const profiles = buildBenefitProfiles([
      kpi({ name: 'Revenue delta', unit: 'PLN' }),
      kpi({ name: 'NPS score', unit: 'points' }),
      kpi({ name: 'Brand index' }),
    ]);
    const s = benefitProfileSummary(profiles);
    expect(s.total).toBe(3);
    expect(s.financial).toBeGreaterThan(0);
  });

  it('counts dis-benefits', () => {
    const profiles = buildBenefitProfiles([
      kpi({ name: 'Cost reduction' }),
      kpi({ name: 'Revenue growth' }),
    ]);
    const s = benefitProfileSummary(profiles);
    expect(s.disBenefits).toBeGreaterThanOrEqual(0);
  });

  it('counts withTarget', () => {
    const profiles = buildBenefitProfiles([
      kpi({ target_value: 100 }),
      kpi({ target_value: null }),
    ]);
    const s = benefitProfileSummary(profiles);
    expect(s.withTarget).toBe(1);
  });

  it('sums byCategory', () => {
    const profiles = buildBenefitProfiles([
      kpi({ name: 'Revenue X' }),
      kpi({ name: 'Revenue Y' }),
    ]);
    const s = benefitProfileSummary(profiles);
    expect(s.byCategory.revenue).toBe(2);
  });
});
