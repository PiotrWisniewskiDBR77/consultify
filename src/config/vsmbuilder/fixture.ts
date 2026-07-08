/**
 * VSM Builder — worked-example fixture (doctrine §7: order-to-shipment stream,
 * mid-size B2B manufacturer/logistics firm, current-state measured on one day
 * of gemba observation + follow-one-piece).
 *
 * Values are the doctrine's current-state table verbatim (C/T in minutes,
 * L/T converted to minutes so C/T and L/T share one unit — the engine is
 * unit-agnostic as long as they do):
 *
 *   step                          C/T   L/T        uptime  %C&A   WIP-before
 *   1 Wprowadzenie zamówienia     15m   4h  =240m   95%     92%    —
 *   2 Weryfikacja kredytowa       10m   1d  =1440m  90%     88%    12 zamówień
 *   3 Planowanie produkcji        20m   2d  =2880m  85%     95%    18 zamówień
 *   4 Produkcja (obróbka)         45m   1.5d=2160m  78%     91%    6 partii
 *   5 Kontrola jakości            12m   6h  =360m   97%     96%    3 partie
 *   6 Pakowanie i wysyłka         18m   8h  =480m   93%     99%    4 partie
 *
 * VA time = sum(C/T) = 120 min; total lead time = sum(L/T) = 7560 min (126h) —
 * matches doctrine's "PCE = 2h / 126h ≈ 1.6%". Largest WIP-before is step 3
 * (18 orders) while the longest C/T is step 4 (45 min, "Produkcja") — the
 * engine's `locateConstraint` picks step 3 as the TRUE constraint, differing
 * from the intuitive "longest step" (step 4), reproducing doctrine's insight
 * #3 verbatim ("Ograniczenie to Planowanie, nie Produkcja").
 *
 * Monthly volume = 200 orders/month (doctrine's hidden-factory example),
 * worst %C&A = step 2 at 88% (12% return rate), matching insight #4.
 *
 * CONTRACT NOTE (verified against index.ts/vsmEngine.ts, not assumed): the
 * `toVsmSession` adapter reads `sections['demand'][0]` / `sections['volume'][0]`
 * as RAW NUMBERS (`asNumber(...)`), not as `OperationalItem` objects — unlike
 * every other section, which holds `OperationalItem[]`. `OperationalItem`
 * (useToolStore.ts) also has no `cycleTime`/`leadTime`/`wipBefore`/`uptime`/
 * `completeAccurate`/`evidence` fields; the adapter reads those dynamically
 * off the generic item bag. This fixture types the `steps`/`moves` arrays with
 * local extensions of `OperationalItem` for authoring clarity, then widens the
 * whole `sections` value once at the boundary — the runtime shape is exactly
 * what `toVsmSession` (index.ts) expects; only the compile-time `OperationalItem[]`
 * label is nominal for these two keys.
 */

import type { InitiativeDraft, OperationalItem, OperationalToolData } from '@/store/useToolStore';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';

/** Process-step item shape actually read by `toVsmSession` for the `steps` section. */
type VsmStepFixtureItem = OperationalItem & {
  cycleTime: number;
  leadTime: number;
  wipBefore?: number;
  uptime: number;
  completeAccurate: number;
  monthlyVolume?: number;
  /** Muda type for a pure-waste step (read off `item.muda` by the adapter). */
  muda?: string;
};

/** Kaizen-move-candidate item shape actually read by `toVsmSession` for `moves`. */
type VsmMoveFixtureItem = OperationalItem & {
  evidence: string[];
};

