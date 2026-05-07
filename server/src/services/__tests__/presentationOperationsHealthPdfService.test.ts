import { describe, expect, it } from 'vitest';

import { renderOperationsHealthHtml } from '../presentationOperationsHealthPdfService.js';
import type { OperationsHealthReport } from '../presentationOperationsHealthService.js';

const NOW_ISO = '2026-05-10T12:00:00.000Z';

function emptyReport(overrides: Partial<OperationsHealthReport> = {}): OperationsHealthReport {
  return {
    generatedAt: NOW_ISO,
    windowDays: 7,
    slos: [
      {
        id: 'generation_success_rate',
        label: 'Generation success rate',
        target: '>= 95%',
        observed: '—',
        observedNumeric: null,
        status: 'inconclusive',
      },
      {
        id: 'export_success_rate',
        label: 'Export success rate',
        target: '>= 95%',
        observed: '—',
        observedNumeric: null,
        status: 'inconclusive',
      },
      {
        id: 'p95_generation_latency_ms',
        label: 'P95 generation latency',
        target: '<= 8000 ms',
        observed: '—',
        observedNumeric: null,
        status: 'inconclusive',
      },
      {
        id: 'agent_edit_success_rate',
        label: 'Agent edit acceptance rate',
        target: '>= 70%',
        observed: '—',
        observedNumeric: null,
        status: 'inconclusive',
      },
      {
        id: 'export_blocked_rate',
        label: 'Export blocked rate',
        target: '<= 10%',
        observed: '—',
        observedNumeric: null,
        status: 'inconclusive',
      },
    ],
    jobs: [],
    alerts: {
      windowDays: 7,
      attempted: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
      dryRun: 0,
      uniqueDecks: 0,
      pausedSubscriptions: 0,
    },
    warnings: [],
    ...overrides,
  };
}

describe('presentationOperationsHealthPdfService — renderOperationsHealthHtml', () => {
  it('renders an empty report with all SLOs in inconclusive state and no errors', () => {
    expect(() => renderOperationsHealthHtml({ report: emptyReport() })).not.toThrow();

    const result = renderOperationsHealthHtml({ report: emptyReport() });
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('Operations Health Report');
    // All five SLO labels show up.
    expect(result.html).toContain('Generation success rate');
    expect(result.html).toContain('Export success rate');
    expect(result.html).toContain('P95 generation latency');
    expect(result.html).toContain('Agent edit acceptance rate');
    expect(result.html).toContain('Export blocked rate');
    // Inconclusive label rendered five times.
    const inconclusiveMatches = result.html.match(/Inconclusive/g) || [];
    expect(inconclusiveMatches.length).toBeGreaterThanOrEqual(5);
    // Empty job + warnings sections degrade gracefully.
    expect(result.html).toContain('No scheduled jobs reported');
    expect(result.html).not.toContain('<h2>Warnings</h2>');
  });

  it('renders pass status with emerald color tone in inline style', () => {
    const report = emptyReport({
      slos: [
        {
          id: 'generation_success_rate',
          label: 'Generation success rate',
          target: '>= 95%',
          observed: '99.0% (99/100)',
          observedNumeric: 99,
          status: 'pass',
        },
      ],
    });
    const result = renderOperationsHealthHtml({ report });
    // Emerald tones live around #d1fae5 (background) and #065f46 (text).
    expect(result.html.toLowerCase()).toContain('#d1fae5');
    expect(result.html.toLowerCase()).toContain('#065f46');
    expect(result.html).toContain('Pass');
  });

  it('renders breach status with rose color tone in inline style', () => {
    const report = emptyReport({
      slos: [
        {
          id: 'export_success_rate',
          label: 'Export success rate',
          target: '>= 95%',
          observed: '40.0% (40/100)',
          observedNumeric: 40,
          status: 'breach',
        },
      ],
    });
    const result = renderOperationsHealthHtml({ report });
    // Rose tones live around #ffe4e6 (background) and #9f1239 (text).
    expect(result.html.toLowerCase()).toContain('#ffe4e6');
    expect(result.html.toLowerCase()).toContain('#9f1239');
    expect(result.html).toContain('Breach');
  });

  it('renders watermark text when provided', () => {
    const result = renderOperationsHealthHtml({
      report: emptyReport(),
      watermark: 'CONFIDENTIAL',
    });
    expect(result.html).toContain('CONFIDENTIAL');
    expect(result.html).toContain('class="watermark"');
    expect(result.html).toContain('class="wm-tile"');

    const noWatermark = renderOperationsHealthHtml({ report: emptyReport() });
    expect(noWatermark.html).not.toContain('class="watermark"');
  });

  it('uses YYYY-MM-DD format and slugified org name in the filename', () => {
    const result = renderOperationsHealthHtml({
      report: emptyReport({ generatedAt: '2026-05-10T08:30:00.000Z' }),
      organizationName: 'Acme Inc., Łódź Branch!',
    });
    expect(result.filename).toContain('2026-05-10');
    expect(result.filename).toMatch(/^operations-health-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.html$/);
    expect(result.filename.toLowerCase()).toContain('acme-inc');
    expect(result.filename.toLowerCase()).toContain('lodz');
    expect(result.mimeType).toBe('text/html');
  });

  it('renders footer containing "Consultify Presentation Studio"', () => {
    const result = renderOperationsHealthHtml({ report: emptyReport() });
    expect(result.html).toContain('Consultify Presentation Studio');
    // Footer also contains a copyright marker.
    expect(result.html).toContain('©');
  });

  it('emits an @page A4 rule in the embedded <style>', () => {
    const result = renderOperationsHealthHtml({ report: emptyReport() });
    expect(result.html).toMatch(/<style[\s\S]*@page[\s\S]*A4[\s\S]*<\/style>/);
  });

  it('renders the warnings list when present and hides it when empty', () => {
    const withWarnings = renderOperationsHealthHtml({
      report: emptyReport({ warnings: ['runtime_events_unavailable', 'exports_unavailable'] }),
    });
    expect(withWarnings.html).toContain('<h2>Warnings</h2>');
    expect(withWarnings.html).toContain('runtime_events_unavailable');
    expect(withWarnings.html).toContain('exports_unavailable');

    const withoutWarnings = renderOperationsHealthHtml({ report: emptyReport() });
    expect(withoutWarnings.html).not.toContain('<h2>Warnings</h2>');
    expect(withoutWarnings.html).not.toContain('class="warnings-list"');
  });
});
