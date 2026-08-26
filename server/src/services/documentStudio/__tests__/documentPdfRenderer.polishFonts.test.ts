/**
 * DEC-132/133 smoke test — real Document Studio PDF renderer call, Polish text.
 *
 * Companion to `documentPdfRendererParity.test.ts` (which covers structural
 * parity with DOCX). This file is narrowly about the font fix: calling the
 * ACTUAL renderer used by `documentStudio/document-pdf` export routes with
 * Polish-language section content, and confirming (a) it does not throw and
 * (b) the rendered text contains the diacritics byte-for-byte, not garbage.
 */

import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToPdfBuffer } from '../documentPdfRenderer.js';
import type { DocumentSchema, DocumentSection, FormattingSchema } from '../documentStudioTypes.js';

function makeFormattingSchema(overrides: Partial<FormattingSchema> = {}): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
    ...overrides,
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return String(result.text ?? '');
}

describe('documentPdfRenderer — DEC-132/133 Polish diacritics smoke test', () => {
  it('renders a real document schema with Polish body copy without mangling diacritics', async () => {
    const section: DocumentSection = {
      sectionId: 'sec-pl',
      orderIndex: 0,
      level: 1,
      title: 'Podsumowanie zarządcze',
      blocks: [
        {
          blockId: 'b1',
          kind: 'paragraph',
          content: {
            text: 'Zażółć gęślą jaźń. Rekomendujemy wdrożenie ścieżki naprawczej w Łodzi.',
          },
        } as unknown as DocumentSection['blocks'][number],
        {
          blockId: 'b2',
          kind: 'heading',
          content: { text: 'Ryzyka i wnioski' } as unknown,
          level: 2,
        } as unknown as DocumentSection['blocks'][number],
      ],
      sourceRefs: [],
    };

    const schema: DocumentSchema = {
      documentId: 'doc-pl-1',
      artifactId: 'art-pl-1',
      title: 'Raport dla klienta — ŁÓDŹ ŚĆŃ ąęłńóśźż',
      documentType: 'executive_memo',
      language: 'pl',
      audience: ['Zarząd'],
      goal: 'inform',
      communicationRegister: 'professional',
      density: 'standard',
      languageStyle: 'consulting',
      confidentiality: 'internal',
      formattingSchema: makeFormattingSchema(),
      sections: [section],
      sourceRefs: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    expect(buffer.slice(0, 5).toString('utf8')).toBe('%PDF-');

    const text = await extractPdfText(buffer);
    expect(text).toContain('Raport dla klienta — ŁÓDŹ ŚĆŃ ąęłńóśźż');
    expect(text).toContain('Podsumowanie zarządcze');
    expect(text).toContain('Zażółć gęślą jaźń');
    expect(text).toContain('ścieżki naprawczej w Łodzi');
  });
});
