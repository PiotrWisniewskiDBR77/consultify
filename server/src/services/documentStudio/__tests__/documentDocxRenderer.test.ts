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
  it.each([
    ['en', 'en-US'],
    ['pl', 'pl-PL'],
  ])('writes the schema language %s into inherited Word run properties', async (language, tag) => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeSchema({ language }));
    const zip = await JSZip.loadAsync(buffer);
    const stylesXml = (await zip.file('word/styles.xml')?.async('string')) || '';

    expect(stylesXml).toContain(`<w:lang w:val="${tag}"`);
    expect(stylesXml).toContain(`w:eastAsia="${tag}"`);
    expect(stylesXml).toContain(`w:bidi="${tag}"`);
  });

  it('localizes Polish system labels in cover, TOC, sources and footer', async () => {
    const schema = makeSchema({
      title: 'Raport transformacji',
      documentType: 'steering_committee_report',
      language: 'pl',
      audience: ['steering_committee'],
      density: 'detailed',
      confidentiality: 'client_confidential',
      formattingSchema: makeFormattingSchema({ toc: true }),
      sourceRefs: [],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const visibleXml = (
      await Promise.all(
        Object.values(zip.files)
          .filter((entry) => /^word\/(?:document|footer\d+)\.xml$/.test(entry.name))
          .map((entry) => entry.async('string'))
      )
    ).join('\n');

    expect(visibleXml).toContain('raport komitetu sterującego');
    expect(visibleXml).toContain('Odbiorcy: komitet sterujący');
    expect(visibleXml).toContain('Wygenerowano:');
    expect(visibleXml).toContain('Spis treści');
    expect(visibleXml).toContain('Źródła i identyfikowalność');
    expect(visibleXml).toContain('poufne — tylko dla klienta');
    expect(visibleXml).toContain('Strona ');
    expect(visibleXml).not.toContain('Page ');
    expect(visibleXml).not.toContain('Table of Contents');
    expect(visibleXml).not.toContain('Sources &amp; traceability');
  });

  it('decodes common HTML entities before writing visible DOCX text', async () => {
    const schema = makeSchema({
      sections: [
        {
          sectionId: 'entities',
          orderIndex: 0,
          level: 1,
          title: 'Entity safety',
          purpose: 'Entity safety',
          blocks: [
            {
              blockId: 'entity-paragraph',
              type: 'paragraph',
              content: {
                text: 'Decision &amp;quot;approved&amp;quot;&#58;&nbsp;owner&#x27;s action &amp; evidence &#x2713;.',
              } as unknown,
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await unzipDocx(buffer);
    expect(document).toContain(
      'Decision &quot;approved&quot;: owner&apos;s action &amp; evidence ✓.'
    );
    expect(document).not.toContain('&amp;quot;');
    expect(document).not.toContain('&amp;#x27;');
    expect(document).not.toContain('&amp;nbsp;');
  });

  it('suppresses title-equivalent purpose metadata and keeps a descriptive purpose', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ coverPage: false, toc: false }),
      sections: [
        {
          sectionId: 'decision',
          orderIndex: 0,
          level: 1,
          title: 'Executive decision',
          purpose: 'Executive decision',
          blocks: [{ blockId: 'decision-body', type: 'paragraph', content: { text: 'Defer.' } }],
          sourceRefs: [],
        },
        {
          sectionId: 'context',
          orderIndex: 1,
          level: 1,
          title: 'Decision context',
          purpose: 'Explains the decision boundary.',
          blocks: [],
          sourceRefs: [],
        },
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await unzipDocx(buffer);
    expect(document.match(/Executive decision/g) || []).toHaveLength(1);
    expect(document).toContain('Explains the decision boundary.');
  });

  it('renders a compact static TOC and source traceability details', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ coverPage: false, toc: true }),
      sourceRefs: [
        {
          sourceType: 'decision_pack',
          sourceId: 'SRC-1',
          sourceTitle: 'Board mandate',
          sourceVersion: 'v3',
          sourceSnapshotId: 'snap-3',
          sourceExcerpt: 'Approve, defer, or reject at the current decision gate.',
        },
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await unzipDocx(buffer);
    expect(document).toContain('Table of Contents');
    expect(document).toContain('1. Executive Summary');
    expect(document).toContain('decision_pack#SRC-1 — Board mandate · v3 · snapshot snap-3');
    expect(document).toContain('Approve, defer, or reject at the current decision gate.');
    // The compact TOC no longer consumes a dedicated mostly-empty page.
    expect(document.match(/w:type="page"/g) || []).toHaveLength(0);
  });

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
  it('embeds a populated static TOC that is useful before Word updates fields', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ toc: true }),
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const zip = await JSZip.loadAsync(buffer);
    const document = await zip.file('word/document.xml')?.async('string');
    expect(document).toBeTruthy();
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.TOC_HEADING}"`);
    expect(document).toContain('Table of Contents');
    expect(document).toContain('1. Executive Summary');
    expect(document).toContain('2. Findings');
    expect(document).not.toContain('w:instrText');
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

describe('documentDocxRenderer — KPI and risk tables', () => {
  it('renders KPI items and keyed risk rows as real wrapping Word tables, not JSON text', async () => {
    const longMitigation =
      'Sequence the rollout by business unit, retain an accountable owner, and verify every control with evidence before the next wave begins.';
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ coverPage: false }),
      sections: [
        {
          sectionId: 'tables',
          orderIndex: 0,
          level: 1,
          title: 'Metrics and risks',
          blocks: [
            {
              blockId: 'kpi',
              type: 'kpi_strip',
              content: {
                items: [{ label: 'Adoption &amp; usage', value: '72%', delta: '+8 pp' }],
              } as unknown,
            },
            {
              blockId: 'risk',
              type: 'risk_table',
              content: {
                rows: [
                  {
                    cells: {
                      risk: { value: 'Delivery dependency' },
                      owner: { value: 'COO' },
                      mitigation: { value: longMitigation },
                    },
                  },
                ],
              } as unknown,
            },
          ],
          sourceRefs: [],
        },
      ],
    });
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await unzipDocx(buffer);
    expect((document.match(/<w:tbl>/g) ?? []).length).toBe(2);
    expect(document).toContain('Adoption &amp; usage');
    expect(document).toContain('Delivery dependency');
    expect(document).toContain(longMitigation);
    expect(document).not.toContain('&amp;quot;');
    expect(document).not.toContain('w:noWrap');
    expect(document).not.toContain('{&quot;value&quot;');
  });

  it('wraps KPI strips wider than three metrics onto additional table rows', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ coverPage: false }),
      sections: [
        {
          sectionId: 'kpis',
          orderIndex: 0,
          level: 1,
          title: 'KPIs',
          sourceRefs: [],
          blocks: [
            {
              blockId: 'wide-kpi',
              type: 'kpi_strip',
              content: {
                items: ['A', 'B', 'C', 'D'].map((label) => ({ label, value: '1' })),
              } as unknown,
            },
          ],
        },
      ],
    });
    const { document } = await unzipDocx(await renderDocumentSchemaToDocxBuffer(schema));
    const tableXml = document.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0] ?? '';
    expect((tableXml.match(/<w:tr>/g) ?? []).length).toBe(2);
  });

  it('prunes empty KPI and risk shells instead of emitting technical placeholders', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ coverPage: false }),
      sections: [
        {
          sectionId: 'empty',
          orderIndex: 0,
          level: 1,
          title: 'Honest no-data state',
          sourceRefs: [],
          blocks: [
            { blockId: 'empty-kpi', type: 'kpi_strip', content: { items: [] } as unknown },
            { blockId: 'empty-risk', type: 'risk_table', content: { rows: [] } as unknown },
          ],
        },
      ],
    });
    const { document } = await unzipDocx(await renderDocumentSchemaToDocxBuffer(schema));
    expect(document).not.toContain('placeholder');
    expect(document).not.toContain('<w:tbl>');
  });
});
