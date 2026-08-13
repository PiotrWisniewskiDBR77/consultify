/**
 * Tool Pack — A3 Problem Solving (operational, Toyota/Lean root-cause discipline).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/a3problemsolving/a3CausalEngine.ts` (deterministyczny łańcuch 5×Why:
 *   symptom vs candidate-root vs root, gate W2 dla przeciwśrodków)
 * - `src/config/a3problemsolving/a3QuestionBank.ts` (7-krokowa drabina pytań:
 *   background/current-state/target/root-cause/countermeasures/plan/follow-up)
 * - `src/config/a3problemsolving/a3InsightStaircase.ts` (fakt→interpretacja→implikacja,
 *   dekompozycja tez parasolowych)
 * - `src/config/a3problemsolving/deepeningLadder.ts` (drabinka pogłębiająca 4 rungi ×
 *   3 sekcje: problem/root-cause/countermeasures)
 * - `src/config/a3problemsolving/moveValidator.ts` (ocena gotowości A3 + sekwencja W2)
 * - `src/config/a3problemsolving/conclusionPrompts.ts` (kontrakt promptu konkluzji)
 * - `src/store/useToolStore.ts` A3_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 *
 * Id faz są ZGODNE z runtime: context/problem/root-cause/countermeasures/summary
 * (src/store/useToolStore.ts:1869-1915, A3_STEPS). A3 jest narzędziem OPERACYJNYM,
 * krótszym niż Dynamic SWOT (4 fazy zamiast 5): kontekst → opis problemu →
 * przyczyna źródłowa → środki zaradcze → podsumowanie. Wewnętrznie silnik i q-bank
 * niosą bogatszą, 7-krokową metodykę A3 (background/current-state/target/
 * root-cause/countermeasures/plan/follow-up) — pack mapuje tę metodykę na
 * 4 fazy runtime, nie wymyśla nowej.
 */

import { type ToolPack } from '../contract';

