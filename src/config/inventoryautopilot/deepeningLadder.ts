/**
 * Inventory Autopilot — deepening ladder (drabinka pogłębiająca)
 *
 * Cloned from the SMED / Ansoff `deepeningLadder` + `PROPOSAL_BANK` pattern
 * (see src/config/smedplanner/deepeningLadder.ts). Encodes the inventory-specific
 * "depth staircase" per lever of the autopilot:
 *
 *   1. surface          — what is the current policy / stock behaviour in this lever?
 *   2. evidence         — is it measured, or is it habit / a round-number default?
 *   3. quantification   — how much cash / service does it cost, at what demand variability?
 *   4. risk-capability  — what capability / data must exist to change it without stock-outs?
 *
 * The four canonical levers mirror the disciplined inventory-optimization order:
 *   - classify      : segment SKUs by value × variability (ABC/XYZ) before touching a policy
 *   - service       : set the service-level / safety-stock target per segment, not per SKU
 *   - replenish     : convert the target into reorder points / order-up-to logic (the autopilot)
 *   - deadstock     : release cash trapped in excess / obsolete stock and stop it recurring
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (inventoryEngine.ts).
 */

export type InventoryLeverId = 'classify' | 'service' | 'replenish' | 'deadstock';

export const INVENTORY_LEVERS: InventoryLeverId[] = [
  'classify',
  'service',
  'replenish',
  'deadstock',
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

export const INVENTORY_LADDER_RUNG_ORDER = RUNG_ORDER;

const INVENTORY_LEVER_LABEL: Record<InventoryLeverId, Bilingual> = {
  classify: { pl: 'Klasyfikuj', en: 'Classify' },
  service: { pl: 'Poziom obsługi', en: 'Service level' },
  replenish: { pl: 'Uzupełniaj', en: 'Replenish' },
  deadstock: { pl: 'Martwy zapas', en: 'Dead stock' },
};

export const inventoryLeverLabel = (lever: InventoryLeverId): Bilingual =>
  INVENTORY_LEVER_LABEL[lever];

/**
 * Per-lever deepening ladder. Each lever has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const INVENTORY_DEEPENING_LADDER: Record<InventoryLeverId, LadderRung[]> = {
  classify: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak dziś dzielicie SKU — czy w ogóle rozróżniacie pozycje wysokoobrotowe od ogona, czy każda pozycja ma ten sam reżim zamówień?',
        en: 'How do you segment SKUs today — do you distinguish fast movers from the long tail at all, or does every item run the same ordering regime?',
      },
      rationale: {
        pl: 'Jedna polityka dla wszystkich SKU zawsze przepłaca ogon i głodzi bestsellery — klasyfikacja wartość × zmienność jest fundamentem, bez którego reszta optymalizuje średnią.',
        en: 'One policy for all SKUs always overpays the tail and starves the best-sellers — a value × variability classification is the foundation without which everything else optimizes an average.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że dana pozycja jest „ważna" — z realnego udziału w obrocie i marży, czy z przekonania działu sprzedaży?',
        en: 'How do you know an item is "important" — from its real share of turnover and margin, or from the sales team\'s conviction?',
      },
      rationale: {
        pl: 'Klasyfikacja oparta na anegdocie, nie na danych obrotu, myli pozycje głośne z rentownymi — dowodem jest rozkład Pareto, nie opinia.',
        en: 'Classification built on anecdote rather than turnover data confuses loud items with profitable ones — the evidence is the Pareto distribution, not an opinion.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile SKU generuje 80% obrotu i ile kapitału leży w pozostałym ogonie — jaka część zapasu obsługuje pozycje marginalne?',
        en: 'How many SKUs drive 80% of turnover, and how much capital sits in the remaining tail — what share of stock serves marginal items?',
      },
      rationale: {
        pl: 'Dopóki nie policzycie, ile złotówek zapasu przypada na klasę C, „za dużo zapasu" jest odczuciem, nie decyzją inwestycyjną.',
        en: 'Until you count how much stock capital sits in class C, "too much inventory" is a feeling, not an investment decision.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy macie czyste dane sprzedaży i marży per SKU, żeby utrzymać klasyfikację żywą, a nie zrobić ją raz i zamrozić?',
        en: 'Do you have clean per-SKU sales and margin data to keep the classification live, rather than run it once and freeze it?',
      },
      rationale: {
        pl: 'Klasyfikacja starzeje się co kwartał — bez zdolności do jej odświeżania z danych staje się kolejnym martwym raportem.',
        en: 'A classification decays every quarter — without the capability to refresh it from data it becomes another dead report.',
      },
    },
  ],
  service: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki poziom obsługi (dostępności) chcecie utrzymać i czy jest on różny dla klasy A i dla ogona, czy jeden dla wszystkich?',
        en: 'What service level (availability) do you target, and is it different for class A versus the tail, or one target for all?',
      },
      rationale: {
        pl: 'Deklarowane „99% dostępności dla wszystkiego" to najdroższy błąd zapasów — poziom obsługi musi być decyzją per segment, nie globalną ambicją.',
        en: 'A declared "99% availability for everything" is inventory\'s most expensive mistake — the service level must be a per-segment decision, not a global ambition.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy zapas bezpieczeństwa wynika z policzonej zmienności popytu i czasu dostawy, czy jest okrągłą liczbą („trzymamy na 2 tygodnie")?',
        en: 'Is safety stock derived from measured demand and lead-time variability, or is it a round number ("we keep two weeks")?',
      },
      rationale: {
        pl: 'Bufor „na oko" jest jednocześnie za duży tam, gdzie popyt stabilny, i za mały tam, gdzie zmienny — dowodem jest odchylenie, nie nawyk.',
        en: 'A gut-feel buffer is simultaneously too large where demand is stable and too small where it is volatile — the evidence is the deviation, not the habit.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kapitału zamraża zapas bezpieczeństwa przy obecnym poziomie obsługi i o ile spadłby przy obniżeniu celu dla klasy C o jeden punkt?',
        en: 'How much capital does safety stock freeze at the current service level, and how much would it fall if you dropped the class-C target by one point?',
      },
      rationale: {
        pl: 'Krzywa obsługa–kapitał jest wypukła: ostatnie punkty dostępności kosztują wielokrotnie więcej niż pierwsze — bez tej liczby cel jest życzeniem.',
        en: 'The service–capital curve is convex: the last points of availability cost multiples of the first — without that number the target is a wish.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czego brakuje (pomiar zmienności czasu dostawy, segmentacja klientów), żeby obniżyć bufor bez ryzyka utraty kluczowego klienta?',
        en: 'What is missing (lead-time variability measurement, customer segmentation) to lower the buffer without risking the loss of a key customer?',
      },
      rationale: {
        pl: 'Obniżenie zapasu bez zabezpieczenia dla klientów krytycznych przenosi ryzyko na sprzedaż — najpierw nazwij, których pozycji nie wolno tknąć.',
        en: 'Lowering stock without a safeguard for critical customers shifts risk onto sales — first name the items you must not touch.',
      },
    },
  ],
  replenish: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jak dziś powstaje decyzja o zamówieniu — reguła (punkt zamawiania / poziom docelowy), czy ręczne „zerknięcie" planisty na stan?',
        en: 'How is a reorder decided today — by a rule (reorder point / order-up-to level), or a planner\'s manual "glance" at stock?',
      },
      rationale: {
        pl: 'Ręczne zamawianie skaluje się liniowo z liczbą SKU i pada przy nieobecności planisty — autopilot zaczyna się od reguły, którą da się zapisać.',
        en: 'Manual ordering scales linearly with SKU count and collapses when the planner is away — the autopilot starts from a rule you can write down.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy parametry zamówień (punkt, wielkość partii) są liczone z popytu i czasu dostawy, czy odziedziczone i od lat nieweryfikowane?',
        en: 'Are the order parameters (reorder point, batch size) computed from demand and lead time, or inherited and unreviewed for years?',
      },
      rationale: {
        pl: 'Parametr ustawiony przy innym popycie dziś systematycznie zamawia za dużo albo za mało — dowodem jest zgodność z aktualnym popytem, nie data ostatniej zmiany.',
        en: 'A parameter set under a different demand today systematically orders too much or too little — the evidence is agreement with current demand, not the date it was last changed.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile braków (utraconej sprzedaży) i ile nadmiaru generują obecne reguły w skali roku — jaki jest łączny koszt złej parametryzacji?',
        en: 'How many stock-outs (lost sales) and how much overstock do the current rules generate across a year — what is the total cost of bad parameters?',
      },
      rationale: {
        pl: 'Koszt braków i koszt nadmiaru trzeba policzyć razem — optymalizacja tylko jednej strony przesuwa problem, nie usuwa go.',
        en: 'The cost of stock-outs and the cost of overstock must be counted together — optimizing only one side relocates the problem, it does not remove it.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy dane o popycie i czasie dostawy są na tyle czyste, by reguła działała automatycznie, czy autopilot wymagałby ciągłej ręcznej korekty?',
        en: 'Is demand and lead-time data clean enough for the rule to run automatically, or would the autopilot need constant manual correction?',
      },
      rationale: {
        pl: 'Autopilot na brudnych danych jest gorszy od planisty, bo błąd skaluje się cicho — najpierw zbuduj zaufanie do danych, potem oddaj sterowanie.',
        en: 'An autopilot on dirty data is worse than a planner, because the error scales silently — build trust in the data first, then hand over control.',
      },
    },
  ],
  deadstock: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Które pozycje nie sprzedały się od miesięcy i jak dużo kapitału w nich leży — czy w ogóle macie listę martwego i wolno-rotującego zapasu?',
        en: 'Which items have not sold in months and how much capital sits in them — do you even have a list of dead and slow-moving stock?',
      },
      rationale: {
        pl: 'Martwy zapas nie znika sam i zajmuje magazyn oraz kapitał obrotowy — pierwszy krok to go zobaczyć, bo księgowo wciąż wygląda jak aktywo.',
        en: 'Dead stock does not disappear on its own and ties up warehouse space and working capital — the first step is to see it, because on the books it still looks like an asset.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Skąd wiecie, że pozycja jest naprawdę martwa, a nie sezonowa lub serwisowa — czy odróżniacie brak popytu od popytu rzadkiego, ale krytycznego?',
        en: 'How do you know an item is truly dead rather than seasonal or a service part — do you distinguish no demand from rare-but-critical demand?',
      },
      rationale: {
        pl: 'Odpisanie części serwisowej, której klient żąda raz w roku, kosztuje więcej niż jej trzymanie — dowodem jest historia popytu, nie sama data ostatniej sprzedaży.',
        en: 'Writing off a service part a customer demands once a year costs more than holding it — the evidence is the demand history, not the last-sale date alone.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile kapitału obrotowego uwolniłaby wyprzedaż / odpis martwego zapasu i jaki byłby koszt tej operacji (rabaty, utylizacja)?',
        en: 'How much working capital would clearing / writing off dead stock release, and what would the operation cost (discounts, disposal)?',
      },
      rationale: {
        pl: 'Uwolniony kapitał ma wartość tylko wtedy, gdy przewyższa stratę na rabacie — bez policzenia obu stron wyprzedaż bywa droższa niż trzymanie.',
        en: 'Released capital only has value when it beats the discount loss — without counting both sides a clearance can cost more than holding.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej reguły brakuje (limit wieku zapasu, przegląd kwartalny), żeby martwy zapas przestał narastać, a nie tylko został raz uprzątnięty?',
        en: 'Which rule is missing (a stock-age limit, a quarterly review) so dead stock stops accumulating rather than being cleaned up once?',
      },
      rationale: {
        pl: 'Jednorazowa wyprzedaż bez reguły zapobiegawczej odtwarza problem w rok — utrzymanie zysku to pętla przeglądu, nie akcja.',
        en: 'A one-off clearance without a preventive rule recreates the problem within a year — holding the gain is a review loop, not a campaign.',
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
 * fallback) proposes candidate inventory moves. Mirrors SMED's PROPOSAL_BANK.
 */
export const INVENTORY_PROPOSAL_BANK: Record<InventoryLeverId, LeverProposal[]> = {
  classify: [
    {
      rung: 'surface',
      title: {
        pl: 'Przeprowadzić analizę ABC/XYZ całego asortymentu',
        en: 'Run an ABC/XYZ analysis on the whole assortment',
      },
      explanation: {
        pl: 'Podzielcie SKU na klasy wartości (ABC) i zmienności popytu (XYZ), zanim ustawicie jakąkolwiek politykę — to macierz, która mówi, gdzie zapas ma pracować, a gdzie tylko leży.',
        en: 'Split SKUs into value classes (ABC) and demand-variability classes (XYZ) before setting any policy — the matrix that tells you where inventory should work and where it only sits.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Oprzeć klasyfikację na obrocie i marży, nie na opinii',
        en: 'Base the classification on turnover and margin, not opinion',
      },
      explanation: {
        pl: 'Zbudujcie rozkład Pareto z realnych danych sprzedaży i marży per SKU — pozycje „ważne dla sprzedaży" często okazują się rentownościowym ogonem.',
        en: 'Build the Pareto distribution from real per-SKU sales and margin — items "important to sales" often turn out to be the profitability tail.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć kapitał zamrożony w klasie C',
        en: 'Cost the capital frozen in class C',
      },
      explanation: {
        pl: 'Zsumujcie wartość zapasu przypisaną do pozycji marginalnych — ta liczba uzasadnia decyzję o zaostrzeniu polityki dla ogona i uwolnieniu gotówki.',
        en: 'Sum the stock value attributed to marginal items — this number justifies tightening the tail policy and releasing cash.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zautomatyzować kwartalne odświeżanie klasyfikacji',
        en: 'Automate a quarterly refresh of the classification',
      },
      explanation: {
        pl: 'Wpięcie klasyfikacji w cykliczny raport z danych sprzedaży utrzymuje ją żywą — bez tego starzeje się i przestaje odzwierciedlać realny obrót.',
        en: 'Wiring the classification into a recurring report from sales data keeps it live — without it, it ages and stops reflecting real turnover.',
      },
    },
  ],
  service: [
    {
      rung: 'surface',
      title: {
        pl: 'Ustawić cele poziomu obsługi per segment ABC',
        en: 'Set service-level targets per ABC segment',
      },
      explanation: {
        pl: 'Wysoka dostępność dla klasy A, umiarkowana dla B, minimalna dla C — jeden cel dla wszystkich zawsze przepłaca ogon i niedoszacowuje bestsellerów.',
        en: 'High availability for class A, moderate for B, minimal for C — one target for all always overpays the tail and underserves the best-sellers.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wyliczyć zapas bezpieczeństwa ze zmienności, nie z nawyku',
        en: 'Compute safety stock from variability, not habit',
      },
      explanation: {
        pl: 'Zastąpcie bufor „na 2 tygodnie" wyliczeniem z odchylenia popytu i czasu dostawy per segment — to jednocześnie tnie nadmiar i domyka braki.',
        en: 'Replace the "two weeks" buffer with a calculation from demand and lead-time deviation per segment — this cuts overstock and closes stock-outs at once.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyrysować krzywą obsługa–kapitał dla klasy C',
        en: 'Plot the service–capital curve for class C',
      },
      explanation: {
        pl: 'Pokażcie, ile kapitału uwalnia obniżenie celu dostępności dla ogona o jeden punkt — krzywa wypukła zwykle daje duży zysk gotówkowy przy znikomym ryzyku sprzedaży.',
        en: 'Show how much capital a one-point drop in the tail availability target releases — the convex curve usually yields a large cash gain at negligible sales risk.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Oznaczyć pozycje krytyczne dla kluczowych klientów',
        en: 'Flag items critical to key customers',
      },
      explanation: {
        pl: 'Zanim obniżycie bufory, zbudujcie listę SKU, których brak zrywa relację z kluczowym klientem — te pozycje wyłączacie z cięcia świadomie.',
        en: 'Before lowering buffers, build the list of SKUs whose stock-out breaks a key-customer relationship — you exclude these from the cut deliberately.',
      },
    },
  ],
  replenish: [
    {
      rung: 'surface',
      title: {
        pl: 'Zapisać reguły punktu zamawiania dla klasy A i B',
        en: 'Write reorder-point rules for class A and B',
      },
      explanation: {
        pl: 'Zamieńcie ręczne „zerkanie na stan" na jawną regułę (punkt zamawiania + poziom docelowy) — to pierwszy realny krok autopilota, jeszcze bez inwestycji w system.',
        en: 'Replace the manual "glance at stock" with an explicit rule (reorder point + order-up-to level) — the first real autopilot step, still with no system spend.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przeliczyć odziedziczone parametry na aktualny popyt',
        en: 'Recompute inherited parameters against current demand',
      },
      explanation: {
        pl: 'Sprawdźcie każdą wielkość partii i punkt zamawiania względem popytu z ostatnich 12 miesięcy — parametry sprzed lat systematycznie zamawiają za dużo lub za mało.',
        en: 'Check every batch size and reorder point against the last 12 months of demand — years-old parameters systematically over- or under-order.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć łączny koszt braków i nadmiaru',
        en: 'Cost stock-outs and overstock together',
      },
      explanation: {
        pl: 'Zestawcie utraconą sprzedaż z brakami i koszt utrzymania nadmiaru w jednej liczbie — to ona pokazuje, ile realnie kosztuje zła parametryzacja reguł.',
        en: 'Put lost sales from stock-outs and the holding cost of overstock into one number — that is what shows the true cost of bad reorder parameters.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Uruchomić autopilota najpierw dla stabilnej klasy AX',
        en: 'Pilot the autopilot on the stable AX class first',
      },
      explanation: {
        pl: 'Oddajcie automatyce najpierw pozycje o wysokiej wartości i stabilnym popycie (AX) — tam dane są czyste i błąd łatwo zauważyć, zanim rozszerzycie na zmienny ogon.',
        en: 'Hand automation the high-value, stable-demand items (AX) first — there the data is clean and errors are easy to spot before extending to the volatile tail.',
      },
    },
  ],
  deadstock: [
    {
      rung: 'surface',
      title: {
        pl: 'Wygenerować listę martwego i wolno-rotującego zapasu',
        en: 'Generate a dead and slow-moving stock list',
      },
      explanation: {
        pl: 'Wyciągnijcie pozycje bez sprzedaży w zadanym oknie wraz z wartością księgową — bez tej listy martwy zapas pozostaje niewidzialnym aktywem, które zjada magazyn i gotówkę.',
        en: 'Pull items with no sales in a defined window together with their book value — without this list dead stock stays an invisible asset eating warehouse and cash.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Odróżnić martwy zapas od sezonowego i serwisowego',
        en: 'Separate dead stock from seasonal and service parts',
      },
      explanation: {
        pl: 'Nałóżcie historię popytu na listę — pozycje sezonowe lub rzadkie-ale-krytyczne wyłączcie z odpisu, bo ich brak kosztuje więcej niż trzymanie.',
        en: 'Overlay demand history on the list — exclude seasonal or rare-but-critical items from write-off, since their absence costs more than holding them.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć uwolniony kapitał netto po koszcie wyprzedaży',
        en: 'Compute net released capital after clearance cost',
      },
      explanation: {
        pl: 'Zestawcie uwolnioną gotówkę z kosztem rabatów i utylizacji — dopiero wynik netto mówi, czy wyprzedaż opłaca się bardziej niż dalsze trzymanie.',
        en: 'Net the freed cash against discount and disposal cost — only the net result says whether clearance beats continued holding.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wprowadzić limit wieku zapasu z kwartalnym przeglądem',
        en: 'Introduce a stock-age limit with a quarterly review',
      },
      explanation: {
        pl: 'Reguła „pozycja starsza niż X miesięcy trafia do przeglądu" zatrzymuje narastanie martwego zapasu — bez niej jednorazowa wyprzedaż odtwarza problem w rok.',
        en: 'A rule of "any item older than X months goes to review" halts dead-stock accrual — without it a one-off clearance recreates the problem within a year.',
      },
    },
  ],
};
