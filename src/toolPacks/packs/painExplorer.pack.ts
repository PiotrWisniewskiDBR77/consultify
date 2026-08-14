/**
 * Tool Pack — Pain Explorer (odkrywanie i diagnoza bólów procesowych).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/painexplorer/painSynthesisEngine.ts` (baseline bólu,
 *   scoring czterech etapów, sekwencja ruchów W2, wykrywanie luk portfela —
 *   jedyny dopuszczalny generator liczb)
 * - `src/config/painexplorer/deepeningLadder.ts` (4 kanoniczne etapy
 *   odkrywania bólu + drabinka pogłębiająca per etap)
 * - `src/config/painexplorer/painExplorerQuestionBank.ts` (rozgałęziony bank
 *   pytań, wymuszona pętla `pain-qualify-force` na niepotwierdzonym bólu)
 * - `src/config/painexplorer/conclusionPrompts.ts` (kontrakt promptu W2)
 * - `src/store/useToolStore.ts` PAIN_EXPLORER_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (context/problems/hypotheses/evidence-gaps/
 * summary) — pack nie wprowadza równoległej nomenklatury. Silnik operuje
 * własnym słownikiem czterech etapów diagnozy (detect/qualify/measure/
 * diagnose, PAIN_STAGES w deepeningLadder.ts) — to kategorie, do których
 * użytkownik przypisuje bóle i propozycje rozwiązań wewnątrz faz runtime
 * `problems`/`hypotheses`/`evidence-gaps`.
 *
 * STAN UI: narzędzie ma kompletny silnik metody, ale NIE MA dedykowanej
 * gałęzi w `ToolCanvas.tsx` — dziś renderuje się generycznym fallbackiem.
 * To luka montażu UI, nie luka treści (patrz `signatureRationale`).
 */

import { EVIDENCE_MISSING, type ToolPack } from '../contract';

