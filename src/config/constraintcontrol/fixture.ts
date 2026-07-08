/**
 * Constraint Control — worked-example fixture.
 *
 * Grounds the deterministic engine (constraintEngine.ts) and the conclusion
 * prompt builder (conclusionPrompts.ts) in a runnable example so the tool can
 * be self-tested and previewed without a live session. Lifted from the
 * doctrine's own worked example (§7, Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/
 * constraint-control.md): a consulting boutique's 5-stage delivery chain
 * (Discovery → Analysis → Draft → Partner Review → Presentation), where
 * Partner Review is the real, queue-evidenced constraint and Analysis is the
 * classic false-busy resource (95% utilized, queue not growing — not the
 * bottleneck).
 *
 * Field convention (see index.ts `toConstraintSession` adapter doc-comment):
 *   - `steps` section:  OperationalItem + capacity/demand/queue/queueTrend/utilization
 *   - `throughput` section: OperationalItem + sales/totallyVariableCost/operatingExpense/investment
 *   - `moves` section:  OperationalItem + step (focusing-step id)/evidence/capitalSpend
 * These are additive fields the strict `OperationalItem` interface does not
 * declare (it is intentionally generic across all 22 operational tools), so
 * each section below is typed as `OperationalItem & {...extras}` locally and
 * assigned by reference into `sections` — this satisfies structural typing
 * without widening or touching the shared store types.
 */

import type { OperationalItem, OperationalToolData } from '@/store/useToolStore';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';

type ConstraintStepItem = OperationalItem & {
  capacity?: number;
  demand?: number;
  queue?: number;
  queueTrend?: 'growing' | 'stable' | 'shrinking';
  utilization?: number;
};

type ThroughputItem = OperationalItem & {
  sales?: number;
  totallyVariableCost?: number;
  operatingExpense?: number;
  investment?: number;
};

type FocusMoveItemFixture = OperationalItem & {
  step?: 'identify' | 'exploit' | 'subordinate' | 'elevate' | 'policy';
  evidence?: string[];
  capitalSpend?: boolean;
};

// ---------------------------------------------------------------------------
// Steps — the 5-stage delivery chain. Units: capacity/demand in projects per
// month; queue in days a project waits before the step picks it up.
// ---------------------------------------------------------------------------

const stepsItems: ConstraintStepItem[] = [
  {
    id: 'step-discovery',
    title: 'Discovery z klientem',
    description: 'Wywiady, warsztaty otwierające i zbieranie materiałów wejściowych od klienta.',
    impact: 'medium',
    effort: 'medium',
    capacity: 12,
    demand: 10,
    queue: 0.5,
    queueTrend: 'stable',
    utilization: 0.83,
  },
  {
    id: 'step-analysis',
    title: 'Analiza danych / model',
    description:
      'Zespół analityczny buduje model i wnioski. Raportowane 95% obłożenie, ale kolejka przed etapem nie rośnie.',
    impact: 'medium',
    effort: 'medium',
    capacity: 10,
    demand: 10,
    queue: 0,
    queueTrend: 'stable',
    utilization: 0.95,
  },
  {
    id: 'step-draft',
    title: 'Draft rekomendacji (konsultant)',
    description: 'Konsultant pisze pierwszą wersję rekomendacji na bazie analizy.',
    impact: 'medium',
    effort: 'medium',
    capacity: 11,
    demand: 10,
    queue: 0.5,
    queueTrend: 'stable',
    utilization: 0.7,
  },
  {
    id: 'step-partner-review',
    title: 'Review przez Partnera',
    description:
      'Partner recenzuje każdy draft osobiście przed prezentacją klientowi. Kolejka rośnie tydzień po tygodniu.',
    impact: 'high',
    effort: 'high',
    capacity: 7,
    demand: 10,
    queue: 5,
    queueTrend: 'growing',
    utilization: 0.98,
  },
  {
    id: 'step-presentation',
    title: 'Prezentacja klientowi',
    description: 'Finalna prezentacja rekomendacji do klienta po akceptacji Partnera.',
    impact: 'low',
    effort: 'low',
    capacity: 14,
    demand: 10,
    queue: 0,
    queueTrend: 'stable',
    utilization: 0.6,
  },
];

// ---------------------------------------------------------------------------
// Throughput Accounting — T = Sales − TVC; Net Profit = T − OE; ROI = NetProfit / I.
// Single-row shape (all four figures on one item), in kPLN per month.
// ---------------------------------------------------------------------------

const throughputItems: ThroughputItem[] = [
  {
    id: 'throughput-monthly',
    title: 'Rachunek Przerobu — miesiąc bazowy',
    description:
      'Sprzedaż zafakturowanych projektów, koszt bezpośrednio zmienny (podwykonawcy/podróże), koszty operacyjne (etaty+najem) i kapitał związany w WIP.',
    impact: 'high',
    effort: 'low',
    sales: 600,
    totallyVariableCost: 60,
    operatingExpense: 380,
    investment: 220,
  },
];

// ---------------------------------------------------------------------------
// Moves — Five Focusing Steps candidates, TOC discipline order (Identify →
// Exploit → Subordinate → Elevate). No CAPEX before Exploit/Subordinate are
// exhausted; Elevate options carry capitalSpend=true.
// ---------------------------------------------------------------------------

