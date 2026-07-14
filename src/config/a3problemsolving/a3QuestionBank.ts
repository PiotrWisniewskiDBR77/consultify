/**
 * A3 Problem Solving — laddered question bank (OXFORD O3).
 *
 * Cloned 1:1 in architecture from src/config/swot/dynamicSwotQuestionBank.ts and
 * src/config/porter/porterQuestionBank.ts. Where SWOT ladders four quadrants and
 * Porter ladders five forces, A3 ladders the SEVEN canonical steps of a Toyota/Lean
 * A3 report so the conversation DIGS a real problem-solving story instead of
 * collecting seven text boxes:
 *
 *   1. background      — why THIS problem now, and to whom does it belong?
 *   2. current-state   — what is observably happening, with evidence and a baseline?
 *   3. target          — what measurable gap must close, by when, owned by whom?
 *   4. root-cause      — symptom vs root, evidenced 5-Why, share of the gap, dimension
 *   5. countermeasures — does it address the root, name its trade-off, get piloted first?
 *   6. plan            — owned, dated, sequenced by dependency (contain→fix→standardize)
 *   7. follow-up       — how the closure is measured and how regression is prevented
 *
 * Each step carries a short ladder of partner-grade questions. The answer to a
 * question determines the next question (branching), so the A3 develops down the
 * "insight staircase" (surface → evidence → quantification → risk/capability)
 * instead of stopping at the first plausible answer.
 *
 * Every function here is pure — the runtime and the AI prompts both consume this
 * bank, so a question asked by the mentor in chat and a question rendered in the
 * wizard are the same question (single source of truth). This is the DISCIPLINE
 * layer; the deterministic causal chain lives in a3CausalEngine.ts and the
 * fact→interpretation→implication check in a3InsightStaircase.ts.
 */

/** The seven canonical steps of an A3 report, in report order. */
export type A3StepId =
  | 'background'
  | 'current-state'
  | 'target'
  | 'root-cause'
  | 'countermeasures'
  | 'plan'
  | 'follow-up';

export const A3_STEP_IDS: A3StepId[] = [
  'background',
  'current-state',
  'target',
  'root-cause',
  'countermeasures',
  'plan',
  'follow-up',
];

export const A3_STEP_LABELS: Record<A3StepId, { pl: string; en: string }> = {
  background: { pl: 'Tło', en: 'Background' },
  'current-state': { pl: 'Stan obecny', en: 'Current state' },
  target: { pl: 'Cel', en: 'Target' },
  'root-cause': { pl: 'Analiza przyczyn źródłowych', en: 'Root-cause analysis' },
  countermeasures: { pl: 'Przeciwśrodki', en: 'Countermeasures' },
  plan: { pl: 'Plan wdrożenia', en: 'Implementation plan' },
  'follow-up': { pl: 'Follow-up', en: 'Follow-up' },
};

/** 1 surface · 2 evidence · 3 quantification · 4 risk/capability — the A3 staircase depth. */
export type A3QuestionLevel = 1 | 2 | 3 | 4;

export type A3EvidenceStatus = 'confirmed' | 'declared' | 'missing';

export interface A3AnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextA3Question. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (used to steer the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
}