export const painExplorerPack: ToolPack = {
  toolType: 'pain-explorer',
  displayName: { pl: 'Pain Explorer', en: 'Pain Explorer' },
  category: 'digital',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna; runtime DoD (Output/Report/approval, montaż w ToolCanvas)
  // jeszcze niedowieziony — dlatego NIE RUNTIME_ACTIVE.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/painexplorer/painSynthesisEngine.ts', verifiableInRepo: true },
    { source: 'src/config/painexplorer/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/painexplorer/painExplorerQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/painexplorer/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/config/painexplorer/index.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (PAIN_EXPLORER_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
  ],

  library: {
    whatItIs: {
      pl: 'Diagnoza bólów procesowych, która kończy się nazwaną przyczyną źródłową, a nie listą narzekań.',
      en: 'A process-pain diagnosis that ends in a named root cause, not a list of complaints.',
    },
    whatItIsNot: {
      pl: 'To nie jest ankieta satysfakcji ani skrzynka skarg. Ból zgłoszony przez jedną osobę bez drugiego źródła nie wchodzi do kwantyfikacji jako fakt systemowy.',
      en: 'It is not a satisfaction survey or a complaints box. A pain raised by one person with no second source does not enter quantification as a system fact.',
    },
    whenToUse: {
      pl: 'Gdy trzeba znaleźć realną przyczynę powtarzającego się problemu operacyjnego, zanim zainwestujecie w rozwiązanie.',
      en: 'When you need to find the real cause of a recurring operational problem before investing in a fix.',
    },
    whenNotToUse: {
      pl: 'Gdy przyczyna jest już znana i potwierdzona — wtedy właściwe jest wdrożenie rozwiązania (np. Process Automation), nie kolejna diagnoza.',
      en: 'When the cause is already known and confirmed — implementing a fix (e.g. Process Automation) fits better than another diagnosis.',
    },
    whyItMatters: {
      pl: 'Silnik chroni kolejność odkrywania (wykryj → zakwalifikuj → zmierz → zdiagnozuj), więc żaden ruch nie leczy objawu, do którego ból wraca po miesiącu.',
      en: 'The engine protects the discovery order (detect → qualify → measure → diagnose), so no move treats a symptom the pain returns to within a month.',
    },
    inputsRequired: {
      pl: 'Proces objęty diagnozą, dostęp do co najmniej dwóch niezależnych źródeł na każdy ból, osoba znająca realny przebieg pracy.',
      en: 'The process under diagnosis, access to at least two independent sources per pain, and someone who knows the real workflow.',
    },
    roles: {
      pl: 'Właściciel procesu, lider operacyjny, analityk zbierający dowody kosztu.',
      en: 'Process owner, operations lead, analyst gathering cost evidence.',
    },
    outcome: {
      pl: 'Baza portfela bólu, ranking czterech etapów diagnozy i W2-zwalidowana sekwencja ruchów kończąca się na przyczynie źródłowej.',
      en: 'A pain-portfolio baseline, a ranking of the four diagnosis stages, and a W2-validated move sequence ending at the root cause.',
    },
    estimatedEffort: '90-150 min sesji roboczej',
    // Metoda oparta na klasycznej dyscyplinie 5×dlaczego/root-cause; brak noty
    // licencyjnej w repo — nie zgadujemy.
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Odróżnić realny, systemowy ból od preferencji jednej osoby i doprowadzić go do przyczyny źródłowej.',
    en: 'Separate a real, systemic pain from one person’s preference and trace it to its root cause.',
  },
  useCases: [
    'Diagnoza powtarzającego się problemu operacyjnego przed wyborem rozwiązania',
    'Ocena zgłoszeń "to nas boli" napływających z zespołów',
    'Przygotowanie uzasadnienia inwestycji w naprawę przed zarządem',
  ],
  contraindications: [
    'Przyczyna źródłowa już znana i potwierdzona (przejdź do wdrożenia rozwiązania)',
    'Pojedyncze zgłoszenie bez możliwości znalezienia drugiego źródła',
    'Cel to wyłącznie udokumentowanie frustracji, nie zmiana procesu',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst bólu', en: 'Pain Context' },
      goal: {
        pl: 'Zdefiniować proces, interesariuszy i powierzchnię bólu.',
        en: 'Define the process, stakeholders, and pain surface.',
      },
      whatGoodLooksLike: 'Nazwany proces, lista interesariuszy dotkniętych bólem i horyzont decyzji.',
      evidenceToAskFor: 'Który proces boli, kogo dotyka i jak długo trwa problem.',
      completionCriterion: 'Powierzchnia bólu zaakceptowana przez właściciela procesu.',
    },
    {
      id: 'problems',
      title: { pl: 'Problemy', en: 'Problems' },
      goal: {
        pl: 'Zebrać zaobserwowane problemy i ich objawy.',
        en: 'Capture the observed problems and their symptoms.',
      },
      whatGoodLooksLike: 'Każdy ból podany dokładnie tak, jak opisałaby go osoba, która go odczuwa, z co najmniej jednym niezależnym źródłem.',
      evidenceToAskFor: 'Czy więcej niż jedna niezależna osoba/źródło zgłosiła ten sam ból (painExplorerQuestionBank.ts: pain-surface).',
      completionCriterion: 'Co najmniej jeden ból ma potwierdzenie z drugiego, niezależnego źródła (pętla pain-qualify-force nie blokuje dalej).',
    },
    {
      id: 'hypotheses',
      title: { pl: 'Hipotezy', en: 'Hypotheses' },
      goal: {
        pl: 'Sformułować hipotezy przyczyn źródłowych do walidacji.',
        en: 'Frame root-cause hypotheses to validate.',
      },
      whatGoodLooksLike: 'Każda hipoteza rozróżnia, czy ból jest usuwalnym rootem, czy downstreamowym objawem (PainNature: root/symptom).',
      evidenceToAskFor: 'Co się stanie z bólem, jeśli naprawicie tylko objaw, a nie źródło.',
      completionCriterion: 'Co najmniej jeden ból ma jawnie oznaczoną naturę (root/symptom).',
    },
    {
      id: 'evidence-gaps',
      title: { pl: 'Luki w dowodach', en: 'Evidence gaps' },
      goal: {
        pl: 'Wypisać dowody potrzebne do potwierdzenia każdej hipotezy.',
        en: 'List the evidence still needed to confirm each hypothesis.',
      },
      whatGoodLooksLike: 'Koszt bólu (minuty × wystąpienia × zasięg) jest zmierzony, nie zgadywany, zwłaszcza dla bólu o najwyższym koszcie.',
      evidenceToAskFor: 'Skąd wiadomo, że minuty/wystąpienia są policzone, a nie oszacowane "na oko".',
      completionCriterion: 'Najdroższy ból (topPainMinutes) ma zmierzony koszt (painSynthesisEngine.ts: detectPainGaps — unmeasured-top-pain = brak).',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Podsumować bóle i wygenerować inicjatywy.',
        en: 'Summarize pains and generate initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch ma rationale, trade-off i odrzucony wariant, a sekwencja kończy się diagnozą przyczyny źródłowej.',
      evidenceToAskFor: 'Co świadomie odraczamy (leczenie objawu) i pod jakim warunkiem to akceptujemy.',
      completionCriterion: 'Sekwencja ruchów spełnia bramkę W2 (buildW2MoveSequence + validateW2Move: valid=true dla każdego ruchu).',
    },
  ],

  questions: [
    {
      id: 'pain-context-surface',
      phaseId: 'context',
      prompt: {
        pl: 'Który proces boli i kogo dotyka ten ból dziś?',
        en: 'Which process hurts, and who does this pain touch today?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez nazwanego procesu ("praca jest chaotyczna" = za ogólne) — wymagaj konkretnego procesu i grupy dotkniętej bólem.',
      followUpProbes: ['Od kiedy ten ból występuje?', 'Kto najgłośniej go zgłasza, a kto milczy?'],
    },
    {
      id: 'pain-problems-corroboration',
      phaseId: 'problems',
      prompt: {
        pl: 'Czy ten ból zgłosiła więcej niż jedna niezależna osoba lub źródło, czy to jeden głos?',
        en: 'Did more than one independent person or source raise this pain, or is it one voice?',
      },
      answerType: 'evidence',
      challengeRule:
        'Główny tryb porażki metody: ból zgłoszony bez potwierdzenia w drugim, niezależnym źródle jest zablokowany pętlą wymuszoną (painExplorerQuestionBank.ts: pain-qualify-force) — "wszyscy pewnie to czują" nie liczy się jako drugie źródło.',
    },
    {
      id: 'pain-hypotheses-nature',
      phaseId: 'hypotheses',
      prompt: {
        pl: 'Czy ten ból jest usuwalną przyczyną, czy downstreamowym objawem czegoś innego?',
        en: 'Is this pain a removable root cause, or a downstream symptom of something else?',
      },
      answerType: 'choice',
      challengeRule:
        'Hipoteza, która nazywa objaw rootem bez sprawdzenia, co go napędza, jest podejrzana — leczenie objawu, którego przyczyna trwa, tylko przesuwa ból w czasie (painSynthesisEngine.ts: buildW2MoveSequence, ruch "diagnose").',
    },
    {
      id: 'pain-evidence-quantification',
      phaseId: 'evidence-gaps',
      prompt: {
        pl: 'Ile minut traci się na jedno wystąpienie tego bólu, ile razy w roku i ile osób to dotyka — masz liczby, czy zgadujesz?',
        en: 'How many minutes does one occurrence of this pain cost, how often per year, and how many people does it touch — do you have numbers, or a guess?',
      },
      answerType: 'text',
      challengeRule:
        'Ból stwierdzony bez kwantyfikacji (minuty × wystąpienia × zasięg) nie wchodzi do rankingu jako fakt kosztowy — zwłaszcza gdy jest to najdroższy ból portfela, ranking wciąż jest zgadywaniem dla tego, który waży najwięcej (painSynthesisEngine.ts: detectPainGaps — unmeasured-top-pain).',
    },
    {
      id: 'pain-summary-tradeoff',
      phaseId: 'summary',
      prompt: {
        pl: 'Co świadomie odrzucacie, wybierając diagnozę przyczyny źródłowej zamiast szybkiej łatki objawu, i jakim kosztem?',
        en: 'What are you deliberately giving up by choosing root-cause diagnosis over a quick symptom patch, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch bez odrzuconego wariantu nie przechodzi bramki W2 (painSynthesisEngine.ts: validateW2Move — rejectedVariant nie może być puste ani krótsze niż 12 znaków).',
    },
  ],

  classificationRules:
    'Bóle są klasyfikowane wg natury (PainNature: root/symptom) i przypisania do jednego z czterech ' +
    'etapów (PAIN_STAGES: detect/qualify/measure/diagnose, deepeningLadder.ts). Ból wchodzi do ' +
    'rankingu tylko z przypisanym etapem i co najmniej jedną propozycją rozwiązania (painSynthesisEngine.ts: scoreStage).',
  evidenceExpectations:
    'Koszt bólu (minutesPerOccurrence × occurrencesPerYear × reach) ma status measured (true/false); ' +
    'measured=false = szacunek, nie liczony jako zaufany dowód. Rozwiązanie bez evidence[] nie liczy ' +
    'się do evidenceBacked i obniża feasibility etapu.',
  relationships:
    'Score etapu = attractiveness (średni impact rozwiązań) × feasibility (łatwość: niski effort + ' +
    'evidence). Etap "measure" obejmuje bóle wciąż bez zmierzonego kosztu; etap "diagnose" chroni bóle ' +
    'oznaczone jako usuwalny root (painSynthesisEngine.ts: minutesForStage). Ranking honoruje porządek ' +
    'kanoniczny przy remisach — nie diagnozujemy bólu, którego jeszcze nie zmierzyliśmy.',
  interpretationRules:
    'Czytaj ranking etapów i luki portfela, nie surową listę bólów. Ból oznaczony jako usuwalny root ' +
    'bez żadnej propozycji rozwiązania to diagnoza, na którą nic nie działa (painSynthesisEngine.ts: ' +
    'detectPainGaps — root-with-no-solution). Najdroższy ból bez zmierzonego kosztu to ranking wciąż ' +
    'zgadywany dla tego, który waży najwięcej.',
  completionCriteria:
    'Co najmniej jeden etap ma zaakceptowany ból i propozycję rozwiązania; ranking policzony przez ' +
    'silnik; każdy rekomendowany ruch spełnia bramkę W2 (rationale + trade-off + odrzucony wariant, ' +
    'min. 12 znaków każdy — painSynthesisEngine.ts: MIN_JUSTIFICATION_LEN).',

  signatureArchetype: 'causal-problem-solving',
  signatureRationale:
    'Pain Explorer prowadzi od zgłoszonego objawu do przyczyny źródłowej przez cztery etapy ' +
    'sekwencyjne (wykryj → zakwalifikuj → zmierz → zdiagnozuj) — geometria łańcucha przyczynowego ' +
    'pokazuje, gdzie ból traci status "systemowy" i staje się preferencją jednej osoby, zamiast płaskiej ' +
    'listy skarg. Narzędzie nie ma dziś dedykowanej gałęzi w ToolCanvas.tsx (renderuje się fallbackiem) ' +
    '— geometria łańcucha jest tym, co trzeba zamontować, nie zaprojektować od nowa.',

  mapping: {
    output:
      'Niezmienny snapshot: baza portfela bólu (painCount, rootCount, annualMinutesLost, ' +
      'topPainMinutes), ranking czterech etapów z rationale i W2-zwalidowana sekwencja kończąca się ' +
      'diagnozą przyczyny źródłowej.',
    report:
      'Sekcja diagnozy operacyjnej: łańcuch etapów jako grafika sygnaturowa + sekwencja ruchów jako ' +
      'narracja rationale → trade-off → odrzucony wariant. Renderowane deterministycznie z tego samego ' +
      'Artifact.',
    initiative:
      'Każdy zwalidowany ruch W2 staje się kandydatem na inicjatywę; etap wyznacza typ (detect/qualify ' +
      '→ zdolność diagnostyczna, measure → dowód kosztu, diagnose → naprawa źródła).',
  },

  conclusion: {
    k1FactSource:
      'painSynthesisEngine.ts: computeBaseline (painCount, rootCount, annualMinutesLost, ' +
      'topPainMinutes, evidenceRatio, measuredRatio) + rankPainStages (score per etap) + ' +
      'buildW2MoveSequence + detectPainGaps — wszystkie liczby liczone deterministycznie z sesji, ' +
      'żadna nie pochodzi z LLM.',
    k2GroundingScope:
      'Wyłącznie bóle i rozwiązania sesji, ich dowody i profil organizacji. Zakaz przywoływania ' +
      'ogólnych statystyk o "typowych bolączkach branży" spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankingu wagi etapów (attractiveness × feasibility, painSynthesisEngine.ts: ' +
      'scoreStage) z twardym tie-breakiem na porządku kanonicznym. Model formułuje treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z sekwencji ruchów, mieć horyzont czasowy i wskazywać rolę odpowiedzialną. ' +
      'Minuty wyłącznie z annualMinutesLost — bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje: rationale, trade-off i odrzucony wariant (W2, painSynthesisEngine.ts: ' +
      'validateW2Move). Ruch bez odrzuconego wariantu nie przechodzi.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/painexplorer',
    questionBankModule: 'src/config/painexplorer/painExplorerQuestionBank.ts',
    expectedQuestionNodeCount: 4,
    bankBackedPhaseIds: ['problems', 'hypotheses', 'evidence-gaps'],
    rendererComponent: EVIDENCE_MISSING,
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Odkrywanie problemów i przyczyn źródłowych (detect/qualify/measure/diagnose)',
    commonlyAttributedTo: 'Linia 5-Why / Lean problem solving (generyczna, bez jednego właściciela)',
    sourceUsed: 'src/config/painexplorer/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: '„5-Why" wymienione w komentarzach generycznie, nie jako zasób licencjonowany.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'Prawdopodobny potomek generycznej analizy przyczyn źródłowych; brak jawnego cytowania w repo.',
  },
};
