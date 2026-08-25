import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');

const gates = [
  [
    'src/components/ResultsVNext/ResultsVNextRegistryRouteBase.tsx',
    'isResultsVNextFlagEnabled(flag)',
  ],
  [
    'src/components/ResultsVNext/ResultsKpiRegistryPage.tsx',
    "isResultsVNextFlagEnabled('kpiRegistry')",
  ],
  [
    'src/components/ResultsVNext/ResultsOkrRegistryPage.tsx',
    "isResultsVNextFlagEnabled('okrRegistry')",
  ],
  [
    'src/components/ResultsVNext/ResultsRoiRegistryPage.tsx',
    "isResultsVNextFlagEnabled('roiRegistry')",
  ],
  [
    'src/components/ResultsVNext/kpiTool/KpiToolPage.tsx',
    "isResultsVNextFlagEnabled('kpiRegistry')",
  ],
  [
    'src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx',
    "isResultsVNextFlagEnabled('kpiRegistry')",
  ],
  [
    'src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx',
    "isResultsVNextFlagEnabled('kpiRegistry')",
  ],
  [
    'src/components/ResultsVNext/roi/RoiCaseToolPage.tsx',
    "isResultsVNextFlagEnabled('roiRegistry')",
  ],
  [
    'src/components/ResultsVNext/roi/ResultsRoiPirOutcomesPage.tsx',
    "isResultsVNextFlagEnabled('roiRegistry')",
  ],
  [
    'src/components/ResultsVNext/okr/OkrSetToolPage.tsx',
    "isResultsVNextFlagEnabled('okrRegistry')",
  ],
  [
    'src/components/ResultsVNext/okr/OkrProgramsPage.tsx',
    "isResultsVNextFlagEnabled('okrRegistry')",
  ],
  ['src/components/ResultsVNext/okr/OkrCyclesPage.tsx', "isResultsVNextFlagEnabled('okrRegistry')"],
  [
    'src/components/ResultsVNext/attention/ResultsAttentionPage.tsx',
    "isResultsVNextFlagEnabled('kpiRegistry')",
  ],
  [
    'src/components/ResultsVNext/attention/ResultsAttentionPage.tsx',
    "isResultsVNextFlagEnabled('okrRegistry')",
  ],
  ['src/components/Results/ResultsHub.tsx', "isResultsVNextFlagEnabled('kpiRegistry')"],
] as const;

describe('Results VNext flag-gate enumeration', () => {
  it.each(gates)('%s retains the declared gate', (file, token) => {
    expect(readFileSync(path.join(repoRoot, file), 'utf8')).toContain(token);
  });

  // FIX-6 (2026-08-25 odbiór dnia 4, nadzorca wariant a): the dedicated
  // `canonicalCutoverMount` bypass PROP is gone from both
  // `ResultsKpiScorecardsView.tsx` and `ResultsKpiRegistryPage.tsx` —
  // replaced by `initialTab === 'scorecards'` acting as the same
  // mount-time-fixed enablement signal (one caller ever set the old prop,
  // and it always paired it with this exact `initialTab` value, so the new
  // mechanic covers the identical edge case: the historical hub's
  // scorecards mount must never be strandable behind the `kpiRegistry`
  // rollout flag, same as before). This test now pins the ABSENCE of the
  // retired prop everywhere and the PRESENCE of its replacement in both
  // files, instead of counting bare string occurrences of a prop name that
  // no longer exists.
  it('keeps the historical scorecards bypass mechanism isolated, unrouted, and prop-free', () => {
    const routes = readFileSync(path.join(repoRoot, 'src/routes/AppRoutes.tsx'), 'utf8');
    const historicalAdapter = readFileSync(
      path.join(repoRoot, 'src/components/Results/ResultsKpiScorecardsView.tsx'),
      'utf8'
    );
    const registryPage = readFileSync(
      path.join(repoRoot, 'src/components/ResultsVNext/ResultsKpiRegistryPage.tsx'),
      'utf8'
    );
    const allSources = gates
      .map(([file]) => readFileSync(path.join(repoRoot, file), 'utf8'))
      .join('\n');

    expect(routes).not.toContain('<ResultsHub');
    expect(routes).not.toContain('<ResultsKpiScorecardsView');
    expect(historicalAdapter).not.toContain('canonicalCutoverMount');
    expect(registryPage).not.toContain('canonicalCutoverMount');
    expect(allSources).not.toContain('canonicalCutoverMount');
    expect(historicalAdapter).toContain('initialTab="scorecards"');
    expect(registryPage).toContain("initialTab === 'scorecards'");
  });
});
