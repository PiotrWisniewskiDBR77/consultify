/**
 * @vitest-environment jsdom
 *
 * M14 Wdrożenie / Execution export — regression guard (Harvard R2 #10, H6.13).
 *
 * The export button labelled "PDF" historically produced a Markdown (.md) file.
 * These tests lock the export to a REAL PDF pipeline: an HTML document with an
 * A4 print stylesheet opened via window.open + window.print (browser
 * "Save as PDF"), matching the DRD report technique in
 * src/services/report/drdReportHtml.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildReportHtml,
  buildReportMarkdown,
  exportReportPDF,
  type ReportDef,
} from '../../../src/components/Execution/executionReports';

function makeReport(): ReportDef {
  return {
    id: 'exec-status',
    title: 'Execution Status Report',
    audience: 'Steering Committee',
    cadence: 'Weekly',
    scope: 'All active initiatives',
    dataSources: ['Initiatives', 'Benefits register'],
    sections: ['Overview', 'Risks', 'Next steps'],
    ragLogic: 'RAG derived from schedule + budget variance.',
    followUpActions: ['Confirm baseline for Initiative A'],
    icon: null as unknown as React.ReactNode,
    highlights: [
      { label: 'On track', value: 7 },
      { label: 'At risk', value: 2 },
    ],
    aiExecutiveReadout: ['Two initiatives slipped this week.'],
    aiRecommendedActions: [],
    dataQuality: { confidence: 'medium' },
    degradedFlags: ['1 initiative missing baseline'],
    lastRefreshAt: null,
    scenarioNotes: [],
  };
}

describe('M14 execution report — real PDF export', () => {
  let openSpy: ReturnType<typeof vi.fn>;
  let writtenHtml: string;
  let printCalled: boolean;

  beforeEach(() => {
    writtenHtml = '';
    printCalled = false;
    const fakeWin = {
      document: {
        open: () => {},
        // capture everything written into the print window
        write: (h: string) => {
          writtenHtml += h;
        },
        close: () => {},
      },
      // run scheduled print immediately for the assertion
      setTimeout: (fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      print: () => {
        printCalled = true;
      },
    };
    openSpy = vi.fn(() => fakeWin as unknown as Window);
    vi.stubGlobal('open', openSpy);
    // window.open must resolve to the stub too
    (window as unknown as { open: typeof openSpy }).open = openSpy;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces an HTML/PDF document, not a Markdown blob', () => {
    const report = makeReport();
    const html = exportReportPDF(report, 'green');

    // Opened a print window and triggered the browser print dialog.
    expect(openSpy).toHaveBeenCalled();
    expect(printCalled).toBe(true);

    // Output is a real HTML document with an A4 print stylesheet.
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
    expect(html).toContain('size: A4');
    expect(html).toContain('@media print');

    // It is NOT a Markdown file.
    expect(html).not.toMatch(/^#\s/m); // no markdown H1
    expect(html).not.toContain('text/markdown');
  });

  it('never creates a .md download (no markdown blob / anchor)', () => {
    const createEl = vi.spyOn(document, 'createElement');
    const report = makeReport();
    exportReportPDF(report, 'amber');

    const createdAnchors = createEl.mock.calls
      .map((c) => c[0])
      .filter((tag) => tag === 'a');
    expect(createdAnchors.length).toBe(0);
    createEl.mockRestore();
  });

  it('renders the report content (title, metrics, sections) into the PDF HTML', () => {
    const report = makeReport();
    const html = buildReportHtml(report, 'red');

    expect(html).toContain('Execution Status Report');
    expect(html).toContain('On track');
    expect(html).toContain('Overview');
    expect(html).toContain('AT RISK'); // RAG label uppercased
    // HTML markup present (table for metrics), not markdown pipes.
    expect(html).toContain('<table');
  });

  it('keeps the Markdown builder available for copy/presentation flows', () => {
    // buildReportMarkdown remains, unchanged, for the Copy + Presentation paths.
    const md = buildReportMarkdown(makeReport(), 'green');
    expect(md).toContain('# Execution Status Report');
    expect(md).toContain('| Metric | Value |');
  });
});
