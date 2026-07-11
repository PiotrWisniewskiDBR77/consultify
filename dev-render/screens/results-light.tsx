/**
 * Mock host for <ResultsLightShell> — the Results/Rezultaty module surface.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 Scale-Up mock data shaped exactly like the shell's props contract
 * (mirrors kpiDomain.ts / ROITrackingView.tsx / StrategicLayerPanel.tsx —
 * see ResultsLightShell.tsx file header for the real engines each shape
 * comes from). All callbacks are no-ops except where noted.
 */
import React from 'react';

import ResultsLightShell, {
  type ResultsLightKpi,
  type ResultsLightObjective,
  type ResultsLightOkrSummary,
  type ResultsLightRoiItem,
  type ResultsLightRoiSummary,
} from '../../src/components/Results/ResultsLightShell';

const MOCK_KPIS: ResultsLightKpi[] = [
  {
    id: 'kpi-1',
    name: 'Marża brutto na projekt',
    initiativeName: 'Standaryzacja ofertowania',
    ownerName: 'Piotr W.',
    actualValue: 34,
    targetValue: 40,
    unit: '%',
    status: 'below',
    trend: 'up',
    baselineValue: 28,
  },
  {
    id: 'kpi-2',
    name: 'Czas realizacji audytu (dni)',
    initiativeName: 'Automatyzacja raportów DRD',
    ownerName: 'Marta K.',
    actualValue: 9,
    targetValue: 7,
    unit: 'dni',
    status: 'below',
    trend: 'down',
    measurementFrequency: 'WEEKLY',
    baselineValue: 14,
  },
  {
    id: 'kpi-3',
    name: 'NPS klientów pilotażowych',
    initiativeName: 'Onboarding klienta DBR77',
    ownerName: 'Anna S.',
    actualValue: 62,
    targetValue: 55,
    unit: '',
    status: 'on-target',
    trend: 'up',
    measurementFrequency: 'MONTHLY',
    baselineValue: 40,
  },
  {
    id: 'kpi-4',
    name: 'Liczba aktywnych organizacji',
    initiativeName: 'Ekspansja rynkowa',
    ownerName: 'Piotr W.',
    actualValue: 18,
    targetValue: 25,
    unit: '',
    status: 'below',
    trend: 'up',
    measurementFrequency: 'MONTHLY',
    baselineValue: 6,
  },
  {
    id: 'kpi-5',
    name: 'Retencja 90-dniowa',
    initiativeName: 'Success playbook',
    ownerName: 'Marta K.',
    actualValue: null,
    targetValue: 80,
    unit: '%',
    status: 'no-data',
    trend: 'stable',
    needsEntry: true,
    measurementFrequency: 'QUARTERLY',
    baselineValue: null,
  },
  {
    id: 'kpi-6',
    name: 'Koszt akwizycji klienta (CAC)',
    initiativeName: 'Ekspansja rynkowa',
    ownerName: 'Anna S.',
    actualValue: 1450,
    targetValue: 1200,
    unit: 'EUR',
    status: 'below',
    trend: 'down',
    measurementFrequency: 'MONTHLY',
    baselineValue: 2100,
  },
];

const MOCK_ROI_ITEMS: ResultsLightRoiItem[] = [
  {
    initiativeId: 'init-1',
    initiativeName: 'Standaryzacja ofertowania',
    ownerName: 'Piotr W.',
    projectedBenefit: 180000,
    realizedBenefit: 142000,
    opexAnnual: 18000,
    hasRealized: true,
  },
  {
    initiativeId: 'init-2',
    initiativeName: 'Automatyzacja raportów DRD',
    ownerName: 'Marta K.',
    projectedBenefit: 95000,
    realizedBenefit: 108000,
    opexAnnual: 9000,
    hasRealized: true,
  },
  {
    initiativeId: 'init-3',
    initiativeName: 'Onboarding klienta DBR77',
    ownerName: 'Anna S.',
    projectedBenefit: 60000,
    realizedBenefit: 0,
    opexAnnual: 4000,
    hasRealized: false,
  },
  {
    initiativeId: 'init-4',
    initiativeName: 'Ekspansja rynkowa',
    ownerName: 'Piotr W.',
    projectedBenefit: 320000,
    realizedBenefit: 210000,
    opexAnnual: 42000,
    hasRealized: true,
  },
];

