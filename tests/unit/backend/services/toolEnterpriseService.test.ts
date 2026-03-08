import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

describe('ToolEnterpriseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits template reads to system/global/current organization rows', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'tpl-1' });

    const { toolEnterpriseService } = await import(
      '../../../../server/src/services/toolEnterpriseService.js'
    );
    await toolEnterpriseService.getTemplate('org-1', 'tpl-1');

    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$2 OR organization_id IS NULL OR is_system=1'),
      ['tpl-1', 'org-1'],
    );
  });

  it('scopes template updates to editable rows in the same organization', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { toolEnterpriseService } = await import(
      '../../../../server/src/services/toolEnterpriseService.js'
    );
    const result = await toolEnterpriseService.updateTemplate('org-1', 'tpl-1', {
      templateName: 'Updated',
    });

    expect(result).toEqual({ ok: true });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$3 AND is_system=0'),
      ['Updated', 'tpl-1', 'org-1'],
    );
  });

  it('scopes knowledge entry deletion to the current organization', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { toolEnterpriseService } = await import(
      '../../../../server/src/services/toolEnterpriseService.js'
    );
    await toolEnterpriseService.deleteKnowledgeEntry('org-1', 'entry-1');

    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=$2'),
      ['entry-1', 'org-1'],
    );
  });
});
