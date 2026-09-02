import { describe, expect, it } from 'vitest';
import { validateReport } from '../RulesEngine.js';
import type { UnifiedReportJSON } from '../types.js';

function reportWithRiskSource(claim: string, risks = 1): UnifiedReportJSON {
  return {
    meta: {
      client: 'Fixture',
      project: 'Day 256',
      date: '2026-09-01',
      author: 'Codex',
      confidentiality: 'internal',
      language: 'pl',
      template: 'corporate',
      sourceType: 'business_plan',
    },
    slides: [
      {
        intent: 'key_messages',
        key_message: claim,
        content: {
          type: 'key_messages',
          messages: [{ title: 'Wniosek', description: claim }],
        },
      },
      {
        intent: 'risk_management',
        key_message: 'Ryzyka z danych zrodlowych',
        content: {
          type: 'risk_management',
          risks: Array.from({ length: risks }, () => ({
            risk: 'Ryzyko retencji',
            likelihood: 'medium',
            impact: 'high',
            mitigation: 'Monitoruj',
          })),
        },
      },
    ],
  };
}

describe('Day 256 RulesEngine source traceability rule', () => {
  it('blocks a zero-risk claim contradicted by non-zero report source data', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const result = validateReport(reportWithRiskSource('Diagnoza objela 0 ryzyk', 1));
    expect(result.valid).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'ZERO_CLAIM_CONTRADICTS_SOURCE', severity: 'error' }),
      ])
    );
  });

  it('allows a zero-risk claim when report source data is also empty', () => {
    const result = validateReport(reportWithRiskSource('Diagnoza objela 0 ryzyk', 0));
    expect(result.valid).toBe(true);
    expect(result.violations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ rule: 'ZERO_CLAIM_CONTRADICTS_SOURCE' })])
    );
  });
});
