/**
 * Legacy Analyzer — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern. Encodes the legacy-portfolio "depth staircase" per assessment
 * dimension of the tool. The tool does NOT read code line by line — it scores
 * the whole application portfolio along the Gartner TIME axes (business value ×
 * technical health) plus the facts that qualify a TIME cell into a real
 * decision: cost (tech-debt share of IT budget), risk (support end, CVE,
 * bus factor) and cross-system dependencies (which node blocks sequencing).
 *
 * The six canonical dimensions mirror the disciplined portfolio-rationalization
 * order from the doctrine (§3 Inputy, §4 Metoda):
 *   - inventory      : the application inventory itself — owner, age, users (you cannot rank what you have not listed)
 *   - businessValue  : Y axis of TIME — criticality, reach, uniqueness, revenue link, strategy fit
 *   - techHealth     : X axis of TIME — stack currency, security, maintainability, skills, TCO/size
 *   - cost           : TCO and tech-debt as a share of the IT budget (run vs change)
 *   - risk           : support end, CVE, bus factor, compliance — the leading indicators
 *   - dependencies   : the integration graph that must precede any TIME decision (sequencing)
 *
 * Each rung follows the surface → evidence → quantification → risk-capability
 * staircase. Content is partner-grade and bilingual (PL/EN), consumed by the
 * tool's input sections and by the synthesis engine (legacyEngine.ts).
 */

export type LegacyDimensionId =
  | 'inventory'
  | 'businessValue'
  | 'techHealth'
  | 'cost'
  | 'risk'
  | 'dependencies';

