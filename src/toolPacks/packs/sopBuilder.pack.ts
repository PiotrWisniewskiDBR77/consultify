/**
 * Tool Pack — SOP Builder (operational, enforceable standard-operating-procedure discipline).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/sopbuilder/moveValidator.ts` (ocena egzekwowalności: mierzalność
 *   standardów × pokrycie checklistą, detekcja luk, sekwencja rollout W2)
 * - `src/config/sopbuilder/sopBuilderQuestionBank.ts` (4-poziomowa drabinka:
 *   roszczenie standardu → wymuszony pomiar → weryfikacja → wdrożenie)
 * - `src/config/sopbuilder/deepeningLadder.ts` (drabinka pogłębiająca per sekcja)
 * - `src/config/sopbuilder/conclusionPrompts.ts` (kontrakt promptu konkluzji)
 * - `src/store/useToolStore.ts` SOP_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 *
 * Id faz są ZGODNE z runtime: context/standards/checklists/summary
 * (src/store/useToolStore.ts:1830-1867, SOP_STEPS). SOP Builder jest narzędziem
 * OPERACYJNYM z krótszym, dwuczłonowym rdzeniem analitycznym (standards→
 * checklists) niż strategiczny wzorzec 5-fazowy Dynamic SWOT — dokładnie te dwie
 * sekcje niesie silnik (SOP_SECTIONS w deepeningLadder.ts), pack tego nie rozszerza.
 */

import { type ToolPack } from '../contract';

