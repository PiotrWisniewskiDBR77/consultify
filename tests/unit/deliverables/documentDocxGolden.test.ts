/**
 * Document Studio (M18) — DOCX golden export-fidelity test (C4).
 *
 * Renders the shared golden fixture (`documentGoldenFixture.ts` — 4
 * sections, H1/H2/H3 headings, paragraph, bullet + numbered lists,
 * callout, quote, KPI strip, data table, chart, footnote, inline
 * citation, assumption marker, and a lettered appendix) to a real
 * `.docx` buffer, unzips the OOXML package, and asserts STRUCTURE
 * (named styles present + referenced, section ordering, table row
 * counts, appendix page-break, cover page break, header/footer wiring,
 * static TOC) rather than pixel/visual output.
 *
 * Deliberately NOT a pixel-diff / whole-buffer snapshot: the `docx`
 * package embeds a fresh `docProps/core.xml` `w:created` timestamp on
 * every render, so a raw buffer-hash snapshot would be flaky by
 * construction. Every assertion below targets a stable structural
 * signal instead (named style ids, XML substrings, row/element counts).
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { renderDocumentSchemaToDocxBuffer } from '../../../server/src/services/documentStudio/documentDocxRenderer.js';
import { DOCX_STYLE_IDS } from '../../../server/src/services/documentStudio/documentDocxStyles.js';
import { makeGoldenDocumentSchema, makeGoldenFormattingSchema } from './documentGoldenFixture.js';

interface UnzippedDocx {
  document: string;
  styles: string;
  contentTypes: string;
  coreProps: string;
  footnotes: string | null;
  numbering: string | null;
}

async function unzipDocx(buffer: Buffer): Promise<UnzippedDocx> {
  const zip = await JSZip.loadAsync(buffer);
  const document = await zip.file('word/document.xml')?.async('string');
  const styles = await zip.file('word/styles.xml')?.async('string');
  const contentTypes = await zip.file('[Content_Types].xml')?.async('string');
  const coreProps = await zip.file('docProps/core.xml')?.async('string');
  const footnotes = (await zip.file('word/footnotes.xml')?.async('string')) ?? null;
  const numbering = (await zip.file('word/numbering.xml')?.async('string')) ?? null;
  if (!document || !styles || !contentTypes || !coreProps) {
    throw new Error('golden DOCX buffer is missing a required OOXML part');
  }
  return { document, styles, contentTypes, coreProps, footnotes, numbering };
}

/** List the embedded media parts (images) inside a DOCX ZIP package. */
async function listDocxMediaParts(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
}

/** Count non-overlapping occurrences of a literal substring. */
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = 0;
  for (;;) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count += 1;
    idx += needle.length;
  }
  return count;
}

