import React, { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isFinanceValuePanelsEnabled } from '@/utils/financeValuePanelsFlag';

const PANELS = {
  bankingValue: lazy(() =>
    import('./panels/BankingValuePanel').then((m) => ({ default: m.BankingValuePanel }))
  ),
  cashForecast: lazy(() =>
    import('./panels/CashForecastPanel').then((m) => ({ default: m.CashForecastPanel }))
  ),
  driverPlanner: lazy(() =>
    import('./panels/DriverPlannerPanel').then((m) => ({ default: m.DriverPlannerPanel }))
  ),
  driverTree: lazy(() =>
    import('./panels/DriverTreePanel').then((m) => ({ default: m.DriverTreePanel }))
  ),
  extendedRatios: lazy(() =>
    import('./panels/ExtendedRatiosPanel').then((m) => ({ default: m.ExtendedRatiosPanel }))
  ),
  headcountPlanner: lazy(() =>
    import('./panels/HeadcountPlannerPanel').then((m) => ({ default: m.HeadcountPlannerPanel }))
  ),
  investmentAppraisal: lazy(() =>
    import('./panels/InvestmentAppraisalPanel').then((m) => ({
      default: m.InvestmentAppraisalPanel,
    }))
  ),
  rollingForecast: lazy(() =>
    import('./panels/RollingForecastPanel').then((m) => ({ default: m.RollingForecastPanel }))
  ),
  valuationVisuals: lazy(() =>
    import('./panels/ValuationVisualsPanel').then((m) => ({ default: m.ValuationVisualsPanel }))
  ),
  valueAttribution: lazy(() =>
    import('./panels/ValueAttributionPanel').then((m) => ({ default: m.ValueAttributionPanel }))
  ),
  valueCapture: lazy(() =>
    import('./panels/ValueCapturePipelinePanel').then((m) => ({
      default: m.ValueCapturePipelinePanel,
    }))
  ),
  valueLedger: lazy(() =>
    import('./panels/ValueLedgerPanel').then((m) => ({ default: m.ValueLedgerPanel }))
  ),
  valueOffice: lazy(() =>
    import('./panels/ValueOfficePanel').then((m) => ({ default: m.ValueOfficePanel }))
  ),
  varianceBridge: lazy(() =>
    import('./panels/VarianceBridgePanel').then((m) => ({ default: m.VarianceBridgePanel }))
  ),
  varianceNarration: lazy(() =>
    import('./panels/VarianceNarrationPanel').then((m) => ({
      default: m.VarianceNarrationPanel,
    }))
  ),
  evBasket: lazy(() =>
    import('./panels/EvBasketFootballField').then((m) => ({ default: m.EvBasketFootballField }))
  ),
  monteCarlo: lazy(() =>
    import('./panels/MonteCarloNpvPanel').then((m) => ({ default: m.MonteCarloNpvPanel }))
  ),
  realOptions: lazy(() =>
    import('./panels/RealOptionsPanel').then((m) => ({ default: m.RealOptionsPanel }))
  ),
  frontier: lazy(() =>
    import('./panels/EfficientFrontierPanel').then((m) => ({ default: m.EfficientFrontierPanel }))
  ),
  sensitivity: lazy(() =>
    import('./panels/WhatIfSensitivityPanel').then((m) => ({ default: m.WhatIfSensitivityPanel }))
  ),
  scenarios: lazy(() =>
    import('./panels/ScenarioComputePanel').then((m) => ({ default: m.ScenarioComputePanel }))
  ),
} as const;

type PanelId = keyof typeof PANELS;

/**
 * i18n keys + Polish/English defaults for the 21 value-panel tab labels.
 * F-M1 (2026-09-05): these were hardcoded English strings outside `t()` —
 * see `docs/program/PROGRAM_NAPRAWCZY_20260905/F0_FINANSE_AUDYT_LUKI_20260905.md`
 * §3. Method acronyms (NPV, EV, DCF...) are kept per the exempt list in
 * `src/components/Finance/labels/financeEnums.ts`.
 */
