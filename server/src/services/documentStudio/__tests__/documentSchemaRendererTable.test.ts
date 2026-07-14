import { describe, expect, it } from 'vitest';

import { renderSchemaToMarkdown } from '../documentSchemaRenderer.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

/**
 * Regression for the demo 2026-06-28 crash `[DeliverablesGen:doc] ... row.join
 * is not a function`. The premium content generator emits tables in the keyed
 * shape (`rows: [{ cells: { col: { value } } }]`), but the markdown renderer
 * assumed the legacy array-of-arrays shape and called `row.join`, throwing and
 * dropping the whole document to English stub prose. The renderer must accept
 * BOTH shapes without throwing.
 */
function schemaWith(blockContent: unknown, blockType = 'table'): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'art-1',
    title: 'Test Doc',
    documentType: 'report',
    language: 'pl',
    audience: ['Zarząd'],
    sections: [
      {
        sectionId: 's1',
        orderIndex: 0,
        level: 1,
        title: 'Ryzyka',
        blocks: [{ blockId: 'b1', type: blockType, content: blockContent }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
  } as unknown as DocumentSchema;
}

describe('documentSchemaRenderer — table block shapes', () => {
  it('renders the premium keyed-cells shape without throwing', () => {
    const content = {
      rows: [
        {
          cells: {
            risk: { value: 'Brak sponsora' },
            likelihood: { value: 'High' },
            mitigation: { value: 'Powołać komitet' },
          },
        },
        {
          cells: {
            risk: { value: 'Opór zespołu' },
            likelihood: { value: 'Medium' },
            mitigation: { value: 'Program szkoleń' },
          },
        },
      ],
    };
    let md = '';
    expect(() => {
      md = renderSchemaToMarkdown(schemaWith(content));
    }).not.toThrow();
    // Header derived + humanized from cell keys.
    expect(md).toContain('| Risk | Likelihood | Mitigation |');
    expect(md).toContain('| Brak sponsora | High | Powołać komitet |');
    expect(md).toContain('| Opór zespołu | Medium | Program szkoleń |');
  });

  it('still renders the legacy array-of-arrays shape', () => {
    const content = {
      columns: ['Risk', 'Likelihood'],
      rows: [
        ['Risk 1', 'Medium'],
        ['Risk 2', 'Low'],
      ],
    };
    const md = renderSchemaToMarkdown(schemaWith(content, 'risk_table'));
    expect(md).toContain('| Risk | Likelihood |');
    expect(md).toContain('| Risk 1 | Medium |');
    expect(md).toContain('| Risk 2 | Low |');
  });

  it('coerces non-string scalar cells and pads ragged rows', () => {
    const content = {
      columns: ['Metric', 'Q1', 'Q2'],
      rows: [
        ['Revenue', 100, 200],
        ['Cost'], // ragged — must pad to column width, not crash
      ],
    };
    const md = renderSchemaToMarkdown(schemaWith(content, 'kpi_strip'));
    expect(md).toContain('| Revenue | 100 | 200 |');
    expect(md).toContain('| Cost |  |  |');
  });

  it('escapes pipe characters inside cell values so the GFM table stays valid', () => {
    const content = { columns: ['A'], rows: [['x | y']] };
    const md = renderSchemaToMarkdown(schemaWith(content));
    expect(md).toContain('| x / y |');
  });
});
