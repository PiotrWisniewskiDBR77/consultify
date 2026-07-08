/**
 * Supply Chain Control Tower — worked-example fixture.
 *
 * Grounded in the doctrine's §7 worked example
 * (Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/control-tower.md): an FMCG manufacturer,
 * 3 factories, 12 raw-material suppliers, 6 regional warehouses, distribution to
 * ~400 points of sale, OTIF sliding two quarters (94% → 87%).
 *
 * Deliberately encodes:
 *   - HARD blind spots: 3 suppliers with no data feed at all (still on phone/email)
 *   - STALE blind spots: 9 suppliers on a once-a-day manual ASN entry (feed lag
 *     24h > the 12h staleness threshold) + warehouse B (systemically under-stocked,
 *     lag 18h — the "no one ever cross-referenced it" node)
 *   - risk concentration: the same 3 hard-blind suppliers also carry the largest
 *     share of tracked exceptions (blindest = riskiest, not a coincidence)
 *   - ungoverned exceptions (missing threshold/owner) above the governance
 *     threshold, and alert fatigue right at the recalibration threshold
 *   - a DECLARED maturity level (4 — "prescriptive") well above the level the
 *     facts actually support, to exercise the reality-gap framing
 *
 * `sections.declaredLevel` is a SCALAR (not an item array) — read directly by
 * `toControlTowerSession` via `asMaturityLevel(sections?.['declaredLevel'])`
 * (src/config/controltower/index.ts). This is a deliberate, narrow exception to
 * the `Record<string, OperationalItem[]>` shape of `OperationalToolData['sections']`,
 * so the object is assembled loosely-typed and cast once at the end.
 */

import type { InitiativeDraft, OperationalItem, OperationalToolData } from '@/store/useToolStore';

// ---------------------------------------------------------------------------
// Local, additive item shapes — extend the base OperationalItem with the
// control-tower-specific fields the adapter reads (kept in sync with the
// "Convention on OperationalItem" doc-comment in index.ts).
// ---------------------------------------------------------------------------

interface ControlTowerNodeItem extends OperationalItem {
  kind: 'factory' | 'supplier' | 'warehouse' | 'carrier';
  integrated: boolean;
  feedLagHours: number;
  flowValue: number;
}

interface ControlTowerExceptionItem extends OperationalItem {
  volume: number;
  detectionLagHours: number;
  closedNoActionRatio: number;
  hasThreshold: boolean;
  hasOwner: boolean;
  dynamicThreshold: boolean;
  source: string;
}

interface ControlTowerMoveFixtureItem extends OperationalItem {
  evidence: string[];
}

// ---------------------------------------------------------------------------
// Nodes — 3 factories (integrated, near-real-time ERP) + 12 suppliers (3 hard
// blind spots, 9 stale once-a-day feeds) + 6 warehouses (5 healthy, 1 stale).
// ---------------------------------------------------------------------------

