/**
 * Tool Pack — SMED Planner (operational, Shingo changeover-reduction discipline).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/smedplanner/changeoverEngine.ts` (baza internal/external minut,
 *   ranking 4 faz Shingo, sekwencja ruchów W2)
 * - `src/config/smedplanner/smedQuestionBank.ts` (4-poziomowa drabinka: klasyfikacja
 *   → dowód → kwantyfikacja → ryzyko i zdolności, z wymuszoną pętlą klasyfikacji)
 * - `src/config/smedplanner/deepeningLadder.ts` (drabinka pogłębiająca per faza)
 * - `src/config/smedplanner/conclusionPrompts.ts` (kontrakt promptu konkluzji)
 * - `src/store/useToolStore.ts` SMED_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 *
 * Id faz są ZGODNE z runtime: context/changeover-steps/improvements/summary
 * (src/store/useToolStore.ts:1917-1954, SMED_STEPS). SMED jest narzędziem
 * OPERACYJNYM (przepływ/value stream), krótszym niż Dynamic SWOT: kontekst →
 * kroki przezbrojenia → usprawnienia → podsumowanie. Wewnętrznie silnik niesie
 * cztery fazy Shingo (separate/convert/streamline/standardize) jako wymiar
 * rankingu wewnątrz kroku "improvements", nie jako osobne fazy runtime.
 */

import { type ToolPack } from '../contract';

