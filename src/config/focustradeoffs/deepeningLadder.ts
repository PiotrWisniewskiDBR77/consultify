/**
 * Focus & Trade-offs — deepening ladder (drabinka pogłębiająca)
 *
 * Sibling of src/config/ansoff/deepeningLadder.ts. Where Ansoff walks each
 * growth quadrant down a depth staircase, Focus & Trade-offs walks each
 * competing priority down the SAME four-rung ladder, because scoring a
 * priority "high value / low effort" is worthless unless the consultant can
 * say WHERE the value shows up and WHAT it costs to pursue it:
 *
 *   1. surface          — what exactly is this priority and why is it on the table?
 *   2. evidence         — the proof it deserves scarce attention (demand, data, mandate)
 *   3. quantification   — the size of the prize vs the cost/effort to capture it
 *   4. risk-capability  — what you must be able to do (and give up) to actually win it
 *
 * The ladder is indexed by the store's `recommendation` lane
 * (pursue / defer / drop) so the config and the runtime speak the same
 * language. Content is partner-grade, bilingual (PL/EN), and consumed by the
 * FocusTradeoffs input/priorities phases and by the synthesis engine.
 */

export type FocusLane = 'pursue' | 'defer' | 'drop';

export const FOCUS_LANES: FocusLane[] = ['pursue', 'defer', 'drop'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and lane-agnostic. */
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

/** The four canonical rungs shared by every lane, with lane-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const FOCUS_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-lane deepening ladder. Each lane has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const FOCUS_DEEPENING_LADDER: Record<FocusLane, LadderRung[]> = {
  pursue: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co dokładnie chcecie tu zrobić i dlaczego akurat ten priorytet zasługuje na ograniczoną uwagę zarządu?',
        en: 'What exactly do you want to do here, and why does this priority deserve scarce board attention now?',
      },
      rationale: {
        pl: 'Fokus zaczyna się od nazwania priorytetu jednym zdaniem — jeśli nie da się go opisać ostro, nie da się go obronić przed innymi.',
        en: 'Focus starts by naming the priority in one sentence — if you cannot state it sharply, you cannot defend it against the others.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest twardy dowód, że ten priorytet zwróci uwagę i zasoby: popyt, dane, mandat, zależność strategiczna?',
        en: 'What is the hard evidence this priority earns attention and resources: demand, data, mandate, strategic dependency?',
      },
      rationale: {
        pl: 'Bez dowodu „pursue" jest ulubioną hipotezą właściciela, a nie decyzją — trade-off wymaga twardej strony wagi.',
        en: "Without evidence, a pursue is the owner's pet hypothesis, not a decision — a trade-off needs a hard side of the scale.",
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak duża jest nagroda (value) w stosunku do realnego wysiłku (effort) — czy stosunek value/effort naprawdę wygrywa z resztą?',
        en: 'How large is the prize (value) versus the real effort — does the value/effort ratio genuinely beat the rest?',
      },
      rationale: {
        pl: 'Fokus to arytmetyka, nie preferencja: priorytet wygrywa, gdy value/effort jest policzone, a nie odczute.',
        en: 'Focus is arithmetic, not preference: a priority wins when value/effort is computed, not felt.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co musicie umieć i z czego świadomie zrezygnować, żeby ten priorytet dowieźć bez rozmycia reszty?',
        en: 'What must you be able to do — and deliberately give up — to deliver this priority without diluting the rest?',
      },
      rationale: {
        pl: 'Pursue bez nazwanego kosztu (co odkładamy) to lista życzeń; fokus istnieje tylko tam, gdzie coś tracicie.',
        en: 'A pursue with no named cost (what we defer) is a wishlist; focus exists only where you give something up.',
      },
    },
  ],
  defer: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co to za priorytet i dlaczego rozważacie jego odłożenie, a nie porzucenie — co go trzyma na stole?',
        en: 'What is this priority and why are you weighing a defer rather than a drop — what keeps it on the table?',
      },
      rationale: {
        pl: 'Odłożenie to decyzja o kolejności, nie o wartości — najpierw nazwijcie, co realnie trzyma go w grze.',
        en: 'A defer is a decision about sequence, not value — first name what genuinely keeps it in the game.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że ten priorytet może poczekać: brak okna czasowego, zależność od innego ruchu, słabszy sygnał popytu?',
        en: 'What proves this priority can wait: no time window, dependency on another move, a weaker demand signal?',
      },
      rationale: {
        pl: 'Odłożenie bez dowodu, że nie pali się teraz, to ukryte „nie umiemy się zdecydować" — nazwijcie powód czekania.',
        en: 'A defer with no proof it is not urgent now is a hidden "we cannot decide" — name the reason to wait.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztuje odłożenie (utracona wartość × czas) i czy ten koszt jest mniejszy niż koszt rozproszenia teraz?',
        en: 'What does deferring cost (value forgone × time) and is that cost smaller than the cost of spreading thin now?',
      },
      rationale: {
        pl: 'Odłożenie ma cenę; policzcie utraconą wartość, żeby „później" nie zamieniło się cicho w „nigdy".',
        en: 'A defer has a price; compute the value forgone so that "later" does not quietly become "never".',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jaki warunek (zasób, wynik pilotażu, zdolność) musi się spełnić, żeby ten priorytet wrócił z ławki do gry?',
        en: 'Which trigger (resource, pilot result, capability) must be met for this priority to return from the bench?',
      },
      rationale: {
        pl: 'Uczciwe odłożenie ma warunek powrotu; bez niego to zamiatanie decyzji pod dywan, nie sekwencja.',
        en: 'An honest defer has a re-entry trigger; without one it is sweeping the decision under the rug, not sequencing.',
      },
    },
  ],
  drop: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co to za priorytet i dlaczego w ogóle znalazł się na liście — czyja to była teza?',
        en: 'What is this priority and why did it make the list in the first place — whose thesis was it?',
      },
      rationale: {
        pl: 'Porzucenie jest najtrudniejsze politycznie; najpierw nazwijcie priorytet i jego właściciela, żeby cięcie było jawne.',
        en: 'A drop is the hardest politically; first name the priority and its owner so the cut is explicit.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki dowód mówi, że to nie jest wasza gra: niski value, brak dopasowania strategicznego, słaby sygnał?',
        en: 'What evidence says this is not your game: low value, poor strategic fit, a weak signal?',
      },
      rationale: {
        pl: 'Cięcie oparte na dowodzie broni się przed zarządem; cięcie oparte na przeczuciu wraca za kwartał.',
        en: 'A cut grounded in evidence survives the board; a cut grounded in a hunch returns next quarter.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile uwolnicie zasobów, porzucając ten priorytet, i gdzie te zasoby dają wyższy zwrot?',
        en: 'How much resource do you free by dropping this priority, and where does that resource return more?',
      },
      rationale: {
        pl: 'Wartość cięcia to nie strata, którą unikacie, lecz zasób, który przesuwacie tam, gdzie value/effort jest wyższe.',
        en: 'The value of a cut is not the loss you avoid but the resource you shift to where value/effort is higher.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakie ryzyko bierzecie, tnąc to teraz, i jak je rozbroić (komunikacja, warunek odwrócenia)?',
        en: 'What risk do you take by cutting this now, and how do you defuse it (comms, a reversal condition)?',
      },
      rationale: {
        pl: 'Nawet słuszne cięcie ma ryzyko; nazwijcie je i warunek odwrócenia, żeby decyzja była odważna, nie lekkomyślna.',
        en: 'Even a right cut carries risk; name it and a reversal condition so the decision is bold, not reckless.',
      },
    },
  ],
};

export interface PriorityProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per lane. Consumed when AI (or the offline
 * fallback) proposes candidate focus moves. Mirrors Ansoff's PROPOSAL_BANK.
 */
export const FOCUS_PROPOSAL_BANK: Record<FocusLane, PriorityProposal[]> = {
  pursue: [
    {
      rung: 'surface',
      title: {
        pl: 'Postawić wszystko na jeden priorytet o najwyższym value/effort',
        en: 'Commit fully to the single highest value/effort priority',
      },
      explanation: {
        pl: 'Zamiast prowadzić pięć inicjatyw na 20% mocy, skoncentrujcie zdolność egzekucji na jednej, która wygrywa arytmetykę — reszta czeka świadomie.',
        en: 'Instead of running five initiatives at 20% each, concentrate execution capacity on the one that wins the arithmetic — the rest wait deliberately.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Uruchomić priorytet, który już ma twardy sygnał popytu',
        en: 'Launch the priority that already has a hard demand signal',
      },
      explanation: {
        pl: 'Jeśli jeden priorytet ma dowód (zapytania, dane, mandat), a inne tylko entuzjazm, dowód wygrywa trade-off — pursue idzie tam.',
        en: 'If one priority has evidence (inbound, data, mandate) while others have only enthusiasm, evidence wins the trade-off — pursue goes there.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wybrać najszybszy zwrot, żeby sfinansować resztę',
        en: 'Pick the fastest payback to fund the rest',
      },
      explanation: {
        pl: 'Priorytet o najkrótszym payback uwalnia zasób i wiarygodność na kolejne ruchy — to sekwencja, nie preferencja.',
        en: 'The priority with the shortest payback frees resource and credibility for the next moves — a sequence, not a preference.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Postawić na priorytet, który buduje zdolność wielokrotnego użytku',
        en: 'Back the priority that builds a reusable capability',
      },
      explanation: {
        pl: 'Najlepszy pursue nie tylko wygrywa raz — zostawia zdolność, która obniża koszt kolejnych priorytetów; to inwestycja, nie wydatek.',
        en: 'The best pursue does not only win once — it leaves a capability that lowers the cost of the next priorities; an investment, not a spend.',
      },
    },
  ],
  defer: [
    {
      rung: 'surface',
      title: {
        pl: 'Odłożyć priorytet zależny od jeszcze niegotowego warunku',
        en: 'Defer the priority that depends on a not-yet-ready trigger',
      },
      explanation: {
        pl: 'Jeśli priorytet wymaga wyniku innego ruchu lub zasobu, którego nie macie, odłożenie z jawnym warunkiem powrotu jest właściwym ruchem.',
        en: 'If a priority needs the result of another move or a resource you lack, deferring with an explicit re-entry trigger is the right move.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Odłożyć do czasu, aż sygnał popytu się potwierdzi',
        en: 'Defer until the demand signal is confirmed',
      },
      explanation: {
        pl: 'Priorytet z obiecującym, ale niepotwierdzonym sygnałem idzie na ławkę z warunkiem: „wraca, gdy pilotaż da dowód", nie znika.',
        en: 'A priority with a promising but unconfirmed signal goes on the bench with a trigger: "returns when the pilot proves it", it does not vanish.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Odłożyć, gdy koszt czekania jest niższy niż koszt rozproszenia',
        en: 'Defer when the cost of waiting is below the cost of spreading thin',
      },
      explanation: {
        pl: 'Policzcie utraconą wartość odłożenia; jeśli jest mniejsza niż koszt równoległej egzekucji, sekwencja wygrywa z równoległością.',
        en: 'Compute the value forgone by deferring; if it is smaller than the cost of parallel execution, sequence beats parallelism.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Odłożyć z jawnym warunkiem powrotu na kalendarzu',
        en: 'Defer with an explicit re-entry trigger on the calendar',
      },
      explanation: {
        pl: 'Uczciwe odłożenie ma datę lub warunek przeglądu; bez niego priorytet cicho umiera, a to najgorszy rodzaj decyzji.',
        en: 'An honest defer has a review date or condition; without one the priority quietly dies, and that is the worst kind of decision.',
      },
    },
  ],
  drop: [
    {
      rung: 'surface',
      title: {
        pl: 'Uciąć priorytet, który jest cudzą ambicją, nie waszą strategią',
        en: 'Cut the priority that is someone else’s ambition, not your strategy',
      },
      explanation: {
        pl: 'Jeśli priorytet trzyma się listy z powodów politycznych, a nie value/fit, jawne cięcie uwalnia zasób i porządkuje decyzję.',
        en: 'If a priority clings to the list for political reasons rather than value/fit, an explicit cut frees resource and cleans up the decision.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Uciąć priorytet o niskim value i słabym dopasowaniu',
        en: 'Cut the low-value, poor-fit priority',
      },
      explanation: {
        pl: 'Dane, nie sentyment: priorytet z najniższym value/effort i najsłabszym dopasowaniem strategicznym to pierwszy kandydat do cięcia.',
        en: 'Data, not sentiment: the priority with the lowest value/effort and the weakest strategic fit is the first candidate to cut.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Przesunąć uwolniony zasób tam, gdzie value/effort jest wyższe',
        en: 'Shift the freed resource to where value/effort is higher',
      },
      explanation: {
        pl: 'Cięcie ma sens tylko wtedy, gdy zasób ląduje na priorytecie o wyższym zwrocie — nazwijcie, dokąd przesuwacie moc.',
        en: 'A cut only pays off when the resource lands on a higher-return priority — name where you shift the capacity.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uciąć teraz, z jawnym warunkiem ewentualnego powrotu',
        en: 'Cut now, with an explicit condition for a possible return',
      },
      explanation: {
        pl: 'Odważne cięcie nazywa ryzyko i warunek odwrócenia; to nie zamyka drzwi na zawsze, ale dziś zwalnia zasób.',
        en: 'A bold cut names the risk and a reversal condition; it does not close the door forever, but it frees resource today.',
      },
    },
  ],
};
