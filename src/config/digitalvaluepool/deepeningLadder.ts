/**
 * Digital Value Pool — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * value-at-stake "depth staircase" per phase of the analysis:
 *
 *   1. surface          — which functions/processes exist, and where is money made/spent?
 *   2. evidence         — is the value at stake benchmarked/measured, or a slide-deck number?
 *   3. quantification   — how much cost/revenue is realistically "in play" per function?
 *   4. risk-capability  — what data/owner/mandate must exist to actually capture it (not just pilot)?
 *
 * The four canonical PHASES mirror the disciplined digital-value-pool order
 * (McKinsey value-at-stake / BCG digital value gap):
 *   - decompose  : break the org into functions/processes (10-20 nodes) before sizing anything
 *   - size       : estimate value-at-stake per node = benchmark % × cost/revenue base (top-down + bottom-up)
 *   - prioritize : score each use-case on impact × feasibility, expose the 80/20 concentration
 *   - sequence   : quick wins first, data foundations in parallel, big bets as multi-year, no-go rejected
 *
 * Doctrine SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/digital-value-pool.md
 * Content is partner-grade, bilingual (PL/EN), consumed by the tool's input
 * sections and by the synthesis engine (valuePoolEngine.ts).
 */

export type ValuePoolPhaseId = 'decompose' | 'size' | 'prioritize' | 'sequence';

