import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../../server/src/services/auditService.js', () => ({
  log: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: () => 'init-uuid-0001',
}));

// FIN-06: `convertAdvisoryRecommendationToInitiative` no longer inserts an
// Initiative directly — it delegates to the shared Finance Candidate
// handoff adapter. Mock that adapter here so this unit test can assert the
// delegation + the "never touches `initiatives` directly" contract without
// standing up real Postgres (real-DB coverage lives in
// `tests/acceptance/fin-006-valuation-recommendation-candidate-handoff.e2e.test.ts`).
const mockConfirmValuationRecommendationCandidateHandoff = vi.fn();
vi.mock(
  '../../../server/src/services/finance/financeValuationRecommendationCandidateHandoff.js',
  () => ({
    confirmValuationRecommendationCandidateHandoff: (...args: unknown[]) =>
      mockConfirmValuationRecommendationCandidateHandoff(...args),
  })
);

import {
  computeValuation,
  convertAdvisoryRecommendationToInitiative,
  listValuations,
} from '../../../server/src/services/valuationService';
import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import * as audit from '../../../server/src/services/auditService.js';

describe('valuationService additional paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computeValuation throws for unavailable financial_model source', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      id: 'val-1',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 3,
      currency: 'PLN',
      source_type: 'financial_model',
      source_id: 'fm-1',
      assumptions: JSON.stringify({ horizonYears: 3, manualForecast: { years: [] } }),
      peers: '[]',
      results: '{}',
    });

    await expect(computeValuation('org-1', 'val-1')).rejects.toThrow(
      'Financial model must be approved before valuation can use it'
    );
  });

  it('computeValuation throws when budget sourceId is missing', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      id: 'val-2',
      organization_id: 'org-1',
      status: 'DRAFT',
      horizon_years: 3,
      currency: 'PLN',
      source_type: 'budget',
      source_id: null,
      assumptions: JSON.stringify({ horizonYears: 3, manualForecast: { years: [] } }),
      peers: '[]',
      results: '{}',
    });

    await expect(computeValuation('org-1', 'val-2')).rejects.toThrow('Missing sourceId');
  });

  it('convertAdvisoryRecommendationToInitiative throws when valuation missing', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue(null);

    await expect(
      convertAdvisoryRecommendationToInitiative('org-1', 'val-1', 'rec-1', 'user-1')
    ).rejects.toThrow('Valuation not found');
  });

  it('convertAdvisoryRecommendationToInitiative throws when recommendation missing', async () => {
    vi.mocked(DbPromise.get).mockResolvedValue({
      id: 'val-1',
      organization_id: 'org-1',
      advisory: JSON.stringify({ recommendations: [] }),
      project_id: null,
    });

    await expect(
      convertAdvisoryRecommendationToInitiative('org-1', 'val-1', 'rec-1', 'user-1')
    ).rejects.toThrow('Recommendation not found');
  });

  it('convertAdvisoryRecommendationToInitiative delegates to the Candidate handoff, never inserts an Initiative directly', async () => {
    const dbGet = vi.mocked(DbPromise.get);
    const dbRun = vi.mocked(DbPromise.run);

    dbGet.mockResolvedValue({
      id: 'val-1',
      organization_id: 'org-1',
      project_id: 'proj-1',
      advisory: JSON.stringify({
        recommendations: [
          {
            id: 'rec-1',
            title: 'Improve reporting cadence',
            hypothesis: 'Better governance',
            mechanism: 'Lower risk perception',
          },
        ],
      }),
    });
    mockConfirmValuationRecommendationCandidateHandoff.mockResolvedValue({
      created: true,
      candidateId: 'cand-uuid-0001',
    });

    const result = await convertAdvisoryRecommendationToInitiative(
      'org-1',
      'val-1',
      'rec-1',
      'user-1'
    );

    expect(result).toEqual({ created: true, candidateId: 'cand-uuid-0001' });
    expect(mockConfirmValuationRecommendationCandidateHandoff).toHaveBeenCalledWith({
      organizationId: 'org-1',
      recommendationId: 'rec-1',
      createdBy: 'user-1',
    });
    // FIN-06 mandate: this path must never touch `initiatives` directly.
    expect(dbRun).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO initiatives'),
      expect.anything()
    );
    expect(vi.mocked(audit.log)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.valuation_advisory_recommendation_converted',
        resourceType: 'initiative_candidate',
        resourceId: 'cand-uuid-0001',
      })
    );
  });

  it('listValuations normalizes status and maps fields', async () => {
    vi.mocked(DbPromise.all).mockResolvedValue([
      {
        id: 'val-a',
        title: 'A',
        description: null,
        status: 'approved',
        source_type: 'manual',
        source_id: null,
        horizon_years: 5,
        currency: 'PLN',
        approved_at: '2024-01-01',
        updated_at: '2024-01-02',
      },
      {
        id: 'val-b',
        title: 'B',
        description: 'd',
        status: 'unknown',
        source_type: 'budget',
        source_id: 'b-1',
        horizon_years: 7,
        currency: 'USD',
        approved_at: null,
        updated_at: '2024-01-03',
      },
    ]);

    const rows = await listValuations('org-1');

    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe('APPROVED');
    expect(rows[1].status).toBe('DRAFT');
    expect(rows[0]).toMatchObject({
      id: 'val-a',
      sourceType: 'manual',
      sourceId: null,
      horizonYears: 5,
      currency: 'PLN',
    });
  });
});
