import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOneMock = vi.fn();
vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
}));

import {
  convertCustomTemplateSnapshot,
  CustomWorkbookTemplateInvalidError,
  resolveCustomWorkbookTemplate,
} from '../customWorkbookTemplateService.js';

describe('customWorkbookTemplateService', () => {
  beforeEach(() => queryOneMock.mockReset());

  it('converts the legacy TemplateBuilder columns snapshot, including formulas', () => {
    const schema = convertCustomTemplateSnapshot(
      {
        columns: [
          { name: 'Budget', type: 'currency', numberFormat: '#,##0.00' },
          { name: 'Variance', type: 'formula', formula: '=A2*0.1' },
        ],
      },
      'Portfolio Transformation Control',
      null
    );
    expect(schema.sheets).toHaveLength(1);
    expect(schema.sheets[0].columns[1].type).toBe('number');
    expect(schema.sheets[0].rows[0].cells.B.formula).toBe('A2*0.1');
  });

  it('rejects an incompatible snapshot with actionable validation detail', () => {
    expect(() => convertCustomTemplateSnapshot({ sheets: [] }, 'Broken', null)).toThrow(
      CustomWorkbookTemplateInvalidError
    );
  });

  it('resolves only an owned, user-created template', async () => {
    queryOneMock.mockResolvedValue({
      id: 'tpl-1',
      name: 'Owned template',
      description: null,
      schema_snapshot: { columns: [{ name: 'Name', type: 'text' }] },
    });
    const result = await resolveCustomWorkbookTemplate('tpl-1', 'org-1');
    expect(result?.id).toBe('tpl-1');
    const [sql, params] = queryOneMock.mock.calls[0];
    expect(sql).toContain('organization_id = ?');
    expect(sql).toContain('created_by IS NOT NULL');
    expect(params).toEqual(['tpl-1', 'org-1']);
  });
});
