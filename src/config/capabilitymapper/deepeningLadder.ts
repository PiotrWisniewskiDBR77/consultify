/**
 * Capability Mapper — deepening ladder (drabinka pogłębiająca) + proposal bank.
 *
 * Clones the Ansoff `deepeningLadder` pattern (see src/config/ansoff/deepeningLadder.ts):
 * a stable 4-rung "depth staircase" — surface → evidence → quantification →
 * risk-capability — layered per SOURCING ARCHETYPE (the decision a capability gap
 * forces: build / buy / partner / sustain). The Ansoff ladder branches by growth
 * quadrant; here it branches by the sourcing verdict the maturity gap implies.
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the Capability
 * Mapper input/scoring phases and by the synthesis engine (moveValidator.ts).
 */

/** The four sourcing archetypes a capability gap resolves into. */
export type SourcingArchetype = 'build' | 'buy' | 'partner' | 'sustain';

export const CAPABILITY_SOURCING_ARCHETYPES: SourcingArchetype[] = [
  'build',
  'buy',
  'partner',
  'sustain',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and archetype-agnostic. */
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

export const CAPABILITY_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-archetype deepening ladder. Each archetype has exactly 4 rungs in
 * RUNG_ORDER, so the synthesis engine can rely on a stable shape.
 */
export const CAPABILITY_DEEPENING_LADDER: Record<SourcingArchetype, LadderRung[]> = {
  build: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które zdolności są na tyle rdzenne dla przewagi, że musicie je mieć na własność, a nie kupić?',
        en: 'Which capabilities are core enough to your edge that you must own them rather than buy them?',
      },
      rationale: {
        pl: 'Budujesz tylko to, co różnicuje. Zdolność kupowalna na rynku nie zasługuje na kosztowną budowę wewnętrzną.',
        en: 'You build only what differentiates. A capability buyable on the market does not deserve a costly in-house build.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że macie zalążek tej zdolności (ludzie, IP, dane) i realnie da się ją dowieźć u siebie?',
        en: 'What proves you have a seed of this capability (people, IP, data) and can realistically deliver it in-house?',
      },
      rationale: {
        pl: 'Budowa od zera bez zalążka to najdroższa forma nauki. Dowód istniejącej bazy oddziela budowę od fantazji.',
        en: 'Building from zero with no seed is the most expensive way to learn. Evidence of an existing base separates build from fantasy.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile skoku dojrzałości (current→target) trzeba dowieźć i jaki jest koszt oraz czas budowy tej luki?',
        en: 'How much maturity jump (current→target) must you deliver, and what is the cost and time to build that gap?',
      },
      rationale: {
        pl: 'Luka dojrzałości ważona wagą zdolności to headroom budowy — bez policzenia kosztu budowa jest zakładem.',
        en: 'The importance-weighted maturity gap is the build headroom — without a costed gap, building is a bet.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy zdążycie zbudować tę zdolność w oknie czasu strategii, zanim luka zablokuje inne inicjatywy?',
        en: 'Can you build this capability inside the strategy time window before the gap blocks other initiatives?',
      },
      rationale: {
        pl: 'Ryzyko budowy to czas i utrzymanie talentu — zdolność zbudowana za późno traci wartość, której miała bronić.',
        en: 'Build risk is time and talent retention — a capability built too late loses the very value it was meant to defend.',
      },
    },
  ],
  buy: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które zdolności są krytyczne, ale nie różnicujące — takie, gdzie zakup gotowego kupuje wam czas?',
        en: 'Which capabilities are critical but non-differentiating — where buying off-the-shelf buys you time?',
      },
      rationale: {
        pl: 'Kupuj to, co krytyczne, ale gdzie i tak wszyscy będą tak samo dobrzy. Czas ważniejszy niż własność.',
        en: 'Buy what is critical but where everyone ends up equally good. Time matters more than ownership there.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że dojrzałe rozwiązanie/dostawca istnieje na rynku i da się je wchłonąć bez rozrywania procesów?',
        en: 'What proves a mature solution/vendor exists and can be absorbed without tearing your processes apart?',
      },
      rationale: {
        pl: 'Zakup bez dowodu integralności to dług integracyjny — kupiona zdolność, której nie umiecie wpiąć, jest martwa.',
        en: 'Buying without integration evidence is integration debt — a bought capability you cannot wire in is dead weight.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztuje zakup + integracja i o ile szybciej domykacie lukę niż budując ją od zera?',
        en: 'What is the cost of acquisition + integration, and how much faster do you close the gap than building it?',
      },
      rationale: {
        pl: 'Zakup ma sens tylko, gdy przewaga czasu przewyższa koszt licencji i wpięcia — policzcie deltę, nie zakładajcie.',
        en: 'Buying only pays when the time advantage beats the license-and-integration cost — compute the delta, do not assume it.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakie uzależnienie od dostawcy tworzycie i czy da się je odwrócić, gdy zdolność stanie się rdzenna?',
        en: 'What vendor lock-in are you creating, and can you reverse it if the capability later becomes core?',
      },
      rationale: {
        pl: 'Ryzyko zakupu to uzależnienie: kupiona dziś zdolność jutro może być waszą przewagą w cudzych rękach.',
        en: 'Buy risk is dependence: a capability bought today may tomorrow be your edge held in someone else’s hands.',
      },
    },
  ],
  partner: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które zdolności potrzebujecie mieć dostępne, ale nie na tyle często, by opłacało się je posiadać?',
        en: 'Which capabilities do you need access to, but not often enough to justify owning them?',
      },
      rationale: {
        pl: 'Partnerstwo pasuje do zdolności o dużej wartości i niskiej częstotliwości — dostęp bez kosztu utrzymania.',
        en: 'Partnering fits high-value, low-frequency capabilities — access without the cost of ownership.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że istnieje wiarygodny partner i że wasze interesy są zbieżne na tyle, by to przetrwało?',
        en: 'What proves a credible partner exists and your interests align enough for the arrangement to survive?',
      },
      rationale: {
        pl: 'Partnerstwo bez zbieżności interesów rozpada się pod presją — dowód dopasowania jest ważniejszy niż umowa.',
        en: 'A partnership without interest alignment collapses under pressure — fit evidence matters more than the contract.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest koszt partnerstwa (prowizja, marża oddana) vs. koszt posiadania i przy jakiej skali przechyla się na posiadanie?',
        en: 'What is the partnership cost (fee, margin given up) vs. ownership, and at what scale does it tip to owning?',
      },
      rationale: {
        pl: 'Partnerstwo tanie na starcie drożeje ze skalą — policzcie próg, przy którym warto zdolność ściągnąć do siebie.',
        en: 'A partnership cheap early gets expensive at scale — compute the threshold where pulling the capability in-house pays.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jaką wiedzę oddajecie partnerowi i czy nie budujecie w ten sposób przyszłego konkurenta?',
        en: 'What knowledge are you handing the partner, and are you building a future competitor in the process?',
      },
      rationale: {
        pl: 'Ryzyko partnerstwa to utrata uczenia się: oddana zdolność to oddana krzywa doświadczenia.',
        en: 'Partnership risk is lost learning: a capability handed off is an experience curve handed off with it.',
      },
    },
  ],
  sustain: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które zdolności są już na poziomie docelowym i wystarczy je utrzymać, a nie inwestować dalej?',
        en: 'Which capabilities already sit at target and only need sustaining rather than further investment?',
      },
      rationale: {
        pl: 'Nie każda zdolność potrzebuje skoku — nadmierne inwestowanie w to, co już wystarcza, to marnowanie kapitału.',
        en: 'Not every capability needs a jump — over-investing in what is already good enough wastes capital.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że ta zdolność faktycznie trzyma poziom, a nie po cichu eroduje przez odejścia lub dług techniczny?',
        en: 'What proves this capability actually holds its level rather than quietly eroding via attrition or tech debt?',
      },
      rationale: {
        pl: '„Utrzymać" to nie „zignorować" — dowód stabilności odróżnia świadome utrzymanie od zaniedbania.',
        en: 'Sustain is not ignore — stability evidence separates a deliberate hold from neglect.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki minimalny koszt utrzymania (ludzie, odświeżenie) trzyma tę zdolność na poziomie bez nadmiaru?',
        en: 'What minimal sustaining cost (people, refresh) keeps this capability at level without over-spend?',
      },
      rationale: {
        pl: 'Utrzymanie ma swój koszt bazowy — nazwijcie go, żeby uwolnić kapitał na zdolności z realną luką.',
        en: 'Sustaining has a baseline cost — name it so you free capital for capabilities with a real gap.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co spowoduje, że ta zdolność przestanie wystarczać — zmiana rynku, technologii, ambicji — i jak to wcześnie wykryjecie?',
        en: 'What would make this capability stop being enough — a market, tech, or ambition shift — and how do you detect it early?',
      },
      rationale: {
        pl: 'Ryzyko utrzymania to cichy rozjazd między „wystarczy" a wymaganiem — potrzebny jest sygnał wyprzedzający.',
        en: 'Sustain risk is the quiet drift between "good enough" and the requirement — you need a leading signal.',
      },
    },
  ],
};

