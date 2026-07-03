/**
 * Risk & Uncertainty — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Ansoff config pattern (src/config/ansoff/deepeningLadder.ts)
 * but encodes the risk-specific "depth staircase" per analytical dimension:
 *
 *   1. surface          — what could go wrong / what are we assuming?
 *   2. evidence         — what signal backs this being real (not fear)?
 *   3. quantification    — how likely × how much does it hurt?
 *   4. response-capability — can we actually detect it and respond in time?
 *
 * The three dimensions mirror the RiskUncertaintyData sub-lists so the
 * synthesis engine can walk each axis at a stable depth:
 *   - assumption : the beliefs the plan rests on (consequence if wrong)
 *   - risk        : the downside events (probability × impact)
 *   - scenario    : the alternative futures to pressure-test against
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the Risk &
 * Uncertainty input/analysis phases and by the synthesis engine.
 */

export type RiskDimensionId = 'assumption' | 'risk' | 'scenario';

export const RISK_DIMENSIONS: RiskDimensionId[] = ['assumption', 'risk', 'scenario'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and dimension-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'response-capability';
  /** 1-4 depth level (surface..response) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing. */
  rationale: Bilingual;
}

/** The four canonical rungs shared by every dimension, with dimension-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = [
  'surface',
  'evidence',
  'quantification',
  'response-capability',
];

export const RISK_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-dimension deepening ladder. Each dimension has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const RISK_DEEPENING_LADDER: Record<RiskDimensionId, LadderRung[]> = {
  assumption: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na jakich niewypowiedzianych założeniach opiera się ten plan — co musi być prawdą, żeby zadziałał?',
        en: 'Which unspoken assumptions does this plan rest on — what must be true for it to work?',
      },
      rationale: {
        pl: 'Najgroźniejsze ryzyko to założenie, którego nikt nie nazwał — najpierw wyciągnijcie je na wierzch.',
        en: 'The most dangerous risk is an assumption no one named — surface it before anything else.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki dowód potwierdza to założenie, a jaki mógłby je obalić — czy to fakt, czy życzenie?',
        en: 'What evidence confirms this assumption, and what could refute it — is it a fact or a wish?',
      },
      rationale: {
        pl: 'Założenie bez dowodu to zakład; oddzielcie sprawdzalny fakt od wygodnej wiary.',
        en: 'An assumption without evidence is a bet; separate a checkable fact from a convenient belief.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak bardzo boli, jeśli to założenie jest błędne — i jak pewni jesteście, że jest prawdziwe (1-5)?',
        en: 'How much does it hurt if this assumption is wrong — and how confident are you it holds (1-5)?',
      },
      rationale: {
        pl: 'Ważne jest tylko założenie, które boli, gdy pęka; skwantyfikujcie konsekwencję i pewność.',
        en: 'Only an assumption that hurts when it breaks matters; quantify the consequence and the confidence.',
      },
    },
    {
      id: 'response-capability',
      depth: 4,
      label: { pl: 'Reakcja i zdolności', en: 'Response & capability' },
      question: {
        pl: 'Jak i kiedy zwalidujecie to założenie zanim będzie za późno, i kto za to odpowiada?',
        en: 'How and when will you validate this assumption before it is too late, and who owns that?',
      },
      rationale: {
        pl: 'Niski koszt: test taniej obala złe założenie, niż zrobi to rynek na pełnej skali.',
        en: 'Low cost: a test disproves a bad assumption cheaper than the market will at full scale.',
      },
    },
  ],
  risk: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jakie konkretne zdarzenie może pójść źle — nazwane jako zdarzenie, nie jako mgliste zagrożenie?',
        en: 'What specific event could go wrong — named as an event, not a vague threat?',
      },
      rationale: {
        pl: '„Ryzyko rynkowe" nie da się zarządzać; „utrata kluczowego klienta w Q3" już tak.',
        en: '"Market risk" cannot be managed; "loss of the anchor client in Q3" can.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki sygnał wskazuje, że to ryzyko jest realne, a nie tylko wyobrażone — i jaki byłby wczesny znak?',
        en: 'What signal shows this risk is real, not just imagined — and what would be an early warning?',
      },
      rationale: {
        pl: 'Ryzyko poparte sygnałem trafia na radar; ryzyko bez sygnału to szum, który rozprasza uwagę.',
        en: 'A signal-backed risk earns the radar; a risk with no signal is noise that dilutes attention.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jakie jest prawdopodobieństwo (1-5) i wpływ (1-5) — i ile realnie kosztuje was, jeśli się zmaterializuje?',
        en: 'What is the probability (1-5) and impact (1-5) — and what does it really cost you if it materializes?',
      },
      rationale: {
        pl: 'Priorytet ryzyka to prawdopodobieństwo × wpływ; bez liczb wszystko wygląda równie groźnie.',
        en: 'Risk priority is probability × impact; without numbers everything looks equally scary.',
      },
    },
    {
      id: 'response-capability',
      depth: 4,
      label: { pl: 'Reakcja i zdolności', en: 'Response & capability' },
      question: {
        pl: 'Jaka jest reakcja (unikać / przenieść / złagodzić / zaakceptować), kto ją wykona i po jakim triggerze?',
        en: 'What is the response (avoid / transfer / mitigate / accept), who executes it, and on what trigger?',
      },
      rationale: {
        pl: 'Ryzyko bez właściciela i triggera to notatka, nie plan; reakcja musi mieć rękę i moment.',
        en: 'A risk without an owner and a trigger is a note, not a plan; the response needs a hand and a moment.',
      },
    },
  ],
  scenario: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jakie odmienne przyszłości (bazowa, lepsza, gorsza, skrajna) warto rozważyć wobec tej decyzji?',
        en: 'Which alternative futures (base, upside, downside, stress) are worth weighing against this decision?',
      },
      rationale: {
        pl: 'Jeden plan na jedną przyszłość jest kruchy; scenariusze robią plan odpornym na to, czego nie znacie.',
        en: 'One plan for one future is brittle; scenarios make the plan robust to what you do not know.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Które obserwowalne sygnały powiedzą wam wcześnie, że wchodzicie właśnie w ten scenariusz?',
        en: 'Which observable signals will tell you early that you are entering this particular scenario?',
      },
      rationale: {
        pl: 'Scenariusz bez sygnałów-do-obserwacji to opowieść; z nimi to system wczesnego ostrzegania.',
        en: 'A scenario without signals-to-watch is a story; with them it is an early-warning system.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak prawdopodobny jest każdy scenariusz (1-5) i jak bardzo zmienia to, co powinniście zrobić dziś?',
        en: 'How likely is each scenario (1-5) and how much does it change what you should do today?',
      },
      rationale: {
        pl: 'Liczy się scenariusz, który zmienia decyzję; oszacujcie prawdopodobieństwo i wagę dla planu.',
        en: 'The scenario that changes the decision is the one that counts; estimate its likelihood and weight for the plan.',
      },
    },
    {
      id: 'response-capability',
      depth: 4,
      label: { pl: 'Reakcja i zdolności', en: 'Response & capability' },
      question: {
        pl: 'Jaka jest wasza gotowa odpowiedź na każdy scenariusz i czy macie zdolność ją uruchomić na czas?',
        en: 'What is your pre-committed response to each scenario, and can you execute it in time?',
      },
      rationale: {
        pl: 'Wartość scenariusza to gotowa reakcja: decyzja podjęta na zimno bije decyzję w panice.',
        en: 'A scenario pays off in a rehearsed response: a decision made cold beats a decision made in panic.',
      },
    },
  ],
};

export interface DimensionProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per dimension. Consumed when AI (or the offline
 * fallback) proposes candidate risk items. Mirrors Ansoff's proposal bank.
 */
