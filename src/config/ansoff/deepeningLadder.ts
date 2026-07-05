/**
 * Ansoff Growth Paths — deepening ladder (drabinka pogłębiająca)
 *
 * Mirrors the SWOT `DEEPEN_OPTIONS` / `PROPOSAL_BANK` pattern
 * (see src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx)
 * but encodes the Ansoff-specific "depth staircase" per quadrant:
 *
 *   1. surface          — where do you grow today in this direction?
 *   2. evidence         — share, saturation, capabilities backing it
 *   3. quantification   — market headroom, cost of entry
 *   4. risk-capability  — what you must be able to do to win
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the
 * GrowthPaths input/options phases and by the synthesis engine.
 */

import type { GrowthQuadrantId } from '@/store/useToolStore';

export const ANSOFF_QUADRANTS: GrowthQuadrantId[] = [
  'marketPenetration',
  'marketDevelopment',
  'productDevelopment',
  'diversification',
];

export type Bilingual = { pl: string; en: string };

/** One rung of the deepening ladder. `id` is stable and quadrant-agnostic. */
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

/** The four canonical rungs shared by every quadrant, with quadrant-specific phrasing layered on top. */
const RUNG_ORDER: LadderRung['id'][] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export const ANSOFF_LADDER_RUNG_ORDER = RUNG_ORDER;

