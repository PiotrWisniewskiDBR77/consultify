import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: vi.fn(async () => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })),
}));

describe('ReportEnterpriseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepting AI proposal applies content to report_builder_sections', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'proposal-1',
        report_id: 'report-1',
        section_id: 'section-1',
        proposed_content: 'Updated report text',
      })
      .mockResolvedValueOnce({
        id: 'section-1',
        section_key: 'exec-summary',
        content_format: 'markdown',
      });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { reportEnterpriseService } = await import(
      '../../../../server/src/services/reportEnterpriseService.js'
    );
    const result = await reportEnterpriseService.resolveAIProposal(
      'org-1',
      'proposal-1',
      'user-1',
      'accept'
    );

    expect(result).toEqual({ ok: true, appliedSectionId: 'section-1' });
    expect(mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('UPDATE report_builder_sections'))).toBe(true);
    expect(mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('UPDATE report_ai_proposals SET status = \'accepted\''))).toBe(true);
  });

  it('returns target_not_found when proposal section cannot be resolved', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'proposal-1',
        report_id: 'report-1',
        section_id: 'missing-section',
        proposed_content: 'Updated report text',
      })
      .mockResolvedValueOnce(null);

    const { reportEnterpriseService } = await import(
      '../../../../server/src/services/reportEnterpriseService.js'
    );
    const result = await reportEnterpriseService.resolveAIProposal(
      'org-1',
      'proposal-1',
      'user-1',
      'accept'
    );

    expect(result).toEqual({ ok: false, reason: 'target_not_found' });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('scopes source pack item reads to the current organization', async () => {
    mockQueryAll.mockResolvedValue([]);

    const { reportEnterpriseService } = await import(
      '../../../../server/src/services/reportEnterpriseService.js'
    );
    await reportEnterpriseService.getSourcePackItems('org-1', 'pack-1');

    expect(mockQueryAll).toHaveBeenCalledWith(
      expect.stringContaining('packs.organization_id = ?'),
      ['pack-1', 'org-1']
    );
  });
});
