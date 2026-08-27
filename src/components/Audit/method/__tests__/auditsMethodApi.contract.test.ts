import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: { get, post },
}));

import {
  finalizeOutput,
  generateReport,
  getProgramCoverage,
  listOutputs,
  listPacks,
  listPrograms,
} from '../auditsMethodApi';

describe('auditsMethodApi canonical response contract', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('reads an array and sibling total from the canonical packs envelope', async () => {
    get.mockResolvedValue({
      data: { success: true, data: [{ id: 'pack-1' }], total: 17 },
    });

    await expect(listPacks()).resolves.toEqual({ items: [{ id: 'pack-1' }], total: 17 });
  });

  it('reads the canonical programs list result', async () => {
    get.mockResolvedValue({
      data: { success: true, data: { items: [{ id: 'program-1' }], total: 1 } },
    });

    await expect(listPrograms()).resolves.toEqual({
      items: [{ id: 'program-1' }],
      total: 1,
    });
  });

  it('maps the criterion-service coverage totals without silently rendering 0/0', async () => {
    get.mockResolvedValue({
      data: {
        success: true,
        data: {
          applicableTotal: 1,
          testedTotal: 1,
          concludedTotal: 1,
          evidenceInsufficientTotal: 0,
          conformingTotal: 0,
          nonconformingTotal: 1,
          notApplicableTotal: 0,
        },
      },
    });

    await expect(getProgramCoverage('program-1')).resolves.toMatchObject({
      applicableCriteria: 1,
      concludedCriteria: 1,
      insufficientEvidenceCriteria: 0,
    });
  });

  it('rejects coverage contract drift instead of substituting zeroes', async () => {
    get.mockResolvedValue({
      data: { success: true, data: { applicableCriteria: 1, concludedCriteria: 1 } },
    });

    await expect(getProgramCoverage('program-1')).rejects.toThrow('AUDITS_API_CONTRACT_ERROR');
  });

  it.each([
    ['missing success', { data: { data: [] } }],
    ['unsuccessful envelope', { data: { success: false, data: [] } }],
    ['missing data', { data: { success: true } }],
    ['wrong list shape', { data: { success: true, data: { records: [] } } }],
  ])(
    'rejects malformed 200 instead of rendering a false empty state: %s',
    async (_label, response) => {
      get.mockResolvedValue(response);

      await expect(listOutputs()).rejects.toThrow('AUDITS_API_CONTRACT_ERROR');
    }
  );
});

describe('auditsMethodApi report-chain commands', () => {
  beforeEach(() => post.mockReset());

  it('finalizes an Output through the canonical endpoint and returns its id', async () => {
    post.mockResolvedValue({ data: { success: true, data: { id: 'out-1', version: 1 } } });
    await expect(finalizeOutput('program-1', 'Final output')).resolves.toMatchObject({
      id: 'out-1',
    });
    expect(post).toHaveBeenCalledWith('/audits/outputs/finalize', {
      programId: 'program-1',
      title: 'Final output',
    });
  });

  it('rejects a malformed finalize envelope', async () => {
    post.mockResolvedValue({ data: { data: { id: 'out-1' } } });
    await expect(finalizeOutput('program-1')).rejects.toThrow('AUDITS_API_CONTRACT_ERROR');
  });

  it('rejects a finalize response without an id', async () => {
    post.mockResolvedValue({ data: { success: true, data: { version: 1 } } });
    await expect(finalizeOutput('program-1')).rejects.toThrow('missing id');
  });

  it('generates an audit report without silently adding product fields', async () => {
    post.mockResolvedValue({ data: { success: true, data: { id: 'report-1' } } });
    await generateReport({ programId: 'program-1', outputId: 'out-1', reportKind: 'audit_report' });
    expect(post).toHaveBeenCalledWith('/audits/reports', {
      programId: 'program-1',
      outputId: 'out-1',
      reportKind: 'audit_report',
    });
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('language');
  });

  it('passes the explicit remediation snapshot date', async () => {
    post.mockResolvedValue({ data: { success: true, data: { id: 'report-2' } } });
    await generateReport({
      programId: 'program-1',
      outputId: 'out-1',
      reportKind: 'remediation_progress',
      asOfDate: '2026-08-28',
    });
    expect(post.mock.calls[0]?.[1]).toHaveProperty('asOfDate', '2026-08-28');
  });

  it('rejects a generated report response without an id', async () => {
    post.mockResolvedValue({ data: { success: true, data: { version: 1 } } });
    await expect(
      generateReport({ programId: 'program-1', outputId: 'out-1', reportKind: 'audit_report' })
    ).rejects.toThrow('missing id');
  });
});
