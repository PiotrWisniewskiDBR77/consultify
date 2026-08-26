import { beforeEach, describe, expect, it, vi } from 'vitest';

const getReportByIdForOrganization = vi.fn();

vi.mock('../../repositories/ManagementReportRepository.js', () => ({
  default: { getReportByIdForOrganization },
}));
vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));
vi.mock('exceljs', () => {
  throw new Error('day17 simulated missing exceljs');
});

describe('Day 17 X.2 XLSX dependency contract', () => {
  beforeEach(() => {
    getReportByIdForOrganization.mockReset().mockResolvedValue({
      id: 'report-a',
      organization_id: 'org-a',
      report_type: 'TEAM_MEETING',
      scope: 'PORTFOLIO',
      title: 'Report A',
      content: {},
    });
  });

  it('fails explicitly when exceljs cannot be loaded', async () => {
    const { default: service } = await import('../managementReportsService.js');

    await expect(
      service.generateExport('report-a', 'xlsx', 'user-a', 'org-a')
    ).rejects.toMatchObject({
      code: 'DEPENDENCY_MISSING',
      dependency: 'exceljs',
      status: 503,
    });
  });
});
