import { describe, expect, it } from 'vitest';

import { corporateTokens, likelihoodImpactColor } from '../designTokens.js';

describe('likelihoodImpactColor', () => {
  const tokens = corporateTokens;

  it('keeps supported risk levels semantic', () => {
    expect(likelihoodImpactColor('high', tokens)).toBe(tokens.colors.danger);
    expect(likelihoodImpactColor('medium', tokens)).toBe(tokens.colors.warning);
    expect(likelihoodImpactColor('low', tokens)).toBe(tokens.colors.success);
  });

  it('renders UNKNOWN and qualitative evidence labels neutrally', () => {
    expect(likelihoodImpactColor('UNKNOWN', tokens)).toBe(tokens.colors.muted);
    expect(likelihoodImpactColor('Baseline must be validated', tokens)).toBe(tokens.colors.muted);
  });
});