const stepsSection: VsmStepFixtureItem[] = [
  {
    id: 'step-1-order-entry',
    title: 'Wprowadzenie zamówienia do systemu',
    description: 'Zamówienie klienta trafia do ERP; operator ręcznie wprowadza dane.',
    impact: 'low',
    effort: 'low',
    category: 'value-add',
    cycleTime: 15,
    leadTime: 240, // 4h
    uptime: 0.95,
    completeAccurate: 0.92,
    monthlyVolume: 200,
  },
  {
    id: 'step-2-credit-check',
    title: 'Weryfikacja kredytowa / akceptacja',
    description: 'Sprzedaż sprawdza limit kredytowy i akceptuje zamówienie do produkcji.',
    impact: 'medium',
    effort: 'low',
    category: 'value-add',
    cycleTime: 10,
    leadTime: 1440, // 1 dzień
    wipBefore: 12,
    uptime: 0.9,
    completeAccurate: 0.88,
  },
  {
    id: 'step-3-production-planning',
    title: 'Planowanie produkcji',
    description: 'Planista przydziela zamówienie do harmonogramu linii produkcyjnej.',
    impact: 'high',
    effort: 'medium',
    category: 'value-add',
    cycleTime: 20,
    leadTime: 2880, // 2 dni
    wipBefore: 18,
    uptime: 0.85,
    completeAccurate: 0.95,
  },
  {
    id: 'step-4-production',
    title: 'Produkcja (obróbka)',
    description: 'Fizyczna obróbka elementu na linii produkcyjnej.',
    impact: 'medium',
    effort: 'high',
    category: 'value-add',
    cycleTime: 45,
    leadTime: 2160, // 1,5 dnia
    wipBefore: 6,
    uptime: 0.78,
    completeAccurate: 0.91,
  },
  {
    id: 'step-5-quality-control',
    title: 'Kontrola jakości',
    description: 'Inspekcja gotowego elementu przed pakowaniem.',
    impact: 'low',
    effort: 'low',
    category: 'value-add',
    cycleTime: 12,
    leadTime: 360, // 6h
    wipBefore: 3,
    uptime: 0.97,
    completeAccurate: 0.96,
  },
  {
    id: 'step-6-pack-ship',
    title: 'Pakowanie i wysyłka',
    description: 'Pakowanie elementu i przekazanie do spedycji.',
    impact: 'low',
    effort: 'low',
    category: 'value-add',
    cycleTime: 18,
    leadTime: 480, // 8h
    wipBefore: 4,
    uptime: 0.93,
    completeAccurate: 0.99,
  },
];

const movesSection: VsmMoveFixtureItem[] = [
  {
    id: 'move-remap-cadence',
    title: 'Ustal kadencję re-mapowania co 90 dni po wdrożeniu',
    description:
      'Zaplanuj powtórne mapowanie stanu obecnego 90 dni po pierwszej interwencji, żeby zlokalizować, gdzie przesunęło się ograniczenie.',
    impact: 'medium',
    effort: 'low',
    category: 'flow',
    evidence: [
      'Doktryna §5.2: ograniczenie przesuwa się po każdym cyklu kaizen — brak re-mapowania traci efekt.',
    ],
  },
  {
    id: 'move-pull-signal',
    title: 'Pull-sygnał kanban krok 3 → krok 4 (Planowanie → Produkcja)',
    description:
      'Zastąpić harmonogram push raz dziennie sygnałem kanban ciągnącym pracę z produkcji, gdy ta ma zdolność.',
    impact: 'high',
    effort: 'medium',
    category: 'bottleneck',
    evidence: [
      'WIP przed krokiem 3 (Planowanie) = 18 zamówień — największa kolejka w strumieniu (gemba).',
      'Uptime kroku 4 (Produkcja) = 78%, ale ma nadmiarową zdolność względem tego, co dostaje w porę.',
    ],
  },
  {
    id: 'move-credit-validation-at-entry',
    title: 'Walidacja danych kredytowych przy wprowadzaniu zamówienia',
    description:
      'Dodać pole walidacji danych kredytowych na etapie wprowadzania zamówienia — przenieść kontrolę do źródła zamiast łapać brak danych w kroku 2.',
    impact: 'high',
    effort: 'medium',
    category: 'rework',
    evidence: [
      '%C&A kroku 2 (Weryfikacja kredytowa) = 88% — 12% zamówień wraca do sprzedaży po brakujące dane (gemba log).',
      'Przy 200 zamówień/miesiąc to ~24 zamówienia/mies. przechodzące dodatkową pętlę ~1 dzień każde.',
    ],
  },
  {
    id: 'move-consolidate-packing-shipping',
    title: 'Konsolidacja pakowania i wysyłki (jeden operator, nie przekazanie między działami)',
    description:
      'Połączyć kroki 5-6 pod jednym operatorem, eliminując przekazanie między kontrolą jakości a spedycją.',
    impact: 'medium',
    effort: 'low',
    category: 'waste',
    evidence: [
      'Obserwacja gemba: przekazanie krok 5 → krok 6 nie dodaje wartości i wprowadza opóźnienie transportowe.',
    ],
  },
];