const MOCK_ROI_SUMMARY: ResultsLightRoiSummary = {
  totalProjected: MOCK_ROI_ITEMS.reduce((s, i) => s + i.projectedBenefit, 0),
  totalRealized: MOCK_ROI_ITEMS.reduce((s, i) => s + i.realizedBenefit, 0),
  totalOpex: MOCK_ROI_ITEMS.reduce((s, i) => s + (i.opexAnnual || 0), 0),
  totalCapex: 96000,
  coveragePercent: Math.round(
    (MOCK_ROI_ITEMS.filter((i) => i.hasRealized).length / MOCK_ROI_ITEMS.length) * 100
  ),
};

const MOCK_OBJECTIVES: ResultsLightObjective[] = [
  {
    id: 'obj-1',
    label: 'Skalować DBR77 do 25 aktywnych organizacji w Q3',
    parentId: null,
    keyResults: [],
    rollupScore: 0.62,
    cycleLabel: 'Q3 2026',
  },
  {
    id: 'obj-1a',
    label: 'Pozyskać 10 nowych organizacji pilotażowych',
    parentId: 'obj-1',
    keyResults: [
      { id: 'kr-1', label: 'Nowe organizacje', baseline: 6, target: 16, current: 18 },
      { id: 'kr-2', label: 'Konwersja lead → pilot', baseline: 12, target: 25, current: 19 },
    ],
    rollupScore: 0.78,
    cycleLabel: 'Q3 2026',
    lastCheckIn: '2026-07-08',
  },
  {
    id: 'obj-1b',
    label: 'Podnieść marżę brutto projektów do 40%',
    parentId: 'obj-1',
    keyResults: [
      { id: 'kr-3', label: 'Marża brutto (%)', baseline: 28, target: 40, current: 34 },
    ],
    rollupScore: 0.5,
    cycleLabel: 'Q3 2026',
    lastCheckIn: '2026-07-05',
  },
  {
    id: 'obj-2',
    label: 'Utrzymać retencję klientów pilotażowych >80%',
    parentId: null,
    keyResults: [
      { id: 'kr-4', label: 'Retencja 90-dniowa (%)', baseline: 55, target: 80, current: 55 },
    ],
    rollupScore: 0.28,
    cycleLabel: 'Q3 2026',
    lastCheckIn: '2026-06-29',
  },
];

const MOCK_OKR_SUMMARY: ResultsLightOkrSummary = {
  onTrack: MOCK_OBJECTIVES.filter((o) => o.rollupScore >= 0.7).length,
  atRisk: MOCK_OBJECTIVES.filter((o) => o.rollupScore >= 0.4 && o.rollupScore < 0.7).length,
  offTrack: MOCK_OBJECTIVES.filter((o) => o.rollupScore < 0.4).length,
  avgScore:
    MOCK_OBJECTIVES.reduce((s, o) => s + o.rollupScore, 0) / MOCK_OBJECTIVES.length,
};

export function ResultsLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <ResultsLightShell
      projectName="DBR77 Scale-Up"
      status="IN_REALIZATION"
      periodLabel="Q3 2026"
      updatedLabel="dziś"
      kpis={MOCK_KPIS}
      roiItems={MOCK_ROI_ITEMS}
      roiSummary={MOCK_ROI_SUMMARY}
      objectives={MOCK_OBJECTIVES}
      okrSummary={MOCK_OKR_SUMMARY}
      onOpenChat={noop}
      onOpenKpi={noop}
      onOpenRoiItem={noop}
      onExportResults={noop}
    />
  );
}

export default ResultsLightScreen;