export const LEGACY_DIMENSIONS: LegacyDimensionId[] = [
  'inventory',
  'businessValue',
  'techHealth',
  'cost',
  'risk',
  'dependencies',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and dimension-agnostic. */
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

export const LEGACY_LADDER_RUNG_ORDER = RUNG_ORDER;

const LEGACY_DIMENSION_LABEL: Record<LegacyDimensionId, Bilingual> = {
  inventory: { pl: 'Inwentarz aplikacji', en: 'Application inventory' },
  businessValue: { pl: 'Wartość biznesowa', en: 'Business value' },
  techHealth: { pl: 'Kondycja techniczna', en: 'Technical health' },
  cost: { pl: 'Koszt i dług', en: 'Cost & debt' },
  risk: { pl: 'Ryzyko', en: 'Risk' },
  dependencies: { pl: 'Zależności', en: 'Dependencies' },
};

export const legacyDimensionLabel = (dimension: LegacyDimensionId): Bilingual =>
  LEGACY_DIMENSION_LABEL[dimension];

/**
 * Per-dimension deepening ladder. Each dimension has exactly 4 rungs in
 * RUNG_ORDER, so the synthesis engine can rely on a stable shape.
 */
export const LEGACY_DEEPENING_LADDER: Record<LegacyDimensionId, LadderRung[]> = {
  inventory: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy istnieje jedna, kompletna lista systemów — każdy z właścicielem biznesowym, właścicielem technicznym, datą wdrożenia i liczbą użytkowników — czy portfel żyje w głowach ludzi?',
        en: 'Is there one complete list of systems — each with a business owner, a technical owner, a go-live date and a user count — or does the portfolio live in people\'s heads?',
      },
      rationale: {
        pl: 'Nie da się racjonalizować portfela, którego się nie widzi — inwentarz bez właściciela biznesowego zaniża wartość „nielubianych" systemów i przecenia nowe błyszczące narzędzia.',
        en: 'You cannot rationalize a portfolio you cannot see — an inventory without a business owner underrates "disliked" systems and overrates new shiny tools.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy ta lista jest zweryfikowana z realnym ruchem (logi, liczba logowań, transakcje), czy to deklaracja z pamięci działu IT?',
        en: 'Is the list verified against real usage (logs, login counts, transactions), or is it a from-memory declaration by IT?',
      },
      rationale: {
        pl: 'System, o którym „wszyscy wiedzą, że jest używany", często ma 12 aktywnych użytkowników — dowodem jest ruch, nie przekonanie.',
        en: 'A system "everyone knows is used" often has 12 active users — the evidence is traffic, not conviction.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Czy duże aplikacje (ERP, core, e-commerce) są rozbite na moduły z osobnym właścicielem i cyklem release, czy cały ERP to jedna kropka na macierzy?',
        en: 'Are large applications (ERP, core, e-commerce) broken into modules with a separate owner and release cycle, or is the whole ERP one dot on the matrix?',
      },
      rationale: {
        pl: 'Ocena na zbyt wysokim poziomie maskuje różnice: rdzeń finansowy ERP bywa INVEST, a moduł raportowy tego samego ERP — MIGRATE. „Cały ERP = jedna kropka" prowadzi do decyzji wszystko-albo-nic.',
        en: 'Assessing too coarsely masks the differences: an ERP finance core may be INVEST while its reporting module is MIGRATE. "Whole ERP = one dot" leads to all-or-nothing decisions.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy inwentarz jest żywym rejestrem odświeżanym w rytmie (rocznie/półrocznie), czy jednorazowym raportem, który zestarzeje się w kilka miesięcy?',
        en: 'Is the inventory a live register refreshed on a cadence (annual/semi-annual), or a one-off report that ages within months?',
      },
      rationale: {
        pl: 'Macierz TIME zrobiona raz i odłożona na półkę starzeje się szybko — kondycja techniczna degraduje się w czasie ciągłym, więc portfel wymaga rytmu, nie projektu.',
        en: 'A TIME matrix done once and shelved ages fast — technical health decays continuously, so the portfolio needs a rhythm, not a project.',
      },
    },
  ],
  businessValue: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co się stanie z biznesem, jeśli dany system padnie na dzień, na tydzień — kto poczuje to najpierw i jak głęboko?',
        en: 'What happens to the business if a given system is down for a day, for a week — who feels it first and how deeply?',
      },
      rationale: {
        pl: 'Wartość biznesowa to nie „jak bardzo IT lubi ten system", tylko krytyczność procesowa — pierwsze pytanie to koszt jego braku, nie jego wieku.',
        en: 'Business value is not "how much IT likes the system" but process criticality — the first question is the cost of its absence, not its age.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy wartość każdego systemu oceniał właściciel biznesowy, czy tylko zespół techniczny — bo ocena wyłącznie z IT systematycznie zaniża wartość „nielubianych" systemów?',
        en: 'Was each system\'s value judged by its business owner, or only by the tech team — because an IT-only judgment systematically underrates "disliked" systems?',
      },
      rationale: {
        pl: 'Kondycję techniczną łatwo ocenić z IT; wartość biznesową — nie. Bez drugiej strony przy osi Y macierz przekłamuje w stronę tego, co inżynierowie lubią utrzymywać.',
        en: 'Technical health is easy to judge from IT; business value is not. Without the other side on the Y axis, the matrix skews toward what engineers enjoy maintaining.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile przychodu lub redukcji kosztu przechodzi przez ten system, ilu użytkowników i ile procesów obsługuje — i czy funkcję da się kupić gotową?',
        en: 'How much revenue or cost-reduction flows through this system, how many users and processes does it serve — and can the function be bought off the shelf?',
      },
      rationale: {
        pl: 'Unikalność decyduje o strategii 6R: funkcja skomodytyzowana (HR, księgowość, CRM) to kandydat do Repurchase, nie do drogiego Refactoru. „Ile przychodu przez to przechodzi" oddziela przewagę od komodytu.',
        en: 'Uniqueness drives the 6R choice: a commoditized function (HR, accounting, CRM) is a Repurchase candidate, not an expensive Refactor. "How much revenue flows through it" separates advantage from commodity.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy wartość jest oceniana względem strategii na 2-3 lata (nowy rynek, fuzja, zmiana modelu), czy tylko względem dzisiejszego stanu?',
        en: 'Is value judged against the 2-3 year strategy (new market, merger, model change), or only against today\'s state?',
      },
      rationale: {
        pl: 'System krytyczny dzisiaj, ale niezgodny z kierunkiem firmy za 2 lata, ma inną wartość niż wynika z bieżącego ruchu — oś Y patrzy w przód, nie tylko wstecz.',
        en: 'A system critical today but off the company\'s 2-year direction has different value than current traffic implies — the Y axis looks forward, not only back.',
      },
    },
  ],
  techHealth: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Na jakim stosie stoi ten system, ile ma lat i czy jego wersje/framework mają jeszcze aktywne wsparcie dostawcy?',
        en: 'What stack does this system run on, how old is it, and do its versions/framework still have active vendor support?',
      },
      rationale: {
        pl: 'Aktualność stosu to pierwsze podkryterium osi X — framework po końcu życia (EOL) to nie ryzyko przyszłe, tylko obecne, nawet gdy „od lat nic się nie psuje".',
        en: 'Stack currency is the first X-axis sub-criterion — an end-of-life framework is not a future risk but a present one, even when "nothing has broken in years".',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy kondycja opiera się na twardych sygnałach (znane CVE, ostatni pentest, pokrycie testami, liczba incydentów/rok), czy na wrażeniu „działa, więc jest OK"?',
        en: 'Is health based on hard signals (known CVEs, last pentest, test coverage, incidents/year), or on the impression "it works, so it\'s fine"?',
      },
      rationale: {
        pl: 'Brak incydentu ≠ brak ryzyka. Niski koszt utrzymania czasem znaczy „nikt już nie patchuje" — zero patchowania = zero wydatku, ale rosnące ryzyko. Dowodem jest CVE i test, nie cisza.',
        en: 'No incident ≠ no risk. A low maintenance cost can mean "nobody patches anymore" — zero patching = zero spend but rising risk. The evidence is CVEs and tests, not silence.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztuje doprowadzenie tego systemu do stanu „aktualny" względem jego wartości odtworzeniowej — jaki to procent długu na tej aplikacji?',
        en: 'What does it cost to bring this system to a "current" state versus its replacement value — what tech-debt percentage does that put on this application?',
      },
      rationale: {
        pl: 'Dług % wartości estate (McKinsey: 20-40% typowy zakres) zamienia „stary system" w liczbę porównywalną między aplikacjami — bez niej priorytety są odczuciem.',
        en: 'Debt as a % of estate value (McKinsey: 20-40% typical) turns "old system" into a number comparable across applications — without it priorities are a feeling.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Ile osób potrafi utrzymać ten stos i czy rynek dostarcza ludzi do tej technologii — czy trend liczby tych osób rośnie, czy maleje?',
        en: 'How many people can maintain this stack and does the market supply talent for the technology — is the count of those people trending up or down?',
      },
      rationale: {
        pl: 'Malejący bus factor jest wskaźnikiem wyprzedzającym: spadek 3→1 w rok przewiduje wzrost kosztu i czasu utrzymania szybciej, niż widać to w samym TCO — kondycja pogorszy się o 1-2 lata wcześniej niż sądzicie.',
        en: 'A falling bus factor is a leading indicator: a 3→1 drop in a year predicts higher maintenance cost and time faster than TCO shows — health will worsen 1-2 years before you expect.',
      },
    },
  ],
  cost: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Ile realnie kosztuje ten system rocznie — licencje + infrastruktura + FTE utrzymania + koszt incydentów + szkolenie ludzi na starym stosie?',
        en: 'What does this system really cost per year — licenses + infrastructure + maintenance FTE + incident cost + training people on the old stack?',
      },
      rationale: {
        pl: 'TCO to nie sama faktura za licencję — najdroższe pozycje (FTE, obejścia, ręczne workaroundy) są niewidoczne w budżecie i pojawiają się dopiero, gdy się je nazwie.',
        en: 'TCO is not just the license invoice — the priciest items (FTE, workarounds, manual patches) are invisible in the budget and surface only once named.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaka część rocznego kosztu idzie w „utrzymanie przy życiu" (patching, obejścia), a jaka w nowe możliwości — jaki jest podział run vs change?',
        en: 'What share of the annual cost goes to "keeping it alive" (patching, workarounds) versus new capability — what is the run vs change split?',
      },
      rationale: {
        pl: 'Zdrowy portfel odwraca proporcję run/change im bliżej strategii transformacji — 85% w „run" wobec 15% w „change" to sam w sobie insight, niezależny od pojedynczego systemu.',
        en: 'A healthy portfolio flips the run/change ratio the closer it gets to a transformation strategy — 85% "run" vs 15% "change" is itself an insight, independent of any single system.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki procent całkowitego budżetu IT pochłaniają aplikacje sklasyfikowane ELIMINATE/MIGRATE o niskiej wartości — ile pieniędzy idzie w utrzymanie przeszłości?',
        en: 'What percentage of the total IT budget is consumed by low-value applications classified ELIMINATE/MIGRATE — how much money goes to maintaining the past?',
      },
      rationale: {
        pl: 'Gdy 20-30% budżetu IT idzie w garstkę aplikacji o niskiej wartości, to jawny sygnał złej alokacji — realokacja do kwadrantu INVEST bywa największą pojedynczą dźwignią oszczędności w roku.',
        en: 'When 20-30% of the IT budget goes to a handful of low-value apps, that is a clear mis-allocation signal — reallocating to the INVEST quadrant is often the single largest yearly saving lever.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy policzyliście koszt zaniechania (rosnące ryzyko, malejący bus factor, kumulujący się dług) obok kosztu migracji — czy koszt „nic nie robimy" jest niewidoczny?',
        en: 'Have you costed the cost of inaction (rising risk, falling bus factor, accruing debt) alongside the migration cost — or is the "do nothing" cost invisible?',
      },
      rationale: {
        pl: 'Bez porównania kosztu status quo każda migracja wygląda drożej niż jest — koszt bazowy (nic-nie-robimy) rzadko jest liczony explicite, więc modernizacja zawsze przegrywa na papierze.',
        en: 'Without comparing the status-quo cost, every migration looks pricier than it is — the baseline (do-nothing) cost is rarely counted explicitly, so modernization always loses on paper.',
      },
    },
  ],
  risk: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Kiedy kończy się wsparcie dostawcy dla tego systemu i czy dostawca/integrator wciąż istnieje na rynku — czy jest twarda data końca wsparcia?',
        en: 'When does vendor support for this system end, and does the vendor/integrator still exist in the market — is there a hard support-end date?',
      },
      rationale: {
        pl: 'Data końca wsparcia to twardy deadline, nie sugestia — im bliżej niej, tym wyższy priorytet migracji, niezależnie od tego, jak dobrze system dziś działa.',
        en: 'The support-end date is a hard deadline, not a suggestion — the closer it is, the higher the migration priority, regardless of how well the system runs today.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Ile osób naprawdę potrafi utrzymać ten system (bus factor), jaki jest ich wiek/plany emerytalne/rotacja — i czy istnieje udokumentowana wiedza, czy „nikt nie wie jak to działa"?',
        en: 'How many people can truly maintain this system (bus factor), what are their age/retirement/turnover risks — and is there documented knowledge, or "nobody knows how it works"?',
      },
      rationale: {
        pl: 'Bus factor 1 w systemie finansowym, gdzie autor odszedł 3 lata temu, to grupa wysokiego ryzyka nawet bez incydentów — ryzyko materializuje się skokowo (odejście osoby, luka, awaria), nie liniowo.',
        en: 'Bus factor 1 in a finance system whose author left 3 years ago is high-risk even without incidents — the risk materializes in a jump (a person leaves, a breach, a failure), not linearly.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Które systemy mają jednocześnie ≥2 sygnały ryzyka (brak wsparcia + bus factor ≤1 + wygasające compliance/licencja) — gdzie ryzyko jest skoncentrowane?',
        en: 'Which systems carry ≥2 risk signals at once (no support + bus factor ≤1 + expiring compliance/license) — where is risk concentrated?',
      },
      rationale: {
        pl: 'Indeks ryzyka waży brak wsparcia, znane CVE, bus factor=1 i wygasające licencje/compliance — koncentracja tych sygnałów w kilku systemach jest twardszym argumentem niż średnia po portfelu.',
        en: 'The risk index weighs no-support, known CVEs, bus factor=1 and expiring licenses/compliance — a concentration of those signals in a few systems is a harder argument than a portfolio average.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy profil regulacyjny firmy (bank, ubezpieczyciel, RODO, data residency) podnosi wagę compliance na tyle, że system „działający, ale niezgodny" musi trafić do MIGRATE mimo braku awarii?',
        en: 'Does the company\'s regulatory profile (bank, insurer, GDPR, data residency) raise the compliance weight enough that a "working but non-compliant" system must go to MIGRATE despite no failures?',
      },
      rationale: {
        pl: 'W środowisku regulowanym regulator nie akceptuje „działa od 15 lat bez incydentu" jako uzasadnienia luki compliance — to odwraca zasadę „nie psuj czegoś, co działa" i zmienia decyzję TIME przy tym samym TCO.',
        en: 'In a regulated environment the regulator does not accept "works 15 years without incident" as justification for a compliance gap — this reverses "don\'t fix what works" and changes the TIME decision at the same TCO.',
      },
    },
  ],
  dependencies: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Co z czym się integruje — które systemy rozmawiają z którymi, jakie dane przepływają i w którą stronę?',
        en: 'What integrates with what — which systems talk to which, what data flows and in which direction?',
      },
      rationale: {
        pl: 'Mapa zależności musi wyprzedzać decyzję TIME — nie da się wygasić systemu, od którego zależą trzy inne, bez planu przejściowego. Bez tej mapy plan wygaszenia wybucha w fazie wdrożenia.',
        en: 'The dependency map must precede the TIME decision — you cannot retire a system three others depend on without a transition plan. Without the map, the retirement plan blows up in delivery.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy każda integracja jest udokumentowana, czy część działa jako „nikt nie wie jak to działa" — gdzie są ukryte węzły, o których dowiecie się dopiero przy migracji?',
        en: 'Is every integration documented, or does some run as "nobody knows how it works" — where are the hidden nodes you\'ll discover only mid-migration?',
      },
      rationale: {
        pl: 'Ukryta zależność jest głównym powodem, dla którego migracja kończy się na warstwie bazy danych i psuje na warstwie integracji — niewidoczny węzeł zmienia decyzję z ELIMINATE na MIGRATE.',
        en: 'A hidden dependency is the main reason migrations end at the database layer and break at the integration layer — an invisible node flips a decision from ELIMINATE to MIGRATE.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile innych systemów zależy od każdego węzła (in-degree) — który system jest jednym punktem integracji dla najwięcej innych, np. legacy middleware, przez które przechodzą wszystkie zamówienia?',
        en: 'How many other systems depend on each node (in-degree) — which system is the single integration point for the most others, e.g. legacy middleware all orders pass through?',
      },
      rationale: {
        pl: 'Węzeł o wysokim in-degree, oceniony jako ELIMINATE po samej kondycji, nie może zniknąć bez zastąpienia integracji — to podnosi go do MIGRATE (Refactor) z twardą sekwencją: najpierw nowa integracja, potem wygaszenie.',
        en: 'A high in-degree node scored ELIMINATE on health alone cannot vanish without replacing the integration — this lifts it to MIGRATE (Refactor) with a hard sequence: build the new integration first, retire second.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy roadmapa modernizacji jest ułożona według grafu zależności, czy tylko według priorytetu wartości — czy każda inicjatywa ma jawny warunek wejścia (co musi ją poprzedzić)?',
        en: 'Is the modernization roadmap sequenced by the dependency graph, or only by value priority — does each initiative have an explicit entry condition (what must precede it)?',
      },
      rationale: {
        pl: 'Roadmapa to graf zależności przełożony na oś czasu, nie lista „co ważniejsze" — system o wysokim priorytecie wartości może iść później, bo bezpieczne wykonanie wymaga wcześniej ustabilizowanej integracji.',
        en: 'A roadmap is the dependency graph mapped onto time, not a "what matters more" list — a high-value system can go later because safe execution needs a stabilized integration first.',
      },
    },
  ],
};