const demandSection: number[] = [200]; // zamówień/miesiąc (doktryna §7)
const volumeSection: number[] = [200]; // wolumen jednostek/miesiąc — zasila hidden-factory cost
// Dostępny czas pracy: 20 dni roboczych × 8h × 60 min = 9600 min/miesiąc. Z popytem
// 200 zam./mies. daje takt time = 9600 / 200 = 48 min/zamówienie. Najdłuższy C/T to
// Produkcja = 45 min < 48 → żaden krok nie przekracza taktu: proces MA zdolność, by
// nadążyć za popytem, co potwierdza rdzeń diagnozy (problem to kolejki, nie moc).
const availableTimeSection: number[] = [9600];

const recommendedInitiatives: InitiativeDraft[] = [
  {
    id: 'vsm-init-pull-signal',
    title: 'Wdroż pull-sygnał kanban Planowanie → Produkcja',
    description:
      'Udrożnij PRAWDZIWE ograniczenie (krok 3, WIP 18 zamówień) sygnałem kanban zamiast harmonogramu push — pierwszy krok: kierownik planowania projektuje kartę kanban i próg zapasu.',
    type: 'operational',
    source: 'vsm-builder',
    linkedItems: ['step-3-production-planning', 'move-pull-signal'],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    rationale:
      'Kosztem skupienia zespołu na jednym kroku (odłożenie równoległej poprawy pozostałych) — odrzucamy inwestycję w drugą linię produkcyjną (krok 4), bo to optymalizacja nie-ograniczenia bez efektu na lead time całości.',
  },
  {
    id: 'vsm-init-credit-validation',
    title: 'Przenieś walidację danych kredytowych do źródła',
    description:
      'Domknij ukrytą fabrykę przeróbek kroku 2 (%C&A 88%) polem walidacji przy wprowadzaniu zamówienia — pierwszy krok: IT+sprzedaż specyfikują wymagane pola blokujące.',
    type: 'operational',
    source: 'vsm-builder',
    linkedItems: ['step-2-credit-check', 'move-credit-validation-at-entry'],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    rationale:
      'Kosztem pracy nad walidacją u źródła zamiast kontroli końcowej — odrzucamy dodanie kolejnej inspekcji na końcu, bo łapie błąd po fakcie i wydłuża lead time.',
  },
  {
    id: 'vsm-init-consolidate-packing',
    title: 'Skonsoliduj pakowanie i wysyłkę pod jednym operatorem',
    description:
      'Wyeliminuj przekazanie między działami w krokach 5-6 — pierwszy krok: kierownik magazynu przeszkala jednego operatora do obu czynności.',
    type: 'operational',
    source: 'vsm-builder',
    linkedItems: ['step-5-quality-control', 'step-6-pack-ship', 'move-consolidate-packing-shipping'],
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    rationale:
      'Kosztem uwagi, by nie usunąć kontroli jakości koniecznej regulacyjnie — cięcie przekazania, nie samej inspekcji.',
  },
];

// ---------------------------------------------------------------------------
// Secondary fixture — a waste-elimination scenario that exercises the pure-waste
// + 7-muda + over-takt paths the doctrine §7 order-to-shipment example does NOT
// feature (that one is a queue/rework story with every step value-add). Kept as
// a distinct fixture so the golden example stays faithful to the doctrine's
// verbatim numbers while the muda/takt logic still has real coverage.
//
// Stream (approvals process, unit = minutes):
//   1 Przyjęcie wniosku        VA          C/T 30  L/T 120   %C&A 90%  WIP —
//   2 Podwójne zatwierdzenie    pure-waste  C/T 60  L/T 960   %C&A 95%  WIP 20   muda: over-processing
//   3 Przekazanie między dz.    pure-waste  C/T 10  L/T 480   %C&A 80%  WIP 5    muda: transport
// VA time = 30; total lead time = 1560 → PCE ≈ 1.9%. 2/3 steps pure waste (67%),
// dominant muda tie broken to over-processing. availableTime 4800 / demand 100 →
// takt 48; step 2 (C/T 60) exceeds takt → cannot keep pace with demand. Worst
// %C&A = step 3 (80%) → hidden factory.
const wasteStepsSection: VsmStepFixtureItem[] = [
  {
    id: 'w-step-1-intake',
    title: 'Przyjęcie wniosku',
    description: 'Rejestracja wniosku klienta w systemie.',
    impact: 'low',
    effort: 'low',
    category: 'value-add',
    cycleTime: 30,
    leadTime: 120,
    uptime: 0.9,
    completeAccurate: 0.9,
    monthlyVolume: 100,
    measured: true,
  } as VsmStepFixtureItem,
  {
    id: 'w-step-2-double-approval',
    title: 'Podwójne zatwierdzenie',
    description: 'Dwa niezależne podpisy akceptujące, których nikt później nie czyta.',
    impact: 'high',
    effort: 'medium',
    category: 'pure-waste',
    muda: 'over-processing',
    cycleTime: 60,
    leadTime: 960,
    wipBefore: 20,
    uptime: 0.8,
    completeAccurate: 0.95,
    measured: true,
  } as VsmStepFixtureItem,
  {
    id: 'w-step-3-handoff',
    title: 'Przekazanie między działami',
    description: 'Przerzucenie sprawy z jednego systemu/działu do drugiego bez wartości.',
    impact: 'medium',
    effort: 'low',
    category: 'pure-waste',
    muda: 'transport',
    cycleTime: 10,
    leadTime: 480,
    wipBefore: 5,
    uptime: 0.95,
    completeAccurate: 0.8,
    measured: true,
  } as VsmStepFixtureItem,
];

