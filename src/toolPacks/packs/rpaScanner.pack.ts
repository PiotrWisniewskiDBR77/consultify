/**
 * Tool Pack — RPA Scanner (skan wykonalności RPA/automatyzacji).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/rpascanner/feasibilityEngine.ts` (baseline, scoring bramek,
 *   sekwencja ruchów W2 — jedyny dopuszczalny generator liczb)
 * - `src/config/rpascanner/deepeningLadder.ts` (4 kanoniczne bramki oceny +
 *   drabinka pogłębiająca per bramka)
 * - `src/config/rpascanner/rpaQuestionBank.ts` (rozgałęziony bank pytań,
 *   wymuszona pętla `rpa-volume-force` na nieznanym wolumenie)
 * - `src/config/rpascanner/rpaInsightStaircase.ts` (drabinka K1→K2→K3 per
 *   pomysł automatyzacji + wykrywanie luk strukturalnych)
 * - `src/config/rpascanner/conclusionPrompts.ts` (kontrakt promptu W2)
 * - `src/config/rpascanner/index.ts` (adapter sekcji sesji → RpaSession)
 * - `src/store/useToolStore.ts` RPA_SCANNER_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (context/candidates/sizing/backlog/summary) —
 * pack nie wprowadza równoległej nomenklatury. Silnik operuje własnym
 * słownikiem czterech bramek oceny (identify/standardize/quantify/
 * feasibility, RPA_GATES w deepeningLadder.ts) — to NIE są id faz, tylko
 * kategorie, do których użytkownik przypisuje kandydatów i pomysły wewnątrz
 * faz `candidates`/`sizing`/`backlog`.
 *
 * STAN UI: narzędzie ma kompletny silnik metody, ale NIE MA dedykowanej
 * gałęzi w `ToolCanvas.tsx` — dziś renderuje się generycznym fallbackiem.
 * To luka montażu UI, nie luka treści (patrz `signatureRationale`).
 */

import { EVIDENCE_MISSING, type ToolPack } from '../contract';