/**
 * Per-quadrant deepening ladder. Each quadrant has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const ANSOFF_DEEPENING_LADDER: Record<GrowthQuadrantId, LadderRung[]> = {
  marketPenetration: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'W których obecnych segmentach i produktach realnie dziś rośniecie, a gdzie stoicie w miejscu?',
        en: 'In which current segments and products are you actually growing today, and where are you flat?',
      },
      rationale: {
        pl: 'Penetracja ma sens tylko tam, gdzie jest jeszcze niewykorzystany popyt na to, co już sprzedajecie.',
        en: 'Penetration only pays off where there is still untapped demand for what you already sell.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki macie udział w rynku i jak nasycony jest ten segment — czy jest dowód, że da się urwać więcej?',
        en: 'What is your market share and how saturated is the segment — is there proof you can take more?',
      },
      rationale: {
        pl: 'Bez dowodu na niedosycenie penetracja zamienia się w przepalanie budżetu na już przekonanych klientów.',
        en: 'Without proof of under-saturation, penetration becomes burning budget on already-converted buyers.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile realnie jest headroomu (klienci × częstotliwość × koszyk) i ile kosztuje odebranie go konkurencji?',
        en: 'How much headroom is real (buyers × frequency × basket) and what does taking it from rivals cost?',
      },
      rationale: {
        pl: 'Liczby oddzielają realną penetrację od życzeniowego „urośniemy w tym, co znamy".',
        en: 'Numbers separate real penetration from the wishful "we will just grow in what we know".',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Co musicie umieć lepiej (cena, kanał, retencja), żeby zwiększyć udział bez erozji marży?',
        en: 'What must you do better (price, channel, retention) to grow share without eroding margin?',
      },
      rationale: {
        pl: 'Najniższe ryzyko Ansoffa, ale wygrywają je tylko ci, którzy mają realną dźwignię na udział.',
        en: "Ansoff's lowest-risk box, but only those with a real lever on share actually win it.",
      },
    },
  ],
  marketDevelopment: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jakie nowe rynki (geografia, branża, segment) chcecie otworzyć obecnym produktem?',
        en: 'Which new markets (geography, vertical, segment) do you want to open with the current product?',
      },
      rationale: {
        pl: 'Rozwój rynku to ten sam produkt u nowego odbiorcy — najpierw nazwijcie, kto to jest.',
        en: 'Market development is the same product for a new buyer — first name exactly who that is.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Co dowodzi, że wasza obecna propozycja wartości przeniesie się na ten rynek bez przeróbki?',
        en: 'What proves your current value proposition transfers to that market without rework?',
      },
      rationale: {
        pl: 'Rynki wyglądają podobnie z daleka; dowód dopasowania oddziela transfer od kosztownego re-startu.',
        en: 'Markets look alike from afar; fit evidence separates a transfer from a costly re-launch.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jak duży jest ten rynek (TAM/SAM) i jaki jest koszt wejścia: kanał, lokalizacja, zgodność?',
        en: 'How big is the market (TAM/SAM) and what is the cost of entry: channel, localization, compliance?',
      },
      rationale: {
        pl: 'Nowy rynek bez policzonego kosztu wejścia to zakład, a nie ścieżka wzrostu.',
        en: 'A new market without a costed entry is a bet, not a growth path.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakiej zdolności GTM (sprzedaż, partnerzy, marka lokalna) wam brakuje, żeby ten rynek zdobyć?',
        en: 'Which GTM capability (sales, partners, local brand) do you lack to actually win this market?',
      },
      rationale: {
        pl: 'Ryzyko rozwoju rynku siedzi w dystrybucji i wiarygodności, nie w samym produkcie.',
        en: 'Market-development risk lives in distribution and credibility, not in the product itself.',
      },
    },
  ],
  productDevelopment: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki nowy produkt lub rozszerzenie chcecie dać obecnym, znanym wam klientom?',
        en: 'Which new product or extension do you want to give your current, well-known customers?',
      },
      rationale: {
        pl: 'Rozwój produktu wykorzystuje zaufanie, które już macie — zacznijcie od realnej potrzeby tych klientów.',
        en: 'Product development leverages trust you already have — start from these customers real need.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest dowód popytu (sygnały, pilotaże, prośby klientów), a jaka wasza zdolność wytworzenia?',
        en: 'What is the demand evidence (signals, pilots, customer asks) and your capability to build it?',
      },
      rationale: {
        pl: 'Dwa dowody muszą się spotkać: że klient tego chce i że umiecie to dowieźć powtarzalnie.',
        en: 'Two proofs must meet: that the customer wants it and that you can ship it repeatably.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki jest headroom przychodu z bazy klientów i ile kosztuje R&D + wprowadzenie na rynek?',
        en: 'What is the revenue headroom from the customer base and the cost of R&D + go-to-market?',
      },
      rationale: {
        pl: 'Nowy produkt zjada gotówkę zanim ją zwróci — payback trzeba policzyć, nie założyć.',
        en: 'A new product consumes cash before it returns it — payback must be computed, not assumed.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Jakich kompetencji produktowych/technologicznych wam brakuje i czy da się je zbudować w oknie czasu?',
        en: 'Which product/tech capabilities do you lack, and can you build them inside the time window?',
      },
      rationale: {
        pl: 'Ryzyko rozwoju produktu to luka zdolności wytwórczych — najczęstszy powód odroczenia tej ścieżki.',
        en: "Product-development risk is a build-capability gap — the most common reason to defer this path.",
      },
    },
  ],
  diversification: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Jaki nowy produkt na nowym rynku rozważacie i dlaczego akurat wy mielibyście tam wygrać?',
        en: 'Which new product in a new market are you weighing, and why would you specifically win there?',
      },
      rationale: {
        pl: 'Dywersyfikacja to najwyższe ryzyko Ansoffa — musi istnieć uczciwy powód, dla którego to wasza gra.',
        en: "Diversification is Ansoff's highest risk — there must be an honest reason it is your game to play.",
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Jaki jest realny związek (zdolność, marka, kanał) z obecnym biznesem, a nie tylko atrakcyjność rynku?',
        en: 'What is the real link (capability, brand, channel) to the current business, not just market allure?',
      },
      rationale: {
        pl: 'Bez dźwigni z rdzenia dywersyfikacja jest start-upem finansowanym z cudzych pieniędzy — nazwijcie dźwignię.',
        en: "Without a lever from the core, diversification is a start-up on someone else's money — name the lever.",
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile trzeba zainwestować, jak długi jest horyzont zwrotu i jaki kapitał ryzyka jesteście gotowi spalić?',
        en: 'How much must you invest, how long is the payback horizon, and what risk capital can you burn?',
      },
      rationale: {
        pl: 'Dywersyfikacja bez limitu strat i horyzontu to droga do rozmycia rdzennego biznesu.',
        en: 'Diversification without a loss cap and a horizon is a path to diluting the core business.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Których zdolności całkowicie wam brakuje i czy lepiej to kupić/partnerować niż budować od zera?',
        en: 'Which capabilities do you entirely lack, and is it better to buy/partner than to build from zero?',
      },
      rationale: {
        pl: 'Największe ryzyko: nowy produkt i nowy rynek naraz. Prawie zawsze warto odroczyć lub wejść przez partnera.',
        en: 'Highest risk: new product and new market at once. Almost always worth deferring or entering via a partner.',
      },
    },
  ],
};

export interface QuadrantProposal {
  title: Bilingual;
  explanation: Bilingual;
  /** Which ladder rung this proposal primarily speaks to. */
  rung: LadderRung['id'];
}

