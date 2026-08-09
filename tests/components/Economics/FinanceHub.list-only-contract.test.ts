import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const financeHubSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Economics/FinanceHub.tsx'),
  'utf8'
);

describe('FinanceHub list-only contract', () => {
  it('does not mount analysis tools, planners or charts below Finance lists', () => {
    const forbiddenInlinePanels = [
      'BankingValuePanel',
      'CashForecastPanel',
      'DriverPlannerPanel',
      'DriverTreePanel',
      'EfficientFrontierPanel',
      'ExtendedRatiosPanel',
      'HeadcountPlannerPanel',
      'InvestmentAppraisalPanel',
      'MonteCarloNpvPanel',
      'RealOptionsPanel',
      'RollingForecastPanel',
      'ScenarioComputePanel',
      'ValuationVisualsPanel',
      'ValueAttributionPanel',
      'ValueCapturePipelinePanel',
      'ValueLedgerPanel',
      'ValueOfficePanel',
      'VarianceBridgePanel',
      'VarianceNarrationPanel',
      'WhatIfSensitivityPanel',
    ];

    expect(financeHubSource).toContain('Finance tabs are list surfaces.');
    for (const panelName of forbiddenInlinePanels) {
      expect(financeHubSource).not.toContain(panelName);
    }
  });
});
