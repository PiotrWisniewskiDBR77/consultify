/**
 * Tool Pack — Narrative Engine (SCQA + MECE Minto pyramid validator).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `src/config/narrativeengine/pyramidValidator.ts` (walidacja SCQA, tezy głównej, MECE)
 * - `src/config/narrativeengine/pyramidQuestionBank.ts` (bank pytań: teza/dowód/piramida)
 * - `src/config/narrativeengine/moveValidator.ts` (W2 sekwencja ruchów przekazu)
 * - `src/config/narrativeengine/conclusionPrompts.ts` (kontrakt W2)
 * - `src/store/useToolStore.ts` (NARRATIVE_ENGINE_STEPS — id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2, §R3 (falsyfikowalność)
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (mission/input/pillars/insights/outputs).
 */

import { type ToolPack } from '../contract';

export const narrativeEnginePack: ToolPack = {
  toolType: 'narrative-engine',
  displayName: { pl: 'Silnik narracji', en: 'Narrative Engine' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    { source: 'src/config/narrativeengine/pyramidValidator.ts', verifiableInRepo: true },
    { source: 'src/config/narrativeengine/pyramidQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/config/narrativeengine/moveValidator.ts', verifiableInRepo: true },
    { source: 'src/config/narrativeengine/conclusionPrompts.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (NARRATIVE_ENGINE_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'Piramida Minto (SCQA, MECE) — Barbara Minto, "The Pyramid Principle" — brak noty licencyjnej w repo',
      verifiableInRepo: false,
      note: 'Metoda jest własnością intelektualną Minto/McKinsey & Co.; brak potwierdzonego źródła licencyjnego w repo (L10).',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Silnik, który sprawdza przekaz zarządczy pod kątem łańcucha SCQA (Sytuacja→Komplikacja→Pytanie→Odpowiedź) i piramidy argumentów MECE — zamiast puszczać w świat slajdy z tytułami-tematami.',
      en: 'An engine that checks an executive narrative for a SCQA chain (Situation→Complication→Question→Answer) and a MECE argument pyramid — instead of letting slides with topic-titles go out unchecked.',
    },
    whatItIsNot: {
      pl: 'To nie jest generator sloganów ani tytułów slajdów. Teza główna, którą da się przeczytać przy dowolnych danych, jest odrzucana jako pusty frazes.',
      en: 'It is not a slogan or slide-title generator. A governing thought that would pass with any data is rejected as a filler phrase.',
    },
    whenToUse: {
      pl: 'Przed prezentacją zarządczą, executive summary raportu lub kluczową rekomendacją, która ma zostać podpisana przez partnera.',
      en: 'Before a board presentation, a report executive summary, or a key recommendation meant to be signed by a partner.',
    },
    whenNotToUse: {
      pl: 'Gdy trzeba dopiero zebrać surowe dane analityczne (użyj właściwego narzędzia diagnostycznego) — silnik piramidy zakłada, że argumenty już istnieją i mają dowód.',
      en: 'When raw analytical data still needs to be gathered (use the relevant diagnostic tool first) — the pyramid engine assumes the arguments already exist with evidence.',
    },
    whyItMatters: {
      pl: 'Silnik wykrywa piramidę, która NIE jest MECE — dwa filary argumentujące to samo (nakładanie się) albo filar-worek "inne/pozostałe" — i odrzuca tezę bez co najmniej dwóch gałęzi wsparcia.',
      en: 'The engine catches a pyramid that is NOT MECE — two pillars arguing the same point (overlap), or a vague "other/miscellaneous" catch-all pillar — and rejects a thesis with fewer than two supporting branches.',
    },
    inputsRequired: {
      pl: 'Audytorium, kluczowe fakty/dowody, wersja robocza tezy głównej oraz osoba znająca kontekst sytuacyjny odbiorcy.',
      en: 'The audience, key facts/evidence, a draft governing thought, and someone who knows the recipient\'s situational context.',
    },
    roles: {
      pl: 'Autor narracji (konsultant/lider), recenzent dowodowy, sponsor przekazu (kto go podpisuje).',
      en: 'Narrative author (consultant/lead), an evidence reviewer, the message sponsor (who signs it).',
    },
    outcome: {
      pl: 'Zwalidowany łańcuch SCQA, teza główna sprawdzona pod falsyfikowalność, piramida filarów oceniona pod MECE i sekwencja ruchów dostarczenia z trade-offem.',
      en: 'A validated SCQA chain, a governing thought checked for falsifiability, a pillar pyramid scored for MECE, and a delivery move sequence with trade-offs.',
    },
    estimatedEffort: '2–3 h sesji roboczej',
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Zamienić zbiór faktów w narrację, którą partner podpisałby własnym nazwiskiem — z tezą, dowodem i strukturą MECE.',
    en: 'Turn a set of facts into a narrative a partner would sign with their own name — with a thesis, evidence, and MECE structure.',
  },
  useCases: [
    'Przygotowanie przekazu przed prezentacją zarządczą',
    'Sprawdzenie executive summary raportu pod kątem SCQA/MECE',
    'Ostrzenie rozmytej tezy głównej przed publikacją decku',
  ],
  contraindications: [
    'Surowe dane analityczne jeszcze nie zebrane — narzędzie zakłada gotowe argumenty z dowodem',
    'Potrzebna wyłącznie priorytetyzacja treści, nie jej struktura logiczna',
    'Odbiorca nie oczekuje rekomendacji, tylko neutralnego zestawienia faktów',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Audytorium i przekaz', en: 'Audience & Core Message' },
      goal: {
        pl: 'Określić audytorium, główny przekaz i sygnał sukcesu.',
        en: 'Define the audience, the core message, and the success signal.',
      },
      whatGoodLooksLike: 'Audytorium nazwane wraz z pytaniem, na które realnie czeka odpowiedzi.',
      evidenceToAskFor: 'Jakie pytanie odbiorcy ma rozstrzygnąć ta narracja.',
      completionCriterion: 'Audytorium i wstępna teza zaakceptowane przez sponsora przekazu.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać dowody, insighty o audytorium i materiał wspierający.',
        en: 'Capture proof points, audience insights, and supporting evidence.',
      },
      whatGoodLooksLike: 'Dowody rozdzielone na potwierdzone i deklarowane, z jawnym statusem.',
      evidenceToAskFor: 'Czy dowód jest potwierdzony, czy tylko deklarowany przez zespół.',
      completionCriterion: 'Każdy dowód ma jawny status potwierdzenia.',
    },
    {
      id: 'pillars',
      title: { pl: 'Filary narracji', en: 'Narrative Pillars' },
      goal: {
        pl: 'Zbudować filary przekazu z dowodami i rezonansem u audytorium.',
        en: 'Build message pillars, each with proof points and audience resonance.',
      },
      whatGoodLooksLike:
        'Co najmniej dwa aktywne filary, każdy z proofPoints, message i implication (staircase fakt→interpretacja→so-what), MECE.',
      evidenceToAskFor: 'Czy dwa filary nie argumentują tego samego punktu (nakładanie się).',
      completionCriterion: 'Piramida filarów przechodzi validatePyramidMece bez nakładania i bez filaru-worka.',
    },
    {
      id: 'insights',
      title: { pl: 'Narracja i ruchy', en: 'Storyline & Moves' },
      goal: {
        pl: 'Ułożyć filary w łuk narracyjny i zdecydować o ruchach przekazu.',
        en: 'Weave pillars into a storyline arc and decide delivery moves.',
      },
      whatGoodLooksLike: 'Łańcuch SCQA spójny (Sytuacja→Komplikacja→Pytanie→Odpowiedź), Odpowiedź faktycznie rozstrzyga Pytanie.',
      evidenceToAskFor: 'Czy Komplikacja wnosi coś nowego, czy tylko powtarza Sytuację.',
      completionCriterion: 'validateScqa zwraca zero problemów krytycznych (missing-*, question-not-linked, answer-not-linked).',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Przygotować sekwencję ruchów dostarczenia z trade-offem.',
        en: 'Prepare the final source summary and generate downstream outputs and initiatives.',
      },
      whatGoodLooksLike: 'Każdy ruch (open/build/prove/cta/reframe) ma rationale, trade-off i odrzucony wariant.',
      evidenceToAskFor: 'Co świadomie pomijamy w przekazie, wybierając tę sekwencję filarów.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 i teza główna jest falsyfikowalna.',
    },
  ],

  questions: [
    {
      id: 'narrative-mission-audience',
      phaseId: 'mission',
      prompt: {
        pl: 'Kto jest audytorium i na jakie realne pytanie ta narracja ma odpowiedzieć?',
        en: 'Who is the audience, and what real question should this narrative answer?',
      },
      answerType: 'text',
      challengeRule: 'Odrzuć „szerokie grono interesariuszy" bez nazwanego decydenta i jego konkretnego pytania.',
    },
    {
      id: 'narrative-input-evidence',
      phaseId: 'input',
      prompt: {
        pl: 'Czy ten dowód jest potwierdzony, czy tylko deklarowany przez zespół?',
        en: 'Is this evidence confirmed, or only declared by the team?',
      },
      answerType: 'evidence',
      challengeRule:
        'Argument bez dowodu musi być oznaczony jako „Deklaracja — niepotwierdzone", nigdy cicho zakładany za pewnik (pyramidQuestionBank.ts DECLARED_UNCONFIRMED_LABEL, CONCLUSION_LAYER R2).',
    },
    {
      id: 'narrative-pillars-thesis',
      phaseId: 'pillars',
      prompt: {
        pl: 'Sformułuj tezę główną jako JEDNO zdanie — odpowiedź na realne pytanie odbiorcy. Czy to rekomendacja, czy wciąż etykieta tematu ("wyniki Q3")?',
        en: 'State the governing thought as ONE sentence — the answer to the audience\'s real question. Is it a recommendation, or still a topic label ("Q3 results")?',
      },
      answerType: 'text',
      challengeRule:
        'Etykieta tematu ("nasze podejście do X") to nie teza — wymuś twierdzenie, z którym rywal konsultant mógłby polemizować (pyramidQuestionBank.ts th1-surface/th2-sharpen).',
    },
    {
      id: 'narrative-pillars-mece',
      phaseId: 'pillars',
      prompt: {
        pl: 'Czy ten filar argumentuje coś odrębnego od pozostałych, czy powtarza już powiedziany punkt?',
        en: 'Does this pillar argue something distinct from the others, or restate a point already made?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Piramida z dwoma filarami argumentującymi to samo NIE jest MECE — silnik flaguje nakładanie się (pyramidValidator.ts §3 MECE) i filar-worek „inne/pozostałe" jako niezaakceptowaną gałąź.',
    },
    {
      id: 'narrative-output-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Gdyby leżące u podstaw fakty były przeciwne, czy ta teza brzmiałaby inaczej?',
        en: 'If the underlying facts were the opposite, would this thesis read differently?',
      },
      answerType: 'text',
      challengeRule:
        'Teza, która przetrwa dowolne dane („firma ma pole do poprawy"), nie jest tezą i nie przechodzi (pyramidQuestionBank.ts th2-falsifiable, CONCLUSION_LAYER R3).',
    },
  ],

  classificationRules:
    'Łańcuch SCQA: Situation (stabilny grunt) → Complication (co go burzy, musi wnosić nowe napięcie, nie powtarzać S) → ' +
    'Question (musi dzielić słownictwo z Complication) → Answer/teza główna (musi rozstrzygać Question) (pyramidValidator.ts:174-262). ' +
    'Do piramidy wchodzą wyłącznie aktywne (nie odrzucone) filary.',
  evidenceExpectations:
    'Każdy argument bez proof points jest oznaczony „Deklaracja — niepotwierdzone" (DECLARED_UNCONFIRMED_LABEL), nigdy prezentowany ' +
    'jako potwierdzony fakt. Teza główna bez wsparcia ≥2 aktywnych filarów nie jest MECE.',
  relationships:
    'MECE sprawdzane dwukierunkowo: Mutual Exclusivity — żadne dwa filary nie argumentują tego samego punktu (nakładanie ' +
    'wykrywane przez podobieństwo Jaccard słów znaczących); Collective Exhaustiveness — brak samotnego argumentu i brak ' +
    'mglistego filaru-worka „inne/pozostałe" (pyramidValidator.ts §3).',
  interpretationRules:
    'Czytaj raport SCQA razem z raportem MECE, nie osobno. Teza główna dzieląca zero słownictwa z żadnym aktywnym filarem ' +
    '„wisi w powietrzu" — to sygnał, że narracja nie jest oparta na zebranych dowodach, tylko na przekonaniu autora.',
  completionCriteria:
    'validateScqa i validatePyramidMece zwracają zero problemów strukturalnych; teza główna jest falsyfikowalna (przetrwałaby ' +
    'inaczej przy przeciwnych danych); sekwencja ruchów W2 ma rationale, trade-off i odrzucony wariant dla każdego ruchu.',

  signatureArchetype: 'architecture-capability',
  signatureRationale:
    'Silnik narracji jest z natury architekturą piramidy: teza główna na szczycie, filary jako gałęzie wspierające, ' +
    'łańcuch SCQA jako oś budująca napięcie do tezy — geometria musi pokazywać hierarchię argumentu, nie płaski storyboard slajdów.',

  mapping: {
    output:
      'Niezmienny snapshot: łańcuch SCQA zwalidowany, teza główna z testem falsyfikowalności, piramida filarów z raportem ' +
      'MECE, sekwencja ruchów dostarczenia z trade-offem.',
    report:
      'Sekcja narracyjna raportu/decku: piramida jako grafika sygnaturowa + sama sekwencja tytułów slajdów jako storyline ' +
      '(W5 CONCLUSION_LAYER). Renderowane deterministycznie z tego samego Artifact.',
    initiative:
      'Ruchy typu "build"/"prove" wskazujące brakujący dowód stają się kandydatami na zadania badawcze przed publikacją; ' +
      '"cta" staje się kandydatem na inicjatywę decyzyjną do wykonania po przekazie.',
  },

  conclusion: {
    k1FactSource:
      'pyramidValidator.validateScqa + validateGoverningThought + validatePyramidMece — status łańcucha SCQA i raport MECE ' +
      'liczone deterministycznie z filarów sesji. Żadna liczba/status w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie kontekst SCQA, filary i ich dowody z sesji. Zakaz argumentów spoza wsadu, nawet jeśli brzmią przekonująco.',
    k3PrioritySource:
      'Kolejność ruchów z W2 move sequence (moveValidator.ts) — model formułuje treść ruchu, nie kolejność ani ocenę MECE.',
    k4EffectRule:
      'Efekt musi wynikać z K3 jako reakcja audytorium/decyzja podjęta, z horyzontem czasowym, bez obietnic nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje rationale, trade-off i rejectedVariant; teza niefalsyfikowalna lub piramida nie-MECE nie przechodzi bramki niezależnie od uzasadnienia.',
  },

  /**
   * Wiązanie z realnym silnikiem metody.
   * Pytania packa są indeksem sterującym fazami; realny bank pytań żyje
   * w module poniżej i jest weryfikowany testem kontraktowym.
   */
  engine: {
    engineDir: 'src/config/narrativeengine',
    questionBankModule: 'src/config/narrativeengine/pyramidQuestionBank.ts',
    expectedQuestionNodeCount: 18,
    bankBackedPhaseIds: ['pillars'],
    rendererComponent: 'src/components/DiscoveryTools/tools/NarrativeEngine',
  },

  /**
   * Rejestr praw i atrybucji.
   * Flaga bazy license='free' jest flagą PRODUKTOWĄ, nie dowodem prawnym.
   */
  rights: {
    methodologyName: 'Zasada Piramidy Minto (SCQA, MECE)',
    commonlyAttributedTo: 'Barbara Minto (McKinsey & Co.), „The Pyramid Principle"',
    sourceUsed: 'src/config/narrativeengine/ (kod silnika; brak zewnętrznego dokumentu metody w repo)',
    sourceType: 'ENGINE_DERIVED',
    copiedContent: 'no',
    trademarkNote: 'RYZYKO NAJWYŻSZE W CAŁYM ROSTERZE — SCQA/MECE/„Pyramid Principle" to nazwana, komercyjnie publikowana własność Minto; MECE silnie kojarzone z McKinsey. Dodatkowo docs/standards/CONCLUSION_LAYER_STANDARD.md wymienia Minto i McKinsey wprost.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty: 'WYSOKIE — jedyne narzędzie, którego metoda źródłowa jest konkretną, komercyjnie wydaną książką, a nie wiedzą generyczną. Pierwsze do przeglądu prawnego.',
  },
};
