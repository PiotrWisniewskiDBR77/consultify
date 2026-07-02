/**
 * Market Forces (Porter's Five Forces) — laddered question bank (OXFORD O3, tool #2).
 *
 * Cloned 1:1 in architecture from src/config/swot/dynamicSwotQuestionBank.ts.
 * Doctrine: docs/standards/CONCLUSION_LAYER_STANDARD.md (W2) +
 * src/config/consultingToolsStandard.ts (mission -> signals -> analysis -> conclusions -> outputs).
 *
 * Each of the five forces carries a 4-level ladder of partner-grade questions. The
 * answer to a question determines the next question (branching), so the conversation
 * digs into the STRUCTURAL DRIVERS of the force instead of collecting a 1-5 slider.
 * Levels (adapted from SWOT surface/evidence/scope/durability to Porter economics):
 *   L1 surface        — locate the force in THIS market ("who exactly, doing what?")
 *   L2 evidence       — force the structural proof: concentration, switching costs, barriers
 *   L3 quantification — pin a number the force can be defended with (share, %, count)
 *   L4 trend          — test where the force is heading (intensifying / stable / easing)
 *
 * Every function here is pure — the runtime and the AI prompts both consume this bank,
 * so a question asked by the mentor in chat and a question rendered in the wizard are
 * the same question (single source of truth).
 */

import type { PorterForceId } from '@/store/useToolStore';

export type PorterQuestionLevel = 1 | 2 | 3 | 4;

/** Intensity verdict a force resolves to once its ladder is walked. */
export type PorterForceIntensity = 'low' | 'medium' | 'high';

/** Trend the force is on — decides urgency of the strategic response. */
export type PorterForceTrendKey = 'intensifying' | 'stable' | 'easing';

export interface PorterAnswerOption {
  /** Stable branch key — persisted with the answer, drives getNextPorterQuestion. */
  key: string;
  labelEn: string;
  labelPl: string;
  /** What this answer tells the consultant (used to steer the AI follow-up). */
  consultantSignalEn: string;
  consultantSignalPl: string;
  /**
   * How this answer pushes the force intensity. The synthesis engine reads these
   * to derive a low/medium/high verdict deterministically from ladder answers.
   * +1 = pushes toward a STRONGER (more threatening) force, -1 = weaker.
   */
  intensityDelta: -1 | 0 | 1;
}

export interface PorterQuestionNode {
  id: string;
  force: PorterForceId;
  level: PorterQuestionLevel;
  /** Why a partner asks this (surfaced to the AI, optionally to the user as tooltip). */
  intentEn: string;
  intentPl: string;
  textEn: string;
  textPl: string;
  /** Follow-up probe when the answer is vague. */
  probeEn?: string;
  probePl?: string;
  answerOptions: PorterAnswerOption[];
  /**
   * answerKey -> next question id. `null` means the ladder is complete for this path.
   * Missing key falls back to `defaultNextId`.
   */
  branches: Record<string, string | null>;
  defaultNextId: string | null;
}

// ---------------------------------------------------------------------------
// RIVALRY — who competes, on what basis, how concentrated, where it is heading
// ---------------------------------------------------------------------------

