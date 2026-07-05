/**
 * A3 Problem Solving — deepening ladder (drabinka pogłębiająca)
 *
 * Clones the Ansoff `deepeningLadder` pattern (src/config/ansoff/deepeningLadder.ts)
 * but encodes the A3-specific "insight staircase": each of the three analytical
 * sections of an A3 (problem → root-cause → countermeasures) is deepened along
 * the same four rungs, so the synthesis engine can reason about evidence discipline:
 *
 *   1. surface          — what is claimed / observed on the surface?
 *   2. evidence         — what proof (data, gemba, measurement) backs the claim?
 *   3. quantification   — how big is it in numbers (gap, cost, frequency)?
 *   4. risk-capability  — what must be true / what capability is needed to act?
 *
 * The rungs form the "insight staircase — skąd wniosek": a countermeasure is only
 * signed off when it can be traced down the ladder to a quantified, evidenced root
 * cause of a quantified problem. Content is partner-grade and bilingual (PL/EN).
 */

/** The A3 analytical sections that carry a deepening ladder (context/summary excluded). */
export type A3SectionId = 'problem' | 'root-cause' | 'countermeasures';

export const A3_SECTIONS: A3SectionId[] = ['problem', 'root-cause', 'countermeasures'];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and section-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'risk-capability';
  /** 1-4 depth level (surface..risk) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing (evidence discipline). */
  rationale: Bilingual;
}

