/**
 * Tool Pack — Focus & Trade-offs (opportunity-cost matrix + anti-focus detector).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/focustradeoffs/focusOpportunityCostMatrix.ts` (macierz koszt-alternatywny, detectAntiFocus)
 * - `src/config/focustradeoffs/moveValidator.ts` (score=(value×fit)/effort, ranking, W2)
 * - `src/config/focustradeoffs/focusQuestionBank.ts` (bank pytań per opcja)
 * - `src/config/focustradeoffs/conclusionPrompts.ts` (kontrakt W2)
 * - `src/store/useToolStore.ts` (FOCUS_TRADEOFF_STEPS — id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (mission/input/priorities/insights/outputs).
 */

import { type ToolPack } from '../contract';

export const focusTradeoffPack: ToolPack = {
  toolType: 'focus-tradeoff',
  displayName: { pl: 'Fokus i kompromisy', en: 'Focus & Trade-offs' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/focustradeoffs/focusOpportunityCostMatrix.ts', verifiableInRepo: true },
    { source: 'src/config/focustradeoffs/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/focustradeoffs/focusQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/focustradeoffs/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (FOCUS_TRADEOFF_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Porterowska doktryna "strategy is choosing what not to do" — brak noty licencyjnej w repo',
      verifiableInRepo: false,
      note: 'Koncepcja z domeny publicznej strategii konkurencyjnej; brak potwierdzonego źródła licencyjnego w repo (L10).',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Narzędzie, które zmusza do nazwania, co konkretnie traci na priorytecie, gdy wygrywa inny priorytet — i wykrywa sesję, w której nic nie zostało odrzucone.',
      en: 'A tool that forces you to name exactly which priority loses when another one wins — and detects a session where nothing was actually rejected.',
    },
    whatItIsNot: {
      pl: 'To nie jest lista rzeczy do zrobienia z ocenami. Priorytet bez wskazanego konkretnego kosztu alternatywnego jest życzeniem, nie decyzją.',
      en: 'It is not a scored to-do list. A priority without a named, specific opportunity cost is a wish, not a decision.',
    },
    whenToUse: {
      pl: 'Gdy zasoby są ograniczone, a lista priorytetów rośnie: planowanie kwartału, alokacja zespołu, wybór jednej z konkurujących inicjatyw.',
      en: 'When resources are scarce and the priority list keeps growing: quarterly planning, team allocation, choosing among competing initiatives.',
    },
    whenNotToUse: {
      pl: 'Gdy potrzebny jest rozkład jednej ambicji na wątki (użyj Ambition Decomposer) albo pełna priorytetyzacja portfela z budżetem (użyj Portfolio Priority).',
      en: 'When the task is decomposing one ambition into themes (use Ambition Decomposer) or full portfolio prioritization under a budget (use Portfolio Priority).',
    },
    whyItMatters: {
      pl: 'Silnik flaguje wprost anty-wzorzec: sesję, w której wszystko jest "pursue" i nic nie zostało odłożone lub porzucone — to nie strategia, to lista życzeń z podsumowaniem zarządczym.',
      en: 'The engine directly flags the anti-pattern: a session where everything is "pursue" and nothing was deferred or dropped — that is not a strategy, it is a wishlist with an executive summary.',
    },
    inputsRequired: {
      pl: 'Konkurujące priorytety, kryteria decyzji, ograniczenie mocy (czas/budżet/zespół) i osoba mogąca podjąć decyzję o odrzuceniu.',
      en: 'Competing priorities, decision criteria, a capacity constraint (time/budget/team), and someone able to make the rejection call.',
    },
    roles: {
      pl: 'Właściciel decyzji (zarząd/lider), właściciel per opcja, osoba pilnująca dyscypliny odrzucania.',
      en: 'Decision owner (board/lead), an owner per option, someone enforcing rejection discipline.',
    },
    outcome: {
      pl: 'Ranking priorytetów wg fokusu (wartość×dopasowanie/wysiłek), macierz koszt-alternatywny per priorytet, werdykt anty-fokusu i sekwencja ruchów z trade-offem.',
      en: 'A priority ranking by focus score (value×fit/effort), a per-priority opportunity-cost matrix, an anti-focus verdict, and a move sequence with trade-offs.',
    },
    estimatedEffort: '1.5–3 h sesji roboczej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Zmusić organizację do realnego wyboru — nazwać, co traci, gdy coś innego wygrywa ograniczoną uwagę.',
    en: 'Force the organization into a real choice — name what loses when something else wins scarce attention.',
  },
  useCases: [
    'Planowanie kwartału przy stałej mocy zespołu',
    'Wybór między dwiema konkurującymi inicjatywami strategicznymi',
    'Przegląd roadmapy pod kątem realnego fokusu przed zarządem',
  ],
  contraindications: [
    'Potrzebny rozkład jednej ambicji na wątki (użyj Ambition Decomposer)',
    'Potrzebna pełna priorytetyzacja portfela z budżetem (użyj Portfolio Priority)',
    'Brak realnej władzy do odrzucenia opcji — sesja wyprodukuje ranking bez konsekwencji',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Pytanie i kryteria', en: 'Focus Question & Criteria' },
      goal: {
        pl: 'Określić konkurujące priorytety, kryteria decyzji i sygnał sukcesu.',
        en: 'Frame the competing priorities, decision criteria, and success signal.',
      },
      whatGoodLooksLike: 'Jasne ograniczenie mocy (czas/budżet/zespół), wobec którego priorytety konkurują.',
      evidenceToAskFor: 'Jakie jest realne ograniczenie zasobu, nie tylko lista chęci.',
      completionCriterion: 'Ograniczenie i kryteria zaakceptowane przez właściciela decyzji.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać sygnały o konkurujących opcjach i tym, co się liczy.',
        en: 'Capture signals about the competing options and what matters.',
      },
      whatGoodLooksLike:
        'Każda opcja ma nazwanego sponsora — mandat zewnętrzny (zarząd/klient/regulator) albo przekonanie właściciela (focusQuestionBank.ts opt1-surface).',
      evidenceToAskFor: 'Kto realnie prosi o tę opcję i jaki jest twardy dowód, że zasługuje na uwagę teraz.',
      completionCriterion: 'Każda opcja ma źródło mandatu i status dowodu.',
    },
    {
      id: 'priorities',
      title: { pl: 'Ocena priorytetów', en: 'Score Priorities' },
      goal: {
        pl: 'Ocenić konkurujące priorytety wg wartości, wysiłku i dopasowania.',
        en: 'Score competing priorities on value, effort, and strategic fit.',
      },
      whatGoodLooksLike:
        'Każdy priorytet ma valueScore, effortScore i strategicFit (1-5) ze wskazanym dowodem, nie entuzjazmem.',
      evidenceToAskFor: 'Twardy dowód (dane popytu, podpisane zobowiązanie, zmierzony koszt zaniechania), nie „wszyscy się zgadzają".',
      completionCriterion: 'Co najmniej dwa zaakceptowane priorytety z pełną trójką ocen.',
    },
    {
      id: 'insights',
      title: { pl: 'Kompromisy i decyzja', en: 'Trade-offs & Decision' },
      goal: {
        pl: 'Pokazać kompromisy i zdecydować, co podjąć, ułożyć w czasie lub odrzucić.',
        en: 'Expose trade-offs and decide what to commit, sequence, or cut.',
      },
      whatGoodLooksLike:
        'Macierz koszt-alternatywny paruje każdy priorytet z konkretnym konkurentem, nie z "wszystkim naraz"; werdykt anty-fokusu sprawdzony.',
      evidenceToAskFor: 'Który konkretny priorytet traci moc, gdy ten wygrywa — nigdy „nic nie traci".',
      completionCriterion: 'Werdykt detectAntiFocus nie jest flagged=true bez świadomego uzasadnienia.',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Przygotować sekwencję ruchów fokusu z trade-offem.',
        en: 'Prepare the final source summary and generate downstream outputs and initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch (commit/sequence/cut/rebalance/experiment) ma rationale, trade-off i odrzucony wariant.',
      evidenceToAskFor: 'Co świadomie tniemy lub odkładamy, wybierając ten ruch.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 i co najmniej jeden priorytet ma lane="drop" lub "defer".',
    },
  ],

  questions: [
    {
      id: 'focus-mission-constraint',
      phaseId: 'mission',
      prompt: {
        pl: 'Jakie jest realne ograniczenie mocy (czas/budżet/zespół), wobec którego te priorytety konkurują?',
        en: 'What is the real capacity constraint (time/budget/team) these priorities compete for?',
      },
      answerType: 'text',
      challengeRule: 'Odrzuć odpowiedź bez policzalnego ograniczenia — bez limitu każdy priorytet "mieści się".',
    },
    {
      id: 'focus-input-sponsor',
      phaseId: 'input',
      prompt: {
        pl: 'Co dokładnie to za opcja i kto realnie o nią prosi — zarząd, klient czy Wasze własne przekonanie?',
        en: 'What exactly is this option, and who is actually asking for it — the board, a customer, or your own conviction?',
      },
      answerType: 'evidence',
      challengeRule:
        'Jeśli nie umiecie nazwać sponsora, opcja jest kandydatem na listę, ale jeszcze nie kandydatem do ograniczonej mocy (focusQuestionBank.ts opt1-surface).',
    },
    {
      id: 'focus-priorities-evidence',
      phaseId: 'priorities',
      prompt: {
        pl: 'Jaki macie dowód, że ta opcja zasługuje na ograniczoną uwagę właśnie teraz?',
        en: 'What proof do you have that this option deserves scarce attention right now?',
      },
      answerType: 'evidence',
      challengeRule:
        'Entuzjazm to nie dowód — jeśli jedynym dowodem jest „wszyscy się zgadzają, że to ważne", traktuj jako deklarację, nie potwierdzenie (focusQuestionBank.ts opt2-evidence).',
    },
    {
      id: 'focus-insight-cost',
      phaseId: 'insights',
      prompt: {
        pl: 'Który konkretny priorytet traci uwagę i zasób, jeśli ten wygrywa?',
        en: 'Which specific priority loses attention and resource if this one wins?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Odrzuć odpowiedź „nic nie traci" lub „wszystko się zmieści" — to klasyczny anty-wzorzec „wszystko jest priorytetem" (focusOpportunityCostMatrix.ts:144-215, detectAntiFocus).',
    },
    {
      id: 'focus-output-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co konkretnie tniemy lub odkładamy, żeby to podjąć — i jakim kosztem?',
        en: 'What are we specifically cutting or deferring to commit to this, and at what cost?',
      },
      answerType: 'text',
      challengeRule: 'Ruch bez rejectedVariant (co świadomie NIE robimy) nie przechodzi bramki W2.',
    },
  ],

  classificationRules:
    'Fokus-score = (wartość(1-5) × dopasowanie(1-5)) / wysiłek(1-5), znormalizowany do 0-9 (moveValidator.ts:46-93). ' +
    'Pasmo (lane) pursue/defer/drop wynika ze score i deklarowanej rekomendacji. Do rankingu i macierzy kosztu-alternatywnego ' +
    'wchodzą wyłącznie aktywne (nie odrzucone, nie w rethinking) priorytety.',
  evidenceExpectations:
    'Każda opcja ma nazwanego sponsora (mandat zewnętrzny lub przekonanie właściciela) i status dowodu (twardy dowód vs ' +
    'deklaracja). Entuzjazm bez danych/zobowiązania/kosztu zaniechania jest traktowany jako deklaracja, nie potwierdzenie.',
  relationships:
    'Macierz koszt-alternatywny paruje każdy aktywny priorytet z sąsiednim rankingowo konkurentem (nigdy „wszystkim naraz") ' +
    'i wyprowadza magnitude (high/medium/low) z różnicy score (focusOpportunityCostMatrix.ts:48-95). ' +
    'detectAntiFocus flaguje sesję, gdy 0 priorytetów odrzucono/odłożono lub gdy ≥80% to "pursue" bez ani jednego "drop".',
  interpretationRules:
    'Czytaj ranking razem z werdyktem anty-fokusu, nie same score. Sesja bez żadnego "drop"/"defer" nie jest strategią — ' +
    'jest listą życzeń z podsumowaniem zarządczym (focusOpportunityCostMatrix.ts komunikat nothing-rejected/everything-pursue).',
  completionCriteria:
    'Co najmniej dwa aktywne priorytety z pełną trójką ocen; macierz koszt-alternatywny zbudowana dla każdego; werdykt ' +
    'detectAntiFocus nie jest flagged bez jawnego uzasadnienia w rationale ruchu; sekwencja W2 ma co najmniej jeden ruch cut/rebalance.',

  signatureArchetype: 'decision-matrix-portfolio',
  signatureRationale:
    'Fokus i kompromisy jest z natury macierzą decyzyjną: priorytety uszeregowane wg score z jawnie sparowanym kosztem ' +
    'alternatywnym — ta sama geometria co portfel, ale oś odczytu to koszt-co-traci, nie wartość-wykonalność, i wymaga widocznego "drop".',

  mapping: {
    output:
      'Niezmienny snapshot: ranking fokusu, macierz koszt-alternatywny per priorytet, werdykt anty-fokusu, sekwencja ' +
      'ruchów (commit/sequence/cut/rebalance/experiment) z trade-offem.',
    report:
      'Sekcja dyscypliny fokusu: macierz jako grafika sygnaturowa + narracja priorytet → koszt → decyzja. ' +
      'Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Każdy zaakceptowany ruch "commit"/"sequence" staje się kandydatem na inicjatywę; ruchy "cut"/"rebalance" ' +
      'zamykają lub przesuwają istniejące inicjatywy w portfelu.',
  },

  conclusion: {
    k1FactSource:
      'moveValidator.rankPriorities (focus-score) + focusOpportunityCostMatrix.detectAntiFocus — score, pasmo i werdykt ' +
      'anty-fokusu liczone deterministycznie z zaakceptowanych priorytetów. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie priorytety sesji, ich oceny i ograniczenie mocy z misji. Zakaz benchmarków branżowych spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankPriorities (focus-score malejąco). Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z K3 jako uwolniona moc/zasób z horyzontem czasowym, bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i rejectedVariant; sesja bez ani jednego priorytetu w lane="drop" wymaga ' +
      'jawnego uzasadnienia obalającego flagę anty-fokusu, inaczej nie przechodzi.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/focustradeoffs',
    questionBankModule: 'src/config/focustradeoffs/focusQuestionBank.ts',
    expectedQuestionNodeCount: 4,
    bankBackedPhaseIds: ['priorities'],
    rendererComponent: 'src/components/DiscoveryTools/tools/FocusTradeoff',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Priorytetyzacja przez koszt alternatywny („strategia to wybór, czego nie robić")',
    commonlyAttributedTo: 'Michael Porter („What Is Strategy?", HBR 1996)',
    sourceUsed: 'src/config/focustradeoffs/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Sformułowanie szeroko cytowane i zgenerycznieniałe; HBR ma prawa do tekstu oryginalnego (nie reprodukowany).',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'ŚREDNIE — atrybucja obecna w komentarzach kodu, ale bez wskazania licencjonowanego dokumentu.',
  },
};
