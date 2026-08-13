/**
 * R14 T32-TABLE-T13 — source-anchor guard (raw source-text assertions, no
 * mount, matching the existing ExecutionHub.reportingMenu.smoke.test.tsx
 * precedent for this file). Proves the EVM/what-if analytics panels
 * (ExecutionIntelligencePanel/ExecutionChangeSignalsPanel/
 * ExecutionWhatIfSandbox) remain in the canonical 'list' tab and render as
 * its top analytics shelf before the StandardTable+preview block.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Execution/ExecutionHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe("ExecutionHub 'list' tab — integrated analytics shelf", () => {
  it('the three flag-gated panels appear before <StandardTable inside the list-tab branch', () => {
    const marker = source.indexOf("'list' (Portfolio) tab → StandardTable + StandardPreview");
    expect(marker).toBeGreaterThan(-1);
    const branch = source.slice(marker);

    const tableIdx = branch.indexOf('<StandardTable');
    const intelligenceIdx = branch.indexOf('<ExecutionIntelligencePanel');
    const changeSignalsIdx = branch.indexOf('<ExecutionChangeSignalsPanel');
    const whatIfIdx = branch.indexOf('<ExecutionWhatIfSandbox');

    expect(tableIdx).toBeGreaterThan(-1);
    expect(intelligenceIdx).toBeGreaterThan(-1);
    expect(changeSignalsIdx).toBeGreaterThan(intelligenceIdx);
    expect(whatIfIdx).toBeGreaterThan(changeSignalsIdx);
    expect(tableIdx).toBeGreaterThan(whatIfIdx);
  });

  it('all three panels are still present (relocated, not deleted)', () => {
    expect(source).toContain("isExecutionFlagEnabled('intelligence')");
    expect(source).toContain('<ExecutionIntelligencePanel projectId={currentProjectId || \'all\'} />');
    expect(source).toContain("isExecutionFlagEnabled('changeSignals')");
    expect(source).toContain('<ExecutionChangeSignalsPanel />');
    expect(source).toContain("isExecutionFlagEnabled('whatIfSandbox')");
    expect(source).toContain('<ExecutionWhatIfSandbox');
  });

  it('the real kebab (buildInitiativeRowMenu), real bulk status change, and real preview are untouched', () => {
    expect(source).toContain('const buildInitiativeRowMenu = useCallback(');
    expect(source).toContain('const handleBulkStatusChange = useCallback(');
    expect(source).toContain(
      "selection={{ selectedIds: summarySelectedIds, onChange: setSummarySelectedIds }}"
    );
  });
});

describe('ExecutionHub integration guards', () => {
  it('keeps the R12 T35 mount and the composed report preview/full menu contract', () => {
    expect(source).toContain('<ExecutionManagementView');
    const reportingMenuSource = source.slice(
      source.indexOf('const buildReportRowMenu'),
      source.indexOf('const portfolioInitiatives')
    );
    expect(reportingMenuSource.match(/id: 'open_preview'/g)).toHaveLength(1);
    expect(reportingMenuSource.match(/id: 'open_full'/g)).toHaveLength(1);
    expect(
      reportingMenuSource.match(/preview: \(\) => setReportPreviewId\(report\.id\)/g)
    ).toHaveLength(1);
  });
});
