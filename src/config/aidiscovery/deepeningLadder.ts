/**
 * AI Discovery — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the SMED / Ansoff `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/smedplanner/deepeningLadder.ts). Encodes the AI-use-case
 * "depth staircase" per phase of disciplined discovery:
 *
 *   1. surface          — what is the candidate use case, in the business's own words?
 *   2. evidence         — is the pain real and is the data to solve it actually there?
 *   3. quantification   — how much value is at stake, and how ready is the data / tech?
 *   4. risk-capability  — what must exist (data, skills, governance) to ship it safely?
 *
 * The four canonical phases mirror the disciplined "value before hype" order:
 *   - discover     : surface candidate AI/ML use cases from real business pain
 *   - feasibility  : test data availability + technical readiness before promising value
 *   - value        : quantify the business value / ROI so the portfolio ranks on money, not novelty
 *   - sequence     : prioritize into a sequence — a lighthouse first, moonshots deferred with a reason
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (useCaseEngine.ts).
 */

export type AiPhaseId = 'discover' | 'feasibility' | 'value' | 'sequence';

export const AI_PHASES: AiPhaseId[] = ['discover', 'feasibility', 'value', 'sequence'];

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

export const AI_LADDER_RUNG_ORDER = RUNG_ORDER;

const AI_PHASE_LABEL: Record<AiPhaseId, Bilingual> = {
  discover: { pl: 'Odkryj', en: 'Discover' },
  feasibility: { pl: 'Wykonalność', en: 'Feasibility' },
  value: { pl: 'Wartość', en: 'Value' },
  sequence: { pl: 'Sekwencja', en: 'Sequence' },
};

export const aiPhaseLabel = (phase: AiPhaseId): Bilingual => AI_PHASE_LABEL[phase];