const movesItems: FocusMoveItemFixture[] = [
  {
    id: 'move-identify-queue-map',
    title: 'Mapa kolejek per etap',
    description:
      'Zmierz kolejkę przed każdym z 5 etapów przez 4 tygodnie, nie tylko zapytaj kto "czuje się zawalony".',
    impact: 'high',
    effort: 'low',
    step: 'identify',
    evidence: [
      'Kolejka przed Review: 4-6 dni na projekt, rosnąca',
      'Kolejka przed Draft: 0.5 dnia, stabilna',
      'Analiza: 95% obłożenia, ale kolejka=0, nie rośnie',
    ],
  },
  {
    id: 'move-exploit-quality-gate',
    title: 'Bramka jakości przed przekazaniem do Partnera',
    description:
      'Checklist formatu i kompletności danych, egzekwowany PRZED wejściem draftu do kolejki Review, nie na etapie Partnera.',
    impact: 'high',
    effort: 'low',
    step: 'exploit',
    evidence: ['Audyt czasu Partnera: 40% Review idzie na poprawki formatu i luki w danych'],
  },
  {
    id: 'move-exploit-protected-blocks',
    title: 'Chronione bloki Review 2×2h dziennie',
    description: 'Dwa bloki po 2h dziennie wyłącznie na Review, bez przerywania spotkaniami wewnętrznymi.',
    impact: 'high',
    effort: 'low',
    step: 'exploit',
    evidence: ['Audyt czasu Partnera: pozostała część idzie na spotkania niezwiązane z Review'],
  },
  {
    id: 'move-exploit-priority-rule',
    title: 'Kolejność Review wg deadline klienta',
    description: 'Zamiast "kto pierwszy przyszedł" — reguła "najbliższy deadline klienta pierwszy".',
    impact: 'medium',
    effort: 'low',
    step: 'exploit',
    evidence: ['Obserwacja: obecna kolejność FIFO ignoruje pilność klienta'],
  },
  {
    id: 'move-subordinate-drum-buffer-rope',
    title: 'Zespół Draftu podporządkowany tempu Review (Rope)',
    description:
      'Instrukcja: nie przyśpieszać produkcji draftów ponad tempo realnego Review; harmonogram nowych projektów Discovery zsynchronizowany z przepustowością Review, nie z chęcią sprzedaży.',
    impact: 'high',
    effort: 'medium',
    step: 'subordinate',
    evidence: ['5 kroków ma rosnącą kolejkę tylko przy Review — nadprodukcja draftów puchnie WIP przed nim'],
  },
  {
    id: 'move-elevate-second-partner',
    title: 'Drugi Partner/Principal uprawniony do Review części projektów',
    description: 'Rozszerz uprawnienia sign-off na wybrane typy projektów, dopiero po wyczerpaniu Exploit/Subordinate.',
    impact: 'medium',
    effort: 'high',
    step: 'elevate',
    capitalSpend: true,
    evidence: ['Kolejka Review nadal rosnąca po wdrożeniu kroków 2-3 w symulacji pilotażowej'],
  },
  {
    id: 'move-elevate-review-template',
    title: 'Ustrukturyzowany template Review',
    description: 'Skraca czas per projekt przez wymuszenie jednolitej struktury draftu wchodzącego do Review.',
    impact: 'medium',
    effort: 'medium',
    step: 'elevate',
    capitalSpend: false,
    evidence: ['Analiza czasu Review: nieustrukturyzowane drafty wymagają 30% więcej czasu Partnera'],
  },
  {
    id: 'move-elevate-delegate-first-pass',
    title: 'Delegacja pierwszego przebiegu Review do Senior Managera',
    description: 'Senior Manager robi pierwszy przebieg, Partner podpisuje finalnie tylko wyjątki.',
    impact: 'medium',
    effort: 'high',
    step: 'elevate',
    capitalSpend: true,
    evidence: ['Senior Managerowie mają >70% zgodności z decyzjami Partnera w audycie próbek'],
  },
];

// ---------------------------------------------------------------------------
// Fixture — assembled OperationalToolData
// ---------------------------------------------------------------------------

export const CONSTRAINT_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal:
      'Znaleźć i usunąć realny constraint w łańcuchu dostawy projektów (Discovery→Analiza→Draft→Review→Prezentacja), by zlikwidować systematyczny poślizg 1-2 tygodni.',
    scope:
      'Butik doradczy realizujący projekty transformacyjne dla klientów korporacyjnych; 5-etapowy proces dostawy, portfel ~10 projektów/miesiąc.',
    timeframe: 'medium',
    successSignal: 'Kolejka przed etapem Review przestaje rosnąć i skraca się o min. 3 dni na projekt bez dodatkowego zatrudnienia.',
    assumptions:
      'Zespół Discovery i Analizy zgłasza 90%+ obłożenia i prosi o dodatkowych analityków; Partner mówi "jestem zawalony, ale to normalne".',
    constraints: 'Zero dodatkowego etatu Partnera w tym kwartale; rozwiązanie musi zadziałać w ramach obecnego zespołu.',
    kpiTarget: 'Skrócenie średniego czasu realizacji projektu o 1-2 tygodnie; kolejka Review ≤ 1 dzień.',
  }),
  sections: {
    steps: stepsItems,
    throughput: throughputItems,
    moves: movesItems,
  },
};
