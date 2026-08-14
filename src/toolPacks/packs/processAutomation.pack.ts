/**
 * Tool Pack — Process Automation (mapowanie, standaryzacja i automatyzacja
 * przepływu procesu, z ekonomiką payback).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/processautomation/automationEngine.ts` (baseline ekonomiki
 *   procesu, scoring czterech faz, sekwencja ruchów W2 — jedyny dopuszczalny
 *   generator liczb: godziny bazowe, oszczędność, redukcja błędu)
 * - `src/config/processautomation/deepeningLadder.ts` (4 kanoniczne fazy
 *   automatyzacji + drabinka pogłębiająca per faza)
 * - `src/config/processautomation/automationQuestionBank.ts` (rozgałęziony
 *   bank pytań, wymuszone pętle `pa-map-force` i `pa-standardize-force`)
 * - `src/config/processautomation/automationInsightStaircase.ts` (drabinka
 *   K1→K2→K3 per kandydat + wykrywanie luk strukturalnych, w tym gap
 *   `automate-before-standardize`)
 * - `src/config/processautomation/conclusionPrompts.ts` (kontrakt promptu W2)
 * - `src/store/useToolStore.ts` PROCESS_AUTOMATION_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (context/process-mapping/measurement/redesign/
 * re-estimation/economics/initiatives/report — 8 kroków). Silnik operuje
 * własnym słownikiem czterech faz Lean (map/standardize/automate/sustain,
 * AUTOMATION_PHASES w deepeningLadder.ts) — to kategorie, do których
 * użytkownik przypisuje kandydatów automatyzacji wewnątrz faz runtime
 * `process-mapping`/`redesign`/`economics`/`initiatives`.
 *
 * UWAGA — rozbieżność względem wskazówki zadania: repo NIE zawiera modelu
 * `ProcessStep` z polami `as_is_time_minutes`/`to_be_time_minutes`/
 * capex/opex. Rzeczywisty silnik (`automationEngine.ts`) liczy ekonomikę z
 * `AutomationBaselineInput` (volumePerWeek, baselineMinutesPerCycle,
 * targetMinutesPerCycle, errorRateBaselinePct/Target) do
 * annualBaselineHours/annualSavedHours/errorPointsRemoved — to jest
 * potwierdzone źródło liczb użyte poniżej (K1), nie capex/opex/payback,
 * których w kodzie nie ma (payback pojawia się tylko jako pytanie w banku
 * pytań i rung drabinki, nigdy jako policzone pole silnika).
 */

import { type ToolPack } from '../contract';