/**
 * Per-phase deepening ladder. Each phase has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const AI_DEEPENING_LADDER: Record<AiPhaseId, LadderRung[]> = {
  discover: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki konkretny problem biznesowy ma rozwiązać ten przypadek użycia AI — opisany procesem i rolą, a nie technologią („chcemy AI")?',
        en: 'What concrete business problem is this AI use case meant to solve — described by process and role, not by technology ("we want AI")?',
      },
      rationale: {
        pl: 'Przypadki użycia zaczynające się od „chcemy AI" rozwiązują technologię, nie problem — dyscyplina odkrywania wymaga nazwania bólu procesu, zanim padnie słowo „model".',
        en: 'Use cases that start from "we want AI" solve for the technology, not the problem — disciplined discovery names the process pain before the word "model" appears.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że ten ból jest realny i częsty — z obserwacji procesu i liczby przypadków, czy z pojedynczej frustracji jednej osoby?',
        en: "How do you know this pain is real and frequent — from process observation and case counts, or from one person's single frustration?",
      },
      rationale: {
        pl: 'AI opłaca się tylko przy powtarzalnym, częstym problemie — anegdota o jednym trudnym przypadku nie uzasadnia budowy modelu.',
        en: 'AI pays off only on a repetitive, frequent problem — an anecdote about one hard case does not justify building a model.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile razy w roku zdarza się ten przypadek i ile czasu / kosztu pochłania dziś — jaka jest skala bólu w liczbach?',
        en: 'How many times a year does this case occur and how much time / cost does it consume today — what is the scale of the pain in numbers?',
      },
      rationale: {
        pl: 'Częstotliwość × koszt jednostkowy zamienia „to męczące" w policzalny potencjał — bez tej liczby nie da się porównać przypadków między sobą.',
        en: 'Frequency × unit cost turns "this is painful" into a countable potential — without that number you cannot compare use cases against each other.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy istnieje właściciel biznesowy tego przypadku, który przyjmie wynik modelu i podejmie na jego podstawie decyzję — czy to projekt bez adresata?',
        en: "Is there a business owner for this use case who will accept the model's output and act on it — or is it a project with no recipient?",
      },
      rationale: {
        pl: 'Model bez właściciela decyzji trafia do szuflady — najczęstsza przyczyna śmierci projektu AI to nie technologia, lecz brak odbiorcy wyniku.',
        en: "A model with no decision owner ends up in a drawer — the most common cause of an AI project's death is not the technology but the absence of a recipient for the output.",
      },
    },
  ],
  feasibility: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jakie dane są potrzebne, żeby ten przypadek w ogóle był wykonalny, i czy fizycznie je macie — czy dopiero musielibyście je zbierać?',
        en: 'What data does this use case need to be feasible at all, and do you physically have it — or would you have to start collecting it?',
      },
      rationale: {
        pl: 'Najładniejszy przypadek użycia jest bezwartościowy bez danych — wykonalność zaczyna się od pytania „czy dane istnieją", nie „czy da się zbudować model".',
        en: 'The prettiest use case is worthless without data — feasibility starts with "does the data exist", not "can a model be built".',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy dane są w jakości nadającej się do użycia (kompletne, spójne, oznaczone), czy tylko formalnie „są" w systemie, ale brudne?',
        en: 'Is the data of usable quality (complete, consistent, labeled), or does it only formally "exist" in a system while being dirty?',
      },
      rationale: {
        pl: '„Mamy dane" i „mamy dane, na których model się nauczy" to dwa różne światy — dowodem wykonalności jest próbka, nie deklaracja o istnieniu tabeli.',
        en: '"We have data" and "we have data a model can learn from" are two different worlds — the evidence of feasibility is a sample, not a claim that a table exists.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kosztowałoby doprowadzenie danych i infrastruktury do stanu gotowości i jak długo by to trwało — jaka jest cena wejścia?',
        en: 'How much would getting the data and infrastructure ready cost and how long would it take — what is the cost of entry?',
      },
      rationale: {
        pl: 'Koszt przygotowania danych bywa większy niż koszt samego modelu — bez tej liczby ranking wartości ignoruje najdroższą część projektu.',
        en: 'Data-preparation cost is often larger than the model itself — without that number the value ranking ignores the most expensive part of the project.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie zdolność (ludzie, MLOps, governance danych), żeby utrzymać ten model po wdrożeniu, czy stałby się długiem po pierwszym dryfcie?',
        en: 'Do you have the capability (people, MLOps, data governance) to maintain this model after launch, or would it become debt after the first drift?',
      },
      rationale: {
        pl: 'Model to nie projekt, tylko produkt, który trzeba utrzymywać — bez zdolności operacyjnej wdrożenie zamienia się w dług techniczny i regulacyjny.',
        en: 'A model is not a project but a product that must be maintained — without operational capability a deployment turns into technical and regulatory debt.',
      },
    },
  ],
  value: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaką konkretną wartość biznesową ma dać ten przypadek — oszczędność czasu, wzrost sprzedaży, redukcja błędów — i dla kogo?',
        en: 'What concrete business value should this use case deliver — time saved, revenue lifted, errors reduced — and for whom?',
      },
      rationale: {
        pl: 'Wartość „usprawnimy procesy dzięki AI" jest niefalsyfikowalna — przypadek musi wskazać jeden mierzalny efekt, inaczej nie da się go rozliczyć.',
        en: 'A value of "we\'ll improve processes with AI" is unfalsifiable — a use case must name one measurable effect, or it cannot be held to account.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy szacunek wartości opiera się na obecnym koszcie procesu (baseline), czy na optymistycznym założeniu o skuteczności modelu?',
        en: "Is the value estimate based on the current process cost (a baseline), or on an optimistic assumption about the model's accuracy?",
      },
      rationale: {
        pl: 'Wartość liczona od życzeniowej skuteczności modelu zawsze zawodzi — dowodem jest baseline procesu, od którego liczymy realną poprawę.',
        en: 'Value computed from a wished-for model accuracy always disappoints — the evidence is the process baseline against which real improvement is measured.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaka jest wartość netto (potencjał minus koszt danych, budowy i utrzymania) i w jakim horyzoncie się zwraca?',
        en: 'What is the net value (potential minus data, build and maintenance cost) and over what horizon does it pay back?',
      },
      rationale: {
        pl: 'Wartość brutto myli ranking — dopiero wartość netto po koszcie utrzymania pokazuje, który przypadek realnie zarabia, a który tylko brzmi dobrze.',
        en: 'Gross value misleads the ranking — only net value after maintenance cost shows which use case actually earns and which merely sounds good.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakie ryzyko (błędny wynik modelu, uprzedzenie, zgodność regulacyjna) obniża oczekiwaną wartość i czy potraficie je kontrolować?',
        en: 'What risk (a wrong model output, bias, regulatory compliance) discounts the expected value, and can you control it?',
      },
      rationale: {
        pl: 'Wartość bez odjętego ryzyka jest zawyżona — przypadek o dużym potencjale i niekontrolowanym ryzyku regulacyjnym bywa gorszy niż mniejszy, ale pewny.',
        en: 'Value with risk not subtracted is overstated — a high-potential use case with uncontrolled regulatory risk can be worse than a smaller, safe one.',
      },
    },
  ],
  sequence: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który przypadek powinien pójść pierwszy jako „latarnia" (wysoka wartość × wysoka wykonalność), żeby zbudować zaufanie do AI w organizacji?',
        en: 'Which use case should go first as a "lighthouse" (high value × high feasibility) to build organizational trust in AI?',
      },
      rationale: {
        pl: 'Pierwszy projekt AI kupuje wiarygodność dla kolejnych — musi być wykonalny i widoczny, a nie najambitniejszy, bo porażka zamyka drzwi na lata.',
        en: 'The first AI project buys credibility for the rest — it must be feasible and visible, not the most ambitious, because a failure closes the door for years.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy kolejność wynika z policzonego stosunku wartość/wysiłek i gotowości danych, czy z tego, co brzmi najbardziej efektownie na zarządzie?',
        en: 'Does the order come from a computed value/effort ratio and data readiness, or from what sounds most impressive to the board?',
      },
      rationale: {
        pl: 'Sekwencja ustawiona pod efekt wizerunkowy zwykle stawia moonshoty na start — dowodem dobrej kolejności jest ranking wartość/wysiłek, nie entuzjazm.',
        en: 'A sequence set for optics usually puts moonshots first — the evidence of a good order is the value/effort ranking, not enthusiasm.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile łącznej wartości netto obejmuje pierwsza fala (2–3 przypadki) i ile kapitału / uwagi wymaga, żeby zmieściła się w realnych zdolnościach?',
        en: 'How much total net value does the first wave (2–3 use cases) cover, and how much capital / attention does it need to fit real capacity?',
      },
      rationale: {
        pl: 'Portfel AI upada nie na braku pomysłów, lecz na przeciążeniu — trzeba policzyć, ile fala realnie kosztuje uwagi, nie tylko ile obiecuje.',
        en: 'An AI portfolio fails not from a lack of ideas but from overload — you must count how much attention the wave actually costs, not only what it promises.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy organizacja ma zdolność wdrożeniową (dane, zespół, sponsor), żeby dowieźć pierwszą falę, zanim otworzy kolejną — czy grozi rozproszenie?',
        en: 'Does the organization have the delivery capability (data, team, sponsor) to finish the first wave before opening the next — or does it risk spreading thin?',
      },
      rationale: {
        pl: 'Otwarcie zbyt wielu przypadków naraz rozprasza jedyny wąski zasób — zespół danych — i żaden nie dochodzi do produkcji; sekwencja chroni tę zdolność.',
        en: 'Opening too many use cases at once spreads the one scarce resource — the data team — thin and none reaches production; the sequence protects that capability.',
      },
    },
  ],
};

export interface PhaseProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per phase. Consumed when AI (or the offline
 * fallback) proposes candidate AI-discovery moves. Mirrors SMED's PROPOSAL_BANK.
 */