const NODES: ControlTowerNodeItem[] = [
  // --- Factories: ERP feeds exist and are fresh, but each factory is a silo. ---
  {
    id: 'fabryka-gdansk',
    title: 'Fabryka — Gdańsk',
    description: 'Linia A+B, ERP produkcyjny (MES) aktualizowany w czasie zbliżonym do rzeczywistego',
    impact: 'high',
    effort: 'low',
    category: 'factory',
    kind: 'factory',
    integrated: true,
    feedLagHours: 1,
    flowValue: 4200000,
  },
  {
    id: 'fabryka-poznan',
    title: 'Fabryka — Poznań',
    description: 'Linia C, ERP produkcyjny z automatycznym feedem co godzinę',
    impact: 'high',
    effort: 'low',
    category: 'factory',
    kind: 'factory',
    integrated: true,
    feedLagHours: 2,
    flowValue: 3900000,
  },
  {
    id: 'fabryka-wroclaw',
    title: 'Fabryka — Wrocław',
    description: 'Linia D+E, ERP produkcyjny aktualizowany w czasie zbliżonym do rzeczywistego',
    impact: 'high',
    effort: 'low',
    category: 'factory',
    kind: 'factory',
    integrated: true,
    feedLagHours: 1,
    flowValue: 3600000,
  },
  // --- Suppliers: 3 HARD blind spots (no feed — phone/email only), also the ---
  // --- costliest exception sources (see EXCEPTIONS below). ---
  {
    id: 'dostawca-03-tworzywa',
    title: 'Dostawca 03 — granulat tworzywa',
    description: 'Brak EDI/API; status zamówienia wyłącznie telefonicznie do działu zakupów',
    impact: 'high',
    effort: 'medium',
    category: 'supplier',
    kind: 'supplier',
    integrated: false,
    feedLagHours: 0,
    flowValue: 680000,
  },
  {
    id: 'dostawca-07-opakowania',
    title: 'Dostawca 07 — opakowania zbiorcze',
    description: 'Brak integracji; potwierdzenia wysyłki przychodzą mailem, bez ustalonego rytmu',
    impact: 'high',
    effort: 'medium',
    category: 'supplier',
    kind: 'supplier',
    integrated: false,
    feedLagHours: 0,
    flowValue: 540000,
  },
  {
    id: 'dostawca-11-etykiety',
    title: 'Dostawca 11 — etykiety i nadruk',
    description: 'Brak portalu dostawcy; śledzenie w arkuszu Excel aktualizowanym ręcznie',
    impact: 'high',
    effort: 'medium',
    category: 'supplier',
    kind: 'supplier',
    integrated: false,
    feedLagHours: 0,
    flowValue: 410000,
  },
  // --- Suppliers: 9 STALE — ASN wpada do ERP dopiero po ręcznym wprowadzeniu ---
  // --- przez dział zakupów raz dziennie (feed lag 24h > próg 12h). ---
  {
    id: 'dostawca-01',
    title: 'Dostawca 01 — surowiec bazowy',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 610000,
  },
  {
    id: 'dostawca-02',
    title: 'Dostawca 02 — surowiec bazowy',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 590000,
  },
  {
    id: 'dostawca-04',
    title: 'Dostawca 04 — dodatki chemiczne',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 520000,
  },
  {
    id: 'dostawca-05',
    title: 'Dostawca 05 — dodatki chemiczne',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 505000,
  },
  {
    id: 'dostawca-06',
    title: 'Dostawca 06 — komponenty metalowe',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 480000,
  },
  {
    id: 'dostawca-08',
    title: 'Dostawca 08 — komponenty metalowe',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 460000,
  },
  {
    id: 'dostawca-09',
    title: 'Dostawca 09 — folia i wypełniacze',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 430000,
  },
  {
    id: 'dostawca-10',
    title: 'Dostawca 10 — folia i wypełniacze',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 400000,
  },
  {
    id: 'dostawca-12',
    title: 'Dostawca 12 — palety i logistyka wewnętrzna',
    description: 'ASN wprowadzane ręcznie do ERP raz dziennie przez dział zakupów',
    impact: 'medium',
    effort: 'low',
    category: 'supplier',
    kind: 'supplier',
    integrated: true,
    feedLagHours: 24,
    flowValue: 380000,
  },
  // --- Warehouses: 5 healthy WMS feeds + warehouse B (stale, the systemically ---
  // --- under-stocked one no one cross-referenced across quarters). ---
  {
    id: 'magazyn-a-poznan',
    title: 'Magazyn A — Poznań',
    description: 'WMS z automatycznym feedem co kilka godzin',
    impact: 'medium',
    effort: 'low',
    category: 'warehouse',
    kind: 'warehouse',
    integrated: true,
    feedLagHours: 4,
    flowValue: 1200000,
  },
  {
    id: 'magazyn-b-lodz',
    title: 'Magazyn B — Łódź',
    description:
      'WMS istnieje, ale bufory bezpieczeństwa dla SKU sezonowych są liczone kwartalnie i nigdy nie zestawione z realną zmiennością — systemowo zaniżone',
    impact: 'high',
    effort: 'medium',
    category: 'warehouse',
    kind: 'warehouse',
    integrated: true,
    feedLagHours: 18,
    flowValue: 1150000,
  },
  {
    id: 'magazyn-c-wroclaw',
    title: 'Magazyn C — Wrocław',
    description: 'WMS z automatycznym feedem co kilka godzin',
    impact: 'medium',
    effort: 'low',
    category: 'warehouse',
    kind: 'warehouse',
    integrated: true,
    feedLagHours: 3,
    flowValue: 980000,
  },
  {
    id: 'magazyn-d-krakow',
    title: 'Magazyn D — Kraków',
    description: 'WMS z automatycznym feedem co kilka godzin, progi dynamiczne pilotowane',
    impact: 'medium',
    effort: 'low',
    category: 'warehouse',
    kind: 'warehouse',
    integrated: true,
    feedLagHours: 5,
    flowValue: 910000,
  },
  {
    id: 'magazyn-e-katowice',
    title: 'Magazyn E — Katowice',
    description: 'WMS z automatycznym feedem co kilka godzin',
    impact: 'medium',
    effort: 'low',
    category: 'warehouse',
    kind: 'warehouse',
    integrated: true,
    feedLagHours: 4,
    flowValue: 860000,
  },
  {
    id: 'magazyn-f-szczecin',
    title: 'Magazyn F — Szczecin',
    description: 'WMS z automatycznym feedem co kilka godzin',
    impact: 'medium',
    effort: 'low',
    category: 'warehouse',
    kind: 'warehouse',
    integrated: true,
    feedLagHours: 6,
    flowValue: 790000,
  },
];

