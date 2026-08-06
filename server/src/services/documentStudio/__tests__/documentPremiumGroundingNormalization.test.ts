import { describe, expect, it } from 'vitest';

import {
  __contentBlockToDocumentBlockForTests,
  buildDocumentSchema,
  enforceDocumentSchemaGrounding,
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

  it('EPSILON localizes nested KPI/table values and drops empty canonical/raw-json tables', () => {
    const schema = {
      documentId: 'epsilon',
      artifactId: 'epsilon',
      title: 'Raport EPSILON',
      documentType: 'board_report',
      language: 'pl',
      audience: ['Zarząd'],
      goal: 'inform',
      communicationRegister: 'executive',
      density: 'concise',
      languageStyle: 'consulting',
      confidentiality: 'internal',
      formattingSchema: {} as any,
      sourceRefs: [],
      createdAt: '',
      updatedAt: '',
      sections: [
        {
          sectionId: 's',
          orderIndex: 0,
          level: 1,
          title: 'KPI',
          purpose: '',
          sourceRefs: [],
          blocks: [
            {
              blockId: 'k',
              type: 'kpi_strip',
              content: {
                items: [
                  { label: 'Total Budget', value: '1,4 mln EUR' },
                  { label: 'Plan Realization', value: '72%' },
                  { label: 'Milestones Completed', value: '18/21' },
                ],
              },
            },
            {
              blockId: 't',
              type: 'risk_table',
              content: {
                columns: ['Risk', 'Severity'],
                rows: [
                  ['Budget overrun', 'High'],
                  ['Scope', 'Medium'],
                  ['Timing', 'Low'],
                ],
              },
            },
            { blockId: 'empty', type: 'table', content: { columns: [], rows: [] } },
            {
              blockId: 'raw',
              type: 'paragraph',
              content: { text: '{ "columns": [], "rows": [] }' },
            },
          ],
        },
      ],
    } as any;
    const result = enforceDocumentSchemaGrounding(
      schema,
      'Polski raport EPSILON. 72%, 1,4 mln EUR, 18/21. Bez DACH.'
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('DACH');
    expect(serialized).not.toContain('Total Budget');
    expect(serialized).toContain('Łączny budżet');
    expect(serialized).toContain('Realizacja planu');
    expect(serialized).toContain('Ukończone kamienie milowe');
    expect(serialized).toContain('Przekroczenie budżetu');
    expect(serialized).toContain('Wysokie');
    expect(result.sections[0].blocks.map((block: any) => block.blockId)).toEqual(['k', 't']);
  });

  it('SIGMA localizes portfolio fields and removes ungrounded initiative rows', () => {
    const schema = {
      documentId: 'sigma', artifactId: 'sigma', title: 'Raport SIGMA',
      documentType: 'board_report', language: 'pl', audience: ['Zarząd'], goal: 'inform',
      communicationRegister: 'executive', density: 'concise', languageStyle: 'consulting',
      confidentiality: 'internal', formattingSchema: {}, sourceRefs: [], createdAt: '', updatedAt: '',
      sections: [{ sectionId: 's', orderIndex: 0, level: 1, title: 'Portfel', purpose: '', sourceRefs: [], blocks: [{
        blockId: 'portfolio', type: 'table', content: {
          columns: ['initiative', 'progress', 'Status'],
          rows: [
            ['Digital Performance Management', 'Assumed', 'Offense Strategy'],
            ['Program SIGMA', '72%', 'Repair Strategy'],
          ],
        },
      }] }],
    } as any;

    const result = enforceDocumentSchemaGrounding(
      schema,
      'Polski raport. Program SIGMA ma postęp 72%.'
    );
    const table = result.sections[0].blocks[0].content as any;
    expect(table.columns).toEqual(['Inicjatywa', 'Postęp', 'Status']);
    expect(table.rows).toEqual([['Program SIGMA', '72%', 'Strategia naprawcza']]);
    expect(JSON.stringify(result)).not.toMatch(
      /initiative|progress|Assumed|Digital Performance Management|Offense Strategy|Repair Strategy/
    );
  });
});
