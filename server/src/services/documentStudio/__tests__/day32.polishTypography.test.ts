import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

function schema(language: string): DocumentSchema {
  return {
    documentId: `typography-${language}`,
    artifactId: `typography-${language}`,
    title: 'Typografia',
    documentType: 'client_final_report',
    language,
    audience: ['Klient'],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: {
      fonts: { body: 'Calibri 11', heading: 'Calibri Light' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2.2, bottom: 2, left: 2.2, right: 2.2 } },
      headers: { enabled: false },
      footers: { enabled: false, pageNumbering: false, confidentialityLabel: false },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
      colorTemplateId: 'drd-report',
    },
    sections: [
      {
        sectionId: 'typography',
        orderIndex: 0,
        level: 1,
        title: 'Zażółć gęślą jaźń',
        sourceRefs: [],
        blocks: [
          {
            blockId: 'text',
            type: 'paragraph',
            content: { text: 'A teraz i dalej, w procesie oraz z 4 dowodami, po analizie.' },
          },
        ],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  };
}

async function documentXml(language: string): Promise<string> {
  const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(schema(language)));
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('DOCX package is missing word/document.xml');
  return xml;
}

describe('Day 32 — Polish typography at the renderer seam', () => {
  it('uses NBSP after Polish one-letter words, remains idempotent, and preserves diacritics', async () => {
    const xml = await documentXml('pl-PL');
    expect(xml).toContain('A\u00a0teraz i\u00a0dalej, w\u00a0procesie oraz z\u00a04 dowodami');
    expect(xml).not.toContain('po\u00a0analizie');
    expect(xml).not.toContain('\u00a0\u00a0');
    expect(xml).toContain('Zażółć gęślą jaźń');
  });

  it('does not insert NBSP for an English schema', async () => {
    const xml = await documentXml('en-US');
    expect(xml).not.toContain('\u00a0');
    expect(xml).toContain('A teraz i dalej, w procesie oraz z 4 dowodami');
  });
});
