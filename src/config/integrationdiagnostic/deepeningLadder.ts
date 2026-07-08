/**
 * Integration Diagnostic — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * integration-diagnostic "depth staircase" per lever:
 *
 *   1. surface          — what is the current wiring / behaviour in this lever?
 *   2. evidence         — is it mapped/measured, or assumed ("we have integration X")?
 *   3. quantification   — how much cash / risk / delay does it cost, at what scale?
 *   4. risk-capability  — what capability / governance must exist to change it safely?
 *
 * The four canonical levers mirror the disciplined integration-diagnostic order
 * of the doctrine (_TOOLS_DOKTRYNA/integration-diagnostic.md §4):
 *   - inventory   : map the systems and every integration (direction/type/frequency/owner)
 *   - topology    : point-to-point vs hub — n(n-1)/2 spaghetti, SPOF hub, maturity level
 *   - bridges     : quantify manual re-keying (FTE-hours + 1-10-100 error cost)
 *   - apiled      : System→Process→Experience API sequencing, reuse discipline, governance
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (integrationEngine.ts).
 */

export type IntegrationLeverId = 'inventory' | 'topology' | 'bridges' | 'apiled';

export const INTEGRATION_LEVERS: IntegrationLeverId[] = [
  'inventory',
  'topology',
  'bridges',
  'apiled',
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

export const INTEGRATION_LADDER_RUNG_ORDER = RUNG_ORDER;

const INTEGRATION_LEVER_LABEL: Record<IntegrationLeverId, Bilingual> = {
  inventory: { pl: 'Inwentarz integracji', en: 'Integration inventory' },
  topology: { pl: 'Topologia', en: 'Topology' },
  bridges: { pl: 'Ręczne mostki', en: 'Manual bridges' },
  apiled: { pl: 'API-first', en: 'API-first' },
};

export const integrationLeverLabel = (lever: IntegrationLeverId): Bilingual =>
  INTEGRATION_LEVER_LABEL[lever];

/**
 * Per-lever deepening ladder. Each lever has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const INTEGRATION_DEEPENING_LADDER: Record<IntegrationLeverId, LadderRung[]> = {
  inventory: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy istnieje kompletna mapa systemów i połączeń — czy wiecie, ile faktycznie macie integracji i którędy przepływają dane, czy tylko „mamy integrację X" zaznaczone w Excelu?',
        en: 'Is there a complete map of systems and connections — do you know how many integrations you actually have and how data flows, or just "we have integration X" ticked in a spreadsheet?',
      },
      rationale: {
        pl: 'Bez inwentarza reszta diagnozy jest zgadywaniem — spis zwykle ujawnia więcej integracji „nieoficjalnych" (skrypt na czyimś laptopie, makro w Excelu), niż formalnie znanych IT.',
        en: 'Without an inventory the rest of the diagnosis is guesswork — the census usually reveals more "unofficial" integrations (a script on someone\'s laptop, an Excel macro) than IT formally knows about.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, jak działa dana integracja — z udokumentowanego przepływu z właścicielem utrzymania, czy z pamięci jednej osoby, która „to kiedyś zrobiła"?',
        en: 'How do you know how a given integration works — from a documented flow with a maintenance owner, or from the memory of one person who "built it once"?',
      },
      rationale: {
        pl: 'Ręczne mostki i integracje nieoficjalne żyją w wiedzy operacyjnej działów, nie w dokumentacji IT — inwentarz zrobiony wyłącznie z perspektywy IT systematycznie pomija najdroższe silosy.',
        en: 'Manual bridges and unofficial integrations live in the operational knowledge of departments, not in IT documentation — an inventory built from IT\'s view alone systematically misses the most expensive silos.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile z zmapowanych systemów jest realnie zintegrowanych (a nie „połączonych" ręcznym eksportem) — jaki to procent i jak wypada wobec benchmarku branżowego (~27-29% wg MuleSoft)?',
        en: 'How many of the mapped systems are really integrated (not "connected" by a manual export) — what share is that, and how does it compare to the industry benchmark (~27-29% per MuleSoft)?',
      },
      rationale: {
        pl: 'Procent realnie zintegrowanych systemów nadaje kontekst: nawet dojrzałe firmy żyją z większością systemów niezintegrowanych — pytanie nie brzmi „zintegrować wszystko", tylko które 10-15% niesie 80% wartości.',
        en: 'The share of really-integrated systems adds context: even mature firms run with most systems unintegrated — the question is not "integrate everything" but which 10-15% carries 80% of the value.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy inwentarz jest żywy (odświeżany, z właścicielem), czy zrobiony raz i zamrożony — kto go utrzymuje, gdy dojdzie kolejny system SaaS kupiony przez dział bez wiedzy IT?',
        en: 'Is the inventory live (refreshed, with an owner), or built once and frozen — who keeps it current when the next SaaS tool is bought by a department without IT\'s knowledge?',
      },
      rationale: {
        pl: 'Mapa integracji starzeje się z każdym nowym systemem — bez właściciela i procesu odświeżania staje się kolejnym martwym raportem, a spaghetti rośnie niewidzialnie.',
        en: 'An integration map decays with every new system — without an owner and a refresh process it becomes another dead report while the spaghetti grows invisibly.',
      },
    },
  ],
  topology: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy systemy łączą się każdy-z-każdym (point-to-point), czy przez wspólną warstwę (hub/ESB/iPaaS) — i czy jest jeden system, który de facto jest hubem dla wielu integracji?',
        en: 'Do systems connect each-to-each (point-to-point), or through a shared layer (hub/ESB/iPaaS) — and is there one system that is de facto a hub for many integrations?',
      },
      rationale: {
        pl: 'To dwa skrajne wzorce: point-to-point rośnie kwadratowo (n(n-1)/2), hub liniowo (n) — rozpoznanie, w którym jesteście, determinuje całą roadmapę integracyjną.',
        en: 'These are the two extreme patterns: point-to-point grows quadratically (n(n-1)/2), a hub linearly (n) — recognizing which you are in determines the entire integration roadmap.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile z połączeń to bezpośrednie point-to-point, a ile przechodzi przez wspólną warstwę — i na jakim poziomie dojrzałości integracji jesteście wg Gartnera (1 ad hoc … 5 augmented)?',
        en: 'How many connections are direct point-to-point versus routed through a shared layer — and what Gartner integration-maturity level are you at (1 ad hoc … 5 augmented)?',
      },
      rationale: {
        pl: 'Większość firm spoza tech ląduje na poziomie 1-2 (ad hoc / oświecona) — twardy udział point-to-point, nie deklaracja „mamy platformę", pokazuje realny stan.',
        en: 'Most non-tech firms land at level 1-2 (ad hoc / enlightened) — the hard share of point-to-point links, not a "we have a platform" claim, shows the real state.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile połączeń urośnie przy planowanych nowych systemach, jeśli zostaniecie przy point-to-point (n(n-1)/2), i ile spadłoby przy przejściu na hub (n)?',
        en: 'How many connections will grow with the planned new systems if you stay point-to-point (n(n-1)/2), and how many would you have with a hub (n)?',
      },
      rationale: {
        pl: 'Rozjazd kwadratowy vs liniowy jest niewidoczny rok do roku, ale eksploduje przy którymś kolejnym systemie — policzenie różnicy przekłada abstrakcję na koszt utrzymania.',
        en: 'The quadratic-vs-linear divergence is invisible year to year but explodes at some next system — quantifying the gap turns the abstraction into a maintenance cost.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy system-hub, przez który przechodzi najwięcej integracji, ma formalnego właściciela, redundancję i warstwę izolującą — czy jego padnięcie zatrzymuje kilka procesów naraz (SPOF)?',
        en: 'Does the hub system that most integrations pass through have a formal owner, redundancy and an isolating layer — or does its failure halt several processes at once (SPOF)?',
      },
      rationale: {
        pl: 'Pojedynczy punkt awarii bez właściciela to cichy najwyższy priorytet, nawet jeśli nigdy nie zawiódł — brak historii awarii nie oznacza braku ryzyka (analogia do bus factor).',
        en: 'A single point of failure without an owner is the silent top priority even if it never failed — no failure history does not mean no risk (analogous to bus factor).',
      },
    },
  ],
  bridges: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Gdzie człowiek regularnie przenosi dane między systemami ręcznie — eksport-import, kopiuj-wklej, podwójne wpisywanie — i czy w ogóle macie listę tych ręcznych mostków?',
        en: 'Where does a human regularly move data between systems by hand — export-import, copy-paste, double keying — and do you even have a list of these manual bridges?',
      },
      rationale: {
        pl: 'Ręczne przepisywanie danych to dowód, nie hipoteza, że integracja powinna istnieć i nie istnieje — im wyższa częstotliwość i liczba osób, tym pilniejszy sygnał.',
        en: 'Manual re-keying is proof, not a hypothesis, that an integration should exist and does not — the higher the frequency and the more people involved, the more urgent the signal.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile osób × ile godzin miesięcznie kosztuje każdy ręczny mostek i jaka jest szacowana stopa błędu — pytaliście ludzi, którzy klikają „eksportuj", czy tylko dział IT?',
        en: 'How many people × how many hours per month does each manual bridge cost, and what is the estimated error rate — did you ask the people who click "export", or only IT?',
      },
      rationale: {
        pl: 'Ręczne mostki rzadko są widoczne w dokumentacji IT — żyją w wiedzy działów; diagnoza bez ludzi, którzy klikają „eksportuj", pomija najdroższe silosy.',
        en: 'Manual bridges are rarely visible in IT documentation — they live in departmental knowledge; a diagnosis without the people who click "export" misses the most expensive silos.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile łącznie FTE-godzin rocznie pochłaniają ręczne mostki i ile kosztują błędy wg reguły 1-10-100 (u źródła ~1, korekta po fakcie ~10, skutek u klienta/w raporcie zarządczym ~100)?',
        en: 'How many total FTE-hours per year do manual bridges consume, and what do errors cost under the 1-10-100 rule (~1 at source, ~10 to correct after the fact, ~100 when they reach a customer / management report)?',
      },
      rationale: {
        pl: 'Rekeying to nie tylko koszt pracy — to źródło błędów tanich u źródła i drogich w raporcie zarządczym; wysoka liczba mostków na krytycznym przepływie koreluje z ryzykiem błędów finansowych, nie tylko niewygodą.',
        en: 'Re-keying is not just labor cost — it is a source of errors cheap at source and expensive in a management report; many bridges on a critical flow correlate with financial-error risk, not just operational inconvenience.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy oba systemy po stronach mostka mają już API, którego wystarczy użyć, czy automatyzacja wymaga zbudowania warstwy System API od zera — który mostek daje największy zwrot przy najmniejszej złożoności?',
        en: 'Do both systems on the bridge already expose an API you can simply use, or does automation require building a System API from scratch — which bridge yields the highest return at the lowest complexity?',
      },
      rationale: {
        pl: 'Kolejność automatyzacji ustala się wg zwrotu i złożoności: najpierw mostki, gdzie oba systemy mają gotowe API (quick win), potem te wymagające budowy warstwy — inaczej program grzęźnie na najtrudniejszym.',
        en: 'The automation order is set by return and complexity: first bridges where both systems already have an API (quick win), then those needing a new layer — otherwise the program bogs down on the hardest one.',
      },
    },
  ],
  apiled: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy nowy system podłącza się dziś przez otwarte, udokumentowane API, czy każdy kolejny konsument buduje integrację od zera — istnieje jakikolwiek katalog/rejestr API?',
        en: 'Does a new system connect today through an open, documented API, or does each new consumer build an integration from scratch — is there any API catalog / registry at all?',
      },
      rationale: {
        pl: 'System wdrożony bez API-first blokuje przyszłość, nie tylko teraźniejszość — staje się przyszłym kandydatem do point-to-point spaghetti, bo każdy konsument buduje od zera zamiast reużyć warstwy.',
        en: 'A system deployed without API-first blocks the future, not just the present — it becomes a future point-to-point-spaghetti candidate, because each consumer builds from scratch instead of reusing a layer.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile nowych integracji w ostatnim roku reużyło istniejące System/Process API, a ile zbudowano od zera — nawet mając API, czy zespoły wiedzą, co już istnieje do reużycia?',
        en: 'How many new integrations in the last year reused existing System/Process APIs, and how many were built from scratch — even with APIs, do teams know what already exists to reuse?',
      },
      rationale: {
        pl: 'Reużycie jest twardszym miernikiem dojrzałości niż sama liczba API — organizacja może mieć dużo API i wciąż każdy projekt buduje nowe (fasada API-led bez realnej dyscypliny reużycia).',
        en: 'Reuse is a harder maturity metric than the raw count of APIs — an organization can have many APIs and still have every project build new ones (an API-led facade without real reuse discipline).',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile trwa dziś podłączenie nowego systemu/kanału (tygodnie? pół roku?) i ile blokuje to time-to-market nowych produktów — jaki jest koszt zaniechania warstwy System/Process/Experience API?',
        en: 'How long does connecting a new system/channel take today (weeks? half a year?) and how much does it block time-to-market for new products — what is the cost of not having a System/Process/Experience API layer?',
      },
      rationale: {
        pl: 'Zaleta trójwarstwowego API-led: nowy kanał konsumuje istniejące Process API zamiast budować od zera, a zmiana w systemie źródłowym jest izolowana w warstwie System API i nie rozlewa się na resztę.',
        en: 'The advantage of three-layer API-led: a new channel consumes an existing Process API instead of building from scratch, and a change in the source system is isolated in the System API layer and does not spill onto the rest.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy istnieje właściciel strategii integracji (Integration Competency Center / platform team), standardy nazewnictwa i bezpieczeństwa API oraz proces zatwierdzania nowych integracji?',
        en: 'Is there an owner of the integration strategy (Integration Competency Center / platform team), API naming and security standards, and a process to approve new integrations?',
      },
      rationale: {
        pl: 'Skok do poziomu 3 (scentralizowany zespół + platforma) to zwykle pierwszy realny kamień milowy — governance warunkuje trwałość efektu; bez niej platforma i tak kończy nowym point-to-point wewnątrz siebie.',
        en: 'The jump to level 3 (a central team + a platform) is usually the first real milestone — governance underwrites the durability of the effect; without it the platform still ends up as new point-to-point inside itself.',
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
 * fallback) proposes candidate integration moves. Mirrors Inventory's
 * INVENTORY_PROPOSAL_BANK.
 */
export const INTEGRATION_PROPOSAL_BANK: Record<IntegrationLeverId, LeverProposal[]> = {
  inventory: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować wszystkie systemy i integracje (application landscape)',
        en: 'Map every system and integration (application landscape)',
      },
      explanation: {
        pl: 'Spiszcie pełną listę aktywnych systemów oraz dla każdej pary połączonej: kierunek, typ (API/plik/baza/ręcznie), częstotliwość i właściciela — bez tego reszta diagnozy jest zgadywaniem.',
        en: 'List every active system and, for each connected pair: direction, type (API/file/shared DB/manual), frequency and owner — without this the rest of the diagnosis is guesswork.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przepytać działy o integracje „nieoficjalne"',
        en: 'Survey departments for "unofficial" integrations',
      },
      explanation: {
        pl: 'Sprzedaż, magazyn i księgowość znają skrypty, makra i eksporty, których IT nie widzi — inwentarz z samej perspektywy IT pomija najdroższe silosy.',
        en: 'Sales, warehouse and finance know the scripts, macros and exports IT does not see — an inventory from IT\'s view alone misses the most expensive silos.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć procent realnie zintegrowanych systemów vs benchmark',
        en: 'Compute the share of really-integrated systems vs benchmark',
      },
      explanation: {
        pl: 'Zestawcie liczbę realnych integracji z liczbą systemów i porównajcie z benchmarkiem MuleSoft (~27-29%) — to przenosi rozmowę z „zintegrujmy wszystko" na „które 10-15% niesie 80% wartości".',
        en: 'Put the count of real integrations against the count of systems and compare to the MuleSoft benchmark (~27-29%) — it moves the conversation from "integrate everything" to "which 10-15% carries 80% of the value".',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustanowić właściciela żywego inwentarza integracji',
        en: 'Establish an owner for a live integration inventory',
      },
      explanation: {
        pl: 'Przypiszcie właściciela i cykl przeglądu mapy integracji — bez tego starzeje się z każdym nowym systemem SaaS kupionym przez dział, a spaghetti rośnie niewidzialnie.',
        en: 'Assign an owner and a review cycle for the integration map — without it, it ages with every new SaaS tool a department buys, and the spaghetti grows invisibly.',
      },
    },
  ],
  topology: [
    {
      rung: 'surface',
      title: {
        pl: 'Narysować graf topologii: systemy jako węzły, integracje jako krawędzie',
        en: 'Draw the topology graph: systems as nodes, integrations as edges',
      },
      explanation: {
        pl: 'Wizualizacja natychmiast pokazuje, czy jesteście w spaghetti point-to-point, czy w hub — i który system jest de facto hubem dla największej liczby połączeń.',
        en: 'The visualization immediately shows whether you are in point-to-point spaghetti or a hub — and which system is de facto the hub for the most connections.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ocenić poziom dojrzałości integracji wg Gartnera (1-5)',
        en: 'Score the Gartner integration-maturity level (1-5)',
      },
      explanation: {
        pl: 'Ustalcie, gdzie jesteście: ad hoc, oświecona, scentralizowana, API-first czy augmented — twardy udział point-to-point, nie deklaracja „mamy platformę", pokazuje realny stan.',
        en: 'Establish where you are: ad hoc, enlightened, centralized, API-first or augmented — the hard point-to-point share, not a "we have a platform" claim, shows the real state.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć wzrost połączeń point-to-point przy nowych systemach',
        en: 'Compute the point-to-point connection growth with new systems',
      },
      explanation: {
        pl: 'Zastosujcie n(n-1)/2 do planowanej liczby systemów i porównajcie z liniowym (n) dla huba — różnica pokazuje, ile kosztuje trwanie przy spaghetti.',
        en: 'Apply n(n-1)/2 to the planned system count and compare to the linear (n) hub case — the gap shows what staying in spaghetti costs.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zabezpieczyć system-hub: właściciel + warstwa izolująca (SPOF)',
        en: 'Harden the hub system: owner + isolating layer (SPOF)',
      },
      explanation: {
        pl: 'Nadajcie formalnego właściciela i warstwę System API systemowi, przez który przechodzi najwięcej integracji — bez tego jego padnięcie zatrzymuje kilka procesów naraz.',
        en: 'Give a formal owner and a System API layer to the system that most integrations pass through — without it, its failure halts several processes at once.',
      },
    },
  ],
  bridges: [
    {
      rung: 'surface',
      title: {
        pl: 'Zinwentaryzować ręczne mostki (eksport-import, kopiuj-wklej)',
        en: 'Inventory the manual bridges (export-import, copy-paste)',
      },
      explanation: {
        pl: 'Spiszcie każde miejsce, gdzie człowiek przenosi dane między systemami ręcznie — to lista brakujących integracji, nie „tak to zawsze robiliśmy".',
        en: 'List every place a human moves data between systems by hand — this is the list of missing integrations, not "that\'s how we\'ve always done it".',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć FTE-godziny i stopę błędu per mostek — pytając wykonawców',
        en: 'Measure FTE-hours and error rate per bridge — by asking the doers',
      },
      explanation: {
        pl: 'Ustalcie liczbę osób × godziny/miesiąc i szacowaną stopę błędu, pytając ludzi, którzy klikają „eksportuj" — nie IT, które tego mostka nie „obsługuje".',
        en: 'Establish people × hours/month and the estimated error rate by asking the people who click "export" — not IT, which does not "operate" this bridge.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Skwantyfikować koszt rekeyingu wg reguły 1-10-100',
        en: 'Quantify the re-keying cost under the 1-10-100 rule',
      },
      explanation: {
        pl: 'Policzcie FTE-koszt rocznie plus koszt błędów: zapobieżenie u źródła ~1, korekta po fakcie ~10, skutek u klienta/w raporcie zarządczym ~100 — to uzasadnia budowę integracji jako oszczędność, nie koszt.',
        en: 'Compute annual FTE cost plus error cost: prevention at source ~1, correction after the fact ~10, impact at the customer / in a management report ~100 — this justifies building the integration as a saving, not a cost.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uszeregować automatyzację mostków wg zwrotu i złożoności',
        en: 'Sequence bridge automation by return and complexity',
      },
      explanation: {
        pl: 'Zacznijcie od mostków, gdzie oba systemy mają gotowe API (quick win), potem od tych wymagających budowy System API — inaczej program grzęźnie na najtrudniejszym mostku.',
        en: 'Start with bridges where both systems already have APIs (quick win), then those needing a System API — otherwise the program bogs down on the hardest bridge.',
      },
    },
  ],
  apiled: [
    {
      rung: 'surface',
      title: {
        pl: 'Wprowadzić katalog/rejestr API jako punkt wejścia dla nowych integracji',
        en: 'Introduce an API catalog/registry as the entry point for new integrations',
      },
      explanation: {
        pl: 'Bez katalogu każdy nowy konsument buduje integrację od zera zamiast reużyć istniejącej — katalog jest warunkiem, żeby fasada API-led stała się realną dyscypliną.',
        en: 'Without a catalog every new consumer builds an integration from scratch instead of reusing one — the catalog is the precondition for the API-led facade to become real discipline.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć reużycie: ile nowych integracji konsumowało istniejące API',
        en: 'Measure reuse: how many new integrations consumed existing APIs',
      },
      explanation: {
        pl: 'Reużycie jest twardszym miernikiem dojrzałości niż liczba API — jeśli mimo gotowego System API zespoły budują od zera, brakuje katalogu i governance, nie API.',
        en: 'Reuse is a harder maturity metric than the count of APIs — if teams build from scratch despite a ready System API, what is missing is a catalog and governance, not APIs.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wprowadzić warstwę System→Process→Experience API na krytycznym przepływie',
        en: 'Introduce a System→Process→Experience API layer on a critical flow',
      },
      explanation: {
        pl: 'Zbudujcie trójwarstwową architekturę na jednym kluczowym przepływie: System API izoluje źródło, Process API łączy logikę, Experience API dopasowuje kanał — każda warstwa jest reużywalna.',
        en: 'Build the three-layer architecture on one key flow: System API isolates the source, Process API composes the logic, Experience API tailors the channel — each layer is reusable.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Powołać Integration Competency Center i standardy governance',
        en: 'Stand up an Integration Competency Center and governance standards',
      },
      explanation: {
        pl: 'Skok do poziomu 3 (centralny zespół + platforma + standardy nazewnictwa/bezpieczeństwa API + proces zatwierdzania) to pierwszy realny kamień milowy — bez niego platforma kończy nowym point-to-point wewnątrz siebie.',
        en: 'The jump to level 3 (a central team + platform + API naming/security standards + an approval process) is the first real milestone — without it the platform ends up as new point-to-point inside itself.',
      },
    },
  ],
};