export interface ArchetypeProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per sourcing archetype. Consumed when AI (or the
 * offline fallback) proposes candidate sourcing moves. Mirrors Ansoff's
 * PROPOSAL_BANK.
 */
export const CAPABILITY_PROPOSAL_BANK: Record<SourcingArchetype, ArchetypeProposal[]> = {
  build: [
    {
      rung: 'surface',
      title: {
        pl: 'Zbudować wewnętrznie zdolność, która różnicuje',
        en: 'Build in-house the capability that differentiates',
      },
      explanation: {
        pl: 'Jeśli zdolność jest źródłem przewagi, własność jest warta kosztu — oddanie jej na zewnątrz oddaje przewagę.',
        en: 'If the capability is the source of your edge, ownership is worth the cost — outsourcing it hands away the edge.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Rozwinąć zalążek, który już macie',
        en: 'Grow the seed you already have',
      },
      explanation: {
        pl: 'Budowa na istniejącej bazie ludzi/danych/IP jest najtańsza — dowód zalążka zamienia budowę w skok, nie start od zera.',
        en: 'Building on an existing people/data/IP base is cheapest — a seed turns the build into a jump, not a from-zero start.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zamknąć największą lukę ważoną wagą jako pierwszą',
        en: 'Close the largest importance-weighted gap first',
      },
      explanation: {
        pl: 'Headroom budowy to luka current→target × waga; najpierw zamykajcie tę, która najbardziej blokuje strategię.',
        en: 'Build headroom is the current→target gap × importance; close first the one that most blocks the strategy.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustawić kamień milowy budowy przed zależnymi inicjatywami',
        en: 'Set a build milestone ahead of dependent initiatives',
      },
      explanation: {
        pl: 'Zdolność zbudowana za późno blokuje wszystko, co od niej zależy — zakotwiczcie ją w harmonogramie jako prerequisite.',
        en: 'A capability built too late blocks everything that depends on it — anchor it in the plan as a prerequisite.',
      },
    },
  ],
  buy: [
    {
      rung: 'surface',
      title: {
        pl: 'Kupić dojrzałe rozwiązanie tam, gdzie liczy się czas, nie własność',
        en: 'Buy a mature solution where time, not ownership, matters',
      },
      explanation: {
        pl: 'Zdolność krytyczna, ale nie różnicująca — zakup kupuje czas, który budowa by przepaliła bez zysku przewagi.',
        en: 'A critical but non-differentiating capability — buying buys time that a build would burn with no edge gained.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wybrać dostawcę, który realnie wpina się w wasze procesy',
        en: 'Pick a vendor that genuinely wires into your processes',
      },
      explanation: {
        pl: 'Dowód integralności ważniejszy niż lista funkcji — kupiona zdolność bez wpięcia to koszt bez zdolności.',
        en: 'Integration evidence beats a feature list — a bought capability that will not wire in is cost without capability.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Uzasadnić zakup przewagą czasu, nie samą ceną',
        en: 'Justify the buy with a time advantage, not price alone',
      },
      explanation: {
        pl: 'Policzcie deltę: koszt zakupu+integracji vs. koszt+czas budowy — zakup wygrywa tylko, gdy delta czasu jest realna.',
        en: 'Compute the delta: buy+integration cost vs. build cost+time — buying wins only when the time delta is real.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zabezpieczyć wyjście z uzależnienia od dostawcy',
        en: 'Secure an exit from vendor lock-in',
      },
      explanation: {
        pl: 'Jeśli zdolność może stać się rdzenna, wynegocjujcie eksport danych i ścieżkę odejścia zanim podpiszecie.',
        en: 'If the capability may become core, negotiate data export and an exit path before you sign, not after.',
      },
    },
  ],
  partner: [
    {
      rung: 'surface',
      title: {
        pl: 'Partnerować przy zdolności o dużej wartości i niskiej częstotliwości',
        en: 'Partner for a high-value, low-frequency capability',
      },
      explanation: {
        pl: 'Dostęp bez posiadania ma sens, gdy zdolność jest cenna, ale potrzebna rzadko — posiadanie byłoby przerostem.',
        en: 'Access without ownership fits a valuable-but-rarely-needed capability — owning it would be overkill.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wybrać partnera o zbieżnych, nie tylko uprzejmych interesach',
        en: 'Pick a partner with aligned, not merely polite, interests',
      },
      explanation: {
        pl: 'Umowa nie utrzyma partnerstwa, którego interesy się rozjeżdżają — dowód zbieżności jest realnym zabezpieczeniem.',
        en: 'A contract will not hold a partnership whose interests diverge — alignment evidence is the real safeguard.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ustalić próg skali, przy którym warto zdolność ściągnąć do siebie',
        en: 'Set the scale threshold to pull the capability in-house',
      },
      explanation: {
        pl: 'Partnerstwo tanie dziś drożeje ze skalą — z góry policzcie wolumen, przy którym posiadanie zaczyna się opłacać.',
        en: 'A partnership cheap today gets pricey at scale — compute upfront the volume at which owning starts to pay.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Chronić wiedzę, której nie chcecie oddać konkurentowi',
        en: 'Protect knowledge you do not want handed to a rival',
      },
      explanation: {
        pl: 'Oddana zdolność to oddana krzywa uczenia — ograniczcie, czego partner się o was uczy, jeśli może stać się rywalem.',
        en: 'A handed-off capability is a handed-off learning curve — limit what the partner learns about you if it could become a rival.',
      },
    },
  ],
  sustain: [
    {
      rung: 'surface',
      title: {
        pl: 'Utrzymać, nie dodwestować, zdolność już na poziomie docelowym',
        en: 'Sustain, not over-invest, a capability already at target',
      },
      explanation: {
        pl: 'Zdolność, która wystarcza, nie potrzebuje skoku — uwolniony kapitał idzie tam, gdzie luka jest realna.',
        en: 'A capability that is good enough needs no jump — the freed capital goes where the gap is real.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Monitorować cichą erozję zamiast zakładać stabilność',
        en: 'Monitor quiet erosion instead of assuming stability',
      },
      explanation: {
        pl: 'Zdolność „na poziomie" może eroduje przez odejścia i dług techniczny — potrzebny jest dowód, że trzyma poziom.',
        en: 'An "at-level" capability can erode via attrition and tech debt — you need evidence it actually holds level.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Nazwać minimalny koszt utrzymania i uwolnić resztę',
        en: 'Name the minimal sustaining cost and free the rest',
      },
      explanation: {
        pl: 'Utrzymanie ma koszt bazowy; policzcie go, żeby reszta budżetu poszła na zdolności z twardą luką.',
        en: 'Sustaining has a baseline cost; compute it so the rest of the budget goes to capabilities with a hard gap.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustawić sygnał wyprzedzający, gdy „wystarczy" przestanie wystarczać',
        en: 'Set a leading signal for when "enough" stops being enough',
      },
      explanation: {
        pl: 'Wymagania rosną po cichu — zdefiniujcie próg (rynek, technologia, ambicja), który przełącza zdolność z utrzymania na budowę.',
        en: 'Requirements creep quietly — define the trigger (market, tech, ambition) that flips the capability from sustain to build.',
      },
    },
  ],
};
