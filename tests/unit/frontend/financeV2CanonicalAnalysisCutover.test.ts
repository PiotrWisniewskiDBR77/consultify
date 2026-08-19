import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
  v8Patch: vi.fn(),
  v8Delete: vi.fn(),
  v8PostMultipart: vi.fn(),
}));

vi.mock('@/services/api/baseClient', () => ({
  fetchWithRetry: vi.fn(),
  getHeaders: vi.fn(() => ({ Authorization: 'Bearer test' })),
  handleResponse: vi.fn(async () => ({ success: true, status: 'approved' })),
}));

import {
  approveCanonicalFinancialAnalysis,
  runCanonicalFinancialAnalysis,
} from '@/services/api/financeV2.api';
import { fetchWithRetry } from '@/services/api/baseClient';
import { v8Get, v8Post } from '@/services/api/v8/client';

const artifact = {
  artifactId: 'artifact-1',
  artifactType: 'HISTORICAL_ANALYSIS',
  naturalKey: null,
  createdAt: '2026-08-19T00:00:00Z',
  archivedAt: null,
  archivedReason: null,
  currentBusinessVersion: {
    businessVersionId: 'bv-1',
    versionNo: 1,
    version: 7,
    status: 'IN_REVIEW',
    freshness: 'CURRENT',
    freshnessReason: null,
    riskTier: 'STANDARD',
  },
};

const version = {
  businessVersionId: 'bv-1',
  artifactId: 'artifact-1',
  versionNo: 1,
  version: 7,
  status: 'IN_REVIEW',
  freshness: 'CURRENT',
  sourceWorkingRevisionId: 'wr-1',
};

let currentStatus = 'IN_REVIEW';

describe('Finance v2 canonical financial-analysis cutover adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    currentStatus = 'IN_REVIEW';
    vi.mocked(v8Get).mockImplementation(async (path: string) => {
      if (path.includes('/resolve-legacy/financial_analyses/')) {
        return {
          status: 'RESOLVED',
          artifactId: 'artifact-1',
          businessVersionId: 'bv-1',
          artifactType: 'HISTORICAL_ANALYSIS',
          mappingConfidence: 'AUTO_MIGRATE',
        } as any;
      }
      if (path === '/finance-v2/artifacts/artifact-1') {
        return {
          ...artifact,
          currentBusinessVersion: { ...artifact.currentBusinessVersion!, status: currentStatus },
        } as any;
      }
      if (path === '/finance-v2/versions/bv-1') return { ...version, status: currentStatus } as any;
      throw new Error(`Unexpected GET ${path}`);
    });
    vi.mocked(v8Post).mockResolvedValue({ results: [], readiness: null } as any);
    vi.mocked(fetchWithRetry).mockImplementation(async () => {
      currentStatus = 'APPROVED';
      return {} as any;
    });
  });

  it('runs against the exact current BV/working revision and server version', async () => {
    currentStatus = 'DRAFT';
    await runCanonicalFinancialAnalysis('legacy-analysis-1');

    expect(v8Post).toHaveBeenCalledWith('/finance-v2/analysis/bv-1/compute', {
      attemptReadinessTransition: true,
      expectedVersion: 7,
    });
  });

  it('reuses the approval intent key after an uncertain response', async () => {
    vi.mocked(fetchWithRetry)
      .mockRejectedValueOnce(new Error('transport response lost'))
      .mockImplementationOnce(async () => {
        currentStatus = 'APPROVED';
        return {} as any;
      });

    await expect(approveCanonicalFinancialAnalysis('legacy-analysis-retry')).rejects.toThrow(
      'transport response lost'
    );
    await approveCanonicalFinancialAnalysis('legacy-analysis-retry');

    const firstHeaders = vi.mocked(fetchWithRetry).mock.calls[0]![1]!.headers as Record<string, string>;
    const retryHeaders = vi.mocked(fetchWithRetry).mock.calls[1]![1]!.headers as Record<string, string>;
    expect(firstHeaders['Idempotency-Key']).toBeTruthy();
    expect(retryHeaders['Idempotency-Key']).toBe(firstHeaders['Idempotency-Key']);
  });

  it('approves the resolved artifact with the server version and no legacy call', async () => {
    await approveCanonicalFinancialAnalysis('legacy-analysis-1');

    expect(fetchWithRetry).toHaveBeenCalledWith(
      '/api/v8/finance-v2/models/artifact-1/approve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ expectedVersion: 7 }),
      })
    );
  });

  it('fails closed when the alias does not point to the current working revision', async () => {
    vi.mocked(v8Get).mockImplementation(async (path: string) => {
      if (path.includes('/resolve-legacy/financial_analyses/')) {
        return { status: 'RESOLVED', artifactId: 'artifact-1', businessVersionId: 'bv-1' } as any;
      }
      if (path === '/finance-v2/artifacts/artifact-1') return artifact as any;
      if (path === '/finance-v2/versions/bv-1') {
        return { ...version, sourceWorkingRevisionId: null } as any;
      }
      throw new Error(`Unexpected GET ${path}`);
    });

    await expect(runCanonicalFinancialAnalysis('legacy-analysis-1')).rejects.toMatchObject({
      code: 'CANONICAL_SOURCE_IDENTITY_STALE',
    });
    expect(v8Post).not.toHaveBeenCalled();
  });
});