const LABEL_KEYS: Record<PanelId, { key: string; pl: string; en: string }> = {
  bankingValue: { key: 'finance.valuePanels.bankingValue', pl: 'Wartość bankowa', en: 'Banking value' },
  cashForecast: { key: 'finance.valuePanels.cashForecast', pl: 'Prognoza gotówkowa', en: 'Cash forecast' },
  driverPlanner: { key: 'finance.valuePanels.driverPlanner', pl: 'Planer czynników', en: 'Driver planner' },
  driverTree: { key: 'finance.valuePanels.driverTree', pl: 'Drzewo czynników', en: 'Driver tree' },
  extendedRatios: {
    key: 'finance.valuePanels.extendedRatios',
    pl: 'Wskaźniki rozszerzone',
    en: 'Extended ratios',
  },
  headcountPlanner: {
    key: 'finance.valuePanels.headcountPlanner',
    pl: 'Planer zatrudnienia',
    en: 'Headcount planner',
  },
  investmentAppraisal: {
    key: 'finance.valuePanels.investmentAppraisal',
    pl: 'Ocena inwestycji',
    en: 'Investment appraisal',
  },
  rollingForecast: {
    key: 'finance.valuePanels.rollingForecast',
    pl: 'Prognoza krocząca',
    en: 'Rolling forecast',
  },
  valuationVisuals: {
    key: 'finance.valuePanels.valuationVisuals',
    pl: 'Wizualizacje wyceny',
    en: 'Valuation visuals',
  },
  valueAttribution: {
    key: 'finance.valuePanels.valueAttribution',
    pl: 'Atrybucja wartości',
    en: 'Value attribution',
  },
  valueCapture: {
    key: 'finance.valuePanels.valueCapture',
    pl: 'Ścieżka przechwytywania wartości',
    en: 'Value capture pipeline',
  },
  valueLedger: { key: 'finance.valuePanels.valueLedger', pl: 'Rejestr wartości', en: 'Value ledger' },
  valueOffice: { key: 'finance.valuePanels.valueOffice', pl: 'Biuro wartości', en: 'Value office' },
  varianceBridge: {
    key: 'finance.valuePanels.varianceBridge',
    pl: 'Mostek odchyleń',
    en: 'Variance bridge',
  },
  varianceNarration: {
    key: 'finance.valuePanels.varianceNarration',
    pl: 'Komentarz do odchyleń',
    en: 'Variance narration',
  },
  evBasket: { key: 'finance.valuePanels.evBasket', pl: 'Koszyk EV', en: 'EV basket' },
  monteCarlo: {
    key: 'finance.valuePanels.monteCarlo',
    pl: 'Symulacja Monte Carlo NPV',
    en: 'Monte Carlo NPV',
  },
  realOptions: { key: 'finance.valuePanels.realOptions', pl: 'Opcje rzeczywiste', en: 'Real options' },
  frontier: { key: 'finance.valuePanels.frontier', pl: 'Granica efektywna', en: 'Efficient frontier' },
  sensitivity: {
    key: 'finance.valuePanels.sensitivity',
    pl: 'Analiza wrażliwości (what-if)',
    en: 'What-if sensitivity',
  },
  scenarios: {
    key: 'finance.valuePanels.scenarios',
    pl: 'Obliczenia scenariuszy',
    en: 'Scenario compute',
  },
};

export function FinanceValuePanelsSurface(): React.ReactElement | null {
  const { t } = useTranslation();
  const [active, setActive] = useState<PanelId>('monteCarlo');
  if (!isFinanceValuePanelsEnabled()) return null;
  const Panel = PANELS[active];

  return (
    <section
      className="mb-3 rounded-xl border border-c-border bg-c-surface p-3"
      data-testid="finance-value-panels-surface"
    >
      <div
        className="mb-3 flex flex-wrap gap-2"
        role="tablist"
        aria-label={t('finance.valuePanels.ariaLabel', 'Valuation analysis panels')}
      >
        {(Object.keys(PANELS) as PanelId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className="rounded-lg border border-c-border px-3 py-1.5 text-sm text-c-text"
            onClick={() => setActive(id)}
          >
            {t(LABEL_KEYS[id].key, LABEL_KEYS[id].en)}
          </button>
        ))}
      </div>
      <Suspense
        fallback={
          <div className="p-6 text-c-text-muted">
            {t('finance.valuePanels.loading', 'Loading panel…')}
          </div>
        }
      >
        <Panel />
      </Suspense>
    </section>
  );
}

export default FinanceValuePanelsSurface;
