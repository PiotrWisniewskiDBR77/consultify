/**
 * Automation Pipeline — worked-example fixture.
 *
 * Sourced verbatim from the doctrine's §7 worked example
 * (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/automation-pipeline.md): a B2B
 * services firm (~1200 employees), operations reported 22 automation ideas
 * after a first-year RPA pilot (3 point-bots, no shared ranking); the board
 * paused new submissions until the pipeline was put in order. Reproduces the
 * doctrine's illustrative 4-of-22 subset (processes A-D), each engineered to
 * land on a distinct technology tier / effort×impact quadrant so the fixture
 * exercises every branch of the synthesis engine:
 *   - A. Uzgadnianie faktur dostawców    -> IDP, quick win        (largest hidden FTE block; 80/20 scopable)
 *   - B. Onboarding nowego klienta       -> redesign-first        (loudest top-down ask, but
 *                                           18% exceptions + no dominant path = automating chaos)
 *   - C. Raport miesięczny statusu SLA   -> RPA, fill-in          (small, structured, already low effort)
 *   - D. Klasyfikacja i routing zgłoszeń -> IPA, strategic bet    (ML classification needed — a
 *                                           keyword-only RPA PoC scored ~40% accuracy)
 *   - E. Rejestracja prostych zwrotów    -> RPA, fill-in          (technically clean, but NO governance
 *                                           owner — doctrine §6.8: qualifies for quarters, stalls on the
 *                                           non-technical barrier; exercises the ownerReady effort penalty)
 *
 * Field convention (see index.ts `toAutomationPipelineSession` adapter
 * doc-comment): each `process-candidates` item carries OperationalItem +
 * lever/ruleness/dataStructure/stability/volumePerMonth/handlingMinutes/
 * exceptionRate/pathConcentration/apiAvailable/errorRisk/ownerReady/measured/
 * source/evidence; each `moves` item carries OperationalItem +
 * lever/processId/impact/effort/evidence. These are additive fields the
 * strict `OperationalItem` interface does not declare (it is intentionally
 * generic across all operational tools), so each section below is typed as
 * `OperationalItem & {...extras}` locally and assigned by reference into
 * `sections` — this satisfies structural typing without widening or touching
 * the shared store types.
 *
 * Used as: (a) the `toAutomationPipelineSession` self-test fixture, (b) a
 * seed/demo session for the tool, (c) a reference for QA/DoD screenshots.
 */

import type { OperationalItem, OperationalToolData } from '@/store/useToolStore';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';
import type { PipelineLeverId } from './deepeningLadder';
import type { DataStructure } from './automationPipelineEngine';

type Level = 'high' | 'medium' | 'low';

type PipelineCandidateItem = OperationalItem & {
  lever?: PipelineLeverId;
  ruleness?: Level;
  dataStructure?: DataStructure;
  stability?: Level;
  volumePerMonth?: number;
  handlingMinutes?: number;
  exceptionRate?: number;
  pathConcentration?: number;
  apiAvailable?: boolean;
  errorRisk?: Level;
  ownerReady?: boolean;
  measured?: boolean;
  source?: 'top-down' | 'process-mining' | 'task-mining';
  evidence?: string[];
};

type PipelineMoveItem = OperationalItem & {
  lever?: PipelineLeverId;
  processId?: string;
  evidence?: string[];
};

// ---------------------------------------------------------------------------
// Process candidates — 4 of the register's 22, spanning all four technology
// tiers + the redesign-first escape hatch. Units: volumePerMonth in cases/mo,
// handlingMinutes in manual minutes/case, exceptionRate/pathConcentration 0..1.
// ---------------------------------------------------------------------------

