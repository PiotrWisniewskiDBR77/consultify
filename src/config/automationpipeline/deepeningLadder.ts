/**
 * Automation Pipeline — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the RPA Scanner / SMED `deepeningLadder` + `PROPOSAL_BANK` pattern.
 * Encodes the automation-pipeline "depth staircase" per assessment lever:
 *
 *   1. surface          — what is the candidate process and where did it come from?
 *   2. evidence         — is the volume/rule/data profile measured, or asserted top-down?
 *   3. quantification   — how many FTE-hours / how much hidden volume + TCO sit here?
 *   4. risk-capability  — what must exist (redesign, API, owner) to automate without harm?
 *
 * The five canonical levers mirror the disciplined pipeline order from the doctrine:
 *   - discover    : source the candidate register (top-down + process/task mining)
 *   - profile     : profile each process (rule-ness, data structure, stability, exceptions)
 *   - technology  : select the right technology tier per process (RPA/IDP/IPA/agentic)
 *   - prioritize  : rank on the effort × impact matrix (quick win / bet / fill-in / question)
 *   - sequence    : sequence the pipeline into waves (quick wins first, then strategic bets)
 *
 * Content is partner-grade, bilingual (PL/EN), consumed by the tool's input
 * sections and by the synthesis engine (automationPipelineEngine.ts).
 */

export type PipelineLeverId =
  | 'discover'
  | 'profile'
  | 'technology'
  | 'prioritize'
  | 'sequence';