export interface A3QuestionNode {
  id: string;
  step: A3StepId;
  level: A3QuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally to the user as tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: A3AnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for this path.
   * Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// 1. BACKGROUND — why this problem now, and who owns it
// ---------------------------------------------------------------------------

const BACKGROUND_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'bg1-link',
    step: 'background',
    level: 1,
    intentEn: 'An A3 without a business reason burns effort on an irritation nobody will fund.',
    intentPl: 'A3 bez powodu biznesowego przepala wysiłek na irytację, której nikt nie sfinansuje.',
    textEn:
      'Is this problem tied to a business objective people care about (cost, quality, delivery, safety), or is it an isolated annoyance someone noticed?',
    textPl:
      'Czy ten problem jest powiązany z celem biznesowym, na którym komuś zależy (koszt, jakość, dostawa, bezpieczeństwo), czy to odosobniona uciążliwość, którą ktoś zauważył?',
    probeEn: 'Finish the sentence: "If we do not solve this, the business loses ___."',
    probePl: 'Dokończ zdanie: „Jeśli tego nie rozwiążemy, biznes traci ___".',
    answerOptions: [
      {
        key: 'goal-linked',
        labelEn: 'It maps to a named business objective',
        labelPl: 'Mapuje się na nazwany cel biznesowy',
        consultantSignalEn: 'Legitimate A3 candidate — find the owner who will act on it.',
        consultantSignalPl: 'Prawidłowy kandydat na A3 — znajdź właściciela, który go pociągnie.',
      },
      {
        key: 'isolated',
        labelEn: 'It is an isolated irritation for now',
        labelPl: 'Na razie to odosobniona uciążliwość',
        consultantSignalEn:
          'Weak mandate — either connect it to a goal or accept it will be deprioritized.',
        consultantSignalPl:
          'Słaby mandat — albo połącz to z celem, albo przyjmij, że spadnie w priorytetach.',
      },
    ],
    branches: { 'goal-linked': 'bg2-sponsor', isolated: 'bg2-sponsor' },
    defaultNextId: 'bg2-sponsor',
  },
  {
    id: 'bg2-sponsor',
    step: 'background',
    level: 2,
    intentEn: 'An orphaned A3 dies at the first competing priority — it needs a named owner.',
    intentPl:
      'Osierocone A3 umiera przy pierwszym konkurencyjnym priorytecie — potrzebuje właściciela.',
    textEn:
      'Who owns this pain and has the authority to act on the countermeasures — a named sponsor, or is the A3 currently orphaned?',
    textPl:
      'Kto jest właścicielem tego bólu i ma władzę wdrożyć przeciwśrodki — nazwany sponsor, czy A3 jest teraz osierocone?',
    answerOptions: [
      {
        key: 'named-sponsor',
        labelEn: 'A named sponsor owns it',
        labelPl: 'Ma nazwanego sponsora',
        consultantSignalEn: 'Mandate secured — the current state can be measured with backing.',
        consultantSignalPl: 'Mandat zabezpieczony — stan obecny da się zmierzyć z poparciem.',
      },
      {
        key: 'orphaned',
        labelEn: 'No clear owner yet',
        labelPl: 'Brak jasnego właściciela',
        consultantSignalEn:
          'First action must be to assign an owner — analysis without a decider is a report, not an A3.',
        consultantSignalPl:
          'Pierwszą akcją musi być wskazanie właściciela — analiza bez decydenta to raport, nie A3.',
      },
    ],
    branches: { 'named-sponsor': null, orphaned: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// 2. CURRENT STATE — observable fact, evidence, baseline
// ---------------------------------------------------------------------------

const CURRENT_STATE_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'cs1-observable',
    step: 'current-state',
    level: 1,
    intentEn:
      'An A3 collapses when the "problem" is an opinion — name a state you can show at the gemba.',
    intentPl: 'A3 rozpada się, gdy „problem" to opinia — nazwij stan, który pokażesz na gemba.',
    textEn:
      'Can you describe the current state as an observable fact — where, when, how often it happens — or only as a feeling that "things are bad"?',
    textPl:
      'Czy umiecie opisać stan obecny jako obserwowalny fakt — gdzie, kiedy, jak często się dzieje — czy tylko jako odczucie, że „jest źle"?',
    probeEn: 'Describe one concrete instance from the last week, in observable terms.',
    probePl: 'Opisz jedną konkretną sytuację z ostatniego tygodnia, w kategoriach obserwowalnych.',
    answerOptions: [
      {
        key: 'observable',
        labelEn: 'We can state it as an observable fact',
        labelPl: 'Umiemy nazwać to jako obserwowalny fakt',
        consultantSignalEn: 'Real state — now force the hard evidence behind it.',
        consultantSignalPl: 'Realny stan — teraz wymuś twardy dowód, który za nim stoi.',
      },
      {
        key: 'anecdotal',
        labelEn: 'It is mostly an impression right now',
        labelPl: 'Na razie to głównie wrażenie',
        consultantSignalEn:
          'Anecdote — the next step is a gemba observation before any cause work.',
        consultantSignalPl:
          'Anegdota — następny krok to obserwacja na gemba, zanim ruszycie przyczyny.',
      },
    ],
    branches: { observable: 'cs2-evidence', anecdotal: 'cs2-evidence' },
    defaultNextId: 'cs2-evidence',
  },
  {
    id: 'cs2-evidence',
    step: 'current-state',
    level: 2,
    intentEn: 'Evidence separates a real defect from a dismissible anecdote.',
    intentPl: 'Dowód oddziela realny defekt od anegdoty, którą łatwo zbagatelizować.',
    textEn:
      'What hard evidence backs this — data, a measurement, a direct gemba observation — or is it a team impression gathered in a meeting?',
    textPl:
      'Jaki twardy dowód to potwierdza — dane, pomiar, bezpośrednia obserwacja z gemba — czy to wrażenie zespołu zebrane na spotkaniu?',
    probeEn: 'If there is no measurement, naming where the data lives is the first task.',
    probePl: 'Jeśli nie ma pomiaru, wskazanie gdzie mieszkają dane jest pierwszym zadaniem.',
    answerOptions: [
      {
        key: 'measured',
        labelEn: 'Backed by data or a direct observation',
        labelPl: 'Poparte danymi lub bezpośrednią obserwacją',
        consultantSignalEn: 'Evidenced — now pin the baseline number.',
        consultantSignalPl: 'Udowodnione — teraz przygwoźdź liczbę bazową.',
      },
      {
        key: 'impression',
        labelEn: 'A team impression, not yet measured',
        labelPl: 'Wrażenie zespołu, jeszcze niezmierzone',
        consultantSignalEn:
          'Declared, unconfirmed — building the measurement is the first defect to remove.',
        consultantSignalPl:
          'Deklaracja, niepotwierdzone — zbudowanie pomiaru to pierwszy defekt do usunięcia.',
      },
    ],
    branches: { measured: 'cs3-baseline', impression: 'cs3-baseline' },
    defaultNextId: 'cs3-baseline',
  },
  {
    id: 'cs3-baseline',
    step: 'current-state',
    level: 3,
    intentEn: 'Without a baseline there is no gap, no target and no honest success criterion.',
    intentPl: 'Bez linii bazowej nie ma luki, celu ani uczciwego kryterium sukcesu.',
    textEn:
      'Do you have a baseline number for how often and how badly this happens (frequency × cost × time), or only a direction ("too slow")?',
    textPl:
      'Czy macie liczbę bazową, jak często i jak dotkliwie to się dzieje (częstotliwość × koszt × czas), czy tylko kierunek („za wolno")?',
    answerOptions: [
      {
        key: 'baselined',
        labelEn: 'We have a baseline number',
        labelPl: 'Mamy liczbę bazową',
        consultantSignalEn: 'Baseline set — the target can be a measurable gap from it.',
        consultantSignalPl: 'Baza ustawiona — cel może być mierzalną luką od niej.',
      },
      {
        key: 'no-baseline',
        labelEn: 'Only a direction, no number yet',
        labelPl: 'Tylko kierunek, jeszcze bez liczby',
        consultantSignalEn: 'Mark "to be established (where/when)" — never invent the baseline.',
        consultantSignalPl:
          'Oznacz „do ustalenia (gdzie/kiedy)" — nigdy nie wymyślaj linii bazowej.',
      },
    ],
    branches: { baselined: null, 'no-baseline': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// 3. TARGET — measurable gap, deadline, owner
// ---------------------------------------------------------------------------

const TARGET_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'tg1-gap',
    step: 'target',
    level: 1,
    intentEn: 'A target that is not a measurable gap cannot be verified as met or missed.',
    intentPl:
      'Cel, który nie jest mierzalną luką, nie da się zweryfikować jako osiągnięty lub nie.',
    textEn:
      'Is the target a measurable gap from the current state ("from X to Y by Z"), or a vague "improve / reduce / be faster"?',
    textPl:
      'Czy cel to mierzalna luka od stanu obecnego („z X na Y do Z"), czy niejasne „poprawić / zmniejszyć / przyspieszyć"?',
    probeEn: 'A target you cannot fail is not a target — it is a slogan.',
    probePl: 'Cel, którego nie da się nie osiągnąć, nie jest celem — to slogan.',
    answerOptions: [
      {
        key: 'measurable-gap',
        labelEn: 'A measurable gap with from/to values',
        labelPl: 'Mierzalna luka z wartościami z/na',
        consultantSignalEn: 'Falsifiable target — now attach a date and an owner.',
        consultantSignalPl: 'Falsyfikowalny cel — teraz doczep datę i właściciela.',
      },
      {
        key: 'vague',
        labelEn: 'Directional only ("improve")',
        labelPl: 'Tylko kierunkowy („poprawić")',
        consultantSignalEn: 'Not yet a target — quantify against the baseline before proceeding.',
        consultantSignalPl:
          'To jeszcze nie cel — skwantyfikuj względem bazy, zanim ruszycie dalej.',
      },
    ],
    branches: { 'measurable-gap': 'tg2-deadline', vague: 'tg2-deadline' },
    defaultNextId: 'tg2-deadline',
  },
  {
    id: 'tg2-deadline',
    step: 'target',
    level: 2,
    intentEn:
      'A target with no date and no owner competes with everything and gets done by no one.',
    intentPl: 'Cel bez daty i właściciela konkuruje ze wszystkim i nie robi go nikt.',
    textEn:
      'Is there a date by which the target must be hit and a single person accountable for hitting it?',
    textPl:
      'Czy jest data, do której cel musi być osiągnięty, i jedna osoba odpowiedzialna za jego osiągnięcie?',
    answerOptions: [
      {
        key: 'dated',
        labelEn: 'Yes — a date and an accountable owner',
        labelPl: 'Tak — data i odpowiedzialny właściciel',
        consultantSignalEn: 'Commitment is real — root-cause work is worth the effort.',
        consultantSignalPl: 'Zobowiązanie realne — praca nad przyczyną warta wysiłku.',
      },
      {
        key: 'open-ended',
        labelEn: 'Open-ended, no owner',
        labelPl: 'Bezterminowy, bez właściciela',
        consultantSignalEn: 'Aspiration, not a commitment — set a date before spending on causes.',
        consultantSignalPl:
          'Aspiracja, nie zobowiązanie — ustaw datę przed wydawaniem na przyczyny.',
      },
    ],
    branches: { dated: null, 'open-ended': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// 4. ROOT CAUSE — symptom vs root, evidenced 5-Why, share of gap, dimension
// ---------------------------------------------------------------------------

const ROOT_CAUSE_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'rc1-symptom',
    step: 'root-cause',
    level: 1,
    intentEn: 'The first "why" almost always names a symptom — an A3 demands going deeper.',
    intentPl: 'Pierwsze „dlaczego" prawie zawsze wskazuje objaw — A3 wymaga zejścia głębiej.',
    textEn:
      'Is your current answer a symptom (the thing you see) or have you dug to a cause you can actually act on? Why is the first cause NOT yet the root?',
    textPl:
      'Czy wasza obecna odpowiedź to objaw (to, co widać), czy zeszliście do przyczyny, na którą da się realnie zadziałać? Dlaczego pierwsza przyczyna to jeszcze NIE korzeń?',
    probeEn: 'Ask "why does that happen?" once more out loud — where does the chain actually stop?',
    probePl:
      'Zapytaj na głos jeszcze raz „dlaczego to się dzieje?" — gdzie łańcuch naprawdę się kończy?',
    answerOptions: [
      {
        key: 'symptom',
        labelEn: 'Still a symptom — we have not dug down',
        labelPl: 'Wciąż objaw — nie kopaliśmy głębiej',
        consultantSignalEn: 'Stop — run the 5-Why with evidence before proposing any fix.',
        consultantSignalPl:
          'Stop — przeprowadź 5×Why z dowodem, zanim zaproponujesz jakikolwiek środek.',
      },
      {
        key: 'deeper',
        labelEn: 'We reached a cause we can act on',
        labelPl: 'Doszliśmy do przyczyny, na którą da się działać',
        consultantSignalEn:
          'Actionable cause — now test whether the chain is evidenced, not guessed.',
        consultantSignalPl:
          'Przyczyna działalna — teraz sprawdź, czy łańcuch jest udowodniony, nie zgadnięty.',
      },
    ],
    branches: { symptom: 'rc2-chain', deeper: 'rc2-chain' },
    defaultNextId: 'rc2-chain',
  },
  {
    id: 'rc2-chain',
    step: 'root-cause',
    level: 2,
    intentEn:
      'A cause chain is only as strong as its weakest link — a link without evidence is a hypothesis.',
    intentPl:
      'Łańcuch przyczyn jest tak mocny jak najsłabsze ogniwo — ogniwo bez dowodu to hipoteza.',
    textEn:
      'Is every step of your 5-Why backed by evidence, or do you jump to a guess at some link? Which link is the weakest?',
    textPl:
      'Czy każdy krok 5×Why jest poparty dowodem, czy w którymś ogniwie przeskakujecie na domysł? Które ogniwo jest najsłabsze?',
    answerOptions: [
      {
        key: 'evidenced-chain',
        labelEn: 'Every link has evidence',
        labelPl: 'Każde ogniwo ma dowód',
        consultantSignalEn: 'Solid chain — quantify the share of the gap it explains.',
        consultantSignalPl: 'Solidny łańcuch — skwantyfikuj udział luki, jaki tłumaczy.',
      },
      {
        key: 'guess-jump',
        labelEn: 'One link is a guess',
        labelPl: 'Jedno ogniwo to domysł',
        consultantSignalEn:
          'Flag that link as a hypothesis to confirm in the data — do not build a fix on it yet.',
        consultantSignalPl:
          'Oznacz to ogniwo jako hipotezę do potwierdzenia w danych — nie buduj na nim jeszcze środka.',
      },
    ],
    branches: { 'evidenced-chain': 'rc3-share', 'guess-jump': 'rc3-share' },
    defaultNextId: 'rc3-share',
  },
  {
    id: 'rc3-share',
    step: 'root-cause',
    level: 3,
    intentEn:
      'A cause explaining 5% of the gap is not the root — quantification guards against cosmetic fixes.',
    intentPl: 'Przyczyna tłumacząca 5% luki to nie korzeń — kwantyfikacja chroni przed kosmetyką.',
    textEn:
      'What share of the problem gap does this cause explain — would removing it actually close the gap, or only shave a corner?',
    textPl:
      'Jaką część luki problemu tłumaczy ta przyczyna — czy jej usunięcie realnie zamknie lukę, czy tylko zetnie róg?',
    probeEn: 'Split the gap across causes (a quick Pareto): which single cause dominates?',
    probePl: 'Rozbij lukę na przyczyny (szybkie Pareto): która pojedyncza przyczyna dominuje?',
    answerOptions: [
      {
        key: 'dominant-cause',
        labelEn: 'It explains the majority of the gap',
        labelPl: 'Tłumaczy większość luki',
        consultantSignalEn:
          'Dominant root — classify its dimension to pick the countermeasure type.',
        consultantSignalPl:
          'Dominujący korzeń — sklasyfikuj jego wymiar, by dobrać typ przeciwśrodka.',
      },
      {
        key: 'minor-cause',
        labelEn: 'It explains only a small share',
        labelPl: 'Tłumaczy tylko mały udział',
        consultantSignalEn:
          'Not the root — keep digging or you will fund a cosmetic countermeasure.',
        consultantSignalPl:
          'To nie korzeń — kop dalej, albo sfinansujesz kosmetyczny przeciwśrodek.',
      },
    ],
    branches: { 'dominant-cause': 'rc4-dimension', 'minor-cause': 'rc4-dimension' },
    defaultNextId: 'rc4-dimension',
  },
  {
    id: 'rc4-dimension',
    step: 'root-cause',
    level: 4,
    intentEn:
      'Misclassifying the root aims the fix at the wrong place — training where the problem is the process.',
    intentPl:
      'Mylna klasyfikacja korzenia kieruje środek w złe miejsce — szkolenie tam, gdzie problem to proces.',
    textEn:
      'Does the root live in the process (how work flows), tooling (what people work with), skill (who does the work), or incentive (why people behave this way)? Each demands a different countermeasure.',
    textPl:
      'Czy korzeń tkwi w procesie (jak płynie praca), narzędziu (czym ludzie pracują), umiejętności (kto wykonuje pracę), czy w zachęcie (dlaczego ludzie tak się zachowują)? Każdy wymaga innego przeciwśrodka.',
    probeEn: 'If you answer "several", pick the dominant one and say why it is dominant.',
    probePl: 'Jeśli odpowiadasz „kilka", wybierz dominujący i powiedz, dlaczego jest dominujący.',
    answerOptions: [
      {
        key: 'process',
        labelEn: 'Process — how work flows',
        labelPl: 'Proces — jak płynie praca',
        consultantSignalEn:
          'Root = process → countermeasure = redesign + standard, not a pep talk.',
        consultantSignalPl:
          'Korzeń = proces → środek = przeprojektowanie + standard, nie pogadanka.',
      },
      {
        key: 'tools',
        labelEn: 'Tooling — what people work with',
        labelPl: 'Narzędzie — czym ludzie pracują',
        consultantSignalEn:
          'Root = tooling → countermeasure = poka-yoke / investment with a payback case.',
        consultantSignalPl:
          'Korzeń = narzędzie → środek = poka-yoke / inwestycja z rachunkiem zwrotu.',
      },
      {
        key: 'skills',
        labelEn: 'Skill — who does the work',
        labelPl: 'Umiejętność — kto wykonuje pracę',
        consultantSignalEn: 'Root = skill → countermeasure = training / hiring with a named gap.',
        consultantSignalPl:
          'Korzeń = umiejętność → środek = szkolenie / rekrutacja z nazwaną luką.',
      },
      {
        key: 'incentives',
        labelEn: 'Incentive — why people behave this way',
        labelPl: 'Zachęta — dlaczego ludzie tak się zachowują',
        consultantSignalEn:
          'Root = incentive → countermeasure = change the measure; the hardest, slowest lever.',
        consultantSignalPl:
          'Korzeń = zachęta → środek = zmień miarę; dźwignia najtrudniejsza i najwolniejsza.',
      },
    ],
    branches: { process: null, tools: null, skills: null, incentives: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// 5. COUNTERMEASURES — addresses the root, names the trade-off, piloted first
// ---------------------------------------------------------------------------

const COUNTERMEASURE_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'cm1-address',
    step: 'countermeasures',
    level: 1,
    intentEn:
      'A countermeasure with no named root is a wish — it needs an explicit address in the cause ladder.',
    intentPl:
      'Przeciwśrodek bez wskazanego korzenia to życzenie — potrzebuje jawnego adresu w drabinie przyczyn.',
    textEn:
      'Does each countermeasure name the specific root cause it removes, or is it a generic "improvement" not tied to a cause?',
    textPl:
      'Czy każdy przeciwśrodek wskazuje konkretną przyczynę źródłową, którą usuwa, czy to ogólne „usprawnienie" niepowiązane z przyczyną?',
    answerOptions: [
      {
        key: 'root-addressed',
        labelEn: 'It targets a named root cause',
        labelPl: 'Celuje w nazwaną przyczynę źródłową',
        consultantSignalEn: 'On target — now force the trade-off it carries.',
        consultantSignalPl: 'Trafione — teraz wymuś trade-off, który niesie.',
      },
      {
        key: 'generic',
        labelEn: 'Generic improvement, no named cause',
        labelPl: 'Ogólne usprawnienie, bez nazwanej przyczyny',
        consultantSignalEn:
          'Reject until it names the root it removes — otherwise it masks the symptom.',
        consultantSignalPl:
          'Odrzuć, dopóki nie nazwie korzenia, który usuwa — inaczej maskuje objaw.',
      },
    ],
    branches: { 'root-addressed': 'cm2-tradeoff', generic: 'cm2-tradeoff' },
    defaultNextId: 'cm2-tradeoff',
  },
  {
    id: 'cm2-tradeoff',
    step: 'countermeasures',
    level: 2,
    intentEn: 'A recommendation without a trade-off is a list, not a decision (W2).',
    intentPl: 'Rekomendacja bez trade-offu to lista, nie decyzja (W2).',
    textEn:
      'Have you named what this countermeasure costs you and which alternative you deliberately are NOT taking, and why?',
    textPl:
      'Czy nazwaliście, co ten przeciwśrodek kosztuje i którego wariantu świadomie NIE bierzecie, i dlaczego?',
    probeEn: 'Complete: "We choose X at the cost of Y; we reject Z because ___."',
    probePl: 'Dokończ: „Wybieramy X kosztem Y; odrzucamy Z, bo ___".',
    answerOptions: [
      {
        key: 'tradeoff-named',
        labelEn: 'Trade-off and rejected variant are explicit',
        labelPl: 'Trade-off i wariant odrzucony są jawne',
        consultantSignalEn: 'W2-complete — decide whether to pilot before scaling.',
        consultantSignalPl: 'W2 kompletne — zdecyduj, czy pilotować przed skalowaniem.',
      },
      {
        key: 'no-tradeoff',
        labelEn: 'No trade-off stated yet',
        labelPl: 'Trade-off jeszcze nie nazwany',
        consultantSignalEn:
          'Not a decision yet — name the cost and the rejected variant (W2 gate).',
        consultantSignalPl:
          'To jeszcze nie decyzja — nazwij koszt i wariant odrzucony (bramka W2).',
      },
    ],
    branches: { 'tradeoff-named': 'cm3-pilot', 'no-tradeoff': 'cm3-pilot' },
    defaultNextId: 'cm3-pilot',
  },
  {
    id: 'cm3-pilot',
    step: 'countermeasures',
    level: 3,
    intentEn:
      'A countermeasure without proof of effect is a bet — a small pilot de-risks the burn.',
    intentPl:
      'Przeciwśrodek bez dowodu skuteczności to zakład — mały pilotaż odbiera ryzyko przepalenia.',
    textEn:
      'Will you validate the countermeasure with a small pilot (one station/line/team) before scaling, or commit straight to a full rollout?',
    textPl:
      'Czy zwalidujecie przeciwśrodek małym pilotażem (jedno stanowisko/linia/zespół) przed skalowaniem, czy wchodzicie od razu w pełne wdrożenie?',
    answerOptions: [
      {
        key: 'pilot-first',
        labelEn: 'Pilot first, then scale',
        labelPl: 'Najpierw pilotaż, potem skala',
        consultantSignalEn: 'Right sequence — the pilot IS the first step of the plan.',
        consultantSignalPl: 'Właściwa kolejność — pilotaż JEST pierwszym krokiem planu.',
      },
      {
        key: 'full-commit',
        labelEn: 'Full rollout immediately',
        labelPl: 'Pełne wdrożenie od razu',
        consultantSignalEn:
          'High-risk — a full rollout you may have to reverse is the expensive way to learn.',
        consultantSignalPl:
          'Wysokie ryzyko — pełne wdrożenie, które trzeba by cofać, to drogi sposób nauki.',
      },
    ],
    branches: { 'pilot-first': null, 'full-commit': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// 6. PLAN — owned, dated, sequenced by dependency
// ---------------------------------------------------------------------------

const PLAN_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'pl1-owner',
    step: 'plan',
    level: 1,
    intentEn: '"The team will" is nobody — every action needs a named owner and a date.',
    intentPl: '„Zespół zrobi" to nikt — każda akcja potrzebuje nazwanego właściciela i daty.',
    textEn:
      'Does each action in the plan have a single named owner and a due date, or is it phrased as "the team will handle it"?',
    textPl:
      'Czy każda akcja w planie ma jednego nazwanego właściciela i termin, czy jest ujęta jako „zespół się tym zajmie"?',
    answerOptions: [
      {
        key: 'owned-dated',
        labelEn: 'Every action is owned and dated',
        labelPl: 'Każda akcja ma właściciela i termin',
        consultantSignalEn: 'Accountable plan — check the sequence logic next.',
        consultantSignalPl: 'Rozliczalny plan — sprawdź teraz logikę kolejności.',
      },
      {
        key: 'unowned',
        labelEn: 'Some actions have no owner',
        labelPl: 'Część akcji nie ma właściciela',
        consultantSignalEn: 'Assign owners before sequencing — an unowned action will not happen.',
        consultantSignalPl:
          'Przypisz właścicieli przed ustaleniem kolejności — akcja bez właściciela się nie wydarzy.',
      },
    ],
    branches: { 'owned-dated': 'pl2-sequence', unowned: 'pl2-sequence' },
    defaultNextId: 'pl2-sequence',
  },
  {
    id: 'pl2-sequence',
    step: 'plan',
    level: 2,
    intentEn: 'Contain → fix root → standardize: sequence by dependency, not by convenience.',
    intentPl: 'Powstrzymaj → usuń korzeń → ustandaryzuj: kolejność wg zależności, nie wygody.',
    textEn:
      'Is the plan sequenced by dependency (contain the bleeding, then eliminate the root, then standardize), or ordered by whatever is easiest to start?',
    textPl:
      'Czy plan jest uszeregowany wg zależności (powstrzymaj skutek, potem usuń korzeń, potem ustandaryzuj), czy wg tego, co najłatwiej zacząć?',
    answerOptions: [
      {
        key: 'dependency-ordered',
        labelEn: 'Ordered by dependency',
        labelPl: 'Uszeregowany wg zależności',
        consultantSignalEn: 'Sound sequence — define how closure will be measured.',
        consultantSignalPl: 'Zdrowa kolejność — zdefiniuj, jak zmierzycie domknięcie.',
      },
      {
        key: 'ad-hoc',
        labelEn: 'Ordered by convenience',
        labelPl: 'Uszeregowany wg wygody',
        consultantSignalEn:
          'Re-sequence — deploying the permanent fix before containment leaves the customer exposed.',
        consultantSignalPl:
          'Przeszereguj — wdrożenie trwałego środka przed powstrzymaniem zostawia klienta odsłoniętego.',
      },
    ],
    branches: { 'dependency-ordered': null, 'ad-hoc': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// 7. FOLLOW-UP — measured closure, prevented regression
// ---------------------------------------------------------------------------

const FOLLOW_UP_QUESTIONS: A3QuestionNode[] = [
  {
    id: 'fu1-measure',
    step: 'follow-up',
    level: 1,
    intentEn:
      'An A3 that does not measure its own closure cannot tell success from wishful thinking.',
    intentPl: 'A3, które nie mierzy własnego domknięcia, nie odróżni sukcesu od pobożnych życzeń.',
    textEn:
      'Have you defined how you will measure whether the countermeasure actually closed the gap — the same metric as the baseline, checked on a date?',
    textPl:
      'Czy zdefiniowaliście, jak zmierzycie, czy przeciwśrodek realnie zamknął lukę — ta sama metryka co baza, sprawdzona w konkretnej dacie?',
    answerOptions: [
      {
        key: 'measure-defined',
        labelEn: 'Yes — same metric, a check date',
        labelPl: 'Tak — ta sama metryka, data sprawdzenia',
        consultantSignalEn: 'Verifiable closure — now protect it from regressing.',
        consultantSignalPl: 'Weryfikowalne domknięcie — teraz zabezpiecz je przed cofnięciem.',
      },
      {
        key: 'no-measure',
        labelEn: 'No closure measure yet',
        labelPl: 'Brak miary domknięcia',
        consultantSignalEn:
          'Define the check against the baseline metric — otherwise the A3 never truly closes.',
        consultantSignalPl:
          'Zdefiniuj sprawdzenie wobec metryki bazowej — inaczej A3 nigdy się naprawdę nie zamknie.',
      },
    ],
    branches: { 'measure-defined': 'fu2-sustain', 'no-measure': 'fu2-sustain' },
    defaultNextId: 'fu2-sustain',
  },
  {
    id: 'fu2-sustain',
    step: 'follow-up',
    level: 2,
    intentEn:
      'Without a standard and an owner the change dissolves at the first staffing change — the most common A3 failure.',
    intentPl:
      'Bez standardu i właściciela zmiana rozmywa się przy pierwszej zmianie obsady — najczęstsza porażka A3.',
    textEn:
      'Is there a standard (documented, trained) plus a named owner that prevents the fix from regressing to baseline?',
    textPl:
      'Czy jest standard (udokumentowany, przeszkolony) plus nazwany właściciel, który zapobiega cofnięciu środka do stanu wyjściowego?',
    answerOptions: [
      {
        key: 'standardized',
        labelEn: 'Standard + owner in place',
        labelPl: 'Standard + właściciel na miejscu',
        consultantSignalEn: 'Sustained — the computed gain is protected; the A3 can close.',
        consultantSignalPl: 'Utrzymane — policzony zysk jest chroniony; A3 może się zamknąć.',
      },
      {
        key: 'no-standard',
        labelEn: 'No standard yet',
        labelPl: 'Jeszcze bez standardu',
        consultantSignalEn:
          'Do not close — without a standard you will repeat this A3 next quarter.',
        consultantSignalPl: 'Nie zamykaj — bez standardu powtórzysz to A3 za kwartał.',
      },
    ],
    branches: { standardized: null, 'no-standard': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// Bank assembly + pure accessors
// ---------------------------------------------------------------------------

export const A3_QUESTION_BANK: Record<A3StepId, A3QuestionNode[]> = {
  background: BACKGROUND_QUESTIONS,
  'current-state': CURRENT_STATE_QUESTIONS,
  target: TARGET_QUESTIONS,
  'root-cause': ROOT_CAUSE_QUESTIONS,
  countermeasures: COUNTERMEASURE_QUESTIONS,
  plan: PLAN_QUESTIONS,
  'follow-up': FOLLOW_UP_QUESTIONS,
};

const ALL_QUESTIONS: A3QuestionNode[] = A3_STEP_IDS.flatMap((step) => A3_QUESTION_BANK[step]);

const QUESTION_INDEX = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export function getA3QuestionById(id: string): A3QuestionNode | undefined {
  return QUESTION_INDEX.get(id);
}

export function getA3EntryQuestion(step: A3StepId): A3QuestionNode {
  return A3_QUESTION_BANK[step][0];
}

/**
 * Branching resolver: the answer to a question determines the next question.
 * Unknown answer keys fall back to defaultNextId (never dead-end silently).
 */
export function getNextA3Question(
  currentQuestionId: string,
  answerKey: string
): A3QuestionNode | null {
  const current = QUESTION_INDEX.get(currentQuestionId);
  if (!current) return null;
  const nextId =
    answerKey in current.branches ? current.branches[answerKey] : current.defaultNextId;
  if (!nextId) return null;
  return QUESTION_INDEX.get(nextId) || null;
}

export interface A3LadderAnswer {
  questionId: string;
  answerKey: string;
  /** Free-text elaboration captured in conversation. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Evidence gate — accepting an A3 element requires proof or an explicit declaration
// ---------------------------------------------------------------------------

export const A3_DECLARED_UNCONFIRMED_LABEL = {
  pl: 'Deklaracja — niepotwierdzone',
  en: 'Declared — unconfirmed',
} as const;

export interface A3EvidenceGateResult {
  status: A3EvidenceStatus;
  /** Label to render on the card when status !== confirmed. */
  label?: { pl: string; en: string };
}

/**
 * Evidence gate applied when an A3 element is ACCEPTED:
 * - linked evidence refs or an evidence note -> confirmed
 * - otherwise                                -> declared ("declaration, unconfirmed")
 * The gate never blocks acceptance — it forces honesty about the evidence status,
 * exactly like the SWOT/Porter gate (CONCLUSION_LAYER R2: a report that names
 * uncertainty beats one that masks it).
 */
export function evaluateA3ElementEvidence(item: {
  evidenceRefs?: string[];
  evidenceNote?: string;
}): A3EvidenceGateResult {
  const hasRefs = Boolean(item.evidenceRefs && item.evidenceRefs.length > 0);
  const hasNote = Boolean(item.evidenceNote && item.evidenceNote.trim().length > 0);
  if (hasRefs || hasNote) return { status: 'confirmed' };
  return { status: 'declared', label: { ...A3_DECLARED_UNCONFIRMED_LABEL } };
}

/**
 * Structural self-check used by unit tests and (defensively) at module load in dev:
 * every branch target must exist, every step has a leveled ladder, levels start at 1
 * and never skip, and every non-terminal path reaches a terminal (no cycles).
 */
export function validateA3QuestionBank(): string[] {
  const problems: string[] = [];
  A3_STEP_IDS.forEach((step) => {
    const questions = A3_QUESTION_BANK[step];
    if (questions.length === 0) {
      problems.push(`${step}: no questions`);
      return;
    }
    const levels = questions.map((q) => q.level).sort((a, b) => a - b);
    if (levels[0] !== 1) problems.push(`${step}: ladder does not start at level 1`);
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] - levels[i - 1] > 1) problems.push(`${step}: level gap in ladder`);
    }
    questions.forEach((q) => {
      if (q.step !== step) problems.push(`${q.id}: step mismatch`);
      if (q.answerOptions.length < 2) problems.push(`${q.id}: fewer than 2 answer options`);
      if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
      if (!q.intentPl || !q.intentEn) problems.push(`${q.id}: missing PL or EN intent`);
      q.answerOptions.forEach((opt) => {
        if (!(opt.key in q.branches)) problems.push(`${q.id}: option ${opt.key} has no branch`);
        if (!opt.labelPl || !opt.labelEn) problems.push(`${q.id}/${opt.key}: missing label`);
        if (!opt.consultantSignalPl || !opt.consultantSignalEn) {
          problems.push(`${q.id}/${opt.key}: missing consultant signal`);
        }
      });
      Object.entries(q.branches).forEach(([key, target]) => {
        if (target !== null && !QUESTION_INDEX.has(target)) {
          problems.push(`${q.id}: branch ${key} points to missing question ${target}`);
        }
      });
      if (q.defaultNextId !== null && !QUESTION_INDEX.has(q.defaultNextId)) {
        problems.push(`${q.id}: defaultNextId points to missing question`);
      }
    });
    // Every path from the entry question must terminate (no cycles).
    const entry = questions.find((q) => q.level === 1);
    if (entry) {
      const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
      while (stack.length) {
        const { id, seen } = stack.pop()!;
        if (seen.has(id)) {
          problems.push(`${step}: cycle detected at ${id}`);
          continue;
        }
        const node = QUESTION_INDEX.get(id);
        if (!node) continue;
        const nextSeen = new Set(seen).add(id);
        const targets = new Set(
          Object.values(node.branches).concat(node.defaultNextId ? [node.defaultNextId] : [])
        );
        targets.forEach((t) => {
          if (t) stack.push({ id: t, seen: nextSeen });
        });
      }
    }
  });
  return problems;
}

/**
 * Serialize a step's ladder into a prompt block, so the AI mentor asks EXACTLY
 * these questions in conversation (single source of truth with the UI).
 */
export function buildA3StepLadderPromptBlock(step: A3StepId, language: 'pl' | 'en'): string {
  const questions = A3_QUESTION_BANK[step];
  return questions
    .map((q) => {
      const text = language === 'pl' ? q.textPl : q.textEn;
      const intent = language === 'pl' ? q.intentPl : q.intentEn;
      const options = q.answerOptions
        .map((opt) => {
          const label = language === 'pl' ? opt.labelPl : opt.labelEn;
          const signal = language === 'pl' ? opt.consultantSignalPl : opt.consultantSignalEn;
          const next = q.branches[opt.key];
          return `    - [${opt.key}] "${label}" -> ${next || 'ladder complete'} (${signal})`;
        })
        .join('\n');
      return `[${q.id}] (L${q.level}) intent: ${intent}\n  Q: ${text}\n${options}`;
    })
    .join('\n');
}
