/**
 * Mock host for <ExecutionLightShell> — the Execution / Program Management
 * module surface.
 *
 * Reuses the REAL component (no re-implementation) and feeds it realistic
 * DBR77 Scale-Up numbers shaped exactly like the engine output contracts:
 *   - program/initiatives: shape of `threeAxisReportService.ts`
 *     (`ThreeAxisAggregate`/`ThreeAxisRow` — T/Z/W + scheduleHealth/
 *     impactGap/deliveryPromise, RAG thresholds >=0.95 GREEN / >=0.85 AMBER).
 *   - alerts: shape of `executionTriageService.ts` (`Signal`/severity).
 *   - reports: shape of `src/components/Execution/executionReports.ts`
 *     (`ReportDef` catalog — audience/cadence/RAG).
 *   - decisions: decision-support items tied to risks (Management tab, per
 *     owner note #80b).
 */
import React from 'react';

import ExecutionLightShell, {
  type ExecutionAlertLite,
  type ExecutionDecisionLite,
  type ExecutionInitiativeRowLite,
  type ExecutionProgramSummaryLite,
  type ExecutionReportLite,
} from '../../src/components/Execution/ExecutionLightShell';

const INITIATIVES: ExecutionInitiativeRowLite[] = [
  {
    id: 'init-1',
    name: 'Standaryzacja ofertowania',
    ownerName: 'Piotr W.',
    T: { pct: 68, dataQuality: 'ok' },
    Z: { pct: 61, dataQuality: 'ok' },
    W: { pct: 79, dataQuality: 'ok' },
    rag: 'GREEN',
  },
  {
    id: 'init-2',
    name: 'Automatyzacja raportów DRD',
    ownerName: 'Marta K.',
    T: { pct: 82, dataQuality: 'ok' },
    Z: { pct: 55, dataQuality: 'ok' },
    W: { pct: 38, dataQuality: 'ok' },
    rag: 'RED',
  },
  {
    id: 'init-3',
    name: 'Onboarding klienta DBR77',
    ownerName: 'Anna S.',
    T: { pct: 45, dataQuality: 'ok' },
    Z: { pct: 48, dataQuality: 'ok' },
    W: { pct: 41, dataQuality: 'ok' },
    rag: 'AMBER',
  },
  {
    id: 'init-4',
    name: 'Ekspansja rynkowa',
    ownerName: 'Piotr W.',
    T: { pct: 30, dataQuality: 'ok' },
    Z: { pct: 33, dataQuality: 'ok' },
    W: { pct: null, dataQuality: 'missing' },
    rag: 'NA',
  },
  {
    id: 'init-5',
    name: 'Success playbook',
    ownerName: 'Marta K.',
    T: { pct: 91, dataQuality: 'ok' },
    Z: { pct: 87, dataQuality: 'ok' },
    W: { pct: 93, dataQuality: 'ok' },
    rag: 'GREEN',
  },
];

const PROGRAM: ExecutionProgramSummaryLite = {
  initiativeCount: INITIATIVES.length,
  T: { pct: 63, dataQuality: 'ok' },
  Z: { pct: 57, dataQuality: 'ok' },
  W: { pct: 58, dataQuality: 'ok' },
  scheduleHealth: { ratio: 0.9, rag: 'AMBER' },
  impactGap: { ratio: 0.82, rag: 'RED' },
  deliveryPromise: { ratio: 0.92, rag: 'AMBER' },
  rag: 'AMBER',
  engagementPct: 74,
  onTimePct: 68,
  peopleAssigned: 11,
  peopleCapacity: 14,
  overdueCount: 3,
};

const ALERTS: ExecutionAlertLite[] = [
  {
    id: 'alert-1',
    type: 'APPETITE_BREACH',
    severity: 'CRITICAL',
    title: 'Budżet „Automatyzacja raportów DRD" przekroczony o 18%',
    initiativeName: 'Automatyzacja raportów DRD',
    rationale: 'AC (koszt rzeczywisty) przewyższa BAC — CPI 0.82, poniżej progu 0.85. Wartość dostarczona (W=38%) nie nadąża za zadaniami (Z=55%).',
    suggestedAction: 'eskaluj do sponsora',
  },
  {
    id: 'alert-2',
    type: 'BLOCKED_LONG',
    severity: 'HIGH',
    title: 'Zadanie „Integracja API rachunkowości" zablokowane 9 dni',
    initiativeName: 'Automatyzacja raportów DRD',
    rationale: 'Brak odpowiedzi dostawcy zewnętrznego od 9 dni roboczych — najdłuższy blokada w portfelu.',
    suggestedAction: 'odblokuj',
  },
  {
    id: 'alert-3',
    type: 'DEPENDENCY_AT_RISK',
    severity: 'MEDIUM',
    title: 'Zależność „Onboarding klienta DBR77" → „Ekspansja rynkowa" zagrożona',
    initiativeName: 'Onboarding klienta DBR77',
    rationale: 'Termin zależności przesunięty dwukrotnie w ciągu 30 dni; harmonogram programu wrażliwy na dalsze opóźnienie.',
    suggestedAction: 'skoordynuj właścicieli zależności',
  },
  {
    id: 'alert-4',
    type: 'UNOWNED_RISK',
    severity: 'MEDIUM',
    title: 'Ryzyko „Brak danych wartości" bez właściciela',
    initiativeName: 'Ekspansja rynkowa',
    rationale: 'Oś W (wartość) pokazuje „n/d" — brak zamrożonego baseline KPI sprzężonego z targetem.',
    suggestedAction: 'przypisz właściciela',
  },
  {
    id: 'alert-5',
    type: 'STALE_INITIATIVE',
    severity: 'LOW',
    title: 'Brak aktualizacji statusu „Success playbook" od 12 dni',
    initiativeName: 'Success playbook',
    rationale: 'Inicjatywa w dobrej kondycji (GREEN), ale ostatni wpis postępu sprzed 12 dni — rutynowe przypomnienie.',
    suggestedAction: 'poproś o aktualizację statusu',
  },
];