export const PIPELINE_LEVERS: PipelineLeverId[] = [
  'discover',
  'profile',
  'technology',
  'prioritize',
  'sequence',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and lever-agnostic. */
export interface LadderRung {
  id: 'surface' | 'evidence' | 'quantification' | 'risk-capability';
  /** 1-4 depth level (surface..risk) — used by the synthesis engine for depth scoring. */
  depth: 1 | 2 | 3 | 4;
  label: Bilingual;
  /** The prompt shown to the user / fed to AI when deepening this rung. */
  question: Bilingual;
  /** Why this rung matters — the consultant framing. */
  rationale: Bilingual;
}

const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const PIPELINE_LADDER_RUNG_ORDER = RUNG_ORDER;

const PIPELINE_LEVER_LABEL: Record<PipelineLeverId, Bilingual> = {
  discover: { pl: 'Odkrywanie', en: 'Discover' },
  profile: { pl: 'Profilowanie', en: 'Profile' },
  technology: { pl: 'Dobór technologii', en: 'Technology fit' },
  prioritize: { pl: 'Priorytetyzacja', en: 'Prioritize' },
  sequence: { pl: 'Sekwencjonowanie', en: 'Sequence' },
};

export const pipelineLeverLabel = (lever: PipelineLeverId): Bilingual =>
  PIPELINE_LEVER_LABEL[lever];

/**
 * Per-lever deepening ladder. Each lever has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const PIPELINE_DEEPENING_LADDER: Record<PipelineLeverId, LadderRung[]> = {
  discover: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Skąd bierze się wasza lista kandydatów do automatyzacji — z warsztatów i zgłoszeń biznesu, czy z analizy logów systemowych (process/task mining)?',
        en: 'Where does your automation candidate list come from — workshops and business requests, or an analysis of system logs (process/task mining)?',
      },
      rationale: {
        pl: 'Lista wyłącznie top-down systematycznie pomija najbolesniejsze, wysokowolumenowe marnotrawstwo — bo stało się „normalne" i nikt go nie zgłasza. Źródło rejestru jest samo w sobie insightem.',
        en: 'A purely top-down list systematically misses the most painful, high-volume waste — because it became "normal" and nobody reports it. The register\'s source is itself an insight.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy wolumen każdego procesu pochodzi z logów transakcyjnych, czy z szacunku właściciela („robimy to jakieś 200 razy dziennie")?',
        en: 'Does each process\'s volume come from transaction logs, or from an owner\'s estimate ("we do it maybe 200 times a day")?',
      },
      rationale: {
        pl: 'Szacunki właścicieli są systematycznie zniekształcone (recency bias, chęć pokazania procesu jako ważniejszego) — dowodem jest log, nie deklaracja.',
        en: 'Owner estimates are systematically distorted (recency bias, wanting a process to look important) — the evidence is the log, not the declaration.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE-godzin rocznie łącznie pochłania cały rejestr kandydatów i który pojedynczy proces jest największym, dotąd niewidocznym blokiem?',
        en: 'How many FTE-hours per year does the whole candidate register consume, and which single process is the largest, previously invisible block?',
      },
      rationale: {
        pl: 'Największy kandydat bywa nisko na liście zgłoszeń, bo nikt się głośno nie skarży — dopiero suma FTE-godzin ujawnia ukryty wolumen, który uzasadnia budżet.',
        en: 'The biggest candidate is often low on the request list because nobody complains loudly — only the FTE-hour sum reveals the hidden volume that justifies the budget.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie zdolność do ciągłego zasilania pipeline\'u (process mining w tle, kwartalne odświeżanie rankingu), czy to jednorazowa lista?',
        en: 'Do you have the capability to continuously feed the pipeline (process mining running in the background, quarterly re-ranking), or is this a one-off list?',
      },
      rationale: {
        pl: 'Pipeline to żywy rejestr, nie jednorazowa lista — bez zdolności odświeżania z danych ranking starzeje się i wraca do politycznego „kto głośniej".',
        en: 'A pipeline is a living register, not a one-off list — without the capability to refresh it from data the ranking ages and reverts to political "who is louder".',
      },
    },
  ],
  profile: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na jakim poziomie oceniacie proces — całego end-to-end („obsługa zamówienia"), czy rozbitego na kroki, z których tylko jeden jest kandydatem?',
        en: 'At what level do you assess a process — the whole end-to-end ("order handling"), or broken into steps where only one is the real candidate?',
      },
      rationale: {
        pl: 'Ocena na zbyt wysokim poziomie agregacji rozmywa wynik: jeden dobry krok ciągnie średnią w górę, a reszta wymaga innej technologii. Rozbij proces przed scoringiem.',
        en: 'Assessing at too high an aggregation level blurs the result: one good step drags the average up while the rest needs a different approach. Break the process into steps before scoring.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest realny udział wyjątków (% przypadków niepasujących do głównej ścieżki) — zmierzony z danych, czy założony „raczej niski"?',
        en: 'What is the real exception rate (% of cases off the main path) — measured from data, or assumed to be "probably low"?',
      },
      rationale: {
        pl: 'Wysoki % wyjątków jest objawem procesu niedojrzałego, nie kandydata — a jest niewidoczny z fotela menedżera. Bez pomiaru wyjątków effort okaże się dużo wyższy niż szacowany.',
        en: 'A high exception rate is a symptom of an immature process, not a candidate — and it is invisible from the manager\'s chair. Without measuring exceptions, effort turns out far higher than estimated.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak skoncentrowany jest wolumen — czy kilka wariantów odpowiada za większość przypadków (80/20), czy jest wiele równoważnych ścieżek bez dominującej?',
        en: 'How concentrated is the volume — do a few variants drive most cases (80/20), or are there many equivalent paths with no dominant one?',
      },
      rationale: {
        pl: 'Jeśli 80% wolumenu to 3 z 15 wariantów, automatyzacja głównej ścieżki + eskalacja wyjątków daje większość wartości przy ułamku effortu — długi ogon nie jest wart osobnej automatyzacji.',
        en: 'If 80% of volume is 3 of 15 variants, automating the main path + escalating exceptions yields most of the value at a fraction of the effort — the long tail is not worth separate automation.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Który z tych procesów wymaga NAJPIERW redesignu (wysoki % wyjątków, niska standaryzacja, pętle przeróbek), zanim jakakolwiek technologia ma sens?',
        en: 'Which of these processes needs a redesign FIRST (high exception rate, low standardization, rework loops) before any technology makes sense?',
      },
      rationale: {
        pl: 'Automatyzacja złego procesu to najdroższy błąd branży — bot wiernie odtwarzający wadliwy proces tylko przyspiesza produkcję błędów. Kolejność: najpierw uprość, potem automatyzuj.',
        en: 'Automating a bad process is the industry\'s most expensive error — a bot faithfully replaying a flawed process only speeds up error production. Order: simplify first, automate second.',
      },
    },
  ],
  technology: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaką technologię zakładacie dla tego procesu — proste RPA, IDP (dokumenty), IPA (RPA+ML), czy agenta AI? Na jakiej podstawie?',
        en: 'What technology do you assume for this process — plain RPA, IDP (documents), IPA (RPA+ML), or an AI agent? On what basis?',
      },
      rationale: {
        pl: 'Automatyzacja to kontinuum technologii, nie jeden wybór. Błąd doboru technologii do natury procesu jest najdroższą pojedynczą pomyłką programu automatyzacji.',
        en: 'Automation is a technology continuum, not one choice. Mismatching technology to the nature of the process is the single most expensive mistake of an automation program.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jak ustrukturyzowane są dane wejściowe — czysty API/system, dokumenty wzorcowe, skany/odręczny tekst, czy swobodny język naturalny?',
        en: 'How structured are the inputs — clean API/system data, template documents, scans/handwriting, or free natural language?',
      },
      rationale: {
        pl: 'Profil danych, nie średnia ocena, wskazuje TYP technologii: proces regułowy ale z nieustrukturyzowanymi dokumentami to kandydat IDP, nie RPA — inaczej wdrożenie utknie na ekstrakcji.',
        en: 'The data profile, not an average score, indicates the technology TYPE: a rule-based process with unstructured documents is an IDP candidate, not RPA — otherwise the build stalls at extraction.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztuje utrzymanie w horyzoncie 2-3 lat (TCO), nie tylko wdrożenie — zwłaszcza dla botów na niestabilnym legacy UI (screen scraping)?',
        en: 'What is the 2-3 year maintenance cost (TCO), not just the build — especially for bots on unstable legacy UI (screen scraping)?',
      },
      rationale: {
        pl: 'Proces o niskim koszcie wdrożenia ale wysokim koszcie utrzymania zaniża się w macierzy effort, jeśli liczy się tylko dev-time — „quick win" okazuje się długoterminową pułapką kosztową.',
        en: 'A process with low build cost but high maintenance cost understates itself in the effort matrix if only dev-time counts — a "quick win" turns out to be a long-term cost trap.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy dobór technologii wynika z profilu procesu, czy z mody rynkowej (agentic AI wszędzie)? Gdzie wystarczy prosty RPA, a gdzie potrzeba modelu?',
        en: 'Does the technology choice follow the process profile, or a market trend (agentic AI everywhere)? Where does plain RPA suffice, and where is a model needed?',
      },
      rationale: {
        pl: 'Proces w 100% regułowy z czystymi danymi API to zmarnowany budżet na agenta LLM (i ryzyko halucynacji tam, gdzie potrzebna 100% deterministyczna reguła). Odwrotnie — RPA na osądzie daje stos wyjątków droższy niż człowiek.',
        en: 'A 100% rule-based process with clean API data is wasted budget on an LLM agent (and a hallucination risk where a 100% deterministic rule is needed). Conversely — RPA forced onto judgment becomes an exception stack costlier than the human it replaced.',
      },
    },
  ],
  prioritize: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak dziś decydujecie, co automatyzować najpierw — analitycznie (macierz effort × impact), czy politycznie (wygrywa najgłośniejszy sponsor)?',
        en: 'How do you decide what to automate first today — analytically (an effort × impact matrix), or politically (the loudest sponsor wins)?',
      },
      rationale: {
        pl: 'Bez wspólnej macierzy program nie skaluje się poza pilotaż — utyka na 5-10 botach, bo każdy kolejny kandydat wymaga osobnej politycznej bitwy o priorytet.',
        en: 'Without a shared matrix the program does not scale past the pilot — it stalls at 5-10 bots, because every next candidate requires its own political battle over priority.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy oś impact to policzone FTE-godziny i koszt unikniętego ryzyka, czy odczucie „to ważny proces"? A oś effort — czy zawiera TCO utrzymania?',
        en: 'Is the impact axis computed FTE-hours and cost of avoided risk, or a feeling that "this is an important process"? And the effort axis — does it include maintenance TCO?',
      },
      rationale: {
        pl: 'Macierz effort × impact jako dowód, nie opinia — to ona pozwala obronić przed zarządem, dlaczego proces A idzie przed procesem B. Bez liczb wraca polityka.',
        en: 'The effort × impact matrix as proof, not opinion — it lets you defend to the board why process A goes before process B. Without numbers, politics returns.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile ze zgłoszonego wolumenu (w FTE-godzinach) leży w procesach ocenionych jako niegotowe technicznie — wymagających redesignu przed jakąkolwiek technologią?',
        en: 'How much of the reported volume (in FTE-hours) sits in processes judged not technically ready — needing redesign before any technology?',
      },
      rationale: {
        pl: 'Jeśli 50% wolumenu leży w procesach niegotowych, ten insight zatrzymuje pipeline przed marnowaniem budżetu i przekierowuje na inicjatywę redesignu procesu, nie technologii.',
        en: 'If 50% of volume sits in not-ready processes, this insight stops the pipeline from wasting budget and redirects it to a process-redesign initiative, not a technology one.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy każdy priorytetowy proces ma właściciela biznesowego gotowego przejąć governance bota, czy „gotowe technicznie" pipeline\'y stoją w miejscu?',
        en: 'Does every prioritized process have a business owner ready to take over bot governance, or do "technically ready" pipelines stand still?',
      },
      rationale: {
        pl: 'Częsty powód, dla którego gotowe technicznie pipeline\'y stoją: bariera pozatechniczna — brak właściciela governance. Ograniczenie wartości leży w organizacji, nie w technologii.',
        en: 'A frequent reason technically-ready pipelines stall: a non-technical barrier — no governance owner. The value constraint sits in the organization, not the technology.',
      },
    },
  ],
  sequence: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Od czego zaczyna wasz roadmap automatyzacji — od strategic bets (bo „najważniejsze"), czy od 2-3 quick winów budujących wiarygodność?',
        en: 'What does your automation roadmap start with — strategic bets (because they are "most important"), or 2-3 quick wins that build credibility?',
      },
      rationale: {
        pl: 'Program zaczynający od strategic bets traci wiarygodność, zanim dowiezie pierwszy efekt — sekwencja zawsze zaczyna się od quick winów, które finansują (budżetowo i politycznie) przejście do dużych zakładów.',
        en: 'A program starting with strategic bets loses credibility before delivering the first result — the sequence always starts with quick wins that fund (budget- and politically) the move to big bets.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy fala 0 ma dowieźć pierwszy żywy efekt w <90 dni, czy roadmap to „big bang" bez pośrednich kamieni milowych?',
        en: 'Is wave 0 meant to deliver the first live result in <90 days, or is the roadmap a "big bang" with no intermediate milestones?',
      },
      rationale: {
        pl: 'Pierwszy żywy efekt w <90 dni buduje zaufanie sponsora i zespołu — dowodem gotowości pipeline\'u jest zdolność do szybkiego pierwszego wdrożenia, nie długość listy zgłoszeń.',
        en: 'A first live result in <90 days builds sponsor and team trust — the proof of pipeline readiness is the ability to ship a fast first deployment, not the length of the request list.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile FTE-godzin rocznie odzyskuje każda fala i czy strategic bets są rozbite na kamienie milowe (człowiek w pętli → pełna automatyzacja), nie na „big bang"?',
        en: 'How many FTE-hours/year does each wave recover, and are strategic bets broken into milestones (human-in-the-loop → full automation), not a "big bang"?',
      },
      rationale: {
        pl: 'Strategic bet bez etapów to zakład bez wyjścia — rozbicie na kamienie (najpierw klasyfikacja z człowiekiem, potem pełna automatyzacja po walidacji trafności) zamienia ryzyko na kontrolowaną naukę.',
        en: 'A strategic bet with no stages is a bet with no exit — breaking it into milestones (classification with a human first, then full automation after accuracy validation) turns risk into controlled learning.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy równolegle z pierwszymi falami budujecie Center of Excellence (standardy, governance botów), czy pipeline pozostaje serią ad-hoc wdrożeń?',
        en: 'Are you building a Center of Excellence (standards, bot governance) alongside the first waves, or does the pipeline stay a series of ad-hoc deployments?',
      },
      rationale: {
        pl: 'Fala 1 to nie tylko kolejne quick winy — to budowa CoE, która zamienia serię botów w program. Bez governance każdy bot rośnie w kruchości szybciej, niż zespół zdąży go utrzymać.',
        en: 'Wave 1 is not just more quick wins — it is building the CoE that turns a series of bots into a program. Without governance each bot grows brittle faster than the team can maintain it.',
      },
    },
  ],
};

export interface LeverProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per lever. Consumed when AI (or the offline
 * fallback) proposes candidate pipeline moves. Mirrors RPA/SMED PROPOSAL_BANK.
 */
export const PIPELINE_PROPOSAL_BANK: Record<PipelineLeverId, LeverProposal[]> = {
  discover: [
    {
      rung: 'surface',
      title: {
        pl: 'Zbudować rejestr kandydatów z process/task miningu, nie tylko ze zgłoszeń',
        en: 'Build the candidate register from process/task mining, not only requests',
      },
      explanation: {
        pl: 'Uzupełnijcie warsztatowe zgłoszenia analizą logów systemowych — mining ujawnia warianty i wolumen, których nikt nie zgłosił, bo stały się „niewidoczne z fotela menedżera".',
        en: 'Complement workshop requests with system-log analysis — mining reveals variants and volume nobody reported because they became "invisible from the manager\'s chair".',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zastąpić szacunki wolumenu logami transakcyjnymi',
        en: 'Replace volume estimates with transaction logs',
      },
      explanation: {
        pl: 'Tam gdzie dostępne są logi (ERP, CRM, ticketing), pobierzcie faktyczny wolumen zamiast deklaracji właściciela — szacunki są systematycznie zawyżone dla procesów „ważnych".',
        en: 'Where logs exist (ERP, CRM, ticketing), pull actual volume instead of an owner\'s declaration — estimates are systematically inflated for "important" processes.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć łączne FTE-godziny w całym rejestrze i wskazać ukryty wolumen',
        en: 'Total the FTE-hours across the register and surface hidden volume',
      },
      explanation: {
        pl: 'Zsumujcie wolumen × czas manualny per kandydat — największy blok często okazuje się procesem, którego nikt nie zgłosił głośno, bo „tak już zawsze było".',
        en: 'Sum volume × manual time per candidate — the biggest block often turns out to be a process nobody flagged loudly because "it was always like that".',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uruchomić kwartalne odświeżanie pipeline\'u z process miningu',
        en: 'Stand up a quarterly pipeline refresh from process mining',
      },
      explanation: {
        pl: 'Wpięcie miningu w tło i re-ocena kandydatów co kwartał utrzymuje pipeline żywy — bez tego ranking starzeje się i wraca do politycznego „kto głośniej".',
        en: 'Wiring mining into the background and re-scoring candidates quarterly keeps the pipeline live — without it the ranking ages and reverts to political "who is louder".',
      },
    },
  ],
  profile: [
    {
      rung: 'surface',
      title: {
        pl: 'Rozbić proces end-to-end na kroki przed scoringiem',
        en: 'Break each end-to-end process into steps before scoring',
      },
      explanation: {
        pl: 'Ocena na poziomie „obsługa zamówienia" rozmywa wynik — rozbijcie na subprocesy, bo często tylko jeden krok jest właściwym kandydatem, a reszta wymaga innej technologii.',
        en: 'Assessing at the "order handling" level blurs the result — break it into subprocesses, because often only one step is the real candidate and the rest needs a different approach.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć udział wyjątków (exception rate) per proces',
        en: 'Measure the exception rate per process',
      },
      explanation: {
        pl: 'Policzcie % przypadków niepasujących do głównej ścieżki — wysoki udział wyjątków jest objawem procesu niedojrzałego, który najpierw wymaga redesignu, nie bota.',
        en: 'Count the % of cases off the main path — a high exception share is a symptom of an immature process that needs redesign first, not a bot.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Sprawdzić koncentrację wolumenu (zasada 80/20 wariantów)',
        en: 'Check volume concentration (the 80/20 rule of variants)',
      },
      explanation: {
        pl: 'Ustalcie, ile wariantów odpowiada za większość wolumenu — jeśli 80% to kilka ścieżek, automatyzujcie główną + eskalacja wyjątków, nie „pokryjcie 100% przypadków od razu".',
        en: 'Establish how many variants drive most volume — if 80% is a few paths, automate the main one + escalate exceptions, not "cover 100% of cases at once".',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Oznaczyć procesy do redesignu PRZED automatyzacją',
        en: 'Flag processes for redesign BEFORE automation',
      },
      explanation: {
        pl: 'Procesy z wysokim % wyjątków / niską standaryzacją / pętlami przeróbek odeślijcie do osobnej inicjatywy standaryzacji — automatyzacja marnotrawstwa to marnotrawstwo w nowym ubraniu.',
        en: 'Send processes with high exceptions / low standardization / rework loops to a separate standardization initiative — automating waste is waste in new clothing.',
      },
    },
  ],
  technology: [
    {
      rung: 'surface',
      title: {
        pl: 'Dobrać poziom technologii do natury procesu (RPA/IDP/IPA/agentic)',
        en: 'Match the technology tier to the process nature (RPA/IDP/IPA/agentic)',
      },
      explanation: {
        pl: 'Automatyzacja to kontinuum: proste RPA dla danych systemowych i reguł jawnych, IDP dla dokumentów, IPA gdy jest komponent osądu, agent AI dla języka naturalnego i decyzji niedeterministycznych.',
        en: 'Automation is a continuum: plain RPA for system data and explicit rules, IDP for documents, IPA where judgment is involved, an AI agent for natural language and non-deterministic decisions.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ocenić profil danych wejściowych, nie tylko regułowość',
        en: 'Assess the input-data profile, not just rule-ness',
      },
      explanation: {
        pl: 'Proces w pełni regułowy, ale z nieustrukturyzowanymi dokumentami, to kandydat IDP, nie RPA — bez warstwy ekstrakcji wdrożenie utknie, zanim reguła w ogóle zadziała.',
        en: 'A fully rule-based process with unstructured documents is an IDP candidate, not RPA — without an extraction layer the build stalls before the rule even runs.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć TCO (2-3 lata), nie tylko koszt wdrożenia',
        en: 'Cost the TCO (2-3 years), not just the build',
      },
      explanation: {
        pl: 'Doliczcie koszt utrzymania w horyzoncie 2-3 lat — boty na niestabilnym legacy UI (screen scraping) mają wysoki effort ciągły, który zamienia „quick win" w pułapkę kosztową.',
        en: 'Add the 2-3 year maintenance cost — bots on unstable legacy UI (screen scraping) carry a high ongoing effort that turns a "quick win" into a cost trap.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zdyscyplinować dobór technologii profilem, nie modą',
        en: 'Discipline the technology choice by profile, not by trend',
      },
      explanation: {
        pl: 'Nie stosujcie najcięższej technologii wszędzie — proces w 100% regułowy z API to zmarnowany budżet na agenta LLM (i ryzyko halucynacji tam, gdzie potrzebna 100% deterministyczna reguła, np. przelew).',
        en: 'Do not apply the heaviest technology everywhere — a 100% rule-based API process is wasted budget on an LLM agent (and a hallucination risk where a 100% deterministic rule is needed, e.g. a bank transfer).',
      },
    },
  ],
  prioritize: [
    {
      rung: 'surface',
      title: {
        pl: 'Ustawić kandydatów na macierzy effort × impact',
        en: 'Place candidates on the effort × impact matrix',
      },
      explanation: {
        pl: 'Rozłóżcie każdy proces na cztery ćwiartki: quick win (impact wysoki / effort niski), strategic bet (oba wysokie), fill-in (oba niskie), question mark (impact niski / effort wysoki → odrzucić lub przeformułować).',
        en: 'Spread each process across four quadrants: quick win (high impact / low effort), strategic bet (both high), fill-in (both low), question mark (low impact / high effort → reject or reframe).',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oprzeć oś impact na FTE-godzinach i koszcie unikniętego ryzyka',
        en: 'Base the impact axis on FTE-hours and cost of avoided risk',
      },
      explanation: {
        pl: 'Zamieńcie „to ważny proces" na policzone oszczędności (wolumen × czas × stawka) plus redukcję ryzyka (compliance, finanse) — macierz jako dowód przed zarządem, nie opinia.',
        en: 'Replace "this is an important process" with computed savings (volume × time × rate) plus risk reduction (compliance, finance) — the matrix as board-facing proof, not an opinion.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyliczyć, ile wolumenu leży w procesach niegotowych technicznie',
        en: 'Quantify how much volume sits in not-ready processes',
      },
      explanation: {
        pl: 'Zsumujcie FTE-godziny procesów ocenionych jako niska standaryzacja/stabilność — jeśli to duża część, priorytetem jest redesign, nie kolejny bot.',
        en: 'Sum the FTE-hours of processes judged low-standardization/stability — if that is a large share, the priority is redesign, not another bot.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przypisać właściciela governance każdemu procesowi priorytetowemu',
        en: 'Assign a governance owner to every prioritized process',
      },
      explanation: {
        pl: 'Zanim proces wejdzie do pipeline\'u, wskażcie właściciela biznesowego gotowego przejąć bota — bez niego „gotowe technicznie" stoi w miejscu miesiącami.',
        en: 'Before a process enters the pipeline, name a business owner ready to take over the bot — without one, "technically ready" stands still for months.',
      },
    },
  ],
  sequence: [
    {
      rung: 'surface',
      title: {
        pl: 'Zacząć od fali 0: 1-2 najsilniejsze quick winy w <90 dni',
        en: 'Start with wave 0: 1-2 strongest quick wins in <90 days',
      },
      explanation: {
        pl: 'Pierwsza fala to dowód koncepcji — cel to pierwszy żywy efekt w mniej niż 90 dni, budujący zaufanie sponsora i zespołu, zanim ruszą duże zakłady.',
        en: 'The first wave is a proof of concept — the goal is a first live result in under 90 days, building sponsor and team trust before big bets begin.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Sfinansować strategic bets efektem quick winów',
        en: 'Fund strategic bets with the quick-win effect',
      },
      explanation: {
        pl: 'Nie zaczynajcie od strategic bets — quick winy finansują (budżetowo i politycznie) przejście do dużych, wieloetapowych wdrożeń. Sekwencja jest dowodem dyscypliny, nie kolejnością życzeń.',
        en: 'Do not start with strategic bets — quick wins fund (budget- and politically) the move to big, multi-stage builds. The sequence is proof of discipline, not a wish order.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Rozbić strategic bet na kamienie milowe (człowiek w pętli → auto)',
        en: 'Break each strategic bet into milestones (human-in-loop → auto)',
      },
      explanation: {
        pl: 'Duże wdrożenie rozbijcie na etapy: najpierw klasyfikacja/decyzja z człowiekiem w pętli, potem pełna automatyzacja po walidacji trafności — nie „big bang", który zakłada wynik bez dowodu.',
        en: 'Break a big build into stages: classification/decision with a human in the loop first, then full automation after accuracy validation — not a "big bang" that assumes the result without proof.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Budować Center of Excellence równolegle z falą 1',
        en: 'Build a Center of Excellence alongside wave 1',
      },
      explanation: {
        pl: 'Fala 1 to nie tylko kolejne quick winy — to standardy, zarządzanie zmianą i governance botów, które zamieniają serię wdrożeń w skalowalny program.',
        en: 'Wave 1 is not just more quick wins — it is standards, change management and bot governance that turn a series of deployments into a scalable program.',
      },
    },
  ],
};
