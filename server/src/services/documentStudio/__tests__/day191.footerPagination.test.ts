// @vitest-environment node

import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToPdfBuffer } from '../documentPdfRenderer.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

function makeSchema(): DocumentSchema {
  return {
    documentId: 'day191-footer-pagination',
    artifactId: 'day191-footer-pagination-artifact',
    title: 'Day 191 footer pagination regression',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'restricted',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: false,
      coverPage: false,
      appendixStyle: 'lettered',
      citationStyle: 'inline_marker',
    },
    sections: ['First', 'Second', 'Third'].map((title, index) => ({
      sectionId: `section-${index + 1}`,
      orderIndex: index,
      level: 1,
      title,
      blocks: [
        {
          blockId: `paragraph-${index + 1}`,
          type: 'paragraph',
          content: { text: `Short body paragraph for ${title.toLowerCase()} section.` },
        },
      ],
      sourceRefs: [],
    })),
    sourceRefs: [],
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  };
}

describe('Day 191 PDF footer pagination', () => {
  it('keeps three short sections on one page without footer-only garbage pages', async () => {
    const buffer = await renderDocumentSchemaToPdfBuffer(makeSchema());
    const parser = new PDFParse({ data: buffer });
    const info = await parser.getInfo();
    const text = await parser.getText();
    await parser.destroy();

    expect(info.total).toBe(1);
    expect(text.pages).toHaveLength(1);
    expect(text.pages[0]?.text).toContain('1. First');
    expect(text.pages[0]?.text).toContain('2. Second');
    expect(text.pages[0]?.text).toContain('3. Third');
    expect(text.pages[0]?.text).toContain('restricted');
    expect(text.pages[0]?.text).toContain('1 / 1');
  });
});
