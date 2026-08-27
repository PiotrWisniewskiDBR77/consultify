export const CONTRIBUTION_CLASSES = ['CRITICAL', 'IMPORTANT', 'SUPPORTING'] as const;

export const REQUIRED_POLICY_PARAMETERS = [
  'impactWeights',
  'atRiskThresholdDays',
  'capacitySaturationThreshold',
  'capacityBuffer',
  'decisionSlaDays',
] as const;

export type PolicyParameterName = (typeof REQUIRED_POLICY_PARAMETERS)[number];

export type PolicyParameterError = {
  parameter: PolicyParameterName;
  rule: string;
  message: { en: string; pl: string };
};

const error = (parameter: PolicyParameterName, rule: string): PolicyParameterError => ({
  parameter,
  rule,
  message: {
    en: `${parameter} violates ${rule}`,
    pl: `${parameter} narusza regułę ${rule}`,
  },
});

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export function validateControlKpiPolicyParameters(input: Record<string, unknown>): {
  missingParameters: PolicyParameterName[];
  invalidParameters: PolicyParameterError[];
} {
  const missingParameters = REQUIRED_POLICY_PARAMETERS.filter(
    (name) => input[name] === undefined || input[name] === null
  );
  const invalidParameters: PolicyParameterError[] = [];

  const weights = input.impactWeights;
  if (weights !== undefined && weights !== null) {
    const keys = typeof weights === 'object' && !Array.isArray(weights) ? Object.keys(weights) : [];
    if (
      keys.length !== CONTRIBUTION_CLASSES.length ||
      !CONTRIBUTION_CLASSES.every((name) => keys.includes(name))
    ) {
      invalidParameters.push(error('impactWeights', 'EXACT_CONTRIBUTION_CLASSES'));
    } else if (
      CONTRIBUTION_CLASSES.some(
        (name) =>
          !finite((weights as Record<string, unknown>)[name]) ||
          ((weights as Record<string, number>)[name] as number) <= 0
      )
    ) {
      invalidParameters.push(error('impactWeights', 'POSITIVE_FINITE_WEIGHTS'));
    }
  }

  const atRisk = input.atRiskThresholdDays;
  if (
    atRisk !== undefined &&
    atRisk !== null &&
    (!finite(atRisk) || !Number.isInteger(atRisk) || atRisk <= 0)
  ) {
    invalidParameters.push(error('atRiskThresholdDays', 'POSITIVE_INTEGER'));
  }

  const decision = input.decisionSlaDays;
  if (decision !== undefined && decision !== null) {
    const value =
      typeof decision === 'object' && !Array.isArray(decision)
        ? (decision as Record<string, unknown>)
        : {};
    if (!finite(value.value) || !Number.isInteger(value.value) || value.value <= 0) {
      invalidParameters.push(error('decisionSlaDays', 'POSITIVE_INTEGER_VALUE'));
    } else if (!['BUSINESS_DAYS', 'CALENDAR_DAYS'].includes(String(value.unit))) {
      invalidParameters.push(error('decisionSlaDays', 'EXPLICIT_DAY_UNIT'));
    }
  }

  const saturation = input.capacitySaturationThreshold;
  if (saturation !== undefined && saturation !== null) {
    const value =
      typeof saturation === 'object' && !Array.isArray(saturation)
        ? (saturation as Record<string, unknown>)
        : {};
    if (!finite(value.normalUpper) || !finite(value.saturatedUpper)) {
      invalidParameters.push(error('capacitySaturationThreshold', 'FINITE_BAND_LIMITS'));
    } else if (
      value.normalUpper <= 0 ||
      value.saturatedUpper > 1 ||
      value.normalUpper >= value.saturatedUpper
    ) {
      invalidParameters.push(error('capacitySaturationThreshold', 'STRICTLY_INCREASING_FRACTIONS'));
    }
  }

  const buffer = input.capacityBuffer;
  if (buffer !== undefined && buffer !== null && (!finite(buffer) || buffer < 0 || buffer >= 1)) {
    invalidParameters.push(error('capacityBuffer', 'FRACTION_ZERO_INCLUSIVE_ONE_EXCLUSIVE'));
  }

  return { missingParameters, invalidParameters };
}
