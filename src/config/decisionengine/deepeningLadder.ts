/**
 * Decision Engine — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern. Encodes the Decision-Quality "depth staircase" per element of a
 * strategic decision (Strategic Decisions Group — Howard/Spetzler, Stanford
 * Decision Analysis + McKinsey debiasing corpus):
 *
 *   1. surface          — what is the decision as it is currently framed / stated?
 *   2. evidence         — is the framing / option / value grounded, or is it habit,
 *                         an anchor, or a false binary?
 *   3. quantification   — how much does each option cost / return, at what
 *                         uncertainty range (low/base/high), against what weights?
 *   4. risk-capability  — what must be true (assumptions), what could flip the
 *                         recommendation, and is there real commitment to execute?
 *
 * The five canonical Decision-Quality elements this tool works are the input
 * side of the six-link chain (link 5 "sound reasoning" is the engine's own job,
 * link 6 "commitment" is surfaced by the `assumptions`/commitment rung):
 *   - frame        : the decision question, decision-maker, horizon and scope
 *   - alternatives : a MECE set of ≥3 real options (breaks false binaries)
 *   - criteria     : what the decision-maker truly values + relative weights
 *   - uncertainty  : facts vs estimates vs unknowns, as ranges not point numbers
 *   - assumptions  : the hidden premises each alternative silently stands on
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (decisionEngine.ts).
 */

export type DecisionElementId =
  | 'frame'
  | 'alternatives'
  | 'criteria'
  | 'uncertainty'
  | 'assumptions';

