/**
 * Tool Pack — DMS Builder (operational, Daily Management System / control-loop discipline).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/dmsbuilder/managementSystemEngine.ts` (dojrzałość pętli kontroli
 *   na 4 warstwach: visibility/cadence/escalation/response, ranking najsłabsza-
 *   pierwsza, detekcja luk, sekwencja ruchów W2)
 * - `src/config/dmsbuilder/dmsBuilderQuestionBank.ts` (4-poziomowa drabinka:
 *   roszczenie KPI → wymuszony rytm → eskalacja → domknięcie reakcji)
 * - `src/config/dmsbuilder/deepeningLadder.ts` (drabinka pogłębiająca per warstwa)
 * - `src/config/dmsbuilder/conclusionPrompts.ts` (kontrakt promptu konkluzji)
 * - `src/store/useToolStore.ts` DMS_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2
 *
 * Id faz są ZGODNE z runtime: context/kpis/escalation/summary
 * (src/store/useToolStore.ts:1956-1993, DMS_STEPS). DMS Builder jest narzędziem
 * OPERACYJNYM z krótkim rdzeniem analitycznym (kpis→escalation), krótszym niż
 * strategiczny wzorzec 5-fazowy Dynamic SWOT. Wewnętrznie silnik ocenia dojrzałość
 * pętli na 4 warstwach (visibility/cadence/escalation/response) jako wymiar
 * rankingu wewnątrz dwóch kroków runtime, nie jako osobne fazy.
 */

import { type ToolPack } from '../contract';

