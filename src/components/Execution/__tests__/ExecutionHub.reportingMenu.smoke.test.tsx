/**
 * @vitest-environment node
 *
 * Regression guard for the Execution → Reporting row-menu declaration.
 * StandardTable uses the same composed sections for kebab and context menu,
 * so keeping one declaration here preserves their parity.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const executionHubSource = readFileSync(new URL('../ExecutionHub.tsx', import.meta.url), 'utf8');
const reportingMenuSource = executionHubSource.slice(
  executionHubSource.indexOf('const buildReportRowMenu'),
  executionHubSource.indexOf('const portfolioInitiatives')
);

describe('ExecutionHub Reporting row menu', () => {
  it('declares one context Open full and delegates the only preview to the manage block', () => {
    expect(reportingMenuSource).not.toContain("id: 'open_preview'");
    expect(reportingMenuSource.match(/id: 'open_full'/g)).toHaveLength(1);
    // DEC-397b (1.1-K6): `preview:` now also calls `jedenPanel.otworz()` (so a
    // row click after closing the panel with X reopens it) — the handler body
    // is a block, not a one-line arrow, but it still calls
    // `setReportPreviewId(report.id)` exactly once inside `universalHandlers`.
    expect(reportingMenuSource.match(/preview: \(\) => \{/g)).toHaveLength(1);
    expect(reportingMenuSource.match(/setReportPreviewId\(report\.id\)/g)).toHaveLength(1);

    const composedActionOrder = [
      ...Array.from(reportingMenuSource.matchAll(/id: '(open_[^']+)'/g), (match) => match[1]),
      ...(reportingMenuSource.includes('universalHandlers:') &&
      reportingMenuSource.includes('setReportPreviewId(report.id)')
        ? ['open_preview']
        : []),
    ];

    expect(composedActionOrder).toEqual(['open_full', 'open_preview']);
  });

  it('passes that single contract to StandardTable for both row-menu entry points', () => {
    expect(executionHubSource.match(/buildReportRowMenu\(r\)/g)).toHaveLength(1);
    expect(executionHubSource).toContain('rowMenu={(row) => {');
  });
});