export const DECISION_ELEMENTS: DecisionElementId[] = [
  'frame',
  'alternatives',
  'criteria',
  'uncertainty',
  'assumptions',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and element-agnostic. */
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

export const DECISION_LADDER_RUNG_ORDER = RUNG_ORDER;

const DECISION_ELEMENT_LABEL: Record<DecisionElementId, Bilingual> = {
  frame: { pl: 'Ramowanie', en: 'Frame' },
  alternatives: { pl: 'Alternatywy', en: 'Alternatives' },
  criteria: { pl: 'Kryteria i wartości', en: 'Criteria & values' },
  uncertainty: { pl: 'Niepewności', en: 'Uncertainties' },
  assumptions: { pl: 'Założenia', en: 'Assumptions' },
};

export const decisionElementLabel = (element: DecisionElementId): Bilingual =>
  DECISION_ELEMENT_LABEL[element];

/**
 * The six links of the Decision Quality chain (SDG). Exported so the engine and
 * UI share one canonical list — a decision is only as good as its weakest link.
 */
export type DecisionLinkId =
  | 'frame'
  | 'alternatives'
  | 'information'
  | 'values'
  | 'reasoning'
  | 'commitment';

export const DECISION_QUALITY_LINKS: DecisionLinkId[] = [
  'frame',
  'alternatives',
  'information',
  'values',
  'reasoning',
  'commitment',
];

export const DECISION_LINK_LABEL: Record<DecisionLinkId, Bilingual> = {
  frame: { pl: 'Odpowiednia rama', en: 'Appropriate frame' },
  alternatives: { pl: 'Kreatywne, wykonalne alternatywy', en: 'Creative, doable alternatives' },
  information: { pl: 'Znaczące, wiarygodne informacje', en: 'Meaningful, reliable information' },
  values: { pl: 'Jasne wartości i trade-offy', en: 'Clear values and trade-offs' },
  reasoning: { pl: 'Solidne rozumowanie', en: 'Sound reasoning' },
  commitment: { pl: 'Zaangażowanie do działania', en: 'Commitment to action' },
};

export const decisionLinkLabel = (link: DecisionLinkId): Bilingual => DECISION_LINK_LABEL[link];

/**
 * Per-element deepening ladder. Each element has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const DECISION_DEEPENING_LADDER: Record<DecisionElementId, LadderRung[]> = {
  frame: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak brzmi decyzja, którą chcecie podjąć — jednym zdaniem, jako pytanie? Kto jest faktycznym decydentem i jaki jest horyzont czasowy?',
        en: 'What is the decision you want to make — in one sentence, as a question? Who is the actual decision-maker and what is the time horizon?',
      },
      rationale: {
        pl: 'Dobra odpowiedź na źle postawione pytanie jest bezwartościowa — ramowanie to pierwsze i najważniejsze ogniwo, błąd tu unieważnia całą resztę analizy.',
        en: 'A good answer to the wrong question is worthless — the frame is the first and most important link; an error here voids everything below it.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy pytanie jest postawione jako binarne („robić X czy nie")? Jeśli tak — czy to prawdziwy wybór, czy rytualne zatwierdzenie już preferowanej opcji?',
        en: 'Is the question framed as a binary ("do X or not")? If so — is it a real choice, or a ritual rubber-stamp of an already-preferred option?',
      },
      rationale: {
        pl: 'Fałszywa binarność to najczęstsza pułapka ramowania — gdy jedna z dwóch opcji jest „status quo, którego nikt nie chce", to nie wybór, tylko słomiany człowiek.',
        en: 'A false binary is the most common framing trap — when one of two options is "a status quo nobody wants", it is not a choice but a straw man.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Co dokładnie jest „w grze", a co poza zakresem? Ile realnie waży ta decyzja — jaki kapitał, czas kierownictwa lub reputację wiąże?',
        en: 'What exactly is "in play" and what is out of scope? How much does this decision really weigh — what capital, leadership time or reputation does it bind?',
      },
      rationale: {
        pl: 'Bez nazwania stawki i zakresu decyzja albo przerasta proces (formalizm dla drobiazgu), albo jest niedoważona (wielka stawka potraktowana rutynowo).',
        en: 'Without naming the stake and scope the decision either overwhelms the process (formalism for a trifle) or is under-weighted (a big stake handled as routine).',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy przy stole są wszystkie perspektywy potrzebne, by ta decyzja została WYKONANA — w tym linia operacyjna, która ją wdroży?',
        en: 'Are all the perspectives needed for this decision to be EXECUTED at the table — including the operating line that will implement it?',
      },
      rationale: {
        pl: 'Rama, przy której brakuje wykonawców, produkuje decyzje „zatwierdzone w sali", które utykają we wdrożeniu — szóste ogniwo (commitment) trzeba zabezpieczyć już w ramowaniu.',
        en: 'A frame missing the implementers produces "approved-in-the-room" decisions that stall in execution — the sixth link (commitment) must be secured already in the framing.',
      },
    },
  ],
  alternatives: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jakie opcje są dziś na stole? Wypiszcie je wszystkie — także tę, którą nazywacie „nic nie robić".',
        en: 'What options are on the table today? List them all — including the one you call "do nothing".',
      },
      rationale: {
        pl: 'Jeśli na stole są tylko dwie opcje, to sygnał ostrzegawczy, nie punkt wyjścia — prawdziwy wybór potrzebuje co najmniej trzech rozłącznych alternatyw.',
        en: 'If only two options sit on the table, that is a warning sign, not a starting point — a real choice needs at least three mutually exclusive alternatives.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy zestaw opcji jest MECE — rozłączny i wyczerpujący? Czy któraś opcja jest tam tylko po to, by przegrać z faworytem (słomiana opcja)?',
        en: 'Is the option set MECE — mutually exclusive and collectively exhaustive? Is any option there only to lose to the favourite (a straw-man option)?',
      },
      rationale: {
        pl: 'Zestaw z jedną realną i jedną słomianą opcją nie jest wyborem — to uzasadnienie decyzji już podjętej. Test: czy istnieje wersja hybrydowa, odroczona lub pilotażowa, której nikt nie rozważył?',
        en: 'A set with one real and one straw-man option is not a choice — it is a justification of a decision already made. Test: is there a hybrid, deferred or pilot version nobody considered?',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztuje i co zwraca każda alternatywa? Czy istnieje tania opcja diagnostyczna (pilotaż, opcja realna), która kupuje informację zamiast rozstrzygać od razu?',
        en: 'What does each alternative cost and return? Is there a cheap diagnostic option (a pilot, a real option) that buys information instead of deciding at once?',
      },
      rationale: {
        pl: 'Wiele „wielkich decyzji" rozpada się na tani krok diagnostyczny teraz + właściwą decyzję odroczoną — opcja realna często bije twarde postawienie na jedną kartę.',
        en: 'Many "big decisions" split into a cheap diagnostic step now + the real decision deferred — a real option often beats betting everything on one card.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy każda alternatywa jest wykonalna z posiadanymi zasobami i zdolnościami — czy któraś zakłada zdolność, której nie macie i którą trzeba dopiero zbudować?',
        en: 'Is each alternative doable with the resources and capabilities you have — or does one assume a capability you lack and would first have to build?',
      },
      rationale: {
        pl: 'Alternatywa wykonalna „na papierze", ale nie w tej organizacji, jest fikcją, która skrzywia macierz — wykonalność to część definicji prawdziwej opcji.',
        en: 'An alternative doable "on paper" but not in this organization is a fiction that skews the matrix — doability is part of the definition of a real option.',
      },
    },
  ],
  criteria: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na czym decydentowi naprawdę zależy przy tej decyzji — wzrost, ryzyko, czas do efektu, koszt reputacyjny, zgodność ze strategią, morale zespołu?',
        en: 'What does the decision-maker truly care about in this decision — growth, risk, time to effect, reputational cost, strategy fit, team morale?',
      },
      rationale: {
        pl: 'Kryteria to wartości, nie fakty — mieszanie tych dwóch porządków jest źródłem większości słabych decyzji zarządów; najpierw nazwij, co się liczy.',
        en: 'Criteria are values, not facts — conflating the two orders is the source of most poor board decisions; first name what counts.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy deklarowane kryteria (ROI, ryzyko) zgadzają się z rzeczywistymi wyborami w dyskusji — czy jest ukryte kryterium, którego nikt nie wypowiada wprost?',
        en: 'Do the declared criteria (ROI, risk) match the actual choices made in discussion — or is there a hidden criterion nobody states out loud?',
      },
      rationale: {
        pl: 'Ukryte kryterium — unikanie widocznej porażki, lojalność wobec autora poprzedniej decyzji — steruje wyborem silniej niż deklarowane; nazwanie go bywa najcenniejszym momentem sesji.',
        en: 'A hidden criterion — avoiding a visible failure, loyalty to the author of the previous decision — steers the choice harder than the declared ones; naming it is often the most valuable moment of the session.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaka jest względna waga każdego kryterium (suma 100%)? Gdzie decydent jest gotów ustąpić — co odda za co (ryzyko za wzrost, czas za pewność)?',
        en: 'What is the relative weight of each criterion (summing to 100%)? Where is the decision-maker willing to give — what do they trade for what (risk for growth, time for certainty)?',
      },
      rationale: {
        pl: 'Trade-off musi być jawny: „ile jesteśmy gotowi zapłacić ryzykiem za punkt wzrostu" — bez wag decyzja optymalizuje domyślną, niewypowiedzianą preferencję.',
        en: 'The trade-off must be explicit: "how much risk are we willing to pay for a point of growth" — without weights the decision optimizes a default, unspoken preference.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy wagi są sporne w zespole? Jeśli tak — czy spór jest o fakty (co się wydarzy), czy o wartości (na czym nam zależy)? To dwa różne spory.',
        en: 'Are the weights contested in the team? If so — is the dispute about facts (what will happen) or values (what we care about)? These are two different disputes.',
      },
      rationale: {
        pl: 'Spór o fakty rozwiązuje się danymi; spór o wartości rozwiązuje się jawną rozmową o preferencjach — pomylenie ich produkuje jałowe rundy dyskusji bez rozstrzygnięcia.',
        en: 'A dispute about facts is settled with data; a dispute about values is settled with an explicit conversation about preferences — confusing them produces fruitless rounds of discussion with no resolution.',
      },
    },
  ],
  uncertainty: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co w tej decyzji wiecie na pewno, co jest szacunkiem, a co czystą niewiadomą? Rozdzielcie te trzy porządki wprost.',
        en: 'In this decision, what do you know for certain, what is an estimate, and what is a pure unknown? Separate the three orders explicitly.',
      },
      rationale: {
        pl: 'Fakty i niepewności nieustannie mieszają się z wartościami w dyskusji — rozdzielenie ich jest warunkiem solidnego rozumowania, nie kosmetyką.',
        en: 'Facts and uncertainties constantly mix with values in discussion — separating them is a precondition for sound reasoning, not cosmetics.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy kluczowe niewiadome są podane jako zakres (niski / bazowy / wysoki), czy jako pojedyncza liczba udająca pewność?',
        en: 'Are the key unknowns given as a range (low / base / high), or as a single number pretending to be certainty?',
      },
      rationale: {
        pl: 'Szacunek punktowy to nadmierna pewność w przebraniu — zakres ujawnia, gdzie prognoza jest krucha i którą zmienną trzeba domierzyć przed decyzją, nie po niej.',
        en: 'A point estimate is overconfidence in disguise — a range reveals where the forecast is fragile and which variable to measure before the decision, not after it.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Dla każdej kluczowej niepewności: o ile zmienia się wynik, gdy zmienna idzie z low do high przy stałych pozostałych? Która ma największą rozpiętość wpływu?',
        en: 'For each key uncertainty: how much does the outcome change when the variable goes from low to high with the rest held constant? Which has the widest impact span?',
      },
      rationale: {
        pl: 'To jest analiza wrażliwości / tornado — zmienna z największym „pasem" na górze wykresu to prawdziwy decision driver, a nie to, o czym zarząd dyskutował najdłużej.',
        en: 'This is sensitivity / tornado analysis — the variable with the widest "bar" at the top is the real decision driver, not what the board debated the longest.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Która niepewność, jeśli rozstrzygnie się inaczej niż zakładacie, PRZEŁĄCZA rekomendację na inną opcję? Da się ją domierzyć tanim pilotażem przed decyzją?',
        en: 'Which uncertainty, if it resolves differently than you assume, FLIPS the recommendation to another option? Can it be measured with a cheap pilot before deciding?',
      },
      rationale: {
        pl: 'Zmienna, która przełącza rekomendację, zamienia decyzję jednorazową w warunkową z checkpointem — dużo bezpieczniejszą niż twarde postawienie na jedną kartę.',
        en: 'A variable that flips the recommendation turns a one-off decision into a conditional one with a checkpoint — far safer than betting everything on one card.',
      },
    },
  ],
  assumptions: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na jakich ukrytych przesłankach stoi każda alternatywa? Wypiszcie założenia typu „zakładamy, że konkurent nie zareaguje przez 12 miesięcy".',
        en: 'What hidden premises does each alternative stand on? Write out assumptions like "we assume the competitor will not react for 12 months".',
      },
      rationale: {
        pl: 'To założenia najczęściej przewracają rekomendację — muszą być nazwane wprost, bo dopóki są milczące, nikt ich nie testuje.',
        en: 'It is assumptions that most often overturn the recommendation — they must be named explicitly, because as long as they stay silent nobody tests them.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Które założenia są zakotwiczone w pierwszej liczbie na stole (budżet z zeszłego roku, propozycja szefa) albo w danych zgodnych z tym, co i tak chcieliście zrobić?',
        en: 'Which assumptions are anchored to the first number on the table (last year\'s budget, the boss\'s proposal) or to data that agrees with what you wanted to do anyway?',
      },
      rationale: {
        pl: 'Zakotwiczenie i potwierdzenie to dwa biasy, które przebierają preferencję za analizę — dowodem jest klasa referencyjna (outside view), nie wewnętrzna prognoza.',
        en: 'Anchoring and confirmation are two biases that dress a preference up as analysis — the evidence is a reference class (outside view), not the internal forecast.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Pre-mortem: jest 12 miesięcy później, decyzja zawiodła. Napiszcie wstecz — dlaczego? Które założenie okazało się fałszywe i ile to kosztowało?',
        en: 'Pre-mortem: it is 12 months later and the decision has failed. Write backwards — why? Which assumption turned out false and what did it cost?',
      },
      rationale: {
        pl: 'Pre-mortem (Klein) odblokowuje ~30% więcej trafnych zastrzeżeń niż standardowy przegląd ryzyka — przejście na tryb dokonany omija optymizm organizacyjny.',
        en: 'The pre-mortem (Klein) unlocks ~30% more valid objections than a standard risk review — shifting to the past tense bypasses organizational optimism.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy ci, którzy będą wdrażać tę decyzję, naprawdę się zgadzają i mają zasoby — czy tylko „zgodzili się w sali", a wrócą do starych nawyków?',
        en: 'Do those who will implement this decision really agree and have the resources — or did they only "agree in the room" and will revert to old habits?',
      },
      rationale: {
        pl: 'Szóste ogniwo — commitment — jest najczęściej puste i najrzadziej sprawdzane; decyzja bez realnego zaangażowania wykonawców po prostu nie wydarzy się w organizacji.',
        en: 'The sixth link — commitment — is most often empty and least often checked; a decision without real buy-in from implementers simply will not happen in the organization.',
      },
    },
  ],
};

export interface ElementProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per Decision-Quality element. Consumed when AI (or
 * the offline fallback) proposes candidate moves to raise decision quality.
 * Mirrors Inventory's INVENTORY_PROPOSAL_BANK.
 */
export const DECISION_PROPOSAL_BANK: Record<DecisionElementId, ElementProposal[]> = {
  frame: [
    {
      rung: 'surface',
      title: {
        pl: 'Zapisać decyzję jako jedno pytanie z decydentem i horyzontem',
        en: 'Write the decision as one question with decision-maker and horizon',
      },
      explanation: {
        pl: 'Sformułujcie właściwe pytanie decyzyjne, wskażcie decydenta i horyzont — zanim ktokolwiek zacznie bronić opcji, upewnijcie się, że wszyscy odpowiadają na to samo pytanie.',
        en: 'State the right decision question, name the decision-maker and the horizon — before anyone defends an option, make sure everyone is answering the same question.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przeramować binarne „czy X" na szersze „jak najlepiej osiągnąć cel"',
        en: 'Re-frame the binary "whether X" into the broader "how best to reach the goal"',
      },
      explanation: {
        pl: 'Zastąpcie „czy wejść na rynek Y" pytaniem „jak najlepiej przyspieszyć wzrost w Y przy ograniczonym kapitale" — szersza rama ujawnia opcje, które binarne pytanie ukrywa.',
        en: 'Replace "whether to enter market Y" with "how best to accelerate growth in Y with limited capital" — the broader frame surfaces options the binary question hides.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Sklasyfikować decyzję: jednodrzwiowa czy dwudrzwiowa',
        en: 'Classify the decision: one-way door or two-way door',
      },
      explanation: {
        pl: 'Oceńcie odwracalność i stawkę — pełny formalizm Decision Quality jest dla decyzji nieodwracalnych i wysokiej stawki, nie dla rutynowych; to chroni proces przed przeciążeniem.',
        en: 'Assess reversibility and stakes — the full Decision-Quality formalism is for irreversible, high-stakes decisions, not routine ones; this protects the process from overload.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Posadzić przy stole linię operacyjną, która wdroży decyzję',
        en: 'Seat the operating line that will implement the decision at the table',
      },
      explanation: {
        pl: 'Zaproście do ramowania tych, którzy będą wykonawcami — bez nich powstaje decyzja „zatwierdzona w sali", która utyka we wdrożeniu (puste ogniwo 6).',
        en: 'Invite the implementers into the framing — without them you get an "approved-in-the-room" decision that stalls in execution (an empty link 6).',
      },
    },
  ],
  alternatives: [
    {
      rung: 'surface',
      title: {
        pl: 'Wygenerować trzecią opcję, gdy na stole są tylko dwie',
        en: 'Generate a third option when only two are on the table',
      },
      explanation: {
        pl: 'Gdy wybór jest „X albo nie-X", dodajcie co najmniej jedną opcję hybrydową, odroczoną lub pilotażową — żeby przetestować, czy problem nie jest fałszywą binarnością.',
        en: 'When the choice is "X or not-X", add at least one hybrid, deferred or pilot option — to test whether the problem is a false binary.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Usunąć słomianą opcję i domknąć zestaw do MECE',
        en: 'Remove the straw-man option and close the set to MECE',
      },
      explanation: {
        pl: 'Sprawdźcie, czy któraś opcja jest tam tylko po to, by przegrać — i czy zestaw jest rozłączny i wyczerpujący; inaczej macierz punktacji potwierdza z góry wybraną opcję.',
        en: 'Check whether an option is there only to lose — and whether the set is mutually exclusive and exhaustive; otherwise the scoring matrix confirms a pre-chosen option.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wycenić tanią opcję realną (pilotaż kupujący informację)',
        en: 'Price a cheap real option (a pilot that buys information)',
      },
      explanation: {
        pl: 'Policzcie koszt małego kroku diagnostycznego, który rozstrzyga kluczową niepewność za ułamek ceny pełnej decyzji — często bije twarde postawienie na jedną kartę.',
        en: 'Cost the small diagnostic step that resolves the key uncertainty for a fraction of the full decision — it often beats betting everything on one card.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Odsiać alternatywy wymagające zdolności, której nie macie',
        en: 'Screen out alternatives that require a capability you lack',
      },
      explanation: {
        pl: 'Oznaczcie opcje wykonalne „na papierze", ale nie w tej organizacji — albo wyłączcie je, albo dodajcie do nich koszt zbudowania brakującej zdolności.',
        en: 'Flag options doable "on paper" but not in this organization — either exclude them or add the cost of building the missing capability.',
      },
    },
  ],
  criteria: [
    {
      rung: 'surface',
      title: {
        pl: 'Wypisać kryteria decydenta i oddzielić je od faktów',
        en: 'List the decision-maker\'s criteria and separate them from facts',
      },
      explanation: {
        pl: 'Nazwijcie wprost, na czym zależy (wzrost, ryzyko, czas, reputacja, strategia, morale) — kryteria to wartości; trzymanie ich osobno od faktów jest warunkiem czystej analizy.',
        en: 'Name explicitly what matters (growth, risk, time, reputation, strategy, morale) — criteria are values; keeping them apart from facts is a precondition for clean analysis.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wydobyć ukryte kryterium z rzeczywistych wyborów w dyskusji',
        en: 'Surface the hidden criterion from the actual choices in discussion',
      },
      explanation: {
        pl: 'Porównajcie, co zespół deklaruje (ROI, ryzyko), z tym, co faktycznie przeważa w wyborze — ujawnienie milczącego kryterium (unikanie porażki, lojalność) kończy jałowe rundy.',
        en: 'Compare what the team declares (ROI, risk) with what actually tips the choice — surfacing the silent criterion (avoiding failure, loyalty) ends the fruitless rounds.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Nadać wagi kryteriom i nazwać trade-off wprost',
        en: 'Assign weights to criteria and name the trade-off explicitly',
      },
      explanation: {
        pl: 'Rozpiszcie wagi sumujące się do 100% i zapiszcie, co decydent odda za co (ryzyko za wzrost, czas za pewność) — jawny trade-off zastępuje domyślną, niewypowiedzianą preferencję.',
        en: 'Lay out weights summing to 100% and record what the decision-maker trades for what (risk for growth, time for certainty) — an explicit trade-off replaces a default, unspoken preference.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Pokazać rekomendację przy 2-3 profilach wag, nie uśredniać po cichu',
        en: 'Show the recommendation under 2-3 weight profiles, do not silently average',
      },
      explanation: {
        pl: 'Gdy wagi są sporne, przedstawcie wynik dla kilku profili — to ujawnia, czy spór jest o fakty czy o wartości (często dwa różne spory pomylone w jeden).',
        en: 'When weights are contested, present the result under several profiles — this reveals whether the dispute is about facts or values (often two different disputes confused into one).',
      },
    },
  ],
  uncertainty: [
    {
      rung: 'surface',
      title: {
        pl: 'Rozdzielić fakty, szacunki i czyste niewiadome',
        en: 'Separate facts, estimates and pure unknowns',
      },
      explanation: {
        pl: 'Oznaczcie każdą liczbę jako fakt, szacunek albo niewiadomą — to pierwsza dyscyplina, która przestaje mieszać porządek informacji z porządkiem wartości.',
        en: 'Tag each number as a fact, an estimate or an unknown — the first discipline that stops mixing the order of information with the order of values.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zamienić szacunki punktowe na zakresy low/base/high',
        en: 'Convert point estimates into low/base/high ranges',
      },
      explanation: {
        pl: 'Dla każdej kluczowej niewiadomej podajcie zakres zamiast jednej liczby — zakres ujawnia nadmierną pewność i pokazuje, gdzie prognoza jest krucha.',
        en: 'For each key unknown give a range instead of one number — the range exposes overconfidence and shows where the forecast is fragile.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zbudować diagram tornado kluczowych niepewności',
        en: 'Build a tornado diagram of the key uncertainties',
      },
      explanation: {
        pl: 'Zrankujcie zmienne wg rozpiętości wpływu na wynik (low→high) — największy pas na górze to prawdziwy decision driver, nie temat, o którym dyskutowano najdłużej.',
        en: 'Rank the variables by their impact span on the outcome (low→high) — the widest bar at the top is the real decision driver, not the topic debated the longest.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Domierzyć zmienną, która przełącza rekomendację, przed decyzją',
        en: 'Measure the variable that flips the recommendation before deciding',
      },
      explanation: {
        pl: 'Zidentyfikujcie niepewność, na której rekomendacja się odwraca, i zaplanujcie tani pilotaż, który ją rozstrzygnie — to zamienia decyzję jednorazową w warunkową z checkpointem.',
        en: 'Identify the uncertainty on which the recommendation reverses and plan a cheap pilot to resolve it — this turns a one-off decision into a conditional one with a checkpoint.',
      },
    },
  ],
  assumptions: [
    {
      rung: 'surface',
      title: {
        pl: 'Wypisać ukryte założenia pod każdą alternatywą',
        en: 'Write out the hidden assumptions under each alternative',
      },
      explanation: {
        pl: 'Nazwijcie wprost przesłanki typu „konkurent nie zareaguje", „popyt utrzyma się", „zespół udźwignie" — milczące założenia najczęściej przewracają rekomendację.',
        en: 'Name premises like "the competitor won\'t react", "demand will hold", "the team can carry it" explicitly — silent assumptions most often overturn the recommendation.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przeciwdziałać zakotwiczeniu klasą referencyjną (outside view)',
        en: 'Counter anchoring with a reference class (outside view)',
      },
      explanation: {
        pl: 'Zestawcie wewnętrzną prognozę z klasą podobnych decyzji/projektów — outside view rozbraja zakotwiczenie w pierwszej liczbie i confirmation bias.',
        en: 'Compare the internal forecast with a reference class of similar decisions/projects — the outside view disarms anchoring to the first number and confirmation bias.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Przeprowadzić pre-mortem: „decyzja już zawiodła — dlaczego?"',
        en: 'Run a pre-mortem: "the decision has already failed — why?"',
      },
      explanation: {
        pl: 'Załóżcie, że za 12 miesięcy decyzja zawiodła, i wypiszcie wstecz przyczyny — tryb dokonany odblokowuje zastrzeżenia, których nikt nie powie w trybie warunkowym.',
        en: 'Assume the decision has failed 12 months out and write the causes backwards — the past tense unlocks objections nobody voices in the conditional.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Sprawdzić realne zaangażowanie wykonawców (ogniwo 6)',
        en: 'Test the implementers\' real commitment (link 6)',
      },
      explanation: {
        pl: 'Zweryfikujcie, czy linia operacyjna naprawdę się zgadza i ma zasoby — nie „zgoda w sali", tylko sprawdzalne zaangażowanie; bez niego decyzja nie zostanie wykonana.',
        en: 'Verify that the operating line truly agrees and has the resources — not "agreement in the room" but checkable commitment; without it the decision will not be executed.',
      },
    },
  ],
};