const processCandidates: PipelineCandidateItem[] = [
  {
    id: 'proces-a-faktury',
    title: 'A. Uzgadnianie faktur dostawców',
    description:
      'Ręczne uzgadnianie faktur z zamówieniami/dostawami. Dokumenty PDF w różnych formatach od ~40 dostawców. Nisko na liście zgłoszeń top-down (nikt się głośno nie skarżył) — process mining ujawnił największy pojedynczy blok FTE-godzin w całym rejestrze.',
    impact: 'high',
    effort: 'medium',
    category: 'accounts-payable',
    dataStructure: 'unstructured-doc',
    ruleness: 'high',
    stability: 'high',
    volumePerMonth: 3400,
    handlingMinutes: 40,
    exceptionRate: 0.05,
    pathConcentration: 0.9,
    apiAvailable: true,
    errorRisk: 'medium',
    ownerReady: true,
    measured: true,
    source: 'process-mining',
    evidence: [
      'Log ERP/ticketing 12 mies. — 3 400 transakcji/mies., wcześniej niewidoczne w zgłoszeniach top-down',
      'Próbka 50 PDF od 12 dostawców — 6 różnych layoutów, ~40 min ręcznej pracy/fakturę',
    ],
  },
  {
    id: 'proces-b-onboarding',
    title: 'B. Onboarding nowego klienta',
    description:
      'Zbieranie danych klienta, konfiguracja kont, pierwsze uruchomienie usługi. Najgłośniej zgłaszany pomysł (sponsor na poziomie dyrektora sprzedaży), wygląda na wysoki impact — ale proces jest w trakcie nieformalnego redesignu od 6 miesięcy.',
    impact: 'high',
    effort: 'high',
    category: 'sales-ops',
    dataStructure: 'unstructured-doc',
    ruleness: 'low',
    stability: 'low',
    volumePerMonth: 180,
    handlingMinutes: 90,
    exceptionRate: 0.18,
    pathConcentration: 0.45,
    apiAvailable: false,
    errorRisk: 'high',
    ownerReady: false,
    measured: true,
    source: 'top-down',
    evidence: [
      'Zgłoszenie dyrektora sprzedaży jako priorytet #1',
      'Audyt 90-dniowy: 18% przypadków wychodzi poza główną ścieżkę; 3 warianty >20% wolumenu każdy — brak ścieżki dominującej',
      'Proces w nieformalnym redesignie od 6 miesięcy',
    ],
  },
  {
    id: 'proces-c-raport-sla',
    title: 'C. Raport miesięczny statusu SLA',
    description:
      'Cykliczne generowanie i dystrybucja raportu SLA na bazie danych z systemu ticketowego. Niski wolumen, w pełni ustrukturyzowane dane — klasyczny fill-in, nie priorytet.',
    impact: 'low',
    effort: 'low',
    category: 'reporting',
    dataStructure: 'system',
    ruleness: 'high',
    stability: 'high',
    volumePerMonth: 12,
    handlingMinutes: 25,
    exceptionRate: 0.02,
    pathConcentration: 0.95,
    apiAvailable: true,
    errorRisk: 'low',
    ownerReady: true,
    measured: true,
    source: 'top-down',
    evidence: ['System ticketowy ma API eksportu danych SLA'],
  },
  {
    id: 'proces-d-routing',
    title: 'D. Klasyfikacja i routing zgłoszeń serwisowych',
    description:
      'Klasyfikacja pilności/tematu zgłoszenia z treści e-mail/tekstu swobodnego, następnie routing do właściwego zespołu. Zespół pierwotnie planował proste RPA po słowach kluczowych — PoC dał ~40% trafności, za mało dla produkcji.',
    impact: 'high',
    effort: 'high',
    category: 'service-desk',
    dataStructure: 'unstructured-doc',
    ruleness: 'medium',
    stability: 'high',
    volumePerMonth: 5600,
    handlingMinutes: 25,
    exceptionRate: 0.1,
    pathConcentration: 0.7,
    apiAvailable: false,
    errorRisk: 'high',
    ownerReady: true,
    measured: true,
    source: 'process-mining',
    evidence: [
      'PoC RPA po słowach kluczowych — ~40% trafności, niewystarczające do produkcji',
      '120 oznakowanych zgłoszeń — próbka walidacyjna do modelu klasyfikacji',
    ],
  },
  {
    id: 'proces-e-zwroty',
    title: 'E. Rejestracja prostych zwrotów w ERP',
    description:
      'Rejestracja zwrotów standardowych (dane systemowe, reguły w 100% jawne, API dostępne) — czysty, stabilny kandydat RPA. Kwalifikuje się technicznie od 2 kwartałów, ale dział zwrotów nie wyznaczył właściciela gotowego przejąć governance bota — pipeline stoi nie na technologii, lecz na barierze organizacyjnej.',
    impact: 'low',
    effort: 'low',
    category: 'operations',
    dataStructure: 'system',
    ruleness: 'high',
    stability: 'high',
    volumePerMonth: 300,
    handlingMinutes: 15,
    exceptionRate: 0.03,
    pathConcentration: 0.85,
    apiAvailable: true,
    errorRisk: 'low',
    ownerReady: false,
    measured: true,
    source: 'process-mining',
    evidence: [
      'Log ERP 12 mies. — 300 zwrotów/mies., stała ścieżka (85% wolumenu w dominującym wariancie)',
      'Brak wyznaczonego właściciela biznesowego governance bota — pozycja stoi od 2 kwartałów',
    ],
  },
];

// ---------------------------------------------------------------------------
// Moves — one per pipeline lever (discover/profile/technology×2/prioritize/
// sequence), W2-worthy: each carries evidence and maps to the final roadmap
// in the doctrine (§7 "Pipeline końcowy").
// ---------------------------------------------------------------------------

