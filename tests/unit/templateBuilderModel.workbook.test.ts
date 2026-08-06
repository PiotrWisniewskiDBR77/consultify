import { describe, expect, it } from 'vitest';

import {
  draftToPostBody,
  emptyDraft,
  newSheetColumn,
  newWorkbookSheet,
} from '../../src/components/TemplateBuilder/templateBuilderModel';

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
});