export const dmsBuilderPack: ToolPack = {
  toolType: 'dms-builder',
  displayName: { pl: 'DMS Builder', en: 'DMS Builder' },
  category: 'operational',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/dmsbuilder/managementSystemEngine.ts', verifiableInRepo: true },
    { source: 'src/config/dmsbuilder/dmsBuilderQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/dmsbuilder/deepeningLadder.ts', verifiableInRepo: true },
    { source: 'src/config/dmsbuilder/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (DMS_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Daily Management System / tiered huddle boards — Lean operations management practice',
      verifiableInRepo: false,
      note: 'DMS jest powszechną praktyką zarządzania operacyjnego (Lean), bez jednego autora metodycznego. Repo nie zawiera pliku źródłowego z atrybucją — nie zgadujemy.',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Budowniczy systemu zarządzania dziennego (DMS), który ocenia pętlę kontroli na czterech warstwach — widoczność, rytm, eskalacja, reakcja — i naprawia ją od najsłabszego ogniwa.',
      en: 'A Daily Management System builder that assesses the control loop across four layers — visibility, cadence, escalation, response — and repairs it from its weakest link.',
    },
    whatItIsNot: {
      pl: 'To nie jest tablica KPI do powieszenia na ścianie. Wskaźniki bez rytmu przeglądu, eskalacji i akcji naprawczej to widoczność bez kontroli — silnik nazywa to wprost, nie przepuszcza jako gotowy DMS.',
      en: 'It is not a KPI board to hang on the wall. Metrics with no review cadence, escalation, or countermeasure are visibility without control — the engine names this plainly, it does not pass it off as a finished DMS.',
    },
    whenToUse: {
      pl: 'Gdy problemy operacyjne są wykrywane za późno albo eskalują przypadkowo, i chcecie zbudować regularną pętlę: zobacz → oceń → eskaluj → zareaguj.',
      en: 'When operational problems are caught too late or escalate haphazardly, and you want a regular loop: see → assess → escalate → respond.',
    },
    whenNotToUse: {
      pl: 'Gdy brakuje jeszcze samych danych operacyjnych do pomiaru — najpierw zbudujcie pomiar, potem system zarządzania nim.',
      en: 'When the underlying operational data does not exist yet — build the measurement first, then the management system around it.',
    },
    whyItMatters: {
      pl: 'Silnik liczy dojrzałość każdej warstwy pętli (0-3) deterministycznie z faktów sesji i rankinguje warstwy najsłabsza-pierwsza, więc rekomendacja mówi dokładnie, które ogniwo naprawić najpierw — nie „popraw komunikację".',
      en: 'The engine scores each loop layer\'s maturity (0-3) deterministically from session facts and ranks layers weakest-first, so the recommendation says exactly which link to fix first — not "improve communication".',
    },
    inputsRequired: {
      pl: 'Kandydaci na wskaźniki „nieliczne właściwe" (4-8), obecny (lub jego brak) rytm przeglądu oraz opis, co się dzieje dziś, gdy wskaźnik zjeżdża poza cel.',
      en: 'Candidate "vital few" KPIs (4-8), the current (or absent) review cadence, and a description of what happens today when a KPI drifts off target.',
    },
    roles: {
      pl: 'Lider zmiany/kierownik operacyjny jako właściciel pętli, kierownictwo wyższego szczebla jako adresat eskalacji, analityk dostarczający dane wskaźników.',
      en: 'Shift lead/operations manager as the loop owner, senior management as the escalation target, an analyst supplying the KPI data.',
    },
    outcome: {
      pl: 'Mapa dojrzałości pętli kontroli (4 warstwy), ranking najsłabsza-pierwsza z uzasadnieniem, sekwencja ruchów naprawiających pętlę z trade-offami, kandydaci na inicjatywy.',
      en: 'A control-loop maturity map (4 layers), a weakest-first ranking with rationale, a loop-repair move sequence with trade-offs, initiative candidates.',
    },
    estimatedEffort: '1.5-2.5h sesji roboczej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Domknąć pętlę zarządzania dziennego tak, by odchylenie wskaźnika kończyło się zweryfikowaną akcją naprawczą, nie ginęło na tablicy.',
    en: 'Close the daily-management loop so a KPI deviation ends in a verified countermeasure, not death on the board.',
  },
  useCases: [
    'Problemy operacyjne wykrywane za późno, po eskalacji do klienta',
    'Tablica KPI istnieje, ale nikt regularnie nie działa na jej podstawie',
    'Brak jasnej ścieżki eskalacji, gdy wskaźnik zjeżdża poza próg',
  ],
  contraindications: [
    'Brak jeszcze samych danych operacyjnych do pomiaru — zbuduj pomiar najpierw',
    'Organizacja nie ma mandatu, by wymusić regularny rytm przeglądu',
    'Potrzebna jest analiza przyczyny konkretnego problemu, nie system zarządzania (użyj A3)',
  ],

  phases: [
    {
      id: 'context',
      title: { pl: 'Kontekst DMS', en: 'DMS Context' },
      goal: {
        pl: 'Zdefiniować zakres i governance systemu zarządzania dziennego.',
        en: 'Define the scope and governance of the daily management system.',
      },
      whatGoodLooksLike: 'Nazwany obszar (linia/zmiana/dział) i poziom zarządczy, który będzie właścicielem pętli.',
      evidenceToAskFor: 'Kto dziś reaguje (jeśli ktokolwiek) na odchylenia w tym obszarze.',
      completionCriterion: 'Zakres i poziom zarządczy zaakceptowane przez sponsora.',
    },
    {
      id: 'kpis',
      title: { pl: 'KPI', en: 'KPIs' },
      goal: {
        pl: 'Zbudować tablicę nielicznych właściwych wskaźników z celami, właścicielami i rytmem przeglądu.',
        en: 'Build a vital-few KPI board with targets, owners, and a review cadence.',
      },
      whatGoodLooksLike:
        '4-8 wskaźników, każdy z celem/progiem, przypisanym właścicielem i nazwanym rytmem przeglądu — nie „kiedy ktoś sobie przypomni".',
      evidenceToAskFor: 'Gdyby ten wskaźnik jutro gwałtownie się zmienił, kto zmieniłby swoje działanie?',
      completionCriterion:
        'Warstwa visibility ma present=true (co najmniej jeden KPI) i warstwa cadence present=true (co najmniej jeden KPI z frequency).',
    },
    {
      id: 'escalation',
      title: { pl: 'Reguły eskalacji', en: 'Escalation Rules' },
      goal: {
        pl: 'Zdefiniować reguły eskalacji z policzonym wyzwalaczem, poziomem docelowym i akcją naprawczą.',
        en: 'Define escalation rules with a quantified trigger, a target level, and a countermeasure.',
      },
      whatGoodLooksLike:
        'Każda reguła ma próg liczbowy + czas, nazwany poziom/rolę eskalacji oraz akcję naprawczą z weryfikacją powrotu wskaźnika na cel.',
      evidenceToAskFor: 'Jaki jest policzony wyzwalacz eskalacji i kto realnie ma władzę zareagować na tym poziomie.',
      completionCriterion:
        'Warstwa escalation present=true (co najmniej jedna reguła) i warstwa response present=true (co najmniej jedna reguła z akcją naprawczą).',
    },
    {
      id: 'summary',
      title: { pl: 'Podsumowanie i inicjatywy', en: 'Summary & Initiatives' },
      goal: {
        pl: 'Zsyntetyzować mapę dojrzałości pętli w werdykt i wygenerować kandydatów na inicjatywy.',
        en: 'Synthesize the loop maturity map into a verdict and generate initiative candidates.',
      },
      whatGoodLooksLike:
        'Werdykt answer-first nazywający najsłabsze ogniwo pętli i jego dojrzałość (0-3); sekwencja W2 zmapowana na 3-5 inicjatyw w porządku pętli (visibility→cadence→escalation→response).',
      evidenceToAskFor: 'Czy werdykt wynika z rankDmsLayers, nie z ogólnego wrażenia „słaba komunikacja".',
      completionCriterion: 'Każdy ruch sekwencji W2 przechodzi walidator (rationale + trade-off + odrzucona alternatywa).',
    },
  ],

  questions: [
    {
      id: 'dms-kpi-vital-few',
      phaseId: 'kpis',
      prompt: {
        pl: 'Nazwij wskaźnik dokładnie tak, jak powinien pojawić się na tablicy. Czy to jeden z nielicznych właściwych, na które zespół codziennie reaguje, czy metryka na pokaz?',
        en: 'Name the KPI exactly as it should appear on the board. Is it one of the vital few the team acts on daily, or a vanity number?',
      },
      answerType: 'choice',
      challengeRule:
        'Metryka, przez którą nikt nie zmienia zachowania, zajmuje miejsce na tablicy, ale nie kontroluje niczego — oznacz do usunięcia albo wymuś realny rytm (dmsBuilderQuestionBank.ts dms-cadence-force).',
      followUpProbes: ['Gdyby ten wskaźnik jutro gwałtownie się zmienił, kto zmieniłby swoje działanie?'],
    },
    {
      id: 'dms-cadence-forced',
      phaseId: 'kpis',
      prompt: {
        pl: 'Jaka jest częstotliwość przeglądu tego wskaźnika — nazwany, stały rytm, czy „kiedy ktoś sobie przypomni"?',
        en: 'What is the review frequency for this KPI — a named, fixed cadence, or "whenever someone remembers"?',
      },
      answerType: 'choice',
      challengeRule:
        'Wskaźnik bez nazwanego rytmu degeneruje się w tapetę — gdyby rytm zaniknął na dwa tygodnie, nikt by tego nie zauważył. Silnik traktuje brak rytmu jako lukę warstwy "cadence" (managementSystemEngine.ts scoreLayer).',
    },
    {
      id: 'dms-escalation-trigger',
      phaseId: 'escalation',
      prompt: {
        pl: 'Jaki jest policzony wyzwalacz eskalacji (próg + czas) i do jakiego konkretnie poziomu/roli ta reguła eskaluje?',
        en: 'What is the quantified escalation trigger (threshold + time), and to exactly which level/role does this rule escalate?',
      },
      answerType: 'text',
      challengeRule:
        '„Zgłaszajcie problemy do kierownika" bez progu i zegara jest uznaniowe i zamiera — reguła bez hasTrigger i hasTargetLevel nie liczy się jako eskalacja (managementSystemEngine.ts).',
    },
    {
      id: 'dms-response-closure',
      phaseId: 'escalation',
      prompt: {
        pl: 'Czy eskalacja kończy się akcją naprawczą z weryfikacją, że wskaźnik wrócił na cel, czy zamyka się „na słowo"?',
        en: 'Does the escalation end in a countermeasure with verification that the KPI returns to target, or does it close "on trust"?',
      },
      answerType: 'text',
      challengeRule:
        'Eskalacja bez zweryfikowanego powrotu na cel nie domyka pętli — ten sam problem wraca. Silnik ocenia to jako lukę warstwy "response" (hasResponse + verifiesEffect).',
    },
    {
      id: 'dms-summary-weakest',
      phaseId: 'summary',
      prompt: {
        pl: 'Które ogniwo pętli (widoczność/rytm/eskalacja/reakcja) jest dziś najsłabsze i dlaczego naprawiacie je przed innymi?',
        en: 'Which loop link (visibility/cadence/escalation/response) is weakest today, and why fix it before the others?',
      },
      answerType: 'text',
      challengeRule:
        'Pętla jest tak mocna jak jej najsłabsze ogniwo — werdykt musi wskazywać konkretną warstwę z liczbą dojrzałości (0-3), nie ogólnikowe „system trzeba usprawnić".',
    },
  ],

  classificationRules:
    'Cztery warstwy pętli kontroli, każda oceniana 0-3 z faktów sesji (managementSystemEngine.ts scoreLayer): ' +
    'VISIBILITY = obecność KPI z celem i właścicielem; CADENCE = udział KPI z nazwaną częstotliwością przeglądu; ' +
    'ESCALATION = udział reguł z policzonym wyzwalaczem i poziomem docelowym; RESPONSE = udział eskalacji z ' +
    'akcją naprawczą i weryfikacją powrotu na cel. Warstwa jest "present" tylko gdy ma choć jeden element.',
  evidenceExpectations:
    'Dojrzałość warstwy jest liczona z konkretnych flag (hasTarget/hasOwner/frequency/hasTrigger/ ' +
    'hasTargetLevel/hasResponse/verifiesEffect), nigdy z deklaracji „mamy dobry system". Brak elementu w ' +
    'warstwie = present=false, jawnie nazwane jako luka (detectDmsGaps).',
  relationships:
    'Cztery warstwy tworzą pętlę zależności: nie da się eskalować sygnału, którego nie widać (visibility), ' +
    'ani reagować na eskalację bez rytmu, który ją wygenerował (cadence). Sekwencja ruchów naprawia od ' +
    'najsłabszej warstwy, ale re-sekwencjonuje wybrane cele do porządku pętli (loopIndex), by nie zamykać ' +
    'downstream warstwy przed jej upstream prerequisitem (buildW2MoveSequence).',
  interpretationRules:
    'Czytaj loopClosed (czy wszystkie warstwy present) razem z loopMaturity (średnia 0-3): loopClosed=false ' +
    'oznacza przerwaną pętlę, gdzie DMS nie kontroluje niczego niezależnie od jakości pozostałych warstw. ' +
    'loopClosed=true z niską loopMaturity oznacza pętlę techniczną istniejącą, ale słabą — inny typ ruchu.',
  completionCriteria:
    'Sekwencja W2 jest kompletna, gdy: (1) co najmniej jedna warstwa jest present; (2) ranking wskazuje ' +
    'najsłabsze ogniwo z liczbą dojrzałości; (3) każdy ruch W2 przechodzi walidator (rationale + trade-off + ' +
    'odrzucona alternatywa, managementSystemEngine.ts validateW2Move).',

  signatureArchetype: 'operating-model-standard',
  signatureRationale:
    'DMS Builder jest z natury modelem operacyjnym — pętlą kontroli o czterech warstwach zależnych od siebie ' +
    'w stałej kolejności (widoczność→rytm→eskalacja→reakcja). Geometria musi pokazywać domknięcie/przerwanie ' +
    'pętli i dojrzałość każdego ogniwa, nie cztery niezależne ćwiartki.',

  mapping: {
    output:
      'Niezmienny snapshot: dojrzałość 4 warstw pętli (0-3), status domknięcia (loopClosed), ranking ' +
      'najsłabsza-pierwsza, sekwencja ruchów W2 z trade-offami.',
    report:
      'Sekcja dojrzałości zarządzania operacyjnego: pętla kontroli jako grafika sygnaturowa + luki jako ' +
      'narracja argument→dowód→implikacja. Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Sekwencja W2 (buildW2MoveSequence) mapuje się na kandydatów inicjatyw w porządku pętli: naprawa ' +
      '2-3 najsłabszych warstw re-sekwencjonowana do kolejności visibility→cadence→escalation→response.',
  },

  conclusion: {
    k1FactSource:
      'dmsbuilder/managementSystemEngine.rankDmsLayers — maturity (0-3), present i loopMaturity/loopClosed ' +
      'liczone deterministycznie z faktów KPI i reguł eskalacji sesji. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie KPI i reguły eskalacji tej sesji. Zakaz benchmarków dojrzałości DMS spoza wsadu — poziom ' +
      '0-3 opisuje wyłącznie stan tej organizacji, nie porównanie z „typową firmą".',
    k3PrioritySource:
      'Kolejność z sekwencji W2 silnika (buildW2MoveSequence): naprawa od najsłabszego ogniwa, ale ' +
      're-sekwencjonowana do porządku pętli (nie da się eskalować niewidocznego sygnału). Model formułuje ' +
      'treść ruchu, nie kolejność.',
    k4EffectRule:
      'Efekt musi być wzrostem dojrzałości docelowej warstwy (obserwowalny w rytmie przeglądu) lub domknięciem ' +
      'pętli, z horyzontem czasowym. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i odrzuconą alternatywę (managementSystemEngine.ts W2MoveInput). ' +
      'Bogaty dashboard z 30 metrykami jest zawsze jawnie odrzucanym wariantem na rzecz nielicznych właściwych.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/dmsbuilder',
    questionBankModule: 'src/config/dmsbuilder/dmsBuilderQuestionBank.ts',
    expectedQuestionNodeCount: 5,
    bankBackedPhaseIds: ['kpis', 'escalation'],
    rendererComponent: 'src/components/DiscoveryTools/tools/Operational',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'System zarządzania dziennego (tablice i odprawy warstwowe)',
    commonlyAttributedTo: 'Brak jednego autora — powszechna praktyka zarządzania operacyjnego Lean',
    sourceUsed: 'src/config/dmsbuilder/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'Termin generyczny.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'NISKIE — praktyka generyczna, formalnie niezweryfikowana.',
  },
};
