/**
 * #81 — Results „3 pary" (KPI/ROI/OKR) redesign. Montuje REALNY
 * ResultsThreePairsView (bezstanowy, props-driven) z mockiem skali DBR77.
 * Zero API/providerów — komponent nie fetchuje, dane wstrzykuje host.
 */
import React from 'react';

import type {
  ThreePairKpi,
  ThreePairObjective,
  ThreePairRoi,
} from '../../src/components/Results/ResultsThreePairsView';
import ResultsThreePairsView from '../../src/components/Results/ResultsThreePairsView';

const KPIS: ThreePairKpi[] = [
  {
    id: 'k1',
    name: 'OEE linii pakowania',
    initiativeName: 'Automatyzacja raportowania OEE',
    unit: '%',
    baseline: 62,
    target: 78,
    current: 74,
    status: 'below',
    trend: 'up',
  },
  {
    id: 'k2',
    name: 'Czas cyklu zamknięcia miesiąca',
    initiativeName: 'Rollup finansowy Q3',
    unit: 'dni',
    baseline: 9,
    target: 5,
    current: 5,
    status: 'on-target',
    trend: 'down',
  },
  {
    id: 'k3',
    name: 'Redukcja kosztów pracy',
    initiativeName: 'Automatyzacja linii',
    unit: '%',
    baseline: 0,
    target: 22,
    current: 18,
    status: 'below',
    trend: 'up',
  },
  {
    id: 'k4',
    name: 'Pokrycie audytu dostawców',
    initiativeName: 'Przegląd dostawców krytycznych',
    unit: '%',
    baseline: 40,
    target: 100,
    current: null,
    status: 'no-data',
  },
  {
    id: 'k5',
    name: 'NPS wewnętrzny (zespoły)',
    initiativeName: 'Program szkoleń Lean',
    unit: 'pkt',
    baseline: 12,
    target: 30,
    current: 31,
    status: 'on-target',
    trend: 'up',
  },
];

const ROI: ThreePairRoi[] = [
  {
    initiativeId: 'i1',
    initiativeName: 'Automatyzacja linii pakowania',
    projectedBenefit: 480000,
    realizedBenefit: 512000,
    hasRealized: true,
    ownerName: 'Anna Kowalska',
  },
  {
    initiativeId: 'i2',
    initiativeName: 'Rollup finansowy — jedno źródło',
    projectedBenefit: 220000,
    realizedBenefit: 140000,
    hasRealized: true,
    ownerName: 'Piotr Wiśniewski',
  },
  {
    initiativeId: 'i3',
    initiativeName: 'Migracja legacy MES',
    projectedBenefit: 1250000,
    realizedBenefit: 0,
    hasRealized: false,
    ownerName: 'Tomasz Nowak',
  },
  {
    initiativeId: 'i4',
    initiativeName: 'Program szkoleń Lean dla brygadzistów',
    projectedBenefit: 90000,
    realizedBenefit: 96000,
    hasRealized: true,
    ownerName: 'Anna Kowalska',
  },
];

const OBJECTIVES: ThreePairObjective[] = [
  {
    id: 'o1',
    label: 'Zbudować cyfrową dojrzałość operacji do poziomu 4',
    rollupScore: 0.72,
    keyResults: [
      { id: 'kr1', label: 'Wdrożyć MES na 3 liniach', baseline: 0, target: 3, current: 2 },
      { id: 'kr2', label: 'OEE ≥ 78% na linii pakowania', baseline: 62, target: 78, current: 74 },
    ],
  },
  {
    id: 'o2',
    label: 'Uzyskać dyscyplinę finansową portfela inicjatyw',
    rollupScore: 0.55,
    keyResults: [
      { id: 'kr3', label: 'Zamknięcie miesiąca ≤ 5 dni', baseline: 9, target: 5, current: 5 },
      { id: 'kr4', label: '100% inicjatyw z ROI-netto', baseline: 40, target: 100, current: 62 },
    ],
  },
];

const ResultsThreePairsScreen: React.FC = () => (
  <div className="min-h-screen bg-c-bg text-c-text">
    <ResultsThreePairsView
      kpis={KPIS}
      roi={ROI}
      objectives={OBJECTIVES}
      currency="PLN"
      isPolish
      onAddKpi={() => {}}
      onNewRoi={() => {}}
      onManageOkr={() => {}}
      onOpenKpi={() => {}}
      onOpenRoi={() => {}}
      onOpenObjective={() => {}}
    />
  </div>
);

export default ResultsThreePairsScreen;
