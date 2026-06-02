/**
 * Document Studio — DOCX renderer named-styles smoke test (Epic E8, Slice 8.1).
 *
 * Renders a representative `DocumentSchema` to a real .docx buffer, then
 * unzips it and inspects `word/styles.xml` + `word/document.xml` so the
 * test fails fast if the renderer ever drops a named paragraph style or
 * stops referencing one. This is the primary contract Word's outline,
 * TOC, and accessibility tree depend on for MVP-4 advanced DOCX export.
 *
 * Tests intentionally do XML *substring* matching rather than parsing the
 * tree; the docx package is the upstream that builds the XML and we only
 * want to assert the named-style IDs survive round-trip through the
 * packer (so a docx-package upgrade or a renderer regression that drops
 * `style: 'BodyText'` would surface immediately).
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import { DOCX_STYLE_IDS } from '../documentDocxStyles.js';
import type { DocumentSchema, FormattingSchema } from '../documentStudioTypes.js';

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

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Renderer Smoke',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: makeFormattingSchema(),
    sections: [
      {
        sectionId: 'sec-summary',
        orderIndex: 0,
        level: 1,
        title: 'Executive Summary',
        purpose: 'Two-sentence recommendation.',
        blocks: [
          {
            blockId: 'blk-1',
            type: 'paragraph',
            content: { text: 'High-level recommendation in two sentences.' } as unknown,
          },
          {
            blockId: 'blk-2',
            type: 'callout',
            content: { variant: 'key_message', text: 'Decide next week.' } as unknown,
          },
          {
            blockId: 'blk-3',
            type: 'quote',
            content: {
              text: 'Without a sponsor we cannot ship.',
              attribution: 'CFO',
            } as unknown,
          },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-findings',
        orderIndex: 1,
        level: 1,
        title: 'Findings',
        blocks: [
          {
            blockId: 'blk-4',
            type: 'bullet_list',
            content: { style: 'bullet', items: ['Finding A', 'Finding B'] } as unknown,
          },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function unzipDocx(buffer: Buffer): Promise<{ document: string; styles: string }> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  if (!documentXml || !stylesXml) {
    throw new Error('docx package missing word/document.xml or word/styles.xml');
  }
  return { document: documentXml, styles: stylesXml };
}

describe('documentDocxRenderer — named styles', () => {
  it('produces a non-empty buffer with ZIP magic and Office Open XML content type', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema());
    expect(buffer.length).toBeGreaterThan(1024);
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
    expect(buffer.includes(Buffer.from('[Content_Types].xml'))).toBe(true);
  });

  it('emits every renderer-referenced named paragraph style into word/styles.xml', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema());
    const { styles } = await unzipDocx(buffer);
    for (const styleId of Object.values(DOCX_STYLE_IDS)) {
      expect(styles).toContain(`w:styleId="${styleId}"`);
    }
  });

  it('references BodyText, Heading1, BlockQuote, and Callout from word/document.xml', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.BODY_TEXT}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.HEADING1}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.BLOCK_QUOTE}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.CALLOUT}"`);
  });

  it('uses Title + Subtitle styles for the cover page when coverPage is enabled', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.TITLE}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.SUBTITLE}"`);
  });

  it('renders the legal formatting class with smaller body sizes than executive', async () => {
    const execBuffer = await renderDocumentSchemaToDocxBuffer(
      makeSchema({ communicationRegister: 'executive' })
    );
    const legalBuffer = await renderDocumentSchemaToDocxBuffer(
      makeSchema({ communicationRegister: 'professional', languageStyle: 'legal' })
    );
    const { styles: execStyles } = await unzipDocx(execBuffer);
    const { styles: legalStyles } = await unzipDocx(legalBuffer);
    // Both styles use our namespaced ids so Word does not merge them
    // with built-in defaults. Asserting on the relative ordering keeps
    // the test stable when sizes shift slightly across formatting
    // classes.
    const titlePattern = new RegExp(`w:styleId="${DOCX_STYLE_IDS.TITLE}"[^]*?w:sz w:val="(\\d+)"`);
    const titleExecSize = execStyles.match(titlePattern)?.[1];
    const titleLegalSize = legalStyles.match(titlePattern)?.[1];
    expect(Number(titleExecSize)).toBeGreaterThan(Number(titleLegalSize));
    const bodyPattern = new RegExp(
      `w:styleId="${DOCX_STYLE_IDS.BODY_TEXT}"[^]*?w:sz w:val="(\\d+)"`
    );
    const bodyExecSize = execStyles.match(bodyPattern)?.[1];
    const bodyLegalSize = legalStyles.match(bodyPattern)?.[1];
    expect(Number(bodyExecSize)).toBeGreaterThan(Number(bodyLegalSize));
  });

  it('describes the formatting class in the document description metadata', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(
      makeSchema({ communicationRegister: 'narrative' })
    );
    const zip = await JSZip.loadAsync(buffer);
    const coreProps = await zip.file('docProps/core.xml')?.async('string');
    expect(coreProps).toContain('narrative');
  });
});

describe('documentDocxRenderer — TOC + cover page break + appendices (Slice 8.2)', () => {
  it('embeds a Word TOC field when formattingSchema.toc is true', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ toc: true }),
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const document = await zip.file('word/document.xml')?.async('string');
    expect(document).toBeTruthy();
    // Word TOC fields embed an instrText element with `TOC \\o "1-3"` (or
    // similar); the docx package lowercases nothing, so a substring check
    // for `TOC ` is the most stable assertion across docx upgrades.
    expect(document).toContain('TOC ');
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.TOC_HEADING}"`);
  });

  it('omits the TOC field when formattingSchema.toc is false', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ toc: false }),
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const document = await zip.file('word/document.xml')?.async('string');
    expect(document).not.toContain('TOC ');
    expect(document).not.toContain(`w:val="${DOCX_STYLE_IDS.TOC_HEADING}"`);
  });

  it('emits a hard page break inside the cover block', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema());
    const zip = await JSZip.loadAsync(buffer);
    const document = await zip.file('word/document.xml')?.async('string');
    expect(document).toContain('w:type="page"');
  });

  it('renders body sections with Arabic numbering and appendices under the lettered scheme', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ appendixStyle: 'lettered' }),
      sections: [
        {
          sectionId: 'sec-summary',
          orderIndex: 0,
          level: 1,
          title: 'Executive Summary',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Body paragraph' } as unknown,
            },
          ],
          sourceRefs: [],
        },
        {
          sectionId: 'sec-glossary',
          orderIndex: 1,
          level: 1,
          title: 'Glossary',
          kind: 'appendix',
          blocks: [
            {
              blockId: 'b2',
              type: 'paragraph',
              content: { text: 'Glossary text' } as unknown,
            },
          ],
          sourceRefs: [],
        },
        {
          sectionId: 'sec-findings',
          orderIndex: 2,
          level: 1,
          title: 'Findings',
          blocks: [
            {
              blockId: 'b3',
              type: 'paragraph',
              content: { text: 'Findings text' } as unknown,
            },
          ],
          sourceRefs: [],
        },
        {
          sectionId: 'sec-sources',
          orderIndex: 3,
          level: 1,
          title: 'Sources Appendix',
          kind: 'appendix',
          blocks: [],
          sourceRefs: [],
        },
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const document = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(document).toContain('1. Executive Summary');
    expect(document).toContain('2. Findings');
    expect(document).toContain('Appendix A — Glossary');
    expect(document).toContain('Appendix B — Sources Appendix');
    // Body sections must precede appendices in document order regardless of
    // the original schema order (Glossary appeared at index 1 in the source).
    expect(document.indexOf('2. Findings')).toBeLessThan(document.indexOf('Appendix A — Glossary'));
  });

  it('numbers appendices with Arabic digits when appendixStyle is "numbered"', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ appendixStyle: 'numbered' }),
      sections: [
        {
          sectionId: 'sec-summary',
          orderIndex: 0,
          level: 1,
          title: 'Summary',
          blocks: [],
          sourceRefs: [],
        },
        {
          sectionId: 'sec-app1',
          orderIndex: 1,
          level: 1,
          title: 'Glossary',
          kind: 'appendix',
          blocks: [],
          sourceRefs: [],
        },
        {
          sectionId: 'sec-app2',
          orderIndex: 2,
          level: 1,
          title: 'Sources',
          kind: 'appendix',
          blocks: [],
          sourceRefs: [],
        },
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const document = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(document).toContain('Appendix 1 — Glossary');
    expect(document).toContain('Appendix 2 — Sources');
    expect(document).not.toContain('Appendix A —');
  });
});
