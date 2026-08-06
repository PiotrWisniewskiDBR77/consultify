import { describe, expect, it } from 'vitest';

import { __contentBlockToDocumentBlockForTests } from '../documentContentGenerator.js';

describe('premium document grounding and canonical shapes — DOC-DBR77-20260806-ALFA', () => {
  it('preserves risk_table identity and marks ungrounded premium content as an assumption', () => {
    const block = __contentBlockToDocumentBlockForTests(
      {
        blockId: 'generated-risk',
        type: 'table',
        content: {
          columns: ['Ryzyko', 'Wpływ', 'Mitygacja'],
          rows: [['Brak danych', 'Wysoki', 'Walidacja']],
        },
      },
      'risk_table',
      false
    );

    expect(block).toMatchObject({
      type: 'risk_table',
      isAssumption: true,
      content: {
        columns: ['Ryzyko', 'Wpływ', 'Mitygacja'],
        rows: [['Brak danych', 'Wysoki', 'Walidacja']],
      },
    });
  });

  it('does not label premium content as an assumption when an actual source pack is attached', () => {
    const block = __contentBlockToDocumentBlockForTests(
      {
        blockId: 'grounded-kpi',
        type: 'kpi',
        content: { items: [{ label: 'Postęp', value: '72%' }] },
      },
      'kpi_strip',
      true
    );
    expect(block).toMatchObject({ type: 'kpi_strip', isAssumption: false });
  });
});
