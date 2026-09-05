/**
 * P7K — dev-render host dla TRZECH REALNYCH ekranów Wyników → KPI:
 *   `?widok=l1`  → `<ResultsKpiRegistryPage>`          tabela RAPORTÓW
 *   `?widok=l2`  → `<ResultsKpiScorecardDetailPage>`   raport = tabela mierników
 *   `?widok=l3`  → `<KpiToolPage>`                     karta N miernika
 *   `?podglad=1` (dla `l1`/`l2`) — klik w pierwszy wiersz, żeby zrzut objął
 *                 prawy panel podglądu.
 *   `?przewin=start` (dla `l2`) — tabela przewinięta do STYCZNIA zamiast do
 *                 miesiąca bieżącego; dowód, że przypięcie kolumn działa na
 *                 OBU krańcach przewijania (wymóg werdyktu 1c/K10).
 *
 * TO NIE JEST PROTOTYP. Mountowane są komponenty produkcyjne z `src/`, z ich
 * własnym routerem, własnymi wywołaniami API i własną powłoką — jedyne, co
 * jest podstawione, to WARSTWA SIECI (`Api.get` / `OrganizationApi`), tak samo
 * jak w istniejących ekranach `results-vnext-*` tego harnessu.
 *
 * DLACZEGO HARNESS, A NIE ZRZUT NA ŻYWO: sesja `ODBIOR_AUTH_STATE` z 05.09
 * nie ma już w `localStorage` klucza `token` (zmierzone: 100 kluczy, żadnego
 * `token`; aplikacja przekierowuje na `/login`), a nowa trasa
 * `GET .../scorecards/:id/periods` nie jest jeszcze wdrożona na staging —
 * zrzut „na żywo" poziomu 2 pokazałby więc tabelę BEZ ani jednej kolumny
 * okresu i skłamałby o stanie pracy. Ten harness pokazuje ten sam kod
 * produkcyjny z danymi w kształcie, który zwraca nowy serwer.
 *
 * DANE: raport „Plant Balanced Scorecard — Zakład DBR77" z arkusza
 * właściciela (`server/scripts/seed-wyniki-dbr77.ts`, raport
 * `evidence/seed-wyniki-dbr77/RAPORT.md`), z liczbami 1:1 z ZAAKCEPTOWANEGO
 * prototypu (`evidence/p7k-wyniki/prototype/kpi-l2--light.png`) — żeby zrzut
 * z produktu dało się porównać z prototypem bez tłumaczenia.
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ResultsKpiRegistryPage } from '../../src/components/ResultsVNext/ResultsKpiRegistryPage';
import { ResultsKpiScorecardDetailPage } from '../../src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage';
import { KpiToolPage } from '../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { ROUTES } from '../../src/routes/routeConfig';
import { Api } from '../../src/services/api';
import { OrganizationApi } from '../../src/services/api/organizations.api';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

const params = new URLSearchParams(window.location.search);
const widok = (params.get('widok') || 'l1') as 'l1' | 'l2' | 'l3';
const podglad = params.get('podglad') === '1';
const przewinDoStyczen = params.get('przewin') === 'start';

try {
  window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  // Czysty start: układ kolumn z poprzednich zrzutów nie może zmieniać obrazu.
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith('filterableTable.cols.results-vnext.kpi'))
    .forEach((k) => window.localStorage.removeItem(k));
} catch {
  // dev-render only
}

const SCORECARD_ID = 'sc-dbr77-plant-balanced-2026';
const SCORECARD_Q3_ID = 'sc-dbr77-produkcja-q3-2026';
const SCORECARD_JAKOSC_ID = 'sc-dbr77-jakosc-viii-2026';

const OSOBY = [
  { userId: 'user-piotr-demo', email: 'piotr.wisniewski@dbr77.com', name: 'Piotr Wiśniewski', role: 'owner', status: 'active' },
  { userId: 'user-anna', email: 'anna.kowalska@dbr77.com', name: 'Anna Kowalska', role: 'member', status: 'active' },
  { userId: 'user-marek', email: 'marek.zielinski@dbr77.com', name: 'Marek Zieliński', role: 'member', status: 'active' },
  { userId: 'user-joanna', email: 'joanna.lis@dbr77.com', name: 'Joanna Lis', role: 'member', status: 'active' },
  { userId: 'user-tomasz', email: 'tomasz.nowak@dbr77.com', name: 'Tomasz Nowak', role: 'member', status: 'active' },
  { userId: 'user-ewa', email: 'ewa.maj@dbr77.com', name: 'Ewa Maj', role: 'member', status: 'active' },
];

OrganizationApi.getOrganizationMembers = (async () => OSOBY) as typeof OrganizationApi.getOrganizationMembers;

const raport = (
  scorecardId: string,
  name: string,
  scopeType: string,
  ownerUserId: string,
  ownerName: string,
  reviewFrequency: string,
  editionLabel: string | null,
  revisionDate: string | null,
  updatedAt: string,
  description: string
) => ({
  scorecardId,
  organizationId: 'org-dbr77-demo',
  name,
  description,
  scopeType,
  scopeId: null,
  ownerUserId,
  ownerName,
  reviewFrequency,
  lifecycleStatus: 'active',
  editionLabel,
  revisionDate,
  preparedByUserId: ownerUserId,
  preparedByName: ownerName,
  rowVersion: 3,
  createdBy: ownerUserId,
  createdAt: '2026-01-04T08:00:00.000Z',
  updatedAt,
});

const RAPORTY = [
  raport(
    SCORECARD_ID,
    'Plant Balanced Scorecard — Zakład DBR77',
    'business_unit',
    'user-anna',
    'Anna Kowalska',
    'monthly',
    'edycja 03',
    '2026-09-05',
    '2026-09-05T09:12:00.000Z',
    'Karta wyników zakładu wg szablonu Plant Balanced Scorecard: 138 mierników w podziale na obszary, cel i rezultat miesiąc po miesiącu.'
  ),
  raport(
    SCORECARD_Q3_ID,
    'KPI produkcji — Q3 2026',
    'team',
    'user-marek',
    'Marek Zieliński',
    'quarterly',
    null,
    null,
    '2026-09-04T15:40:00.000Z',
    'Kwartalny przegląd mierników produkcji: OEE, przezbrojenia, awaryjność.'
  ),
  raport(
    SCORECARD_JAKOSC_ID,
    'KPI jakości — sierpień',
    'team',
    'user-joanna',
    'Joanna Lis',
    'monthly',
    null,
    null,
    '2026-09-03T11:05:00.000Z',
    'Miesięczny przegląd jakości: FPY, reklamacje, koszty braków.'
  ),
];

const rozklad = (
  safe: number,
  warning: number,
  critical: number,
  missing: number,
  openDeviationCases: number,
  byArea: { areaName: string | null; safe: number; warning: number; critical: number; missing: number }[]
) => ({
  safe,
  warning,
  critical,
  missing,
  totalVisible: safe + warning + critical + missing,
  openDeviationCases,
  byArea: byArea.map((a) => ({ ...a, totalVisible: a.safe + a.warning + a.critical + a.missing })),
});

/** Rozkład raportu głównego = liczby, które właściciel zaakceptował na prototypie. */
const ROZKLADY: Record<string, ReturnType<typeof rozklad>> = {
  [SCORECARD_ID]: rozklad(93, 21, 8, 16, 8, [
    { areaName: 'SPRZEDAŻ', safe: 12, warning: 4, critical: 2, missing: 2 },
    { areaName: 'PRODUKCJA', safe: 31, warning: 7, critical: 3, missing: 5 },
    { areaName: 'JAKOŚĆ', safe: 22, warning: 5, critical: 2, missing: 4 },
    { areaName: 'UTRZYMANIE RUCHU', safe: 16, warning: 3, critical: 1, missing: 3 },
    { areaName: 'BHP I ŚRODOWISKO', safe: 12, warning: 2, critical: 0, missing: 2 },
  ]),
  [SCORECARD_Q3_ID]: rozklad(17, 4, 2, 1, 2, [
    { areaName: 'PRODUKCJA', safe: 17, warning: 4, critical: 2, missing: 1 },
  ]),
  [SCORECARD_JAKOSC_ID]: rozklad(13, 3, 1, 1, 1, [
    { areaName: 'JAKOŚĆ', safe: 13, warning: 3, critical: 1, missing: 1 },
  ]),
};