export const RISK_PROPOSAL_BANK: Record<RiskDimensionId, DimensionProposal[]> = {
  assumption: [
    {
      rung: 'surface',
      title: {
        pl: 'Nazwać założenie, na którym wisi cały plan',
        en: 'Name the assumption the whole plan hangs on',
      },
      explanation: {
        pl: 'Zanim policzycie ryzyka, wypiszcie jedno przekonanie, które gdyby okazało się fałszem, unieważnia plan — to najtańszy sposób uniknięcia katastrofy.',
        en: 'Before scoring risks, write the one belief that, if false, voids the plan — the cheapest way to avoid a catastrophe.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Odróżnić fakt od życzenia w kluczowym założeniu',
        en: 'Separate fact from wish in the key assumption',
      },
      explanation: {
        pl: 'Oznaczcie każde założenie jako potwierdzone dowodem albo jako wiarę do zwalidowania — ta granica decyduje, gdzie inwestować w sprawdzenie.',
        en: 'Mark each assumption as evidence-backed or as a belief to validate — that line decides where to invest in checking.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Skwantyfikować konsekwencję błędnego założenia',
        en: 'Quantify the consequence of a wrong assumption',
      },
      explanation: {
        pl: 'Nadajcie każdej hipotezie pewność (1-5) i koszt-jeśli-błędna; priorytetem jest niska pewność przy wysokim koszcie, nie odwrotnie.',
        en: 'Give each hypothesis a confidence (1-5) and a cost-if-wrong; the priority is low confidence at high cost, not the reverse.',
      },
    },
    {
      rung: 'response-capability',
      title: {
        pl: 'Zaprojektować tani test walidujący przed skalą',
        en: 'Design a cheap validating test before scale',
      },
      explanation: {
        pl: 'Do najgroźniejszego założenia dopiszcie metodę walidacji i termin — obalcie je w laboratorium, zanim obali je rynek na pełnej skali.',
        en: 'For the most dangerous assumption, attach a validation method and a date — disprove it in the lab before the market does at full scale.',
      },
    },
  ],
  risk: [
    {
      rung: 'surface',
      title: {
        pl: 'Zamienić mgliste zagrożenie w konkretne zdarzenie',
        en: 'Turn a vague threat into a concrete event',
      },
      explanation: {
        pl: 'Przepiszcie „ryzyko rynkowe" na nazwane zdarzenie z podmiotem i horyzontem — dopiero takim da się zarządzać i przypisać właściciela.',
        en: 'Rewrite "market risk" into a named event with a subject and a horizon — only that can be managed and owned.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Powiązać ryzyko z wczesnym sygnałem ostrzegawczym',
        en: 'Tie the risk to an early warning signal',
      },
      explanation: {
        pl: 'Dla każdego ryzyka nazwijcie trigger — obserwowalny znak, że zaczyna się materializować; to zamienia strach w system wczesnego ostrzegania.',
        en: 'For each risk, name a trigger — an observable sign it is beginning to materialize; that turns fear into an early-warning system.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Uszeregować ryzyka wg prawdopodobieństwo × wpływ',
        en: 'Rank risks by probability × impact',
      },
      explanation: {
        pl: 'Oceńcie każde ryzyko w skali 1-5 na obu osiach; skupcie zdolność reakcji na kilku o najwyższym iloczynie, nie rozpraszajcie jej na wszystkie.',
        en: 'Score each risk 1-5 on both axes; concentrate response capacity on the few with the highest product, not spread across all.',
      },
    },
    {
      rung: 'response-capability',
      title: {
        pl: 'Przypisać reakcję, właściciela i trigger do ryzyka',
        en: 'Assign a response, owner and trigger to the risk',
      },
      explanation: {
        pl: 'Wybierzcie strategię (unikać/przenieść/złagodzić/zaakceptować), właściciela i moment uruchomienia — ryzyko bez tych trzech to notatka, nie plan.',
        en: 'Pick a strategy (avoid/transfer/mitigate/accept), an owner and a trigger moment — a risk without these three is a note, not a plan.',
      },
    },
  ],
  scenario: [
    {
      rung: 'surface',
      title: {
        pl: 'Rozpisać decyzję na cztery przyszłości',
        en: 'Spread the decision across four futures',
      },
      explanation: {
        pl: 'Zamiast jednego planu bazowego, rozważcie wersję lepszą, gorszą i skrajną — plan odporny na kilka przyszłości bije plan idealny na jedną.',
        en: 'Instead of a single base plan, weigh an upside, a downside and a stress case — a plan robust to several futures beats a plan perfect for one.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zdefiniować sygnały-do-obserwacji dla każdego scenariusza',
        en: 'Define signals-to-watch for each scenario',
      },
      explanation: {
        pl: 'Do każdego scenariusza dopiszcie obserwowalne sygnały, które powiedzą wam wcześnie, w którą przyszłość wchodzicie — to zamienia opowieść w radar.',
        en: 'For each scenario, attach observable signals that tell you early which future you are entering — that turns a story into a radar.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zważyć scenariusze wg wpływu na dzisiejszą decyzję',
        en: 'Weight scenarios by impact on today’s decision',
      },
      explanation: {
        pl: 'Oszacujcie prawdopodobieństwo każdego scenariusza (1-5) i zapytajcie, który realnie zmieniłby to, co robicie dziś — tylko ten wart jest planu awaryjnego.',
        en: 'Estimate each scenario’s likelihood (1-5) and ask which would actually change what you do today — only that one earns a contingency plan.',
      },
    },
    {
      rung: 'response-capability',
      title: {
        pl: 'Przygotować gotową reakcję na scenariusz skrajny',
        en: 'Pre-commit a response to the stress scenario',
      },
      explanation: {
        pl: 'Zdecydujcie na zimno, co zrobicie w scenariuszu skrajnym i sprawdźcie, czy macie zdolność uruchomić to na czas — decyzja podjęta wcześniej bije decyzję w panice.',
        en: 'Decide cold what you will do in the stress scenario and check you can execute it in time — a decision made in advance beats one made in panic.',
      },
    },
  ],
};
