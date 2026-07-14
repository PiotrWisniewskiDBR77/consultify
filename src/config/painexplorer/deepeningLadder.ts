/**
 * Pain Explorer — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the SMED / Ansoff `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/smedplanner/deepeningLadder.ts). Encodes the pain-discovery
 * "depth staircase" per stage of the pain lifecycle:
 *
 *   1. surface          — what does the client name as the pain today?
 *   2. evidence         — is it a real, observed pain or an anecdote?
 *   3. quantification   — what does the pain cost (time × frequency × people)?
 *   4. risk-capability  — is the root removable, and what must you be able to do?
 *
 * The four canonical stages mirror how a partner triages operational pain from
 * "someone complained" to "here is the removable root and its cost":
 *   - detect     : surface every named pain, symptom and friction point
 *   - qualify    : separate real, recurring pain from one-off noise
 *   - measure    : cost the pain in time, money and risk so it can be ranked
 *   - diagnose   : trace to a removable root cause and name the capability gap
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the Pain Explorer
 * input/analysis phases and by the synthesis engine (painSynthesisEngine.ts).
 */

export type PainStageId = 'detect' | 'qualify' | 'measure' | 'diagnose';

export const PAIN_STAGES: PainStageId[] = ['detect', 'qualify', 'measure', 'diagnose'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and stage-agnostic. */
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

/** The four canonical rungs shared by every stage, with stage-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const PAIN_LADDER_RUNG_ORDER = RUNG_ORDER;

const PAIN_STAGE_LABEL: Record<PainStageId, Bilingual> = {
  detect: { pl: 'Wykryj', en: 'Detect' },
  qualify: { pl: 'Zakwalifikuj', en: 'Qualify' },
  measure: { pl: 'Zmierz', en: 'Measure' },
  diagnose: { pl: 'Zdiagnozuj', en: 'Diagnose' },
};

export const painStageLabel = (stage: PainStageId): Bilingual => PAIN_STAGE_LABEL[stage];

/**
 * Per-stage deepening ladder. Each stage has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const PAIN_DEEPENING_LADDER: Record<PainStageId, LadderRung[]> = {
  detect: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co konkretnie ludzie w firmie nazywają dziś bólem — który proces, moment, przekazanie boli najbardziej?',
        en: 'What exactly do people in the firm name as pain today — which process, moment or handoff hurts most?',
      },
      rationale: {
        pl: 'Odkrywanie bólu zaczyna się od jego nazwania słowami ludzi z pierwszej linii, nie od gotowej listy problemów doradcy.',
        en: "Pain discovery starts by naming it in the words of front-line people, not from a consultant's ready-made problem list.",
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiadomo, że to ból, a nie jednorazowe narzekanie — kto go zgłosił, jak często się powtarza?',
        en: 'How do you know it is pain and not a one-off complaint — who reported it, how often does it recur?',
      },
      rationale: {
        pl: 'Ból bez powtarzalności i źródła to anegdota; dowód oddziela realny problem od głośnego pojedynczego incydentu.',
        en: 'Pain without recurrence and a source is an anecdote; evidence separates a real problem from a loud single incident.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ilu ludzi dotyka ten ból i jak często się pojawia — jaka jest jego skala w skali tygodnia lub miesiąca?',
        en: 'How many people does this pain touch and how often does it occur — what is its scale per week or month?',
      },
      rationale: {
        pl: 'Zasięg × częstotliwość zamienia „wszystkich to wkurza" w policzalną skalę, którą można porównać między bólami.',
        en: 'Reach × frequency turns "it annoys everyone" into a countable scale you can compare across pains.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co się stanie, jeśli ten ból zignorujecie — czy sam narasta, czy jest tolerowalny do czasu?',
        en: 'What happens if you ignore this pain — does it compound on its own, or is it tolerable for now?',
      },
      rationale: {
        pl: 'Nie każdy ból wart jest ruchu; ryzyko zaniechania oddziela ból, który trzeba usunąć, od tego, który można przeczekać.',
        en: 'Not every pain is worth a move; the risk of inaction separates pain you must remove from pain you can outwait.',
      },
    },
  ],
  qualify: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy to prawdziwy ból operacyjny, czy objaw czegoś głębszego — który proces go generuje?',
        en: 'Is this a real operational pain or a symptom of something deeper — which process generates it?',
      },
      rationale: {
        pl: 'Kwalifikacja odróżnia ból od jego objawu: leczenie objawu bez procesu-źródła to gaszenie tego samego pożaru w kółko.',
        en: 'Qualifying separates pain from its symptom: treating the symptom without the source process is fighting the same fire on repeat.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy różni ludzie niezależnie potwierdzają ten ból, czy to głos jednej osoby lub jednego działu?',
        en: 'Do different people independently confirm this pain, or is it the voice of one person or one department?',
      },
      rationale: {
        pl: 'Ból potwierdzony niezależnie przez kilku ludzi jest problemem systemu; ból jednego głosu bywa preferencją, nie usterką.',
        en: 'Pain independently confirmed by several people is a system problem; a single-voice pain is often a preference, not a fault.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak dotkliwy jest ten ból względem innych — czy blokuje pracę, czy tylko ją spowalnia?',
        en: 'How severe is this pain relative to others — does it block work, or merely slow it down?',
      },
      rationale: {
        pl: 'Dotkliwość ustawia kolejność: ból, który zatrzymuje przepływ, bije ból, który go tylko drażni, nawet jeśli drugi jest głośniejszy.',
        en: 'Severity sets the order: pain that halts flow beats pain that merely irritates it, even when the latter is louder.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy ten ból macie kompetencje rozwiązać sami, czy wymaga on zdolności, których dziś nie posiadacie?',
        en: 'Do you have the capability to solve this pain yourselves, or does it need capability you do not have today?',
      },
      rationale: {
        pl: 'Kwalifikacja bólu to też ocena wykonalności: ból rozwiązywalny własnym zespołem trafia wyżej niż ból wymagający partnera lub inwestycji.',
        en: 'Qualifying pain also judges feasibility: pain solvable by your own team ranks above pain that needs a partner or investment.',
      },
    },
  ],
  measure: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile czasu jedno wystąpienie tego bólu realnie zjada — komu i na jakim etapie?',
        en: 'How much time does a single occurrence of this pain really eat — for whom and at which step?',
      },
      rationale: {
        pl: 'Bez czasu na jedno wystąpienie ból pozostaje odczuciem; minuta na wystąpienie to fundament każdej dalszej kalkulacji.',
        en: 'Without the time per occurrence pain stays a feeling; minutes-per-occurrence is the foundation of every later calculation.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy ten czas jest zmierzony (log, obserwacja), czy oszacowany z pamięci zespołu?',
        en: "Is this time measured (a log, an observation) or estimated from the team's memory?",
      },
      rationale: {
        pl: 'Szacunek z pamięci potrafi mylić się kilkukrotnie; status dowodu decyduje, czy liczbę można pokazać zarządowi.',
        en: 'A memory estimate can be off by multiples; the evidence status decides whether the number can face the board.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile ten ból kosztuje w skali roku: czas × częstotliwość × liczba osób — i ile z tego to twardy koszt?',
        en: 'What does this pain cost across a year: time × frequency × people — and how much of it is hard cost?',
      },
      rationale: {
        pl: 'Roczny koszt bólu to liczba, która uzasadnia budżet na jego usunięcie i porządkuje portfel bólów wg zwrotu.',
        en: 'The annual cost of pain is the number that justifies the budget to remove it and ranks the pain portfolio by return.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy poza kosztem czasu ten ból niesie ryzyko jakości, zgodności lub utraty klienta, którego nie widać w minutach?',
        en: 'Beyond the time cost, does this pain carry a quality, compliance or customer-loss risk invisible in the minutes?',
      },
      rationale: {
        pl: 'Najdroższy ból bywa niewidoczny w zegarze: błąd, kara, odejście klienta — ryzyko trzeba nazwać obok czasu, nie zamiast niego.',
        en: 'The costliest pain is often invisible on the clock: an error, a fine, a lost client — name the risk alongside the time, not instead of it.',
      },
    },
  ],
  diagnose: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaka jest pierwsza prawdopodobna przyczyna tego bólu — na jakim kroku procesu on powstaje?',
        en: 'What is the first likely cause of this pain — at which process step does it originate?',
      },
      rationale: {
        pl: 'Diagnoza zaczyna się od wskazania miejsca powstania: ból leczy się u źródła, nie tam, gdzie najbardziej boli.',
        en: 'Diagnosis starts by pointing at where it originates: pain is cured at its source, not where it hurts most.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy dotarliście do przyczyny źródłowej (5×dlaczego), czy zatrzymaliście się na pierwszym wyjaśnieniu?',
        en: 'Have you reached the root cause (5 whys), or did you stop at the first explanation?',
      },
      rationale: {
        pl: 'Pierwsze wyjaśnienie rzadko jest źródłem; bez zejścia w dół łańcucha przyczyn usprawnienie leczy objaw, a ból wraca.',
        en: 'The first explanation is rarely the source; without going down the cause chain a fix treats the symptom and the pain returns.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile z rocznego kosztu bólu usunie zaadresowanie tej konkretnej przyczyny źródłowej?',
        en: "How much of the pain's annual cost would addressing this specific root cause remove?",
      },
      rationale: {
        pl: 'Nie każda przyczyna źródłowa jest warta usunięcia; udział w koszcie bólu decyduje, którą przyczynę zaatakować najpierw.',
        en: 'Not every root cause is worth removing; its share of the pain cost decides which cause to attack first.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej zdolności (proces, narzędzie, umiejętność, bodziec) brakuje, by usunąć tę przyczynę na trwałe?',
        en: 'Which capability (process, tool, skill, incentive) is missing to remove this cause for good?',
      },
      rationale: {
        pl: 'Przyczyna źródłowa znika trwale tylko z zasobem, który ją usuwa; nazwanie luki zdolności zamienia diagnozę w wykonalny ruch.',
        en: 'A root cause disappears for good only with the resource that removes it; naming the capability gap turns a diagnosis into an actionable move.',
      },
    },
  ],
};

export interface StageProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per stage. Consumed when AI (or the offline
 * fallback) proposes candidate pain-discovery items. Mirrors SMED's PROPOSAL_BANK.
 */
export const PAIN_PROPOSAL_BANK: Record<PainStageId, StageProposal[]> = {
  detect: [
    {
      rung: 'surface',
      title: {
        pl: 'Zebrać bóle słowami pierwszej linii, nie doradcy',
        en: "Capture pains in front-line words, not the consultant's",
      },
      explanation: {
        pl: 'Zanim zaczniecie klasyfikować, zbierzcie surowe zgłoszenia od ludzi wykonujących pracę — ich sformułowania niosą kontekst, którego lista problemów doradcy nie odda.',
        en: "Before classifying anything, gather raw reports from the people doing the work — their phrasing carries context a consultant's problem list cannot reproduce.",
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Odsiać incydenty jednorazowe od bólu powtarzalnego',
        en: 'Screen one-off incidents out of recurring pain',
      },
      explanation: {
        pl: 'Dla każdego zgłoszenia zapytajcie „ile razy w tym miesiącu?" — powtarzalność oddziela systemowy ból wart ruchu od głośnego, ale jednorazowego incydentu.',
        en: 'For each report ask "how many times this month?" — recurrence separates systemic pain worth a move from a loud but one-off incident.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Oznaczyć zasięg każdego bólu liczbą osób',
        en: 'Tag each pain with the number of people it touches',
      },
      explanation: {
        pl: 'Ból dotykający 20 osób codziennie bije ból dotykający jednej osoby raz w tygodniu — zasięg to pierwszy filtr, zanim policzycie koszt.',
        en: 'Pain touching 20 people daily beats pain touching one person weekly — reach is the first filter before you cost anything.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Odróżnić ból narastający od tolerowalnego',
        en: 'Separate compounding pain from tolerable pain',
      },
      explanation: {
        pl: 'Zaznaczcie, które bóle same rosną (dług, backlog, rotacja), a które są stabilnie irytujące — pierwsze wymagają ruchu teraz, drugie mogą poczekać.',
        en: 'Mark which pains grow on their own (debt, backlog, attrition) versus which are steadily annoying — the first demand a move now, the second can wait.',
      },
    },
  ],
  qualify: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować każdy ból na proces, który go rodzi',
        en: 'Map each pain to the process that births it',
      },
      explanation: {
        pl: 'Przypiszcie ból do konkretnego kroku procesu — bez tego leczycie objaw i ten sam ból wraca z innej strony.',
        en: 'Attribute the pain to a specific process step — without it you treat the symptom and the same pain returns from another angle.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Potwierdzić ból niezależnie w dwóch źródłach',
        en: 'Confirm the pain independently in two sources',
      },
      explanation: {
        pl: 'Ból potwierdzony przez dwa niezależne działy lub role jest problemem systemu; głos jednej osoby zostawcie jako hipotezę do sprawdzenia.',
        en: 'Pain confirmed by two independent departments or roles is a system problem; a single voice stays a hypothesis to check.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ocenić dotkliwość: blokuje czy tylko spowalnia',
        en: 'Score severity: does it block or merely slow',
      },
      explanation: {
        pl: 'Rozdzielcie bóle blokujące przepływ od bóle spowalniających — pierwsze podnoszą priorytet niezależnie od tego, jak głośno o nich mowa.',
        en: 'Split flow-blocking pains from flow-slowing ones — the first raise priority regardless of how loudly they are voiced.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zaznaczyć bóle rozwiązywalne własnym zespołem',
        en: 'Flag pains solvable by your own team',
      },
      explanation: {
        pl: 'Ból, który wasz zespół usunie bez zewnętrznej inwestycji, trafia wyżej — szybki, tani zysk buduje wiarę w cały program przed trudniejszymi bólami.',
        en: 'Pain your team can remove without external investment ranks higher — a fast, cheap win builds belief in the whole program before the harder pains.',
      },
    },
  ],
  measure: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmierzyć czas jednego wystąpienia u źródła',
        en: 'Measure the time of one occurrence at the source',
      },
      explanation: {
        pl: 'Obserwujcie jedno realne wystąpienie bólu i zmierzcie minuty, które zjada — to fundament, którego szacunek z pamięci nie zastąpi.',
        en: 'Observe one real occurrence of the pain and measure the minutes it eats — the foundation a memory estimate cannot replace.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oznaczyć każdą liczbę statusem dowodu',
        en: 'Tag every number with an evidence status',
      },
      explanation: {
        pl: 'Rozróżnijcie liczby zmierzone od oszacowanych — zarządowi pokazujecie tylko te pierwsze, resztę nazwijcie „do potwierdzenia".',
        en: 'Distinguish measured numbers from estimated ones — show the board only the former and label the rest "to be confirmed".',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć roczny koszt: czas × częstotliwość × osoby',
        en: 'Compute annual cost: time × frequency × people',
      },
      explanation: {
        pl: 'Suma minut na wystąpienie × liczba wystąpień/rok × liczba osób daje roczny koszt bólu — liczbę, która porządkuje portfel wg zwrotu.',
        en: "Minutes per occurrence × occurrences/year × people gives the pain's annual cost — the number that ranks the portfolio by return.",
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Dodać ukryte ryzyko obok kosztu czasu',
        en: 'Add hidden risk alongside the time cost',
      },
      explanation: {
        pl: 'Nazwijcie ryzyko jakości, zgodności lub utraty klienta, którego nie widać w minutach — najdroższy ból bywa ten, którego zegar nie mierzy.',
        en: 'Name the quality, compliance or customer-loss risk invisible in the minutes — the costliest pain is often the one the clock does not measure.',
      },
    },
  ],
  diagnose: [
    {
      rung: 'surface',
      title: {
        pl: 'Wskazać krok procesu, w którym ból powstaje',
        en: 'Point at the process step where the pain originates',
      },
      explanation: {
        pl: 'Zlokalizujcie miejsce powstania bólu, nie miejsce, gdzie najbardziej boli — usprawnienie u źródła usuwa ból raz, a nie w kółko.',
        en: 'Locate where the pain originates, not where it hurts most — a fix at the source removes the pain once, not repeatedly.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zejść do przyczyny źródłowej metodą 5×dlaczego',
        en: 'Drill to the root cause with 5 whys',
      },
      explanation: {
        pl: 'Zadajcie „dlaczego" pięć razy, aż dojdziecie do przyczyny, którą da się usunąć — pierwsze wyjaśnienie prawie nigdy nie jest źródłem.',
        en: 'Ask "why" five times until you reach a removable cause — the first explanation is almost never the source.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Oszacować udział przyczyny w koszcie bólu',
        en: "Estimate the cause's share of the pain cost",
      },
      explanation: {
        pl: 'Policzcie, ile rocznego kosztu bólu usunie zaadresowanie tej przyczyny — udział decyduje, którą przyczynę zaatakować najpierw.',
        en: "Compute how much of the pain's annual cost addressing this cause removes — its share decides which cause to attack first.",
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Nazwać brakującą zdolność usunięcia przyczyny',
        en: 'Name the missing capability to remove the cause',
      },
      explanation: {
        pl: 'Wskażcie proces, narzędzie, umiejętność lub bodziec, którego brak trzyma ból przy życiu — bez nazwania luki diagnoza pozostaje opisem, nie ruchem.',
        en: 'Point at the process, tool, skill or incentive whose absence keeps the pain alive — without naming the gap the diagnosis stays a description, not a move.',
      },
    },
  ],
};