export const VALUE_POOL_PHASES: ValuePoolPhaseId[] = [
  'decompose',
  'size',
  'prioritize',
  'sequence',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and phase-agnostic. */
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

export const VALUE_POOL_LADDER_RUNG_ORDER = RUNG_ORDER;

const VALUE_POOL_PHASE_LABEL: Record<ValuePoolPhaseId, Bilingual> = {
  decompose: { pl: 'Dekompozycja', en: 'Decompose' },
  size: { pl: 'Skwantyfikuj', en: 'Size' },
  prioritize: { pl: 'Priorytetyzuj', en: 'Prioritize' },
  sequence: { pl: 'Sekwencjonuj', en: 'Sequence' },
};

export const valuePoolPhaseLabel = (phase: ValuePoolPhaseId): Bilingual =>
  VALUE_POOL_PHASE_LABEL[phase];

/**
 * Per-phase deepening ladder. Each phase has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const VALUE_POOL_DEEPENING_LADDER: Record<ValuePoolPhaseId, LadderRung[]> = {
  decompose: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na jakie funkcje i procesy dzieli się organizacja — czy analizujecie „AI w firmie" jako całość, czy macie rozpisane 10-20 węzłów łańcucha wartości (sprzedaż, operacje, obsługa, finanse, HR, IT, wiedza)?',
        en: 'Into which functions and processes does the organization break down — are you analyzing "AI in the company" as a whole, or do you have 10-20 value-chain nodes mapped (sales, operations, service, finance, HR, IT, knowledge)?',
      },
      rationale: {
        pl: 'Analiza „gdzie wdrożyć AI" na poziomie całej firmy jest zbyt ogólna, żeby cokolwiek z niej wynikło — pula wartości ujawnia się dopiero po rozbiciu na funkcje, bo to funkcja, nie firma, ma bazę kosztową i przychodową.',
        en: 'Analyzing "where to deploy AI" at whole-company level is too coarse for anything to follow — the value pool only surfaces once you break down to functions, because it is the function, not the company, that carries a cost and revenue base.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że dana funkcja jest kandydatem — z realnej bazy kosztowej/przychodowej i zgłoszonego bólu właściciela procesu, czy z tego, że „wszyscy robią tam AI"?',
        en: 'How do you know a function is a candidate — from a real cost/revenue base and a process owner reporting pain, or because "everyone is doing AI there"?',
      },
      rationale: {
        pl: 'Funkcja obecna w każdej prezentacji konkurencji to sygnał hype, nie puli — realna pula ma dużą bazę, ustrukturyzowany cyfrowy proces i właściciela, który zgłasza ból SAM, bez podpowiedzi z zewnątrz.',
        en: 'A function present in every competitor deck is a hype signal, not a pool — a real pool has a large base, a structured digital process, and an owner who reports the pain UNPROMPTED.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile funkcji faktycznie ma bazę powyżej progu istotności — czy potraficie odsiać węzły <0,5 mln PLN „w grze", żeby nie rozmyć analizy na 20 pól, z których 15 to szum?',
        en: 'How many functions actually clear the materiality threshold — can you filter out nodes with <0.5M in play, so the analysis is not diluted across 20 fields of which 15 are noise?',
      },
      rationale: {
        pl: 'Dekompozycja bez progu istotności produkuje listę życzeń — dopóki nie odetniecie funkcji marginalnych, ranking miesza duże pule z peryferyjnymi quick-fixami.',
        en: 'Decomposition without a materiality threshold produces a wish list — until you cut the marginal functions, the ranking mixes large pools with peripheral quick-fixes.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Której funkcji nikt w warsztacie nie wymienił, choć benchmark branżowy pokazuje tam pulę (np. pricing = 3-5% marży w grze) — macie mechanizm łapania „martwych pól"?',
        en: 'Which function did nobody name in the workshop, though the industry benchmark shows a pool there (e.g. pricing = 3-5% of margin in play) — do you have a mechanism to catch these "dead fields"?',
      },
      rationale: {
        pl: 'Brakująca pula to najczęściej najcenniejszy insight — funkcja, o której nikt nie mówi „bo zawsze tak było", to zwykle tam, gdzie leży niewykorzystana wartość, bo nikt jej nie zakwestionował.',
        en: 'A missing pool is most often the most valuable insight — a function nobody mentions "because it has always been this way" is usually where the untapped value sits, because nobody challenged it.',
      },
    },
  ],
  size: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy dla każdej funkcji macie bazę (koszt FTE/procesowy albo przychód per segment/kanał), na której w ogóle da się oprzeć szacunek value-at-stake?',
        en: 'For each function, do you have a base (FTE/process cost, or revenue per segment/channel) on which a value-at-stake estimate can even rest?',
      },
      rationale: {
        pl: 'Value-at-stake to benchmark × baza — bez policzonej bazy kosztowej/przychodowej „duża pula" jest odczuciem, a nie liczbą, którą można postawić przed CFO.',
        en: 'Value-at-stake is benchmark × base — without a counted cost/revenue base, "a big pool" is a feeling, not a number you can put in front of a CFO.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Szacujecie pulę top-down (benchmark branżowy × baza) czy bottom-up (suma skwantyfikowanych use-case\'ów z liniami biznesowymi) — i czy porównaliście oba?',
        en: 'Are you sizing the pool top-down (industry benchmark × base) or bottom-up (sum of use-cases quantified with the business lines) — and have you compared the two?',
      },
      rationale: {
        pl: 'Top-down daje szybki pułap i ranking, ale łatwo zawyża; bottom-up jest defensowalny wobec CFO, ale wolniejszy — dopiero rozbieżność między nimi jest sygnałem (niewidoczne use-case\'y albo zły benchmark).',
        en: 'Top-down gives a fast ceiling and ranking but easily overstates; bottom-up is defensible to the CFO but slower — it is the divergence between them that carries the signal (invisible use-cases, or a wrong benchmark).',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile realnie procent bazy jest „w grze" per funkcja i jaki jest capture rate — bo value-at-stake (pułap teoretyczny) to nie to samo co value captured w waszym horyzoncie?',
        en: 'What percentage of the base is realistically "in play" per function, and what is the capture rate — because value-at-stake (a theoretical ceiling) is not value captured within your horizon?',
      },
      rationale: {
        pl: 'Mylenie puli w grze z wartością przechwyconą tworzy business case, który nie broni się w roku 2 — capture rate maleje z czasem, jeśli się nie działa, bo konkurencja lub komodytyzacja zjada pulę.',
        en: 'Confusing the pool in play with value captured builds a business case that collapses in year 2 — the capture rate decays over time if you do nothing, as competitors or commoditization eat the pool.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy szacunek jest odporny na to, że część puli już skonsumowali early movers albo że produkt się komodytyzuje i marża spada — czy liczycie pulę statycznie?',
        en: 'Is the estimate robust to the pool already being partly consumed by early movers, or the product commoditizing so margin drops — or are you sizing the pool statically?',
      },
      rationale: {
        pl: 'Pula wartości nie jest statyczna — statyczny szacunek zawyża, bo nie uwzględnia, że im dłużej zwlekacie, tym więcej z niej znika (przechwycona przez rynek lub skurczona przez spadek marży).',
        en: 'The value pool is not static — a static estimate overstates, because it ignores that the longer you wait the more of it disappears (captured by the market or shrunk by falling margin).',
      },
    },
  ],
  prioritize: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy każdy use-case ma ocenę na DWÓCH osiach — impact (wielkość, szybkość, strategiczność) i feasibility — czy rankujecie tylko po wielkości puli?',
        en: 'Does each use-case have a score on TWO axes — impact (size, speed, strategic value) and feasibility — or are you ranking by pool size alone?',
      },
      rationale: {
        pl: 'Ranking tylko po wielkości puli prowadzi prosto do „pilotów bez skali" — największa pula z niską feasibility spala budżet, zanim cokolwiek trafi do P&L.',
        en: 'Ranking by pool size alone leads straight to "pilots without scale" — the biggest pool with low feasibility burns budget before anything reaches the P&L.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy feasibility oceniacie szeroko — dane (kompletne, dostępne, jakość), zmiana procesu, zmiana ludzka, koszt/czas, ryzyko regulacyjne — czy sprowadzacie ją do „czy technologia istnieje"?',
        en: 'Do you assess feasibility broadly — data (complete, available, quality), process change, human change, cost/time, regulatory risk — or reduce it to "does the technology exist"?',
      },
      rationale: {
        pl: 'Najczęstszy błąd: feasibility = „czy technologia istnieje" (prawie zawsze tak), z pominięciem danych, przeprojektowania workflow i tego, czy właściciel procesu chce, czy sabotuje — a to tam umierają wdrożenia.',
        en: 'The most common error: feasibility = "does the technology exist" (almost always yes), skipping data, workflow redesign, and whether the process owner wants it or sabotages it — which is where deployments die.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaka część zmapowanej wartości koncentruje się w 2-3 funkcjach (Pareto) i czy budżet inicjatyw jest rozłożony odwrotnie do tej koncentracji?',
        en: 'What share of the mapped value concentrates in 2-3 functions (Pareto), and is the initiative budget allocated inversely to that concentration?',
      },
      rationale: {
        pl: 'Sedno narzędzia to zdanie „80% wartości leży w 2 z 12 funkcji, a reszta portfela pochłania >50% budżetu" — bez policzenia koncentracji nie ma podstawy do realokacji.',
        en: 'The heart of the tool is the sentence "80% of value sits in 2 of 12 functions, while the rest of the portfolio consumes >50% of budget" — without computing the concentration there is no basis for reallocation.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Dla use-case\'ów o wysokim impakcie i wysokiej feasibility TECHNICZNEJ — czy jest właściciel procesu z budżetem i mandatem, ścieżka do >1 zespołu i metryka BIZNESOWA (nie adopcyjna)?',
        en: 'For high-impact, high-TECHNICAL-feasibility use-cases — is there a process owner with budget and mandate, a path to >1 team, and a BUSINESS metric (not an adoption one)?',
      },
      rationale: {
        pl: 'Feasibility techniczna wysoka to za mało: <10% use-case\'ów AI przechodzi z pilotażu do skali, ~70% programów failuje przez opór, nie technologię — trzeba osobno ocenić „feasibility skalowania".',
        en: 'High technical feasibility is not enough: <10% of AI use-cases go from pilot to scale, ~70% of change programs fail on resistance, not technology — you must separately assess "feasibility to scale".',
      },
    },
  ],
  sequence: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy roadmapa rozdziela quick wins (wysoki impact + wysoka feasibility) od dużych obstawień strategicznych (wysoki impact, niska feasibility), czy wszystko rusza naraz?',
        en: 'Does the roadmap separate quick wins (high impact + high feasibility) from big strategic bets (high impact, low feasibility), or does everything start at once?',
      },
      rationale: {
        pl: 'Sekwencjonowanie to esencja roadmapy: quick wins finansują wiarygodność, fundamenty danych idą równolegle, duże obstawienia to program wieloletni — jeden front naraz gubi standard i cofa efekt.',
        en: 'Sequencing is the essence of the roadmap: quick wins fund credibility, data foundations run in parallel, big bets are a multi-year program — one front at a time loses the standard and reverts the effect.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy zależności są jawne — które pule wymagają najpierw fundamentu danych (higiena CRM, strukturyzacja dokumentów), a które da się wziąć od razu?',
        en: 'Are the dependencies explicit — which pools require a data foundation first (CRM hygiene, document structuring), and which can be taken immediately?',
      },
      rationale: {
        pl: 'Sekwencja ignorująca zależności danych buduje na piasku — use-case o wysokim impakcie blokowany jakością danych trzeba jawnie odłożyć do czasu fundamentu, nie wpychać na początek.',
        en: 'A sequence that ignores data dependencies builds on sand — a high-impact use-case blocked by data quality must be explicitly deferred until the foundation, not forced to the front.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak dzielicie budżet transformacji między fale — ile % w quick win z gotowymi danymi, ile w fundament danych, ile w pilotaż z wymogiem właściciela przed skalą?',
        en: 'How do you split the transformation budget across waves — what % into the quick win with ready data, into the data foundation, into a pilot gated on an owner before scale?',
      },
      rationale: {
        pl: 'Alokacja budżetu to wynik całej analizy — np. „70% w quick win z gotowymi danymi, 20% w higienę danych jako fundament, 10% w pilotaż z jawnym wymogiem właściciela przed skalowaniem".',
        en: 'Budget allocation is the output of the whole analysis — e.g. "70% into the quick win with ready data, 20% into data hygiene as a foundation, 10% into a pilot with an explicit owner requirement before scaling".',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy pule „no-go" (niski impact niezależnie od feasibility) są odrzucone JAWNIE i udokumentowane, żeby nie wracały co kwartał, gdy pojawi się nowy szum medialny?',
        en: 'Are the "no-go" pools (low impact regardless of feasibility) rejected EXPLICITLY and documented, so they do not return every quarter when a new hype cycle appears?',
      },
      rationale: {
        pl: 'Bez jawnego odrzucenia no-go peryferyjne quick-fixy wracają, bo są „widoczne", i kradną uwagę zarządu prawdziwej puli — decyzja o NIE-inwestowaniu jest równie ważna jak o inwestowaniu.',
        en: 'Without an explicit no-go rejection, peripheral quick-fixes return because they are "visible" and steal management attention from the real pool — the decision NOT to invest is as important as the decision to invest.',
      },
    },
  ],
};

export interface UseCaseProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per phase. Consumed when AI (or the offline
 * fallback) proposes candidate value-pool moves. Mirrors Inventory's
 * PROPOSAL_BANK.
 */
export const VALUE_POOL_PROPOSAL_BANK: Record<ValuePoolPhaseId, UseCaseProposal[]> = {
  decompose: [
    {
      rung: 'surface',
      title: {
        pl: 'Rozbić organizację na 10-20 funkcji łańcucha wartości',
        en: 'Break the org into 10-20 value-chain functions',
      },
      explanation: {
        pl: 'Zmapujcie funkcje (sprzedaż, marketing, dostawa, obsługa, finanse, HR, IT, wiedza) jako osobne węzły — nie analizujcie „AI w firmie" jako całości, bo to zbyt ogólne, by cokolwiek wynikło.',
        en: 'Map the functions (sales, marketing, delivery, service, finance, HR, IT, knowledge) as separate nodes — do not analyze "AI in the company" as a whole, it is too coarse for anything to follow.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oprzeć wybór funkcji na bazie i bólu właściciela, nie na hype',
        en: 'Base function selection on the base and owner pain, not hype',
      },
      explanation: {
        pl: 'Kwalifikujcie funkcję, gdy ma dużą bazę kosztową/przychodową, cyfrowy ustrukturyzowany proces i właściciela zgłaszającego ból SAM — a nie dlatego, że „wszyscy tam robią AI".',
        en: 'Qualify a function when it has a large cost/revenue base, a structured digital process, and an owner reporting pain UNPROMPTED — not because "everyone is doing AI there".',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Odciąć funkcje poniżej progu istotności',
        en: 'Cut functions below the materiality threshold',
      },
      explanation: {
        pl: 'Ustalcie próg (np. 0,5 mln PLN „w grze") i odsiejcie węzły marginalne — inaczej ranking rozmywa się na 20 pól, z których większość to szum niewart uwagi zarządu.',
        en: 'Set a threshold (e.g. 0.5M in play) and filter out marginal nodes — otherwise the ranking dilutes across 20 fields, most of them noise not worth management attention.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Aktywnie szukać „martwych pól" wg benchmarku branżowego',
        en: 'Actively hunt "dead fields" against the industry benchmark',
      },
      explanation: {
        pl: 'Nałóżcie benchmark branżowy na listę funkcji i wskażcie te, których nikt nie wymienił, choć benchmark widzi tam pulę (np. pricing) — brakująca pula to często najcenniejszy insight.',
        en: 'Overlay the industry benchmark on the function list and flag those nobody mentioned though the benchmark sees a pool there (e.g. pricing) — a missing pool is often the most valuable insight.',
      },
    },
  ],
  size: [
    {
      rung: 'surface',
      title: {
        pl: 'Zebrać bazę kosztową/przychodową per funkcja',
        en: 'Collect the cost/revenue base per function',
      },
      explanation: {
        pl: 'Dla każdej funkcji zbierzcie koszt (FTE, procesowy, błędów/rework) lub przychód (per segment/kanał) — bez bazy value-at-stake nie ma na czym stanąć.',
        en: 'For each function gather cost (FTE, process, error/rework) or revenue (per segment/channel) — without a base there is nothing for value-at-stake to stand on.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Policzyć pulę top-down I bottom-up, i porównać rozbieżność',
        en: 'Size the pool top-down AND bottom-up, and compare the gap',
      },
      explanation: {
        pl: 'Zestawcie benchmark × baza (top-down) z sumą skwantyfikowanych use-case\'ów (bottom-up) — duża rozbieżność sama jest insightem: niewidoczne use-case\'y albo benchmark nie pasujący do modelu firmy.',
        en: 'Put benchmark × base (top-down) against the sum of quantified use-cases (bottom-up) — a large gap is itself the insight: invisible use-cases, or a benchmark that does not fit the firm\'s model.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Odróżnić value-at-stake od value captured (capture rate)',
        en: 'Separate value-at-stake from value captured (capture rate)',
      },
      explanation: {
        pl: 'Zastosujcie capture rate do pułapu teoretycznego per horyzont — pokazujcie zarządowi ile realnie da się wziąć, nie ile teoretycznie „jest w grze", inaczej business case pada w roku 2.',
        en: 'Apply a capture rate to the theoretical ceiling per horizon — show the board what is realistically capturable, not what is theoretically "in play", or the business case collapses in year 2.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uodpornić szacunek na erozję puli w czasie',
        en: 'Make the estimate robust to pool erosion over time',
      },
      explanation: {
        pl: 'Uwzględnijcie, że pula maleje (early movers, komodytyzacja marży) — szacunek statyczny zawyża, więc dołóżcie ścieżkę czasową i koszt zwłoki.',
        en: 'Account for the pool shrinking (early movers, margin commoditization) — a static estimate overstates, so add a time path and the cost of delay.',
      },
    },
  ],
  prioritize: [
    {
      rung: 'surface',
      title: {
        pl: 'Umieścić każdy use-case na macierzy impact × feasibility',
        en: 'Place each use-case on an impact × feasibility matrix',
      },
      explanation: {
        pl: 'Oceńcie każdy use-case na dwóch osiach — impact (wielkość, szybkość, strategiczność) i feasibility — zamiast rankować po samej wielkości puli, co prowadzi wprost do pilotów bez skali.',
        en: 'Score each use-case on two axes — impact (size, speed, strategic value) and feasibility — instead of ranking by pool size alone, which leads straight to pilots without scale.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oceniać feasibility szeroko: dane, proces, ludzie, regulacje',
        en: 'Assess feasibility broadly: data, process, people, regulation',
      },
      explanation: {
        pl: 'Rozbijcie feasibility na jakość/dostępność danych, przeprojektowanie procesu, zmianę ludzką, koszt/czas i ryzyko regulacyjne — „technologia istnieje" to prawie zawsze prawda i prawie nic nie znaczy.',
        en: 'Break feasibility into data quality/availability, process redesign, human change, cost/time and regulatory risk — "the technology exists" is almost always true and means almost nothing.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć koncentrację wartości 80/20 i zestawić z budżetem',
        en: 'Compute the 80/20 value concentration and map it to budget',
      },
      explanation: {
        pl: 'Wyliczcie, ile % puli leży w 2-3 funkcjach, i nałóżcie na to rozkład budżetu inicjatyw — rozjazd (budżet odwrotny do puli) jest bezpośrednim wnioskiem o realokacji.',
        en: 'Compute what % of the pool sits in 2-3 functions and overlay the initiative-budget split — a mismatch (budget inverse to pool) is a direct reallocation conclusion.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Oddzielnie ocenić feasibility SKALOWANIA (właściciel, mandat, metryka)',
        en: 'Separately assess feasibility TO SCALE (owner, mandate, metric)',
      },
      explanation: {
        pl: 'Dla use-case\'ów o wysokim impakcie sprawdźcie właściciela z budżetem i mandatem, ścieżkę do >1 zespołu i metrykę biznesową — bez tego to kandydat na „pilot, który nigdy nie przejdzie do skali".',
        en: 'For high-impact use-cases verify an owner with budget and mandate, a path to >1 team, and a business metric — without these it is a candidate for "a pilot that never reaches scale".',
      },
    },
  ],
  sequence: [
    {
      rung: 'surface',
      title: {
        pl: 'Ułożyć roadmapę: quick wins → fundamenty → duże obstawienia → no-go',
        en: 'Lay out the roadmap: quick wins → foundations → big bets → no-go',
      },
      explanation: {
        pl: 'Posekwencjonujcie: quick wins (wysoki impact, wysoka feasibility) najpierw, fundamenty danych równolegle, duże obstawienia jako program wieloletni, no-go odrzucone jawnie — nie otwierajcie wszystkich frontów naraz.',
        en: 'Sequence it: quick wins (high impact, high feasibility) first, data foundations in parallel, big bets as a multi-year program, no-go rejected explicitly — do not open every front at once.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Jawnie odłożyć pule zablokowane jakością danych',
        en: 'Explicitly defer pools blocked by data quality',
      },
      explanation: {
        pl: 'Use-case o wysokim impakcie, którego feasibility blokuje jakość danych (np. brak ustandaryzowanego CRM), odłóżcie do czasu fundamentu danych — nie budujcie na piasku.',
        en: 'A high-impact use-case whose feasibility is blocked by data quality (e.g. no standardized CRM) — defer it until the data foundation, do not build on sand.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Rozpisać alokację budżetu transformacji między fale',
        en: 'Write out the transformation-budget allocation across waves',
      },
      explanation: {
        pl: 'Przełóżcie priorytety na % budżetu (np. 70% quick win z gotowymi danymi, 20% fundament danych, 10% pilotaż z wymogiem właściciela) — konkretna alokacja jest produktem końcowym analizy.',
        en: 'Translate priorities into % of budget (e.g. 70% quick win with ready data, 20% data foundation, 10% pilot gated on an owner) — a concrete allocation is the final product of the analysis.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Udokumentować odrzucone no-go, żeby nie wracały co kwartał',
        en: 'Document the rejected no-go so they do not return quarterly',
      },
      explanation: {
        pl: 'Zapiszcie jawnie pule odrzucone (niski impact niezależnie od feasibility) z uzasadnieniem — inaczej peryferyjne, „widoczne" quick-fixy wracają co kwartał i kradną uwagę prawdziwej puli.',
        en: 'Record the rejected pools explicitly (low impact regardless of feasibility) with rationale — otherwise peripheral, "visible" quick-fixes return each quarter and steal attention from the real pool.',
      },
    },
  ],
};