// ---------------------------------------------------------------------------
// Exceptions — one tracked-exception record per node source (12 suppliers +
// 2 warehouses + 1 carrier = 15 distinct sources). The 3 hard-blind suppliers
// also dominate exception volume (blindest = riskiest). 6/15 are ungoverned
// (missing threshold or owner, share 0.4 > the 0.3 W2 governance trigger);
// volume-weighted alert fatigue lands at exactly 0.3 (the recalibration
// trigger). Average detection lag ≈22h — far above the 8h predictive bar.
// ---------------------------------------------------------------------------

const EXCEPTIONS: ControlTowerExceptionItem[] = [
  {
    id: 'exc-asn-dostawca-03',
    title: 'Opóźnienie ASN — dostawca 03 (granulat)',
    description: 'Opóźnienie potwierdzenia wysyłki >24h wykryte tylko telefonicznie',
    impact: 'high',
    effort: 'medium',
    category: 'exceptions',
    source: 'dostawca-03-tworzywa',
    volume: 40,
    detectionLagHours: 36,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.1,
  },
  {
    id: 'exc-asn-dostawca-07',
    title: 'Opóźnienie ASN — dostawca 07 (opakowania)',
    description: 'Opóźnienie wysyłki wykrywane po fakcie z maila; brak przypisanego właściciela',
    impact: 'high',
    effort: 'medium',
    category: 'response',
    source: 'dostawca-07-opakowania',
    volume: 35,
    detectionLagHours: 33,
    hasThreshold: true,
    hasOwner: false,
    dynamicThreshold: false,
    closedNoActionRatio: 0.4,
  },
  {
    id: 'exc-asn-dostawca-11',
    title: 'Opóźnienie ASN — dostawca 11 (etykiety)',
    description: 'Brak progu i właściciela; wyjątek śledzony wyłącznie w arkuszu Excel',
    impact: 'high',
    effort: 'medium',
    category: 'exceptions',
    source: 'dostawca-11-etykiety',
    volume: 32,
    detectionLagHours: 30,
    hasThreshold: false,
    hasOwner: false,
    dynamicThreshold: false,
    closedNoActionRatio: 0.6,
  },
  {
    id: 'exc-asn-dostawca-01',
    title: 'Opóźnienie ASN — dostawca 01',
    description: 'Statyczny próg 24h, właściciel przypisany',
    impact: 'medium',
    effort: 'low',
    category: 'exceptions',
    source: 'dostawca-01',
    volume: 8,
    detectionLagHours: 22,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.15,
  },
  {
    id: 'exc-asn-dostawca-02',
    title: 'Opóźnienie ASN — dostawca 02',
    description: 'Statyczny próg 24h; brak przypisanego właściciela po ostatniej rotacji zespołu',
    impact: 'medium',
    effort: 'low',
    category: 'response',
    source: 'dostawca-02',
    volume: 7,
    detectionLagHours: 25,
    hasThreshold: true,
    hasOwner: false,
    dynamicThreshold: false,
    closedNoActionRatio: 0.12,
  },
  {
    id: 'exc-asn-dostawca-04',
    title: 'Opóźnienie ASN — dostawca 04',
    description: 'Statyczny próg; brak przypisanego właściciela, alert trafia do wspólnej skrzynki',
    impact: 'medium',
    effort: 'low',
    category: 'response',
    source: 'dostawca-04',
    volume: 7,
    detectionLagHours: 20,
    hasThreshold: true,
    hasOwner: false,
    dynamicThreshold: false,
    closedNoActionRatio: 0.3,
  },
  {
    id: 'exc-asn-dostawca-05',
    title: 'Opóźnienie ASN — dostawca 05',
    description: 'Statyczny próg 24h, właściciel przypisany',
    impact: 'medium',
    effort: 'low',
    category: 'exceptions',
    source: 'dostawca-05',
    volume: 6,
    detectionLagHours: 26,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.1,
  },
  {
    id: 'exc-asn-dostawca-06',
    title: 'Opóźnienie ASN — dostawca 06',
    description: 'Statyczny próg 24h, właściciel przypisany',
    impact: 'medium',
    effort: 'low',
    category: 'exceptions',
    source: 'dostawca-06',
    volume: 6,
    detectionLagHours: 18,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.08,
  },
  {
    id: 'exc-asn-dostawca-08',
    title: 'Opóźnienie ASN — dostawca 08',
    description: 'Statyczny próg 24h; alert bez przypisanego właściciela',
    impact: 'medium',
    effort: 'low',
    category: 'response',
    source: 'dostawca-08',
    volume: 6,
    detectionLagHours: 24,
    hasThreshold: true,
    hasOwner: false,
    dynamicThreshold: false,
    closedNoActionRatio: 0.2,
  },
  {
    id: 'exc-asn-dostawca-09',
    title: 'Opóźnienie ASN — dostawca 09',
    description: 'Statyczny próg 24h, właściciel przypisany',
    impact: 'low',
    effort: 'low',
    category: 'exceptions',
    source: 'dostawca-09',
    volume: 5,
    detectionLagHours: 21,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.1,
  },
  {
    id: 'exc-asn-dostawca-10',
    title: 'Opóźnienie ASN — dostawca 10',
    description: 'Brak zdefiniowanego progu (oceniane „na oko"); właściciel przypisany',
    impact: 'low',
    effort: 'low',
    category: 'exceptions',
    source: 'dostawca-10',
    volume: 5,
    detectionLagHours: 23,
    hasThreshold: false,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.15,
  },
  {
    id: 'exc-asn-dostawca-12',
    title: 'Opóźnienie ASN — dostawca 12',
    description: 'Statyczny próg 24h, właściciel przypisany',
    impact: 'low',
    effort: 'low',
    category: 'exceptions',
    source: 'dostawca-12',
    volume: 5,
    detectionLagHours: 19,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.05,
  },
  {
    id: 'exc-stock-magazyn-b',
    title: 'Przekroczony próg zapasu — magazyn B (SKU sezonowe)',
    description:
      'Bufor bezpieczeństwa systemowo zaniżony; wzorzec powtarza się co kwartał, alerty najczęściej zamykane bez akcji',
    impact: 'high',
    effort: 'medium',
    category: 'exceptions',
    source: 'magazyn-b-lodz',
    volume: 18,
    detectionLagHours: 20,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: false,
    closedNoActionRatio: 0.7,
  },
  {
    id: 'exc-stock-magazyn-d',
    title: 'Przekroczony próg zapasu — magazyn D (pilotaż progu dynamicznego)',
    description: 'Próg dynamiczny względem zmienności historycznej, pilotowany',
    impact: 'medium',
    effort: 'low',
    category: 'exceptions',
    source: 'magazyn-d-krakow',
    volume: 10,
    detectionLagHours: 10,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: true,
    closedNoActionRatio: 0.15,
  },
  {
    id: 'exc-eta-transport',
    title: 'Odchylenie ETA — przewoźnik główny (TMS)',
    description: 'ETA odchylone >4h od planu; TMS zintegrowany, próg dynamiczny wg trasy',
    impact: 'medium',
    effort: 'low',
    category: 'exceptions',
    source: 'przewoznik-tms-01',
    volume: 12,
    detectionLagHours: 6,
    hasThreshold: true,
    hasOwner: true,
    dynamicThreshold: true,
    closedNoActionRatio: 0.1,
  },
];

