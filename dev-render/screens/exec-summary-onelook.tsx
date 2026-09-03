/**
 * #77 / Z94 — Kokpit menedżera „pełna wizja McKinsey" (Summary one-look).
 * Montuje REALNY ExecutionSummaryOneLook (bezstanowy, props-driven) z mockiem
 * skali DBR77. Zero API/providerów — komponent nie fetchuje, dane wstrzykuje host.
 * Dane mocka odwzorowują kształt ExecutiveAggregateSnapshot + action-center.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import type {
  OneLookDecision,
  OneLookMilestone,
  OneLookRisk,
} from '../../src/components/Execution/ExecutionSummaryOneLook';
import ExecutionSummaryOneLook from '../../src/components/Execution/ExecutionSummaryOneLook';

const RISKS: OneLookRisk[] = [
  {
    id: 'r1',
    title: 'Dostawca MES opóźnia integrację API o 3 tygodnie',
    probability: 'high',
    impact: 'high',
    score: 20,
    ownerName: 'Tomasz Nowak',
    dueDate: '2026-07-24',
    mitigationStatus: 'w toku',
  },
  {
    id: 'r2',
    title: 'Brak akceptu budżetu CAPEX na linię pakowania',
    probability: 'medium',
    impact: 'high',
    score: 12,
    ownerName: 'Anna Kowalska',
    dueDate: '2026-07-18',
    mitigationStatus: null,
  },
  {
    id: 'r3',
    title: 'Rotacja brygadzistów zagraża programowi Lean',
    probability: 'medium',
    impact: 'medium',
    score: 6,
    ownerName: 'Marek Zieliński',
    dueDate: '2026-08-05',
    mitigationStatus: 'plan gotowy',
  },
];

const DECISIONS: OneLookDecision[] = [
  {
    id: 'd1',
    title: 'Zatwierdzić zmianę zakresu migracji legacy (−2 moduły)',
    kind: 'overdue',
    ownerName: 'Piotr Wiśniewski',
    ageDays: 6,
    context: 'Blokuje start fazy 2',
  },
  {
    id: 'd2',
    title: 'Rozstrzygnąć konflikt zasobów: DevOps vs. Integracja',
    kind: 'blocker',
    ownerName: 'Anna Kowalska',
    ageDays: 3,
    context: '2 inicjatywy wstrzymane',
  },
  {
    id: 'd3',
    title: 'Wybrać dostawcę szkoleń Lean (3 oferty)',
    kind: 'decision',
    ownerName: 'Marek Zieliński',
    ageDays: 2,
    context: 'Deadline oferty: 20 lip',
  },
  {
    id: 'd4',
    title: 'Zaakceptować przesunięcie kamienia „Go-live pilota"',
    kind: 'decision',
    ownerName: 'Piotr Wiśniewski',
    ageDays: 1,
    context: null,
  },
];

const MILESTONES: OneLookMilestone[] = [
  {
    id: 'm1',
    initiativeName: 'Automatyzacja linii pakowania',
    name: 'Go-live pilota linii 1',
    targetDate: '2026-07-21',
    status: 'na tor',
  },
  {
    id: 'm2',
    initiativeName: 'Rollup finansowy Q3',
    name: 'Zamknięcie testów UAT',
    targetDate: '2026-07-28',
    status: 'ryzyko',
  },
  {
    id: 'm3',
    initiativeName: 'Migracja legacy MES',
    name: 'Decyzja bramka fazy 2',
    targetDate: '2026-08-04',
    status: 'oczekuje',
  },
  {
    id: 'm4',
    initiativeName: 'Program szkoleń Lean',
    name: 'Start kohorty brygadzistów',
    targetDate: '2026-08-11',
    status: 'na tor',
  },
];

const ExecSummaryOneLookScreen: React.FC = () => {
  // G06 i18n (2026-09-03, agent/i18n-pl-en): ten mock przybijał `isPolish`
  // na sztywno `true` — komponent ma pełną obsługę bilingual przez
  // `isPolish` (patrz `tr(pl, en)` w `ExecutionSummaryOneLook.tsx`), a realny
  // `ExecutionHub.tsx:5869` już przekazuje `isPolish={isPolish}` liczone z
  // i18n. Czytamy `?lang=` przez `i18n.language`, żeby mock honorował to samo.
  const { i18n } = useTranslation();
  const isPolish = (i18n.language || 'pl').toLowerCase().startsWith('pl');
  return (
  <div className="min-h-screen bg-c-bg text-c-text">
    <ExecutionSummaryOneLook
      health={{ healthScore: 71, progressPercent: 58, phaseLabel: 'Faza 2 — Skalowanie' }}
      onTime={{
        onTimePercent: 67,
        onTrackCount: 8,
        atRiskCount: 3,
        delayedCount: 1,
        totalInitiatives: 12,
      }}
      value={{
        totalProjected: 2040000,
        totalRealized: 1348000,
        totalVariance: -692000,
        coveragePercent: 75,
        initiativeCount: 12,
      }}
      people={{
        utilizationPercent: 88,
        overallocatedCount: 2,
        underutilizedCount: 3,
        unassignedInitiatives: 1,
        headcount: 14,
      }}
      topRisks={RISKS}
      decisions={DECISIONS}
      milestones={MILESTONES}
      currency="PLN"
      isPolish={isPolish}
      generatedAt="2026-07-13T08:00:00Z"
    />
  </div>
  );
};

export default ExecSummaryOneLookScreen;