export const a3ProblemSolvingPack: ToolPack = {
  toolType: 'a3-problem-solving',
  displayName: { pl: 'A3 Problem Solving', en: 'A3 Problem Solving' },
  category: 'operational',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna, silnik istnieje i jest przetestowalny; runtime DoD (Output/
  // Report/approval) jeszcze nie dowieziony — rozdział pojęć wg decyzji
  // właściciela 2026-08-13.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/a3problemsolving/a3CausalEngine.ts', verifiableInRepo: true },
    { source: 'src/config/a3problemsolving/a3QuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/a3problemsolving/a3InsightStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/a3problemsolving/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/a3problemsolving/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/a3problemsolving/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (A3_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Toyota Production System / Shigeo Shingo — geneza metody A3 (8-Step Practical Problem Solving)',
      verifiableInRepo: false,
      note: 'Rodowód metody spoza repo (TPS/Toyota, spopularyzowany przez Johna Shooka). Brak w repo pliku źródłowego z licencją/atrybucją — nie zgadujemy statusu prawnego.',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Zdyscyplinowana ścieżka rozwiązywania problemu, która kończy się usuniętą przyczyną źródłową, a nie listą pomysłów na poprawę.',
      en: 'A disciplined problem-solving path that ends with a removed root cause, not a list of improvement ideas.',
    },
    whatItIsNot: {
      pl: 'To nie jest burza mózgów na temat usprawnień ani lista skarg. Objaw bez udowodnionego łańcucha 5×Why nie staje się przyczyną, na którą wolno działać.',
      en: 'It is not a brainstorm of improvements or a list of complaints. A symptom without an evidenced 5-Why chain does not become an actionable cause.',
    },
    whenToUse: {
      pl: 'Gdy masz powtarzalny, mierzalny problem operacyjny (jakość, koszt, dostawa, bezpieczeństwo) i potrzebujesz trwałego, nie tymczasowego rozwiązania.',
      en: 'When you have a recurring, measurable operational problem (quality, cost, delivery, safety) and need a durable fix, not a workaround.',
    },
    whenNotToUse: {
      pl: 'Gdy problem jest w istocie decyzją strategiczną (użyj Dynamic SWOT/Ansoff) albo przyczyna jest już znana i potwierdzona — wtedy od razu planuj wdrożenie.',
      en: 'When the problem is actually a strategic decision (use Dynamic SWOT/Ansoff) or the cause is already known and confirmed — go straight to an implementation plan.',
    },
    whyItMatters: {
      pl: 'Silnik odróżnia deterministycznie objaw od potwierdzonego korzenia (terminalny + sklasyfikowany wymiar + dowód + udział w luce) i blokuje przeciwśrodek bez trade-offu — więc A3 kończy się decyzją, nie listą życzeń.',
      en: 'The engine deterministically separates a symptom from a confirmed root (terminal + classified dimension + evidence + share of gap) and blocks a countermeasure with no trade-off — so the A3 ends in a decision, not a wishlist.',
    },
    inputsRequired: {
      pl: 'Obserwowalny problem z bazą liczbową (częstotliwość × koszt × czas), dostęp do gemba/danych oraz zespół gotowy na 5×Why z dowodem na każdym kroku.',
      en: 'An observable problem with a baseline number (frequency × cost × time), access to gemba/data, and a team willing to run a 5-Why with evidence at every step.',
    },
    roles: {
      pl: 'Właściciel problemu (kierownik operacyjny/lider procesu), zespół wykonawczy znający pracę na miejscu, sponsor z mandatem do wdrożenia przeciwśrodków.',
      en: 'Problem owner (operations manager/process lead), a frontline team that knows the work, a sponsor with the mandate to deploy countermeasures.',
    },
    outcome: {
      pl: 'Potwierdzona przyczyna źródłowa (lub jawnie nazwany brak potwierdzenia), sekwencja przeciwśrodków powstrzymaj→usuń→ustandaryzuj z trade-offem każdego ruchu, kandydaci na inicjatywy.',
      en: 'A confirmed root cause (or an explicitly named lack of confirmation), a contain→eliminate→standardize countermeasure sequence with each move\'s trade-off, and initiative candidates.',
    },
    estimatedEffort: '2-4h sesji roboczej + czas na weryfikację dowodów między sesjami',
    // Metoda z rodowodem TPS/Shingo; brak noty licencyjnej lub atrybucji w repo.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Doprowadzić zespół od objawu do potwierdzonej przyczyny źródłowej i wdrożonego, trwałego przeciwśrodka.',
    en: 'Take the team from a symptom to a confirmed root cause and a deployed, durable countermeasure.',
  },
  useCases: [
    'Powtarzalny defekt jakościowy lub reklamacja klienta',
    'Przewlekłe opóźnienie dostawy albo przestój, którego nikt trwale nie usunął',
    'Incydent bezpieczeństwa wymagający formalnej analizy przyczyn',
  ],
  contraindications: [
    'Decyzja strategiczna, nie operacyjny problem (użyj Dynamic SWOT/Ansoff)',
    'Przyczyna źródłowa jest już potwierdzona danymi — przejdź od razu do planu wdrożenia',
    'Brak dostępu do gemba/danych — sesja wyprodukuje wyłącznie domysły',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst problemu', en: 'Problem Context' },
      goal: {
        pl: 'Zdefiniować problem i jego zakres oraz powiązać go z celem biznesowym.',
        en: 'Define the problem and its scope, and link it to a business objective.',
      },
      whatGoodLooksLike:
        'Problem powiązany z nazwanym celem biznesowym (koszt/jakość/dostawa/bezpieczeństwo), z nazwanym sponsorem.',
      evidenceToAskFor:
        'Do jakiego celu biznesowego problem się mapuje i kto ma mandat, by działać na jego podstawie.',
      completionCriterion: 'Sponsor problemu zaakceptowany, zakres jasno odgraniczony.',
    },
    {
      id: 'problem',
      title: { pl: 'Opis problemu', en: 'Problem Statement' },
      goal: {
        pl: 'Opisać problem jako obserwowalne, udowodnione i policzone odchylenie od standardu.',
        en: 'Describe the problem as an observable, evidenced, quantified deviation from standard.',
      },
      whatGoodLooksLike:
        'Odchylenie current→target w liczbach (częstotliwość × koszt × czas), poparte danymi lub bezpośrednią obserwacją gemba, nie wrażeniem zespołu.',
      evidenceToAskFor: 'Twardy dowód: dane, pomiar lub obserwacja z gemba za każdym twierdzeniem.',
      completionCriterion: 'Co najmniej jedna pozycja problemu z policzoną luką i statusem dowodu.',
    },
    {
      id: 'root-cause',
      title: { pl: 'Przyczyna źródłowa', en: 'Root Cause' },
      goal: {
        pl: 'Przeprowadzić udowodnione 5×Why i odróżnić objaw od potwierdzonego korzenia.',
        en: 'Run an evidenced 5-Why and separate symptom from a confirmed root.',
      },
      whatGoodLooksLike:
        'Łańcuch przyczyn bez cykli/osieroconych ogniw, każde ogniwo z dowodem; korzeń terminalny, sklasyfikowany (proces/narzędzie/umiejętność/zachęta) i tłumaczący ≥50% luki (a3CausalEngine.ts MIN_ROOT_GAP_SHARE).',
      evidenceToAskFor:
        'Dla każdego ogniwa: czy istnieje głębsze „dlaczego", jaki dowód je potwierdza i jaki udział luki tłumaczy.',
      completionCriterion:
        'assessRootCause zwraca hasConfirmedRoot=true (dokładnie jeden potwierdzony korzeń, brak nierozwiązanych problemów strukturalnych łańcucha) lub jawnie nazwany brak potwierdzenia.',
    },
    {
      id: 'countermeasures',
      title: { pl: 'Środki zaradcze', en: 'Countermeasures' },
      goal: {
        pl: 'Zaproponować przeciwśrodki adresujące potwierdzony korzeń, każdy z trade-offem.',
        en: 'Propose countermeasures targeting the confirmed root, each with a trade-off.',
      },
      whatGoodLooksLike:
        'Sekwencja: powstrzymaj (tymczasowo) → [zwaliduj, jeśli korzeń słabo udowodniony] → usuń korzeń → ustandaryzuj; każdy ruch z rationale, trade-offem (chosen/deferred/cost) i odrzuconą alternatywą (validateCountermeasure).',
      evidenceToAskFor:
        'Do której przyczyny (nie objawu) odnosi się przeciwśrodek i co świadomie odrzucacie wybierając go.',
      completionCriterion:
        'Każdy przyjęty przeciwśrodek przechodzi walidator W2 (rationale + linkedCauseIds do realnej przyczyny + kompletny trade-off + odrzucona alternatywa).',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Zsyntetyzować A3 w werdykt z rationale i wygenerować kandydatów na inicjatywy.',
        en: 'Synthesize the A3 into a verdict with rationale and generate initiative candidates.',
      },
      whatGoodLooksLike:
        'Werdykt answer-first wskazujący, którą przyczynę usunąć najpierw i dlaczego; sekwencja W2 zmapowana na 3-5 inicjatyw zachowujących kolejność (order = priorytet).',
      evidenceToAskFor: 'Czy werdykt wynika z ocenionej gotowości A3 (assessA3) i sekwencji ruchów, nie z domysłu.',
      completionCriterion:
        'A3 jest sygnowalne: staircaseComplete=true (problem, root-cause, countermeasures niepuste) i każdy ruch przeszedł bramkę W2.',
    },
  ],

  questions: [
    {
      id: 'a3-context-link',
      phaseId: 'context',
      prompt: {
        pl: 'Czy ten problem jest powiązany z celem biznesowym, na którym komuś zależy (koszt, jakość, dostawa, bezpieczeństwo), czy to odosobniona uciążliwość?',
        en: 'Is this problem tied to a business objective people care about (cost, quality, delivery, safety), or is it an isolated annoyance?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez nazwanego celu biznesowego lub sponsora — A3 bez mandatu umiera przy pierwszym konkurencyjnym priorytecie (a3QuestionBank.ts bg1-link/bg2-sponsor).',
      followUpProbes: [
        'Kto jest właścicielem tego bólu i ma władzę wdrożyć przeciwśrodki?',
        'Dokończ zdanie: „Jeśli tego nie rozwiążemy, biznes traci ___".',
      ],
    },
    {
      id: 'a3-problem-observable',
      phaseId: 'problem',
      prompt: {
        pl: 'Czy umiecie opisać stan obecny jako obserwowalny fakt z liczbą bazową (częstotliwość × koszt × czas), czy tylko jako odczucie, że „jest źle"?',
        en: 'Can you describe the current state as an observable fact with a baseline number (frequency × cost × time), or only as a feeling that "things are bad"?',
      },
      answerType: 'evidence',
      challengeRule:
        'Problem bez liczby bazowej nie ma celu ani priorytetu — oznacz jako „do ustalenia (gdzie/kiedy)", nigdy nie wymyślaj liczby (a3QuestionBank.ts cs3-baseline).',
    },
    {
      id: 'a3-root-cause-symptom-trap',
      phaseId: 'root-cause',
      prompt: {
        pl: 'Czy wasza obecna odpowiedź to objaw (to, co widać), czy zeszliście do przyczyny terminalnej, sklasyfikowanej i udowodnionej?',
        en: 'Is your current answer a symptom (the thing you see), or have you reached a cause that is terminal, classified and evidenced?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        '„Root cause" tłumacząca tylko 5% luki, bez klasyfikacji wymiaru (proces/narzędzie/umiejętność/zachęta) albo bez dowodu, to wciąż tylko candidate-root — silnik (a3CausalEngine.classifyCauseRole) odmawia jej statusu root, dopóki nie spełni wszystkich trzech warunków naraz.',
    },
    {
      id: 'a3-countermeasure-tradeoff',
      phaseId: 'countermeasures',
      prompt: {
        pl: 'Co świadomie odpuszczacie, wybierając ten przeciwśrodek, i którą przyczynę źródłową (nie objaw) on usuwa?',
        en: 'What are you deliberately giving up by choosing this countermeasure, and which root cause (not symptom) does it remove?',
      },
      answerType: 'text',
      challengeRule:
        'Przeciwśrodek bez wskazanej przyczyny źródłowej maskuje objaw; bez pełnego trade-offu (chosen/deferred/cost) i odrzuconej alternatywy nie przechodzi bramki W2 (moveValidator.ts validateCountermeasure).',
    },
    {
      id: 'a3-followup-measure',
      phaseId: 'summary',
      prompt: {
        pl: 'Jak zmierzycie, czy przeciwśrodek realnie zamknął lukę, i kto utrzyma standard, by efekt nie cofnął się do stanu wyjściowego?',
        en: 'How will you measure whether the countermeasure actually closed the gap, and who sustains the standard so the effect does not regress?',
      },
      answerType: 'text',
      challengeRule:
        'A3 zamknięte bez miary domknięcia i bez właściciela standardu to najczęstsza porażka A3 — zespół powtórzy je za kwartał (a3QuestionBank.ts fu1-measure/fu2-sustain).',
    },
  ],

  classificationRules:
    'ROOT wyłącznie gdy ogniwo jest: terminalne (brak głębszego „dlaczego"), sklasyfikowane w wymiarze ' +
    '(process/tools/skills/incentives), udowodnione (evidenceRefs niepuste) ORAZ tłumaczy ≥50% luki ' +
    '(gapShare, jeśli podany). Ogniwo z głębszą przyczyną jest zawsze SYMPTOM. Ogniwo terminalne, ale ' +
    'niespełniające pozostałych warunków, jest CANDIDATE-ROOT (a3CausalEngine.ts classifyCauseRole).',
  evidenceExpectations:
    'Każde ogniwo łańcucha 5×Why ma evidenceRefs lub evidenceNote; brak jednego z nich → status "declared" ' +
    '(deklaracja, niepotwierdzone), nigdy prezentowane jako fakt (evaluateA3ElementEvidence). Tezy parasolowe ' +
    '(„problemy z jakością", „błąd ludzki", „niska efektywność") wymagają dekompozycji na wymiar + finding.',
  relationships:
    'Łańcuch przyczyn jest strukturą drzewa budowaną z parentId — silnik wykrywa cykle, osierocone ogniwa ' +
    'i wiele głów łańcucha jako problemy strukturalne (buildCausalChain issues). Przeciwśrodki łączą się z ' +
    'przyczynami przez linkedCauseIds; odwołanie do nieistniejącego id przyczyny jest błędem "dangling-links".',
  interpretationRules:
    'Czytaj werdykt assessA3, nie surowe pozycje: staircaseComplete=false ujawnia brakującą sekcję (problem/ ' +
    'root-cause/countermeasures); staircaseComplete=true, ale niski evidenceRatio najsłabszej sekcji, wskazuje ' +
    'gdzie wzmocnić dowód przed podpisaniem A3. Sekwencja W2 zawsze trzyma porządek: powstrzymaj → ' +
    '[zwaliduj, jeśli korzeń słabo udowodniony] → usuń korzeń → ustandaryzuj (buildW2MoveSequence).',
  completionCriteria:
    'A3 jest sygnowalne, gdy: (1) staircaseComplete=true — problem, root-cause i countermeasures mają co ' +
    'najmniej jedną pozycję każda; (2) assessRootCause zwraca hasConfirmedRoot=true albo brak potwierdzenia ' +
    'jest jawnie nazwany; (3) każdy przyjęty przeciwśrodek przechodzi validateCountermeasure (rationale + ' +
    'linkedCauseIds + pełny trade-off + odrzucona alternatywa).',

  signatureArchetype: 'causal-problem-solving',
  signatureRationale:
    'A3 jest z natury łańcuchem przyczynowym, nie polem 2×2 ani macierzą — geometria musi pokazywać drabinę ' +
    '5×Why schodzącą od objawu do korzenia, z jawnym rozróżnieniem symptom/candidate-root/root i wychodzącą ' +
    'z niej sekwencją przeciwśrodków, nie cztery niezależne kafelki.',

  mapping: {
    output:
      'Niezmienny snapshot: łańcuch przyczyn z rolami (symptom/candidate-root/root), potwierdzony korzeń ' +
      '(lub jawny brak potwierdzenia), sekwencja przeciwśrodków W2 z trade-offami, jawnie oznaczone hipotezy.',
    report:
      'Sekcja diagnozy operacyjnej: łańcuch 5×Why jako grafika sygnaturowa + sekwencja przeciwśrodków jako ' +
      'narracja powstrzymaj→usuń→ustandaryzuj. Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Sekwencja W2 (buildW2MoveSequence) mapuje się 1:1 na kandydatów inicjatyw zachowujących kolejność ' +
      '(order = priorytet): contain → validate-first (opcjonalnie) → eliminate-root → standardize.',
  },

  conclusion: {
    k1FactSource:
      'a3CausalEngine.buildCausalChain + assessRootCause — rola każdego ogniwa (symptom/candidate-root/root) ' +
      'i status potwierdzenia korzenia liczone deterministycznie z zaakceptowanych ogniw. moveValidator.assessA3 ' +
      'liczy severity/evidenceRatio/score per sekcja. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie ogniwa łańcucha tej sesji, ich dowody i klasyfikacja wymiaru. Zakaz statystyk branżowych ' +
      'spoza wsadu; interpretacja umbrella-claims wymaga dekompozycji z sesji (a3InsightStaircase).',
    k3PrioritySource:
      'Kolejność z sekwencji W2 silnika (buildW2MoveSequence): powstrzymaj → [zwaliduj] → usuń korzeń → ' +
      'ustandaryzuj. Model formułuje treść akcji, nie kolejność ani wybór, który korzeń jest priorytetowy.',
    k4EffectRule:
      'Efekt musi być domknięciem policzonej luki problemu (frequency × cost × time), z horyzontem czasowym ' +
      'i miarą sprawdzenia identyczną z linią bazową. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy przeciwśrodek podaje: chosen/deferred/cost (moveValidator W2MoveInput.tradeoff) oraz odrzuconą ' +
      'alternatywę z powodem. Ruch bez kompletnego trade-offu nie przechodzi walidatora (incomplete-tradeoff).',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/a3problemsolving',
    questionBankModule: 'src/config/a3problemsolving/a3QuestionBank.ts',
    expectedQuestionNodeCount: 18,
    bankBackedPhaseIds: ['problem', 'root-cause', 'countermeasures'],
    rendererComponent: 'src/components/DiscoveryTools/tools/Operational',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'A3 Problem Solving (8-krokowe praktyczne rozwiązywanie problemów)',
    commonlyAttributedTo: 'Toyota Production System; spopularyzowane przez Johna Shooka',
    sourceUsed: 'src/config/a3problemsolving/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: '„A3" i nazwa metody używane opisowo; brak brandingu/logo Toyoty.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'Brak w repo pliku licencji/atrybucji dla samej metody.',
  },
};