export const sopBuilderPack: ToolPack = {
  toolType: 'sop-builder',
  displayName: { pl: 'SOP Builder', en: 'SOP Builder' },
  category: 'operational',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/sopbuilder/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/sopbuilder/sopBuilderQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/sopbuilder/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/sopbuilder/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (SOP_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Standard Operating Procedure — ogólna dyscyplina zarządzania jakością/operacjami (ISO 9001, Lean standard work), bez jednego autora',
      verifiableInRepo: false,
      note: 'SOP jako format nie ma pojedynczego właściciela metodycznego; w repo brak pliku źródłowego z konkretną atrybucją — nie zgadujemy.',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Budowniczy standardów operacyjnych, który wymusza mierzalny próg pass/fail i punkt weryfikacji dla każdego standardu, zanim uzna go za egzekwowalny.',
      en: 'A standard-operating-procedure builder that forces a measurable pass/fail threshold and a verification point for every standard before treating it as enforceable.',
    },
    whatItIsNot: {
      pl: 'To nie jest dokument z opisem intencji („rób to dobrze") ani lista dobrych praktyk do poczytania. Standard bez progu i bez checklisty weryfikującej jest w tym narzędziu fikcją zgodności.',
      en: 'It is not a statement of intent ("do this well") or a list of best practices to read. A standard with no threshold and no verifying checklist is a compliance fiction in this tool.',
    },
    whenToUse: {
      pl: 'Gdy chcecie ustandaryzować powtarzalną pracę tak, by wynik nie zależał od tego, kto ją wykonuje — nowa linia, nowy proces, powtarzający się defekt z rozjazdu wykonania.',
      en: 'When you want to standardize repeatable work so the result does not depend on who performs it — a new line, a new process, a recurring defect from execution drift.',
    },
    whenNotToUse: {
      pl: 'Gdy problem jest jednorazowy albo przyczyna jest nieznana (użyj A3) — SOP zamraża sposób pracy, więc zamrożenie nieznanej lub błędnej metody szkodzi.',
      en: 'When the problem is one-off or the cause is unknown (use A3) — an SOP freezes a way of working, so freezing an unknown or wrong method causes harm.',
    },
    whyItMatters: {
      pl: 'Silnik liczy egzekwowalność deterministycznie (mierzalność progu × pokrycie checklistą) i nazywa dokładnie, ile standardów jest ocenianych „na oko" oraz ile nie ma punktu weryfikacji — więc SOP kończy się kontrolą, nie tylko dokumentem.',
      en: 'The engine computes enforceability deterministically (threshold measurability × checklist coverage) and names exactly how many standards are judged "by eye" and how many lack a verification point — so the SOP ends as a control, not just a document.',
    },
    inputsRequired: {
      pl: 'Krytyczne operacje w zakresie, dostęp do osoby wykonującej pracę na co dzień oraz gotowość zespołu do przełożenia intencji na liczbę progu.',
      en: 'The critical operations in scope, access to someone who does the work daily, and the team\'s readiness to turn intent into a threshold number.',
    },
    roles: {
      pl: 'Lider procesu/kierownik operacyjny jako właściciel standardu, operator wykonujący pracę jako źródło realizmu, audytor lub QA jako weryfikator checklisty.',
      en: 'Process lead/operations manager as the standard owner, the operator doing the work as the source of realism, an auditor or QA as the checklist verifier.',
    },
    outcome: {
      pl: 'Standardy z mierzalnym progiem, checklisty pokrywające każdy standard punktem pass/fail, sekwencja wdrożenia (skwantyfikuj → pokryj → pilotaż → zamknij pętlę), kandydaci na inicjatywy.',
      en: 'Standards with a measurable threshold, checklists covering every standard with a pass/fail point, a rollout sequence (quantify → cover → pilot → close the loop), initiative candidates.',
    },
    estimatedEffort: '2-3h sesji roboczej + pilotaż na jednej zmianie przed pełnym wdrożeniem',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Zamienić intencję („rób to dobrze") w egzekwowalny standard z mierzalnym progiem i punktem weryfikacji.',
    en: 'Turn intent ("do this well") into an enforceable standard with a measurable threshold and a verification point.',
  },
  useCases: [
    'Standaryzacja nowej linii lub nowego procesu przed skalowaniem',
    'Powtarzający się defekt wynikający z rozjazdu wykonania między zmianami/operatorami',
    'Przygotowanie do audytu zgodności lub certyfikacji',
  ],
  contraindications: [
    'Przyczyna problemu jest nieznana (użyj A3 przed zamrożeniem standardu)',
    'Praca jest jednorazowa, nie powtarzalna — SOP nie ma czego chronić',
    'Brak dostępu do osoby faktycznie wykonującej pracę — standard powstanie bez realizmu',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst SOP', en: 'SOP Context' },
      goal: {
        pl: 'Zdefiniować zakres i krytyczne operacje objęte standardem.',
        en: 'Define the scope and the critical operations the standard covers.',
      },
      whatGoodLooksLike: 'Zakres ograniczony do operacji, które faktycznie powtarzają się i mają wpływ na wynik.',
      evidenceToAskFor: 'Które operacje są krytyczne i dlaczego rozjazd ich wykonania szkodzi.',
      completionCriterion: 'Zakres i lista krytycznych operacji zaakceptowane przez właściciela procesu.',
    },
    {
      id: 'standards',
      title: { pl: 'Standardy', en: 'Standards' },
      goal: {
        pl: 'Zapisać standardy jako granice pass/fail z mierzalnym progiem, nie jako opis intencji.',
        en: 'Write standards as pass/fail boundaries with a measurable threshold, not statements of intent.',
      },
      whatGoodLooksLike:
        'Każdy standard ma próg (threshold/target) lub czas trwania — dwóch operatorów czytających go dochodzi do tego samego werdyktu.',
      evidenceToAskFor: 'Czy standard jest granicą pass/fail, czy opisem intencji („rób to dobrze").',
      completionCriterion: 'Co najmniej jeden standard z mierzalnym progiem (isMeasurable, moveValidator.ts).',
    },
    {
      id: 'checklists',
      title: { pl: 'Checklisty', en: 'Checklists' },
      goal: {
        pl: 'Pokryć każdy standard punktem weryfikacji pass/fail.',
        en: 'Cover every standard with a pass/fail verification point.',
      },
      whatGoodLooksLike:
        'Liczba pozycji checklisty ≥ liczba standardów (brak coverage-gap); każda pozycja realnie testuje odpowiadający standard, nie poleganie na pamięci operatora.',
      evidenceToAskFor: 'Który standard testuje ta pozycja checklisty i jak wygląda jej weryfikacja.',
      completionCriterion: 'Brak luki pokrycia (coverageGap=false w assessSop) między standardami a checklistami.',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Zsyntetyzować SOP w werdykt egzekwowalności i wygenerować kandydatów na inicjatywy.',
        en: 'Synthesize the SOP into an enforceability verdict and generate initiative candidates.',
      },
      whatGoodLooksLike:
        'Werdykt answer-first: SOP egzekwowalny albo nazwana bramka, która to blokuje; sekwencja W2 zmapowana na 3-5 inicjatyw zachowujących kolejność.',
      evidenceToAskFor: 'Czy werdykt wynika z assessSop (mierzalność × pokrycie), nie z wrażenia.',
      completionCriterion:
        'enforceable=true (standardy istnieją, checklisty istnieją, ≥50% standardów mierzalnych) i każdy ruch W2 przeszedł walidator.',
    },
  ],

  questions: [
    {
      id: 'sop-context-scope',
      phaseId: 'context',
      prompt: {
        pl: 'Które operacje w tym zakresie są krytyczne — czyli rozjazd ich wykonania między ludźmi realnie kosztuje?',
        en: 'Which operations in this scope are critical — meaning execution drift between people actually costs something?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć zakres „wszystko" — SOP obejmujący każdą czynność bez priorytetu produkuje dokument, którego nikt nie czyta.',
    },
    {
      id: 'sop-standard-claim',
      phaseId: 'standards',
      prompt: {
        pl: 'Podaj standard dokładnie tak, jak powinien brzmieć na hali. Czy to jasna granica pass/fail, czy opis intencji?',
        en: 'State the standard exactly as it should read on the floor. Is it a clear pass/fail boundary, or a description of intent?',
      },
      answerType: 'text',
      challengeRule:
        'Standard bez mierzalnego progu (threshold/target/duration) to opis intencji, nie standard — sopBuilderQuestionBank.ts wymusza pomiar w pętli "sop-measure-force", dopóki nie powstanie liczba.',
      followUpProbes: ['Czy dwóch różnych operatorów mogłoby przeczytać ten standard i dojść do różnych werdyktów?'],
    },
    {
      id: 'sop-checklist-coverage',
      phaseId: 'checklists',
      prompt: {
        pl: 'Który standard testuje ta pozycja checklisty i co konkretnie sprawdza jako pass/fail?',
        en: 'Which standard does this checklist item test, and what exactly does it check as pass/fail?',
      },
      answerType: 'list',
      challengeRule:
        'Pozycja checklisty niepowiązana z żadnym standardem albo poleganie na „pamięci operatora" zamiast punktu weryfikacji nie liczy się jako pokrycie (moveValidator.ts coverage-gap).',
    },
    {
      id: 'sop-rollout-pilot',
      phaseId: 'summary',
      prompt: {
        pl: 'Czy zwalidujecie SOP małym pilotażem (jedna zmiana/linia) przed narzuceniem go wszędzie, czy wdrażacie od razu w pełni?',
        en: 'Will you validate the SOP with a small pilot (one shift/line) before mandating it everywhere, or roll out in full immediately?',
      },
      answerType: 'choice',
      challengeRule:
        'SOP narzucony bez pilotażu generuje ciche obejścia i fikcję zgodności — pilotaż jest zawsze krokiem w sekwencji W2 (moveValidator.ts validate-first), nie opcjonalnym dodatkiem.',
    },
  ],

  classificationRules:
    'Standard jest MIERZALNY, gdy niesie threshold, target lub durationMinutes (isMeasurable, ' +
    'moveValidator.ts). SOP jest EGZEKWOWALNY tylko gdy: standardy istnieją ORAZ checklisty istnieją ORAZ ' +
    '≥50% standardów jest mierzalnych (measurableRatio ≥ 0.5, assessSop enforceable).',
  evidenceExpectations:
    'Każdy standard bez progu jest oznaczony jako oceniany „na oko" (unmeasurableStandards) i wprost ' +
    'nazwany w werdykcie, nigdy przedstawiany jako egzekwowalny. Checklisty krótsze niż lista standardów ' +
    'są jawną luką pokrycia (coverageGap), nie pomijane milcząco.',
  relationships:
    'Standardy i checklisty są dwiema sekcjami tej samej pętli kontroli: standard bez odpowiadającej ' +
    'pozycji checklisty jest fikcją zgodności (assessSop coverageGap); checklista bez standardu nie ma czego ' +
    'testować. Sekwencja W2 wiąże obie strony w kolejności zależności (quantify → cover → pilot → assign-owner).',
  interpretationRules:
    'Czytaj werdykt assessSop, nie surową liczbę pozycji: pusty standards → SOP pusty; puste checklists → ' +
    'fikcja zgodności; unmeasurableStandards > 0 → nieegzekwowalne mimo istniejących checklist; coverageGap ' +
    '→ część zgodności nieweryfikowana mimo mierzalnych standardów. Każdy stan ma inny pierwszy ruch W2.',
  completionCriteria:
    'SOP jest egzekwowalny, gdy: (1) co najmniej jeden standard i jedna checklista istnieją; (2) ' +
    'measurableRatio standardów ≥ 0.5; (3) brak coverageGap (liczba pozycji checklisty ≥ liczba standardów); ' +
    '(4) każdy ruch sekwencji W2 przechodzi validateW2Move (rationale + trade-off + odrzucona alternatywa).',

  signatureArchetype: 'operating-model-standard',
  signatureRationale:
    'SOP Builder jest z natury modelem operacyjnym: standard → punkt weryfikacji → właściciel → rytm audytu. ' +
    'Geometria musi pokazywać parowanie standard↔checklista i status egzekwowalności każdej pary, nie cztery ' +
    'niezależne ćwiartki ani łańcuch przyczynowy.',

  mapping: {
    output:
      'Niezmienny snapshot: standardy z progami i statusem mierzalności, checklisty z pokryciem, werdykt ' +
      'egzekwowalności, sekwencja rollout W2 z trade-offami.',
    report:
      'Sekcja standaryzacji operacyjnej: para standard↔checklista jako grafika sygnaturowa + luki pokrycia ' +
      'jako narracja argument→dowód→implikacja. Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Sekwencja W2 (buildW2MoveSequence) mapuje się na kandydatów inicjatyw zachowujących kolejność: ' +
      'quantify-standard → cover-with-checklist → validate-first (pilotaż) → assign-owner (zamknięcie pętli).',
  },

  conclusion: {
    k1FactSource:
      'sopbuilder/moveValidator.assessSop — score, criticality, measurableRatio per sekcja oraz ' +
      'unmeasurableStandards/coverageGap liczone deterministycznie z pozycji standardów i checklist. ' +
      'Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie standardy i checklisty tej sesji oraz ich progi/pokrycie. Zakaz benchmarków branżowych ' +
      'spoza wsadu — „ile powinien wynosić próg" pochodzi wyłącznie z decyzji zespołu w sesji.',
    k3PrioritySource:
      'Kolejność z sekwencji W2 silnika (buildW2MoveSequence): skwantyfikuj niemierzalne standardy → ' +
      'pokryj lukę checklistą → pilotaż → zamknij pętlę właścicielem. Model formułuje treść, nie kolejność.',
    k4EffectRule:
      'Efekt musi być zmianą wskaźnika zgodności/defektów, obserwowalną w rytmie audytu, z horyzontem ' +
      'czasowym. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje: rationale, trade-off (co kosztuje) i odrzuconą alternatywę (moveValidator.ts ' +
      'W2MoveInput). Ruch bez kompletnego trade-offu nie przechodzi walidatora.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/sopbuilder',
    questionBankModule: 'src/config/sopbuilder/sopBuilderQuestionBank.ts',
    expectedQuestionNodeCount: 5,
    bankBackedPhaseIds: ['standards', 'checklists'],
    rendererComponent: 'src/components/DiscoveryTools/tools/Operational',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Standardowa procedura operacyjna (SOP)',
    commonlyAttributedTo: 'Brak jednego autora — praktyka jakości/operacji (linia ISO 9001 / standard work)',
    sourceUsed: 'src/config/sopbuilder/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Termin generyczny, brak zidentyfikowanej ekspozycji na znak towarowy.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'NISKIE — „SOP" jest generyczne, ale formalnie niezweryfikowane.',
  },
};