// ---------------------------------------------------------------------------
// Moves — one candidate per lever (visibility / response / exceptions /
// maturity), each carrying evidence so the W2 scorer has something to weigh.
// ---------------------------------------------------------------------------

const MOVES: ControlTowerMoveFixtureItem[] = [
  {
    id: 'move-edi-top3-dostawcy',
    title: 'Zintegrować EDI/API z 3 najdroższymi martwymi polami',
    description:
      'Skierować pierwszą integrację do dostawców 03/07/11 — najdroższe martwe pola i jednocześnie największy wolumen wyjątków',
    impact: 'high',
    effort: 'medium',
    category: 'visibility',
    evidence: [
      '13/21 węzłów ślepych (3 hard, 10 stale) — mapa martwych pól z sesji',
      'Ci sami 3 dostawcy odpowiadają za największy wolumen wyjątków (dowód koncentracji ryzyka)',
    ],
  },
  {
    id: 'move-nadaj-wlasciciela-progi',
    title: 'Nadać próg i właściciela każdemu ungoverned wyjątkowi',
    description:
      '6 z 15 śledzonych wyjątków nie ma progu lub właściciela — zamknąć lukę governance przed automatyzacją',
    impact: 'high',
    effort: 'low',
    category: 'response',
    evidence: [
      '40% wyjątków bez progu lub właściciela (6/15) — z sesji "exceptions"',
      'Alert bez właściciela nie prowadzi do decyzji (kontrakt W2)',
    ],
  },
  {
    id: 'move-dynamiczny-bufor-magazyn-b',
    title: 'Wprowadzić dynamiczny bufor bezpieczeństwa w magazynie B + przekalibrować progi',
    description:
      'Zastąpić kwartalny, systemowo zaniżony bufor SKU sezonowych progiem liczonym z historycznej zmienności; zastosować ten sam przegląd kalibracji tam, gdzie alert fatigue jest wysoki',
    impact: 'high',
    effort: 'medium',
    category: 'exceptions',
    evidence: [
      'Magazyn B: alert fatigue 70% zamykanych bez akcji, wzorzec powtarzalny kwartalnie',
      'Ważony wolumenem alert fatigue całej sieci = 30% (próg rekalibracji)',
    ],
  },
  {
    id: 'move-skok-dojrzalosci',
    title: 'Zaplanować najbliższy opłacalny skok dojrzałości (1→2) na kluczowych trasach',
    description:
      'Po oświetleniu top-3 martwych pól i uporządkowaniu governance — zaplanować krok w stronę poziomu diagnostycznego, nie od razu predykcyjnego',
    impact: 'medium',
    effort: 'medium',
    category: 'maturity',
    evidence: [
      'Poziom z faktów: 1 (widoczność) vs deklarowany przez organizację: 4 (prescriptywny) — luka rzeczywistości',
      'Detection lag średnio ~22h (do 36h na top-3 dostawcach) — zbyt wysoki dla poziomu 3',
    ],
  },
];

