/**
 * Tool Pack — Dynamic SWOT (wzorzec pionowy dla pozostałych 30 narzędzi).
 *
 * KONSOLIDACJA, NIE TWÓRCZOŚĆ. Każde pole pochodzi z istniejących źródeł:
 * - `knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md`
 * - `src/config/swot/swotTensionEngine.ts` (semantyka napięć i postaw)
 * - `src/store/useToolStore.ts:1342` SWOT_STEPS (id faz runtime)
 * - `docs/standards/CONCLUSION_LAYER_STANDARD.md` §W2 (konkluzje K1-K4)
 * - `docs/ui-standards/03-modules/tools-library-detail-standard.md` (Library)
 *
 * Id faz są ZGODNE z runtime (mission/input/swot/insights/outputs) — pack nie
 * wprowadza równoległej nomenklatury.
 */

import { type ToolPack } from '../contract';

export const dynamicSwotPack: ToolPack = {
  toolType: 'dynamic-swot',
  displayName: { pl: 'Dynamiczny SWOT', en: 'Dynamic SWOT' },
  category: 'strategic',
  packVersion: '1.0.0',
  contentStatus: 'PACK_COMPLETE',
  // Treść kompletna, ale runtime DoD (Output/Report/approval) jeszcze nie
  // dowieziony — dlatego NIE RUNTIME_ACTIVE. Rozdział pojęć wg decyzji
  // właściciela 2026-08-13.
  runtimeStatus: 'RUNTIME_PENDING',

  provenance: [
    {
      source: 'knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md',
      verifiableInRepo: true,
    },
    { source: 'src/config/swot/swotTensionEngine.ts', verifiableInRepo: true },
    { source: 'src/config/swot/dynamicSwotQuestionBank.ts', verifiableInRepo: true },
    { source: 'src/store/useToolStore.ts (SWOT_STEPS)', verifiableInRepo: true },
    { source: 'docs/standards/CONCLUSION_LAYER_STANDARD.md', verifiableInRepo: true },
    {
      source: 'knowledge/Strategie /Creately.zip — źródła metody SWOT/TOWS',
      verifiableInRepo: false,
      note: 'Gitignorowane (.gitignore:173). Provenance zadeklarowana w packu tool-kb, ale niewryfikowalna z repo.',
    },
  ],

  library: {
    whatItIs: {
      pl: 'Strategiczna diagnoza pozycji firmy, która kończy się napięciami i ruchami, a nie czterema listami.',
      en: 'A strategic diagnosis of position that ends in tensions and moves, not four lists.',
    },
    whatItIsNot: {
      pl: 'To nie jest burza mózgów ani lista życzeń zarządu. Pozycja bez dowodu nie wchodzi do analizy.',
      en: 'It is not a brainstorm or a management wish list. An item without evidence does not enter the analysis.',
    },
    whenToUse: {
      pl: 'Przed decyzją o kierunku: wejście na rynek, zmiana modelu, alokacja budżetu strategicznego.',
      en: 'Before a direction call: market entry, business model change, strategic budget allocation.',
    },
    whenNotToUse: {
      pl: 'Gdy problem jest czysto operacyjny albo znasz już przyczynę — wtedy właściwe jest A3 lub VSM.',
      en: 'When the problem is purely operational or the cause is known — A3 or VSM fit better.',
    },
    whyItMatters: {
      pl: 'Silnik łączy pozycje w pary S/W × O/T i nadaje im postawę, więc z opinii powstaje uzasadniona kolejność działań.',
      en: 'The engine pairs items S/W × O/T and assigns a posture, turning opinions into a justified order of action.',
    },
    inputsRequired: {
      pl: 'Pytanie decyzyjne, horyzont czasowy, dane rynkowe i wyniki finansowe oraz osoba znająca realia operacyjne.',
      en: 'A decision question, time horizon, market and financial data, plus someone who knows operational reality.',
    },
    roles: {
      pl: 'Właściciel decyzji (zarząd), właściciel obszaru, analityk dostarczający dowody.',
      en: 'Decision owner (board), area owner, analyst supplying evidence.',
    },
    outcome: {
      pl: 'Napięcia strategiczne z postawą, rekomendowane ruchy z trade-offem i kandydaci na inicjatywy.',
      en: 'Strategic tensions with posture, recommended moves with trade-offs, and initiative candidates.',
    },
    estimatedEffort: '2–4 h sesji roboczej',
    // Metoda klasyczna; brak noty licencyjnej w repo — nie zgadujemy (L10).
    license: 'EVIDENCE_MISSING',
  },

  purpose: {
    pl: 'Uporządkować pozycję strategiczną tak, aby dało się z niej wyprowadzić decyzję.',
    en: 'Structure the strategic position so a decision can be derived from it.',
  },
  useCases: [
    'Przegląd strategii przed rokiem budżetowym',
    'Decyzja o wejściu na nowy rynek',
    'Reakcja na ruch konkurencji',
  ],
  contraindications: [
    'Problem czysto operacyjny (użyj A3)',
    'Znana przyczyna źródłowa (użyj A3 lub VSM)',
    'Brak jakichkolwiek danych — sesja wyprodukuje same hipotezy',
  ],

  phases: [
    {
      id: 'mission',
      title: { pl: 'Misja i kontekst', en: 'Mission & Context' },
      goal: {
        pl: 'Ustalić jedno pytanie decyzyjne i horyzont.',
        en: 'Establish one decision question and a horizon.',
      },
      whatGoodLooksLike: 'Jedno ostre pytanie decyzyjne z horyzontem czasowym i właścicielem.',
      evidenceToAskFor: 'Kontekst biznesowy, horyzont, kryterium sukcesu.',
      completionCriterion: 'Pytanie decyzyjne zaakceptowane przez właściciela decyzji.',
    },
    {
      id: 'input',
      title: { pl: 'Wejście i eksploracja', en: 'Input & Exploration' },
      goal: {
        pl: 'Zebrać sygnały i nadać im status dowodu.',
        en: 'Collect signals and assign an evidence status.',
      },
      whatGoodLooksLike: 'Sygnały rozdzielone na fakt, obserwację i hipotezę.',
      evidenceToAskFor: 'Źródło każdego sygnału: dane, obserwacja z rynku lub założenie.',
      completionCriterion: 'Każdy sygnał ma jawny typ dowodu.',
    },
    {
      id: 'swot',
      title: { pl: 'Budowa SWOT', en: 'SWOT Build' },
      goal: {
        pl: 'Zaklasyfikować pozycje do ćwiartek i zaakceptować je.',
        en: 'Classify items into quadrants and accept them.',
      },
      whatGoodLooksLike: 'Każda ćwiartka ma zaakceptowane pozycje z określonym wpływem.',
      evidenceToAskFor: 'Dlaczego pozycja jest wewnętrzna vs zewnętrzna i jaki ma wpływ.',
      completionCriterion: 'Co najmniej jedna zaakceptowana pozycja w każdej ćwiartce.',
    },
    {
      id: 'insights',
      title: { pl: 'Synteza i napięcia', en: 'Synthesis & Insights' },
      goal: {
        pl: 'Wyprowadzić napięcia z par S/W × O/T.',
        en: 'Derive tensions from S/W × O/T pairs.',
      },
      whatGoodLooksLike: 'Napięcia mają postawę i uzasadnioną wagę, nie są przepisaniem kafelków.',
      evidenceToAskFor: 'Która pozycja wewnętrzna łączy się z którą zewnętrzną i dlaczego.',
      completionCriterion: 'Napięcia policzone przez silnik z pozycji zaakceptowanych.',
    },
    {
      id: 'outputs',
      title: { pl: 'Wyniki i działania', en: 'Outputs & Actions' },
      goal: {
        pl: 'Zamienić napięcia w ruchy z trade-offem.',
        en: 'Turn tensions into moves with trade-offs.',
      },
      whatGoodLooksLike: 'Każdy ruch ma wybrane, odrzucone i uzasadnienie oraz pierwszy krok.',
      evidenceToAskFor: 'Co świadomie odrzucamy wybierając ten ruch i jakim kosztem.',
      completionCriterion: 'Każdy ruch spełnia bramkę W2 (rationale + trade-off + odrzucona opcja).',
    },
  ],

  questions: [
    {
      id: 'swot-mission-decision',
      phaseId: 'mission',
      prompt: {
        pl: 'Jaką konkretną decyzję ma wesprzeć ta analiza i do kiedy trzeba ją podjąć?',
        en: 'What specific decision should this analysis support, and by when?',
      },
      answerType: 'text',
      challengeRule:
        'Odrzuć odpowiedź bez horyzontu czasowego lub bez nazwanej decyzji („chcemy się rozwijać" = za ogólne).',
      followUpProbes: ['Kto podejmuje tę decyzję?', 'Co się stanie, jeśli jej nie podejmiecie?'],
    },
    {
      id: 'swot-input-evidence',
      phaseId: 'input',
      prompt: {
        pl: 'Skąd wiesz, że to prawda — to zmierzona dana, obserwacja czy założenie?',
        en: 'How do you know this is true — measured data, observation, or assumption?',
      },
      answerType: 'evidence',
      challengeRule:
        'Sygnał bez wskazanego źródła oznacz jako hipotezę; nie pozwól, by wszedł do analizy jako fakt.',
    },
    {
      id: 'swot-build-classification',
      phaseId: 'swot',
      prompt: {
        pl: 'Czy to jest cecha Waszej organizacji, czy warunek rynku niezależny od Was?',
        en: 'Is this a property of your organisation, or a market condition beyond your control?',
      },
      answerType: 'matrix-placement',
      challengeRule:
        'Wewnętrzne = S/W (możecie to zmienić), zewnętrzne = O/T (nie możecie). Podważ pozycję, którą da się zmienić decyzją zarządu, a wylądowała w O/T.',
    },
    {
      id: 'swot-insight-pairing',
      phaseId: 'insights',
      prompt: {
        pl: 'Która nasza cecha spotyka się z którym warunkiem rynku i co z tego wynika?',
        en: 'Which of our properties meets which market condition, and what follows?',
      },
      answerType: 'list',
      challengeRule:
        'Napięcie, które tylko powtarza treść dwóch kafelków, nie jest napięciem — wymagaj konsekwencji.',
    },
    {
      id: 'swot-output-tradeoff',
      phaseId: 'outputs',
      prompt: {
        pl: 'Co świadomie odpuszczacie, wybierając ten ruch, i jakim kosztem?',
        en: 'What are you deliberately giving up by choosing this move, and at what cost?',
      },
      answerType: 'text',
      challengeRule:
        'Ruch bez odrzuconej alternatywy nie przechodzi bramki W2 — wymagaj nazwania opcji odrzuconej.',
    },
  ],

  classificationRules:
    'S/W = cechy wewnętrzne (organizacja może je zmienić). O/T = warunki zewnętrzne (nie może). ' +
    'Do syntezy wchodzą wyłącznie pozycje o statusie accepted (swotTensionEngine.ts: isAcceptedSwotItem).',
  evidenceExpectations:
    'Każdy sygnał ma typ: fakt (dane), obserwacja (widziane na rynku) lub hipoteza (założenie). ' +
    'Hipoteza nigdy nie jest prezentowana jako fakt i musi być tak nazwana w outputach.',
  relationships:
    'Pary krzyżowe wyznaczają postawę (swotTensionEngine.ts): SO → attack (atakuj szansę), ' +
    'WO → repair (napraw, by sięgnąć), ST → defend (broń się siłą), WT → protect (chroń ekspozycję). ' +
    'Priorytet napięcia = suma wag wpływu obu pozycji (high=3, medium=2, low=1).',
  interpretationRules:
    'Czytaj napięcia, nie pojedyncze kafelki. Ćwiartka pełna pozycji bez ani jednego napięcia oznacza, ' +
    'że zebrano opisy, a nie strategię. Brakujące typy napięć są sygnałem luki w dowodach, nie błędem silnika.',
  completionCriteria:
    'Każda ćwiartka ma co najmniej jedną zaakceptowaną pozycję; napięcia policzone przez silnik; ' +
    'każdy rekomendowany ruch spełnia bramkę W2 (rationale + trade-off + odrzucona alternatywa + pierwszy krok).',

  signatureArchetype: 'quadrant-strategic-field',
  signatureRationale:
    'SWOT jest z natury polem 2×2 na osiach wewnętrzne/zewnętrzne × pomocne/szkodliwe. ' +
    'Napięcia to linie korelacji przecinające ćwiartki — geometria musi pokazywać pary, nie cztery osobne listy.',

  mapping: {
    output:
      'Niezmienny snapshot: napięcia z postawą i wagą, rekomendowane ruchy z trade-offem, ' +
      'zaakceptowane pozycje jako dowód oraz jawnie oznaczone hipotezy.',
    report:
      'Sekcja diagnozy strategicznej: pole SWOT jako grafika sygnaturowa + napięcia jako narracja ' +
      'argument → dowód → implikacja. Renderowane deterministycznie z tego samego Artifact, nigdy ze zrzutu ekranu.',
    initiative:
      'Każdy zaakceptowany ruch staje się kandydatem na inicjatywę: postawa napięcia wyznacza typ ' +
      '(attack → wzrost, repair → zdolność, defend → obrona pozycji, protect → ograniczenie ryzyka).',
  },

  /**
   * Wiązanie z realnym silnikiem.
   *
   * WAŻNE ROZRÓŻNIENIE (po review Codexa): pięć pytań w polu `questions` to
   * NIE jest bank pytań. To indeks sterujący fazami — po jednym pytaniu
   * ramującym na fazę. Realny bank to DRABINKA POGŁĘBIANIA w
   * `dynamicSwotQuestionBank.ts`: **17 węzłów**, nie 16. Drabinka nie jest
   * równa 4×4 — ćwiartka `strengths` ma pięć węzłów, bo poziom s2 rozgałęzia
   * się na `s2-commercial-proof` i `s2-external-proof` (dwie ścieżki dowodu).
   * Pozostałe ćwiartki mają po cztery. Drabinka pracuje wewnątrz fazy `swot`.
   * Liczba jest weryfikowana testem wobec realnego modułu — pierwotnie
   * zadeklarowano tu 16 i test to wychwycił.
   */
  engine: {
    engineDir: 'src/config/swot',
    questionBankModule: 'src/config/swot/dynamicSwotQuestionBank.ts',
    expectedQuestionNodeCount: 17,
    bankBackedPhaseIds: ['swot'],
    rendererComponent: 'src/components/DiscoveryTools/tools/DynamicSWOT',
  },

  rights: {
    methodologyName: 'SWOT / TOWS',
    commonlyAttributedTo:
      'SWOT — powszechnie wiązany ze Stanford Research Institute (lata 60.); ' +
      'macierz TOWS — Heinz Weihrich (1982). Atrybucja rozproszona, brak jednego właściciela.',
    sourceUsed: 'knowledge/tool-kb/dynamic-swot/methodology/v1/dynamic-swot-methodology.pl.md',
    sourceType: 'REPO_CANON',
    copiedContent: 'no',
    trademarkNote:
      'Nie znaleziono znaku towarowego. Źródła metody cytowane w packu leżą w ' +
      'knowledge/Strategie /*.zip, wykluczonych przez .gitignore:173 — nieweryfikowalne z repo.',
    commercialUseStatus: 'LEGAL_REVIEW_REQUIRED',
    legalReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    publicationStatus: 'LEGAL_REVIEW_REQUIRED',
    uncertainty:
      'Flaga bazy license=free jest flagą produktową, nie dowodem prawnym. ' +
      'Brak noty licencyjnej w repo dla metody bazowej.',
  },

  conclusion: {
    k1FactSource:
      'swotTensionEngine.computeTensions — napięcia, ich liczba i waga liczone deterministycznie ' +
      'z pozycji zaakceptowanych. Żadna liczba w K1 nie pochodzi z modelu.',
    k2GroundingScope:
      'Wyłącznie pozycje sesji, ich dowody i profil organizacji. Zakaz statystyk branżowych spoza wsadu.',
    k3PrioritySource:
      'Kolejność z rankingu wagi napięć (impact-weighted). Model formułuje treść akcji, nie kolejność.',
    k4EffectRule:
      'Efekt musi wynikać z K3, mieć horyzont czasowy i adresata-rolę. Bez kwot nieobecnych we wsadzie.',
    tradeoffRule:
      'Każdy ruch podaje: wybrane, odrzucone i dlaczego (W2). Ruch bez odrzuconej alternatywy nie przechodzi.',
  },
};
