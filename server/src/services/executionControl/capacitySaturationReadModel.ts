import { validateControlKpiPolicyParameters } from './controlKpiPolicySchema.js';

type Thresholds = { normalUpper: number; saturatedUpper: number };

export function classifyCapacityBand(
  saturation: number,
  thresholds: Thresholds
): 'NORMAL' | 'SATURATED' | 'OVERLOADED' {
  if (saturation <= thresholds.normalUpper) return 'NORMAL';
  if (saturation <= thresholds.saturatedUpper) return 'SATURATED';
  return 'OVERLOADED';
}

export function readCapacitySaturation(parameters: Record<string, unknown>) {
  const validation = validateControlKpiPolicyParameters(parameters);
  const relevantMissing = validation.missingParameters.filter((parameter) =>
    ['capacitySaturationThreshold', 'capacityBuffer'].includes(parameter)
  );
  const relevantInvalid = validation.invalidParameters.filter((item) =>
    ['capacitySaturationThreshold', 'capacityBuffer'].includes(item.parameter)
  );
  if (relevantMissing.length > 0) {
    return {
      knowledgeState: 'UNKNOWN' as const,
      valueReason: 'DECISION_REQUIRED' as const,
      missingParameters: relevantMissing,
      invalidParameters: [],
      missingAvailabilityComponents: [],
      saturationRange: null,
      configuredPolicy: null,
    };
  }
  if (relevantInvalid.length > 0) {
    return {
      knowledgeState: 'UNKNOWN' as const,
      valueReason: 'INVALID_PARAMETERS' as const,
      missingParameters: [],
      invalidParameters: relevantInvalid,
      missingAvailabilityComponents: [],
      saturationRange: null,
      configuredPolicy: null,
    };
  }
  return {
    knowledgeState: 'UNKNOWN' as const,
    valueReason: 'AVAILABILITY_SOURCE_UNAVAILABLE' as const,
    missingParameters: [],
    invalidParameters: [],
    missingAvailabilityComponents: ['ABSENCE', 'FIXED_DUTIES', 'ACCEPTED_RESERVATIONS'] as const,
    saturationRange: null,
    configuredPolicy: {
      thresholds: parameters.capacitySaturationThreshold as Thresholds,
      capacityBuffer: parameters.capacityBuffer as number,
      bufferApplication: 'SUBTRACT_FROM_AVAILABILITY_BEFORE_SATURATION' as const,
    },
  };
}
