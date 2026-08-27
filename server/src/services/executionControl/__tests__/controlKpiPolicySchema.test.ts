import { describe, expect, it } from 'vitest';

import { validateControlKpiPolicyParameters } from '../controlKpiPolicySchema.js';

const complete = () => ({
  impactWeights: { CRITICAL: 3, IMPORTANT: 2, SUPPORTING: 1 },
  atRiskThresholdDays: 2,
  decisionSlaDays: { value: 3, unit: 'BUSINESS_DAYS' },
  capacitySaturationThreshold: { normalUpper: 0.7, saturatedUpper: 0.9 },
  capacityBuffer: 0.1,
});

describe('control KPI policy structural schema', () => {
  it('accepts all five structurally valid parameters without adding defaults', () => {
    expect(validateControlKpiPolicyParameters(complete())).toEqual({
      missingParameters: [],
      invalidParameters: [],
    });
  });

  it('reports every missing parameter for an empty policy', () => {
    expect(validateControlKpiPolicyParameters({}).missingParameters).toEqual([
      'impactWeights',
      'atRiskThresholdDays',
      'capacitySaturationThreshold',
      'capacityBuffer',
      'decisionSlaDays',
    ]);
  });

  it('rejects a contribution map with fewer than the declared classes', () => {
    const input = complete();
    input.impactWeights = { CRITICAL: 3, IMPORTANT: 2 } as any;
    expect(validateControlKpiPolicyParameters(input).invalidParameters[0]).toMatchObject({
      parameter: 'impactWeights',
      rule: 'EXACT_CONTRIBUTION_CLASSES',
    });
  });

  it('rejects non-positive contribution weights', () => {
    const input = complete();
    input.impactWeights.SUPPORTING = 0;
    expect(validateControlKpiPolicyParameters(input).invalidParameters[0]).toMatchObject({
      parameter: 'impactWeights',
      rule: 'POSITIVE_FINITE_WEIGHTS',
    });
  });

  it('rejects a non-integer at-risk threshold', () => {
    const input = complete();
    input.atRiskThresholdDays = 1.5;
    expect(validateControlKpiPolicyParameters(input).invalidParameters[0]).toMatchObject({
      parameter: 'atRiskThresholdDays',
      rule: 'POSITIVE_INTEGER',
    });
  });

  it('requires an explicit business or calendar day unit', () => {
    const input = complete();
    input.decisionSlaDays.unit = 'WEEKS';
    expect(validateControlKpiPolicyParameters(input).invalidParameters[0]).toMatchObject({
      parameter: 'decisionSlaDays',
      rule: 'EXPLICIT_DAY_UNIT',
    });
  });

  it('rejects non-increasing saturation bands', () => {
    const input = complete();
    input.capacitySaturationThreshold = { normalUpper: 0.9, saturatedUpper: 0.8 };
    expect(validateControlKpiPolicyParameters(input).invalidParameters[0]).toMatchObject({
      parameter: 'capacitySaturationThreshold',
      rule: 'STRICTLY_INCREASING_FRACTIONS',
    });
  });

  it('rejects a buffer outside the mathematical fraction range', () => {
    const input = complete();
    input.capacityBuffer = 1;
    expect(validateControlKpiPolicyParameters(input).invalidParameters[0]).toMatchObject({
      parameter: 'capacityBuffer',
      rule: 'FRACTION_ZERO_INCLUSIVE_ONE_EXCLUSIVE',
    });
  });
});
