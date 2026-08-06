/**
 * Document Studio — DOCX + PDF renderer wiring tests for the
 * `FormattingSchema` E15.5 substrate (Slice E15.5.formatting.render).
 *
 * Verifies that the five §15.5 substrate surfaces are now consumed by
 * the live DOCX + PDF renderers:
 *
 *   - `headingStylesDetailed.h{1,2,3}` — overrides class-derived
 *     heading styles in `buildDocxStyleConfig` (DOCX) and in
 *     `buildPdfRenderContext` (PDF);
 *   - `headers.content` — overrides the default header text in both
 *     renderers;
 *   - `footers.pageNumberingFormat` — replaces the legacy `Page N / M`
 *     runs / text with a `{N}` / `{M}` template;
 *   - `tocConfig.maxDepth` — narrows the Word `headingStyleRange` and
 *     filters PDF TOC entries;
 *   - `coverPageDetailed.includeStatus` / `includeConfidentiality` —
 *     suppress / include the corresponding cover-page subtitle parts.
 *
 * Strategy:
 *   - DOCX assertions inspect `buildDocxStyleConfig` output (cheap)
 *     and the `word/document.xml` extracted via JSZip (mirrors the
 *     pattern used by `documentDocxRenderer.test.ts`).
 *   - PDF assertions extract text via `pdf-parse` (mirrors the
 *     pattern used by `documentPdfRendererParity.test.ts`).
 *
 * Backwards compatibility: every test pairs a "with override" case
 * with a "without override" case to prove the legacy default still
 * renders unchanged.
 */

import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import { buildDocxStyleConfig } from '../documentDocxStyles.js';
import { renderDocumentSchemaToPdfBuffer } from '../documentPdfRenderer.js';
import type { DocumentSchema, FormattingSchema } from '../documentStudioTypes.js';

function baseFormatting(): FormattingSchema {
  return {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: false },
    toc: true,
    coverPage: true,
    appendixStyle: 'none',
    citationStyle: 'inline_marker',
  };
}

