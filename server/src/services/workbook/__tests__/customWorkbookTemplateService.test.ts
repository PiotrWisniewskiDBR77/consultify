import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOneMock = vi.fn();
const queryAllMock = vi.fn();
vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  queryAll: (...args: unknown[]) => queryAllMock(...args),
}));

import {
  convertCustomTemplateSnapshot,
  CustomWorkbookTemplateInvalidError,
  listCustomWorkbookTemplates,
  resolveCustomWorkbookTemplate,
} from '../customWorkbookTemplateService.js';

describe('customWorkbookTemplateService', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    queryAllMock.mockReset();
  });

  it('lists system, organization and owned private templates without cross-tenant access', async () => {
    queryAllMock.mockResolvedValue([{ id: 'tpl-1', name: 'Visible', description: null }]);
    await expect(listCustomWorkbookTemplates('org-1', 'user-1')).resolves.toEqual([
      { id: 'tpl-1', name: 'Visible', description: null },
    ]);
    const [sql, params] = queryAllMock.mock.calls[0];
    expect(sql).toContain('organization_id = ?');
    expect(sql).toContain('created_by IS NULL');
    expect(sql).toContain("visibility = 'private' AND created_by = ?");
    expect(sql).toContain("status <> 'deprecated'");
    expect(params).toEqual(['org-1', 'user-1']);
  });

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

  it('converts seeded fields and consulting tables fields into workbook columns', () => {
    const seeded = convertCustomTemplateSnapshot(
      {
        fields: [
          { name: 'KPI', type: 'text' },
          { name: 'Wynik', type: 'number' },
          { name: 'Trend', type: 'singleSelect', options: ['Wzrost', 'Stabilny', 'Spadek'] },
        ],
      },
      'Dashboard KPI',
      null
    );
    expect(seeded.sheets[0].columns.map((column) => column.type)).toEqual([
      'text',
      'number',
      'text',
    ]);
    expect(seeded.sheets[0].columns[2].validation?.values).toEqual([
      'Wzrost',
      'Stabilny',
      'Spadek',
    ]);

    const consulting = convertCustomTemplateSnapshot(
      {
        tables: [
          {
            name: 'Risks',
            fields: [
              { name: 'Risk', fieldType: 'singleLineText' },
              {
                name: 'Status',
                fieldType: 'singleSelect',
                options: { choices: [{ name: 'Open' }, { name: 'Closed' }] },
              },
            ],
          },
        ],
      },
      'Risk Register',
      null
    );
    expect(consulting.sheets[0].name).toBe('Risks');
    expect(consulting.sheets[0].columns[1].validation?.values).toEqual(['Open', 'Closed']);
  });

  it('resolves a visible system, org or owned private template', async () => {
    queryOneMock.mockResolvedValue({
      id: 'tpl-1',
      name: 'Owned template',
      description: null,
      schema_snapshot: { columns: [{ name: 'Name', type: 'text' }] },
    });
    const result = await resolveCustomWorkbookTemplate('tpl-1', 'org-1', 'user-1');
    expect(result?.id).toBe('tpl-1');
    const [sql, params] = queryOneMock.mock.calls[0];
    expect(sql).toContain('organization_id = ?');
    expect(sql).toContain('created_by IS NULL');
    expect(sql).toContain("visibility = 'private' AND created_by = ?");
    expect(params).toEqual(['tpl-1', 'org-1', 'user-1']);
  });
});
