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
  it('declares direct preview/full actions and preserves the managed preview handler', () => {
    expect(reportingMenuSource.match(/id: 'open_preview'/g)).toHaveLength(1);
    expect(reportingMenuSource.match(/id: 'open_full'/g)).toHaveLength(1);
    expect(
      reportingMenuSource.match(/preview: \(\) => setReportPreviewId\(report\.id\)/g)
    ).toHaveLength(1);

    const composedActionOrder = [
      ...Array.from(reportingMenuSource.matchAll(/id: '(open_[^']+)'/g), (match) => match[1]),
      ...(reportingMenuSource.includes('universalHandlers:') &&
      reportingMenuSource.includes('preview: () => setReportPreviewId(report.id)')
        ? ['open_preview']
        : []),
    ];

    expect(composedActionOrder).toEqual(['open_preview', 'open_full', 'open_preview']);
  });

  it('passes that single contract to StandardTable for both row-menu entry points', () => {
    expect(executionHubSource.match(/buildReportRowMenu\(r\)/g)).toHaveLength(1);
    expect(executionHubSource).toContain('rowMenu={(row) => {');
  });
});
