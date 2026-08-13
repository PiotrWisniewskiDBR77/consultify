/**
 * Document Studio — PDF renderer parity smoke tests (Epic E8, Slice 8.4).
 *
 * MVP-4 ships the advanced DOCX surface (TOC, captions, footnotes,
 * appendix labelling, formatting class). Slice 8.4 brings the PDF
 * renderer up to parity so a stakeholder reading the print PDF sees
 * the same structural decisions a Word reviewer would.
 *
 * Tests render real PDF buffers and assert the embedded text content
 * (pdfkit emits visible strings as `(...) Tj` operators in the page
 * stream — searchable as ASCII substrings inside the buffer). We do
 * not assert on pixel positions; we trust pdfkit's layout engine and
 * focus on:
 *   - cover lives on its own page (visible "Generated:" label is on
 *     a different page than the first body heading);
 *   - body sections receive Arabic numbering ("1.", "2.", …);
 *   - appendices use the lettered or numbered scheme per
 *     `formattingSchema.appendixStyle`;
 *   - tables emit "Table N — caption", images emit "Figure N — caption";
 *   - inline-marker citations append "[N]"; footnote-style citations
 *     route through the Notes appendix.
 *   - Table of Contents heading is present when `formattingSchema.toc`
 *     is true.
 *
 * The buffers are valid PDFs (`%PDF-` magic + `%%EOF` trailer) — that
 * contract is already covered by `documentStudioExport.test.ts`.
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

function makeSection(overrides: Partial<DocumentSection> & { sectionId: string }): DocumentSection {
  return {
    // `sectionId` is required on `overrides` and the trailing spread already
    // supplies it — restating it here was dead (and flagged as an overwritten
    // duplicate property).
    orderIndex: overrides.orderIndex ?? 0,
    level: overrides.level ?? 1,
    title: overrides.title ?? 'Section',
    blocks: overrides.blocks ?? [],
    sourceRefs: overrides.sourceRefs ?? [],
    ...overrides,
  };
}

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'art-1',
    title: 'PDF Parity Smoke',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: makeFormattingSchema(),
    sections: [],
    sourceRefs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * pdfkit compresses page content streams by default, so substring
 * matching against the raw buffer is unreliable. We use `pdf-parse`
 * to recover the visible text — the same path Word / Acrobat use to
 * extract text — and assert against the parsed string.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return String(result.text ?? '');
}

function expectPdfContains(text: string, needle: string): void {
  if (!text.includes(needle)) {
    throw new Error(
      `Expected PDF text to contain "${needle}". Actual (first 600 chars): ${text.slice(0, 600)}`
    );
  }
}

function expectPdfNotContains(text: string, needle: string): void {
  if (text.includes(needle)) {
    throw new Error(`Expected PDF text NOT to contain "${needle}".`);
  }
}

describe('documentPdfRenderer — parity with DOCX (Slice 8.4)', () => {
  it('produces a valid PDF (magic + trailer) and embeds the title', async () => {
    const buffer = await renderDocumentSchemaToPdfBuffer(makeSchema());
    expect(buffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.slice(-6).toString('utf8').includes('EOF')).toBe(true);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, 'PDF Parity Smoke');
  });

  it('renders body sections with Arabic numbering and appendices under the lettered scheme', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ appendixStyle: 'lettered' }),
      sections: [
        makeSection({ sectionId: 'sec-summary', title: 'Executive Summary' }),
        makeSection({ sectionId: 'sec-glossary', title: 'Glossary', kind: 'appendix' }),
        makeSection({ sectionId: 'sec-findings', title: 'Findings' }),
        makeSection({ sectionId: 'sec-sources', title: 'Sources Appendix', kind: 'appendix' }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, '1. Executive Summary');
    expectPdfContains(text, '2. Findings');
    expectPdfContains(text, 'Appendix A');
    expectPdfContains(text, 'Glossary');
    expectPdfContains(text, 'Appendix B');
    // Body sections must precede appendices in document order.
    expect(text.indexOf('2. Findings')).toBeLessThan(text.indexOf('Appendix A'));
  });

  it('numbers appendices with Arabic digits when appendixStyle is "numbered"', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ appendixStyle: 'numbered' }),
      sections: [
        makeSection({ sectionId: 'sec-summary', title: 'Summary' }),
        makeSection({ sectionId: 'sec-app1', title: 'Glossary', kind: 'appendix' }),
        makeSection({ sectionId: 'sec-app2', title: 'Sources', kind: 'appendix' }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, 'Appendix 1');
    expectPdfContains(text, 'Appendix 2');
    expectPdfNotContains(text, 'Appendix A');
  });

  it('renders a manual Table of Contents when formattingSchema.toc is true', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ toc: true }),
      sections: [
        makeSection({ sectionId: 'sec-summary', title: 'Executive Summary' }),
        makeSection({ sectionId: 'sec-findings', title: 'Findings' }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, 'Table of Contents');
    // TOC must list each body heading.
    expectPdfContains(text, '1. Executive Summary');
    expectPdfContains(text, '2. Findings');
  });

  it('omits the Table of Contents when formattingSchema.toc is false', async () => {
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ toc: false }),
      sections: [makeSection({ sectionId: 's1', title: 'Findings' })],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfNotContains(text, 'Table of Contents');
  });

  it('auto-numbers tables and figures with caption text', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'table',
              content: { headers: ['A'], rows: [['x']], caption: 'Quarterly KPIs' },
            },
            {
              blockId: 'b2',
              type: 'image',
              content: { caption: 'Architecture overview' },
            },
            {
              blockId: 'b3',
              type: 'table',
              content: { headers: ['B'], rows: [['y']], caption: 'Risk register' },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, 'Table 1');
    expectPdfContains(text, 'Quarterly KPIs');
    expectPdfContains(text, 'Figure 1');
    expectPdfContains(text, 'Architecture overview');
    expectPdfContains(text, 'Table 2');
    expectPdfContains(text, 'Risk register');
  });

  it('appends [N] inline citation markers when citationStyle is "inline_marker"', async () => {
    const ref = { sourceType: 'finance_report', sourceId: 'fr-2026-q1' };
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ citationStyle: 'inline_marker' }),
      sourceRefs: [{ ...ref, sourceTitle: 'Q1 Finance Report' }],
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Revenue grew 18 percent in Q1.' },
              sourceRef: ref,
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, '[1]');
    // No Notes appendix when only inline markers are used.
    expectPdfNotContains(text, 'Notes\n');
  });

  it('routes source refs to the Notes appendix when citationStyle is "footnote"', async () => {
    const ref = { sourceType: 'finance_report', sourceId: 'fr-2026-q1' };
    const schema = makeSchema({
      formattingSchema: makeFormattingSchema({ citationStyle: 'footnote' }),
      sourceRefs: [{ ...ref, sourceTitle: 'Q1 Finance Report' }],
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            {
              blockId: 'b1',
              type: 'paragraph',
              content: { text: 'Revenue grew 18 percent in Q1.' },
              sourceRef: ref,
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, 'Notes');
    expectPdfContains(text, 'finance_report#fr-2026-q1');
  });

  it('renders inline footnote blocks via the Notes appendix', async () => {
    const schema = makeSchema({
      sections: [
        makeSection({
          sectionId: 's1',
          title: 'Findings',
          blocks: [
            { blockId: 'b1', type: 'paragraph', content: { text: 'Body paragraph.' } },
            {
              blockId: 'b2',
              type: 'footnote',
              content: { text: 'Includes one-off licensing revenue.' },
            },
          ],
        }),
      ],
    });
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buffer);
    expectPdfContains(text, 'Notes');
    expectPdfContains(text, 'Includes one-off licensing revenue.');
    expect(/Note \^\d+/.test(text)).toBe(true);
  });

  it('embeds the formatting class in the PDF metadata Subject field', async () => {
    const buffer = await renderDocumentSchemaToPdfBuffer(
      makeSchema({ communicationRegister: 'narrative' })
    );
    const parser = new PDFParse({ data: buffer });
    const info = await parser.getInfo();
    const subject = String(info?.info?.Subject ?? '');
    expect(subject).toContain('narrative');
  });
});
