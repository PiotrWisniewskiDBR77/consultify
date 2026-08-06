import { describe, expect, it } from 'vitest';

import {
  draftToPostBody,
  emptyDraft,
  newSheetColumn,
  newWorkbookSheet,
  validateTemplateDraft,
} from '../../src/components/TemplateBuilder/templateBuilderModel';
import { recordToDraft } from '../../src/components/TemplateBuilder/templateBuilderApi';

describe('TemplateBuilder workbook payload', () => {
  it('serializes a complete multi-sheet WorkbookSchema snapshot', () => {
    const draft = emptyDraft('table', 'Plan operacyjny', 'org');
    draft.description = 'Plan i realizacja';
    draft.table[0].name = 'Plan';
    draft.table[0].columns[0] = {
      ...draft.table[0].columns[0],
      name: 'Kategoria',
      starterValue: 'Sprzedaż',
      validation: { type: 'list', values: 'Sprzedaż, Koszty', min: '', max: '' },
    };
    const amount = newSheetColumn();
    Object.assign(amount, {
      name: 'Kwota',
      type: 'currency',
      starterValue: '1250,50',
      numberFormat: '#,##0.00 "PLN"',
      validation: { type: 'decimal', values: '', min: '0', max: '1000000' },
    });
    draft.table[0].columns.push(amount);

    const summary = newWorkbookSheet('Podsumowanie');
    summary.columns[0] = {
      ...summary.columns[0],
      name: 'Razem',
      type: 'formula',
      formula: '=SUM(Plan!B2:B100)',
    };
    draft.table.push(summary);

    expect(draftToPostBody(draft)).toMatchObject({
      type: 'table',
      meta: {
        schema_snapshot: {
          title: 'Plan operacyjny',
          description: 'Plan i realizacja',
          sheets: [
            {
              name: 'Plan',
              columns: [
                {
                  key: 'A',
                  header: 'Kategoria',
                  type: 'text',
                  validation: { type: 'list', values: ['Sprzedaż', 'Koszty'] },
                },
                {
                  key: 'B',
                  header: 'Kwota',
                  type: 'currency',
                  numberFormat: '#,##0.00 "PLN"',
                  validation: { type: 'decimal', min: 0, max: 1000000 },
                },
              ],
              rows: [{ cells: { A: { value: 'Sprzedaż' }, B: { value: 1250.5 } } }],
            },
            {
              name: 'Podsumowanie',
              columns: [{ key: 'A', header: 'Razem', type: 'number' }],
              rows: [{ cells: { A: { formula: 'SUM(Plan!B2:B100)' } } }],
            },
          ],
        },
      },
    });
  });

  it('hydrates a persisted workbook and preserves formulas, values and validation', () => {
    const draft = recordToDraft({
      id: 'tpl-1',
      type: 'table',
      name: 'Budget',
      description: 'FY plan',
      isSystem: false,
      organizationId: 'org-1',
      meta: {
        scope: 'private',
        theme_ref: 'brand-navy',
        schema_snapshot: {
          sheets: [
            {
              name: 'Plan',
              columns: [
                {
                  key: 'A',
                  header: 'Owner',
                  type: 'text',
                  validation: { type: 'list', values: ['Ops', 'Sales'] },
                },
                { key: 'B', header: 'Total', type: 'number', numberFormat: '#,##0' },
              ],
              rows: [{ cells: { A: { value: 'Ops' }, B: { formula: 'SUM(C2:C4)' } } }],
            },
          ],
        },
      },
    });

    expect(draft).toMatchObject({
      name: 'Budget',
      description: 'FY plan',
      scope: 'private',
      themeRef: 'brand-navy',
      table: [
        {
          name: 'Plan',
          columns: [
            {
              name: 'Owner',
              type: 'text',
              starterValue: 'Ops',
              validation: { type: 'list', values: 'Ops, Sales' },
            },
            { name: 'Total', type: 'formula', formula: '=SUM(C2:C4)', numberFormat: '#,##0' },
          ],
        },
      ],
    });
  });

  it('blocks duplicate columns and incomplete formula/list rules before publish', () => {
    const draft = emptyDraft('table', 'Controlled workbook', 'org');
    draft.table[0].columns[0].name = 'Owner';
    const duplicate = newSheetColumn();
    duplicate.name = 'owner';
    duplicate.type = 'formula';
    duplicate.validation = { type: 'list', values: '', min: '', max: '' };
    draft.table[0].columns.push(duplicate);

    const result = validateTemplateDraft(draft);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('powtórzona');
    expect(result.errors.join(' ')).toContain('wymaga formuły');
    expect(result.errors.join(' ')).toContain('nie ma wartości');
  });
});
