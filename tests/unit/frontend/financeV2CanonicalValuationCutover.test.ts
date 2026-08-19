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
  approveCanonicalValuation,
  generateCanonicalValuationAdvisor,
} from '@/services/api/financeV2.api';
import { fetchWithRetry } from '@/services/api/baseClient';
import { v8Get, v8Post } from '@/services/api/v8/client';

let currentStatus = 'IN_REVIEW';

describe('Finance v2 canonical valuation cutover adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    currentStatus = 'IN_REVIEW';
    vi.mocked(v8Get).mockImplementation(async (path: string) => {
      if (path.includes('/resolve-legacy/valuations/')) {
        return {
          status: 'RESOLVED',
          artifactId: 'valuation-artifact-1',
          businessVersionId: 'valuation-bv-1',
          artifactType: 'VALUATION_CASE',
          mappingConfidence: 'AUTO_MIGRATE',
        } as any;
      }
      if (path === '/finance-v2/artifacts/valuation-artifact-1') {
        return {
          artifactId: 'valuation-artifact-1',
          artifactType: 'VALUATION_CASE',
          currentBusinessVersion: {
            businessVersionId: 'valuation-bv-1',
            version: 4,
            status: currentStatus,
          },
        } as any;
      }
      if (path === '/finance-v2/versions/valuation-bv-1') {
        return {
          businessVersionId: 'valuation-bv-1',
          artifactId: 'valuation-artifact-1',
          version: 4,
          status: currentStatus,
        } as any;
      }
      if (path === '/finance-v2/valuation/variants/valuation-bv-1/advisor') {
        return [{ id: 'finding-1' }] as any;
      }
      throw new Error(`Unexpected GET ${path}`);
    });
    vi.mocked(v8Post).mockResolvedValue({
      computeSnapshotId: 'snapshot-1',
      findings: [{ id: 'finding-1' }],
    } as any);
    vi.mocked(fetchWithRetry).mockImplementation(async () => {
      currentStatus = 'APPROVED';
      return {} as any;
    });
  });

  it('approves the exact aliased artifact with stable retry identity and cold APPROVED readback', async () => {
    vi.mocked(fetchWithRetry)
      .mockRejectedValueOnce(new Error('response lost'))
      .mockImplementationOnce(async () => {
        currentStatus = 'APPROVED';
        return {} as any;
      });

    await expect(approveCanonicalValuation('legacy-valuation-1')).rejects.toThrow('response lost');
    await approveCanonicalValuation('legacy-valuation-1');

    const first = vi.mocked(fetchWithRetry).mock.calls[0]![1]!.headers as Record<string, string>;
    const retry = vi.mocked(fetchWithRetry).mock.calls[1]![1]!.headers as Record<string, string>;
    expect(first['Idempotency-Key']).toBeTruthy();
    expect(retry['Idempotency-Key']).toBe(first['Idempotency-Key']);
    expect(vi.mocked(fetchWithRetry).mock.calls[1]![0]).toBe(
      '/api/v8/finance-v2/models/valuation-artifact-1/approve'
    );
  });

  it('generates Advisor output for the exact aliased BV and confirms the persisted findings', async () => {
    await generateCanonicalValuationAdvisor('legacy-valuation-1');

    expect(v8Post).toHaveBeenCalledWith(
      '/finance-v2/valuation/variants/valuation-bv-1/advisor/generate',
      { persist: true }
    );
    expect(v8Get).toHaveBeenCalledWith('/finance-v2/valuation/variants/valuation-bv-1/advisor');
  });

  it('fails closed before either writer when the alias is not migrated', async () => {
    vi.mocked(v8Get).mockResolvedValueOnce({ status: 'NOT_MIGRATED' } as any);
    await expect(approveCanonicalValuation('legacy-unmapped')).rejects.toMatchObject({
      code: 'LEGACY_IDENTITY_UNMAPPED',
    });
    expect(fetchWithRetry).not.toHaveBeenCalled();
    expect(v8Post).not.toHaveBeenCalled();
  });
});
