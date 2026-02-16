import { describe, expect, it } from 'vitest';

import {
  validateAgentContractCompleteness,
  validateNoSolutionRecommendations,
  validateReviewWebSources,
} from '../../../../../server/src/services/ai/agentAudit/orchestratorService.js';

describe('Agent Audit policy gates', () => {
  it('rejects incomplete agent contract (missing required sections)', () => {
    const res = validateAgentContractCompleteness({
      language: 'pl',
      review: {
        observations: [],
        challengedAssumptions: [],
        impactIfIgnored: '',
        whenItFails: '',
        topQuestions: [],
        findings: [],
      },
    });
    expect(res.ok).toBe(false);
    expect(String(res.reason || '')).toContain('Braki');
  });

  it('rejects solution recommendations via suggestedDeepening', () => {
    const res = validateNoSolutionRecommendations({
      language: 'en',
      review: {
        findings: [
          {
            suggestedDeepening: 'Implement SAP S/4HANA immediately.',
          },
        ],
      },
    });
    expect(res.ok).toBe(false);
  });

  it('rejects any web links when webSearchEnabled=false', () => {
    const res = validateReviewWebSources({
      webSearchEnabled: false,
      allowedWebUrls: new Set<string>(),
      review: {
        findings: [
          {
            claim: 'According to https://example.com',
            sourcesUsed: [],
          },
        ],
      },
    });
    expect(res.ok).toBe(false);
  });

  it('rejects URL cited but missing from sourcesUsed', () => {
    const allowed = new Set<string>(['https://allowed.example/a']);
    const res = validateReviewWebSources({
      webSearchEnabled: true,
      allowedWebUrls: allowed,
      review: {
        findings: [
          {
            claim: 'See https://allowed.example/a',
            sourcesUsed: [],
          },
        ],
      },
    });
    expect(res.ok).toBe(false);
    expect(String(res.reason || '')).toContain('missing from sourcesUsed');
  });

  it('rejects unauthorized web source in sourcesUsed', () => {
    const allowed = new Set<string>(['https://allowed.example/a']);
    const res = validateReviewWebSources({
      webSearchEnabled: true,
      allowedWebUrls: allowed,
      review: {
        findings: [
          {
            claim: 'Reference',
            sourcesUsed: [{ type: 'web_source', url: 'https://evil.example/x' }],
          },
        ],
      },
    });
    expect(res.ok).toBe(false);
    expect(String(res.reason || '')).toContain('Unauthorized');
  });
});