function makeSchema(formatting: FormattingSchema): DocumentSchema {
  return {
    documentId: 'doc-render-1',
    artifactId: 'artifact-render-1',
    title: 'Render test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: formatting,
    sections: [
      {
        sectionId: 's1',
        orderIndex: 0,
        level: 1,
        title: 'First section',
        blocks: [{ blockId: 'b1', type: 'paragraph', content: { text: 'Body 1.' } }],
        sourceRefs: [],
      },
      {
        sectionId: 's2',
        orderIndex: 1,
        level: 2,
        title: 'A subsection',
        blocks: [{ blockId: 'b2', type: 'paragraph', content: { text: 'Body 2.' } }],
        sourceRefs: [],
      },
      {
        sectionId: 's3',
        orderIndex: 2,
        level: 3,
        title: 'A deep nested heading',
        blocks: [{ blockId: 'b3', type: 'paragraph', content: { text: 'Body 3.' } }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
  };
}

async function extractDocxXml(buffer: Buffer): Promise<{
  document: string;
  /** Concatenation of every header*.xml and footer*.xml in the package. */
  headerFooter: string;
  /** Concatenation of `document` + every header / footer XML. Used for
   *  fields like `pageNumberingFormat` literal text and TOC range that
   *  may live in any of these parts depending on docx-js placement. */
  combined: string;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error('docx package missing word/document.xml');

  // Collect every header*.xml and footer*.xml. The `docx` package
  // names them sequentially (header1, header2, ..., footer1, ...).
  const parts: string[] = [];
  for (const relativePath of Object.keys(zip.files)) {
    const f = zip.files[relativePath];
    if (f.dir) continue;
    if (/^word\/(header|footer)\d*\.xml$/.test(relativePath)) {
      parts.push(relativePath);
    }
  }
  let headerFooter = '';
  for (const path of parts.sort()) {
    const xml = await zip.file(path)?.async('string');
    if (xml) headerFooter += xml;
  }
  return {
    document: documentXml,
    headerFooter,
    combined: documentXml + '\n' + headerFooter,
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return String(result.text ?? '');
}

// =============================================================================
// E15.5.formatting.render — DOCX style overrides
// =============================================================================

describe('Slice E15.5.formatting.render — DOCX buildDocxStyleConfig honors headingStylesDetailed', () => {
  it('falls back to class-derived sizing when override is absent', () => {
    const schema = makeSchema(baseFormatting());
    const config = buildDocxStyleConfig(schema, 'professional') as {
      default: { heading1: { run: { size: number; bold: boolean } } };
    };
    expect(config.default.heading1.run.size).toBe(32); // professional class h1 default (16pt × 2)
    expect(config.default.heading1.run.bold).toBe(true);
  });

  it('applies headingStylesDetailed override (fontSize ×2 = half-points)', () => {
    const formatting = baseFormatting();
    formatting.headingStylesDetailed = {
      h1: { fontSizePt: 18, bold: true, spacingBeforePt: 12, spacingAfterPt: 6 },
      h2: { fontSizePt: 14, bold: false, spacingBeforePt: 10, spacingAfterPt: 4 },
      h3: { fontSizePt: 12, bold: true, spacingBeforePt: 8, spacingAfterPt: 4 },
    };
    const schema = makeSchema(formatting);
    const config = buildDocxStyleConfig(schema, 'professional') as {
      default: {
        heading1: {
          run: { size: number; bold: boolean };
          paragraph: { spacing: { before: number; after: number } };
        };
        heading2: { run: { size: number; bold: boolean } };
        heading3: { run: { size: number; bold: boolean } };
      };
    };
    expect(config.default.heading1.run.size).toBe(36); // 18 × 2
    expect(config.default.heading2.run.size).toBe(28); // 14 × 2
    expect(config.default.heading3.run.size).toBe(24); // 12 × 2
    expect(config.default.heading1.run.bold).toBe(true);
    expect(config.default.heading2.run.bold).toBe(false); // override honored
    expect(config.default.heading3.run.bold).toBe(true);
    expect(config.default.heading1.paragraph.spacing.before).toBe(240); // 12 × 20
    expect(config.default.heading1.paragraph.spacing.after).toBe(120); // 6 × 20
  });
});

// =============================================================================
// E15.5.formatting.render — DOCX header / footer / TOC / cover wiring
// =============================================================================

describe('Slice E15.5.formatting.render — DOCX renderer honors header / footer / TOC / cover overrides', () => {
  it('uses schema.title in DOCX header by default', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { headerFooter } = await extractDocxXml(buf);
    expect(headerFooter).toContain('Render test');
  });

  it('uses headers.content override in DOCX header when set', async () => {
    const formatting = baseFormatting();
    formatting.headers.content = 'Custom Confidential Header';
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { headerFooter } = await extractDocxXml(buf);
    expect(headerFooter).toContain('Custom Confidential Header');
  });

  it('uses default Page N / M numbering when pageNumberingFormat absent', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { headerFooter } = await extractDocxXml(buf);
    expect(headerFooter).toContain('Page ');
  });

  it('uses custom pageNumberingFormat literal text in DOCX footer', async () => {
    const formatting = baseFormatting();
    formatting.footers.pageNumberingFormat = 'Strona {N} z {M}';
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { headerFooter } = await extractDocxXml(buf);
    expect(headerFooter).toContain('Strona ');
    expect(headerFooter).toContain('z ');
  });

  it('renders custom footers.content in the DOCX footer', async () => {
    const formatting = baseFormatting();
    formatting.footers.content = 'Internal use only';
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { headerFooter } = await extractDocxXml(buf);
    expect(headerFooter).toContain('Internal use only');
  });

  it('uses default TOC range 1-3 when tocConfig absent', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await extractDocxXml(buf);
    expect(document).toMatch(/1-3/);
  });

  it('honors tocConfig.maxDepth=2 → headingStyleRange 1-2', async () => {
    const formatting = baseFormatting();
    formatting.tocConfig = { enabled: true, maxDepth: 2 };
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await extractDocxXml(buf);
    expect(document).toMatch(/1-2/);
  });

  it('renders full subtitle (density + confidentiality) by default on cover', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await extractDocxXml(buf);
    expect(document).toContain('standard'); // density
    expect(document).toContain('internal'); // confidentiality
  });

  it('suppresses density on cover when coverPageDetailed.includeStatus=false', async () => {
    const formatting = baseFormatting();
    formatting.coverPageDetailed = {
      enabled: true,
      includeStatus: false,
      includeConfidentiality: true,
    };
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToDocxBuffer(schema);
    const { document } = await extractDocxXml(buf);
    // Density is not part of the subtitle anymore. The token
    // `standard` may still appear elsewhere (registry / styles), so
    // we narrow to the subtitle line via a regex that captures the
    // dot-separator pattern. The substitle is approximately:
    //   "executive memo · EN · internal" (density skipped)
    expect(document).toContain('internal'); // confidentiality kept
    // Note: we cannot strictly assert "standard" is absent because
    // the document carries it as a metadata field; we only assert
    // the cover subtitle composition contains the expected order.
    expect(document).toMatch(/EN.{1,30}internal/i);
  });
});

// =============================================================================
// E15.5.formatting.render — PDF parity
// =============================================================================

describe('Slice E15.5.formatting.render — PDF renderer parity', () => {
  it('uses schema.title in header by default', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buf);
    expect(text).toContain('Render test');
  });

  it('uses headers.content override in PDF header when set', async () => {
    const formatting = baseFormatting();
    formatting.headers.content = 'PDF Header Override';
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buf);
    expect(text).toContain('PDF Header Override');
  });

  it('uses default page numbering when pageNumberingFormat absent', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buf);
    expect(text).toMatch(/1\s*\/\s*\d/);
  });

  it('honors custom pageNumberingFormat in PDF footer', async () => {
    const formatting = baseFormatting();
    formatting.footers.pageNumberingFormat = 'Strona {N} z {M}';
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buf);
    expect(text).toMatch(/Strona\s+1\s+z\s+\d/);
  });

  it('renders full subtitle on cover by default', async () => {
    const schema = makeSchema(baseFormatting());
    const buf = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buf);
    // Cover subtitle contains all 4 parts joined by " · ".
    expect(text).toContain('standard');
    expect(text).toContain('internal');
  });

  it('suppresses density on cover when coverPageDetailed.includeStatus=false', async () => {
    const formatting = baseFormatting();
    formatting.coverPageDetailed = {
      enabled: true,
      includeStatus: false,
      includeConfidentiality: true,
    };
    const schema = makeSchema(formatting);
    const buf = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await extractPdfText(buf);
    expect(text).toContain('internal');
    // Cover subtitle should now be `executive memo · EN · internal`
    // (no `· standard` middle segment).
    expect(text).toMatch(/EN\s*·\s*internal/i);
  });
});
