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

  it('keeps the known historical canonicalCutoverMount bypass isolated and unrouted', () => {
    const routes = readFileSync(path.join(repoRoot, 'src/routes/AppRoutes.tsx'), 'utf8');
    const historicalAdapter = readFileSync(
      path.join(repoRoot, 'src/components/Results/ResultsKpiScorecardsView.tsx'),
      'utf8'
    );
    const allSources = gates
      .map(([file]) => readFileSync(path.join(repoRoot, file), 'utf8'))
      .join('\n');

    expect(routes).not.toContain('<ResultsHub');
    expect(routes).not.toContain('<ResultsKpiScorecardsView');
    expect(historicalAdapter).toContain('canonicalCutoverMount');
    expect(allSources.match(/canonicalCutoverMount/g)).toHaveLength(3);
  });
});
