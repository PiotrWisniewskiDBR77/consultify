/**
 * Supply Chain Control Tower — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * control-tower-specific "depth staircase" per lever:
 *
 *   1. surface          — what does this dimension look like today (data sources,
 *                         thresholds, ownership, maturity)?
 *   2. evidence         — is it measured, or is it habit / assumed / anecdotal?
 *   3. quantification   — how much does the gap cost (detection lag, blind-spot
 *                         value, OTIF penalties, wasted alert-handling time)?
 *   4. risk-capability  — what capability / integration must exist to close it
 *                         without breaking the operating model?
 *
 * The four canonical levers mirror the disciplined control-tower build order
 * from the doctrine (§3–§4): you cannot run exceptions on data you cannot see,
 * you cannot respond to exceptions no one owns, and you cannot climb the
 * maturity curve before the lower rungs hold.
 *
 *   - visibility   : end-to-end data sources (ERP/WMS/TMS/supplier/external) —
 *                    where the chain is lit and where it is BLIND
 *   - exceptions   : KPIs (OTIF/lead time/inventory) + thresholds + events —
 *                    what triggers an alert and whether the trigger is any good
 *   - response     : the operating model — who owns each exception, what SLA,
 *                    what escalation (without this it is a dashboard, not a tower)
 *   - maturity     : the path visibility → diagnostic → predictive → prescriptive
 *                    → autonomous — the next PAYABLE step, not a leap to level 5
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (controlTowerEngine.ts).
 */

export type ControlTowerLeverId = 'visibility' | 'exceptions' | 'response' | 'maturity';

export const CONTROL_TOWER_LEVERS: ControlTowerLeverId[] = [
  'visibility',
  'exceptions',
  'response',
  'maturity',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and lever-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'risk-capability';
  /** 1-4 depth level (surface..risk) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing. */
  rationale: Bilingual;
}

const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const CONTROL_TOWER_LADDER_RUNG_ORDER = RUNG_ORDER;

const CONTROL_TOWER_LEVER_LABEL: Record<ControlTowerLeverId, Bilingual> = {
  visibility: { pl: 'Widoczność', en: 'Visibility' },
  exceptions: { pl: 'Wyjątki', en: 'Exceptions' },
  response: { pl: 'Model reakcji', en: 'Response model' },
  maturity: { pl: 'Dojrzałość', en: 'Maturity' },
};

export const controlTowerLeverLabel = (lever: ControlTowerLeverId): Bilingual =>
  CONTROL_TOWER_LEVER_LABEL[lever];

