/**
 * R14 T32-TABLE-T13 — source-anchor guard (raw source-text assertions, no
 * mount, matching the existing ExecutionHub.reportingMenu.smoke.test.tsx
 * precedent for this file). Proves the EVM/what-if analytics panels
 * (ExecutionIntelligencePanel/ExecutionChangeSignalsPanel/
 * ExecutionWhatIfSandbox) render AFTER the canonical StandardTable+preview
 * block inside the 'list' tab, not before it — and that the panels
 * themselves are preserved (not deleted).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Execution/ExecutionHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe("R14 ExecutionHub 'list' tab — analytics panels relocated below the table", () => {
  it('the three flag-gated panels appear after <StandardTable, not before it, inside the list-tab branch', () => {
    const marker = source.indexOf('T32 R14: EVM/what-if analytics panels moved BELOW');
    expect(marker).toBeGreaterThan(-1);
    const branchEnd = source.indexOf("if (activeTab === 'reports') {", marker);
    expect(branchEnd).toBeGreaterThan(marker);
    const branch = source.slice(marker, branchEnd);

    const tableIdx = branch.indexOf('<StandardTable');
    const intelligenceIdx = branch.indexOf('<ExecutionIntelligencePanel');
    const changeSignalsIdx = branch.indexOf('<ExecutionChangeSignalsPanel');
    const whatIfIdx = branch.indexOf('<ExecutionWhatIfSandbox');

    expect(tableIdx).toBeGreaterThan(-1);
    expect(intelligenceIdx).toBeGreaterThan(tableIdx);
    expect(changeSignalsIdx).toBeGreaterThan(tableIdx);
    expect(whatIfIdx).toBeGreaterThan(tableIdx);
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

describe('R14 — foreign hunks in ExecutionHub.tsx preserved byte-for-byte', () => {
  it('R12 T35 mount and prior-session report-menu simplification are still present', () => {
    expect(source).toContain('<ExecutionManagementView');
    const reportingMenuSource = source.slice(
      source.indexOf('const buildReportRowMenu'),
      source.indexOf('const portfolioInitiatives')
    );
    expect(reportingMenuSource).not.toContain("id: 'open_preview'");
    expect(reportingMenuSource.match(/id: 'open_full'/g)).toHaveLength(1);
  });
});