/** The four canonical rungs shared by every section, with section-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const A3_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-section deepening ladder. Each section has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const A3_DEEPENING_LADDER: Record<A3SectionId, LadderRung[]> = {
  problem: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co konkretnie jest problemem — gdzie, kiedy i kogo dotyka, w kategoriach obserwowalnych, nie odczuć?',
        en: 'What exactly is the problem — where, when, and whom does it hit, in observable terms, not feelings?',
      },
      rationale: {
        pl: 'A3 rozpada się, gdy „problem" jest opinią. Najpierw nazwijcie stan faktyczny, który da się pokazać na gemba.',
        en: 'An A3 collapses when the "problem" is an opinion. First name a factual state you can show at the gemba.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest twardy dowód, że to się dzieje (dane, pomiar, obserwacja z gemba), a nie tylko wrażenie zespołu?',
        en: 'What is the hard evidence this happens (data, measurement, gemba observation), not just a team impression?',
      },
      rationale: {
        pl: 'Bez dowodu problem jest hipotezą. Dowód oddziela realny defekt od anegdoty, którą łatwo zbagatelizować.',
        en: 'Without evidence the problem is a hypothesis. Evidence separates a real defect from a dismissible anecdote.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak duża jest luka między stanem obecnym a docelowym w liczbach (częstotliwość × koszt × czas)?',
        en: 'How big is the gap between current and target state in numbers (frequency × cost × time)?',
      },
      rationale: {
        pl: 'Niepoliczony problem nie ma priorytetu ani celu. Liczba luki jest jedynym uczciwym kryterium sukcesu A3.',
        en: 'An unquantified problem has neither priority nor a target. The gap number is the only honest success criterion of an A3.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co grozi, jeśli tego nie ruszycie, i czy w ogóle macie dane, by ten problem monitorować?',
        en: 'What is at risk if you leave it, and do you even have the data to keep monitoring this problem?',
      },
      rationale: {
        pl: 'Problem bez konsekwencji zaniechania nie zasługuje na A3. Brak danych do pomiaru to pierwszy defekt do usunięcia.',
        en: 'A problem with no cost of inaction does not deserve an A3. Missing measurement data is the first defect to remove.',
      },
    },
  ],
  'root-cause': [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaka jest pierwsza, najbardziej oczywista przyczyna — i dlaczego to jeszcze NIE jest przyczyna źródłowa?',
        en: 'What is the first, most obvious cause — and why is it NOT yet the root cause?',
      },
      rationale: {
        pl: 'Pierwsze „dlaczego" prawie zawsze wskazuje objaw. A3 wymaga zejścia głębiej, nie zatrzymania na winnym.',
        en: 'The first "why" almost always names a symptom. An A3 demands going deeper, not stopping at a culprit.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Który łańcuch 5×Why jest poparty dowodem na każdym kroku, a gdzie przeskakujecie na domysł?',
        en: 'Which 5-Why chain is backed by evidence at each step, and where do you jump to a guess?',
      },
      rationale: {
        pl: 'Łańcuch przyczyn jest tak mocny jak jego najsłabsze ogniwo. Ogniwo bez dowodu to hipoteza do potwierdzenia.',
        en: 'A cause chain is only as strong as its weakest link. A link without evidence is a hypothesis to confirm.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaka część luki problemu (w %) odpowiada tej przyczynie — czy usunięcie jej realnie zamyka lukę?',
        en: 'What share of the problem gap (in %) does this cause explain — would removing it actually close the gap?',
      },
      rationale: {
        pl: 'Przyczyna, która tłumaczy 5% luki, to nie przyczyna źródłowa. Kwantyfikacja chroni przed kosmetycznymi środkami.',
        en: 'A cause explaining 5% of the gap is not the root cause. Quantification guards against cosmetic countermeasures.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy przyczyna leży w procesie, narzędziu, umiejętności czy zachęcie — bo każdy korzeń wymaga innego ruchu?',
        en: 'Is the cause in process, tooling, skill, or incentive — because each root demands a different move?',
      },
      rationale: {
        pl: 'Mylna klasyfikacja korzenia kieruje środek zaradczy w złe miejsce: szkolenie tam, gdzie problemem jest proces.',
        en: 'Misclassifying the root aims the countermeasure at the wrong place: training where the problem is the process.',
      },
    },
  ],
  countermeasures: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki środek zaradczy proponujecie i którą konkretnie przyczynę źródłową on adresuje?',
        en: 'Which countermeasure do you propose and exactly which root cause does it address?',
      },
      rationale: {
        pl: 'Środek bez wskazanego korzenia to życzenie. Każdy countermeasure musi mieć jawny adres w drabinie przyczyn.',
        en: 'A countermeasure with no named root is a wish. Every countermeasure needs an explicit address in the cause ladder.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód lub pilotaż, że ten środek realnie usuwa przyczynę, a nie tylko maskuje objaw?',
        en: 'What evidence or pilot proves this countermeasure actually removes the cause, not just masks the symptom?',
      },
      rationale: {
        pl: 'Środek bez dowodu skuteczności to zakład. Mały test przed pełnym wdrożeniem odbiera ryzyko przepalenia.',
        en: 'A countermeasure without proof of effect is a bet. A small test before full rollout de-risks the burn.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'O ile ten środek zamknie policzoną lukę i jaki jest jego koszt oraz czas wdrożenia?',
        en: 'By how much will this countermeasure close the quantified gap, and what is its cost and lead time?',
      },
      rationale: {
        pl: 'Bez policzonego efektu nie da się uszeregować środków wg impact×effort ani obiecać rezultatu zarządowi.',
        en: 'Without a computed effect you cannot rank countermeasures by impact×effort nor promise a result to the board.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Kto jest właścicielem środka, jak zmierzycie jego utrzymanie i co robicie, jeśli nie zadziała?',
        en: 'Who owns the countermeasure, how will you measure its sustainment, and what if it does not work?',
      },
      rationale: {
        pl: 'Środek bez właściciela i planu weryfikacji cofa się do stanu wyjściowego — najczęstsza porażka A3.',
        en: 'A countermeasure with no owner and no verification plan regresses to baseline — the most common A3 failure.',
      },
    },
  ],
};

export interface SectionProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per section. Consumed when AI (or the offline
 * fallback) proposes candidate A3 items. Mirrors Ansoff's ANSOFF_PROPOSAL_BANK.
 */