export const AI_PROPOSAL_BANK: Record<AiPhaseId, PhaseProposal[]> = {
  discover: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować przypadki użycia od bólu procesu, nie od technologii',
        en: 'Map use cases from process pain, not from technology',
      },
      explanation: {
        pl: 'Przejdźcie procesy i wypiszcie miejsca powtarzalnej, kosztownej pracy decyzyjnej — dopiero do nich dobierajcie AI, zamiast szukać, „gdzie wcisnąć model".',
        en: 'Walk the processes and list the spots of repetitive, costly decision work — then fit AI to them, instead of hunting for "where to squeeze a model in".',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Potwierdzić częstotliwość i powtarzalność każdego przypadku',
        en: 'Confirm the frequency and repeatability of each use case',
      },
      explanation: {
        pl: 'Dla każdego kandydata policzcie, ile razy w roku występuje — AI opłaca się tylko przy powtarzalnym problemie, więc jednorazowe trudności odpadają na starcie.',
        en: 'For each candidate, count how often it occurs per year — AI pays off only on repetitive problems, so one-off difficulties drop out at the gate.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wycenić skalę bólu (częstotliwość × koszt jednostkowy)',
        en: 'Size the pain (frequency × unit cost)',
      },
      explanation: {
        pl: 'Zamieńcie „to męczące" na liczbę: ile godzin lub złotówek rocznie pochłania dany przypadek — to jedyny sposób porównać kandydatów obiektywnie.',
        en: 'Turn "this is painful" into a number: how many hours or dollars a year a case consumes — the only way to compare candidates objectively.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przypisać właściciela biznesowego do każdego przypadku',
        en: 'Assign a business owner to every use case',
      },
      explanation: {
        pl: 'Każdy przypadek dostaje osobę, która przyjmie wynik modelu i podejmie decyzję — przypadek bez odbiorcy to projekt skazany na szufladę.',
        en: 'Each use case gets a person who will accept the model output and act — a use case with no recipient is a project bound for the drawer.',
      },
    },
  ],
  feasibility: [
    {
      rung: 'surface',
      title: {
        pl: 'Zinwentaryzować dane wymagane przez każdy przypadek',
        en: 'Inventory the data each use case requires',
      },
      explanation: {
        pl: 'Dla każdego przypadku wypiszcie, jakich danych potrzebuje i czy fizycznie istnieją — brak danych dyskwalifikuje przypadek zanim policzymy jego wartość.',
        en: 'For each use case list what data it needs and whether it physically exists — missing data disqualifies a case before we ever cost its value.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Sprawdzić jakość danych na realnej próbce',
        en: 'Test data quality on a real sample',
      },
      explanation: {
        pl: 'Pobierzcie próbkę i oceńcie kompletność, spójność i oznaczenie — „dane są w systemie" nie znaczy „model się na nich nauczy".',
        en: 'Pull a sample and assess completeness, consistency and labeling — "the data is in the system" does not mean "a model can learn from it".',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Oszacować koszt i czas przygotowania danych',
        en: 'Estimate the cost and time of data preparation',
      },
      explanation: {
        pl: 'Policzcie cenę wejścia — czyszczenie, integracja, oznaczanie — bo często przewyższa ona koszt samego modelu i zmienia ranking wartości.',
        en: 'Cost the entry — cleaning, integration, labeling — because it often exceeds the model itself and reshuffles the value ranking.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ocenić zdolność utrzymania modelu (MLOps, governance)',
        en: 'Assess the capability to maintain the model (MLOps, governance)',
      },
      explanation: {
        pl: 'Sprawdźcie, czy macie ludzi i procesy do monitorowania dryfu i zgodności — bez tego wdrożony model staje się długiem po pierwszej zmianie danych.',
        en: 'Check whether you have the people and processes to monitor drift and compliance — without them a deployed model becomes debt after the first data shift.',
      },
    },
  ],
  value: [
    {
      rung: 'surface',
      title: {
        pl: 'Nazwać jeden mierzalny efekt biznesowy każdego przypadku',
        en: 'Name one measurable business effect per use case',
      },
      explanation: {
        pl: 'Zastąpcie „usprawnimy procesy" jednym twardym metrykiem (godziny, sprzedaż, błędy) — bez niego przypadku nie da się później rozliczyć.',
        en: 'Replace "we\'ll improve processes" with one hard metric (hours, revenue, errors) — without it the use case cannot be held to account later.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Liczyć wartość od baseline procesu, nie od skuteczności modelu',
        en: 'Compute value from the process baseline, not model accuracy',
      },
      explanation: {
        pl: 'Osadźcie szacunek w obecnym koszcie procesu i konserwatywnym założeniu skuteczności — wartość liczona od życzeniowej dokładności zawsze zawodzi.',
        en: 'Anchor the estimate in the current process cost and a conservative accuracy assumption — value from a wished-for accuracy always disappoints.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć wartość netto po koszcie danych i utrzymania',
        en: 'Compute net value after data and maintenance cost',
      },
      explanation: {
        pl: 'Odejmijcie od potencjału koszt przygotowania danych, budowy i utrzymania — dopiero wartość netto porządkuje portfel według realnego zarobku.',
        en: 'Subtract data-prep, build and maintenance cost from the potential — only net value orders the portfolio by real earnings.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zdyskontować wartość o ryzyko modelu i zgodności',
        en: 'Discount value for model and compliance risk',
      },
      explanation: {
        pl: 'Obniżcie oczekiwaną wartość o ryzyko błędnego wyniku, uprzedzenia i regulacji — przypadek pewny bywa lepszy niż większy, ale niekontrolowany.',
        en: 'Discount expected value for wrong-output, bias and regulatory risk — a safe case can beat a larger but uncontrolled one.',
      },
    },
  ],
  sequence: [
    {
      rung: 'surface',
      title: {
        pl: 'Wybrać „latarnię": wysoka wartość × wysoka wykonalność na start',
        en: 'Pick a "lighthouse": high value × high feasibility to start',
      },
      explanation: {
        pl: 'Pierwszy projekt kupuje wiarygodność dla reszty portfela — wybierzcie przypadek wykonalny i widoczny, a nie najambitniejszy.',
        en: 'The first project buys credibility for the rest of the portfolio — choose a feasible, visible case, not the most ambitious.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Uszeregować portfel wg stosunku wartość/wysiłek i gotowości danych',
        en: 'Rank the portfolio by value/effort and data readiness',
      },
      explanation: {
        pl: 'Zbudujcie ranking z policzonej wartości netto i wykonalności — kolejność ma wynikać z liczb, nie z tego, co brzmi efektownie na zarządzie.',
        en: 'Build the ranking from computed net value and feasibility — the order should come from numbers, not from what sounds impressive to the board.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Zamknąć pierwszą falę w realnej zdolności (2–3 przypadki)',
        en: 'Bound the first wave to real capacity (2–3 use cases)',
      },
      explanation: {
        pl: 'Policzcie łączną wartość i obciążenie zespołu danych dla pierwszej fali — fala większa niż zdolność dostawy dowozi zero, nie wszystko.',
        en: 'Count the total value and data-team load for the first wave — a wave larger than delivery capacity ships zero, not everything.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Odroczyć moonshoty z jawnym powodem, aż powstanie zdolność',
        en: 'Defer moonshots with an explicit reason until capability exists',
      },
      explanation: {
        pl: 'Najambitniejsze przypadki zostawcie na później z nazwanym warunkiem (dane, zespół, sponsor) — świadome odroczenie chroni pierwszą falę przed rozproszeniem.',
        en: 'Leave the most ambitious cases for later with a named condition (data, team, sponsor) — a deliberate deferral protects the first wave from spreading thin.',
      },
    },
  ],
};