// ---------------------------------------------------------------------------
// Recommended initiatives — mirrors the doctrine's worked-example initiatives
// (§7), materialized as InitiativeDraft so the "summary" step has a payload.
// ---------------------------------------------------------------------------

const RECOMMENDED_INITIATIVES: InitiativeDraft[] = [
  {
    id: 'init-edi-top3-dostawcy',
    title: 'Automatyczna integracja EDI z 3 kluczowymi dostawcami',
    description:
      'Eliminacja martwych pól i luki 24-36h detection lag u dostawców 03/07/11 poprzez integrację EDI/API zamiast telefonu/maila',
    type: 'operational',
    source: 'control-tower',
    linkedItems: ['dostawca-03-tworzywa', 'dostawca-07-opakowania', 'dostawca-11-etykiety'],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    rationale:
      'Ci sami 3 dostawcy są jednocześnie najsłabiej widoczni i generują największy wolumen wyjątków — integracja usuwa przyczynę, nie tylko przyspiesza raport',
  },
  {
    id: 'init-dynamiczny-bufor-magazyn-b',
    title: 'Dynamiczny bufor bezpieczeństwa dla SKU sezonowych w magazynie B',
    description:
      'Zastąpić stały, kwartalnie ustalany bufor progiem liczonym z historycznej zmienności popytu per SKU',
    type: 'operational',
    source: 'control-tower',
    linkedItems: ['magazyn-b-lodz'],
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    rationale: 'Wzorzec zaniżonego bufora powtarza się co kwartał; nikt wcześniej nie zestawił go w jednym miejscu',
  },
  {
    id: 'init-renegocjacja-sla-dostawcy',
    title: 'Renegocjacja SLA z problematycznymi dostawcami + dostawca alternatywny',
    description:
      'Zróżnicować politykę wobec dostawców koncentrujących ryzyko: renegocjacja SLA z 2 z 3 najgorszych + wdrożenie dostawcy alternatywnego dla trzeciego',
    type: 'strategic',
    source: 'control-tower',
    linkedItems: ['dostawca-03-tworzywa', 'dostawca-07-opakowania', 'dostawca-11-etykiety'],
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    rationale:
      'Koncentracja ryzyka u 3 z 15 śledzonych źródeł to problem strukturalny, nie seria pechowych zdarzeń — wymaga decyzji strategicznej',
  },
];