export const A3_PROPOSAL_BANK: Record<A3SectionId, SectionProposal[]> = {
  problem: [
    {
      rung: 'surface',
      title: {
        pl: 'Opisać problem jako odchylenie od standardu, nie jako winę',
        en: 'State the problem as a deviation from standard, not as blame',
      },
      explanation: {
        pl: 'Zamiast „zespół się nie wyrabia" nazwijcie odchylenie: „czas realizacji X przekracza standard Y w Z% przypadków" — to da się zmierzyć i zamknąć.',
        en: 'Instead of "the team is behind", name the deviation: "lead time X exceeds standard Y in Z% of cases" — measurable and closable.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Pokazać problem na gemba, nie w prezentacji',
        en: 'Show the problem at the gemba, not in a slide',
      },
      explanation: {
        pl: 'Jedna obserwacja w miejscu pracy z policzonym defektem jest mocniejszym dowodem niż szacunki zebrane na spotkaniu.',
        en: 'One shop-floor observation with a counted defect is stronger evidence than estimates gathered in a meeting.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zmierzyć lukę current→target zanim ruszycie przyczyny',
        en: 'Measure the current→target gap before chasing causes',
      },
      explanation: {
        pl: 'Luka w liczbach (częstotliwość × koszt × czas) ustawia cel A3 i pozwala odrzucić środki, które jej nie ruszają.',
        en: 'The gap in numbers (frequency × cost × time) sets the A3 target and lets you reject countermeasures that do not move it.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Nazwać koszt zaniechania, żeby uzasadnić priorytet',
        en: 'Name the cost of inaction to justify priority',
      },
      explanation: {
        pl: 'Problem konkuruje o zasoby z innymi; policzony koszt „nic-nie-robienia" jest najsilniejszym argumentem za jego podjęciem.',
        en: 'A problem competes for resources; a computed cost of "doing nothing" is the strongest case for tackling it.',
      },
    },
  ],
  'root-cause': [
    {
      rung: 'surface',
      title: {
        pl: 'Odróżnić objaw od przyczyny na pierwszym „dlaczego"',
        en: 'Separate symptom from cause at the first "why"',
      },
      explanation: {
        pl: 'Pierwsza odpowiedź prawie zawsze jest objawem; świadome zapytanie „dlaczego to się dzieje" jeszcze raz otwiera realny łańcuch.',
        en: 'The first answer is almost always a symptom; deliberately asking "why does that happen" again opens the real chain.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Sprawdzić dowód na każdym kroku 5×Why',
        en: 'Verify evidence at every step of the 5-Why',
      },
      explanation: {
        pl: 'Łańcuch bez dowodu na ogniwie jest zgadywaniem; oznaczcie ogniwa niepewne jako hipotezy do potwierdzenia w danych.',
        en: 'A chain with an unproven link is guessing; flag uncertain links as hypotheses to confirm in the data.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Przypisać przyczynom udział w luce (%)',
        en: 'Attribute a share of the gap (%) to each cause',
      },
      explanation: {
        pl: 'Rozbicie luki na przyczyny (Pareto) pokazuje, który korzeń realnie ją zamyka, a który jest kosmetyką.',
        en: 'Splitting the gap across causes (Pareto) shows which root actually closes it and which is cosmetic.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Sklasyfikować korzeń: proces / narzędzie / umiejętność / zachęta',
        en: 'Classify the root: process / tooling / skill / incentive',
      },
      explanation: {
        pl: 'Klasyfikacja korzenia wybiera typ środka: proces→standard, narzędzie→poka-yoke, umiejętność→szkolenie, zachęta→zmiana miary.',
        en: 'Classifying the root picks the countermeasure type: process→standard, tooling→poka-yoke, skill→training, incentive→metric change.',
      },
    },
  ],
  countermeasures: [
    {
      rung: 'surface',
      title: {
        pl: 'Powiązać każdy środek z jedną przyczyną źródłową',
        en: 'Link every countermeasure to one root cause',
      },
      explanation: {
        pl: 'Środek bez adresu w drabinie przyczyn to życzenie; jawne powiązanie pozwala odrzucić działania nietrafione.',
        en: 'A countermeasure with no address in the cause ladder is a wish; an explicit link lets you reject off-target actions.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zwaliduj środek małym pilotażem przed skalą',
        en: 'Validate the countermeasure with a small pilot before scaling',
      },
      explanation: {
        pl: 'Pilotaż na jednym stanowisku lub linii daje dowód skuteczności taniej niż pełne wdrożenie, które trzeba by cofać.',
        en: 'A pilot on one station or line proves effect cheaper than a full rollout you would have to reverse.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć, o ile środek zamyka lukę i ile kosztuje',
        en: 'Compute how much the countermeasure closes the gap and its cost',
      },
      explanation: {
        pl: 'Efekt × koszt × czas to jedyna podstawa, by uszeregować środki i obiecać zarządowi mierzalny rezultat.',
        en: 'Effect × cost × time is the only basis to rank countermeasures and promise the board a measurable result.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przypisać właściciela i plan weryfikacji utrzymania',
        en: 'Assign an owner and a sustainment verification plan',
      },
      explanation: {
        pl: 'Bez właściciela i harmonogramu sprawdzania środek cofa się do stanu wyjściowego — zaplanujcie kto, kiedy i jak mierzy.',
        en: 'Without an owner and a check schedule the countermeasure regresses to baseline — plan who, when, and how it is measured.',
      },
    },
  ],
};
