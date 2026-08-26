import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

const LEGACY_SCHEMA: DocumentSchema = {
  documentId: 'day32-parity-document',
  artifactId: 'day32-parity-artifact',
  title: 'Legacy renderer parity',
  documentType: 'executive_memo',
  language: 'en-US',
  audience: ['Board'],
  goal: 'decide',
  communicationRegister: 'professional',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'internal',
  formattingSchema: {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
    headers: { enabled: false },
    footers: { enabled: false, pageNumbering: false, confidentialityLabel: false },
    toc: false,
    coverPage: false,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 'parity-section',
      orderIndex: 0,
      level: 1,
      title: 'Renderer contract',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'heading',
          type: 'heading',
          content: { level: 2, text: 'Named heading' },
        },
        {
          blockId: 'paragraph',
          type: 'paragraph',
          content: { text: 'A substantive paragraph used by existing consumers.' },
        },
        {
          blockId: 'table',
          type: 'table',
          content: {
            headers: ['Metric', 'Value'],
            rows: [
              ['Revenue', '100'],
              ['Cost', '60'],
              ['Margin', '40'],
            ],
          },
        },
        {
          blockId: 'list',
          type: 'bullet_list',
          content: { items: ['First decision', 'Second decision'] },
        },
        {
          blockId: 'callout',
          type: 'callout',
          content: { title: 'Decision', body: 'Proceed with the validated option.', tone: 'info' },
        },
      ],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T00:00:00.000Z',
};

async function extractStableXml(): Promise<{ documentXml: string; stylesXml: string }> {
  const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(LEGACY_SCHEMA));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  if (!documentXml || !stylesXml) throw new Error('DOCX package is missing required XML parts');

  // No normalization is applied. These two parts contain neither package
  // timestamps nor generated relationship ids for this schema, so byte-for-byte
  // XML is the strongest regression guard for legacy callers.
  return { documentXml, stylesXml };
}

describe('Day 32 — legacy DOCX renderer parity', () => {
  it('keeps document.xml and styles.xml byte-identical without the DRD profile', async () => {
    const { documentXml, stylesXml } = await extractStableXml();
    await expect(documentXml).toMatchFileSnapshot('./fixtures/day32.legacy.document.xml');
    await expect(stylesXml).toMatchFileSnapshot('./fixtures/day32.legacy.styles.xml');
  });

  it('applies the opt-in DRD named styles, table treatment, and page geometry', async () => {
    const schema = structuredClone(LEGACY_SCHEMA);
    schema.formattingSchema.colorTemplateId = 'drd-report';
    schema.formattingSchema.fonts = { body: 'Calibri 11', heading: 'Calibri Light' };
    const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(schema));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const stylesXml = await zip.file('word/styles.xml')?.async('string');
    if (!documentXml || !stylesXml) throw new Error('DOCX package is missing required XML parts');

    for (const styleId of [
      'Tresc',
      'Lead',
      'Kicker',
      'Podpis',
      'Sygnatura',
      'TOC1',
      'TOC2',
      'NaglowekBezNumeru',
      'NaglowekBezNumeru2',
    ]) {
      expect(stylesXml).toContain(`w:styleId="${styleId}"`);
    }
    expect(documentXml).toContain('w:fill="E2E9EF"');
    expect(documentXml).toContain('w:color w:val="083152"');
    expect(documentXml).not.toContain('w:fill="F3F7FB"');
    expect(documentXml).toContain(
      '<w:pgMar w:top="1247" w:right="1247" w:bottom="1134" w:left="1247" w:header="708" w:footer="624" w:gutter="0"/>'
    );
    expect(documentXml).toContain('<w:titlePg/>');
  });
});
