import { describe, expect, it } from 'vitest';

import { classifyCapacityBand, readCapacitySaturation } from '../capacitySaturationReadModel.js';

const policy = () => ({
  impactWeights: { CRITICAL: 3, IMPORTANT: 2, SUPPORTING: 1 },
  atRiskThresholdDays: 2,
  decisionSlaDays: { value: 3, unit: 'CALENDAR_DAYS' },
  capacitySaturationThreshold: { normalUpper: 0.6, saturatedUpper: 0.85 },
  capacityBuffer: 0.2,
});

describe('honest capacity saturation read model', () => {
  it('does not calculate without policy decisions', () => {
    expect(readCapacitySaturation({})).toMatchObject({
      knowledgeState: 'UNKNOWN',
      valueReason: 'DECISION_REQUIRED',
      saturationRange: null,
    });
  });

  it('does not calculate when a configured parameter is invalid', () => {
    expect(readCapacitySaturation({ ...policy(), capacityBuffer: 2 })).toMatchObject({
      knowledgeState: 'UNKNOWN',
      valueReason: 'INVALID_PARAMETERS',
      saturationRange: null,
    });
  });

  it('returns UNKNOWN and every missing availability component for a complete policy', () => {
    expect(readCapacitySaturation(policy())).toMatchObject({
      knowledgeState: 'UNKNOWN',
      valueReason: 'AVAILABILITY_SOURCE_UNAVAILABLE',
      saturationRange: null,
      missingAvailabilityComponents: ['ABSENCE', 'FIXED_DUTIES', 'ACCEPTED_RESERVATIONS'],
    });
  });

  it('classifies a future known ratio in the configured normal band', () => {
    expect(classifyCapacityBand(0.5, policy().capacitySaturationThreshold)).toBe('NORMAL');
  });

  it('classifies a future known ratio in the configured saturated band', () => {
    expect(classifyCapacityBand(0.7, policy().capacitySaturationThreshold)).toBe('SATURATED');
  });

  it('classifies a future known ratio above configured bands as overloaded', () => {
    expect(classifyCapacityBand(0.9, policy().capacitySaturationThreshold)).toBe('OVERLOADED');
  });
});