const wasteMovesSection: VsmMoveFixtureItem[] = [
  {
    id: 'w-move-eliminate-double-approval',
    title: 'Zlikwiduj podwójne zatwierdzenie (over-processing)',
    description:
      'Zastąp dwa podpisy jednym progiem ryzyka — drugi podpis to nadmierne przetwarzanie bez wartości dla klienta.',
    impact: 'high',
    effort: 'low',
    category: 'waste',
    evidence: [
      'Obserwacja gemba: drugiego podpisu nikt nie czyta; C/T 60 min > takt 48 min — krok nie nadąża za popytem.',
    ],
  },
  {
    id: 'w-move-unblock-approval-queue',
    title: 'Udrożnij kolejkę przed zatwierdzeniem',
    description: 'Największa kolejka (WIP 20) piętrzy się przed podwójnym zatwierdzeniem — udrożnij ograniczenie.',
    impact: 'high',
    effort: 'medium',
    category: 'bottleneck',
    evidence: ['WIP przed krokiem 2 = 20 spraw — największa kolejka strumienia (gemba).'],
  },
  {
    id: 'w-move-fix-handoff-quality',
    title: 'Zabezpiecz jakość przekazania u źródła',
    description: 'Przekazanie zawraca 20% spraw — walidacja kompletu danych przed przekazaniem zamiast po fakcie.',
    impact: 'medium',
    effort: 'medium',
    category: 'rework',
    evidence: ['%C&A kroku 3 = 80% — co piąta sprawa wraca po brakujące dane (gemba log).'],
  },
];

export const VSM_WASTE_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal: 'Wyeliminować czyste marnotrawstwo w procesie zatwierdzania wniosków i skrócić lead time.',
    scope: 'Proces administracyjny zatwierdzania wniosków; od przyjęcia do przekazania do realizacji.',
    timeframe: 'short',
    successSignal: 'Eliminacja podwójnego zatwierdzenia i przekazania międzydziałowego; PCE > 2x.',
    assumptions: 'Dane zmierzone na gemba (follow-one-piece).',
    constraints: 'Bez zmian systemowych IT w pierwszej fali — tylko redukcja kroków.',
    kpiTarget: 'Redukcja 2 z 3 kroków jako czyste NVA.',
  }),
  sections: {
    steps: wasteStepsSection,
    demand: [100],
    volume: [100],
    availableTime: [4800], // 10 dni × 8h × 60 min → takt 48 min/wniosek
    moves: wasteMovesSection,
  } as unknown as Record<string, OperationalItem[]>,
  summary: {
    executiveSummary:
      'Dwa z trzech kroków to czyste marnotrawstwo (nadmierne przetwarzanie + transport). Podwójne zatwierdzenie przekracza takt time (60 > 48 min) i piętrzy największą kolejkę, a przekazanie międzydziałowe zawraca 20% spraw.',
    keyInsights: [
      'PCE ≈ 1,9% — proces głównie czeka; 67% kroków to czyste NVA do eliminacji (dominujące muda: nadmierne przetwarzanie).',
      'Podwójne zatwierdzenie: C/T 60 min > takt 48 min — ten krok nie nadąża za popytem.',
      'Przekazanie międzydziałowe zawraca 20% spraw (%C&A 80%) — ukryta fabryka przeróbek.',
    ],
    appliedConclusions: [
      'Zlikwidować drugi podpis (nadmierne przetwarzanie), zaczynając od ograniczenia.',
      'NIE dokładać kolejnej kontroli na końcu — przenieść walidację do źródła.',
      'Zre-mapować po eliminacji, bo ograniczenie się przesunie.',
    ],
    verdict:
      'Proces nie potrzebuje więcej mocy — potrzebuje usunięcia dwóch kroków bez wartości, które generują kolejkę i przeróbki.',
    tradeoffs: [
      {
        chosen: 'Eliminacja podwójnego zatwierdzenia',
        rejected: 'Utrzymanie obu podpisów „dla bezpieczeństwa"',
        why: 'Drugi podpis to nadmierne przetwarzanie — nikt go nie czyta, a generuje kolejkę powyżej taktu.',
      },
    ],
    expectedEffect: {
      text: 'Eliminacja 2 z 3 kroków; PCE ≈ 1,9% → >2x poprawa bez capex.',
      horizon: '60 dni od redukcji kroków, z re-mapowaniem na koniec.',
    },
    recommendedInitiatives: [],
  },
};