const MIESIACE_2026 = Array.from({ length: 12 }, (_unused, i) => {
  const mm = String(i + 1).padStart(2, '0');
  const koniec = new Date(Date.UTC(2026, i + 1, 0, 23, 59, 59, 999)).toISOString();
  return {
    key: `2026-${mm}`,
    periodStart: new Date(Date.UTC(2026, i, 1)).toISOString(),
    periodEnd: koniec,
    isCurrent: i === 8,
  };
});

type Para = [number | null, number | null, 'on_target' | 'warning' | 'critical' | null];

/** Pozycja raportu + jej okresy. Liczby 1:1 z zaakceptowanego prototypu. */
const POZYCJE: {
  itemId: string;
  kpiId: string;
  kpiName: string;
  areaName: string;
  superiorOwnerName: string;
  indicatorType: 'settlement' | 'informational';
  benchmarkValue: number | null;
  limitPercent: number | null;
  unit: string;
  targetGeometry: string;
  ownerUserId: string;
  ownerName: string;
  formulaText: string;
  description: string;
  okresy: Para[];
  ytd: Para;
  stan: 'on_target' | 'warning' | 'critical' | null;
  otwarteKarty: number;
}[] = [
  {
    itemId: 'item-sprzedaz-netto',
    kpiId: 'kpi-sprzedaz-netto',
    kpiName: 'Wielkość sprzedaży netto',
    areaName: 'SPRZEDAŻ',
    superiorOwnerName: 'Dyrektor Sprzedaży',
    indicatorType: 'settlement',
    benchmarkValue: 12400,
    limitPercent: 5,
    unit: 'LC/1000',
    targetGeometry: 'threshold_min',
    ownerUserId: 'user-tomasz',
    ownerName: 'Tomasz Nowak',
    formulaText: 'suma sprzedaży netto z faktur wystawionych w miesiącu / 1000',
    description: 'Wartość sprzedaży netto zrealizowanej w okresie, bez korekt i zwrotów.',
    okresy: [
      [11200, 11050, 'warning'],
      [11300, 11260, 'on_target'],
      [11400, 11480, 'on_target'],
      [11600, 11690, 'on_target'],
      [11800, 11750, 'warning'],
      [11900, 12050, 'on_target'],
      [12000, 12180, 'on_target'],
      [12400, 11620, 'critical'],
      [12800, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    ytd: [98200, 94810, 'warning'],
    stan: 'critical',
    otwarteKarty: 1,
  },
  {
    itemId: 'item-przyjete-zamowienia',
    kpiId: 'kpi-przyjete-zamowienia',
    kpiName: 'Poziom przyjętych zamówień',
    areaName: 'SPRZEDAŻ',
    superiorOwnerName: 'Dyrektor Sprzedaży',
    indicatorType: 'settlement',
    benchmarkValue: 10900,
    limitPercent: 4,
    unit: 'LC/1000',
    targetGeometry: 'threshold_min',
    ownerUserId: 'user-ewa',
    ownerName: 'Ewa Maj',
    formulaText: 'suma wartości zamówień przyjętych do realizacji / 1000',
    description: 'Wartość zamówień potwierdzonych przez klienta w okresie.',
    okresy: [
      [9800, 9900, 'on_target'],
      [9950, 10050, 'on_target'],
      [10100, 10200, 'on_target'],
      [10250, 10340, 'on_target'],
      [10400, 10460, 'on_target'],
      [10450, 10600, 'on_target'],
      [10500, 10720, 'on_target'],
      [10900, 10540, 'warning'],
      [11100, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    ytd: [86000, 85440, 'warning'],
    stan: 'warning',
    otwarteKarty: 0,
  },
  {
    itemId: 'item-oee',
    kpiId: 'kpi-oee-montaz',
    kpiName: 'OEE linii montażowej',
    areaName: 'PRODUKCJA',
    superiorOwnerName: 'Dyrektor Operacyjny',
    indicatorType: 'settlement',
    benchmarkValue: 78,
    limitPercent: 3,
    unit: '%',
    targetGeometry: 'threshold_min',
    ownerUserId: 'user-marek',
    ownerName: 'Marek Zieliński',
    formulaText: 'dostępność × wydajność × jakość',
    description: 'Całkowita efektywność wyposażenia linii montażowej.',
    okresy: [
      [74, 75, 'on_target'],
      [75, 75, 'on_target'],
      [75, 76, 'on_target'],
      [76, 76, 'on_target'],
      [76, 77, 'on_target'],
      [77, 78, 'on_target'],
      [76, 77, 'on_target'],
      [78, 79, 'on_target'],
      [79, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    ytd: [76, 77, 'on_target'],
    stan: 'on_target',
    otwarteKarty: 0,
  },
  {
    itemId: 'item-przezbrojenia',
    kpiId: 'kpi-przezbrojenia',
    kpiName: 'Średni czas przezbrojenia',
    areaName: 'PRODUKCJA',
    superiorOwnerName: 'Dyrektor Operacyjny',
    indicatorType: 'informational',
    benchmarkValue: 28,
    limitPercent: 8,
    unit: 'min',
    targetGeometry: 'threshold_max',
    ownerUserId: 'user-marek',
    ownerName: 'Marek Zieliński',
    formulaText: 'suma czasów przezbrojeń / liczba przezbrojeń',
    description: 'Średni czas przejścia linii z jednego wyrobu na kolejny.',
    okresy: [
      [42, 41, 'on_target'],
      [40, 39, 'on_target'],
      [38, 38, 'on_target'],
      [36, 37, 'warning'],
      [35, 34, 'on_target'],
      [34, 33, 'on_target'],
      [32, 33, 'warning'],
      [30, 31, 'warning'],
      [28, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    ytd: [287, 286, 'on_target'],
    stan: 'warning',
    otwarteKarty: 0,
  },
  {
    itemId: 'item-fpy',
    kpiId: 'kpi-fpy',
    kpiName: 'Zgodność w pierwszym przejściu (FPY)',
    areaName: 'JAKOŚĆ',
    superiorOwnerName: 'Dyrektor Jakości',
    indicatorType: 'settlement',
    benchmarkValue: 98,
    limitPercent: 2,
    unit: '%',
    targetGeometry: 'threshold_min',
    ownerUserId: 'user-joanna',
    ownerName: 'Joanna Lis',
    formulaText: 'wyroby zgodne w pierwszym przejściu / wyroby ogółem × 100',
    description: 'Udział wyrobów zgodnych bez poprawek i przeróbek.',
    okresy: [
      [97, 97.4, 'on_target'],
      [97.2, 97.1, 'on_target'],
      [97.4, 97.6, 'on_target'],
      [97.6, 97.5, 'on_target'],
      [97.8, 96.8, 'critical'],
      [98, 97.9, 'on_target'],
      [98, 98.2, 'on_target'],
      [98, 96.9, 'critical'],
      [98, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    ytd: [97.6, 97.4, 'warning'],
    stan: 'critical',
    otwarteKarty: 2,
  },
  {
    itemId: 'item-wypadki',
    kpiId: 'kpi-wypadki',
    kpiName: 'Wypadki przy pracy',
    areaName: 'BHP I ŚRODOWISKO',
    superiorOwnerName: 'Pełnomocnik BHP',
    indicatorType: 'informational',
    benchmarkValue: 0,
    limitPercent: null,
    unit: 'szt.',
    targetGeometry: 'threshold_max',
    ownerUserId: 'user-anna',
    ownerName: 'Anna Kowalska',
    formulaText: 'liczba zdarzeń wypadkowych zgłoszonych w okresie',
    description: 'Zdarzenia wypadkowe zgłoszone i zarejestrowane w okresie.',
    okresy: [
      [0, 0, 'on_target'],
      [0, 0, 'on_target'],
      [0, 1, 'critical'],
      [0, 0, 'on_target'],
      [0, 0, 'on_target'],
      [0, 0, 'on_target'],
      [0, 0, 'on_target'],
      [0, 0, 'on_target'],
      [0, null, null],
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ],
    /* Bez zadeklarowanego limitu [%] stan YTD NIE jest liczony — kolumna
       pokazuje „—", a nie zgadnięte „w normie". */
    ytd: [0, 1, null],
    stan: 'on_target',
    otwarteKarty: 0,
  },
];

const POZYCJE_DTO = POZYCJE.map((p, index) => ({
  itemId: p.itemId,
  scorecardId: SCORECARD_ID,
  kpiId: p.kpiId,
  kpiName: p.kpiName,
  organizationId: 'org-dbr77-demo',
  role: index < 3 ? 'primary' : 'supporting',
  sortOrder: index + 1,
  displayConfig: null,
  areaName: p.areaName,
  superiorOwnerName: p.superiorOwnerName,
  indicatorType: p.indicatorType,
  benchmarkValue: p.benchmarkValue,
  limitPercent: p.limitPercent,
  unit: p.unit,
  targetGeometry: p.targetGeometry,
  measurementFrequencyDays: 30,
  ownerUserId: p.ownerUserId,
  ownerName: p.ownerName,
  description: p.description,
  formulaText: p.formulaText,
  addedBy: 'user-anna',
  addedByName: 'Anna Kowalska',
  addedAt: '2026-01-08T08:00:00.000Z',
}));

const MATRYCA = {
  scorecardId: SCORECARD_ID,
  year: 2026,
  granularity: 'month' as const,
  periods: MIESIACE_2026,
  items: POZYCJE.map((p) => ({
    kpiId: p.kpiId,
    itemId: p.itemId,
    cells: MIESIACE_2026.map((okres, i) => ({
      periodKey: okres.key,
      measurementId: p.okresy[i]?.[1] === null ? null : `m-${p.itemId}-${okres.key}`,
      targetValue: p.okresy[i]?.[0] ?? null,
      actualValue: p.okresy[i]?.[1] ?? null,
      performanceStatus: p.okresy[i]?.[2] ?? null,
      dataQualityStatus: p.okresy[i]?.[1] === null ? null : 'verified',
    })),
    ytdTargetValue: p.ytd[0],
    ytdActualValue: p.ytd[1],
    ytdPerformanceStatus: p.ytd[2],
    ytdAggregation: (p.unit === '%' ? 'average' : 'sum') as 'average' | 'sum',
    latestPerformanceStatus: p.stan,
    openDeviationCaseCount: p.otwarteKarty,
  })),
};

// ── Poziom 3 — karta miernika „Wielkość sprzedaży netto" ────────────────────

const KPI_L3_ID = 'kpi-sprzedaz-netto';

const KPI_L3 = {
  kpiId: KPI_L3_ID,
  organizationId: 'org-dbr77-demo',
  kpiCode: 'KPI-SPRZ-001',
  name: 'Wielkość sprzedaży netto',
  status: 'active',
  currentDefinitionVersionId: 'dv-sprzedaz-3',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'user-tomasz',
  rowVersion: 4,
  createdBy: 'user-anna',
  createdAt: '2026-01-04T08:00:00.000Z',
  updatedAt: '2026-09-01T07:30:00.000Z',
};

const WERSJA_L3 = {
  definitionVersionId: 'dv-sprzedaz-3',
  kpiId: KPI_L3_ID,
  organizationId: 'org-dbr77-demo',
  versionNumber: 3,
  name: 'Wielkość sprzedaży netto',
  description: 'Wartość sprzedaży netto zrealizowanej w okresie, bez korekt i zwrotów.',
  unit: 'LC/1000',
  targetGeometry: 'threshold_min',
  targetValue: 12400,
  targetMin: null,
  targetMax: null,
  warningLow: 11780,
  warningHigh: null,
  criticalLow: 11160,
  criticalHigh: null,
  binarySuccessValue: null,
  formulaText: 'suma sprzedaży netto z faktur wystawionych w miesiącu / 1000',
  approvalStatus: 'approved',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: null,
  createdBy: 'user-anna',
  createdAt: '2026-01-04T08:00:00.000Z',
  updatedAt: '2026-01-10T08:00:00.000Z',
  submittedBy: 'user-anna',
  submittedAt: '2026-01-05T08:00:00.000Z',
  approvedBy: 'user-piotr-demo',
  approvedAt: '2026-01-10T08:00:00.000Z',
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  rowVersion: 2,
};

const POMIAR_L3 = {
  measurementId: 'm-sprzedaz-2026-08',
  kpiId: KPI_L3_ID,
  definitionVersionId: 'dv-sprzedaz-3',
  organizationId: 'org-dbr77-demo',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-08-31T23:59:59.999Z',
  actualValue: 11620,
  periodTargetValue: 12400,
  performanceStatus: 'critical',
  dataQualityStatus: 'verified',
  correctionOfMeasurementId: null,
  correctionReason: null,
  source: 'Arkusz wyników DBR77 · eksport z ERP',
  evidenceRefs: [],
  notes: 'CEL 12 400 LC/1000 · Rezultat 11 620 LC/1000',
  recordedBy: 'user-tomasz',
  recordedAt: '2026-09-01T07:30:00.000Z',
};

const SPRAWA_L3 = {
  caseId: 'case-sprzedaz-2026-08',
  organizationId: 'org-dbr77-demo',
  kpiId: KPI_L3_ID,
  triggerMeasurementId: 'm-sprzedaz-2026-08',
  severity: 'critical',
  status: 'plan_required',
  escalated: false,
  escalatedAt: null,
  escalatedReason: null,
  escalatedBy: null,
  ownerUserId: 'user-tomasz',
  managerUserId: 'user-anna',
  detectedAt: '2026-09-01T07:31:00.000Z',
  responseDueAt: '2026-09-08T07:31:00.000Z',
  rootCauseSummary: 'Opóźnienie dwóch uruchomień u kluczowych odbiorców.',
  rootCauseCategory: 'process',
  recurrenceFlag: false,
  expectedRecoveryDate: '2026-09-18',
  expectedRecoveryValue: 12400,
  planSubmittedBy: null,
  planSubmittedAt: null,
  planApprovedBy: null,
  planApprovedAt: null,
  recoveryObservedBy: null,
  recoveryObservedAt: null,
  recoveryObservationMeasurementId: null,
  closedAt: null,
  closedBy: null,
  closeEffectivenessVerificationId: null,
  reopenedFromCaseId: null,
  rowVersion: 2,
  createdBy: 'system',
  createdAt: '2026-09-01T07:31:00.000Z',
  updatedAt: '2026-09-02T09:00:00.000Z',
};

const HISTORIA_L3 = [
  { entryId: 'h-3', kind: 'MEASUREMENT_RECORDED', summaryCode: 'Zapisano pomiar za sierpień 2026', occurredAt: '2026-09-01T07:30:00.000Z', sourceVersion: 4 },
  { entryId: 'h-2', kind: 'DEFINITION_APPROVED', summaryCode: 'Zatwierdzono wersję definicji v3', occurredAt: '2026-01-10T08:00:00.000Z', sourceVersion: 3 },
  { entryId: 'h-1', kind: 'KPI_CREATED', summaryCode: 'Utworzono miernik', occurredAt: '2026-01-04T08:00:00.000Z', sourceVersion: 1 },
];

// ── Warstwa sieci ───────────────────────────────────────────────────────────

Api.get = (async (url: string) => {
  if (url.startsWith('/vnext/results/kpi/scorecards?')) return { scorecards: RAPORTY };
  if (url.startsWith('/vnext/results/kpi/scorecards/for-kpi/')) return { scorecards: [RAPORTY[0]] };

  const detal = /^\/vnext\/results\/kpi\/scorecards\/([^/?]+)(\/[^?]*)?/.exec(url);
  if (detal) {
    const id = detal[1]!;
    const ogon = detal[2] ?? '';
    const raportRow = RAPORTY.find((r) => r.scorecardId === id);
    if (!raportRow) {
      const err: any = new Error('Not found');
      err.status = 404;
      throw err;
    }
    if (ogon === '') return { scorecard: raportRow };
    if (ogon === '/items') return { items: id === SCORECARD_ID ? POZYCJE_DTO : [] };
    if (ogon === '/status') return { distribution: ROZKLADY[id] };
    if (ogon.startsWith('/periods')) return { matrix: id === SCORECARD_ID ? MATRYCA : { ...MATRYCA, items: [] } };
    if (ogon.startsWith('/review-snapshots/published')) {
      /* Raport główny MA opublikowany przegląd za sierpień 2026 — stąd
         „VIII 2026 · edycja 03" w kolumnie OKRES. Pozostałe dwa nie mają
         (404 jest tu stanem OCZEKIWANYM) i pokazują okres bieżący. */
      if (id === SCORECARD_ID) {
        return {
          snapshot: {
            snapshotId: 'snap-2026-08',
            scorecardId: id,
            organizationId: 'org-dbr77-demo',
            reviewPeriodStart: '2026-08-01T00:00:00.000Z',
            reviewPeriodEnd: '2026-08-31T23:59:59.999Z',
            snapshotPayload: null,
            status: 'published',
            contentHash: null,
            publishedBy: 'user-anna',
            publishedByName: 'Anna Kowalska',
            publishedAt: '2026-09-05T09:00:00.000Z',
            supersededBySnapshotId: null,
            supersededAt: null,
            rowVersion: 2,
            createdBy: 'user-anna',
            createdByName: 'Anna Kowalska',
            createdAt: '2026-09-04T09:00:00.000Z',
            updatedAt: '2026-09-05T09:00:00.000Z',
          },
        };
      }
      const err: any = new Error('No published snapshot');
      err.status = 404;
      throw err;
    }
    if (ogon.startsWith('/review-snapshots')) return { snapshots: [] };
  }

  if (url.startsWith(`/vnext/results/kpi/${KPI_L3_ID}/version`)) return { definitionVersion: WERSJA_L3 };
  if (url.startsWith(`/vnext/results/kpi/${KPI_L3_ID}/measurements`)) return { measurements: [POMIAR_L3] };
  if (url.startsWith(`/vnext/results/kpi/${KPI_L3_ID}/history`)) return { entries: HISTORIA_L3, nextCursor: null };
  if (url.startsWith(`/vnext/results/kpi/${KPI_L3_ID}/initiative-impacts`)) return { impacts: [] };
  if (url.startsWith(`/vnext/results/kpi/${KPI_L3_ID}`)) return { kpi: KPI_L3 };
  if (url.startsWith('/vnext/results/kpi/deviation-cases')) return { cases: [SPRAWA_L3] };
  if (url.startsWith('/vnext/results/kpi?')) return { kpis: [KPI_L3] };
  return {};
}) as typeof Api.get;

// ── Zachowanie po zamontowaniu ──────────────────────────────────────────────

function usePoMontazu() {
  React.useEffect(() => {
    if (!podglad && !przewinDoStyczen) return undefined;
    const id = window.setTimeout(() => {
      if (podglad) {
        const wiersz = document.querySelector<HTMLElement>('tbody tr:not([data-group-row])');
        wiersz?.click();
      }
      if (przewinDoStyczen) {
        document.querySelectorAll<HTMLElement>('.overflow-x-auto').forEach((el) => {
          if (el.scrollWidth > el.clientWidth) el.scrollLeft = 0;
        });
      }
    }, 2600);
    return () => window.clearTimeout(id);
  }, []);
}

/**
 * Karta miernika woła `useOpenChatWithContext` (przycisk „Zapytaj Teresę"),
 * a ten hak wymaga `FeatureFlagsProvider`. W aplikacji provider stoi
 * BEZWARUNKOWO nad całym drzewem (`AppProviders.tsx:126`), więc to jest brak
 * PRZYRZĄDU, nie produktu — złapany pierwszym zrzutem poziomu 3, który zamiast
 * karty pokazał czerwony ślad stosu.
 */
const Powloka: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <FeatureFlagsProvider config={{ enableLocalOverrides: false }} showDevTools={false}>
    {children}
  </FeatureFlagsProvider>
);

const P7kWynikiKpiScreen: React.FC = () => {
  usePoMontazu();
  if (widok === 'l2') {
    return (
      <Powloka>
      <div className="h-screen bg-c-app">
        <MemoryRouter initialEntries={[`/results/kpi/scorecards/${SCORECARD_ID}`]}>
          <Routes>
            <Route path={ROUTES.RESULTS_KPI.SCORECARD} element={<ResultsKpiScorecardDetailPage />} />
          </Routes>
        </MemoryRouter>
      </div>
      </Powloka>
    );
  }
  if (widok === 'l3') {
    return (
      <Powloka>
        <div className="h-screen bg-c-app">
          <MemoryRouter initialEntries={[`/results/kpi/${KPI_L3_ID}?zbior=${SCORECARD_ID}`]}>
            <Routes>
              <Route path={ROUTES.RESULTS_KPI.TOOL} element={<KpiToolPage />} />
            </Routes>
          </MemoryRouter>
        </div>
      </Powloka>
    );
  }
  return (
    <Powloka>
      <div className="h-screen bg-c-app">
        <MemoryRouter initialEntries={[ROUTES.RESULTS_KPI.ROOT]}>
          <Routes>
            <Route path={ROUTES.RESULTS_KPI.ROOT} element={<ResultsKpiRegistryPage />} />
          </Routes>
        </MemoryRouter>
      </div>
    </Powloka>
  );
};

export default P7kWynikiKpiScreen;
