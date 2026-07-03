/**
 * M14 / ExecutionHub — reportPdfService unit tests (Slice F8 / 8.4).
 *
 * Verifies the pure status-report → PDF Buffer renderer:
 *   - returns a non-empty Buffer;
 *   - the Buffer begins with the `%PDF` magic header and ends with `%%EOF`;
 *   - visible report strings (title / period / section names) are embedded
 *     in the page stream (pdfkit emits text as `(...) Tj` ASCII operators);
 *   - tolerates both the StatusReportService map shape and a flattened shape.
 *
 * Layout is delegated to pdfkit; we assert structure/content, not pixels.
 */

import { PDFParse } from 'pdf-parse';
import { describe, expect, it } from 'vitest';

import { renderReportPdf } from '../../../server/src/services/reportPdfService.js';

/**
 * pdfkit compresses page content streams by default, so raw-buffer substring
 * matching for visible text is unreliable. Decode with `pdf-parse` (the same
 * approach used by documentPdfRendererParity.test.ts) for content assertions.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return String(result.text ?? '');
}

const SAMPLE_REPORT = {
  title: 'CRM Rollout — Status Report',
  period: 'Q2 2026',
  overallStatus: 'AMBER',
  // StatusReportService.generateReport emits sections as a keyed map.
  sections: {
    SCHEDULE: {
      status: 'GREEN',
      content: '12/20 tasks completed (60% progress)',
      highlights: ['Completed 4 tasks this period'],
      issues: [],
    },
    BUDGET: {
      status: 'AMBER',
      content: '88% of budget consumed',
      highlights: [],
      issues: ['Budget approaching limit'],
    },
    SCOPE: {
      status: 'NA',
      content: 'Scope not independently tracked this period',
      highlights: [],
      issues: [],
    },
  },
  narrative: {
    executiveSummary:
      'The CRM rollout is progressing on schedule but budget pressure is mounting.',
    accomplishments: ['Migrated 3 of 5 regions', 'Trained 40 end users'],
    nextSteps: ['Finalize region 4 migration', 'Run UAT'],
    escalations: ['Budget overrun risk needs sponsor decision'],
    risksAndIssues: 'Vendor delivery slippage on the reporting module remains the top risk.',
    recommendations: 'Re-baseline the budget at the next steering committee.',
  },
};

describe('reportPdfService.renderReportPdf', () => {
  it('returns a non-empty Buffer with a %PDF header and %%EOF trailer', async () => {
    const buf = await renderReportPdf(SAMPLE_REPORT);

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    // %PDF magic header.
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    // Valid PDF trailer.
    expect(buf.toString('latin1')).toContain('%%EOF');
  });

  it('embeds the report title, period and section names in the page stream', async () => {
    const buf = await renderReportPdf(SAMPLE_REPORT);
    const text = await extractPdfText(buf);

    expect(text).toContain('Status Report');
    expect(text).toContain('Q2 2026');
    expect(text).toContain('SCHEDULE');
    expect(text).toContain('BUDGET');
    expect(text).toContain('Executive Summary');
  });

  it('accepts a flattened shape (sections array + top-level executiveSummary)', async () => {
    const buf = await renderReportPdf({
      initiativeName: 'Flat Initiative',
      periodLabel: 'Week 24, 2026',
      overallStatus: 'green',
      executiveSummary: 'All green this period.',
      sections: [
        { name: 'QUALITY', status: 'GREEN', content: 'No open issues tracked this period' },
      ],
    });

    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    const text = await extractPdfText(buf);
    expect(text).toContain('Flat Initiative');
    expect(text).toContain('QUALITY');
  });

  it('renders a valid PDF even for a minimal/empty report', async () => {
    const buf = await renderReportPdf({});

    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    const text = await extractPdfText(buf);
    expect(text).toContain('Status Report');
  });
});
