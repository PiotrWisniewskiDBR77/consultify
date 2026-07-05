/**
 * Ambition Decomposer — deepening ladder (drabinka pogłębiająca) + proposal bank.
 *
 * Clones the Ansoff `deepeningLadder` pattern (see src/config/ansoff/deepeningLadder.ts):
 * a stable 4-rung "depth staircase" — surface → evidence → quantification →
 * risk-capability — layered per THEME ARCHETYPE (the role a strategic theme plays
 * in reaching the ambition: foundation / accelerator / bet / enabler). The Ansoff
 * ladder branches by growth quadrant; here it branches by the archetype the theme
 * occupies on the path from today to the stated ambition.
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the Ambition
 * Decomposer input/scoring phases and by the synthesis engine (moveValidator.ts).
 */

/** The four archetypes a strategic theme plays on the way to the ambition. */
export type ThemeArchetype = 'foundation' | 'accelerator' | 'bet' | 'enabler';

export const AMBITION_THEME_ARCHETYPES: ThemeArchetype[] = [
  'foundation',
  'accelerator',
  'bet',
  'enabler',
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

export const AMBITION_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-archetype deepening ladder. Each archetype has exactly 4 rungs in
 * RUNG_ORDER, so the synthesis engine can rely on a stable shape.
 */
export const AMBITION_DEEPENING_LADDER: Record<ThemeArchetype, LadderRung[]> = {
  foundation: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który wątek jest fundamentem — czymś, bez czego pozostałe wątki ambicji nie ruszą?',
        en: 'Which theme is a foundation — something without which the other ambition themes cannot start?',
      },
      rationale: {
        pl: 'Fundament to prerequisite, nie priorytet z wyboru. Jeśli blokuje resztę, idzie pierwszy niezależnie od atrakcyjności.',
        en: 'A foundation is a prerequisite, not a preference. If it blocks the rest, it goes first regardless of allure.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że ten wątek faktycznie warunkuje inne — które konkretnie inicjatywy od niego zależą?',
        en: 'What proves this theme actually gates the others — which specific initiatives depend on it?',
      },
      rationale: {
        pl: 'Fundament bez nazwanej zależności to tylko duży wątek. Dowód warunkowania oddziela prerequisite od życzenia.',
        en: 'A foundation with no named dependency is just a big theme. Gating evidence separates a prerequisite from a wish.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest mierzalny cel tego wątku (metryka → wartość) i do kiedy musi być gotów, by nie blokować reszty?',
        en: 'What is the measurable target of this theme (metric → value) and by when must it be ready to not block the rest?',
      },
      rationale: {
        pl: 'Fundament bez terminu gotowości staje się wąskim gardłem — jego deadline jest deadlinem całej ambicji.',
        en: 'A foundation without a ready-by date becomes the bottleneck — its deadline is the deadline of the whole ambition.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co się stanie z całą ambicją, jeśli fundament się opóźni — i jaki macie plan awaryjny?',
        en: 'What happens to the whole ambition if the foundation slips — and what is your contingency?',
      },
      rationale: {
        pl: 'Ryzyko fundamentu jest systemowe: jego poślizg przesuwa wszystko. Musi mieć bufor i wcześniej zbudowaną zdolność.',
        en: 'Foundation risk is systemic: its slip moves everything. It needs a buffer and capability built ahead of time.',
      },
    },
  ],
  accelerator: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który wątek najszybciej przybliża do ambicji, gdy fundament już stoi — gdzie jest największa dźwignia tempa?',
        en: 'Which theme moves fastest toward the ambition once the foundation stands — where is the biggest pace lever?',
      },
      rationale: {
        pl: 'Akcelerator to nie start, to dźwignia. Ma sens dopiero na gotowym fundamencie, ale wtedy daje najwięcej pędu.',
        en: 'An accelerator is not a start, it is a lever. It only fits on a ready foundation, but then it adds the most momentum.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że ten wątek realnie przyspiesza (dane, wczesne wyniki), a nie tylko dobrze brzmi?',
        en: 'What proves this theme actually accelerates (data, early wins) rather than merely sounding good?',
      },
      rationale: {
        pl: 'Akcelerator bez dowodu przyspieszenia to nadzieja. Wczesny wynik oddziela realną dźwignię od optymizmu.',
        en: 'An accelerator without acceleration evidence is hope. An early win separates a real lever from optimism.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile ten wątek skraca drogę do ambicji (metryka → wartość, horyzont) i jakim kosztem?',
        en: 'By how much does this theme shorten the path to the ambition (metric → value, horizon) and at what cost?',
      },
      rationale: {
        pl: 'Akcelerator wart uwagi ma policzalną deltę tempa — inaczej jest tylko kolejnym równoległym wątkiem.',
        en: 'An accelerator worth the attention has a computable pace delta — otherwise it is just another parallel theme.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej zdolności potrzebuje ten wątek, by przyspieszać, a nie przegrzać zespołu na niestabilnym fundamencie?',
        en: 'What capability does this theme need to accelerate without overheating the team on an unstable foundation?',
      },
      rationale: {
        pl: 'Ryzyko akceleratora to odpalenie go za wcześnie — pęd na kruchym fundamencie zamienia się w chaos.',
        en: 'Accelerator risk is firing it too early — momentum on a fragile foundation turns into chaos.',
      },
    },
  ],
  bet: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który wątek to zakład o dużym upside, ale niepewny — coś, co może zdefiniować ambicję albo przepaść?',
        en: 'Which theme is a high-upside but uncertain bet — something that could define the ambition or fizzle?',
      },
      rationale: {
        pl: 'Zakład to świadome ryzyko o asymetrycznym zwrocie. Nazwijcie go zakładem, żeby nie finansować go jak pewnika.',
        en: 'A bet is a deliberate, asymmetric-return risk. Name it a bet so you do not fund it like a certainty.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki najtańszy eksperyment potwierdzi lub obali ten zakład, zanim zaangażujecie duży kapitał?',
        en: 'What is the cheapest experiment that confirms or kills this bet before you commit big capital?',
      },
      rationale: {
        pl: 'Zakład bez taniego testu to hazard. Falsyfikowalny eksperyment zamienia hazard w policzalne ryzyko.',
        en: 'A bet with no cheap test is a gamble. A falsifiable experiment turns a gamble into computable risk.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest upside (metryka → wartość) i jaki twardy limit strat, powyżej którego zakład zamykacie?',
        en: 'What is the upside (metric → value) and the hard loss cap above which you close the bet?',
      },
      rationale: {
        pl: 'Zakład bez limitu strat rozmywa całą ambicję — policzcie, ile jesteście gotowi stracić i do kiedy.',
        en: 'A bet without a loss cap dilutes the whole ambition — compute how much you will lose and by when.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy stać was na przegranie tego zakładu bez uszczerbku dla fundamentu i akceleratorów ambicji?',
        en: 'Can you afford to lose this bet without hurting the foundation and accelerators of the ambition?',
      },
      rationale: {
        pl: 'Ryzyko zakładu jest akceptowalne tylko, gdy jego porażka nie zabija reszty planu — inaczej to nie zakład, to va banque.',
        en: "A bet's risk is acceptable only if its failure does not kill the rest of the plan — otherwise it is not a bet, it is all-in.",
      },
    },
  ],
  enabler: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który wątek nie dowozi ambicji sam, ale bez niego inne wątki są wolniejsze lub droższe?',
        en: 'Which theme does not deliver the ambition itself, but without it the other themes are slower or costlier?',
      },
      rationale: {
        pl: 'Enabler to mnożnik, nie cel. Często niedoceniany, bo jego efekt widać dopiero w tempie i koszcie innych wątków.',
        en: 'An enabler is a multiplier, not a goal. Often underrated, because its effect shows only in the pace and cost of other themes.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód, że ten wątek faktycznie mnoży inne — które wątki stają się szybsze/tańsze dzięki niemu?',
        en: 'What proves this theme actually multiplies the others — which themes become faster/cheaper because of it?',
      },
      rationale: {
        pl: 'Enabler bez nazwanego mnożnika to koszt bez uzasadnienia. Dowód dźwigni oddziela enabler od kosztu ogólnego.',
        en: 'An enabler with no named multiplier is cost without justification. Leverage evidence separates it from overhead.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile ten enabler obniża koszt lub skraca czas innych wątków (metryka → wartość) i ile sam kosztuje?',
        en: 'By how much does this enabler cut the cost or time of other themes (metric → value) and what does it cost?',
      },
      rationale: {
        pl: 'Enabler wart finansowania ma policzalny mnożnik — inaczej konkuruje o budżet z wątkami, które dowożą wprost.',
        en: 'An enabler worth funding has a computable multiplier — otherwise it competes for budget with themes that deliver directly.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy enabler jest gotowy zanim wątki, które ma wspierać, ruszą — czy przyjdzie za późno, by pomóc?',
        en: 'Is the enabler ready before the themes it supports start — or will it arrive too late to help?',
      },
      rationale: {
        pl: 'Ryzyko enablera to zły timing: dostarczony po fakcie staje się kosztem bez mnożnika, którego miał dostarczyć.',
        en: 'Enabler risk is bad timing: delivered after the fact it becomes cost without the multiplier it was meant to add.',
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
 * Partner-grade proposal bank per theme archetype. Consumed when AI (or the
 * offline fallback) proposes candidate sequencing moves. Mirrors Ansoff's
 * PROPOSAL_BANK.
 */
export const AMBITION_PROPOSAL_BANK: Record<ThemeArchetype, ArchetypeProposal[]> = {
  foundation: [
    {
      rung: 'surface',
      title: {
        pl: 'Zbudować fundament, który odblokowuje resztę ambicji',
        en: 'Build the foundation that unblocks the rest of the ambition',
      },
      explanation: {
        pl: 'Wątek warunkujący inne idzie pierwszy niezależnie od atrakcyjności — inaczej reszta planu czeka na wąskie gardło.',
        en: 'A theme that gates the others goes first regardless of allure — otherwise the rest of the plan waits on the bottleneck.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Nazwać wprost, które inicjatywy zależą od fundamentu',
        en: 'Name explicitly which initiatives depend on the foundation',
      },
      explanation: {
        pl: 'Dowód zależności zamienia „duży wątek" w prerequisite z jasnym powodem, dla którego wchodzi jako pierwszy.',
        en: 'Dependency evidence turns a "big theme" into a prerequisite with a clear reason it goes first.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ustawić deadline gotowości fundamentu jako deadline ambicji',
        en: 'Set the foundation ready-by date as the ambition deadline',
      },
      explanation: {
        pl: 'Termin gotowości fundamentu rządzi całą sekwencją — jeśli się przesuwa, przesuwa się wszystko za nim.',
        en: 'The foundation ready-by date governs the whole sequence — if it slips, everything behind it slips.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Dać fundamentowi bufor, bo jego poślizg przesuwa wszystko',
        en: 'Give the foundation a buffer, since its slip moves everything',
      },
      explanation: {
        pl: 'Ryzyko fundamentu jest systemowe — bufor czasu i wcześniej zbudowana zdolność chronią całą ambicję.',
        en: 'Foundation risk is systemic — a time buffer and pre-built capability protect the whole ambition.',
      },
    },
  ],
  accelerator: [
    {
      rung: 'surface',
      title: {
        pl: 'Odpalić akcelerator dopiero na gotowym fundamencie',
        en: 'Fire the accelerator only on a ready foundation',
      },
      explanation: {
        pl: 'Dźwignia tempa ma sens po fundamencie — wtedy dodaje najwięcej pędu bez przegrzewania zespołu.',
        en: 'A pace lever fits after the foundation — then it adds the most momentum without overheating the team.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Potwierdzić przyspieszenie wczesnym wynikiem, nie deklaracją',
        en: 'Confirm acceleration with an early win, not a declaration',
      },
      explanation: {
        pl: 'Akcelerator bez dowodu tempa to nadzieja — wczesny mierzalny wynik odróżnia dźwignię od optymizmu.',
        en: 'An accelerator with no pace evidence is hope — an early measurable win tells a lever from optimism.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć, o ile akcelerator skraca drogę do ambicji',
        en: 'Compute how much the accelerator shortens the path',
      },
      explanation: {
        pl: 'Akcelerator wart uwagi ma policzalną deltę tempa — inaczej jest tylko kolejnym równoległym wątkiem.',
        en: 'An accelerator worth attention has a computable pace delta — otherwise it is just another parallel theme.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Nie odpalać akceleratora, zanim zdolność zespołu go uniesie',
        en: 'Do not fire the accelerator before team capacity can carry it',
      },
      explanation: {
        pl: 'Pęd na kruchym fundamencie zamienia się w chaos — akcelerator potrzebuje gotowej zdolności egzekucji.',
        en: 'Momentum on a fragile foundation turns into chaos — an accelerator needs ready execution capacity.',
      },
    },
  ],
  bet: [
    {
      rung: 'surface',
      title: {
        pl: 'Nazwać zakład zakładem i nie finansować go jak pewnika',
        en: 'Name the bet a bet and do not fund it like a certainty',
      },
      explanation: {
        pl: 'Wątek o dużym, ale niepewnym upside to świadome ryzyko — traktowany jak pewnik rozmywa resztę planu.',
        en: 'A high-but-uncertain-upside theme is a deliberate risk — treated as a certainty it dilutes the rest of the plan.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Odpalić najtańszy eksperyment, który obali zakład',
        en: 'Run the cheapest experiment that can kill the bet',
      },
      explanation: {
        pl: 'Falsyfikowalny test zamienia hazard w policzalne ryzyko — najpierw kupcie informację, nie zaangażowanie.',
        en: 'A falsifiable test turns a gamble into computable risk — buy information first, not commitment.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ustawić twardy limit strat dla zakładu',
        en: 'Set a hard loss cap for the bet',
      },
      explanation: {
        pl: 'Upside bez limitu strat rozmywa ambicję — zdefiniujcie, ile wolno stracić i do kiedy zakład zamykacie.',
        en: 'Upside without a loss cap dilutes the ambition — define how much you may lose and by when you close the bet.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Upewnić się, że porażka zakładu nie zabije fundamentu',
        en: 'Ensure the bet losing does not kill the foundation',
      },
      explanation: {
        pl: 'Zakład jest akceptowalny tylko, gdy jego porażka nie rozbraja reszty planu — inaczej to va banque, nie zakład.',
        en: 'A bet is acceptable only if its loss does not disarm the rest of the plan — otherwise it is all-in, not a bet.',
      },
    },
  ],
  enabler: [
    {
      rung: 'surface',
      title: {
        pl: 'Sfinansować enabler dla mnożnika, nie dla niego samego',
        en: 'Fund the enabler for its multiplier, not for itself',
      },
      explanation: {
        pl: 'Enabler nie dowozi ambicji sam — jego wartość to tempo i koszt innych wątków, które przyspiesza.',
        en: 'An enabler does not deliver the ambition itself — its value is the pace and cost of the other themes it speeds up.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Nazwać wątki, które enabler realnie przyspiesza',
        en: 'Name the themes the enabler actually speeds up',
      },
      explanation: {
        pl: 'Enabler bez nazwanego mnożnika to koszt bez uzasadnienia — dowód dźwigni odróżnia go od kosztu ogólnego.',
        en: 'An enabler with no named multiplier is cost without justification — leverage evidence tells it from overhead.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć mnożnik: o ile enabler obniża koszt/czas innych',
        en: 'Compute the multiplier: how much the enabler cuts others’ cost/time',
      },
      explanation: {
        pl: 'Enabler wart finansowania ma policzalny mnożnik — inaczej konkuruje o budżet z wątkami dowożącymi wprost.',
        en: 'An enabler worth funding has a computable multiplier — otherwise it competes for budget with themes that deliver directly.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Dostarczyć enabler, zanim wspierane wątki ruszą',
        en: 'Deliver the enabler before the themes it supports start',
      },
      explanation: {
        pl: 'Enabler dostarczony po fakcie to koszt bez mnożnika — jego timing decyduje o tym, czy w ogóle pomaga.',
        en: 'An enabler delivered after the fact is cost with no multiplier — its timing decides whether it helps at all.',
      },
    },
  ],
};
