/**
 * P7K część C — harness zrzutowy dla REALNYCH ekranów ROI:
 *   `?screen=p7k-c-roi&view=l1`  → `/results/roi`               (ResultsRoiRegistryPage)
 *   `?screen=p7k-c-roi&view=l2`  → `/results/roi/:roiCaseId`     (RoiCaseCardPage)
 *   `&sekcja=zalozenia|wyliczenia|realizacja` → która część karty ma być otwarta
 *
 * PO CO (CLAUDE.md #7): właściciel NIGDY nie jest pierwszym testerem wizualnym.
 * Ten plik montuje PRODUKCYJNE komponenty (nie ich kopie) z podstawionym
 * `window.fetch` dla dwóch nowych odczytów, żeby nadzorca zrobił zrzut ZANIM
 * ktokolwiek zobaczy ekran na żywo.
 *
 * DANE SĄ TE SAME, KTÓRE SEED ZAPISAŁ DO BAZY — przepisane z
 * `server/scripts/seed-wyniki-dbr77.ts` (trzy analizy DBR77, ich pozycje,
 * ryzyka, wariancje i przegląd PIR) i sprawdzone testem `.pg` na realnym
 * Postgresie. Nie są to liczby wymyślone pod ładny zrzut: gdyby harness
 * pokazywał inny model niż baza, zrzut nie byłby dowodem niczego (kształt
 * „przyrząd pokazuje nie produkt").
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ResultsRoiRegistryPage } from '../../src/components/ResultsVNext/ResultsRoiRegistryPage';
import { RoiCaseCardPage } from '../../src/components/ResultsVNext/roi/card/RoiCaseCardPage';
import type { RoiCaseCard, RoiRegistryRow } from '../../src/components/ResultsVNext/roi/card/roiCardApi';
import type { RoiCaseListItem } from '../../src/components/ResultsVNext/roi/roiApi';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { ROUTES } from '../../src/routes/routeConfig';
import { OrganizationApi } from '../../src/services/api/organizations.api';
import { useAppStore } from '../../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'l2' ? 'l2' : 'l1';
const caseParam = params.get('case') || 'case-robotyzacja';

useAppStore.setState({ currentOrganization: { id: 'org-dbr77', name: 'DBR77' } });
OrganizationApi.getOrganizationMembers = (async () => [
  { userId: 'u-tomasz', email: 'tomasz.nowak@dbr77.pl', name: 'Tomasz Nowak', role: 'owner', status: 'active' },
  { userId: 'u-marek', email: 'marek.zielinski@dbr77.pl', name: 'Marek Zieliński', role: 'member', status: 'active' },
  { userId: 'u-anna', email: 'anna.kowalska@dbr77.pl', name: 'Anna Kowalska', role: 'member', status: 'active' },
]) as typeof OrganizationApi.getOrganizationMembers;

try {
  window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
  const payload = btoa(JSON.stringify({ id: 'u-tomasz', exp: 9999999999 }));
  window.localStorage.setItem('token', `header.${payload}.signature`);
} catch {
  // dev-render only
}

// ==========================================================================
// Dane 1:1 z seeda DBR77
// ==========================================================================

const REGISTRY: RoiRegistryRow[] = [
  {
    caseId: 'case-robotyzacja',
    title: 'Robotyzacja gniazda spawalniczego',
    subjectType: 'Robotyzacja',
    optionVariant: 2,
    optionVariantLabel: 'Pełna automatyzacja',
    status: 'modeling',
    phase: 'realization',
    ownerUserId: 'u-tomasz',
    currency: 'PLN',
    analysisStart: '2026-01-01',
    analysisEnd: '2030-12-31',
    horizonYears: 5,
    capex: 1_000_000,
    annualNetBenefit: 400_000,
    roiPct: 100,
    paybackYears: 2.5,
    npv: 516_315,
    irrPct: 28.65,
    recommendation: 'conditional_go',
    recommendationCondition:
      'Potwierdzony wolumen dwóch zmian przez dwa kolejne kwartały przed podpisaniem umowy z integratorem.',
    updatedAt: '2026-09-05T08:00:00.000Z',
  },
  {
    caseId: 'case-wizja',
    title: 'System wizyjny kontroli jakości',
    subjectType: 'IT / jakość',
    optionVariant: 1,
    optionVariantLabel: 'Modernizacja kontroli',
    status: 'draft',
    phase: 'calculations',
    ownerUserId: 'u-marek',
    currency: 'PLN',
    analysisStart: '2026-01-01',
    analysisEnd: '2028-12-31',
    horizonYears: 3,
    capex: 620_000,
    annualNetBenefit: 238_000,
    roiPct: 15.16,
    paybackYears: 2.605,
    npv: null,
    irrPct: null,
    recommendation: 'go',
    recommendationCondition: null,
    updatedAt: '2026-09-05T08:00:00.000Z',
  },
  {
    caseId: 'case-magazyn',
    title: 'Automatyzacja magazynu WIP',
    subjectType: 'Magazyn',
    optionVariant: 3,
    optionVariantLabel: 'RaaS — robot jako usługa',
    status: 'draft',
    phase: 'assumptions',
    ownerUserId: 'u-anna',
    currency: 'PLN',
    analysisStart: '2027-01-01',
    analysisEnd: '2031-12-31',
    horizonYears: 5,
    capex: null,
    annualNetBenefit: null,
    roiPct: null,
    paybackYears: null,
    npv: null,
    irrPct: null,
    recommendation: null,
    recommendationCondition: null,
    updatedAt: '2026-09-05T08:00:00.000Z',
  },
];

/** `listRoiCases` niesie cykl życia — potrzebny chipom, kebabowi i przejściom. */
const CASES: RoiCaseListItem[] = REGISTRY.map((r, i) => ({
  caseId: r.caseId,
  organizationId: 'org-dbr77',
  initiativeId: `init-${i + 1}`,
  title: r.title,
  ownerUserId: r.ownerUserId,
  status: r.status as RoiCaseListItem['status'],
  currency: r.currency,
  granularity: 'annual',
  analysisStart: r.analysisStart,
  analysisEnd: r.analysisEnd,
  nextActionType: null,
  nextActionDueAt: null,
  nextReviewAt: null,
  submittedAt: null,
  approvedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  changesRequestedAt: null,
  changesRequestedReason: null,
  archivedAt: null,
  rowVersion: 1,
  createdAt: '2026-01-15T08:00:00.000Z',
  updatedAt: r.updatedAt,
}));

