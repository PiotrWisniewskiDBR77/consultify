/**
 * Document Studio — Slice E17.charts.render + E17.charts.qa.
 *
 * Verifies chart rasterization + fallback behavior + Format-QA wiring
 * for `chart` blocks.
 *
 * Coverage:
 *   - DOCX: chart bytes embed as media image parts when rasterization
 *     succeeds; figure caption + optional caption still render in text;
 *     figure counter increments correctly when a chart and an image
 *     share a section.
 *   - PDF: figure caption + optional caption survive the pipeline;
 *     raster fallback text appears only when image rendering fails.
 *   - QA: empty `series[]` → `format_chart_no_series` (medium).
 *     Malformed payload (non-finite values) → `format_chart_invalid_payload`
 *     (medium). Series/category mismatch → `format_chart_series_category_mismatch`
 *     (low). Bar/line/area/scatter without axis labels →
 *     `format_chart_missing_axis_labels` (low). Pie/donut without
 *     axis labels → no finding (axis labels don't apply).
 *   - QA backwards compat: schemas without chart blocks pass the
 *     Format category unchanged.
 */

import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../documentChartRasterizer.js', () => ({
  renderChartBlockToPng: vi.fn().mockResolvedValue(
    // Minimal valid 1×1 PNG — sufficient for ImageRun embedding.
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
  ),
}));

import { renderDocumentSchemaToDocxBuffer } from '../documentDocxRenderer.js';
import { renderDocumentSchemaToPdfBuffer } from '../documentPdfRenderer.js';
import { runDocumentQa } from '../documentQaService.js';
import type {
  DocumentBlock,
  DocumentChartBlockContent,
  DocumentSchema,
} from '../documentStudioTypes.js';

async function pdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

function chartBlock(
  blockId: string,
  content: Partial<DocumentChartBlockContent> = {}
): DocumentBlock {
  return {
    blockId,
    type: 'chart',
    content: {
      kind: 'bar',
      title: 'Q1 Revenue',
      categories: ['Jan', 'Feb', 'Mar'],
      xAxisLabel: 'Month',
      yAxisLabel: 'PLN (k)',
      series: [{ label: 'Revenue', values: [100, 150, 200] }],
      caption: 'Year-over-year increase across Q1.',
      ...content,
    },
  };
}

function makeSchema(blocks: DocumentBlock[]): DocumentSchema {
  return {
    documentId: 'doc-chart-render-1',
    artifactId: 'art-chart-render-1',
    title: 'Chart Render Test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: false },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: [
      {
        sectionId: 'sec-results',
        orderIndex: 0,
        level: 1,
        title: 'Results',
        blocks,
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
  };
}

async function extractDocxBodyXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.files['word/document.xml'];
  if (!file) throw new Error('word/document.xml missing from DOCX buffer');
  return file.async('string');
}

async function listDocxMediaParts(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
}

describe('Slice E17.charts.render — DOCX fallback renderer', () => {
  it('embeds a rasterized chart image and keeps caption text for a valid chart', async () => {
    const schema = makeSchema([chartBlock('blk-chart-1')]);
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const body = await extractDocxBodyXml(buffer);
    const media = await listDocxMediaParts(buffer);
    expect(media.length).toBeGreaterThan(0);
    expect(body).toContain('Figure 1');
    expect(body).toContain('Q1 Revenue');
    expect(body).toContain('Year-over-year increase across Q1.');
  });

  it('increments the figure counter so a chart and an image share the same numbering scheme', async () => {
    const schema = makeSchema([
      {
        blockId: 'blk-img-1',
        type: 'image',
        content: { caption: 'Pre-chart photo', alt: 'photo' },
      },
      chartBlock('blk-chart-1'),
    ]);
    const buffer = await renderDocumentSchemaToDocxBuffer(schema);
    const body = await extractDocxBodyXml(buffer);
    // image is figure 1, chart is figure 2.
    expect(body).toContain('Figure 1');
    expect(body).toContain('Figure 2');
    expect(body.indexOf('Figure 1')).toBeLessThan(body.indexOf('Figure 2'));
  });
});

describe('Slice E17.charts.render — PDF fallback renderer', () => {
  it('renders chart caption text into the PDF buffer', async () => {
    const schema = makeSchema([chartBlock('blk-chart-pdf')]);
    const buffer = await renderDocumentSchemaToPdfBuffer(schema);
    const text = await pdfText(buffer);
    expect(text).toContain('Figure 1');
    expect(text).toContain('Q1 Revenue');
    expect(text).toContain('Year-over-year');
  });
});

describe('Slice E17.charts.qa — Format category', () => {
  function getFormatCategory(schema: DocumentSchema) {
    const report = runDocumentQa(schema);
    const fmt = report.categories.find((c) => c.category === 'format');
    if (!fmt) throw new Error('format category missing');
    return fmt;
  }

  it('emits format_chart_no_series when series array is empty', () => {
    const schema = makeSchema([chartBlock('blk-empty', { series: [] })]);
    const fmt = getFormatCategory(schema);
    expect(fmt.findings.some((f) => f.code === 'format_chart_no_series')).toBe(true);
  });

  it('emits format_chart_invalid_payload when a series carries non-finite values', () => {
    const schema = makeSchema([
      chartBlock('blk-bad', {
        series: [{ label: 'Bad', values: [1, Number.NaN, 3] as number[] }],
      }),
    ]);
    const fmt = getFormatCategory(schema);
    expect(fmt.findings.some((f) => f.code === 'format_chart_invalid_payload')).toBe(true);
  });

  it('emits format_chart_series_category_mismatch when series length ≠ category count', () => {
    const schema = makeSchema([
      chartBlock('blk-mismatch', {
        categories: ['Jan', 'Feb', 'Mar'],
        series: [{ label: 'R', values: [10, 20] }],
      }),
    ]);
    const fmt = getFormatCategory(schema);
    expect(fmt.findings.some((f) => f.code === 'format_chart_series_category_mismatch')).toBe(true);
  });

  it('emits format_chart_missing_axis_labels for bar/line/area/scatter without axis labels', () => {
    const schema = makeSchema([
      chartBlock('blk-no-axes', { xAxisLabel: undefined, yAxisLabel: undefined }),
    ]);
    const fmt = getFormatCategory(schema);
    expect(fmt.findings.some((f) => f.code === 'format_chart_missing_axis_labels')).toBe(true);
  });

  it('does NOT emit format_chart_missing_axis_labels for pie or donut charts', () => {
    const schema = makeSchema([
      chartBlock('blk-pie', {
        kind: 'pie',
        xAxisLabel: undefined,
        yAxisLabel: undefined,
      }),
    ]);
    const fmt = getFormatCategory(schema);
    expect(fmt.findings.some((f) => f.code === 'format_chart_missing_axis_labels')).toBe(false);
  });

  it('passes a fully-specified chart with no findings', () => {
    const schema = makeSchema([chartBlock('blk-good')]);
    const fmt = getFormatCategory(schema);
    const chartFindings = fmt.findings.filter((f) => (f.code ?? '').startsWith('format_chart_'));
    expect(chartFindings).toHaveLength(0);
  });

  it('is backwards compatible — schemas without chart blocks pass Format unchanged', () => {
    const schema = makeSchema([
      {
        blockId: 'blk-p',
        type: 'paragraph',
        content: { text: 'Some text.' },
      },
    ]);
    const fmt = getFormatCategory(schema);
    const chartFindings = fmt.findings.filter((f) => (f.code ?? '').startsWith('format_chart_'));
    expect(chartFindings).toHaveLength(0);
  });
});