export const processAutomationPack: ToolPack = {
  toolType: 'process-automation',
  displayName: { pl: 'Automatyzacja procesu', en: 'Process Automation' },
  category: 'automation',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/processautomation/automationEngine.ts', verifiableInRepo: true },
    { source: 'src/config/processautomation/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/processautomation/automationQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/processautomation/automationInsightStaircase.ts', verifiableInRepo: true },
    { source: 'src/config/processautomation/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/config/processautomation/index.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (PROCESS_AUTOMATION_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Przebudowa procesu wg dyscypliny Lean (mapuj → standaryzuj → automatyzuj → utrzymaj), kończąca się policzonymi godzinami oszczędności, nie samą mapą.',
      en: 'A Lean-disciplined process redesign (map → standardize → automate → sustain) that ends in counted savings hours, not just a flow diagram.',
    },
    whatItIsNot: {
      pl: 'To nie jest wdrożenie konkretnego narzędzia RPA ani wycena licencji. Kandydat "automate" bez ani jednego kandydata "standardize" jest odrzucany jako pominięcie kolejności, nie odłożenie.',
      en: 'It is not a specific RPA-tool rollout or a licensing quote. An "automate" candidate with zero "standardize" candidates is rejected as a skipped step, not a deferred one.',
    },
    whenToUse: {
      pl: 'Gdy proces jest już zidentyfikowany jako problematyczny i trzeba przejść od mapy do policzonej ekonomiki automatyzacji.',
      en: 'When a process is already flagged as problematic and you need to move from a map to a counted automation economics case.',
    },
    whenNotToUse: {
      pl: 'Gdy dopiero szukacie kandydatów do automatyzacji w całym portfelu procesów — wtedy zacznijcie od RPA Scanner.',
      en: 'When you are still searching for automation candidates across the whole process portfolio — start with RPA Scanner instead.',
    },
    whyItMatters: {
      pl: 'Silnik chroni porządek Lean (mapuj → standaryzuj → automatyzuj → utrzymaj) i wykrywa, gdy kandydat "automate" pojawia się bez ani jednego kandydata "standardize" — to pomijanie kolejności, nie jej odłożenie.',
      en: 'The engine protects the Lean order (map → standardize → automate → sustain) and flags when an "automate" candidate appears with zero "standardize" candidates — a skipped step, not a deferred one.',
    },
    inputsRequired: {
      pl: 'Zmapowany proces krok po kroku, baseline wolumenu i czasu cyklu, osoba znająca realny przebieg i wyjątki.',
      en: 'A step-by-step process map, a volume and cycle-time baseline, and someone who knows the real workflow and its exceptions.',
    },
    roles: {
      pl: 'Właściciel procesu, kierownik operacyjny, analityk dostarczający baseline wolumenu/czasu/błędów.',
      en: 'Process owner, operations manager, analyst supplying the volume/time/error baseline.',
    },
    outcome: {
      pl: 'Zmapowany i ustandaryzowany proces, policzona baza godzin/błędów, ranking czterech faz Lean i W2-zwalidowana sekwencja ruchów.',
      en: 'A mapped and standardized process, a counted hours/error baseline, a ranking of the four Lean phases, and a W2-validated move sequence.',
    },
    estimatedEffort: '2-4h sesji roboczej (rozłożone na etapy)',
    // Metoda oparta na klasycznym Lean/BPR; brak noty licencyjnej w repo —
    // nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Przeprowadzić proces przez dyscyplinę Lean tak, by automatyzacja trafiła w ustandaryzowany przepływ, nie w utrwaloną wariancję.',
    en: 'Take a process through Lean discipline so automation lands on a standardized flow, not on locked-in variation.',
  },
  useCases: [
    'Przebudowa konkretnego, już zidentyfikowanego procesu problematycznego',
    'Uzasadnienie budżetu na automatyzację policzoną liczbą godzin i błędów',
    'Zaprojektowanie planu utrzymania zanim automatyzacja trafi na produkcję',
  ],
  contraindications: [
    'Portfel procesów jeszcze nie przesiany — zacznij od RPA Scanner',
    'Proces zmienia się co tydzień i nikt nie może uzgodnić jednej ścieżki',
    'Cel to wyłącznie diagram na slajd, bez ambicji policzenia ekonomiki',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Identyfikacja', en: 'Identification' },
      goal: {
        pl: 'Zidentyfikować proces i zdefiniować cel automatyzacji.',
        en: 'Identify the process and define the automation goal.',
      },
      whatGoodLooksLike: 'Nazwany proces, właściciel i jasny cel (skrócenie czasu cyklu, redukcja błędu, oba).',
      evidenceToAskFor: 'Który proces i dlaczego teraz — co go wyróżnia spośród innych kandydatów.',
      completionCriterion: 'Cel automatyzacji zaakceptowany przez właściciela procesu.',
    },
    {
      id: 'process-mapping',
      title: { pl: 'Mapowanie procesu', en: 'Process Mapping' },
      goal: {
        pl: 'Zebrać kluczowe kroki i handoffy.',
        en: 'Capture the key steps and handoffs.',
      },
      whatGoodLooksLike: 'Proces zmapowany od początku do końca — każdy krok nazwany, uporządkowany, z „kto co robi".',
      evidenceToAskFor: 'Czy trzy różne osoby narysowałyby ten sam diagram (automationQuestionBank.ts: pa-surface).',
      completionCriterion: 'Mapa zaakceptowana, pętla wymuszona pa-map-force nie blokuje dalej.',
    },
    {
      id: 'measurement',
      title: { pl: 'Pomiar', en: 'Measurement' },
      goal: {
        pl: 'Zebrać baseline: wolumen, czas, błędy i ograniczenia.',
        en: 'Baseline volume, time, errors, and constraints.',
      },
      whatGoodLooksLike: 'volumePerWeek i baselineMinutesPerCycle podane liczbowo, nie oszacowane "na oko".',
      evidenceToAskFor: 'Runs/tydzień × minuty/cykl × wskaźnik błędu — dane, nie zgadywanie payback.',
      completionCriterion: 'Baseline jest quantified (automationEngine.ts: computeBaseline — quantified=true gdy volumePerWeek>0 i baselineMinutesPerCycle>0).',
    },
    {
      id: 'redesign',
      title: { pl: 'Redesign', en: 'Redesign' },
      goal: {
        pl: 'Zdefiniować nowy flow i kandydatów automatyzacji.',
        en: 'Define the redesigned flow and automation candidates.',
      },
      whatGoodLooksLike: 'Jest uzgodniona jedna ścieżka procesu, zanim pojawi się jakikolwiek kandydat "automate".',
      evidenceToAskFor: 'Czy proces ma jedną uzgodnioną ścieżkę, czy nadal wariantuje między zespołami.',
      completionCriterion: 'Kandydat "automate" ma co najmniej jeden odpowiadający kandydat "standardize" (automationInsightStaircase.ts: gap automate-before-standardize = brak).',
    },
    {
      id: 're-estimation',
      title: { pl: 'Re-estymacja', en: 'Re-estimation' },
      goal: {
        pl: 'Oszacować target czasy i błędy po redesignie.',
        en: 'Estimate target cycle times and error rates after redesign.',
      },
      whatGoodLooksLike: 'targetMinutesPerCycle i errorRateTargetPct podane liczbowo z uzasadnieniem, nie życzeniowo.',
      evidenceToAskFor: 'Na czym oparty jest cel czasu/błędu — pilot, benchmark wewnętrzny, czy życzenie.',
      completionCriterion: 'Cel błędu nie jest podany bez baseline błędu (automationInsightStaircase.ts: gap error-target-without-baseline = brak).',
    },
    {
      id: 'economics',
      title: { pl: 'Ekonomia', en: 'Economics' },
      goal: {
        pl: 'Policzyć oszczędności, payback i założenia ROI.',
        en: 'Calculate savings, payback, and ROI assumptions.',
      },
      whatGoodLooksLike: 'annualSavedHours i errorPointsRemoved policzone z baseline, nie zadeklarowane jako liczba z powietrza.',
      evidenceToAskFor: 'Skąd wzięła się liczba godzin oszczędności — z policzonego baseline, czy z zaokrąglenia w górę.',
      completionCriterion: 'annualSavedHours i errorPointsRemoved policzone przez silnik (automationEngine.ts: computeBaseline).',
    },
    {
      id: 'initiatives',
      title: { pl: 'Inicjatywy', en: 'Initiatives' },
      goal: {
        pl: 'Przełożyć redesign na zestaw inicjatyw gotowych do realizacji.',
        en: 'Translate the redesign into an execution-ready initiative set.',
      },
      whatGoodLooksLike: 'Każdy ruch ma rationale, trade-off i odrzucony wariant; faza sustain jest odroczona z jawnym warunkiem, nie pominięta.',
      evidenceToAskFor: 'Co świadomie odraczacie (np. monitoring/utrzymanie) i pod jakim warunkiem wraca.',
      completionCriterion: 'Sekwencja ruchów spełnia bramkę W2 (buildW2MoveSequence + validateW2Move: valid=true dla każdego ruchu).',
    },
    {
      id: 'report',
      title: { pl: 'Raport / Deck', en: 'Report / Deck' },
      goal: {
        pl: 'Wyeksportować i udostępnić wyniki.',
        en: 'Export and share outcomes.',
      },
      whatGoodLooksLike: 'Raport pokazuje bazę + redesign + ekonomikę + sekwencję ruchów jako spójną narrację, nie oddzielne sekcje.',
      evidenceToAskFor: 'Czy odbiorca raportu widzi zarówno liczby, jak i decyzję, którą te liczby uzasadniają.',
      completionCriterion: 'Eksport wygenerowany z tego samego Artifact co sesja (bez ręcznego przepisywania liczb).',
    },
  ],

  questions: [
    {
      id: 'pa-context-goal',
      phaseId: 'context',
      prompt: {
        pl: 'Który proces jest przedmiotem tej automatyzacji i jaki jest jej cel?',
        en: 'Which process is this automation about, and what is its goal?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez nazwanego procesu ("chcemy usprawnić operacje" = za ogólne) — wymagaj konkretnego procesu i mierzalnego celu.',
      followUpProbes: ['Kto zgłosił ten proces jako kandydata?', 'Co się stanie, jeśli redesign się nie uda?'],
    },
    {
      id: 'pa-mapping-consistency',
      phaseId: 'process-mapping',
      prompt: {
        pl: 'Czy proces jest zmapowany od początku do końca (każdy krok nazwany, po kolei, z tym kto co robi), czy działa na pamięci instytucjonalnej?',
        en: 'Is the process mapped end-to-end (every step named, in order, with who does what), or does it run on institutional memory?',
      },
      answerType: 'choice',
      challengeRule:
        'Proces bez pełnej mapy jest zablokowany pętlą wymuszoną (automationQuestionBank.ts: pa-map-force) — nie pozwól, by automatyzacja "z pamięci" wygenerowała kandydatów.',
    },
    {
      id: 'pa-redesign-standardize-first',
      phaseId: 'redesign',
      prompt: {
        pl: 'Czy jest jedna uzgodniona ścieżka wykonania tego procesu, czy każdy zespół robi to inaczej?',
        en: 'Is there one agreed way to run this process, or does every team do it differently?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Główny tryb porażki metody: automatyzacja rozjechanego/niestandaryzowanego procesu zamiast jego naprawy. Kandydat "automate" bez ani jednego kandydata "standardize" jest odrzucany jako pominięcie porządku Lean, nie jego odłożenie (automationInsightStaircase.ts: gap automate-before-standardize — "the Lean order is being skipped, not just deferred").',
    },
    {
      id: 'pa-economics-baseline-source',
      phaseId: 'economics',
      prompt: {
        pl: 'Skąd wzięły się liczby oszczędności — z policzonego baseline (wolumen × czas cyklu), czy to szacunek payback bez policzonych godzin?',
        en: 'Where do the savings numbers come from — a counted baseline (volume × cycle time), or a payback estimate with no counted hours behind it?',
      },
      answerType: 'evidence',
      challengeRule:
        'Kandydaci automatyzacji istniejący bez ilościowego baseline (wolumen/tydzień, minuty/cykl) oznaczają, że payback jest proponowany bez policzonych godzin za sobą — odrzuć każdą liczbę oszczędności niepopartą baseline (automationInsightStaircase.ts: gap unquantified-baseline-with-candidates).',
    },
    {
      id: 'pa-initiatives-tradeoff',
      phaseId: 'initiatives',
      prompt: {
        pl: 'Co świadomie odraczacie (np. utrzymanie/monitoring) wybierając tę kolejność, i jakim kosztem?',
        en: 'What are you deliberately deferring (e.g. sustain/monitoring) by choosing this order, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch bez odrzuconego wariantu nie przechodzi bramki W2 (automationEngine.ts: validateW2Move — rejectedVariant nie może być puste ani krótsze niż 12 znaków).',
    },
  ],

  classificationRules:
    'Kandydaci automatyzacji są klasyfikowani wg przypisania do jednej z czterech faz Lean ' +
    '(AUTOMATION_PHASES: map/standardize/automate/sustain, deepeningLadder.ts). Baza ekonomiczna ma ' +
    'flagę quantified (true tylko gdy volumePerWeek>0 i baselineMinutesPerCycle>0, automationEngine.ts: ' +
    'computeBaseline) — bez niej silnik degraduje się do rankingu jakościowego, nie zmyśla godzin.',
  evidenceExpectations:
    'Każdy kandydat ma opcjonalne minutesSaved i evidence[]; kandydat bez evidence[] nie liczy się do ' +
    'evidenceBacked i obniża feasibility fazy. Baseline błędu wymaga wartości bazowej, zanim przyjmie ' +
    'się cel błędu (automationInsightStaircase.ts: gap error-target-without-baseline).',
  relationships:
    'Score fazy = attractiveness (średni impact kandydatów) × feasibility (łatwość: niski effort + ' +
    'evidence). Ranking honoruje porządek kanoniczny Lean (map < standardize < automate < sustain) przy ' +
    'remisach — sekwencja ruchów nigdy nie automatyzuje przed standaryzacją (automationEngine.ts: ' +
    'rankAutomationPhases). Kandydat "automate" bez odpowiadającego kandydata "standardize" jest ' +
    'strukturalną luką, nie tylko niskim priorytetem (automationInsightStaircase.ts: automate-before-standardize).',
  interpretationRules:
    'Czytaj ranking faz i bazę ekonomiczną razem, nie osobno. Baseline niequantified oznacza, że każda ' +
    'liczba godzin w narracji jest niepewna i musi być tak nazwana. Faza "sustain" z kandydatami, ale ' +
    'bez baseline, chroni zysk, który jeszcze nie istnieje — to sygnał kolejności, nie błąd.',
  completionCriteria:
    'Co najmniej jedna faza ma zaakceptowanego kandydata; baseline jest quantified lub jawnie oznaczony ' +
    'jako niepewny; każdy rekomendowany ruch spełnia bramkę W2 (rationale + trade-off + odrzucony ' +
    'wariant, min. 12 znaków każdy — automationEngine.ts: MIN_JUSTIFICATION_LEN).',

  signatureArchetype: 'flow-value-stream',
  signatureRationale:
    'Process Automation prowadzi proces przez strumień wartości Lean (mapuj → standaryzuj → ' +
    'automatyzuj → utrzymaj) z policzoną ekonomiką na każdym etapie — geometria strumienia wartości ' +
    'pokazuje, gdzie czas/błąd znika, a gdzie automatyzacja zostałaby nałożona na niestandaryzowany ' +
    'przepływ. To jedyne z czterech narzędzi tej fali, które ma już dedykowaną gałąź w ToolCanvas.tsx.',

  mapping: {
    output:
      'Niezmienny snapshot: baza ekonomiczna (annualBaselineHours, annualSavedHours, ' +
      'errorPointsRemoved, quantified), ranking czterech faz Lean z rationale i W2-zwalidowana ' +
      'sekwencja ruchów.',
    report:
      'Sekcja przebudowy procesu: strumień wartości jako grafika sygnaturowa + sekwencja ruchów jako ' +
      'narracja rationale → trade-off → odrzucony wariant. Renderowane deterministycznie z tego samego ' +
      'Artifact.',
    initiative:
      'Każdy zwalidowany ruch W2 staje się kandydatem na inicjatywę; faza wyznacza typ (map → ' +
      'zdolność pomiarowa, standardize → zdolność zarządcza, automate → wdrożenie, sustain → kontrola).',
  },

  conclusion: {
    k1FactSource:
      'automationEngine.ts: computeBaseline (volumePerWeek, baselineMinutesPerCycle, ' +
      'targetMinutesPerCycle, minutesSavedPerCycle, annualBaselineHours, annualSavedHours, ' +
      'errorRateBaselinePct/Target, errorPointsRemoved, quantified) + rankAutomationPhases (score per ' +
      'faza) + buildW2MoveSequence — wszystkie liczby (w tym godziny i punkty procentowe błędu) liczone ' +
      'deterministycznie z sesji, żadna nie pochodzi z LLM. Payback/capex/opex NIE są polami silnika w ' +
      'tym repo (EVIDENCE_MISSING jako policzony fakt) — pojawiają się wyłącznie jako pytania w banku ' +
      'pytań i rungi drabinki, nie jako liczby.',
    k2GroundingScope:
      'Wyłącznie kandydaci i baseline sesji, ich dowody i profil organizacji. Zakaz przywoływania ' +
      'benchmarków branżowych czasu cyklu spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankingu wagi faz (attractiveness × feasibility, automationEngine.ts: scorePhase) z ' +
      'twardym tie-breakiem na porządku kanonicznym Lean. Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z sekwencji ruchów, mieć horyzont czasowy i wskazywać rolę odpowiedzialną. ' +
      'Godziny/punkty błędu wyłącznie z annualSavedHours/errorPointsRemoved — bez kwot ROI, capex ani ' +
      'opex nieobecnych we wsadzie (te pola nie istnieją w silniku).',
    tradeoffRule:
      'Każdy ruch podaje: rationale, trade-off i odrzucony wariant (W2, automationEngine.ts: ' +
      'validateW2Move). Ruch bez odrzuconego wariantu nie przechodzi.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/processautomation',
    questionBankModule: 'src/config/processautomation/automationQuestionBank.ts',
    expectedQuestionNodeCount: 7,
    bankBackedPhaseIds: ['process-mapping', 'measurement', 'redesign'],
    rendererComponent: 'src/components/DiscoveryTools/ToolCanvas.tsx (gałąź process-automation)',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Lean redesign procesu i automatyzacja (map/standardize/automate/sustain)',
    commonlyAttributedTo: 'Dyscyplina Lean/BPR (generyczna, bez jednego właściciela)',
    sourceUsed: 'src/config/processautomation/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: '„Lean" użyte opisowo; brak powiązania z konkretną jednostką certyfikującą.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'Repo nazywa to „dyscypliną Lean", ale nie cytuje żadnego zewnętrznego dokumentu Lean.',
  },
};
