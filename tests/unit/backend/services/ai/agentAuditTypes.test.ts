import { describe, expect, it } from 'vitest';

import {
  AgentReviewSchema,
  RiskAreaSchema,
} from '../../../../../server/src/services/ai/agentAudit/types.js';

describe('Agent Audit types', () => {
  it('RiskAreaSchema normalizes common synonyms', () => {
    expect(RiskAreaSchema.parse('Cash Flow')).toBe('cashflow');
    expect(RiskAreaSchema.parse('CAPEX')).toBe('capex');
    expect(RiskAreaSchema.parse('BHP')).toBe('safety');
    expect(RiskAreaSchema.parse('Integrations')).toBe('architecture_integrations');
  });

  it('AgentReviewSchema parses non-canonical area into canonical RiskArea', () => {
    const parsed = AgentReviewSchema.parse({
      agentId: 'function.cfo_finance',
      verdict: 'risk',
      overreach: 'none',
      findings: [
        {
          area: 'Cash Flow',
          severity: 'medium',
          claim: 'Cashflow może nie spiąć się w Q2.',
          evidenceFromDT: ['DT: "CAPEX 2M"'],
          missingDataQuestions: ['MUST: forecast 6m'],
          suggestedDeepening: 'Dodaj forecast cashflow i scenariusze.',
        },
      ],
      conflicts: [],
    } as any);

    expect(parsed.findings[0].area).toBe('cashflow');
  });
});