const RIVALRY_QUESTIONS: PorterQuestionNode[] = [
  {
    id: 'riv1-surface',
    force: 'rivalry',
    level: 1,
    intentEn: 'Name the actual rivals and the axis they fight on — "competition" is weather, named rivals are structure.',
    intentPl: 'Nazwać realnych rywali i oś, na której walczą — „konkurencja" to pogoda, nazwani rywale to struktura.',
    textEn:
      'Who are the 2-3 competitors you actually lose deals to, and do they beat you mainly on price or on differentiation? Name the last deal you lost and to whom.',
    textPl:
      'Kto to 2-3 konkurenci, którym realnie przegrywacie kontrakty, i biją Was głównie ceną czy różnicowaniem? Podaj ostatni przegrany kontrakt i komu.',
    probeEn: 'If you cannot name who you lose to, the rivalry is not yet understood — it is assumed.',
    probePl: 'Jeśli nie umiecie nazwać, komu przegrywacie, rywalizacja nie jest jeszcze zrozumiana — jest założona.',
    answerOptions: [
      {
        key: 'price-war',
        labelEn: 'Mostly on price — discounting decides deals',
        labelPl: 'Głównie ceną — o kontraktach decyduje rabat',
        consultantSignalEn: 'Price-based rivalry erodes margin structurally — probe concentration next.',
        consultantSignalPl: 'Rywalizacja cenowa strukturalnie zjada marżę — badaj koncentrację.',
        intensityDelta: 1,
      },
      {
        key: 'differentiation',
        labelEn: 'Mostly on differentiation — features, brand, service win',
        labelPl: 'Głównie różnicowaniem — decydują funkcje, marka, obsługa',
        consultantSignalEn: 'Differentiated rivalry protects margin — check whether it is stable.',
        consultantSignalPl: 'Rywalizacja różnicująca chroni marżę — sprawdź, czy jest stabilna.',
        intensityDelta: 0,
      },
    ],
    branches: {
      'price-war': 'riv2-concentration',
      differentiation: 'riv2-concentration',
    },
    defaultNextId: 'riv2-concentration',
  },
  {
    id: 'riv2-concentration',
    force: 'rivalry',
    level: 2,
    intentEn: 'Concentration is the structural driver: fragmented markets fight harder and longer.',
    intentPl: 'Koncentracja to strukturalny sterownik: rynki rozdrobnione walczą mocniej i dłużej.',
    textEn:
      'Is this market concentrated (a few players hold most of it) or fragmented (many small players)? And is capacity growing faster than demand — forcing everyone to fight for the same volume?',
    textPl:
      'Czy ten rynek jest skoncentrowany (kilku graczy trzyma większość), czy rozdrobniony (wielu małych)? I czy moce rosną szybciej niż popyt — zmuszając wszystkich do walki o ten sam wolumen?',
    probeEn: 'Overcapacity in a fragmented market is the textbook setup for a margin-destroying price war.',
    probePl: 'Nadmiar mocy na rozdrobnionym rynku to podręcznikowy układ pod wyniszczającą marże wojnę cenową.',
    answerOptions: [
      {
        key: 'fragmented-overcapacity',
        labelEn: 'Fragmented and/or overcapacity — many fight for the same demand',
        labelPl: 'Rozdrobniony i/lub nadmiar mocy — wielu walczy o ten sam popyt',
        consultantSignalEn: 'Structural pressure high — quantify the share picture.',
        consultantSignalPl: 'Presja strukturalna wysoka — skwantyfikuj obraz udziałów.',
        intensityDelta: 1,
      },
      {
        key: 'concentrated-disciplined',
        labelEn: 'Concentrated with rational, disciplined players',
        labelPl: 'Skoncentrowany, z racjonalnymi, zdyscyplinowanymi graczami',
        consultantSignalEn: 'Oligopoly discipline dampens rivalry — still quantify to confirm.',
        consultantSignalPl: 'Dyscyplina oligopolu tłumi rywalizację — i tak skwantyfikuj, by potwierdzić.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'fragmented-overcapacity': 'riv3-quantify',
      'concentrated-disciplined': 'riv3-quantify',
    },
    defaultNextId: 'riv3-quantify',
  },
  {
    id: 'riv3-quantify',
    force: 'rivalry',
    level: 3,
    intentEn: 'A force you cannot put a number on is an opinion — anchor rivalry in a share or a spread.',
    intentPl: 'Siła, której nie umiesz zmierzyć, to opinia — zakotwicz rywalizację w udziale lub rozpiętości.',
    textEn:
      'Put one number on the rivalry: your market share vs the top rival, or the price spread between the cheapest and most expensive credible offer. Which number would you show a board?',
    textPl:
      'Podaj jedną liczbę rywalizacji: Wasz udział vs czołowy rywal, albo rozpiętość cen między najtańszą a najdroższą wiarygodną ofertą. Którą liczbę pokazalibyście zarządowi?',
    probeEn: 'No number? Then name where it lives and make retrieving it the first action — never invent it.',
    probePl: 'Brak liczby? Wskaż, gdzie mieszka, i zdobądź ją jako pierwszą akcję — nigdy jej nie wymyślaj.',
    answerOptions: [
      {
        key: 'quantified-tight',
        labelEn: 'We have a number and it shows tight, brutal competition',
        labelPl: 'Mamy liczbę i pokazuje ostrą, brutalną konkurencję',
        consultantSignalEn: 'Quantified high rivalry — trend decides how fast we must respond.',
        consultantSignalPl: 'Skwantyfikowana wysoka rywalizacja — trend decyduje, jak szybko musimy reagować.',
        intensityDelta: 1,
      },
      {
        key: 'quantified-room',
        labelEn: 'We have a number and there is room — differentiation holds price',
        labelPl: 'Mamy liczbę i jest przestrzeń — różnicowanie utrzymuje cenę',
        consultantSignalEn: 'Quantified moderate rivalry — confirm the trend before relaxing.',
        consultantSignalPl: 'Skwantyfikowana umiarkowana rywalizacja — potwierdź trend, zanim odpuścisz.',
        intensityDelta: -1,
      },
      {
        key: 'no-number',
        labelEn: 'We cannot put a number on it yet',
        labelPl: 'Jeszcze nie umiemy podać liczby',
        consultantSignalEn: 'Keep qualitative, mark "to be established" — the intensity verdict stays provisional.',
        consultantSignalPl: 'Zostaw jakościowo, oznacz „do ustalenia" — werdykt natężenia zostaje wstępny.',
        intensityDelta: 0,
      },
    ],
    branches: {
      'quantified-tight': 'riv4-trend',
      'quantified-room': 'riv4-trend',
      'no-number': 'riv4-trend',
    },
    defaultNextId: 'riv4-trend',
  },
  {
    id: 'riv4-trend',
    force: 'rivalry',
    level: 4,
    intentEn: 'A force is a trajectory, not a snapshot — intensifying rivalry outranks high-but-stable rivalry.',
    intentPl: 'Siła to trajektoria, nie zdjęcie — nasilająca się rywalizacja wyprzedza wysoką-ale-stabilną.',
    textEn:
      'Over the next 24 months, is rivalry intensifying (new capacity, consolidation, a funded entrant getting aggressive) or easing (exits, discipline, demand catching up)? What is the evidence?',
    textPl:
      'W ciągu najbliższych 24 miesięcy rywalizacja się nasila (nowe moce, konsolidacja, dofinansowany gracz robi się agresywny) czy słabnie (wyjścia, dyscyplina, popyt dogania)? Jaki jest dowód?',
    answerOptions: [
      {
        key: 'intensifying',
        labelEn: 'Intensifying — pressure is building',
        labelPl: 'Nasila się — presja rośnie',
        consultantSignalEn: 'Rising rivalry — the strategic response fights for slot #1 in sequencing.',
        consultantSignalPl: 'Rosnąca rywalizacja — odpowiedź strategiczna walczy o slot #1 w kolejności.',
        intensityDelta: 1,
      },
      {
        key: 'easing',
        labelEn: 'Easing — the market is settling down',
        labelPl: 'Słabnie — rynek się uspokaja',
        consultantSignalEn: 'Falling rivalry — patient positioning is possible.',
        consultantSignalPl: 'Malejąca rywalizacja — możliwe cierpliwe pozycjonowanie.',
        intensityDelta: -1,
      },
    ],
    branches: { intensifying: null, easing: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// NEW ENTRANTS — barriers to entry, capital, incumbency advantages, trend
// ---------------------------------------------------------------------------

const NEW_ENTRANT_QUESTIONS: PorterQuestionNode[] = [
  {
    id: 'ent1-surface',
    force: 'newEntrants',
    level: 1,
    intentEn: 'Locate the realistic entrant — the threat is not "anyone could", it is "who plausibly would".',
    intentPl: 'Zlokalizować realistycznego wchodzącego — zagrożeniem nie jest „każdy mógłby", lecz „kto realnie wejdzie".',
    textEn:
      'Who could plausibly enter this market in the next two years — an adjacent player extending, a foreign entrant, a well-funded startup? Or are barriers high enough that nobody realistically will?',
    textPl:
      'Kto realistycznie mógłby wejść na ten rynek w ciągu dwóch lat — gracz z sąsiedztwa rozszerzający ofertę, wchodzący zza granicy, dobrze dofinansowany startup? Czy bariery są na tyle wysokie, że realnie nikt nie wejdzie?',
    probeEn: 'Name the most plausible entrant. "No one" is a claim that needs the barrier evidence to back it.',
    probePl: 'Nazwij najbardziej prawdopodobnego wchodzącego. „Nikt" to teza, którą musi poprzeć dowód barier.',
    answerOptions: [
      {
        key: 'plausible-entrant',
        labelEn: 'Yes — we can name a plausible entrant',
        labelPl: 'Tak — umiemy nazwać prawdopodobnego wchodzącego',
        consultantSignalEn: 'Live entry threat — test how high the barriers really are.',
        consultantSignalPl: 'Żywe zagrożenie wejściem — sprawdź, jak realnie wysokie są bariery.',
        intensityDelta: 1,
      },
      {
        key: 'no-plausible-entrant',
        labelEn: 'No — barriers make entry unattractive',
        labelPl: 'Nie — bariery czynią wejście nieatrakcyjnym',
        consultantSignalEn: 'Low apparent threat — still name the barrier that protects you.',
        consultantSignalPl: 'Niskie pozorne zagrożenie — i tak nazwij barierę, która Was chroni.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'plausible-entrant': 'ent2-barriers',
      'no-plausible-entrant': 'ent2-barriers',
    },
    defaultNextId: 'ent2-barriers',
  },
  {
    id: 'ent2-barriers',
    force: 'newEntrants',
    level: 2,
    intentEn: 'Name the barrier: capital, regulation, brand, network effects, know-how, distribution access.',
    intentPl: 'Nazwij barierę: kapitał, regulacje, marka, efekty sieciowe, know-how, dostęp do dystrybucji.',
    textEn:
      'What actually stops a new entrant — capital intensity, regulation/licensing, brand and switching costs, network effects, proprietary know-how, or locked-up distribution? Which is the real gate?',
    textPl:
      'Co naprawdę zatrzymuje nowego wchodzącego — kapitałochłonność, regulacje/licencje, marka i koszty zmiany, efekty sieciowe, zastrzeżone know-how czy zamknięta dystrybucja? Która bariera jest realną bramą?',
    probeEn: 'A barrier you cannot name is a barrier you do not have — it just has not been tested yet.',
    probePl: 'Bariera, której nie umiesz nazwać, to bariera, której nie masz — po prostu nikt jej jeszcze nie przetestował.',
    answerOptions: [
      {
        key: 'hard-barriers',
        labelEn: 'Hard structural barriers (capital, regulation, network effects)',
        labelPl: 'Twarde bariery strukturalne (kapitał, regulacje, efekty sieciowe)',
        consultantSignalEn: 'Structural moat against entry — quantify how tall it is.',
        consultantSignalPl: 'Strukturalna fosa przeciw wejściu — skwantyfikuj, jak wysoka.',
        intensityDelta: -1,
      },
      {
        key: 'soft-barriers',
        labelEn: 'Mostly soft barriers (execution, relationships, first-mover habit)',
        labelPl: 'Głównie miękkie bariery (egzekucja, relacje, przyzwyczajenie pierwszego gracza)',
        consultantSignalEn: 'Soft barriers fall to a funded, patient entrant — treat threat as real.',
        consultantSignalPl: 'Miękkie bariery padają przed dofinansowanym, cierpliwym wchodzącym — traktuj zagrożenie jako realne.',
        intensityDelta: 1,
      },
    ],
    branches: {
      'hard-barriers': 'ent3-quantify',
      'soft-barriers': 'ent3-quantify',
    },
    defaultNextId: 'ent3-quantify',
  },
  {
    id: 'ent3-quantify',
    force: 'newEntrants',
    level: 3,
    intentEn: 'Quantify the barrier — the minimum capital or time to reach viable scale is the entry test.',
    intentPl: 'Skwantyfikuj barierę — minimalny kapitał lub czas do rentownej skali to test wejścia.',
    textEn:
      'What would a serious entrant have to spend or wait to reach viable scale here — an order-of-magnitude capital figure, months to first revenue, a licence lead time? Anchor it in one real number.',
    textPl:
      'Ile musiałby wydać albo odczekać poważny wchodzący, by osiągnąć tu rentowną skalę — rząd wielkości kapitału, miesiące do pierwszego przychodu, czas oczekiwania na licencję? Zakotwicz to w jednej realnej liczbie.',
    probeEn: 'If entry costs little and takes months, the barrier is decorative — say so plainly.',
    probePl: 'Jeśli wejście kosztuje niewiele i trwa miesiące, bariera jest dekoracyjna — powiedz to wprost.',
    answerOptions: [
      {
        key: 'high-cost',
        labelEn: 'High — years and serious capital to reach scale',
        labelPl: 'Wysoki — lata i poważny kapitał do osiągnięcia skali',
        consultantSignalEn: 'Quantified tall barrier — entry threat low; confirm the trend.',
        consultantSignalPl: 'Skwantyfikowana wysoka bariera — zagrożenie wejściem niskie; potwierdź trend.',
        intensityDelta: -1,
      },
      {
        key: 'low-cost',
        labelEn: 'Low — modest capital, months to enter',
        labelPl: 'Niski — skromny kapitał, miesiące do wejścia',
        consultantSignalEn: 'Quantified low barrier — entry threat high; trend decides urgency.',
        consultantSignalPl: 'Skwantyfikowana niska bariera — zagrożenie wejściem wysokie; trend decyduje o pilności.',
        intensityDelta: 1,
      },
      {
        key: 'no-number',
        labelEn: 'We cannot size the entry cost yet',
        labelPl: 'Jeszcze nie umiemy wycenić kosztu wejścia',
        consultantSignalEn: 'Keep qualitative, mark "to be established" — verdict stays provisional.',
        consultantSignalPl: 'Zostaw jakościowo, oznacz „do ustalenia" — werdykt zostaje wstępny.',
        intensityDelta: 0,
      },
    ],
    branches: {
      'high-cost': 'ent4-trend',
      'low-cost': 'ent4-trend',
      'no-number': 'ent4-trend',
    },
    defaultNextId: 'ent4-trend',
  },
  {
    id: 'ent4-trend',
    force: 'newEntrants',
    level: 4,
    intentEn: 'Barriers erode — technology and capital shifts can drop an entry gate in a single cycle.',
    intentPl: 'Bariery erodują — zmiany technologii i kapitału potrafią opuścić bramę wejścia w jednym cyklu.',
    textEn:
      'Is the entry barrier rising or falling — is technology, cheap capital, or a platform lowering the cost to enter, or is regulation/scale raising it? What is the evidence over the next 24 months?',
    textPl:
      'Bariera wejścia rośnie czy maleje — czy technologia, tani kapitał lub platforma obniżają koszt wejścia, czy regulacje/skala go podnoszą? Jaki jest dowód na najbliższe 24 miesiące?',
    answerOptions: [
      {
        key: 'falling-barrier',
        labelEn: 'Barrier is falling — entry is getting easier',
        labelPl: 'Bariera maleje — wejście staje się łatwiejsze',
        consultantSignalEn: 'Opening gate — pre-empt entry now, while the moat still holds.',
        consultantSignalPl: 'Otwierająca się brama — uprzedź wejście teraz, póki fosa jeszcze trzyma.',
        intensityDelta: 1,
      },
      {
        key: 'rising-barrier',
        labelEn: 'Barrier is rising — entry is getting harder',
        labelPl: 'Bariera rośnie — wejście staje się trudniejsze',
        consultantSignalEn: 'Strengthening moat — entry threat de-prioritized.',
        consultantSignalPl: 'Wzmacniająca się fosa — zagrożenie wejściem schodzi z priorytetu.',
        intensityDelta: -1,
      },
    ],
    branches: { 'falling-barrier': null, 'rising-barrier': null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// SUBSTITUTES — the alternative outside the industry, price/performance, trend
// ---------------------------------------------------------------------------

const SUBSTITUTE_QUESTIONS: PorterQuestionNode[] = [
  {
    id: 'sub1-surface',
    force: 'substitutes',
    level: 1,
    intentEn: 'A substitute is a different way to get the job done, not a competitor selling the same thing.',
    intentPl: 'Substytut to inny sposób wykonania zadania, nie konkurent sprzedający to samo.',
    textEn:
      'What is the completely different way your customers could get the same job done without your category at all — an in-house alternative, a new technology, simply doing nothing? Name the most credible one.',
    textPl:
      'Jaki jest zupełnie inny sposób, w jaki klienci mogą wykonać to samo zadanie bez Waszej kategorii — rozwiązanie własne, nowa technologia, po prostu nic-nie-robienie? Nazwij najbardziej wiarygodny.',
    probeEn: 'If no substitute exists, say so — but "none" is rare; even inertia is a substitute.',
    probePl: 'Jeśli substytut nie istnieje, powiedz to — ale „żaden" jest rzadki; nawet bezwład jest substytutem.',
    answerOptions: [
      {
        key: 'credible-substitute',
        labelEn: 'Yes — a credible alternative exists',
        labelPl: 'Tak — istnieje wiarygodna alternatywa',
        consultantSignalEn: 'Live substitution threat — test its price/performance.',
        consultantSignalPl: 'Żywe zagrożenie substytucją — sprawdź jej cenę/wydajność.',
        intensityDelta: 1,
      },
      {
        key: 'weak-substitute',
        labelEn: 'Only weak or inconvenient alternatives',
        labelPl: 'Tylko słabe lub niewygodne alternatywy',
        consultantSignalEn: 'Low substitution threat — still test the trend; substitutes improve fast.',
        consultantSignalPl: 'Niskie zagrożenie substytucją — i tak sprawdź trend; substytuty szybko dojrzewają.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'credible-substitute': 'sub2-priceperf',
      'weak-substitute': 'sub2-priceperf',
    },
    defaultNextId: 'sub2-priceperf',
  },
  {
    id: 'sub2-priceperf',
    force: 'substitutes',
    level: 2,
    intentEn: 'Substitution is decided by relative price/performance and the cost of switching to it.',
    intentPl: 'O substytucji decyduje relatywna cena/wydajność i koszt przejścia na nią.',
    textEn:
      'How does the substitute compare on price and performance — cheaper but worse, comparable, or better and cheaper? And how painful is it for a customer to switch to it?',
    textPl:
      'Jak substytut wypada cenowo i wydajnościowo — tańszy ale gorszy, porównywalny, czy lepszy i tańszy? I jak bolesne jest dla klienta przejście na niego?',
    probeEn: 'A substitute that is better AND cheaper AND easy to adopt is an extinction event, not a threat.',
    probePl: 'Substytut lepszy ORAZ tańszy ORAZ łatwy do wdrożenia to wydarzenie wymierające, nie zagrożenie.',
    answerOptions: [
      {
        key: 'better-cheaper',
        labelEn: 'Comparable-or-better and cheaper, easy to adopt',
        labelPl: 'Porównywalny-lub-lepszy i tańszy, łatwy do wdrożenia',
        consultantSignalEn: 'Strong substitution pressure — quantify the exposure.',
        consultantSignalPl: 'Silna presja substytucyjna — skwantyfikuj ekspozycję.',
        intensityDelta: 1,
      },
      {
        key: 'worse-or-costly',
        labelEn: 'Worse, or switching to it is costly/disruptive',
        labelPl: 'Gorszy, albo przejście na niego jest kosztowne/uciążliwe',
        consultantSignalEn: 'Switching friction protects you — confirm with a number.',
        consultantSignalPl: 'Tarcie zmiany Was chroni — potwierdź to liczbą.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'better-cheaper': 'sub3-quantify',
      'worse-or-costly': 'sub3-quantify',
    },
    defaultNextId: 'sub3-quantify',
  },
  {
    id: 'sub3-quantify',
    force: 'substitutes',
    level: 3,
    intentEn: 'Size the exposure — what share of your demand could realistically defect to the substitute?',
    intentPl: 'Wymierz ekspozycję — jaka część Waszego popytu realnie mogłaby przejść na substytut?',
    textEn:
      'What share of your revenue serves a job that the substitute could plausibly take over — and have you already seen any of it move? Anchor it in one real number or observation.',
    textPl:
      'Jaka część Waszego przychodu obsługuje zadanie, które substytut mógłby realnie przejąć — i czy widzieliście już, jak coś z tego odpływa? Zakotwicz to w jednej realnej liczbie lub obserwacji.',
    probeEn: 'No number? Then name the tripwire that would tell you defection has started.',
    probePl: 'Brak liczby? Nazwij potykacz, który powie Wam, że odpływ się zaczął.',
    answerOptions: [
      {
        key: 'large-exposure',
        labelEn: 'A large share of revenue is exposed',
        labelPl: 'Duża część przychodu jest wyeksponowana',
        consultantSignalEn: 'Quantified high exposure — trend decides how fast to react.',
        consultantSignalPl: 'Skwantyfikowana wysoka ekspozycja — trend decyduje, jak szybko reagować.',
        intensityDelta: 1,
      },
      {
        key: 'small-exposure',
        labelEn: 'Only a small share is exposed',
        labelPl: 'Wyeksponowana jest tylko mała część',
        consultantSignalEn: 'Quantified low exposure — monitor rather than mobilize.',
        consultantSignalPl: 'Skwantyfikowana niska ekspozycja — monitoruj zamiast mobilizować.',
        intensityDelta: -1,
      },
      {
        key: 'no-number',
        labelEn: 'We cannot size the exposure yet',
        labelPl: 'Jeszcze nie umiemy zmierzyć ekspozycji',
        consultantSignalEn: 'Keep qualitative, mark "to be established" — verdict stays provisional.',
        consultantSignalPl: 'Zostaw jakościowo, oznacz „do ustalenia" — werdykt zostaje wstępny.',
        intensityDelta: 0,
      },
    ],
    branches: {
      'large-exposure': 'sub4-trend',
      'small-exposure': 'sub4-trend',
      'no-number': 'sub4-trend',
    },
    defaultNextId: 'sub4-trend',
  },
  {
    id: 'sub4-trend',
    force: 'substitutes',
    level: 4,
    intentEn: 'Substitutes improve on a curve — a weak substitute today can be the default in three years.',
    intentPl: 'Substytuty poprawiają się po krzywej — słaby substytut dziś może być standardem za trzy lata.',
    textEn:
      'Is the substitute getting better/cheaper fast (technology curve, scale, investment) or stalling? What is the evidence that its price/performance is moving toward your customers?',
    textPl:
      'Czy substytut szybko tanieje/dojrzewa (krzywa technologii, skala, inwestycje) czy grzęźnie? Jaki jest dowód, że jego cena/wydajność zbliża się do Waszych klientów?',
    answerOptions: [
      {
        key: 'improving',
        labelEn: 'Improving fast — closing the gap',
        labelPl: 'Szybko dojrzewa — domyka lukę',
        consultantSignalEn: 'Approaching substitute — reposition before the curve crosses.',
        consultantSignalPl: 'Zbliżający się substytut — przepozycjonuj zanim krzywa się przetnie.',
        intensityDelta: 1,
      },
      {
        key: 'stalling',
        labelEn: 'Stalling — the gap is not closing',
        labelPl: 'Grzęźnie — luka się nie domyka',
        consultantSignalEn: 'Static substitute — monitor with a defined indicator.',
        consultantSignalPl: 'Statyczny substytut — monitoruj zdefiniowanym wskaźnikiem.',
        intensityDelta: -1,
      },
    ],
    branches: { improving: null, stalling: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// BUYER POWER — concentration of buyers, switching costs, price sensitivity, trend
// ---------------------------------------------------------------------------

const BUYER_QUESTIONS: PorterQuestionNode[] = [
  {
    id: 'buy1-surface',
    force: 'buyerPower',
    level: 1,
    intentEn: 'Buyer power starts with buyer concentration — one buyer at 40% of revenue dictates terms.',
    intentPl: 'Siła nabywcy zaczyna się od jego koncentracji — jeden nabywca na 40% przychodu dyktuje warunki.',
    textEn:
      'How concentrated are your customers — does a handful of them account for most of your revenue, or is it spread across many small accounts? Name your largest customer’s share.',
    textPl:
      'Jak skoncentrowani są Wasi klienci — czy garstka odpowiada za większość przychodu, czy rozkłada się on na wielu małych? Podaj udział największego klienta.',
    probeEn: 'A customer who could walk with a chunk of your revenue already has power — whether they use it yet or not.',
    probePl: 'Klient, który może odejść z kawałkiem Waszego przychodu, już ma siłę — niezależnie od tego, czy jej używa.',
    answerOptions: [
      {
        key: 'concentrated-buyers',
        labelEn: 'Concentrated — a few buyers dominate our revenue',
        labelPl: 'Skoncentrowani — kilku nabywców dominuje w naszym przychodzie',
        consultantSignalEn: 'High latent buyer power — test switching costs.',
        consultantSignalPl: 'Wysoka utajona siła nabywcy — sprawdź koszty zmiany.',
        intensityDelta: 1,
      },
      {
        key: 'fragmented-buyers',
        labelEn: 'Fragmented — many small customers',
        labelPl: 'Rozdrobnieni — wielu małych klientów',
        consultantSignalEn: 'Diluted buyer power — still test whether they can switch cheaply.',
        consultantSignalPl: 'Rozproszona siła nabywcy — i tak sprawdź, czy mogą tanio odejść.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'concentrated-buyers': 'buy2-switching',
      'fragmented-buyers': 'buy2-switching',
    },
    defaultNextId: 'buy2-switching',
  },
  {
    id: 'buy2-switching',
    force: 'buyerPower',
    level: 2,
    intentEn: 'Switching costs are the real lever — a buyer locked in by integration cannot use their size.',
    intentPl: 'Koszty zmiany to realna dźwignia — nabywca zamknięty integracją nie może użyć swojej wielkości.',
    textEn:
      'How hard is it for a customer to leave you — deep integration, contracts, data lock-in, retraining, or one email and they are gone? What actually holds them?',
    textPl:
      'Jak trudno klientowi od Was odejść — głęboka integracja, kontrakty, zamknięcie danych, przeuczenie, czy jeden e-mail i już go nie ma? Co realnie go trzyma?',
    probeEn: 'Switching costs you cannot name are switching costs the buyer will discover they do not have.',
    probePl: 'Koszty zmiany, których nie umiesz nazwać, to koszty, których nabywca — jak odkryje — nie ma.',
    answerOptions: [
      {
        key: 'high-switching',
        labelEn: 'High — leaving us is genuinely painful',
        labelPl: 'Wysokie — odejście od nas jest realnie bolesne',
        consultantSignalEn: 'Lock-in dampens buyer power — quantify the dependency.',
        consultantSignalPl: 'Zamknięcie tłumi siłę nabywcy — skwantyfikuj zależność.',
        intensityDelta: -1,
      },
      {
        key: 'low-switching',
        labelEn: 'Low — customers can switch easily',
        labelPl: 'Niskie — klienci mogą łatwo odejść',
        consultantSignalEn: 'Easy exit amplifies buyer power — quantify concentration exposure.',
        consultantSignalPl: 'Łatwe wyjście wzmacnia siłę nabywcy — skwantyfikuj ekspozycję koncentracji.',
        intensityDelta: 1,
      },
    ],
    branches: {
      'high-switching': 'buy3-quantify',
      'low-switching': 'buy3-quantify',
    },
    defaultNextId: 'buy3-quantify',
  },
  {
    id: 'buy3-quantify',
    force: 'buyerPower',
    level: 3,
    intentEn: 'Quantify the dependency — the revenue share of the top buyers is the exposure number.',
    intentPl: 'Skwantyfikuj zależność — udział top-nabywców w przychodzie to liczba ekspozycji.',
    textEn:
      'What share of revenue sits with your top 1-3 customers, and how often do they push you on price at renewal? Anchor buyer power in one real number.',
    textPl:
      'Jaka część przychodu leży u Waszych top 1-3 klientów i jak często naciskają Was cenowo przy odnowieniu? Zakotwicz siłę nabywcy w jednej realnej liczbie.',
    probeEn: 'No number? Then name where it lives and make retrieving it the first action.',
    probePl: 'Brak liczby? Wskaż, gdzie mieszka, i zdobądź ją jako pierwszą akcję.',
    answerOptions: [
      {
        key: 'high-dependency',
        labelEn: 'High — top customers hold a large revenue share and press on price',
        labelPl: 'Wysoka — top-klienci trzymają duży udział i naciskają cenowo',
        consultantSignalEn: 'Quantified high buyer power — trend decides urgency of de-concentration.',
        consultantSignalPl: 'Skwantyfikowana wysoka siła nabywcy — trend decyduje o pilności de-koncentracji.',
        intensityDelta: 1,
      },
      {
        key: 'low-dependency',
        labelEn: 'Low — revenue is spread and price pressure is mild',
        labelPl: 'Niska — przychód rozłożony, presja cenowa łagodna',
        consultantSignalEn: 'Quantified low buyer power — confirm the trend before relaxing.',
        consultantSignalPl: 'Skwantyfikowana niska siła nabywcy — potwierdź trend, zanim odpuścisz.',
        intensityDelta: -1,
      },
      {
        key: 'no-number',
        labelEn: 'We cannot put a number on it yet',
        labelPl: 'Jeszcze nie umiemy podać liczby',
        consultantSignalEn: 'Keep qualitative, mark "to be established" — verdict stays provisional.',
        consultantSignalPl: 'Zostaw jakościowo, oznacz „do ustalenia" — werdykt zostaje wstępny.',
        intensityDelta: 0,
      },
    ],
    branches: {
      'high-dependency': 'buy4-trend',
      'low-dependency': 'buy4-trend',
      'no-number': 'buy4-trend',
    },
    defaultNextId: 'buy4-trend',
  },
  {
    id: 'buy4-trend',
    force: 'buyerPower',
    level: 4,
    intentEn: 'Buyer power shifts with consolidation and transparency — both hand buyers more leverage.',
    intentPl: 'Siła nabywcy zmienia się z konsolidacją i przejrzystością — obie dają nabywcom więcej dźwigni.',
    textEn:
      'Are your buyers gaining power — consolidating, gaining price transparency, building in-house alternatives — or losing it as your product becomes more embedded? What is the evidence?',
    textPl:
      'Czy Wasi nabywcy zyskują siłę — konsolidują się, zyskują przejrzystość cen, budują rozwiązania własne — czy tracą ją, gdy Wasz produkt się zakorzenia? Jaki jest dowód?',
    answerOptions: [
      {
        key: 'gaining',
        labelEn: 'Gaining power — consolidation / transparency rising',
        labelPl: 'Zyskują siłę — rośnie konsolidacja / przejrzystość',
        consultantSignalEn: 'Rising buyer power — raise switching costs before the next renewal cycle.',
        consultantSignalPl: 'Rosnąca siła nabywcy — podnieś koszty zmiany przed kolejnym cyklem odnowień.',
        intensityDelta: 1,
      },
      {
        key: 'losing',
        labelEn: 'Losing power — we are becoming more embedded',
        labelPl: 'Tracą siłę — coraz mocniej się zakorzeniamy',
        consultantSignalEn: 'Falling buyer power — defend the lock-in you have built.',
        consultantSignalPl: 'Malejąca siła nabywcy — broń zbudowanego zamknięcia.',
        intensityDelta: -1,
      },
    ],
    branches: { gaining: null, losing: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// SUPPLIER POWER — concentration of suppliers, switching costs, criticality, trend
// ---------------------------------------------------------------------------

const SUPPLIER_QUESTIONS: PorterQuestionNode[] = [
  {
    id: 'sup1-surface',
    force: 'supplierPower',
    level: 1,
    intentEn: 'Supplier power starts with how few and how critical your key suppliers are.',
    intentPl: 'Siła dostawcy zaczyna się od tego, jak nieliczni i jak krytyczni są Wasi kluczowi dostawcy.',
    textEn:
      'For your most critical input — component, talent, platform, licence — how many credible suppliers exist? Is it one, a few, or many interchangeable ones?',
    textPl:
      'Dla Waszego najbardziej krytycznego wejścia — komponent, talent, platforma, licencja — ilu wiarygodnych dostawców istnieje? Jeden, kilku, czy wielu wymiennych?',
    probeEn: 'Name the input that would stop your operation if its supplier walked away.',
    probePl: 'Nazwij wejście, którego brak zatrzymałby Waszą działalność, gdyby dostawca odszedł.',
    answerOptions: [
      {
        key: 'few-suppliers',
        labelEn: 'One or a few — the critical input is sole/near-sole sourced',
        labelPl: 'Jeden lub kilku — krytyczne wejście z jednego/prawie jednego źródła',
        consultantSignalEn: 'High supplier concentration — test switching cost and criticality.',
        consultantSignalPl: 'Wysoka koncentracja dostawców — sprawdź koszt zmiany i krytyczność.',
        intensityDelta: 1,
      },
      {
        key: 'many-suppliers',
        labelEn: 'Many interchangeable suppliers',
        labelPl: 'Wielu wymiennych dostawców',
        consultantSignalEn: 'Diluted supplier power — still test whether switching is truly cheap.',
        consultantSignalPl: 'Rozproszona siła dostawcy — i tak sprawdź, czy zmiana jest naprawdę tania.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'few-suppliers': 'sup2-switching',
      'many-suppliers': 'sup2-switching',
    },
    defaultNextId: 'sup2-switching',
  },
  {
    id: 'sup2-switching',
    force: 'supplierPower',
    level: 2,
    intentEn: 'Switching cost and forward-integration threat turn a supplier into a price-setter.',
    intentPl: 'Koszt zmiany i groźba integracji w przód zamieniają dostawcę w ustalającego cenę.',
    textEn:
      'How hard is it to switch this supplier — certification, re-tooling, contracts, unique know-how? And could this supplier plausibly move downstream and compete with you directly?',
    textPl:
      'Jak trudno zmienić tego dostawcę — certyfikacja, przezbrojenie, kontrakty, unikalne know-how? I czy ten dostawca mógłby realnie wejść w dół łańcucha i konkurować z Wami wprost?',
    probeEn: 'A sole supplier who could become your competitor is holding two knives, not one.',
    probePl: 'Jedyny dostawca, który może stać się Waszym konkurentem, trzyma dwa noże, nie jeden.',
    answerOptions: [
      {
        key: 'locked-or-forward',
        labelEn: 'Hard to switch and/or they could integrate forward',
        labelPl: 'Trudno zmienić i/lub mogą wejść w dół łańcucha',
        consultantSignalEn: 'Structural supplier leverage — quantify the dependency.',
        consultantSignalPl: 'Strukturalna dźwignia dostawcy — skwantyfikuj zależność.',
        intensityDelta: 1,
      },
      {
        key: 'easy-switch',
        labelEn: 'Easy to switch; no forward-integration threat',
        labelPl: 'Łatwo zmienić; brak groźby integracji w przód',
        consultantSignalEn: 'Weak supplier leverage — confirm with a dependency number.',
        consultantSignalPl: 'Słaba dźwignia dostawcy — potwierdź liczbą zależności.',
        intensityDelta: -1,
      },
    ],
    branches: {
      'locked-or-forward': 'sup3-quantify',
      'easy-switch': 'sup3-quantify',
    },
    defaultNextId: 'sup3-quantify',
  },
  {
    id: 'sup3-quantify',
    force: 'supplierPower',
    level: 3,
    intentEn: 'Quantify the dependency — the supplier’s share of your COGS or the switching lead time.',
    intentPl: 'Skwantyfikuj zależność — udział dostawcy w Waszym koszcie własnym lub czas przełączenia.',
    textEn:
      'What share of your cost base does this supplier control, or how many months would it take to qualify an alternative? Anchor supplier power in one real number.',
    textPl:
      'Jaką część Waszej bazy kosztów kontroluje ten dostawca, albo ile miesięcy zajęłoby zakwalifikowanie alternatywy? Zakotwicz siłę dostawcy w jednej realnej liczbie.',
    probeEn: 'No number? Then name where it lives and make retrieving it the first action.',
    probePl: 'Brak liczby? Wskaż, gdzie mieszka, i zdobądź ją jako pierwszą akcję.',
    answerOptions: [
      {
        key: 'high-dependency',
        labelEn: 'High — large cost share and long time to qualify an alternative',
        labelPl: 'Wysoka — duży udział kosztów i długi czas na alternatywę',
        consultantSignalEn: 'Quantified high supplier power — trend decides urgency of dual-sourcing.',
        consultantSignalPl: 'Skwantyfikowana wysoka siła dostawcy — trend decyduje o pilności drugiego źródła.',
        intensityDelta: 1,
      },
      {
        key: 'low-dependency',
        labelEn: 'Low — modest cost share, alternatives qualify quickly',
        labelPl: 'Niska — skromny udział kosztów, alternatywy szybko do zakwalifikowania',
        consultantSignalEn: 'Quantified low supplier power — confirm the trend before relaxing.',
        consultantSignalPl: 'Skwantyfikowana niska siła dostawcy — potwierdź trend, zanim odpuścisz.',
        intensityDelta: -1,
      },
      {
        key: 'no-number',
        labelEn: 'We cannot put a number on it yet',
        labelPl: 'Jeszcze nie umiemy podać liczby',
        consultantSignalEn: 'Keep qualitative, mark "to be established" — verdict stays provisional.',
        consultantSignalPl: 'Zostaw jakościowo, oznacz „do ustalenia" — werdykt zostaje wstępny.',
        intensityDelta: 0,
      },
    ],
    branches: {
      'high-dependency': 'sup4-trend',
      'low-dependency': 'sup4-trend',
      'no-number': 'sup4-trend',
    },
    defaultNextId: 'sup4-trend',
  },
  {
    id: 'sup4-trend',
    force: 'supplierPower',
    level: 4,
    intentEn: 'Supplier power shifts with consolidation, scarcity, and forward integration moves.',
    intentPl: 'Siła dostawcy zmienia się z konsolidacją, niedoborem i ruchami integracji w przód.',
    textEn:
      'Is this supplier gaining leverage — consolidating, facing scarcity, moving downstream — or losing it as new sources or substitutes appear? What is the evidence over 24 months?',
    textPl:
      'Czy ten dostawca zyskuje dźwignię — konsoliduje się, zmaga z niedoborem, wchodzi w dół łańcucha — czy traci ją, gdy pojawiają się nowe źródła lub substytuty? Jaki jest dowód na 24 miesiące?',
    answerOptions: [
      {
        key: 'gaining',
        labelEn: 'Gaining leverage — scarcity / consolidation rising',
        labelPl: 'Zyskuje dźwignię — rośnie niedobór / konsolidacja',
        consultantSignalEn: 'Rising supplier power — secure supply / dual-source before the squeeze.',
        consultantSignalPl: 'Rosnąca siła dostawcy — zabezpiecz dostawy / drugie źródło przed ściskiem.',
        intensityDelta: 1,
      },
      {
        key: 'losing',
        labelEn: 'Losing leverage — new sources / substitutes appearing',
        labelPl: 'Traci dźwignię — pojawiają się nowe źródła / substytuty',
        consultantSignalEn: 'Falling supplier power — renegotiate from a stronger position.',
        consultantSignalPl: 'Malejąca siła dostawcy — renegocjuj z silniejszej pozycji.',
        intensityDelta: -1,
      },
    ],
    branches: { gaining: null, losing: null },
    defaultNextId: null,
  },
];

// ---------------------------------------------------------------------------
// Bank assembly + pure accessors
// ---------------------------------------------------------------------------

export const PORTER_QUESTION_BANK: Record<PorterForceId, PorterQuestionNode[]> = {
  rivalry: RIVALRY_QUESTIONS,
  newEntrants: NEW_ENTRANT_QUESTIONS,
  substitutes: SUBSTITUTE_QUESTIONS,
  buyerPower: BUYER_QUESTIONS,
  supplierPower: SUPPLIER_QUESTIONS,
};

export const PORTER_FORCE_IDS: PorterForceId[] = [
  'rivalry',
  'newEntrants',
  'substitutes',
  'buyerPower',
  'supplierPower',
];

export const PORTER_FORCE_LABELS: Record<PorterForceId, { en: string; pl: string }> = {
  rivalry: { en: 'Competitive rivalry', pl: 'Rywalizacja konkurencyjna' },
  newEntrants: { en: 'Threat of new entrants', pl: 'Groźba nowych graczy' },
  substitutes: { en: 'Threat of substitutes', pl: 'Groźba substytutów' },
  buyerPower: { en: 'Bargaining power of buyers', pl: 'Siła przetargowa nabywców' },
  supplierPower: { en: 'Bargaining power of suppliers', pl: 'Siła przetargowa dostawców' },
};

const ALL_QUESTIONS: PorterQuestionNode[] = [
  ...RIVALRY_QUESTIONS,
  ...NEW_ENTRANT_QUESTIONS,
  ...SUBSTITUTE_QUESTIONS,
  ...BUYER_QUESTIONS,
  ...SUPPLIER_QUESTIONS,
];

const QUESTION_INDEX = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));

export function getPorterQuestionById(id: string): PorterQuestionNode | undefined {
  return QUESTION_INDEX.get(id);
}

export function getPorterEntryQuestion(force: PorterForceId): PorterQuestionNode {
  return PORTER_QUESTION_BANK[force][0];
}

/**
 * Branching resolver: the answer to a question determines the next question.
 * Unknown answer keys fall back to defaultNextId (never dead-end silently).
 */
export function getNextPorterQuestion(
  currentQuestionId: string,
  answerKey: string
): PorterQuestionNode | null {
  const current = QUESTION_INDEX.get(currentQuestionId);
  if (!current) return null;
  const nextId =
    answerKey in current.branches ? current.branches[answerKey] : current.defaultNextId;
  if (!nextId) return null;
  return QUESTION_INDEX.get(nextId) || null;
}

export interface PorterLadderAnswer {
  questionId: string;
  answerKey: string;
  /** Free-text elaboration captured in conversation. */
  note?: string;
}

/**
 * Structural self-check used by unit tests and (defensively) at module load in dev:
 * every branch target must exist, every force has 4 leveled questions, levels start
 * at 1 and never skip, options carry an intensityDelta, and every path terminates.
 */
export function validatePorterQuestionBank(): string[] {
  const problems: string[] = [];
  (Object.keys(PORTER_QUESTION_BANK) as PorterForceId[]).forEach((force) => {
    const questions = PORTER_QUESTION_BANK[force];
    const levels = new Set(questions.map((q) => q.level));
    if (!levels.has(1)) problems.push(`${force}: missing level-1 entry question`);
    if (levels.size < 3) problems.push(`${force}: fewer than 3 question levels`);
    questions.forEach((q) => {
      if (q.force !== force) problems.push(`${q.id}: force mismatch`);
      if (q.answerOptions.length < 2) problems.push(`${q.id}: fewer than 2 answer options`);
      q.answerOptions.forEach((opt) => {
        if (!(opt.key in q.branches)) problems.push(`${q.id}: option ${opt.key} has no branch`);
        if (![-1, 0, 1].includes(opt.intensityDelta)) {
          problems.push(`${q.id}: option ${opt.key} has invalid intensityDelta`);
        }
      });
      Object.entries(q.branches).forEach(([key, target]) => {
        if (target !== null && !QUESTION_INDEX.has(target)) {
          problems.push(`${q.id}: branch ${key} points to missing question ${target}`);
        }
      });
      if (q.defaultNextId !== null && !QUESTION_INDEX.has(q.defaultNextId)) {
        problems.push(`${q.id}: defaultNextId points to missing question`);
      }
      if (!q.textPl || !q.textEn) problems.push(`${q.id}: missing PL or EN text`);
    });
    // Every path from the entry question must terminate (no cycles).
    const entry = questions.find((q) => q.level === 1);
    if (entry) {
      const stack: { id: string; seen: Set<string> }[] = [{ id: entry.id, seen: new Set() }];
      while (stack.length) {
        const { id, seen } = stack.pop()!;
        if (seen.has(id)) {
          problems.push(`${force}: cycle detected at ${id}`);
          continue;
        }
        const node = QUESTION_INDEX.get(id);
        if (!node) continue;
        const nextSeen = new Set(seen).add(id);
        const targets = new Set(
          Object.values(node.branches).concat(node.defaultNextId ? [node.defaultNextId] : [])
        );
        targets.forEach((t) => {
          if (t) stack.push({ id: t, seen: nextSeen });
        });
      }
    }
  });
  return problems;
}

/**
 * Serialize the ladder for a force into a prompt block, so the AI mentor asks
 * EXACTLY these questions in conversation (single source of truth with the UI).
 */
export function buildForceLadderPromptBlock(
  force: PorterForceId,
  language: 'pl' | 'en'
): string {
  const questions = PORTER_QUESTION_BANK[force];
  return questions
    .map((q) => {
      const text = language === 'pl' ? q.textPl : q.textEn;
      const intent = language === 'pl' ? q.intentPl : q.intentEn;
      const options = q.answerOptions
        .map((opt) => {
          const label = language === 'pl' ? opt.labelPl : opt.labelEn;
          const signal = language === 'pl' ? opt.consultantSignalPl : opt.consultantSignalEn;
          const next = q.branches[opt.key];
          return `    - [${opt.key}] "${label}" (Δintensity ${opt.intensityDelta >= 0 ? '+' : ''}${opt.intensityDelta}) -> ${next || 'ladder complete'} (${signal})`;
        })
        .join('\n');
      return `[${q.id}] (L${q.level}) intent: ${intent}\n  Q: ${text}\n${options}`;
    })
    .join('\n');
}
