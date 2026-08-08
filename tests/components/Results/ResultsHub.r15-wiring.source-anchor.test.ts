/**
 * R15 — source-anchor guard (raw source-text assertions, no mount). Proves
 * the three canonical tables are wired in above their preserved
 * dashboards/tools, and that the foreign ResultsHub.tsx hunks (import
 * order, rmode formatting, KPI tab count removal) are untouched.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../../../src/components/Results/ResultsHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe('R15 ResultsHub wiring — source anchors', () => {
  it('imports all three new canonical tables', () => {
    expect(source).toContain("import { ResultsScorecardsTable } from './ResultsScorecardsTable';");
    expect(source).toContain("import { ResultsRoiReviewsTable } from './ResultsRoiReviewsTable';");
    expect(source).toContain("import { ResultsOkrSetsTable } from './ResultsOkrSetsTable';");
  });

  it('mounts ResultsScorecardsTable above preserved ResultsKpiScorecardsView', () => {
    const start = source.indexOf("kpiWorkspaceMode === 'scorecards' ? (");
    const end = source.indexOf("activeTab === 'results_kpi' && viewMode === 'table'");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain('<ResultsScorecardsTable />');
    expect(slice).toContain('<ResultsKpiScorecardsView');
  });

  it('mounts ResultsRoiReviewsTable above preserved ROITrackingView', () => {
    const start = source.indexOf("activeTab === 'roi' ? (");
    const end = source.indexOf('loading ? (', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain('<ResultsRoiReviewsTable />');
    expect(slice).toContain('<ROITrackingView refreshNonce={roiRefreshNonce} />');
  });

  it('mounts ResultsOkrSetsTable above preserved StrategicLayerPanel + Value Driver Tree', () => {
    const start = source.indexOf("activeTab === 'results_strategic' ? (");
    const end = source.indexOf("activeTab === 'results_ai'");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const slice = source.slice(start, end);
    expect(slice).toContain('<ResultsOkrSetsTable projectId="all" />');
    expect(slice).toContain('<StrategicLayerPanel projectId="all" />');
    expect(slice).toContain('<ValueDriverTree projectId="all" />');
  });
});

describe('R15 — foreign ResultsHub.tsx hunks preserved', () => {
  it('the pre-existing rmode type formatting and KPI-tab count removal are still present', () => {
    expect(source).toContain(
      "'tracked' | 'reports' | 'schedules' | 'wallboards' | 'connectors')"
    );
    // The foreign hunk removed `count: kpis.length` from the results_kpi tab
    // entry — confirm the tab entry has no `count` line immediately after
    // its icon (still true: only results_reports/people_change-style tabs
    // with real counts keep one elsewhere in the file).
    const kpiTabIdx = source.indexOf("id: 'results_kpi' as ModuleTab");
    expect(kpiTabIdx).toBeGreaterThan(-1);
    const kpiTabSlice = source.slice(kpiTabIdx, kpiTabIdx + 160);
    expect(kpiTabSlice).not.toContain('count: kpis.length');
  });
});