/**
 * Per-lever deepening ladder. Each lever has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const CONTROL_TOWER_DEEPENING_LADDER: Record<ControlTowerLeverId, LadderRung[]> = {
  visibility: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które węzły łańcucha (ERP, WMS, TMS, dostawcy Tier-1/2/3, przewoźnicy, 3PL) faktycznie dostarczają dane do jednego miejsca, a które widzicie tylko telefonem lub mailem?',
        en: 'Which chain nodes (ERP, WMS, TMS, Tier-1/2/3 suppliers, carriers, 3PL) actually feed data into one place, and which do you only "see" by phone or email?',
      },
      rationale: {
        pl: 'Control Tower zaczyna się od mapy tego, co jest widziane end-to-end — miejsce bez feedu danych to martwe pole, w którym zakłócenie materializuje się bez ostrzeżenia, choć reszta „świeci na zielono".',
        en: 'A control tower starts from a map of what is visible end-to-end — a node with no data feed is a blind spot where disruption materializes without warning while the rest "shows green".',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że dany węzeł jest „widoczny" — z automatycznego feedu w czasie zbliżonym do rzeczywistego, czy z ręcznego wpisu wprowadzanego raz dziennie?',
        en: 'How do you know a node is "visible" — from an automated near-real-time feed, or from a manual entry keyed in once a day?',
      },
      rationale: {
        pl: 'Widoczność opóźniona o dobę to nie widoczność, tylko archiwum — dowodem jest częstotliwość i automatyzm feedu, nie samo istnienie systemu źródłowego.',
        en: 'Visibility delayed by a day is not visibility, it is an archive — the evidence is the frequency and automation of the feed, not the mere existence of a source system.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaka część wartości zakupu / wolumenu przechodzi przez węzły BEZ integracji danych i ile OTIF / kar umownych kosztuje ta niewidoczność w skali roku?',
        en: 'What share of purchase value / volume flows through nodes WITHOUT data integration, and how much OTIF / contractual penalty does that blindness cost per year?',
      },
      rationale: {
        pl: 'Dopóki nie policzycie wartości przechodzącej przez martwe pola, „brak widoczności" jest odczuciem IT, nie uzasadnieniem inwestycyjnym dla zarządu.',
        en: 'Until you cost the value flowing through blind spots, "lack of visibility" is an IT feeling, not an investment case for the board.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej integracji brakuje (EDI/API dostawcy, feed 3PL, telemetria przewoźnika), żeby oświetlić najdroższe martwe pole, i czy dane źródłowe w ogóle istnieją cyfrowo?',
        en: 'Which integration is missing (supplier EDI/API, 3PL feed, carrier telemetry) to light the costliest blind spot, and does the source data even exist digitally?',
      },
      rationale: {
        pl: 'Control Tower nie jest odpowiedzią, gdy węzeł jest ręczny (brak danych źródłowych) — najpierw ucyfrowić operację, potem spinać widoczność; inaczej integrujecie pustkę.',
        en: 'A control tower is not the answer when a node is manual (no source data) — digitize the operation first, then wire the visibility; otherwise you integrate a void.',
      },
    },
  ],
  exceptions: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które KPI faktycznie wpadają do wieży (OTIF, lead time plan vs rzeczywisty, dni pokrycia zapasu, odchylenie ETA) i który wyjątek ma zdefiniowany próg, a który jest „na oko"?',
        en: 'Which KPIs actually reach the tower (OTIF, planned vs actual lead time, days of cover, ETA deviation), and which exception has a defined threshold versus a gut call?',
      },
      rationale: {
        pl: 'Bez KPI i progów wieża tylko agreguje dane — wyjątek bez progu i bez właściciela nie jest sterowaniem, tylko ładnym ekranem.',
        en: 'Without KPIs and thresholds the tower only aggregates data — an exception with no threshold and no owner is not steering, just a pretty screen.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy progi alertów są dynamiczne (względem historycznej zmienności danego SKU / trasy / dostawcy), czy statyczne — jedna liczba dla wszystkich, generująca szum przy sezonowości?',
        en: 'Are alert thresholds dynamic (relative to the historical variability of a given SKU / route / supplier), or static — one number for all, producing noise under seasonality?',
      },
      rationale: {
        pl: 'Statyczny próg jest jednocześnie za czuły tam, gdzie zmienność normalna, i za tępy tam, gdzie stabilność — dowodem trafności progu jest udział alertów zakończonych realną akcją, nie liczba alertów.',
        en: 'A static threshold is at once too sensitive where variability is normal and too dull where it is stable — the evidence of a good threshold is the share of alerts that led to real action, not the alert count.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile dni/godzin ŚREDNIO wyjątek jest wykrywany za późno — jaka jest luka między momentem powstania problemu u źródła a momentem, gdy trafia do wieży (detection lag)?',
        en: 'By how many days/hours ON AVERAGE is an exception detected too late — what is the gap between when the problem arises at source and when it reaches the tower (detection lag)?',
      },
      rationale: {
        pl: 'Detection lag jest rdzeniem wartości Control Tower: to on, nie sama liczba alertów, zamienia się w kary OTIF i awaryjny fracht — jego kwantyfikacja to bezpośrednie uzasadnienie integracji węzła.',
        en: 'Detection lag is the core of a control tower\'s value: it, not the alert count, converts into OTIF penalties and emergency freight — quantifying it is the direct justification for integrating a node.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jaki udział alertów zamykacie BEZ żadnej akcji (alert fatigue) i czy potraficie rozróżnić przyczynę źródłową od objawu — czy gasicie pożar tam, gdzie go widać, czy tam, gdzie powstał?',
        en: 'What share of alerts do you close with NO action (alert fatigue), and can you tell root cause from symptom — do you fight the fire where it shows, or where it started?',
      },
      rationale: {
        pl: 'Wysoki odsetek alertów zamykanych bez akcji to sygnał złej kalibracji progów, nie braku ludzi — bez root-cause taggingu wieża generuje alerty w nieskończoność i nigdy nie usuwa przyczyny.',
        en: 'A high share of alerts closed with no action signals bad threshold calibration, not a headcount gap — without root-cause tagging the tower generates alerts forever and never removes the cause.',
      },
    },
  ],
  response: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Kto jest właścicielem każdej kategorii wyjątku (opóźnienie dostawcy → kto? przekroczony próg zapasu → kto?), czy alert trafia „do wszystkich", czyli do nikogo?',
        en: 'Who owns each exception category (supplier delay → who? stock-threshold breach → who?), or does the alert go "to everyone", i.e. to no one?',
      },
      rationale: {
        pl: 'Gartner rozróżnia wprost: control tower = ludzie + proces + dane + organizacja, które PODEJMUJĄ decyzję; jeśli po alarmie nikt nie wie, kto reaguje, to nie jest wieża, tylko dashboard.',
        en: 'Gartner is explicit: a control tower = people + process + data + organization that MAKE a decision; if after an alarm no one knows who responds, it is not a tower, it is a dashboard.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy istnieje jawny SLA reakcji per poziom krytyczności (P1 wpływ na klienta → reakcja w 30 min?) i ścieżka eskalacji, gdy nikt nie zareaguje — czy to żyje tylko w głowie jednej osoby?',
        en: 'Is there an explicit response SLA per criticality level (P1 customer impact → respond in 30 min?) and an escalation path when no one acts — or does it live only in one person\'s head?',
      },
      rationale: {
        pl: 'Bez SLA i eskalacji priorytetyzacja staje się chronologiczna (kto pierwszy w kolejce alertów) zamiast wg wpływu biznesowego — dowodem jest zapisany rytm operacyjny, nie dobre intencje.',
        en: 'Without an SLA and escalation, prioritization becomes chronological (first in the alert queue) instead of by business impact — the evidence is a written operating rhythm, not good intentions.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile trwa ŚREDNIO cykl od wykrycia do decyzji i od decyzji do rozwiązania, i ile kosztuje was brak wspólnego stołu decyzyjnego (nerve center) zamiast alertu w skrzynce jednej osoby?',
        en: 'How long ON AVERAGE is the cycle from detection to decision and from decision to resolution, and what does the absence of a shared decision table (nerve center) cost you versus an alert in one inbox?',
      },
      rationale: {
        pl: 'Czas reakcji na wyjątek jest mierzalnym KPI wieży — bez jego pomiaru „reagujemy szybko" jest deklaracją, a nie zdolnością, którą można poprawiać.',
        en: 'Response time to an exception is a measurable tower KPI — without measuring it "we respond fast" is a claim, not a capability you can improve.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czego brakuje (rytm huddle S&OP, mandat decyzyjny, zamknięcie pętli root-cause), żeby wyjątek prowadził do usunięcia przyczyny, a nie tylko do kolejnego gaszenia pożaru?',
        en: 'What is missing (an S&OP huddle rhythm, a decision mandate, a root-cause closed loop) so an exception leads to removing the cause rather than another firefight?',
      },
      rationale: {
        pl: 'McKinsey nazywa to „nerve center": codzienny/tygodniowy rytm, w którym wyjątki trafiają na wspólny stół — bez zamknięcia pętli ten sam problem wraca cyklicznie.',
        en: 'McKinsey calls it a "nerve center": a daily/weekly rhythm where exceptions hit a shared table — without closing the loop the same problem recurs cyclically.',
      },
    },
  ],
  maturity: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na którym poziomie dojrzałości realnie jesteście — 1 widoczność (co się dzieje), 2 diagnostyczny (dlaczego), 3 predykcyjny (co się stanie), 4 prescriptywny (co zrobić), 5 autonomiczny (zrób to)?',
        en: 'Which maturity level are you really at — 1 visibility (what is happening), 2 diagnostic (why), 3 predictive (what will happen), 4 prescriptive (what to do), 5 autonomous (do it)?',
      },
      rationale: {
        pl: 'Wieża nie jest stanem binarnym (masz/nie masz), tylko drogą — ~80% organizacji utknęło na poziomie 1–2: mają „widoczność", ale toną w alertach bez priorytetyzacji.',
        en: 'A tower is not binary (have/have-not) but a road — ~80% of organizations are stuck at level 1–2: they have "visibility" but drown in alerts with no prioritization.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że jesteście na deklarowanym poziomie — czy system PRZEWIDUJE wyjątek zanim się zmaterializuje (poziom 3), czy tylko alarmuje po fakcie odchylenia od planu (poziom 2)?',
        en: 'How do you know you are at the level you claim — does the system PREDICT an exception before it materializes (level 3), or only alarm after a deviation from plan (level 2)?',
      },
      rationale: {
        pl: 'Organizacje przeceniają swój poziom — „mamy predykcję" często oznacza regułę progową, nie model przewidujący; dowodem jest wyprzedzenie (o ile godzin przed materializacją), nie nazwa narzędzia.',
        en: 'Organizations overstate their level — "we have prediction" often means a threshold rule, not a forecasting model; the evidence is lead time (how many hours before materialization), not a tool\'s name.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile realnie kosztuje skok o jeden poziom (2→3 predykcja) i jaki jest zwrot — o ile skróci się czas reakcji i spadną kary, jeśli wyeliminujecie samo źródło opóźnienia, a nie tylko przyspieszycie raport?',
        en: 'What does a one-level jump (2→3 prediction) really cost, and what is the return — how much does response time drop and penalties fall if you eliminate the source of delay rather than just speed up reporting?',
      },
      rationale: {
        pl: 'Skok 2→3 daje największy zwrot per złotówkę, bo usuwa przyczynę opóźnienia reakcji, a nie tylko przyspiesza raportowanie — nie przeskakujcie od razu do poziomu 5, ROI jest w najbliższym kroku.',
        en: 'The 2→3 jump returns the most per unit of spend, because it removes the cause of delayed response rather than just speeding reporting — do not leap straight to level 5, the ROI is in the nearest step.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej zdolności brakuje do najbliższego opłacalnego skoku (czyste dane do modelu, pętla digital twin poprawiająca progi, mandat na autonomię w granicach) i co się stanie, jeśli oddacie sterowanie na brudnych danych?',
        en: 'Which capability is missing for the next payable jump (clean data for the model, a digital-twin loop refining thresholds, a mandate for bounded autonomy), and what happens if you hand over control on dirty data?',
      },
      rationale: {
        pl: 'Autonomia na brudnych danych jest gorsza od człowieka, bo błąd skaluje się cicho — bez pętli closed-loop z digital twin alerty tracą trafność i system nie uczy się; najpierw zbuduj zaufanie do danych.',
        en: 'Autonomy on dirty data is worse than a human, because the error scales silently — without a closed-loop digital twin alerts lose accuracy and the system stops learning; build trust in the data first.',
      },
    },
  ],
};

export interface LeverProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per lever. Consumed when AI (or the offline
 * fallback) proposes candidate control-tower moves. Mirrors the Inventory
 * PROPOSAL_BANK.
 */