const CARD_ROBOTYZACJA: RoiCaseCard = {
  caseId: 'case-robotyzacja',
  organizationId: 'org-dbr77',
  initiativeId: 'init-1',
  title: 'Robotyzacja gniazda spawalniczego',
  status: 'modeling',
  ownerUserId: 'u-tomasz',
  currency: 'PLN',
  granularity: 'annual',
  analysisStart: '2026-01-01',
  analysisEnd: '2030-12-31',
  updatedAt: '2026-09-05T08:00:00.000Z',
  phase: 'realization',
  subjectType: 'Robotyzacja',
  optionVariant: 2,
  optionVariantLabel: 'Pełna automatyzacja',
  problemStatement:
    'Niestabilna wydajność gniazda nr 3 i brak spawaczy na rynku pracy: przy dwóch nieobecnościach gniazdo schodzi z taktu, a przeróbki sięgają 6,1 % detali.',
  scopeSummary:
    'Zakres techniczny: robot spawalniczy z pozycjonerem, ogrodzenie bezpieczeństwa, integracja z MES. Zakres organizacyjny: przeszkolenie 4 operatorów, nowa instrukcja kontroli pierwszej sztuki. Realizacja 6 miesięcy, eksploatacja 5 lat.',
  bauOptionLabel:
    'Wariant 0 — bez inwestycji: zatrudnienie 10 dodatkowych spawaczy w ciągu dwóch lat i utrzymanie obecnego poziomu przeróbek.',
  recommendation: 'conditional_go',
  recommendationCondition:
    'Potwierdzony wolumen dwóch zmian przez dwa kolejne kwartały przed podpisaniem umowy z integratorem.',
  baseline: {
    currentMeasuredValue: 1_240_000,
    currentMeasuredUnit: 'PLN',
    currentMeasuredAsOf: '2025-12-31',
    interventionComparisonNotes:
      'Roczny koszt spawania ręcznego (robocizna + przeróbki) w gnieździe nr 3, rok 2025.',
    source: 'seed:wyniki-dbr77-20260905',
    confidence: 'medium',
  },
  calculationPolicy: {
    discountRatePct: 10,
    taxTreatment: 'pre_tax',
    inflationRatePct: 3,
    requiredMetrics: ['roi', 'npv', 'irr', 'payback'],
    notes:
      'Wskaźniki liczone przy stopie dyskontowej 10 % w ujęciu rocznym, przed podatkiem. Rekomendacja CONDITIONAL GO ma własne pole na sprawie — ta notatka jest uzasadnieniem, nie nośnikiem decyzji.',
  },
  assumptions: [
    { assumptionId: 'a1', category: 'volume', label: 'Wolumen detali spawanych rocznie', unit: 'szt.', baseValue: 78000, downsideValue: 62000, upsideValue: 88000, confidence: 'medium', source: 'Plan sprzedaży 2027 + historia 2024-2025', sensitivityRank: 1, verdict: 'confirmed', verdictNote: 'Wolumen 78 tys. detali potwierdzony przez dwa kwartały — warunek rekomendacji spełniony.' },
    { assumptionId: 'a2', category: 'labour', label: 'Stawka godzinowa spawacza z narzutami', unit: 'PLN/h', baseValue: 96, downsideValue: 92, upsideValue: 112, confidence: 'high', source: 'Dział kadr, tabela stawek 2026', sensitivityRank: 2, verdict: 'partially_confirmed', verdictNote: 'Przesunięto 7 z 10 etatów; trzy stanowiska pozostały ze względu na detale spoza rodziny objętej robotem.' },
    { assumptionId: 'a3', category: 'contingency', label: 'Rezerwa na integrację (zawarta w CAPEX)', unit: '%', baseValue: 10, downsideValue: 10, upsideValue: 15, confidence: 'medium', source: 'Doświadczenie z wdrożenia linii montażu', sensitivityRank: 3, verdict: null, verdictNote: null },
    { assumptionId: 'a4', category: 'working_capital', label: 'ΔNWC — wzrost zapasu części zamiennych', unit: 'PLN', baseValue: 80000, downsideValue: 60000, upsideValue: 120000, confidence: 'medium', source: 'Lista części krytycznych robota', sensitivityRank: 4, verdict: null, verdictNote: null },
    { assumptionId: 'a5', category: 'opex', label: 'Przyrostowy OPEX (serwis, media, osprzęt)', unit: 'PLN/rok', baseValue: 45000, downsideValue: 38000, upsideValue: 62000, confidence: 'medium', source: 'Oferta serwisowa integratora', sensitivityRank: 5, verdict: null, verdictNote: null },
    { assumptionId: 'a6', category: 'ramp_up', label: 'Czas dojścia do pełnej wydajności', unit: 'tyg.', baseValue: 8, downsideValue: 8, upsideValue: 14, confidence: 'low', source: 'Założenie integratora — nie potwierdzone u nas', sensitivityRank: 6, verdict: 'refuted', verdictNote: 'Dojście do pełnej wydajności trwało 14 tygodni zamiast 8 — założenie integratora się nie potwierdziło.' },
  ],
  costLines: [
    { costLineId: 'c1', category: 'capex', label: 'Robot spawalniczy z osprzętem i integracją', description: 'Robot, pozycjoner, ogrodzenie, integracja i uruchomienie', amount: 909_000, currency: 'PLN', timingType: 'one_time', recurrenceCadence: null },
    { costLineId: 'c2', category: 'contingency', label: 'Rezerwa 10% na integrację', description: 'Rezerwa ujęta w CAPEX 1 000 000 zł', amount: 91_000, currency: 'PLN', timingType: 'one_time', recurrenceCadence: null },
  ],
  benefitLines: [
    { benefitLineId: 'b1', category: 'labour_savings', label: 'Redukcja pracochłonności spawania', description: '2 etaty spawacza przesunięte na obsługę gniazda', benefitClass: 'hard', isFinancial: true, amount: 260_000, currency: 'PLN', timingType: 'recurring', recurrenceCadence: 'annual', kpiChainNote: 'Roboczogodziny/szt. 0,42 → 0,18 → 2 etaty × 130 tys. zł pełnego kosztu zatrudnienia', doubleCountingGroup: null, doubleCountingResolutionNote: null },
    { benefitLineId: 'b2', category: 'quality_cost_avoided', label: 'Uniknięty koszt przeróbek i reklamacji', description: 'Spadek udziału przeróbek z 6,1 % do 1,8 %', benefitClass: 'avoided', isFinancial: true, amount: 90_000, currency: 'PLN', timingType: 'recurring', recurrenceCadence: 'annual', kpiChainNote: 'Scrap+rework 6,1 % → 1,8 % → 4,3 pp × 2,1 mln zł kosztu materiału', doubleCountingGroup: null, doubleCountingResolutionNote: null },
    { benefitLineId: 'b3', category: 'capacity', label: 'Odzyskana zdolność produkcyjna gniazda', description: 'Dodatkowa zmiana bez rozbudowy hali', benefitClass: 'hard', isFinancial: true, amount: 50_000, currency: 'PLN', timingType: 'recurring', recurrenceCadence: 'annual', kpiChainNote: 'OEE 62 % → 72 % → +4,2 tys. szt. × 12 zł marży kontrybucyjnej', doubleCountingGroup: null, doubleCountingResolutionNote: null },
    { benefitLineId: 'b4', category: 'ergonomics', label: 'Wyjście operatorów spod łuku spawalniczego', description: 'Raportowana, świadomie NIE monetyzowana (metodyka §35)', benefitClass: 'soft', isFinancial: false, amount: null, currency: null, timingType: 'recurring', recurrenceCadence: 'annual', kpiChainNote: 'Ekspozycja na dymy spawalnicze 6 h/zmianę → 0 h', doubleCountingGroup: null, doubleCountingResolutionNote: null },
    { benefitLineId: 'b5', category: 'scalability', label: 'Powtarzalność wdrożenia na gnieździe nr 5', description: 'Kompetencja i oprzyrządowanie do ponownego użycia', benefitClass: 'strategic', isFinancial: false, amount: null, currency: null, timingType: 'recurring', recurrenceCadence: 'annual', kpiChainNote: 'Czas uruchomienia kolejnego gniazda 6 → 3 miesiące', doubleCountingGroup: null, doubleCountingResolutionNote: null },
  ],
  risks: [
    { riskId: 'r1', category: 'wdrożeniowe', label: 'Ramp-up dłuższy niż zakładany', description: 'Integrator deklaruje 8 tygodni do pełnej wydajności; nie mamy własnego pomiaru z podobnego wdrożenia.', likelihood: 'high', impact: 'medium', mitigation: 'Kamień milowy odbiorowy po 8 tygodniach z karą umowną za przekroczenie.', ownerUserId: 'u-tomasz' },
    { riskId: 'r2', category: 'organizacyjne', label: 'Redukcja etatów niemożliwa do przeprowadzenia', description: 'Korzyść z pracy zakłada przesunięcie 2 etatów; bez zgody na przesunięcia korzyść nie powstaje.', likelihood: 'medium', impact: 'high', mitigation: 'Plan przesunięć uzgodniony z kadrami przed decyzją, nie po wdrożeniu.', ownerUserId: 'u-tomasz' },
    { riskId: 'r3', category: 'popytu', label: 'Brak wolumenu na drugą zmianę', description: 'Korzyść z odzyskanej zdolności wymaga sprzedaży dodatkowej produkcji.', likelihood: 'medium', impact: 'medium', mitigation: 'Warunek CONDITIONAL GO: dwa kwartały potwierdzonego wolumenu.', ownerUserId: 'u-tomasz' },
    { riskId: 'r4', category: 'CAPEX', label: 'Przekroczenie nakładu na integrację', description: 'Rezerwa 10 % przy tej dojrzałości projektu jest na dolnej granicy widełek 5-15 %.', likelihood: 'medium', impact: 'medium', mitigation: 'Zamówienie w formule ryczałtowej, zmiany zakresu tylko aneksem.', ownerUserId: 'u-tomasz' },
  ],
  indicators: {
    capex: 1_000_000,
    annualNetBenefit: 400_000,
    horizonYears: 5,
    roiPct: 100,
    arrPct: 40,
    paybackYears: 2.5,
    discountedPaybackYears: 3.019,
    npv: 516_314.71,
    irrPct: 28.649,
    profitabilityIndex: 1.5163,
    benefitCostRatio: 2,
    discountRatePct: 10,
  },
  storedRun: {
    runId: 'run-1',
    engineVersion: 'seed-wyniki-dbr77-v1',
    completedAt: '2026-09-05T08:00:00.000Z',
    totalCosts: 1_000_000,
    totalFinancialBenefits: 2_000_000,
    roiPct: 100,
    npv: 516_315,
    irrPct: 28.65,
    irrStatus: 'computed',
    paybackPeriods: 2.5,
    discountedPaybackPeriods: 3.02,
    benefitCostRatio: 2,
  },
  cashFlow: [
    { year: 0, label: '2026', costs: 1_000_000, benefits: 0, net: -1_000_000, cumulative: -1_000_000, discounted: -1_000_000, cumulativeDiscounted: -1_000_000 },
    { year: 1, label: '2027', costs: 0, benefits: 400_000, net: 400_000, cumulative: -600_000, discounted: 363_636, cumulativeDiscounted: -636_364 },
    { year: 2, label: '2028', costs: 0, benefits: 400_000, net: 400_000, cumulative: -200_000, discounted: 330_579, cumulativeDiscounted: -305_785 },
    { year: 3, label: '2029', costs: 0, benefits: 400_000, net: 400_000, cumulative: 200_000, discounted: 300_526, cumulativeDiscounted: -5_259 },
    { year: 4, label: '2030', costs: 0, benefits: 400_000, net: 400_000, cumulative: 600_000, discounted: 273_205, cumulativeDiscounted: 267_946 },
    { year: 5, label: '2031', costs: 0, benefits: 400_000, net: 400_000, cumulative: 1_000_000, discounted: 248_369, cumulativeDiscounted: 516_315 },
  ],
  sensitivity: [
    { driverId: 'capex', minusNpv: 716_315, minusRoiPct: 150, minusPaybackYears: 2, plusNpv: 316_315, plusRoiPct: 66.7, plusPaybackYears: 3 },
    { driverId: 'annual_benefit', minusNpv: 213_052, minusRoiPct: 60, minusPaybackYears: 3.125, plusNpv: 819_578, plusRoiPct: 140, plusPaybackYears: 2.083 },
    { driverId: 'discount_rate', minusNpv: 597_084, minusRoiPct: 100, minusPaybackYears: 2.5, plusNpv: 443_318, plusRoiPct: 100, plusPaybackYears: 2.5 },
  ],
  scenarios: [
    { scenarioId: 's1', scenarioType: 'downside', label: 'Wolniejszy ramp-up', description: 'Pełna wydajność dopiero po 14 tygodniach, korzyści przesunięte o kwartał', hasRun: false, roiPct: null, paybackYears: null, npv: null, irrPct: null },
    { scenarioId: 's2', scenarioType: 'upside', label: 'Druga zmiana od stycznia', description: 'Wolumen 88 tys. detali i pełne obłożenie gniazda od początku 2027', hasRun: false, roiPct: null, paybackYears: null, npv: null, irrPct: null },
  ],
  variances: [
    { varianceId: 'v1', metric: 'CAPEX', comparisonType: 'approved_vs_actual', expected: 1_000_000, actual: 1_080_000, varianceAmount: 80_000, variancePct: 8, status: 'explained' },
    { varianceId: 'v2', metric: 'Roczna korzyść', comparisonType: 'approved_vs_actual', expected: 400_000, actual: 312_000, varianceAmount: -88_000, variancePct: -22, status: 'explained' },
    { varianceId: 'v3', metric: 'Redukcja FTE', comparisonType: 'approved_vs_actual', expected: 10, actual: 7, varianceAmount: -3, variancePct: -30, status: 'explained' },
    { varianceId: 'v4', metric: 'Payback (lata)', comparisonType: 'approved_vs_actual', expected: 2.5, actual: 3.4615, varianceAmount: 0.9615, variancePct: 38.46, status: 'explained' },
  ],
  pirs: [
    {
      pirId: 'pir-1',
      sequenceNumber: 1,
      milestoneMonths: 6,
      status: 'finalized',
      outcome: 'benefits_partially_realized',
      lessonsLearned:
        'Ramp-up planować z własnego pomiaru, nie z deklaracji integratora. Plan przesunięć etatów uzgadniać przed decyzją inwestycyjną.',
      recommendation:
        'Korekta planu korzyści: roczna korzyść 312 tys. zł zamiast 400 tys. zł; utrzymać inwestycję, przegląd po 12 miesiącach.',
      realizedRoiPct: 44.4,
      realizedNpv: 102_725,
      realizedPaybackYears: 3.4615,
      startedAt: '2026-07-01T00:00:00.000Z',
      finalizedAt: '2026-07-15T00:00:00.000Z',
    },
  ],
};