export const smedPlannerPack: ToolPack = {
  toolType: 'smed-planner',
  displayName: { pl: 'SMED Planner', en: 'SMED Planner' },
  category: 'operational',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/smedplanner/changeoverEngine.ts', verifiableInRepo: true },
    { source: 'src/config/smedplanner/smedQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/smedplanner/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/smedplanner/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (SMED_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Shigeo Shingo — SMED (Single-Minute Exchange of Die), Toyota Production System',
      verifiableInRepo: false,
      note: 'SMED jest udokumentowaną metodą Shigeo Shingo (TPS). Repo nie zawiera pliku źródłowego z licencją/atrybucją metody — nie zgadujemy statusu prawnego. Nie pisać "darmowe".',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Planer skracania przezbrojeń wg SMED (Shingo), który rozdziela czynności wewnętrzne od zewnętrznych i sekwencjonuje usprawnienia w porządku separuj→przenieś→skróć→ustandaryzuj.',
      en: 'A changeover-reduction planner per SMED (Shingo) that splits internal from external work and sequences improvements in separate→convert→streamline→standardize order.',
    },
    whatItIsNot: {
      pl: 'To nie jest lista życzeń „szybsze przezbrojenia" ani ogólny audyt OEE. Czynność niesklasyfikowana jako wewnętrzna/zewnętrzna z podanym powodem nie wchodzi do rankingu ani sekwencji ruchów.',
      en: 'It is not a "faster changeovers" wishlist or a general OEE audit. A step not classified internal/external with a stated reason does not enter the ranking or move sequence.',
    },
    whenToUse: {
      pl: 'Gdy przezbrojenie/zmiana narzędzia zabiera istotny czas produkcyjny i macie dostęp do obserwacji realnego przezbrojenia (nie tylko dokumentacji).',
      en: 'When changeover/tool-change time eats significant production capacity and you can observe a real changeover (not just documentation).',
    },
    whenNotToUse: {
      pl: 'Gdy przestój wynika z awarii lub braku materiału, nie z samego przezbrojenia — to inny problem operacyjny (użyj A3).',
      en: 'When downtime comes from breakdowns or material shortage, not the changeover itself — that is a different operational problem (use A3).',
    },
    whyItMatters: {
      pl: 'Silnik liczy bazę minut wewnętrznych/zewnętrznych deterministycznie i rankinguje fazy Shingo wg dopasowania (atrakcyjność × wykonalność), więc rekomendacja mówi, którą fazę robić najpierw, a nie tylko że „trzeba skrócić przezbrojenia".',
      en: 'The engine computes the internal/external minute baseline deterministically and ranks the Shingo phases by fit (attractiveness × feasibility), so the recommendation says which phase to do first, not just "shorten changeovers".',
    },
    inputsRequired: {
      pl: 'Realne przezbrojenie do zaobserwowania (wideo/stoper), lista kroków z klasyfikacją wewnętrzna/zewnętrzna i — jeśli możliwe — zmierzony czas każdego kroku.',
      en: 'A real changeover to observe (video/stopwatch), a list of steps classified internal/external, and — where possible — a measured duration for each step.',
    },
    roles: {
      pl: 'Kierownik operacyjny/lider linii jako właściciel przezbrojenia, operator wykonujący zmianę narzędzia, inżynier procesu przy konwersji internal→external.',
      en: 'Operations manager/line lead as the changeover owner, the operator performing the tool change, a process engineer for internal→external conversion.',
    },
    outcome: {
      pl: 'Baza minut wewnętrznych/zewnętrznych, ranking faz Shingo z dopasowaniem, sekwencja ruchów (zmierz → przenieś → skróć → ustandaryzuj dopiero po zysku) z trade-offami, kandydaci na inicjatywy.',
      en: 'Internal/external minute baseline, a Shingo phase ranking with fit scores, a move sequence (measure → convert → shorten → standardize only after the gain) with trade-offs, initiative candidates.',
    },
    estimatedEffort: '1 obserwacja przezbrojenia (30-90 min) + 2h sesji analitycznej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Odzyskać zdolność produkcyjną przez rozdzielenie i skrócenie przezbrojenia w zdyscyplinowanej kolejności Shingo, nie przez przypadkowe usprawnienia.',
    en: 'Recover production capacity by separating and shortening changeovers in disciplined Shingo order, not through random improvements.',
  },
  useCases: [
    'Przezbrojenie/zmiana narzędzia zabiera znaczącą część dostępnego czasu maszyny',
    'Rosnąca liczba wariantów produktu wymusza częstsze przezbrojenia',
    'Konkurencyjna presja na mniejsze partie produkcyjne (lot size)',
  ],
  contraindications: [
    'Przestój wynika z awarii lub braku materiału, nie z samego przezbrojenia (użyj A3)',
    'Brak dostępu do obserwacji realnego przezbrojenia — analiza z dokumentacji produkuje zgadywanie',
    'Wolumen przezbrojeń jest znikomy — inwestycja w SMED nie zwróci się',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst przezbrojeń', en: 'Changeover Context' },
      goal: {
        pl: 'Zdefiniować zakres i bazę przezbrojeń objętych analizą.',
        en: 'Define the scope and baseline of changeovers under analysis.',
      },
      whatGoodLooksLike: 'Nazwana linia/maszyna, częstotliwość przezbrojeń i wstępny szacunek łącznego czasu.',
      evidenceToAskFor: 'Ile razy dziennie/tygodniowo następuje to przezbrojenie i jaki jest jego wpływ na wydajność.',
      completionCriterion: 'Zakres i częstotliwość przezbrojenia zaakceptowane przez właściciela linii.',
    },
    {
      id: 'changeover-steps',
      title: { pl: 'Kroki przezbrojenia', en: 'Changeover Steps' },
      goal: {
        pl: 'Sklasyfikować każdy krok jako wewnętrzny/zewnętrzny z podanym powodem i, gdzie możliwe, zmierzonym czasem.',
        en: 'Classify each step internal/external with a stated reason and, where possible, a measured duration.',
      },
      whatGoodLooksLike:
        'Każdy krok ma klasyfikację z powodem będącym realnym ograniczeniem (nie nawykiem) i zmierzony, nie szacowany, czas trwania.',
      evidenceToAskFor:
        'Czy klasyfikacja wewnętrzna wynika z ograniczenia fizycznego/jakościowego, czy z nawyku zespołu; skąd pochodzi liczba minut (stoper/wideo vs pamięć).',
      completionCriterion:
        'Żaden krok nie ma statusu "unclassified-or-assumed" (smedQuestionBank.ts smed-classify-force musi się rozwiązać dla każdego kroku).',
    },
    {
      id: 'improvements',
      title: { pl: 'Usprawnienia', en: 'Improvements' },
      goal: {
        pl: 'Zidentyfikować szybkie wygrane i inwestycje per faza Shingo (separuj/przenieś/skróć/ustandaryzuj).',
        en: 'Identify quick wins and investments per Shingo phase (separate/convert/streamline/standardize).',
      },
      whatGoodLooksLike:
        'Każde usprawnienie przypisane do jednej fazy, z impact/effort i dowodem (pilotaż lub pomiar), nie gołym pomysłem.',
      evidenceToAskFor: 'Jaki dowód lub pilotaż potwierdza, że usprawnienie realnie usuwa czas z przezbrojenia.',
      completionCriterion: 'Co najmniej jedna faza ma kandydatów na usprawnienia (rankSmedPhases ordered.length > 0).',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Zsyntetyzować bazę i ranking w werdykt oraz wygenerować kandydatów na inicjatywy.',
        en: 'Synthesize the baseline and ranking into a verdict and generate initiative candidates.',
      },
      whatGoodLooksLike:
        'Werdykt answer-first wskazujący najsilniejszą dźwignię (fit = atrakcyjność × wykonalność) i pulę minut, jaką obejmuje; sekwencja W2 zmapowana na 3-5 inicjatyw w porządku Shingo.',
      evidenceToAskFor: 'Czy werdykt wynika z rankSmedPhases i computeBaseline, nie z intuicji.',
      completionCriterion: 'Każdy ruch sekwencji W2 przechodzi walidator (rationale + trade-off + odrzucona alternatywa).',
    },
  ],

  questions: [
    {
      id: 'smed-context-frequency',
      phaseId: 'context',
      prompt: {
        pl: 'Jak często zachodzi to przezbrojenie i jaki jest jego łączny wpływ na dostępny czas maszyny w skali roku?',
        en: 'How often does this changeover happen, and what is its total impact on available machine time per year?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć „często" bez liczby — bez częstotliwości nie da się policzyć rocznego kosztu przezbrojenia ani uzasadnić priorytetu SMED nad innymi inicjatywami.',
    },
    {
      id: 'smed-step-classification',
      phaseId: 'changeover-steps',
      prompt: {
        pl: 'Czy ta czynność dzieje się przy zatrzymanej maszynie (wewnętrzna), czy mogłaby biec w trakcie pracy (zewnętrzna) — i jaki jest powód klasyfikacji?',
        en: 'Does this step happen with the machine stopped (internal), or could it run while producing (external) — and what is the reason for the classification?',
      },
      answerType: 'choice',
      challengeRule:
        'Krok wewnętrzny zaklasyfikowany bez podanego powodu jest niebezpieczny — silnik traktuje go jako "unclassified-or-assumed" i wymusza sklasyfikowanie w pętli, zanim jakikolwiek pomiar wejdzie do rankingu (smedQuestionBank.ts smed-classify-force). Klasyfikacja bez powodu jest zwykle nawykiem, nie ograniczeniem fizycznym.',
      followUpProbes: ['Czy klasyfikacja przetrwałaby sceptycznego inżyniera pytającego „dlaczego nie w trakcie pracy?"'],
    },
    {
      id: 'smed-quant-source',
      phaseId: 'changeover-steps',
      prompt: {
        pl: 'Skąd pochodzi liczba minut tego kroku — pomiar stoperem/wideo, czy szacunek z pamięci?',
        en: 'Where does this step\'s minute figure come from — stopwatch/video measurement, or an estimate from memory?',
      },
      answerType: 'evidence',
      challengeRule:
        'Szacunek z pamięci musi być jawnie oznaczony jako "estimated", nigdy prezentowany jako zmierzony — inaczej ranking faz optymalizuje zgadywankę (changeoverEngine.ts measuredRatio).',
    },
    {
      id: 'smed-improvement-capability',
      phaseId: 'improvements',
      prompt: {
        pl: 'Jeśli przeniesiesz lub skrócisz ten krok, jakiej zdolności brakuje (oprzyrządowanie, szkolenie, bufor), by zrobić to bez podniesienia ryzyka braku jakości?',
        en: 'If you convert or shorten this step, what capability is missing (tooling, training, a buffer) to do it without raising quality risk?',
      },
      answerType: 'text',
      challengeRule:
        'Konwersja lub skrócenie bez nazwanej brakującej zdolności to ryzykowna zmiana bez zabezpieczenia — silnik trzyma taki krok za pomiarem, dopóki brakująca zdolność nie jest nazwana (smedQuestionBank.ts smed-risk-entry).',
    },
    {
      id: 'smed-owner-sustain',
      phaseId: 'summary',
      prompt: {
        pl: 'Kto utrzyma ten zysk po wdrożeniu (standard, macierz kompetencji) i jak wychwycicie odchylenie, zanim czas przezbrojenia znów urośnie?',
        en: 'Who sustains this gain after implementation (the standard, the training matrix), and how will you catch drift before the changeover time creeps back up?',
      },
      answerType: 'text',
      challengeRule:
        'Bez nazwanego właściciela i pętli kontroli odchylenia zysk SMED eroduje w kilka miesięcy — standaryzacja bez tej odpowiedzi zamraża zysk, za który nikt nie odpowiada (smedQuestionBank.ts smed-risk-owner).',
    },
  ],

  classificationRules:
    'Krok jest INTERNAL (wewnętrzny) lub EXTERNAL (zewnętrzny) — wewnętrzny wymaga zatrzymanej maszyny. ' +
    'Potencjał usprawnienia kroku: "convertible" (da się przenieść na zewnętrzny), "shortenable" (musi ' +
    'zostać wewnętrzny, ale da się skrócić) lub "fixed". Krok bez klasyfikacji z powodem jest ' +
    '"unclassified-or-assumed" i blokuje ranking (changeoverEngine.ts, smedQuestionBank.ts).',
  evidenceExpectations:
    'Każdy krok ma flagę measured=true tylko gdy durationMinutes pochodzi z pomiaru (stoper/wideo/log), ' +
    'nie z pamięci. measuredRatio < 0.5 wymusza ruch "measure-first" przed jakąkolwiek inwestycją w ' +
    'oprzyrządowanie (buildW2MoveSequence).',
  relationships:
    'Cztery fazy Shingo tworzą uporządkowaną sekwencję zależności: separuj (co jest wewnętrzne) → przenieś ' +
    '(convertible internal→external) → skróć (shortenable) → ustandaryzuj (zabezpiecz zysk). Ranking rankSmedPhases ' +
    'sortuje fazy wg fit (atrakcyjność × wykonalność), ale przy remisie wraca do porządku Shingo, nigdy nie ' +
    'rekomenduje standaryzacji przed powstaniem zysku.',
  interpretationRules:
    'Czytaj bazę (internalMinutes/externalMinutes/convertibleMinutes) razem z rankingiem, nie osobno: wysoki ' +
    'convertibleMinutes bez ruchu w fazie "convert" to przeoczona najtańsza dźwignia. Niski measuredRatio ' +
    'podważa wiarygodność każdej innej liczby w analizie — silnik zawsze surowo to nazywa jako pierwszy ruch.',
  completionCriteria:
    'Sekwencja W2 jest kompletna, gdy: (1) co najmniej jedna faza ma kandydatów na usprawnienia; (2) każdy ' +
    'krok ma jawną klasyfikację internal/external; (3) każdy ruch W2 przechodzi walidator (rationale + ' +
    'trade-off + odrzucona alternatywa, changeoverEngine.ts validateW2Move).',

  signatureArchetype: 'flow-value-stream',
  signatureRationale:
    'SMED jest z natury przepływem czasu przez etapy przezbrojenia (separuj→przenieś→skróć→ustandaryzuj), ' +
    'nie polem 2×2 ani łańcuchem przyczynowym — geometria musi pokazywać oś czasu z podziałem internal/ ' +
    'external i punkty konwersji, jak w klasycznym value-stream mapie.',

  mapping: {
    output:
      'Niezmienny snapshot: baza minut internal/external/convertible, ranking faz Shingo z fit-score, ' +
      'sekwencja ruchów W2 z trade-offami, jawnie oznaczone szacunki niezmierzone.',
    report:
      'Sekcja doskonałości operacyjnej: oś czasu przezbrojenia jako grafika sygnaturowa + sekwencja ' +
      'usprawnień jako narracja zmierz→przenieś→skróć→ustandaryzuj. Renderowane deterministycznie.',
    initiative:
      'Sekwencja W2 (buildW2MoveSequence) mapuje się na kandydatów inicjatyw zachowujących kolejność: ' +
      '[measure-first jeśli słabo zmierzone] → faza wiodąca → convert (jeśli ma zakres) → standardize.',
  },

  conclusion: {
    k1FactSource:
      'smedplanner/changeoverEngine.computeBaseline + rankSmedPhases — internalMinutes/externalMinutes/ ' +
      'convertibleMinutes/measuredRatio i fit-score per faza liczone deterministycznie z kroków sesji. ' +
      'Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie kroki przezbrojenia i usprawnienia tej sesji. Zakaz benchmarków branżowych czasu ' +
      'przezbrojenia spoza wsadu — porównanie z „typowym SMED" bez danych sesji jest zabronione.',
    k3PrioritySource:
      'Kolejność z sekwencji W2 silnika (buildW2MoveSequence), trzymająca porządek Shingo z remisami ' +
      'łamanymi wg kolejności separate→convert→streamline→standardize. Model formułuje treść, nie kolejność.',
    k4EffectRule:
      'Efekt musi być odzyskiem minut przestoju lub wzrostem OEE, z horyzontem czasowym i punktem sprawdzenia ' +
      'wobec linii bazowej. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i odrzuconą alternatywę (changeoverEngine.ts W2MoveInput). ' +
      'Standaryzacja przed potwierdzonym zyskiem jest zawsze jawnie odrzucanym wariantem.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/smedplanner',
    questionBankModule: 'src/config/smedplanner/smedQuestionBank.ts',
    expectedQuestionNodeCount: 7,
    bankBackedPhaseIds: ['changeover-steps', 'improvements'],
    rendererComponent: 'src/components/DiscoveryTools/tools/Operational',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'SMED (Single-Minute Exchange of Die)',
    commonlyAttributedTo: 'Shigeo Shingo / Toyota Production System',
    sourceUsed: 'src/config/smedplanner/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Metoda ma nazwanego twórcę (Shingo), a repo nie zawiera ŻADNEGO cytowania — nie wolno prezentować jako wolnej od licencji.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'Metoda z nazwanym autorem i zerową atrybucją w repo — najwyższy priorytet do wyjaśnienia w grupie operacyjnej.',
  },
};