export const CONTROL_TOWER_PROPOSAL_BANK: Record<ControlTowerLeverId, LeverProposal[]> = {
  visibility: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować łańcuch end-to-end i oznaczyć martwe pola',
        en: 'Map the chain end-to-end and mark the blind spots',
      },
      explanation: {
        pl: 'Wypiszcie każdy węzeł (ERP, WMS, TMS, dostawcy Tier-1/2/3, przewoźnicy, 3PL) i oznaczcie, który ma automatyczny feed, a który widzicie tylko telefonem — mapa martwych pól jest sama w sobie insightem.',
        en: 'List every node (ERP, WMS, TMS, Tier-1/2/3 suppliers, carriers, 3PL) and mark which has an automated feed versus which you only see by phone — the blind-spot map is itself an insight.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć realną świeżość danych per węzeł',
        en: 'Measure real data freshness per node',
      },
      explanation: {
        pl: 'Sprawdźcie, jak stary jest najświeższy rekord z każdego węzła — feed „raz dziennie ręcznie" to archiwum, nie widoczność; świeżość, nie istnienie systemu, decyduje o wczesnym ostrzeganiu.',
        en: 'Check how old the freshest record from each node is — a "manual once a day" feed is an archive, not visibility; freshness, not system existence, decides early warning.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć wartość przechodzącą przez martwe pola',
        en: 'Cost the value flowing through blind spots',
      },
      explanation: {
        pl: 'Zsumujcie wartość zakupu / wolumen przechodzący przez węzły bez integracji — ta liczba, przełożona na kary OTIF, jest argumentem do zarządu, nie do IT.',
        en: 'Sum the purchase value / volume flowing through unintegrated nodes — that number, translated into OTIF penalties, is an argument for the board, not for IT.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zintegrować EDI/API z najdroższym martwym polem',
        en: 'Integrate EDI/API with the costliest blind spot',
      },
      explanation: {
        pl: 'Skierujcie pierwszą integrację tam, gdzie niewidoczność kosztuje najwięcej — ale tylko jeśli dane źródłowe istnieją cyfrowo; węzeł ręczny najpierw ucyfrowić, potem spinać.',
        en: 'Point the first integration where blindness costs the most — but only if the source data exists digitally; a manual node must be digitized first, then wired.',
      },
    },
  ],
  exceptions: [
    {
      rung: 'surface',
      title: {
        pl: 'Zdefiniować próg i właściciela dla każdego wyjątku',
        en: 'Define a threshold and owner for each exception',
      },
      explanation: {
        pl: 'Każdy typ wyjątku (opóźnienie ASN, odchylenie ETA, przekroczony próg zapasu) musi mieć jawny próg i przypisanego właściciela — bez tego alert jest szumem, nie sygnałem sterującym.',
        en: 'Every exception type (ASN delay, ETA deviation, stock-threshold breach) must have an explicit threshold and an assigned owner — without it an alert is noise, not a steering signal.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zastąpić progi statyczne dynamicznymi (per SKU/trasa/dostawca)',
        en: 'Replace static thresholds with dynamic ones (per SKU/route/supplier)',
      },
      explanation: {
        pl: 'Ustawcie próg względem historycznej zmienności danej pozycji, nie jedną liczbę dla wszystkich — dynamiczny próg tnie szum sezonowy i podnosi udział alertów kończących się akcją.',
        en: 'Set the threshold relative to the item\'s historical variability, not one number for all — a dynamic threshold cuts seasonal noise and lifts the share of alerts that end in action.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zmierzyć detection lag per typ zakłócenia',
        en: 'Measure detection lag per disruption type',
      },
      explanation: {
        pl: 'Policzcie średnią lukę między powstaniem problemu u źródła a jego pojawieniem się w wieży — ta liczba (np. „31h dla opóźnień dostawcy") jest bezpośrednim uzasadnieniem integracji danego węzła.',
        en: 'Compute the average gap between a problem arising at source and its appearance in the tower — that number (e.g. "31h for supplier delays") directly justifies integrating that node.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wprowadzić root-cause tagging i przegląd alert fatigue',
        en: 'Introduce root-cause tagging and an alert-fatigue review',
      },
      explanation: {
        pl: 'Każdy zamknięty wyjątek dostaje kategorię przyczyny źródłowej; udział alertów zamykanych bez akcji prowadzi do redesignu logiki progów, nie do zatrudnienia większego zespołu do ich czytania.',
        en: 'Every closed exception gets a root-cause category; the share of alerts closed with no action drives a redesign of the threshold logic, not hiring a bigger team to read them.',
      },
    },
  ],
  response: [
    {
      rung: 'surface',
      title: {
        pl: 'Przypisać właściciela do każdej kategorii wyjątku',
        en: 'Assign an owner to each exception category',
      },
      explanation: {
        pl: 'Opóźnienie dostawcy → category manager zaopatrzenia; przekroczony próg zapasu → planista popytu — alert bez właściciela nie prowadzi do decyzji, więc wieża pozostaje dashboardem.',
        en: 'Supplier delay → procurement category manager; stock-threshold breach → demand planner — an alert without an owner leads to no decision, so the tower stays a dashboard.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zapisać SLA reakcji i ścieżkę eskalacji per krytyczność',
        en: 'Write response SLAs and an escalation path per criticality',
      },
      explanation: {
        pl: 'P1 (wpływ na klienta w 24h) → reakcja w 30 min, eskalacja do dyrektora po 2h braku działania; priorytetyzacja wg wpływu biznesowego, nie kolejności w kolejce alertów.',
        en: 'P1 (customer impact within 24h) → respond in 30 min, escalate to the director after 2h of inaction; prioritize by business impact, not by order in the alert queue.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zmierzyć czas cyklu wykrycie→decyzja→rozwiązanie',
        en: 'Measure the detection→decision→resolution cycle time',
      },
      explanation: {
        pl: 'Rozłóżcie czas reakcji na wyjątek na etapy — to pokazuje, gdzie tkwi opóźnienie (w wykryciu czy w decyzji) i uzasadnia wspólny stół decyzyjny zamiast alertu w skrzynce jednej osoby.',
        en: 'Break the exception response time into stages — this shows where the delay sits (in detection or in decision) and justifies a shared decision table over an alert in one inbox.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uruchomić rytm nerve center z zamknięciem pętli root-cause',
        en: 'Run a nerve-center rhythm with a root-cause closed loop',
      },
      explanation: {
        pl: 'Wprowadźcie codzienny/tygodniowy huddle, w którym wyjątki trafiają na wspólny stół i dostają przypisaną przyczynę źródłową — bez zamknięcia pętli ten sam problem wraca cyklicznie.',
        en: 'Introduce a daily/weekly huddle where exceptions hit a shared table and get a root cause assigned — without closing the loop the same problem recurs cyclically.',
      },
    },
  ],
  maturity: [
    {
      rung: 'surface',
      title: {
        pl: 'Zdiagnozować obecny poziom dojrzałości (1–5)',
        en: 'Diagnose the current maturity level (1–5)',
      },
      explanation: {
        pl: 'Nazwijcie uczciwie, gdzie jesteście — widoczność, diagnostyczny, predykcyjny, prescriptywny czy autonomiczny; większość organizacji tkwi na 1–2 mimo przekonania, że jest wyżej.',
        en: 'Name honestly where you are — visibility, diagnostic, predictive, prescriptive or autonomous; most organizations sit at 1–2 despite believing they are higher.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zweryfikować poziom po wyprzedzeniu predykcji, nie po nazwie narzędzia',
        en: 'Verify the level by prediction lead time, not the tool\'s name',
      },
      explanation: {
        pl: 'Poziom 3 wymaga przewidzenia wyjątku 8–24h przed materializacją; jeśli system tylko alarmuje po odchyleniu, jesteście na 2 — dowodem jest wyprzedzenie, nie deklaracja „mamy AI".',
        en: 'Level 3 requires predicting an exception 8–24h before it materializes; if the system only alarms after a deviation, you are at 2 — the evidence is lead time, not a "we have AI" claim.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wycenić najbliższy opłacalny skok (zwykle 2→3)',
        en: 'Cost the nearest payable jump (usually 2→3)',
      },
      explanation: {
        pl: 'Policzcie koszt i zwrot skoku o jeden poziom — skok 2→3 (predykcja) daje największy zwrot per złotówkę, bo eliminuje źródło opóźnienia reakcji; nie przeskakujcie od razu do autonomii.',
        en: 'Cost and return the one-level jump — the 2→3 jump (prediction) returns the most per unit of spend, because it removes the source of delayed response; do not leap straight to autonomy.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zbudować pętlę closed-loop (digital twin) zanim oddacie autonomię',
        en: 'Build a closed-loop (digital twin) before handing over autonomy',
      },
      explanation: {
        pl: 'Dane operacyjne z wieży zasilają model, model poprawia progi wieży — bez tej pętli alerty tracą trafność; oddanie sterowania na brudnych danych skaluje błąd cicho, więc najpierw zaufanie do danych.',
        en: 'Operational data feeds the model, the model refines the tower thresholds — without this loop alerts lose accuracy; handing over control on dirty data scales the error silently, so trust in data first.',
      },
    },
  ],
};