export interface DimensionProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per dimension. Consumed when AI (or the offline
 * fallback) proposes candidate portfolio moves. Mirrors Inventory's
 * INVENTORY_PROPOSAL_BANK.
 */
export const LEGACY_PROPOSAL_BANK: Record<LegacyDimensionId, DimensionProposal[]> = {
  inventory: [
    {
      rung: 'surface',
      title: {
        pl: 'Zbudować jeden rejestr aplikacji z właścicielem biznesowym i technicznym',
        en: 'Build one application register with a business and technical owner',
      },
      explanation: {
        pl: 'Spiszcie każdy system: nazwa, właściciel biznesowy, właściciel techniczny, data wdrożenia, liczba użytkowników — to fundament, bez którego macierz TIME nie ma na czym stanąć.',
        en: 'List every system: name, business owner, technical owner, go-live date, user count — the foundation without which the TIME matrix has nothing to stand on.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zweryfikować listę z realnym ruchem, nie z pamięcią IT',
        en: 'Verify the list against real usage, not IT\'s memory',
      },
      explanation: {
        pl: 'Nałóżcie logi logowań i transakcje na inwentarz — systemy z <5 aktywnych użytkowników i bez właściciela biznesowego to czerwona flaga do ELIMINATE.',
        en: 'Overlay login logs and transactions on the inventory — systems with <5 active users and no business owner are a red flag for ELIMINATE.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Rozbić duże aplikacje na moduły ocenianie osobno',
        en: 'Decompose large applications into separately assessed modules',
      },
      explanation: {
        pl: 'Jeśli moduł ma osobnego właściciela, osobny cykl release lub inny profil ryzyka — ocencie go osobno; „cały ERP = jedna kropka" ukrywa, że rdzeń jest INVEST, a raportowanie MIGRATE.',
        en: 'If a module has a separate owner, release cycle or risk profile, assess it separately; "whole ERP = one dot" hides that the core is INVEST while reporting is MIGRATE.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustanowić rytm półrocznego przeglądu portfela',
        en: 'Establish a semi-annual portfolio review rhythm',
      },
      explanation: {
        pl: 'Wpięcie inwentarza w cykliczny przegląd utrzymuje macierz TIME żywą — bez rytmu raport starzeje się w kilka miesięcy, bo kondycja techniczna degraduje się ciągle.',
        en: 'Wiring the inventory into a recurring review keeps the TIME matrix live — without a rhythm the report ages within months, because technical health decays continuously.',
      },
    },
  ],
  businessValue: [
    {
      rung: 'surface',
      title: {
        pl: 'Ocenić krytyczność procesową (koszt braku) per system',
        en: 'Score process criticality (cost of absence) per system',
      },
      explanation: {
        pl: 'Zapytajcie o każdy system: co się stanie, jeśli padnie na dzień, na tydzień — to jest oś Y, nie wiek systemu ani sympatia zespołu.',
        en: 'Ask of each system: what happens if it is down for a day, a week — that is the Y axis, not the system\'s age or the team\'s affection.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ocenić wartość z właścicielem biznesowym, nie tylko z IT',
        en: 'Assess value with the business owner, not just IT',
      },
      explanation: {
        pl: 'Posadźcie właściciela biznesowego przy ocenie osi Y — ocena wyłącznie techniczna zaniża wartość „nielubianych" systemów i przecenia nowe błyszczące narzędzia.',
        en: 'Put the business owner in the room for the Y-axis judgment — an IT-only score underrates "disliked" systems and overrates new shiny tools.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zmierzyć przychód/koszt przechodzący przez system i unikalność funkcji',
        en: 'Measure the revenue/cost flowing through the system and function uniqueness',
      },
      explanation: {
        pl: 'Policzcie, ile przychodu i procesów obsługuje system i czy funkcja jest skomodytyzowana — to rozstrzyga między Repurchase (SaaS) a Refactor przy wyborze 6R.',
        en: 'Quantify how much revenue and how many processes the system serves and whether the function is commoditized — this decides between Repurchase (SaaS) and Refactor in the 6R choice.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zważyć wartość względem strategii na 2-3 lata',
        en: 'Weight value against the 2-3 year strategy',
      },
      explanation: {
        pl: 'Oceńcie wartość względem kierunku firmy (nowy rynek, fuzja), nie tylko dzisiejszego ruchu — system zgodny z przyszłością zasługuje na INVEST, nawet jeśli dziś obsługuje mniej.',
        en: 'Judge value against the company\'s direction (new market, merger), not just today\'s traffic — a system aligned with the future earns INVEST even if it serves less today.',
      },
    },
  ],
  techHealth: [
    {
      rung: 'surface',
      title: {
        pl: 'Zinwentaryzować wiek stosu i status wsparcia per system',
        en: 'Inventory stack age and support status per system',
      },
      explanation: {
        pl: 'Zapiszcie dla każdego systemu wersję frameworka i status wsparcia (aktywne / wygasające / brak) — framework po końcu życia to ryzyko obecne, nie przyszłe.',
        en: 'Record for each system its framework version and support status (active / expiring / none) — an end-of-life framework is a present risk, not a future one.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zebrać twarde sygnały kondycji zamiast wrażenia „działa"',
        en: 'Gather hard health signals instead of the "it works" impression',
      },
      explanation: {
        pl: 'Zestawcie znane CVE, datę ostatniego pentestu, pokrycie testami i liczbę incydentów/rok — niski koszt utrzymania bez patchowania to rosnące ryzyko udające zdrowie.',
        en: 'Compile known CVEs, last-pentest date, test coverage and incidents/year — a low maintenance cost with no patching is rising risk masquerading as health.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć dług jako % wartości odtworzeniowej aplikacji',
        en: 'Compute debt as a % of the application\'s replacement value',
      },
      explanation: {
        pl: 'Oszacujcie koszt doprowadzenia do stanu „aktualny" / wartość odtworzeniowa — ta liczba (benchmark McKinsey 20-40%) czyni „stary system" porównywalnym między aplikacjami.',
        en: 'Estimate the cost to reach a "current" state / replacement value — this number (McKinsey benchmark 20-40%) makes "old system" comparable across applications.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zmapować bus factor i jego trend per system',
        en: 'Map the bus factor and its trend per system',
      },
      explanation: {
        pl: 'Policzcie, ile osób utrzyma każdy system i w którą stronę idzie ten trend — spadek 3→1 to wskaźnik wyprzedzający, ostrzegający o pogorszeniu kondycji 1-2 lata wcześniej niż TCO.',
        en: 'Count how many people can maintain each system and which way the trend goes — a 3→1 drop is a leading indicator warning of health decay 1-2 years before TCO does.',
      },
    },
  ],
  cost: [
    {
      rung: 'surface',
      title: {
        pl: 'Policzyć pełne TCO per system (nie samą licencję)',
        en: 'Compute full TCO per system (not just the license)',
      },
      explanation: {
        pl: 'Zsumujcie licencje + infrastrukturę + FTE utrzymania + koszt incydentów + szkolenie na starym stosie — najdroższe pozycje są niewidoczne, dopóki się ich nie nazwie.',
        en: 'Add licenses + infrastructure + maintenance FTE + incident cost + old-stack training — the priciest items stay invisible until named.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Rozbić budżet IT na „run" (utrzymanie) i „change" (rozwój)',
        en: 'Split the IT budget into "run" (maintenance) and "change" (development)',
      },
      explanation: {
        pl: 'Pokażcie, jaka część budżetu idzie w utrzymanie status quo — 85% w „run" wobec 15% w „change" to insight sam w sobie, niezależny od pojedynczego systemu.',
        en: 'Show what share of the budget maintains the status quo — 85% "run" vs 15% "change" is an insight in itself, independent of any single system.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyliczyć % budżetu IT uwięziony w aplikacjach ELIMINATE/MIGRATE o niskiej wartości',
        en: 'Compute the % of IT budget trapped in low-value ELIMINATE/MIGRATE apps',
      },
      explanation: {
        pl: 'Zsumujcie TCO aplikacji do wygaszenia/migracji o niskiej wartości / całkowity budżet IT — 20-30% w tej grupie to jawny sygnał złej alokacji i największa dźwignia oszczędności.',
        en: 'Sum the TCO of low-value retire/migrate apps / total IT budget — 20-30% in that group is a clear mis-allocation signal and the largest saving lever.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Policzyć koszt zaniechania obok kosztu migracji',
        en: 'Cost the inaction alongside the migration',
      },
      explanation: {
        pl: 'Zestawcie koszt „nic nie robimy" (rosnące ryzyko, malejący bus factor, kumulujący się dług) z kosztem migracji — bez tego migracja zawsze wygląda drożej niż jest.',
        en: 'Put the "do nothing" cost (rising risk, falling bus factor, accruing debt) next to the migration cost — without it migration always looks pricier than it is.',
      },
    },
  ],
  risk: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować daty końca wsparcia i status dostawcy',
        en: 'Map support-end dates and vendor status',
      },
      explanation: {
        pl: 'Dla każdego systemu zapiszcie datę końca wsparcia i czy dostawca wciąż istnieje — to twarde deadline’y, które sekwencjonują roadmapę mocniej niż priorytet wartości.',
        en: 'For each system record the support-end date and whether the vendor still exists — these are hard deadlines that sequence the roadmap more strongly than value priority.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oznaczyć systemy z bus factor ≤1 i brakiem dokumentacji',
        en: 'Flag systems with bus factor ≤1 and no documentation',
      },
      explanation: {
        pl: 'Wskażcie systemy, gdzie jedna osoba zna kod, a dokumentacji brak — bus factor 1 w systemie krytycznym podnosi pilność niezależnie od pozycji w macierzy TIME.',
        en: 'Identify systems where one person knows the code and documentation is missing — bus factor 1 in a critical system raises urgency regardless of its TIME position.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zbudować indeks ryzyka i pokazać jego koncentrację',
        en: 'Build a risk index and show its concentration',
      },
      explanation: {
        pl: 'Zważcie brak wsparcia, CVE, bus factor=1 i wygasające compliance w jeden indeks — koncentracja ≥2 sygnałów w kilku systemach jest twardszym argumentem niż średnia po portfelu.',
        en: 'Weight no-support, CVEs, bus factor=1 and expiring compliance into one index — a concentration of ≥2 signals in a few systems is a harder argument than a portfolio average.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uwzględnić profil regulacyjny w wadze compliance',
        en: 'Factor the regulatory profile into the compliance weight',
      },
      explanation: {
        pl: 'W środowisku regulowanym podnieście wagę compliance na osi kondycji — system „działający, ale niezgodny" trafia do MIGRATE mimo braku awarii, bo regulator nie akceptuje „działa od 15 lat".',
        en: 'In a regulated environment raise the compliance weight on the health axis — a "working but non-compliant" system goes to MIGRATE despite no failures, because the regulator rejects "it\'s worked 15 years".',
      },
    },
  ],
  dependencies: [
    {
      rung: 'surface',
      title: {
        pl: 'Wyrysować mapę zależności międzysystemowych',
        en: 'Draw the cross-system dependency map',
      },
      explanation: {
        pl: 'Narysujcie graf: co z czym się integruje, jakie dane płyną i w którą stronę — mapa musi wyprzedzać decyzję TIME, inaczej plan wygaszenia wybucha przy wdrożeniu.',
        en: 'Draw the graph: what integrates with what, what data flows and in which direction — the map must precede the TIME decision, or the retirement plan blows up in delivery.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oznaczyć integracje nieudokumentowane („nikt nie wie jak działa")',
        en: 'Flag undocumented integrations ("nobody knows how it works")',
      },
      explanation: {
        pl: 'Wskażcie połączenia bez dokumentacji — ukryta zależność zmienia decyzję z ELIMINATE na MIGRATE i jest głównym powodem, dla którego migracja psuje się na warstwie integracji.',
        en: 'Identify links without documentation — a hidden dependency flips a decision from ELIMINATE to MIGRATE and is the main reason migrations break at the integration layer.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć in-degree każdego węzła (ile systemów od niego zależy)',
        en: 'Count each node\'s in-degree (how many systems depend on it)',
      },
      explanation: {
        pl: 'Policzcie, ile systemów zależy od każdego węzła — węzeł o wysokim in-degree (np. middleware, przez które przechodzą wszystkie zamówienia) nie może zniknąć bez zastąpienia integracji.',
        en: 'Count how many systems depend on each node — a high in-degree node (e.g. middleware all orders pass through) cannot vanish without replacing the integration.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ułożyć roadmapę według grafu zależności, nie priorytetu wartości',
        en: 'Sequence the roadmap by the dependency graph, not value priority',
      },
      explanation: {
        pl: 'Nadajcie każdej inicjatywie jawny warunek wejścia (co musi ją poprzedzić) — roadmapa to graf zależności na osi czasu; system o wysokim priorytecie idzie później, bo wymaga wcześniej stabilnej integracji.',
        en: 'Give each initiative an explicit entry condition (what must precede it) — the roadmap is the dependency graph on a timeline; a high-priority system goes later because it needs a stable integration first.',
      },
    },
  ],
};
