import { describe, expect, it } from 'vitest';

import { readCapacitySaturation } from '../capacitySaturationReadModel.js';

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

  // FIX-7 (odbior dyzuru 33): trzy testy `classifyCapacityBand` USUNIETO razem z funkcja.
  // Badaly kod o ZERO wolaczach produkcyjnych, wiec podnosily licznik zielonych testow,
  // nie dowodzac niczego o dzialaniu modulu. Zamiast nich jeden test pilnuje granicy,
  // ktora ma dzis realne znaczenie: progi z polityki sa PRZENOSZONE bez zmiany
  // i bez wyliczania jakiegokolwiek pasma.
  it('carries the configured thresholds through without inventing a band', () => {
    const result = readCapacitySaturation(policy());
    expect(result.configuredPolicy).toEqual({
      thresholds: { normalUpper: 0.6, saturatedUpper: 0.85 },
      capacityBuffer: 0.2,
      bufferApplication: 'SUBTRACT_FROM_AVAILABILITY_BEFORE_SATURATION',
    });
    expect(result).not.toHaveProperty('band');
    expect(result.saturationRange).toBeNull();
  });
});