export const rpaScannerPack: ToolPack = {
  toolType: 'rpa-scanner',
  displayName: { pl: 'Skaner RPA', en: 'RPA Scanner' },
  category: 'digital',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna; runtime DoD (Output/Report/approval, montaż w ToolCanvas)
  // jeszcze niedowieziony — dlatego NIE RUNTIME_ACTIVE.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/rpascanner/feasibilityEngine.ts', verifiableInRepo: true },
    { source: 'src/config/rpascanner/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/rpascanner/rpaQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/rpascanner/rpaInsightStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/rpascanner/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/config/rpascanner/index.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (RPA_SCANNER_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Skan wykonalności automatyzacji, który kończy się sekwencją ruchów z trade-offem, a nie listą "procesów do zrobotyzowania".',
      en: 'An automation-feasibility scan that ends in a sequenced move set with trade-offs, not a list of "processes to bot".',
    },
    whatItIsNot: {
      pl: 'To nie jest katalog narzędzi RPA ani wycena licencji. Kandydat bez zmierzonego wolumenu nie wchodzi do rankingu.',
      en: 'It is not an RPA-vendor catalogue or a licensing quote. A candidate without measured volume does not enter the ranking.',
    },
    whenToUse: {
      pl: 'Gdy trzeba zbudować spriorytetyzowany backlog automatyzacji z uzasadnionym ROI, nie pojedynczy PoC na chybił trafił.',
      en: 'When you need a prioritized automation backlog with a justified ROI, not a single ad-hoc PoC.',
    },
    whenNotToUse: {
      pl: 'Gdy proces jeszcze się zmienia co kwartał i nikt go nie zmapował — wtedy właściwy jest Process Automation (mapowanie i standaryzacja najpierw).',
      en: 'When the process still changes quarterly and nobody has mapped it — Process Automation (mapping and standardization first) fits better.',
    },
    whyItMatters: {
      pl: 'Silnik chroni kolejność oceny (zidentyfikuj → ustandaryzuj → skwantyfikuj → oceń wykonalność), więc backlog nie zatwierdza budowy bota na niezmierzonym lub niestandaryzowanym procesie.',
      en: 'The engine protects the assessment order (identify → standardize → quantify → feasibility), so the backlog never greenlights a bot build on an unmeasured or unstandardized process.',
    },
    inputsRequired: {
      pl: 'Rodzina procesów-kandydatów, dostęp do logów/wolumenu, osoba znająca realny przebieg pracy i wyjątki.',
      en: 'A family of candidate processes, access to logs/volume, and someone who knows the real workflow and its exceptions.',
    },
    roles: {
      pl: 'Lider automatyzacji/operacji, właściciel procesu, analityk dostarczający wolumen i dowody.',
      en: 'Automation/operations lead, process owner, analyst supplying volume and evidence.',
    },
    outcome: {
      pl: 'Baza portfela automatyzacji, ranking czterech bramek oceny i spriorytetyzowana sekwencja ruchów z trade-offem.',
      en: 'An automation-portfolio baseline, a ranking of the four assessment gates, and a prioritized move sequence with trade-offs.',
    },
    estimatedEffort: '90-150 min sesji roboczej',
    // Metoda operacyjna oparta na klasycznym triage RPA; brak noty licencyjnej
    // w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Odsiać realne kandydatury do automatyzacji od pobożnych życzeń i ustawić je w bezpiecznej kolejności budowy.',
    en: 'Separate real automation candidates from wishful thinking and put them in a safe build order.',
  },
  useCases: [
    'Budowa pierwszego backlogu automatyzacji dla działu operacyjnego',
    'Ocena zgłoszeń "zautomatyzujmy X" napływających z biznesu',
    'Przygotowanie uzasadnienia budżetu na RPA/AI przed zarządem',
  ],
  contraindications: [
    'Proces niezmapowany i niestabilny (użyj Process Automation)',
    'Pojedynczy PoC bez ambicji zbudowania portfela',
    'Brak dostępu do żadnych danych o wolumenie — sesja wyprodukuje same zgadywanki',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst automatyzacji', en: 'Automation Context' },
      goal: {
        pl: 'Zdefiniować rodzinę procesów i cel automatyzacji.',
        en: 'Define the process family and the automation goal.',
      },
      whatGoodLooksLike: 'Nazwana rodzina procesów, cel biznesowy i horyzont decyzji o backlogu.',
      evidenceToAskFor: 'Który dział/proces zgłasza problem i jaki jest budżetowy/czasowy horyzont.',
      completionCriterion: 'Cel automatyzacji zaakceptowany przez właściciela decyzji.',
    },
    {
      id: 'candidates',
      title: { pl: 'Kandydaci', en: 'Candidates' },
      goal: {
        pl: 'Wypisać procesy kandydujące do RPA z ich wolumenem i regułowością.',
        en: 'List candidate processes for RPA with their volume and rule-basedness.',
      },
      whatGoodLooksLike: 'Każdy kandydat ma wolumen (zmierzony lub jawnie oznaczony jako szacunek) i poziom standaryzacji.',
      evidenceToAskFor: 'Log systemowy, raport lub obserwacja potwierdzająca wolumen; nie "wydaje się, że dużo".',
      completionCriterion: 'Co najmniej jeden kandydat ma zmierzony wolumen (rpaQuestionBank.ts: pętla rpa-volume-force nie blokuje dalej).',
    },
    {
      id: 'sizing',
      title: { pl: 'Sizing', en: 'Sizing' },
      goal: {
        pl: 'Oszacować każdego kandydata wg wolumenu, wysiłku i złożoności.',
        en: 'Size each candidate by volume, effort, and complexity.',
      },
      whatGoodLooksLike: 'Każdy kandydat ma exceptionRate, handlingMinutes i techTier (rpa/ocr/api/ai) osadzone w danych, nie w domysłach.',
      evidenceToAskFor: 'Udział wyjątków wymagających człowieka i czas obsługi jednego przebiegu.',
      completionCriterion: 'Roczne minuty automatyzowalnej pracy policzone przez silnik (feasibilityEngine.ts: computeBaseline).',
    },
    {
      id: 'backlog',
      title: { pl: 'Backlog', en: 'Backlog' },
      goal: {
        pl: 'Spriorytetyzować backlog automatyzacji wg czterech bramek oceny.',
        en: 'Prioritize the automation backlog across the four assessment gates.',
      },
      whatGoodLooksLike: 'Pomysły automatyzacji przypisane do bramek (identify/standardize/quantify/feasibility) z impact i effort.',
      evidenceToAskFor: 'Dlaczego pomysł trafia do tej bramki, a nie do "automate" wprost.',
      completionCriterion: 'Ranking bramek policzony (rankRpaGates) z co najmniej jedną bramką mającą pomysł.',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Zamienić ranking bramek w W2-zwalidowaną sekwencję ruchów i inicjatywy.',
        en: 'Turn the gate ranking into a W2-validated move sequence and initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch ma rationale, trade-off i odrzucony wariant (walidacja: valid=true, brak missing/weak).',
      evidenceToAskFor: 'Co świadomie odrzucamy wybierając tę kolejność bramek i jakim kosztem.',
      completionCriterion: 'Sekwencja ruchów spełnia bramkę W2 (buildW2MoveSequence + validateW2Move: valid=true dla każdego ruchu).',
    },
  ],

  questions: [
    {
      id: 'rpa-context-goal',
      phaseId: 'context',
      prompt: {
        pl: 'Jaką rodzinę procesów obejmuje ten skan i jaki cel automatyzacji ma wesprzeć?',
        en: 'Which process family does this scan cover, and what automation goal should it support?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez nazwanej rodziny procesów ("chcemy zautomatyzować firmę" = za ogólne) — cel musi wskazywać dział lub proces.',
      followUpProbes: ['Kto zgłosił ten problem?', 'Co się stanie, jeśli backlog nie powstanie w tym kwartale?'],
    },
    {
      id: 'rpa-candidates-volume-evidence',
      phaseId: 'candidates',
      prompt: {
        pl: 'Skąd wiesz, że wolumen tego procesu jest realny — z logu systemowego, czy zgadujesz?',
        en: 'How do you know this process volume is real — from a system log, or a guess?',
      },
      answerType: 'evidence',
      challengeRule:
        'Kandydat bez zmierzonego wolumenu jest zablokowany pętlą wymuszoną (rpaQuestionBank.ts: rpa-volume-force) — nie pozwól, by wszedł do rankingu jako "measured".',
    },
    {
      id: 'rpa-sizing-exceptions',
      phaseId: 'sizing',
      prompt: {
        pl: 'Czy ten proces jest w pełni regułowy, czy niesie wyjątki wymagające decyzji człowieka?',
        en: 'Is this process fully rule-based, or does it carry exceptions that need a human call?',
      },
      answerType: 'choice',
      challengeRule:
        'Kandydat oznaczony jako "w pełni regułowy" bez podanego udziału wyjątków jest podejrzany — bot odwzorowuje regułę, nie osąd operatora (rpaQuestionBank.ts: rpa-standardize-check).',
    },
    {
      id: 'rpa-backlog-standardize-first',
      phaseId: 'backlog',
      prompt: {
        pl: 'Czy ten proces jest już ustandaryzowany, czy najpierw trzeba go naprawić, zanim odwzoruje go bot?',
        en: 'Is this process already standardized, or does it need fixing first before a bot replays it?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Główny tryb porażki metody: automatyzacja zepsutego/niestandaryzowanego procesu zamiast jego naprawy. Pomysł przypisany do bramki "automate"/"feasibility" bez żadnego kandydata w "standardize" jest FANTOMEM — silnik oznacza to jako lukę strukturalną (automationInsightStaircase / rpaInsightStaircase: brak dowodu standaryzacji = odrzuć wpis jako przedwczesny).',
    },
    {
      id: 'rpa-summary-tradeoff',
      phaseId: 'summary',
      prompt: {
        pl: 'Co świadomie odrzucacie, wybierając tę kolejność bramek, i jakim kosztem?',
        en: 'What are you deliberately giving up by choosing this gate order, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch bez odrzuconego wariantu nie przechodzi bramki W2 (validateW2Move: rejectedVariant nie może być puste ani krótsze niż 12 znaków).',
    },
  ],

  classificationRules:
    'Kandydaci są klasyfikowani wg czterech bramek oceny (RPA_GATES: identify/standardize/quantify/' +
    'feasibility, deepeningLadder.ts) oraz poziomu standaryzacji (high/medium/low). Tech tier ' +
    '(rpa/ocr/api/ai) opisuje wymaganą technologię, nie zastępuje bramki. Kandydat wchodzi do ' +
    'rankingu tylko z przypisaną bramką i co najmniej jednym pomysłem automatyzacji (feasibilityEngine.ts: scoreGate).',
  evidenceExpectations:
    'Wolumen i czas obsługi mają status measured (true/false) — measured=true tylko gdy oba ' +
    '(target=wolumen, durationMinutes=czas obsługi) są podane (index.ts: toRpaSession). Pomysł bez ' +
    'evidence[] nie liczy się do evidenceBacked i obniża feasibility bramki.',
  relationships:
    'Score bramki = attractiveness (średni impact pomysłów) × feasibility (łatwość: niski effort + ' +
    'evidence). Ranking honoruje porządek kanoniczny przy remisach (identify < standardize < quantify ' +
    '< feasibility) — sekwencja ruchów nigdy nie zatwierdza budowy przed standaryzacją i pomiarem zwrotu ' +
    '(feasibilityEngine.ts: rankRpaGates, buildW2MoveSequence).',
  interpretationRules:
    'Czytaj ranking bramek i sekwencję ruchów, nie surową listę kandydatów. Bramka z realnymi minutami, ' +
    'ale bez ani jednego pomysłu, jest ślepą plamą planu, nie brakiem potrzeby. Portfel z measuredRatio ' +
    '< 50% wymusza ruch "measure-first" przed jakąkolwiek inwestycją w budowę.',
  completionCriteria:
    'Co najmniej jedna bramka ma zaakceptowanego kandydata i pomysł; ranking policzony przez silnik; ' +
    'każdy rekomendowany ruch spełnia bramkę W2 (rationale + trade-off + odrzucony wariant, min. 12 ' +
    'znaków każdy — feasibilityEngine.ts: MIN_JUSTIFICATION_LEN).',

  signatureArchetype: 'discovery-candidate-funnel',
  signatureRationale:
    'RPA Scanner odsiewa kandydatów przez cztery bramki sekwencyjne (identify → standardize → ' +
    'quantify → feasibility) — geometria lejka pokazuje, ilu kandydatów odpada na każdej bramce i ' +
    'dlaczego, zamiast płaskiej listy "procesów do automatyzacji". Narzędzie nie ma dziś dedykowanej ' +
    'gałęzi w ToolCanvas.tsx (renderuje się fallbackiem) — geometria lejka jest tym, co trzeba ' +
    'zamontować, nie zaprojektować od nowa.',

  mapping: {
    output:
      'Niezmienny snapshot: baza portfela (candidateCount, ruleBasedCount, annualAutomatableMinutes), ' +
      'ranking czterech bramek z rationale i W2-zwalidowana sekwencja ruchów.',
    report:
      'Sekcja backlogu automatyzacji: lejek bramek jako grafika sygnaturowa + sekwencja ruchów jako ' +
      'narracja rationale → trade-off → odrzucony wariant. Renderowane deterministycznie z tego samego ' +
      'Artifact.',
    initiative:
      'Każdy zwalidowany ruch W2 staje się kandydatem na inicjatywę operacyjną; bramka wyznacza typ ' +
      '(identify/standardize → zdolność, quantify → dowód biznesowy, feasibility → PoC/ryzyko).',
  },

  conclusion: {
    k1FactSource:
      'feasibilityEngine.ts: computeBaseline (candidateCount, ruleBasedCount, annualAutomatableMinutes, ' +
      'topCandidateMinutes, evidenceRatio, measuredRatio) + rankRpaGates (score per bramka) + ' +
      'buildW2MoveSequence — wszystkie liczby liczone deterministycznie z sesji, żadna nie pochodzi z LLM.',
    k2GroundingScope:
      'Wyłącznie kandydaci i pomysły sesji, ich dowody i profil organizacji. Zakaz przywoływania ' +
      'benchmarków branżowych RPA spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankingu wagi bramek (attractiveness × feasibility, feasibilityEngine.ts: scoreGate) ' +
      'z twardym tie-breakiem na porządku kanonicznym. Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z sekwencji ruchów, mieć horyzont czasowy i wskazywać rolę odpowiedzialną. ' +
      'Minuty/godziny wyłącznie z annualAutomatableMinutes — bez kwot ROI nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje: rationale, trade-off i odrzucony wariant (W2, feasibilityEngine.ts: ' +
      'validateW2Move). Ruch bez odrzuconego wariantu nie przechodzi.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/rpascanner',
    questionBankModule: 'src/config/rpascanner/rpaQuestionBank.ts',
    expectedQuestionNodeCount: 7,
    bankBackedPhaseIds: ['candidates', 'sizing', 'backlog'],
    rendererComponent: EVIDENCE_MISSING,
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Triaż wykonalności RPA (bramki identify/standardize/quantify/feasibility)',
    commonlyAttributedTo: 'Brak kanonicznego autora w repo; generyczny wzorzec triażu branży RPA',
    sourceUsed: 'src/config/rpascanner/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Nie wykryto znaku towarowego; „RPA" to termin generyczny.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'Repo twierdzi, że to wzorzec autorski, ale nie zweryfikowano tego wobec źródeł zewnętrznych.',
  },
};