export const VSM_FIXTURE: OperationalToolData = {
  context: createConsultingMissionContext({
    goal:
      'Skrócić lead time strumienia „przyjęcie zamówienia klienta → wysyłka gotowego elementu" i podnieść Process Cycle Efficiency bez inwestycji kapitałowej.',
    scope:
      'Firma logistyczno-produkcyjna B2B, jedna rodzina produktu; granica od wprowadzenia zamówienia do wysyłki gotowego elementu.',
    timeframe: 'short',
    successSignal: 'Lead time 126h → ~48h; PCE 1,6% → ~4,2% w 90 dni od wdrożenia kaizen bursts.',
    assumptions:
      'Dane zmierzone na gemba (follow-one-piece, jeden dzień obserwacji), nie z procedur/systemów raportowych.',
    constraints:
      'Brak budżetu na drugą linię produkcyjną w tym cyklu — usprawnienia bez capex w pierwszej fali.',
    kpiTarget: 'PCE > 2,5x poprawa; ograniczenie zre-mapowane po 90 dniach.',
  }),
  sections: {
    steps: stepsSection,
    demand: demandSection,
    volume: volumeSection,
    availableTime: availableTimeSection,
    moves: movesSection,
  } as unknown as Record<string, OperationalItem[]>,
  summary: {
    executiveSummary:
      '98,4% czasu zamówienia NIE jest obrabiane — czeka. Ograniczenie realne to Planowanie produkcji (WIP 18 zamówień przed krokiem), nie Produkcja, która tylko wygląda na winowajcę (najdłuższy C/T, najniższy uptime). Weryfikacja kredytowa zawraca 12% zamówień do poprawki, co jest kosztem niewidocznym w raportach sprzedaży. Trzy kaizen bursts bez capex podnoszą PCE >2,5x.',
    keyInsights: [
      '98,4% lead time to czekanie, nie praca (PCE ≈ 1,6% — proces nietransformowany).',
      'Ograniczenie to Planowanie produkcji (WIP 18 zamówień przed krokiem), nie Produkcja — zespół chciał inwestować w drugą linię, co byłoby optymalizacją nie-ograniczenia.',
      'Ukryta fabryka przeróbek: 12% zamówień wraca po Weryfikacji kredytowej — przy 200 zamówień/miesiąc to ~24 dni-lead-time/miesiąc kosztu niewidocznego w KPI sprzedaży.',
    ],
    appliedConclusions: [
      'Udrożnić Planowanie produkcji pull-sygnałem kanban, zanim inwestuje się w produkcję.',
      'NIE inwestować w drugą linię produkcyjną w tym cyklu — to nie-ograniczenie.',
      'Zre-mapować strumień po 90 dniach, żeby sprawdzić, gdzie przesunęło się ograniczenie.',
    ],
    verdict:
      'Problem nie jest w produkcji — jest w kolejkach administracyjnych przed planowaniem i w pętli zwrotnej weryfikacji kredytowej.',
    tradeoffs: [
      {
        chosen: 'Pull-sygnał kanban Planowanie → Produkcja',
        rejected: 'Druga linia produkcyjna / więcej mocy w kroku 4',
        why: 'Krok 4 ma nadmiarową zdolność względem tego, co dostaje w porę — inwestycja w niego nie zmienia przepustowości całego strumienia.',
      },
    ],
    expectedEffect: {
      text: 'Lead time 126h → ~48h; PCE 1,6% → ~4,2% (>2,5x poprawa, bez capex).',
      horizon: '90 dni od wdrożenia trzech kaizen bursts, z re-mapowaniem na koniec okresu.',
    },
    recommendedInitiatives,
  },
};
