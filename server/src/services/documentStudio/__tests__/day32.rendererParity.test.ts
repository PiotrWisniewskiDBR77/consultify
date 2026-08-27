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

const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function makeRichLegacySchema(
  id: string,
  options: {
    language: 'pl' | 'en';
    coverPage: boolean;
    toc: boolean;
    footer: boolean;
    appendixStyle: 'lettered' | 'numbered';
    register: 'executive' | 'professional' | 'technical';
    languageStyle: 'consulting' | 'legal';
  }
): DocumentSchema {
  const sourceRef = {
    sourceType: 'evidence_pack',
    sourceId: `${id}-source`,
    sourceTitle: `Evidence ${id}`,
  };
  return {
    documentId: `${id}-document`,
    artifactId: `${id}-artifact`,
    title: `Rich legacy ${id}`,
    documentType: 'board_report',
    language: options.language,
    audience: ['Board', 'Legal'],
    goal: 'approve',
    communicationRegister: options.register,
    density: 'detailed',
    languageStyle: options.languageStyle,
    confidentiality: 'restricted',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display', mono: 'Aptos Mono' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true, content: `Header ${id}` },
      footers: {
        enabled: options.footer,
        pageNumbering: options.footer,
        confidentialityLabel: options.footer,
        content: options.footer ? `Footer ${id}` : undefined,
      },
      toc: options.toc,
      tocConfig: { enabled: options.toc, maxDepth: 3, nativeField: options.toc },
      coverPage: options.coverPage,
      coverPageDetailed: { enabled: options.coverPage, includeStatus: true },
      appendixStyle: options.appendixStyle,
      citationStyle: 'footnote',
    },
    sections: [
      {
        sectionId: `${id}-body`,
        orderIndex: 0,
        level: 1,
        title: 'Rich renderer contract',
        sourceRefs: [sourceRef],
        blocks: [
          { blockId: `${id}-heading`, type: 'heading', content: { level: 2, text: 'Evidence' } },
          {
            blockId: `${id}-paragraph`,
            type: 'paragraph',
            content: { text: 'Byte-stable paragraph.' },
            sourceRef,
          },
          {
            blockId: `${id}-table`,
            type: 'table',
            content: {
              headers: Array.from({ length: 11 }, (_, index) => `Column ${index + 1}`),
              rows: [Array.from({ length: 11 }, (_, index) => `Value ${index + 1}`)],
              caption: 'Wide legacy table',
            },
          },
          { blockId: `${id}-bullets`, type: 'bullet_list', content: { items: ['Alpha', 'Beta'] } },
          {
            blockId: `${id}-numbers`,
            type: 'numbered_list',
            content: { items: ['First', 'Second'] },
          },
          {
            blockId: `${id}-callout`,
            type: 'callout',
            content: { title: 'Decision', body: 'Approve.', tone: 'info' },
          },
          { blockId: `${id}-quote`, type: 'quote', content: { text: 'Stable quote.' } },
          {
            blockId: `${id}-image`,
            type: 'image',
            content: {
              caption: 'Evidence image',
              alt: 'One pixel',
              dataBase64: PIXEL_PNG,
              mimeType: 'image/png',
              widthCm: 2,
            },
          },
        ],
      },
      {
        sectionId: `${id}-appendix`,
        orderIndex: 1,
        level: 1,
        title: 'Appendix evidence',
        kind: 'appendix',
        sourceRefs: [sourceRef],
        blocks: [
          { blockId: `${id}-appendix-p`, type: 'paragraph', content: { text: 'Appendix.' } },
        ],
      },
    ],
    sourceRefs: [sourceRef],
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  };
}

const RICH_LEGACY_SCHEMAS = [
  makeRichLegacySchema('day34-rich-pl', {
    language: 'pl',
    coverPage: true,
    toc: true,
    footer: true,
    appendixStyle: 'lettered',
    register: 'executive',
    languageStyle: 'consulting',
  }),
  makeRichLegacySchema('day34-rich-en', {
    language: 'en',
    coverPage: false,
    toc: false,
    footer: false,
    appendixStyle: 'numbered',
    register: 'professional',
    languageStyle: 'legal',
  }),
  makeRichLegacySchema('day34-rich-technical', {
    language: 'en',
    coverPage: true,
    toc: true,
    footer: true,
    appendixStyle: 'numbered',
    register: 'technical',
    languageStyle: 'legal',
  }),
] as const;

async function extractRichStableXml(schema: DocumentSchema): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await renderDocumentSchemaToDocxBuffer(schema));
  const parts = Object.fromEntries(
    await Promise.all(
      ['document', 'styles', 'numbering'].map(async (part) => [
        part,
        await zip.file(`word/${part}.xml`)?.async('string'),
      ])
    )
  );
  if (!parts.document || !parts.styles || !parts.numbering) {
    throw new Error('DOCX package is missing required legacy parity XML parts');
  }
  return parts as Record<string, string>;
}

describe('Day 32 — legacy DOCX renderer parity', () => {
  it('keeps document.xml and styles.xml byte-identical without the DRD profile', async () => {
    const { documentXml, stylesXml } = await extractStableXml();
    await expect(documentXml).toMatchFileSnapshot('./fixtures/day32.legacy.document.xml');
    await expect(stylesXml).toMatchFileSnapshot('./fixtures/day32.legacy.styles.xml');
  });

  it.each(RICH_LEGACY_SCHEMAS)('pins three XML parts for $documentId', async (schema) => {
    const parts = await extractRichStableXml(schema);
    const fixturePrefix = schema.documentId.replace(/-document$/, '');
    for (const part of ['document', 'styles', 'numbering']) {
      await expect(parts[part]).toMatchFileSnapshot(`./fixtures/${fixturePrefix}.${part}.xml`);
    }
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