/**
 * Partner-grade proposal bank per quadrant. Consumed when AI (or the offline
 * fallback) proposes candidate growth options. Mirrors SWOT's PROPOSAL_BANK.
 */
export const ANSOFF_PROPOSAL_BANK: Record<GrowthQuadrantId, QuadrantProposal[]> = {
  marketPenetration: [
    {
      rung: 'surface',
      title: {
        pl: 'Zagęścić sprzedaż u już wygrywających klientów',
        en: 'Deepen sales into already-winning accounts',
      },
      explanation: {
        pl: 'Zamiast szukać nowych rynków, najpierw zwiększcie udział w portfelu klientów, którzy już wam ufają — to najtańszy przychód, jaki macie na stole.',
        en: 'Before chasing new markets, grow wallet share in accounts that already trust you — the cheapest revenue on the table.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Odzyskać udział tam, gdzie konkurent jest przereklamowany',
        en: 'Reclaim share where the incumbent is over-rated',
      },
      explanation: {
        pl: 'Jeśli dane pokazują niesatysfakcję u klientów lidera, penetracja przez ostrą propozycję różnicującą jest realna, nie życzeniowa.',
        en: 'If data shows dissatisfaction with the leader, penetration via a sharp differentiator is real, not wishful.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Podnieść częstotliwość i wartość koszyka',
        en: 'Lift purchase frequency and basket value',
      },
      explanation: {
        pl: 'Headroom penetracji to nie tylko nowi klienci: częstotliwość × koszyk potrafi dać wzrost bez kosztu akwizycji nowego rynku.',
        en: 'Penetration headroom is not only new buyers: frequency × basket can grow revenue without new-market acquisition cost.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zbudować retencję jako silnik wzrostu',
        en: 'Turn retention into a growth engine',
      },
      explanation: {
        pl: 'Najbezpieczniejsza penetracja przychodzi z niższego churnu — wymaga jednak zdolności obsługi i danych, których trzeba się nauczyć.',
        en: 'The safest penetration comes from lower churn — but it needs service and data capabilities you must learn.',
      },
    },
  ],
  marketDevelopment: [
    {
      rung: 'surface',
      title: {
        pl: 'Przenieść działającą ofertę do sąsiedniej branży',
        en: 'Carry a working offer into an adjacent vertical',
      },
      explanation: {
        pl: 'Ten sam produkt trafia do odbiorcy o podobnym profilu potrzeb — najniższe tarcie w rozwoju rynku, jeśli propozycja wartości się przenosi.',
        en: 'The same product reaches a buyer with a similar need profile — the lowest friction in market development if the value prop transfers.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Wejść na rynek, który już do was puka',
        en: 'Enter a market that is already knocking',
      },
      explanation: {
        pl: 'Jeśli macie nieproszone zapytania z nowego regionu lub segmentu, to twardy dowód dopasowania — zamieńcie go w plan wejścia.',
        en: 'Unsolicited inbound from a new region or segment is hard fit evidence — turn it into an entry plan.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wejść przez partnera, żeby zbić koszt kanału',
        en: 'Enter via a partner to cut channel cost',
      },
      explanation: {
        pl: 'Koszt wejścia dominuje w rozwoju rynku; partner z dystrybucją zamienia wysoką inwestycję w prowizję od realnej sprzedaży.',
        en: 'Entry cost dominates market development; a partner with distribution turns a heavy investment into commission on real sales.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zbudować lokalną wiarygodność, zanim skalujecie',
        en: 'Build local credibility before scaling',
      },
      explanation: {
        pl: 'Ryzyko nowego rynku to brak marki i referencji; pilotaż z jednym referencyjnym klientem obniża je bardziej niż większy budżet.',
        en: 'New-market risk is missing brand and references; a pilot with one reference customer de-risks more than a bigger budget.',
      },
    },
  ],
  productDevelopment: [
    {
      rung: 'surface',
      title: {
        pl: 'Dodać moduł, o który proszą obecni klienci',
        en: 'Add the module current customers keep asking for',
      },
      explanation: {
        pl: 'Rozszerzenie do znanej bazy niesie najniższe ryzyko rozwoju produktu — popyt jest już częściowo udowodniony rozmowami.',
        en: 'Extending to a known base carries the lowest product-development risk — demand is already part-proven in conversations.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zamienić powtarzalną pracę usługową w produkt',
        en: 'Productize a repeatable service you already deliver',
      },
      explanation: {
        pl: 'Jeśli robicie to samo w kółko na projektach, dowód popytu i zdolności już istnieje — brakuje tylko opakowania w produkt.',
        en: 'If you do the same thing over and over in projects, demand and capability evidence already exist — only the product packaging is missing.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wypuścić płatny pilotaż, żeby policzyć payback',
        en: 'Ship a paid pilot to compute payback',
      },
      explanation: {
        pl: 'Zamiast zakładać zwrot z R&D, sprzedajcie wersję early-access wybranym klientom i zmierzcie realną gotowość do zapłaty.',
        en: 'Instead of assuming R&D return, sell an early-access version to select customers and measure real willingness to pay.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Zamknąć lukę zdolności wytwórczej, zanim obiecacie',
        en: 'Close the build-capability gap before you promise',
      },
      explanation: {
        pl: 'Największe ryzyko to obietnica produktu, którego nie umiecie dowieźć powtarzalnie — najpierw zbudujcie lub kupcie brakującą kompetencję.',
        en: 'The biggest risk is promising a product you cannot ship repeatably — first build or buy the missing competency.',
      },
    },
  ],
  diversification: [
    {
      rung: 'surface',
      title: {
        pl: 'Dywersyfikować tam, gdzie macie realną dźwignię z rdzenia',
        en: 'Diversify only where you hold a real lever from the core',
      },
      explanation: {
        pl: 'Nowy produkt na nowym rynku ma sens tylko z dźwignią (marka, kanał, technologia) — bez niej to zakład, nie strategia.',
        en: 'A new product in a new market only makes sense with a lever (brand, channel, tech) — without it, it is a bet, not a strategy.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Kupić lub partnerować zamiast budować od zera',
        en: 'Buy or partner instead of building from zero',
      },
      explanation: {
        pl: 'Jeśli brakuje wam zarówno produktu, jak i rynku, akwizycja lub JV kupuje zdolność i wiarygodność szybciej niż budowa.',
        en: 'If you lack both product and market, an acquisition or JV buys capability and credibility faster than building.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Ustawić twardy limit strat i horyzont',
        en: 'Set a hard loss cap and a horizon',
      },
      explanation: {
        pl: 'Dywersyfikacja bez zdefiniowanego kapitału ryzyka rozmywa rdzeń; policzcie, ile jesteście gotowi stracić i do kiedy.',
        en: 'Diversification without defined risk capital dilutes the core; compute how much you are willing to lose and by when.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Odroczyć do czasu, aż rdzeń będzie stabilny',
        en: 'Defer until the core is stable',
      },
      explanation: {
        pl: 'Najczęściej właściwym ruchem jest świadome odroczenie: dywersyfikacja przy niestabilnym rdzeniu podwaja ryzyko zamiast je dzielić.',
        en: 'Most often the right move is a deliberate defer: diversifying on an unstable core doubles risk instead of splitting it.',
      },
    },
  ],
};
