import { describe, expect, it } from 'vitest';

import {
  __contentBlockToDocumentBlockForTests,
  buildDocumentSchema,
} from '../documentContentGenerator.js';

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

  it('retains a deterministic post-generation assumption even when sources are attached', () => {
    const block = __contentBlockToDocumentBlockForTests(
      {
        blockId: 'scrubbed',
        type: 'text',
        content: { text: 'Treść usunięta — niepoparte twierdzenie.' },
        isAssumption: true,
      },
      'paragraph',
      true
    );
    expect(block).toMatchObject({ type: 'paragraph', isAssumption: true });
  });

  it('builds a sourced deterministic fallback without referencing a premium block', () => {
    const schema = buildDocumentSchema({
      artifactId: 'artifact-grounding-fallback',
      intake: {
        title: 'Raport',
        description: 'Opis raportu',
        documentType: 'board_report',
        language: 'pl',
        density: 'standard',
        goal: 'inform',
        audience: ['Zarząd'],
      },
      outline: {
        title: 'Raport',
        sections: [{ title: 'Status programu', level: 1, purpose: 'Status' }],
      },
      sourceRefs: [{ sourceId: 'source-1', sourceType: 'organization', title: 'DBR77' }],
    });

    expect(schema.sections[0]?.blocks[0]?.isAssumption).toBe(false);
  });
});