const REPORTS: ExecutionReportLite[] = [
  { id: 'rep-1', title: 'Raport wykonawczy 3 osi — program', audience: 'Sponsor / zarząd', cadence: 'Co tydzień', rag: 'amber', lastRefreshLabel: 'Odświeżono dziś, 08:15' },
  { id: 'rep-2', title: 'Status portfela EVM (SPI/CPI)', audience: 'PMO', cadence: 'Co tydzień', rag: 'red', lastRefreshLabel: 'Odświeżono dziś, 08:15' },
  { id: 'rep-3', title: 'Raport zespołowy — obłożenie i zadania', audience: 'Kierownicy zespołów', cadence: 'Codziennie', rag: 'green', lastRefreshLabel: 'Odświeżono dziś, 07:00' },
  { id: 'rep-4', title: 'Raport ryzyk i blokad', audience: 'PMO + sponsor', cadence: 'Co tydzień', rag: 'red', lastRefreshLabel: 'Odświeżono wczoraj' },
  { id: 'rep-5', title: 'What-if — scenariusz przyspieszenia', audience: 'Zarząd', cadence: 'Na żądanie', rag: 'amber', lastRefreshLabel: 'Wygenerowano 3 dni temu' },
  { id: 'rep-6', title: 'Podsumowanie kwartalne programu', audience: 'Klient / zarząd', cadence: 'Kwartalnie', rag: 'green', lastRefreshLabel: 'Ostatnie: Q2 2026' },
];

const DECISIONS: ExecutionDecisionLite[] = [
  {
    id: 'dec-1',
    title: 'Zwiększyć budżet „Automatyzacja raportów DRD" o 15% czy ograniczyć zakres?',
    ownerName: 'Piotr W.',
    dueLabel: 'termin: 2 dni temu',
    priority: 'high',
    status: 'overdue',
    linkedRiskTitle: 'Budżet przekroczony o 18%',
  },
  {
    id: 'dec-2',
    title: 'Przydzielić dodatkową osobę do integracji API rachunkowości',
    ownerName: 'Marta K.',
    dueLabel: 'termin: jutro',
    priority: 'high',
    status: 'pending',
    linkedRiskTitle: 'Blokada 9 dni',
  },
  {
    id: 'dec-3',
    title: 'Zatwierdzić przesunięcie terminu zależności onboardingu',
    ownerName: 'Anna S.',
    dueLabel: 'termin: 5 dni',
    priority: 'medium',
    status: 'pending',
    linkedRiskTitle: 'Zależność zagrożona',
  },
  {
    id: 'dec-4',
    title: 'Zamrozić baseline KPI dla „Ekspansja rynkowa"',
    ownerName: 'Piotr W.',
    dueLabel: 'termin: 7 dni',
    priority: 'low',
    status: 'pending',
    linkedRiskTitle: 'Brak danych wartości',
  },
];

const TOP_ACTIONS = [
  'Eskaluj przekroczenie budżetu „Automatyzacja raportów DRD" do sponsora — dziś.',
  'Odblokuj integrację API rachunkowości — 9 dni bez odpowiedzi dostawcy.',
  'Skoordynuj właścicieli zależności onboarding → ekspansja rynkowa.',
];

const LINEAGE_SOURCES = [
  { label: 'Raport 3 osi', detail: 'threeAxisReportService · T/Z/W · SPI/impact-gap/delivery-promise' },
  { label: 'Rollup programu', detail: 'programRollupService · 5 inicjatyw · 2 projekty' },
  { label: 'Triage alertów', detail: 'executionTriageService · deterministyczny, bez LLM' },
  { label: 'Katalog raportów', detail: 'executionReports.ts · 6 z 11 raportów pokazanych' },
];

export function ExecutionLightScreen(): React.ReactElement {
  const noop = () => {};
  return (
    <ExecutionLightShell
      programName="DBR77 Scale-Up"
      periodLabel="Q3 2026"
      status="IN_REALIZATION"
      program={PROGRAM}
      initiatives={INITIATIVES}
      alerts={ALERTS}
      reports={REPORTS}
      decisions={DECISIONS}
      topActions={TOP_ACTIONS}
      lineageSources={LINEAGE_SOURCES}
      lastUpdatedLabel="Zaktualizowano dziś, 08:15 · triage alertów"
      onOpenChat={noop}
      onPublishSnapshot={noop}
      onOpenInitiative={noop}
      onOpenReport={noop}
      onOpenDecision={noop}
    />
  );
}

export default ExecutionLightScreen;
