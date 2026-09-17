// @vitest-environment node

import { createHash } from 'node:crypto';

import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import type { DocumentSchema } from '../../../documentStudio/documentStudioTypes.js';
import { CANONICAL_PDF_ENGINE, exportCanonicalDocumentPdf } from '../CanonicalPdfExportService.js';

function schema(): DocumentSchema {
  return {
    documentId: 'northwind-drd-report',
    artifactId: 'northwind-drd-artifact',
    title: 'Northwind transformation report',
    documentType: 'client_final_report',
    language: 'en',
    audience: ['Client Sponsor'],
    goal: 'recommend',
    communicationRegister: 'executive',
    density: 'comprehensive',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
      headers: { enabled: true, content: 'Northwind transformation report' },
      footers: {
        enabled: true,
        pageNumbering: true,
        confidentialityLabel: true,
        content: 'Consultify · DBR77 · Northwind Manufacturing Ltd.',
        pageNumberingFormat: 'Page {N} of {M}',
      },
      toc: true,
      coverPage: true,
      appendixStyle: 'lettered',
      citationStyle: 'inline_marker',
    },
    sections: [
      {
        sectionId: 'summary',
        orderIndex: 0,
        level: 1,
        title: 'Executive summary',
        blocks: [
          {
            blockId: 'summary-copy',
            type: 'paragraph',
            content: { text: 'Delivery confidence can recover within four weeks.' },
          },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'roadmap',
        orderIndex: 1,
        level: 1,
        title: 'Roadmap',
        blocks: [
          {
            blockId: 'roadmap-table',
            type: 'table',
            content: {
              headers: ['Initiative', 'Owner', 'Timing'],
              rows: [['MES Line 3 pilot', 'COO', 'Weeks 1–4']],
            },
          },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-09-16T12:00:00.000Z',
    updatedAt: '2026-09-16T12:00:00.000Z',
    templateRef: {
      templateId: 'doc-template-system-en-client_final_report',
      templateVersion: '1.0',
    },
  };
}

describe('CanonicalPdfExportService', () => {
  it('renders visible report structure and returns a verifiable receipt', async () => {
    const result = await exportCanonicalDocumentPdf(schema(), 'assessment_drd');
    const parser = new PDFParse({ data: result.buffer });
    const parsed = await parser.getText();
    await parser.destroy();

    expect(result.buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(parsed.text).toContain('Northwind transformation report');
    expect(parsed.text).toContain('1. Executive summary');
    expect(parsed.text).toContain('2. Roadmap');
    expect(parsed.text).toContain('MES Line 3 pilot');
    expect(parsed.text).toContain('Consultify · DBR77 · Northwind Manufacturing Ltd.');
    expect(result.receipt).toEqual({
      engine: CANONICAL_PDF_ENGINE,
      source: 'assessment_drd',
      documentId: 'northwind-drd-report',
      artifactId: 'northwind-drd-artifact',
      templateId: 'doc-template-system-en-client_final_report',
      templateVersion: '1.0',
      sectionCount: 2,
      byteLength: result.buffer.length,
      sha256: createHash('sha256').update(result.buffer).digest('hex'),
    });
  });

  it('fails closed before rendering a schema without report sections', async () => {
    await expect(
      exportCanonicalDocumentPdf({ ...schema(), sections: [] }, 'audit_report')
    ).rejects.toThrow('PDF_EXPORT_E_SCHEMA_SECTIONS');
  });
});