const CARDS: Record<string, RoiCaseCard> = { 'case-robotyzacja': CARD_ROBOTYZACJA };

// ==========================================================================
// Podstawiony transport
// ==========================================================================

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

if (typeof window !== 'undefined') {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    // Flagi runtime: provider pyta o nie przy montażu. Bez tej reguły
    // harness produkuje 404 w konsoli, a próg odbioru brzmi „zero błędów
    // konsoli" — i zamiast defektu produktu mierzylibyśmy brak atrapy.
    if (url.includes('/api/feature-flags/runtime')) return jsonResponse({ flags: {} });

    const m = url.match(/\/vnext\/results\/roi(\/[^?]*)?/);
    if (!m) return realFetch(input as RequestInfo, init);
    const path = m[1] ?? '/';

    if (path === '/registry') return jsonResponse({ rows: REGISTRY });
    if (path === '/cases') return jsonResponse({ cases: CASES });
    if (path === '/visibility-policy/status') return jsonResponse({ status: { published: true } });

    const card = path.match(/^\/cases\/([^/]+)\/card$/);
    if (card) {
      const found = CARDS[decodeURIComponent(card[1]!)];
      return found
        ? jsonResponse({ card: found })
        : jsonResponse({ error: 'ROI case not found' }, 404);
    }

    const runs = path.match(/^\/cases\/([^/]+)\/calculation-runs$/);
    if (runs) return jsonResponse({ runs: [] });

    if (path === '/org/benefits-realization') {
      return jsonResponse({
        attention: {
          cases: [],
          portfolioTotals: {
            totalApprovedFinancialBenefits: 0,
            totalActualFinancialBenefits: 0,
            caseCountWithActual: 0,
            caseCountTotal: 0,
          },
        },
      });
    }

    return jsonResponse({ error: `harness p7k-c-roi: brak reguły dla ${path}` }, 404);
  };
}

const initialPath =
  view === 'l2' ? ROUTES.RESULTS_ROI.CARD.replace(':roiCaseId', caseParam) : ROUTES.RESULTS_ROI.ROOT;

/**
 * `FeatureFlagsProvider` jest WYMAGANY, nie ozdobny: karta woła
 * `useOpenChatWithContext` (wejście do Teresy), a ten hook czyta flagi. Bez
 * providera harness rzuca wyjątkiem i zrzut pokazałby pustą stronę — czyli
 * dokładnie ten rodzaj „dowodu", który niczego nie dowodzi. W produkcie
 * provider stoi wyżej, w `AppProviders`, więc to jest wyrównanie harnessu do
 * produktu, a nie obejście w produkcie.
 */
const P7kCRoiScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <FeatureFlagsProvider showDevTools={false}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path={ROUTES.RESULTS_ROI.ROOT} element={<ResultsRoiRegistryPage />} />
          <Route path={ROUTES.RESULTS_ROI.CARD} element={<RoiCaseCardPage />} />
        </Routes>
      </MemoryRouter>
    </FeatureFlagsProvider>
  </div>
);

export default P7kCRoiScreen;
