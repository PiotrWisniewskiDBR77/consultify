/**
 * SMED Planner — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Ansoff / SWOT `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/ansoff/deepeningLadder.ts). Encodes the SMED-specific
 * "depth staircase" per changeover phase:
 *
 *   1. surface          — what happens today in this phase of the changeover?
 *   2. evidence         — is the step measured, and is it truly internal?
 *   3. quantification   — how many minutes does it cost, at what frequency?
 *   4. risk-capability  — what must you be able to do to convert or eliminate it?
 *
 * The four canonical SMED phases mirror Shingo's method:
 *   - separate        : split internal (machine stopped) from external (machine running)
 *   - convert         : move work from internal to external
 *   - streamline      : shrink the remaining internal time (parallel, clamps, standards)
 *   - standardize     : lock the gain with a repeatable, trained procedure
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the SMED
 * input/improvement phases and by the synthesis engine (changeoverEngine.ts).
 */

export type SmedPhaseId = 'separate' | 'convert' | 'streamline' | 'standardize';

export const SMED_PHASES: SmedPhaseId[] = [
  'separate',
  'convert',
  'streamline',
  'standardize',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and phase-agnostic. */
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

/** The four canonical rungs shared by every phase, with phase-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const SMED_LADDER_RUNG_ORDER = RUNG_ORDER;

const SMED_PHASE_LABEL: Record<SmedPhaseId, Bilingual> = {
  separate: { pl: 'Rozdziel', en: 'Separate' },
  convert: { pl: 'Przenieś', en: 'Convert' },
  streamline: { pl: 'Skróć', en: 'Streamline' },
  standardize: { pl: 'Ustandaryzuj', en: 'Standardize' },
};

export const smedPhaseLabel = (phase: SmedPhaseId): Bilingual => SMED_PHASE_LABEL[phase];

/**
 * Per-phase deepening ladder. Each phase has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const SMED_DEEPENING_LADDER: Record<SmedPhaseId, LadderRung[]> = {
  separate: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które czynności przezbrojenia dziś robicie przy maszynie zatrzymanej, a które dałoby się robić w trakcie pracy?',
        en: 'Which changeover steps do you do today with the machine stopped, and which could run while it is still producing?',
      },
      rationale: {
        pl: 'Cała metoda SMED zaczyna się od uczciwego podziału: czynność wewnętrzna (maszyna stoi) czy zewnętrzna (maszyna pracuje).',
        en: 'The whole SMED method starts with an honest split: is the step internal (machine down) or external (machine running)?',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że dana czynność musi być wewnętrzna — z pomiaru i obserwacji, czy z „zawsze tak robiliśmy"?',
        en: 'How do you know a step must be internal — from measurement and observation, or from "we have always done it this way"?',
      },
      rationale: {
        pl: 'Większość „wymuszonego postoju" to nawyk, nie fizyka. Bez dowodu klasyfikacja jest życzeniowa.',
        en: 'Most "forced downtime" is habit, not physics. Without evidence the classification is wishful.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile minut zajmuje ta czynność i przy jakiej częstotliwości przezbrojeń — ile realnie kosztuje w skali roku?',
        en: 'How many minutes does this step take, at what changeover frequency — what does it really cost across a year?',
      },
      rationale: {
        pl: 'Minuty × częstotliwość zamieniają „długo trwa" w policzoną utratę zdolności produkcyjnej.',
        en: 'Minutes × frequency turn "it takes a while" into a counted loss of production capacity.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czego zabrakło (przygotowanie, narzędzia, ludzie), żeby ta czynność mogła być zewnętrzna bez ryzyka błędu?',
        en: 'What is missing (prep, tooling, staffing) so this step could be external without risking a defect?',
      },
      rationale: {
        pl: 'Rozdzielenie bez zabezpieczenia jakości przenosi ryzyko, zamiast je usunąć — najpierw nazwij lukę zdolności.',
        en: 'Separating without a quality safeguard shifts risk instead of removing it — name the capability gap first.',
      },
    },
  ],
  convert: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które czynności wewnętrzne dają się przenieść na czas pracy maszyny (przygotowanie, kompletacja, pre-heating)?',
        en: 'Which internal steps can be moved to run while the machine is producing (prep, kitting, pre-heating)?',
      },
      rationale: {
        pl: 'Konwersja internal→external to najtańszy zysk SMED — nie skracacie pracy, tylko wyjmujecie ją z postoju.',
        en: 'Internal→external conversion is SMED\'s cheapest win — you do not shorten the work, you take it out of the downtime.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Co udowadnia, że przeniesienie jest bezpieczne — pilotaż, karta pracy, zgoda utrzymania ruchu i jakości?',
        en: 'What proves the move is safe — a pilot, a work card, sign-off from maintenance and quality?',
      },
      rationale: {
        pl: 'Konwersja bez dowodu bezpieczeństwa kończy się ukrytym wzrostem braków przy pierwszej sztuce.',
        en: 'Conversion without safety evidence ends in a hidden first-piece defect spike.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile minut postoju odzyskujecie na przeniesieniu i jaki jest koszt przygotowania (wózki, drugi komplet, stanowisko)?',
        en: 'How many downtime minutes do you recover by moving it, and what does the prep cost (carts, second set, staging)?',
      },
      rationale: {
        pl: 'Odzyskane minuty muszą przewyższyć koszt drugiego kompletu — inaczej to konwersja na papierze.',
        en: 'Recovered minutes must beat the cost of a second set — otherwise it is a conversion only on paper.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej zdolności brakuje (drugi komplet oprzyrządowania, przeszkolony operator, bufor), żeby przenieść trwale?',
        en: 'Which capability is missing (a second tooling set, a trained operator, a buffer) to move it permanently?',
      },
      rationale: {
        pl: 'Konwersja utrzymuje się tylko z zasobem, który ją umożliwia — bez niego cofa się przy pierwszym braku ludzi.',
        en: 'A conversion holds only with the resource that enables it — without it, it reverts at the first staffing gap.',
      },
    },
  ],
  streamline: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które pozostałe czynności wewnętrzne trwają najdłużej i dają się skrócić (równoległość, szybkozłącza, eliminacja regulacji)?',
        en: 'Which remaining internal steps take longest and can be shortened (parallel work, quick clamps, eliminating adjustments)?',
      },
      rationale: {
        pl: 'Po konwersji zostaje twardy rdzeń wewnętrzny — tu skracamy sam czas, nie tylko go przesuwamy.',
        en: 'After conversion a hard internal core remains — here you shorten the time itself, not just relocate it.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile z czasu wewnętrznego to regulacje metodą prób i błędów, które da się zastąpić ustawieniem bazowym lub kalibrem?',
        en: 'How much internal time is trial-and-error adjustment that a preset datum or gauge could replace?',
      },
      rationale: {
        pl: 'Największa dźwignia streamline to eliminacja „dojazdów" nastaw — mierzalna, jeśli policzycie próby.',
        en: 'The biggest streamline lever is eliminating adjustment "hunting" — measurable if you count the trials.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile minut skróci się przezbrojenie po usprawnieniu i jaki jest koszt/wysiłek wdrożenia (oprzyrządowanie, przeróbka)?',
        en: 'By how many minutes will the changeover shrink after the improvement, and what is the cost/effort (tooling, rework)?',
      },
      rationale: {
        pl: 'Streamline bywa kapitałochłonny — bez policzonego zwrotu grozi przeinwestowaniem w rzadkie przezbrojenie.',
        en: 'Streamline can be capital-heavy — without a computed return it risks over-investing in a rare changeover.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy skrócenie nie podnosi ryzyka jakości/BHP i czy zespół ma kompetencje, by utrzymać nowe tempo?',
        en: 'Does the shortening raise a quality/safety risk, and does the team have the competency to hold the new pace?',
      },
      rationale: {
        pl: 'Skrócony czas, który podnosi braki lub ryzyko urazu, nie jest oszczędnością — jest przeniesieniem kosztu.',
        en: 'A shortened time that raises defects or injury risk is not a saving — it is a relocated cost.',
      },
    },
  ],
  standardize: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy nowy sposób przezbrojenia jest spisany jako standard z jedną najlepszą sekwencją i punktami kontrolnymi?',
        en: 'Is the new changeover captured as a standard with one best sequence and defined check points?',
      },
      rationale: {
        pl: 'Bez spisanego standardu zysk SMED jest wynikiem jednej dobrej zmiany, nie procesu — zniknie z rotacją ludzi.',
        en: 'Without a written standard the SMED gain is one good shift, not a process — it vanishes with staff rotation.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ilu operatorów potrafi wykonać nowy standard w docelowym czasie — i skąd to wiecie (obserwacja, karta szkoleń)?',
        en: 'How many operators can hit the new standard in target time — and how do you know (observation, a training matrix)?',
      },
      rationale: {
        pl: 'Standard, który umie tylko autor usprawnienia, to nie standard — dowodem jest powtarzalność między ludźmi.',
        en: 'A standard only its author can run is not a standard — the proof is repeatability across people.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest rozrzut czasu przezbrojenia między zmianami/operatorami i jaki cel stabilności chcecie osiągnąć?',
        en: 'What is the spread of changeover time across shifts/operators, and what stability target do you want to hit?',
      },
      rationale: {
        pl: 'Sam średni czas kłamie — o dojrzałości standardu mówi rozrzut, który trzeba zmierzyć i zamknąć.',
        en: 'Average time alone lies — standard maturity shows in the spread, which you must measure and close.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Kto jest właścicielem standardu i jak wychwytujecie odchylenia, zanim czas przezbrojenia znów zacznie rosnąć?',
        en: 'Who owns the standard, and how do you catch drift before the changeover time starts creeping back up?',
      },
      rationale: {
        pl: 'Bez właściciela i pętli kontroli standard eroduje — utrzymanie zysku to zdolność zarządcza, nie techniczna.',
        en: 'Without an owner and a control loop the standard erodes — holding the gain is a managerial capability, not a technical one.',
      },
    },
  ],
};

export interface PhaseProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per phase. Consumed when AI (or the offline
 * fallback) proposes candidate SMED improvements. Mirrors Ansoff's PROPOSAL_BANK.
 */
export const SMED_PROPOSAL_BANK: Record<SmedPhaseId, PhaseProposal[]> = {
  separate: [
    {
      rung: 'surface',
      title: {
        pl: 'Nakręcić i rozpisać jedno realne przezbrojenie',
        en: 'Film and break down one real changeover',
      },
      explanation: {
        pl: 'Zanim cokolwiek usprawnicie, nagrajcie typowe przezbrojenie i rozdzielcie każdą czynność na wewnętrzną i zewnętrzną — to fundament, którego nie zastąpi pamięć zespołu.',
        en: 'Before improving anything, record a typical changeover and split every step into internal and external — the foundation team memory cannot replace.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zakwestionować każdą „wymuszoną" czynność wewnętrzną',
        en: 'Challenge every "forced" internal step',
      },
      explanation: {
        pl: 'Dla każdej czynności robionej przy stojącej maszynie zapytajcie „dlaczego nie w trakcie pracy?" — większość odpowiedzi to nawyk, nie ograniczenie fizyczne.',
        en: 'For each step done with the machine stopped, ask "why not while it runs?" — most answers are habit, not a physical constraint.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć koszt postoju wewnętrznego w skali roku',
        en: 'Cost the internal downtime across a full year',
      },
      explanation: {
        pl: 'Suma minut wewnętrznych × liczba przezbrojeń/rok pokazuje, ile zdolności produkcyjnej tracicie — to liczba, która uzasadnia inwestycję.',
        en: 'Total internal minutes × changeovers/year shows how much production capacity you lose — the number that justifies the investment.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przygotować listę kontrolną pierwszej sztuki',
        en: 'Build a first-piece check list',
      },
      explanation: {
        pl: 'Rozdzielenie jest bezpieczne tylko z kontrolą jakości na starcie — lista pierwszej sztuki chroni przed przeniesieniem ryzyka braku zamiast jego usunięcia.',
        en: 'Separation is safe only with a start-up quality gate — a first-piece checklist prevents shifting defect risk instead of removing it.',
      },
    },
  ],
  convert: [
    {
      rung: 'surface',
      title: {
        pl: 'Przygotować oprzyrządowanie zawczasu, poza postojem',
        en: 'Stage tooling in advance, outside the downtime',
      },
      explanation: {
        pl: 'Kompletację narzędzi, form i materiałów przenieście na czas pracy maszyny — najprostsza konwersja internal→external, zwykle bez inwestycji.',
        en: 'Move tool, die and material kitting to while the machine runs — the simplest internal→external conversion, usually with no capex.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zwalidować przeniesienie pilotażem na jednej zmianie',
        en: 'Validate the move with a single-shift pilot',
      },
      explanation: {
        pl: 'Zanim zmienicie standard dla wszystkich, przetestujcie przeniesienie na jednej zmianie z pomiarem czasu i jakości — dowód przed skalowaniem.',
        en: 'Before changing the standard for everyone, pilot the move on one shift with time and quality measured — evidence before scaling.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wprowadzić drugi komplet oprzyrządowania dla wąskiego gardła',
        en: 'Add a second tooling set for the bottleneck',
      },
      explanation: {
        pl: 'Jeśli odzyskane minuty przewyższają koszt, drugi komplet pozwala przygotować kolejną partię w trakcie pracy — konwersja utrwalona zasobem.',
        en: 'If recovered minutes beat the cost, a second set lets you prep the next run while producing — a conversion made permanent by a resource.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przeszkolić operatorów w przygotowaniu równoległym',
        en: 'Train operators in parallel preparation',
      },
      explanation: {
        pl: 'Konwersja utrzymuje się tylko, gdy więcej niż jedna osoba umie przygotować przezbrojenie w trakcie pracy — bez tego cofa się przy nieobecności.',
        en: 'A conversion holds only when more than one person can prep during production — without it, it reverts on absence.',
      },
    },
  ],
  streamline: [
    {
      rung: 'surface',
      title: {
        pl: 'Zrównoleglić czynności dwóch operatorów w postoju',
        en: 'Parallelize two operators during the stop',
      },
      explanation: {
        pl: 'Tam, gdzie jeden operator robi czynności sekwencyjnie, dwóch pracujących równolegle skraca postój — bez inwestycji, kosztem koordynacji.',
        en: 'Where one operator works sequentially, two working in parallel cut the stop — no capex, at the cost of coordination.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wyeliminować regulacje przez ustawienie bazowe',
        en: 'Eliminate adjustments with a preset datum',
      },
      explanation: {
        pl: 'Jeśli operatorzy „dojeżdżają" nastawy metodą prób, bazowe pozycjonowanie lub kalibry usuwają najdroższy, najbardziej zmienny fragment czasu wewnętrznego.',
        en: 'If operators "hunt" settings by trial, datum positioning or gauges remove the most costly, most variable slice of internal time.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wymienić śruby na szybkozłącza w krytycznych punktach',
        en: 'Swap bolts for quick clamps at critical points',
      },
      explanation: {
        pl: 'Szybkozłącza opłacają się tam, gdzie odkręcanie/dokręcanie dominuje w czasie — policzcie minuty przed inwestycją, by nie przeinwestować rzadkiego przezbrojenia.',
        en: 'Quick clamps pay off where un/fastening dominates the time — count the minutes before investing so a rare changeover is not over-tooled.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Sprawdzić wpływ skrócenia na jakość i BHP',
        en: 'Verify the shortening against quality and safety',
      },
      explanation: {
        pl: 'Zanim utrwalicie szybszy sposób, potwierdźcie, że nie podnosi braków ani ryzyka urazu — skrócony czas kosztem jakości to fałszywa oszczędność.',
        en: 'Before locking a faster method, confirm it raises neither defects nor injury risk — a shorter time at the cost of quality is a false saving.',
      },
    },
  ],
  standardize: [
    {
      rung: 'surface',
      title: {
        pl: 'Spisać jednostronicowy standard przezbrojenia',
        en: 'Write a one-page changeover standard',
      },
      explanation: {
        pl: 'Jedna najlepsza sekwencja z czasami, punktami kontrolnymi i zdjęciami zamienia zysk z jednej zmiany w powtarzalny proces odporny na rotację ludzi.',
        en: 'One best sequence with times, check points and photos turns a one-shift gain into a repeatable process resilient to staff rotation.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zbudować macierz kompetencji przezbrojenia',
        en: 'Build a changeover skills matrix',
      },
      explanation: {
        pl: 'Macierz „kto umie w docelowym czasie" pokazuje, czy standard jest realny, czy zależy od jednej osoby — dowodem dojrzałości jest powtarzalność między ludźmi.',
        en: 'A "who can hit target time" matrix shows whether the standard is real or hinges on one person — maturity is proven by cross-people repeatability.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Śledzić rozrzut czasu, nie tylko średnią',
        en: 'Track the time spread, not just the average',
      },
      explanation: {
        pl: 'Mierzcie odchylenie czasu przezbrojenia między zmianami i operatorami — zamknięcie rozrzutu, nie kolejna średnia, dowodzi ustabilizowanego standardu.',
        en: 'Measure the changeover-time deviation across shifts and operators — closing the spread, not another average, proves a stabilized standard.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wyznaczyć właściciela standardu i pętlę audytu',
        en: 'Assign a standard owner and an audit loop',
      },
      explanation: {
        pl: 'Bez właściciela i regularnego audytu standard eroduje po kilku miesiącach — utrzymanie zysku SMED to zdolność zarządcza, nie jednorazowy projekt.',
        en: 'Without an owner and a regular audit the standard erodes within months — holding the SMED gain is a managerial capability, not a one-off project.',
      },
    },
  ],
};