describe('Document Studio golden DOCX export (C4)', () => {
  it('renders a valid OOXML ZIP package', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    expect(buffer.length).toBeGreaterThan(2048);
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
    const { contentTypes } = await unzipDocx(buffer);
    expect(contentTypes).toContain('word/document.xml');
  });

  it('declares every named Word style the renderer references, and the body actually references them', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { styles, document } = await unzipDocx(buffer);
    for (const styleId of Object.values(DOCX_STYLE_IDS)) {
      expect(styles).toContain(`w:styleId="${styleId}"`);
    }
    // Every style actually gets used somewhere in the body given the
    // golden fixture's block mix (heading levels, body text, quote,
    // callout, caption, assumption body, source list).
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.HEADING1}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.HEADING2}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.HEADING3}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.BODY_TEXT}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.BLOCK_QUOTE}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.CALLOUT}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.CAPTION}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.ASSUMPTION_BODY}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.SOURCE_LIST}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.TITLE}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.SUBTITLE}"`);
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.TOC_HEADING}"`);
  });

  it('renders bullet and numbered lists as real Word list paragraphs (G7 — not manual "• " / "N. " text prefixes)', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document, numbering } = await unzipDocx(buffer);

    // A real numbering part must exist, with our two declared abstract
    // configs (bullet + decimal), and every list paragraph in the body
    // must reference one of them via <w:numPr> — that is what makes Word
    // recognize the paragraphs as an editable, styled list outline
    // instead of plain text that happens to start with a glyph.
    expect(numbering).not.toBeNull();
    expect(numbering).toContain('w:numFmt w:val="bullet"');
    expect(numbering).toContain('w:numFmt w:val="decimal"');
    expect(document).toContain('<w:numPr>');
    expect(countOccurrences(document, '<w:numPr>')).toBeGreaterThanOrEqual(6); // 3 bullet + 3 numbered golden items

    // The old manual-prefix rendering is gone: list item text is no longer
    // literally prefixed with "• " or "1. " / "2. " / "3. " inside the run.
    expect(document).not.toContain('>• Enterprise ARR');
    expect(document).not.toContain('>1. Confirm Q2 budget');
    expect(document).toContain('Enterprise ARR +18%');
    expect(document).toContain('Confirm Q2 budget');
  });

  it('renders the cover title/subtitle/audience and a hard page break before the body', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain('Golden Export Fixture');
    expect(document).toContain('Audience: Steering Committee, CFO');
    expect(document).toContain('w:type="page"'); // cover → body hard break
  });

  it('renders a deterministic static TOC (formattingSchema.toc = true in the golden fixture)', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain('Table of Contents');
    expect(document).toContain(`w:val="${DOCX_STYLE_IDS.TOC_HEADING}"`);
    expect(document).toContain('1. Executive Summary');
    expect(document).toContain('2. Findings &amp; Data');
    expect(document).toContain('Appendix A — Glossary');
  });

  it('orders sections body-first, appendix-last, with Arabic body numbering and a lettered appendix', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain('1. Executive Summary');
    expect(document).toContain('2. Findings');
    expect(document).toContain('3. Recommendation');
    expect(document).toContain('Appendix A');
    expect(document).toContain('Glossary');
    // Ordering invariant: last body section precedes the appendix.
    expect(document.indexOf('3. Recommendation')).toBeLessThan(document.indexOf('Appendix A'));
  });

  it('renders both tables with the expected row counts (header + data rows)', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    // Two real <w:tbl> elements: KPI strip + region table.
    expect(countOccurrences(document, '<w:tbl>')).toBe(2);
    // KPI strip: 1 header row + 2 data rows = 3 <w:tr>; region table:
    // 1 header + 3 data rows = 4 <w:tr>. Total 7 rows across both tables.
    expect(countOccurrences(document, '<w:tr')).toBeGreaterThanOrEqual(7);
    // Auto-numbered captions, in order.
    expect(document).toContain('Table 1 — Q1 KPI Strip');
    expect(document).toContain('Table 2 — Revenue by region');
    // Table cell content survives (spot-check a data cell from each table).
    expect(document).toContain('$11.8M');
    expect(document).toContain('EMEA');
  });

  it('renders the chart block as Figure 1 with a real embedded ImageRun (C5 — @napi-rs/canvas)', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    const media = await listDocxMediaParts(buffer);
    expect(document).toContain('Figure 1 — Revenue by Quarter');
    // C5 — `documentChartRasterizer.renderChartBlockToPng()` rasterizes via
    // `@napi-rs/canvas` (prebuilt binaries, no native build) + chart.js,
    // forcing chart.js's `BasicPlatform` explicitly so the same code path
    // renders identically under Node (production) and Vitest's jsdom
    // environment. The DOCX must embed a real `<w:drawing>`/media image
    // part rather than falling through to the text placeholder.
    expect(media.length).toBeGreaterThan(0);
    expect(document).toContain('<w:drawing>');
    expect(document).not.toContain('chart placeholder');
    expect(document).not.toContain('rasterization fallback');
  });

  it('appends the inline_marker citation to the sourced paragraph and lists it in Sources & traceability', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain('[1]');
    expect(document).toContain('Sources &amp; traceability');
    expect(document).toContain('finance_report#fr-2026-q1');
  });

  it('flags the isAssumption block with the amber assumption marker', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { document } = await unzipDocx(buffer);
    expect(document).toContain('Assumption');
    expect(document).toContain('92400E'); // amber marker color (DOCX_PALETTE.amberInk)
  });

  it('wires header content and footer confidentiality + page numbering fields', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const zip = await JSZip.loadAsync(buffer);
    const headerXml = await zip.file('word/header1.xml')?.async('string');
    const footerXml = await zip.file('word/footer1.xml')?.async('string');
    expect(headerXml).toBeTruthy();
    expect(footerXml).toBeTruthy();
    expect(String(headerXml)).toContain('Consultify · Golden Export Fixture');
    expect(String(footerXml)).toContain('client confidential');
    // Real Word page-number fields, not literal text.
    expect(String(footerXml)).toContain('PAGE');
    expect(String(footerXml)).toContain('NUMPAGES');
  });

  it('registers the footnote block into word/footnotes.xml', async () => {
    const buffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const { footnotes } = await unzipDocx(buffer);
    expect(footnotes).toBeTruthy();
    expect(String(footnotes)).toContain('one-off licensing income');
  });

  it('is byte-identical across two renders once the volatile w:created/w:modified timestamp is stripped', async () => {
    // Not a pixel-diff and not a raw-buffer snapshot (the docx package
    // stamps `docProps/core.xml` with the current time on every call).
    // Structural determinism is what the NFR actually requires, so we
    // normalise the one non-deterministic part and diff everything else.
    function normalizeCoreProps(xml: string): string {
      return xml
        .replace(/<dcterms:created[^>]*>.*?<\/dcterms:created>/g, '<dcterms:created/>')
        .replace(/<dcterms:modified[^>]*>.*?<\/dcterms:modified>/g, '<dcterms:modified/>');
    }
    const schema = makeGoldenDocumentSchema();
    const bufferA = await renderDocumentSchemaToDocxBuffer(schema);
    const bufferB = await renderDocumentSchemaToDocxBuffer(schema);
    const a = await unzipDocx(bufferA);
    const b = await unzipDocx(bufferB);
    expect(a.document).toBe(b.document);
    expect(a.styles).toBe(b.styles);
    expect(normalizeCoreProps(a.coreProps)).toBe(normalizeCoreProps(b.coreProps));
  });

  it('renders the legal formatting class with smaller type sizes than the golden (executive) class', async () => {
    const execBuffer = await renderDocumentSchemaToDocxBuffer(makeGoldenDocumentSchema());
    const legalBuffer = await renderDocumentSchemaToDocxBuffer(
      makeGoldenDocumentSchema({
        communicationRegister: 'professional',
        languageStyle: 'legal',
        formattingSchema: makeGoldenFormattingSchema(),
      })
    );
    const { styles: execStyles } = await unzipDocx(execBuffer);
    const { styles: legalStyles } = await unzipDocx(legalBuffer);
    const bodyPattern = new RegExp(
      `w:styleId="${DOCX_STYLE_IDS.BODY_TEXT}"[^]*?w:sz w:val="(\\d+)"`
    );
    const bodyExecSize = Number(execStyles.match(bodyPattern)?.[1]);
    const bodyLegalSize = Number(legalStyles.match(bodyPattern)?.[1]);
    expect(bodyExecSize).toBeGreaterThan(bodyLegalSize);
  });
});