// ---------------------------------------------------------------------------
// Assembly. `sections` mixes item arrays with the scalar `declaredLevel`
// (see file header) — assembled loosely-typed, then cast once to
// `OperationalToolData` (esbuild/tsx do not type-check; this keeps the shape
// exactly what `toControlTowerSession` expects at runtime).
// ---------------------------------------------------------------------------

const sections = {
  nodes: NODES,
  exceptions: EXCEPTIONS,
  moves: MOVES,
  /** Self-declared maturity level (org believes "prescriptive") — a deliberate
   *  reality gap against the level=1 the facts above actually support. */
  declaredLevel: 4,
};

export const CONTROL_TOWER_FIXTURE = {
  context: {
    goal:
      'Podnieść widoczność end-to-end łańcucha dostaw i skrócić detection lag, aby zatrzymać spadek OTIF (94% → 87% w ostatnich 2 kwartałach)',
    scope:
      '3 fabryki (Gdańsk, Poznań, Wrocław), 12 dostawców surowca, 6 magazynów regionalnych, dystrybucja do ok. 400 punktów sprzedaży (FMCG)',
    timeframe: 'medium',
    successSignal: 'OTIF wraca powyżej 92% w ciągu 2 kwartałów; detection lag kluczowych wyjątków spada poniżej 8h',
    assumptions:
      'Dane źródłowe (ERP produkcyjny, WMS, portal dostawców) istnieją cyfrowo dla wszystkich węzłów — brakuje integracji, nie danych',
    constraints:
      'Budżet pierwszej fali integracji ograniczony do 3 najdroższych martwych pól; brak mandatu na wymianę ERP',
  },
  sections,
  summary: {
    executiveSummary:
      'Łańcuch jest ślepy w 62% (13/21 węzłów) — głównie po stronie dostawców surowca — a zakłócenie jest wykrywane średnio ~22h (do 36h) za późno. Deklarowany poziom dojrzałości 4 nie ma pokrycia w faktach: rzeczywisty poziom to 1 (widoczność). Ci sami 3 dostawcy, którzy są najsłabiej widoczni, generują też największy wolumen wyjątków — integracja EDI z nimi jest najbliższym opłacalnym krokiem, nie skok od razu do predykcji.',
    keyInsights: [
      '13/21 węzłów łańcucha jest ślepych (3 bez żadnego feedu, 10 na ręcznym wpisie raz dziennie) — ekspozycja w martwych polach ok. 7,2 mln z 23,6 mln łącznego przepływu',
      'Detection lag: średnio ~22h, do 36h u najgorszego dostawcy — to on, nie liczba alertów, zamienia się w kary OTIF i frachty awaryjne',
      'Koncentracja ryzyka: dostawcy 03/07/11 (3 z 15 śledzonych źródeł) generują ~50% wolumenu wyjątków — problem strukturalny, nie seria pechowych zdarzeń',
    ],
    appliedConclusions: [
      'Najpierw: integracja EDI/API z dostawcami 03/07/11 — najdroższe martwe pola i jednocześnie najwięcej wyjątków',
      'NIE: skok od razu do poziomu 4-5 dojrzałości — dane są zbyt brudne, oddanie sterowania na nich skalowałoby błąd cicho',
      'Zweryfikować: czy magazyn B ma wystarczające dane historyczne do policzenia dynamicznego bufora, zanim się go wdroży',
    ],
    verdict:
      'Łańcuch jest ślepy tam, gdzie ryzyko jest największe — ci sami 3 dostawcy są jednocześnie najmniej widoczni i najbardziej zawodni.',
    tradeoffs: [
      {
        chosen: 'Integracja EDI z 3 najdroższymi martwymi polami w pierwszej fali',
        rejected: 'Równoległa integracja wszystkich 12 dostawców naraz',
        why: 'Budżet pierwszej fali starcza na 3 węzły; rozproszenie na 12 nie usunęłoby żadnego martwego pola w rozsądnym czasie',
      },
    ],
    expectedEffect: {
      text: 'Detection lag u top-3 dostawców spada z 30-36h do <8h; OTIF wraca powyżej 92%',
      horizon: '2 kwartały',
    },
    recommendedInitiatives: RECOMMENDED_INITIATIVES,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see file-header note on the declaredLevel scalar
} as unknown as OperationalToolData;