const moves: PipelineMoveItem[] = [
  {
    id: 'move-discover-mining',
    title: 'Zbierz realny wolumen z logów, nie z deklaracji',
    description:
      'Process mining ERP/ticketing (12 mies.) + task mining na próbie 2 tygodni na czterech procesach, zamiast polegać wyłącznie na zgłoszeniach top-down.',
    impact: 'high',
    effort: 'low',
    category: 'discover',
    lever: 'discover',
    evidence: ['Log ERP/ticketing 12 mies.', 'Task mining 2 tyg. — 4 procesy'],
  },
  {
    id: 'move-profile-b-redesign',
    title: 'Sprofiluj proces B jako "do redesignu", nie do automatyzacji',
    description:
      '18% wyjątków i brak dominującej ścieżki (koncentracja ścieżki 45%) — proces B odsyłamy do osobnej inicjatywy standaryzacji, re-ocena za 2 kwartały.',
    impact: 'high',
    effort: 'medium',
    category: 'profile',
    lever: 'profile',
    processId: 'proces-b-onboarding',
    evidence: [
      '18% wyjątków w 90-dniowej próbce',
      'Brak dominującej ścieżki — 3 warianty >20% wolumenu każdy',
    ],
  },
  {
    id: 'move-tech-a-idp',
    title: 'Dobierz IDP + RPA dla procesu A (nie samo RPA)',
    description:
      'Faktury dostawców w PDF różnych formatów wymagają ekstrakcji dokumentowej przed regułowym uzgadnianiem — czyste RPA utknie na parsowaniu.',
    impact: 'high',
    effort: 'medium',
    category: 'technology',
    lever: 'technology',
    processId: 'proces-a-faktury',
    evidence: ['Próbka 50 PDF od 12 dostawców — 6 różnych layoutów'],
  },
  {
    id: 'move-tech-d-ipa',
    title:
      'Dobierz IPA (ML klasyfikacja + RPA routing) dla procesu D, nie proste RPA po słowach kluczowych',
    description:
      'Test routingu po słowach kluczowych dał ~40% trafności — treść zgłoszeń jest zbyt swobodna dla czystych reguł; potrzebna klasyfikacja ML + regułowy routing.',
    impact: 'high',
    effort: 'high',
    category: 'technology',
    lever: 'technology',
    processId: 'proces-d-routing',
    evidence: ['PoC RPA po słowach kluczowych — 40% trafności', '120 oznakowanych zgłoszeń do walidacji modelu'],
  },
  {
    id: 'move-prioritize-quickwin-first',
    title: 'Uszereguj: quick win (A) przed strategic bet (D)',
    description:
      'Macierz effort×impact stawia proces A (IDP+RPA, effort średni) przed procesem D (IPA, effort wysoki) mimo mniejszego wolumenu — pierwszy żywy efekt buduje wiarygodność programu.',
    impact: 'high',
    effort: 'low',
    category: 'prioritize',
    lever: 'prioritize',
    processId: 'proces-a-faktury',
    evidence: ['Macierz effort×impact czterech kandydatów'],
  },
  {
    id: 'move-sequence-waves',
    title:
      'Sekwencjonuj fale: 0 (A) → 1 (pozostałe quick winy + CoE) → 2 (D etapami), równolegle redesign B',
    description:
      'Redesign procesu B biegnie równolegle, nie w kolejce automatyzacji — nie blokuje fal quick-win/strategic-bet.',
    impact: 'high',
    effort: 'medium',
    category: 'sequence',
    lever: 'sequence',
    evidence: ['Roadmap fal 0-2 zaakceptowany przez sponsora programu'],
  },
];

// ---------------------------------------------------------------------------
// Fixture — assembled OperationalToolData
// ---------------------------------------------------------------------------

export const AUTOMATION_PIPELINE_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal:
      'Uporządkować pipeline automatyzacji: zamienić 22 zgłoszone pomysły w ranking oparty na faktach (wolumen, regułowość, dane), nie na głośności zgłoszenia.',
    scope:
      'Dział operacji firmy usługowej B2B (~1200 pracowników), rok po pierwszym pilotażu RPA (3 boty punktowe, bez wspólnego rankingu); 4 ilustracyjne procesy-kandydaci z pełnego rejestru 22.',
    timeframe: 'medium',
    successSignal:
      'Zarząd odblokowuje budżet na Falę 0-1 na podstawie liczb (FTE-h, effort×impact), nie polityki; proces B przestaje być punktem sporu między sponsorem a zespołem automatyzacji.',
    assumptions:
      'Wolumen i czas manualny mierzone z logów ERP/ticketing i task miningu (próbka 2 tyg.), nie z deklaracji właścicieli procesów.',
    constraints:
      "Zarząd wstrzymał dalsze zgłoszenia do czasu uporządkowania pipeline'u; brak dodatkowego budżetu poza Falą 0-1 w tym kwartale.",
    kpiTarget:
      'Fala 0 odzyskuje automatyzowalne FTE-godziny procesu A (quick win) w <90 dni; 0 zł budżetu na automatyzację chaosu (procesy do redesignu).',
  }),
  sections: {
    'process-candidates': processCandidates,
    moves,
  },
};
