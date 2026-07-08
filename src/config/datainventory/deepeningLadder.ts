/**
 * Data Inventory — deepening ladder (drabinka pogłębiająca) + content bank.
 *
 * Cloned from the Inventory Autopilot / SMED `deepeningLadder` + `PROPOSAL_BANK`
 * pattern (see src/config/inventoryautopilot/deepeningLadder.ts). Encodes the
 * data-governance-specific "depth staircase" per governance lever, plus the
 * canonical methodology content — data domains, the 8 DAMA quality dimensions,
 * the 5-level Gartner governance maturity model and the AI-readiness dimensions.
 *
 * Methodology (SSOT: Harvard/wdrozenie-100/_TOOLS_DOKTRYNA/data-inventory.md):
 *   - DAMA-DMBOK 2.0            : 8 data-quality dimensions
 *   - Gartner EIM Maturity      : 5 governance maturity levels (Aware..Effective)
 *   - Data Readiness for AI     : 5 AI-readiness dimensions (Deloitte/Gartner)
 *
 * The four canonical GOVERNANCE LEVERS mirror the disciplined data-diagnosis
 * order — you cannot assess quality of a dataset the org does not know it owns,
 * and you cannot make a dataset AI-ready before it has an owner who keeps it clean:
 *   - inventory   : catalog the data assets (what we have, where, who owns it) FIRST
 *   - quality     : score each domain across the 8 DAMA quality dimensions
 *   - governance  : assess who maintains quality over time (maturity level per domain)
 *   - aiReadiness  : judge whether the data can safely feed an AI model/agent
 *
 * Content is partner-grade, bilingual (PL/EN), and consumed by the tool's input
 * sections and by the synthesis engine (dataInventoryEngine.ts).
 */

export type DataGovernanceLeverId = 'inventory' | 'quality' | 'governance' | 'aiReadiness';

export const DATA_GOVERNANCE_LEVERS: DataGovernanceLeverId[] = [
  'inventory',
  'quality',
  'governance',
  'aiReadiness',
];

export type Bilingual = { pl: string; en: string };

// ---------------------------------------------------------------------------
// Data domains — the thematic partition (DAMA): each has a different criticality
// profile and a different rightful business owner.
// ---------------------------------------------------------------------------

export type DataDomainId =
  | 'customer'
  | 'product'
  | 'finance'
  | 'employee'
  | 'operations'
  | 'supplier';

export const DATA_DOMAINS: DataDomainId[] = [
  'customer',
  'product',
  'finance',
  'employee',
  'operations',
  'supplier',
];

const DATA_DOMAIN_LABEL: Record<DataDomainId, Bilingual> = {
  customer: { pl: 'Dane klienta', en: 'Customer data' },
  product: { pl: 'Dane produktowe', en: 'Product data' },
  finance: { pl: 'Dane finansowe', en: 'Finance data' },
  employee: { pl: 'Dane pracownicze (HR)', en: 'Employee (HR) data' },
  operations: { pl: 'Dane operacyjne', en: 'Operations data' },
  supplier: { pl: 'Dane dostawców', en: 'Supplier data' },
};

export const dataDomainLabel = (domain: DataDomainId): Bilingual => DATA_DOMAIN_LABEL[domain];

// ---------------------------------------------------------------------------
// 8 DAMA-DMBOK data-quality dimensions.
// ---------------------------------------------------------------------------

export type QualityDimensionId =
  | 'completeness'
  | 'accuracy'
  | 'consistency'
  | 'timeliness'
  | 'uniqueness'
  | 'integrity'
  | 'validity'
  | 'reasonableness';

export const QUALITY_DIMENSIONS: QualityDimensionId[] = [
  'completeness',
  'accuracy',
  'consistency',
  'timeliness',
  'uniqueness',
  'integrity',
  'validity',
  'reasonableness',
];

export interface QualityDimensionMeta {
  id: QualityDimensionId;
  label: Bilingual;
  /** What weak scores on this dimension mean and how they must be repaired. */
  meaning: Bilingual;
}

export const QUALITY_DIMENSION_META: Record<QualityDimensionId, QualityDimensionMeta> = {
  completeness: {
    id: 'completeness',
    label: { pl: 'Kompletność', en: 'Completeness' },
    meaning: {
      pl: 'Czy brakuje wartości tam, gdzie powinny być — udział pól wypełnionych względem wymaganych.',
      en: 'Whether values are missing where they should exist — share of populated fields vs. required.',
    },
  },
  accuracy: {
    id: 'accuracy',
    label: { pl: 'Dokładność', en: 'Accuracy' },
    meaning: {
      pl: 'Czy dane odzwierciedlają rzeczywistość — weryfikacja względem źródła autorytatywnego.',
      en: 'Whether the data reflects reality — verified against an authoritative source.',
    },
  },
  consistency: {
    id: 'consistency',
    label: { pl: 'Spójność', en: 'Consistency' },
    meaning: {
      pl: 'Czy to samo pojęcie wygląda tak samo we wszystkich systemach, czy rozjeżdża się między CRM a ERP.',
      en: 'Whether the same concept looks identical across systems, or diverges between CRM and ERP.',
    },
  },
  timeliness: {
    id: 'timeliness',
    label: { pl: 'Aktualność', en: 'Timeliness' },
    meaning: {
      pl: 'Czy dane są na tyle świeże, by decyzja na nich oparta była trafna — stare dane w polu „status" to zero wartości.',
      en: 'Whether the data is fresh enough for a decision on it to be sound — stale status fields carry zero decision value.',
    },
  },
  uniqueness: {
    id: 'uniqueness',
    label: { pl: 'Unikalność', en: 'Uniqueness' },
    meaning: {
      pl: 'Ile duplikatów tego samego bytu (ten sam klient wprowadzony wielokrotnie różnymi nazwami).',
      en: 'How many duplicates of the same entity (the same customer entered several times under different names).',
    },
  },
  integrity: {
    id: 'integrity',
    label: { pl: 'Integralność', en: 'Integrity' },
    meaning: {
      pl: 'Czy relacje między danymi są zachowane — zamówienie bez istniejącego klienta łamie integralność referencyjną.',
      en: 'Whether relationships between data hold — an order without an existing customer breaks referential integrity.',
    },
  },
  validity: {
    id: 'validity',
    label: { pl: 'Poprawność formalna', en: 'Validity' },
    meaning: {
      pl: 'Czy dane spełniają zdefiniowany format/zakres — data urodzenia w przyszłości lub e-mail bez „@" to błąd walidacji.',
      en: 'Whether data meets a defined format/range — a future birth date or an e-mail without "@" is a validation error.',
    },
  },
  reasonableness: {
    id: 'reasonableness',
    label: { pl: 'Rozsądność', en: 'Reasonableness' },
    meaning: {
      pl: 'Czy wartość ma sens biznesowy w kontekście — przychód 3 zł/mc w segmencie enterprise jest formalnie poprawny, biznesowo podejrzany.',
      en: 'Whether a value makes business sense in context — €3/mo revenue in an enterprise segment is formally valid but suspicious.',
    },
  },
};

// ---------------------------------------------------------------------------
// Gartner EIM governance maturity — 5 levels.
// ---------------------------------------------------------------------------

export type GovernanceMaturityLevel = 1 | 2 | 3 | 4 | 5;

export interface GovernanceLevelMeta {
  level: GovernanceMaturityLevel;
  name: Bilingual;
  characteristic: Bilingual;
}

export const GOVERNANCE_MATURITY_LEVELS: Record<GovernanceMaturityLevel, GovernanceLevelMeta> = {
  1: {
    level: 1,
    name: { pl: 'Świadomość (Aware)', en: 'Aware' },
    characteristic: {
      pl: 'Dane uznane za aktywo „na papierze"; nikt formalnie nie odpowiada, jakość zależy od przypadku i dobrej woli pojedynczych osób.',
      en: 'Data called an asset "on paper"; nobody is formally accountable, quality depends on chance and individual goodwill.',
    },
  },
  2: {
    level: 2,
    name: { pl: 'Reaktywność (Reactive)', en: 'Reactive' },
    characteristic: {
      pl: 'Governance istnieje wyspowo — pojedyncze działy mają swoje zasady; problemy jakości gaszone po fakcie, nie zapobiegane systemowo.',
      en: 'Governance is islanded — individual departments have their own rules; quality issues are firefought after the fact, not prevented systemically.',
    },
  },
  3: {
    level: 3,
    name: { pl: 'Proaktywność (Proactive)', en: 'Proactive' },
    characteristic: {
      pl: 'Zdefiniowane polityki, powołani właściciele/stewardzi kluczowych domen, współpraca międzydziałowa — ale egzekucja wciąż nierówna między domenami.',
      en: 'Defined policies, appointed owners/stewards for key domains, cross-department cooperation — but execution is still uneven across domains.',
    },
  },
  4: {
    level: 4,
    name: { pl: 'Zarządzanie (Managed)', en: 'Managed' },
    characteristic: {
      pl: 'Governance obejmuje całą organizację, metryki jakości mierzone regularnie jak KPI, kontrole częściowo zautomatyzowane.',
      en: 'Governance spans the whole organization, quality metrics measured regularly as KPIs, controls partly automated.',
    },
  },
  5: {
    level: 5,
    name: { pl: 'Efektywność (Effective)', en: 'Effective' },
    characteristic: {
      pl: 'Ciągłe doskonalenie w oparciu o dane ilościowe; governance dostosowuje się do zmieniających się celów biznesowych. Punkt odniesienia, nie oczekiwanie domyślne.',
      en: 'Continuous improvement driven by quantitative data; governance adapts to shifting business goals. A benchmark, not a default expectation.',
    },
  },
};

// ---------------------------------------------------------------------------
// Data Readiness for AI — 5 dimensions (Deloitte/Gartner).
// ---------------------------------------------------------------------------

export type AiReadinessDimensionId =
  | 'availability'
  | 'quality'
  | 'structure'
  | 'governance'
  | 'useCaseAlignment';

export const AI_READINESS_DIMENSIONS: AiReadinessDimensionId[] = [
  'availability',
  'quality',
  'structure',
  'governance',
  'useCaseAlignment',
];

export const AI_READINESS_DIMENSION_META: Record<AiReadinessDimensionId, { label: Bilingual; meaning: Bilingual }> = {
  availability: {
    label: { pl: 'Dostępność', en: 'Availability' },
    meaning: {
      pl: 'Czy dane są dostępne cyfrowo w formacie, do którego model ma dostęp — nie zamknięte w PDF-ach ani w pamięci pracowników.',
      en: 'Whether data is digitally available in a format a model can reach — not locked in PDFs or in employees’ heads.',
    },
  },
  quality: {
    label: { pl: 'Jakość', en: 'Quality' },
    meaning: {
      pl: 'Profil jakości (8 wymiarów DAMA). AI amplifikuje błąd szybciej i pewniej niż człowiek — próg jakości pod AI jest WYŻSZY niż pod raport dla ludzi.',
      en: 'Quality profile (8 DAMA dimensions). AI amplifies error faster and more confidently than a human — the quality bar for AI is HIGHER than for a human-facing report.',
    },
  },
  structure: {
    label: { pl: 'Struktura', en: 'Structure' },
    meaning: {
      pl: 'Czy dane są ustrukturyzowane/oznaczone tak, że model może je interpretować (metadane, schemat, spójne słownictwo) — czy to nieoznaczony dark data.',
      en: 'Whether data is structured/labeled so a model can interpret it (metadata, schema, consistent vocabulary) — or unlabeled dark data.',
    },
  },
  governance: {
    label: { pl: 'Governance', en: 'Governance' },
    meaning: {
      pl: 'Bez governance nawet dobre dziś dane zdegradują się, zanim projekt AI się skończy — gotowość musi być trwała, nie migawkowa.',
      en: 'Without governance even data good today degrades before the AI project ships — readiness must be durable, not a snapshot.',
    },
  },
  useCaseAlignment: {
    label: { pl: 'Dopasowanie do przypadku użycia', en: 'Use-case alignment' },
    meaning: {
      pl: 'Czy dane, które mamy, odpowiadają na pytanie zadawane AI — dane transakcyjne świetne pod prognozę popytu, bezużyteczne pod ocenę satysfakcji bez feedbacku.',
      en: 'Whether the data we hold answers the question posed to AI — transactional data is great for demand forecasting, useless for satisfaction without feedback data.',
    },
  },
};

// ---------------------------------------------------------------------------
// Deepening ladder per governance lever.
// ---------------------------------------------------------------------------

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

export const DATA_INVENTORY_LADDER_RUNG_ORDER = RUNG_ORDER;

const DATA_GOVERNANCE_LEVER_LABEL: Record<DataGovernanceLeverId, Bilingual> = {
  inventory: { pl: 'Inwentaryzacja', en: 'Inventory' },
  quality: { pl: 'Jakość danych', en: 'Data quality' },
  governance: { pl: 'Governance', en: 'Governance' },
  aiReadiness: { pl: 'Gotowość pod AI', en: 'AI readiness' },
};

export const dataGovernanceLeverLabel = (lever: DataGovernanceLeverId): Bilingual =>
  DATA_GOVERNANCE_LEVER_LABEL[lever];

/**
 * Per-lever deepening ladder. Each lever has exactly 4 rungs in RUNG_ORDER,
 * so the synthesis engine can rely on a stable shape.
 */
export const DATA_INVENTORY_DEEPENING_LADDER: Record<DataGovernanceLeverId, LadderRung[]> = {
  inventory: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy w ogóle macie listę zbiorów danych — systemy, hurtownie, „żyjące" arkusze Excel, aplikacje SaaS, dane w chmurze plikowej — czy istnieją one tylko w głowach pracowników?',
        en: 'Do you even have a list of your data assets — systems, warehouses, "living" Excel sheets, SaaS apps, cloud file stores — or do they exist only in employees’ heads?',
      },
      rationale: {
        pl: 'Nie da się ocenić jakości ani governance zbioru, o którego istnieniu organizacja nie wie — inwentaryzacja to fundament, na którym stoi cała reszta.',
        en: 'You cannot assess the quality or governance of a dataset the organization does not know it owns — the inventory is the foundation everything else stands on.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Dla każdego zbioru — kto jest IMIENNIE właścicielem biznesowym (nie „dział"), a kto operacyjnym stewardem? Ile zbiorów nie ma jednoznacznej odpowiedzi?',
        en: 'For each dataset — who is the NAMED business owner (not "the department"), and who is the operational steward? How many datasets have no clear answer?',
      },
      rationale: {
        pl: 'Zbiór bez przypisanego właściciela biznesowego = sierocy zbiór (orphan). Samo pytanie „kto jest właścicielem X" i brak odpowiedzi już jest wynikiem audytu.',
        en: 'A dataset with no assigned business owner = an orphan dataset. The mere question "who owns X" and no answer is already an audit finding.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaki procent zbiorów jest sierocych (bez właściciela), a jaki to dark data (zbierane, ale nigdy nieanalizowane) — i ile z nich może zawierać dane osobowe podlegające RODO?',
        en: 'What share of datasets are orphans (no owner), and what share is dark data (collected but never analyzed) — and how many might hold GDPR-relevant personal data?',
      },
      rationale: {
        pl: 'Dark data rośnie proporcjonalnie do braku governance, nie do wielkości firmy — wysoki % zbiorów bez właściciela to sygnał dyscypliny, nie skali.',
        en: 'Dark data grows in proportion to the absence of governance, not company size — a high share of ownerless datasets is a discipline signal, not a scale one.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy inwentaryzacja jest procesem z rytmem przeglądu (kwartalnym/rocznym), czy jednorazowym katalogiem, który zdąży się zdezaktualizować w kilka miesięcy?',
        en: 'Is the inventory a process with a review rhythm (quarterly/annual), or a one-off catalog that will go stale within months?',
      },
      rationale: {
        pl: 'Katalog zrobiony raz i odłożony na półkę degraduje się jak dane, które miał opisać — nowe SaaS, nowe arkusze, rotacja właścicieli.',
        en: 'A catalog built once and shelved decays like the data it was meant to describe — new SaaS, new sheets, owner turnover.',
      },
    },
  ],
  quality: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy ufacie liczbom, które pokazują wasze systemy — czy zdarza się, że dwa działy przynoszą sprzeczne liczby dla tego samego wskaźnika na jednym spotkaniu?',
        en: 'Do you trust the numbers your systems show — or do two departments sometimes bring conflicting figures for the same metric to one meeting?',
      },
      rationale: {
        pl: 'Sprzeczne raporty na tym samym spotkaniu = brak master data, nie błąd pojedynczej osoby. Objaw powtarzalny = brak jednego źródła prawdy.',
        en: 'Conflicting reports in the same meeting = missing master data, not one person’s mistake. A recurring symptom = the absence of a single source of truth.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Dla kluczowych domen — czy oceniliście jakość po 8 wymiarach DAMA osobno (kompletność, spójność, unikalność...), czy jest to jedno ogólne odczucie „raczej OK"?',
        en: 'For key domains — have you scored quality across the 8 DAMA dimensions separately (completeness, consistency, uniqueness...), or is it one general feeling of "mostly fine"?',
      },
      rationale: {
        pl: 'Wynik nie jest jedną liczbą „jakość = 72%" — to profil po wymiarach, bo brak duplikatów ≠ brak luk w kompletności; różne przyczyny, różne interwencje.',
        en: 'The result is not one number "quality = 72%" — it is a per-dimension profile, because dedup gaps ≠ completeness gaps; different causes, different fixes.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Ile realnie wynosi jakość krytycznej domeny na najsłabszym wymiarze — np. spójność klienta między CRM a fakturowaniem, albo % duplikatów w tabeli produktowej?',
        en: 'What is the actual quality of the critical domain on its weakest dimension — e.g. customer consistency between CRM and billing, or the % of duplicates in the product table?',
      },
      rationale: {
        pl: 'Ocena reasonableness (sens biznesowy) wymaga rozmowy z biznesem — sama jakość techniczna (pole wypełnione, format poprawny) przepuszcza błędy poprawne, ale bezsensowne.',
        en: 'The reasonableness check (business sense) needs a business conversation — technical quality alone (field filled, format valid) lets through errors that are valid but nonsensical.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy istnieje proces walidacji NOWYCH rekordów, czy dobra jakość dotyczy tylko danych historycznych, które ktoś kiedyś ręcznie wyczyścił?',
        en: 'Is there a validation process for NEW records, or does the good quality apply only to historical data someone once cleaned by hand?',
      },
      rationale: {
        pl: 'Wysoka jakość bez governance jest tymczasowa — bez stewarda i procesu utrzymania degraduje się w miesiące wraz z napływem nieaudytowanych rekordów.',
        en: 'High quality without governance is temporary — without a steward and a maintenance process it degrades within months as unaudited new records flow in.',
      },
    },
  ],
  governance: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Czy dla kluczowych domen danych istnieją formalne polityki i przypisani właściciele/stewardzi — czy jakość zależy od dobrej woli pojedynczych osób?',
        en: 'For key data domains, do formal policies and assigned owners/stewards exist — or does quality depend on the goodwill of individuals?',
      },
      rationale: {
        pl: 'Governance to odpowiedź na pytanie „czy istnieje system, który UTRZYMA jakość w czasie" — nie migawka stanu obecnego. Ocenia się go osobno od jakości.',
        en: 'Governance answers "does a system exist that will KEEP quality over time" — not a snapshot of the current state. It is assessed separately from quality.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Na którym z 5 poziomów dojrzałości (Aware→Reactive→Proactive→Managed→Effective) jest każda kluczowa domena — i jak bardzo rozjeżdżają się między sobą?',
        en: 'Which of the 5 maturity levels (Aware→Reactive→Proactive→Managed→Effective) is each key domain on — and how far apart do they spread?',
      },
      rationale: {
        pl: 'Poziom rozjeżdża się między domenami — finanse (audytowane) bywają na 4, sprzedaż na 2, produkcja na 1. Ten rozjazd sam w sobie jest wynikiem diagnozy.',
        en: 'The level diverges across domains — finance (audited) sits at 4, sales at 2, production at 1. That divergence is itself a diagnostic finding.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Które domeny mają najwyższą dojrzałość i dlaczego — czy wzorzec pokazuje, że governance idzie tam, gdzie jest kara za jego brak (audyt, regulator), a nie tam, gdzie jest wartość?',
        en: 'Which domains have the highest maturity and why — does the pattern show governance going where the absence is penalized (auditor, regulator), not where the value is?',
      },
      rationale: {
        pl: 'Rozjazd governance między domenami ujawnia priorytety historyczne firmy, nie przypadek — presja zewnętrzna wymusiła dyscyplinę, której nikt nie wymusił wewnętrznie.',
        en: 'The governance divergence reveals the firm’s historical priorities, not chance — external pressure forced discipline nobody enforced internally elsewhere.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy właściciele domen to biznes (decyzja o odpowiedzialności i priorytetach), czy governance oddano w całości działowi IT jako projekt techniczny?',
        en: 'Are domain owners the business (a decision about accountability and priorities), or was governance handed wholesale to IT as a technical project?',
      },
      rationale: {
        pl: 'Governance danych to decyzja biznesowa — oddanie całości IT bez właścicieli biznesowych odtwarza dokładnie problem sierocego zbioru, tylko z ładniejszym katalogiem.',
        en: 'Data governance is a business decision — handing it all to IT without business owners recreates exactly the orphan-dataset problem, just with a prettier catalog on top.',
      },
    },
  ],
  aiReadiness: [
    {
      id: 'surface',
      depth: 1,
      label: { pl: 'Powierzchnia', en: 'Surface' },
      question: {
        pl: 'Który konkretny przypadek użycia AI planujecie (prognoza popytu, agent obsługi, automatyzacja) — i na których domenach danych ma on stanąć?',
        en: 'Which specific AI use-case do you plan (demand forecast, service agent, automation) — and which data domains must it stand on?',
      },
      rationale: {
        pl: 'Krytyczność domeny ocenia się względem PLANOWANEGO użycia, nie dzisiejszego — domena nisko priorytetowa operacyjnie może być fundamentem projektu AI.',
        en: 'Domain criticality is judged against PLANNED use, not today’s — a domain low-priority operationally can be the foundation of the AI project.',
      },
    },
    {
      id: 'evidence',
      depth: 2,
      label: { pl: 'Dowód', en: 'Evidence' },
      question: {
        pl: 'Czy domeny krytyczne dla tego przypadku użycia spełniają 5 wymiarów gotowości (dostępność, jakość, struktura, governance, dopasowanie), czy któreś jest twardą blokadą?',
        en: 'Do the domains critical to this use-case meet the 5 readiness dimensions (availability, quality, structure, governance, alignment), or is one a hard blocker?',
      },
      rationale: {
        pl: 'AI potrzebuje wszystkich domen naraz — jedna domena o wysokiej jakości nie ratuje readiness, jeśli inna krytyczna dla tego samego modelu jest słaba.',
        en: 'AI needs all the domains at once — one high-quality domain does not save readiness if another domain critical to the same model is weak.',
      },
    },
    {
      id: 'quantification',
      depth: 3,
      label: { pl: 'Kwantyfikacja', en: 'Quantification' },
      question: {
        pl: 'Jaka jest realna gotowość najsłabszej krytycznej domeny (jakość % + poziom governance) — i czy przekracza WYŻSZY próg jakości wymagany przez AI niż przez raport dla ludzi?',
        en: 'What is the real readiness of the weakest critical domain (quality % + governance level) — and does it clear the HIGHER quality bar AI needs versus a human-facing report?',
      },
      rationale: {
        pl: 'AI amplifikuje błąd — model podaje odpowiedź na złych danych płynnie i pewnie, więc błąd nie jest widoczny jako błąd, tylko jako wiarygodna rekomendacja.',
        en: 'AI amplifies error — a model answers on bad data smoothly and confidently, so the error shows up not as an error but as a credible recommendation.',
      },
    },
    {
      id: 'risk-capability',
      depth: 4,
      label: { pl: 'Ryzyko i zdolności', en: 'Risk & capability' },
      question: {
        pl: 'Czy sekwencja jest ustawiona sekwencyjnie (najpierw naprawa master data, potem pilot AN na czystych danych), czy pod presją czasu pilot rusza równolegle na wiadomo złych danych?',
        en: 'Is the sequence set sequentially (fix master data first, then pilot AI on clean data), or does time pressure launch the pilot in parallel on knowingly bad data?',
      },
      rationale: {
        pl: 'Naprawa master data musi POPRZEDZAĆ projekt AI, nie biec równolegle — pilot na złych danych daje model, który ładnie prognozuje na złym gruncie, a słaby wynik mylnie brzmi jak „AI nie działa".',
        en: 'Master-data repair must PRECEDE the AI project, not run in parallel — a pilot on bad data yields a model forecasting neatly on bad ground, and the weak result is misread as "AI doesn’t work".',
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
 * Partner-grade proposal bank per governance lever. Consumed when AI (or the
 * offline fallback) proposes candidate governance moves. Mirrors the Inventory
 * PROPOSAL_BANK.
 */
export const DATA_INVENTORY_PROPOSAL_BANK: Record<DataGovernanceLeverId, LeverProposal[]> = {
  inventory: [
    {
      rung: 'surface',
      title: {
        pl: 'Zbudować rejestr aktywów danych (inventory) całej organizacji',
        en: 'Build an organization-wide data-asset inventory',
      },
      explanation: {
        pl: 'Zbierzcie surową listę: co mamy, gdzie leży, kto (podobno) jest właścicielem — z wywiadów z działami, przeglądu systemów i audytu licencji SaaS. To punkt startowy, bez którego nie da się ocenić niczego dalej.',
        en: 'Assemble the raw list: what we have, where it sits, who (allegedly) owns it — from department interviews, a systems review and a SaaS-license audit. The starting point without which nothing further can be assessed.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Przypisać imiennego właściciela biznesowego do każdej domeny',
        en: 'Assign a named business owner to every domain',
      },
      explanation: {
        pl: 'Dla każdej domeny nazwijcie właściciela biznesowego (imiennie, nie „dział") i operacyjnego stewarda — a każdy zbiór bez odpowiedzi oznaczcie jako sierocy: to najtańszy do wykrycia sygnał złego governance.',
        en: 'For each domain name a business owner (by name, not "the department") and an operational steward — and flag every dataset with no answer as an orphan: the cheapest-to-detect governance signal.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Domknąć rejestr systemów SaaS i sklasyfikować wrażliwość danych',
        en: 'Close the SaaS-systems register and classify data sensitivity',
      },
      explanation: {
        pl: 'Wylistujcie aktywne subskrypcje SaaS z ich właścicielami i zawartością — systemy bez właściciela mogą zawierać dane osobowe klientów bez podstawy prawnej; to przedwarunek każdej strategii AI, nie zadanie równoległe.',
        en: 'List active SaaS subscriptions with owners and contents — ownerless systems may hold customer personal data with no legal basis; a precondition for any AI strategy, not a parallel task.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustanowić kwartalny rytm przeglądu inwentarza',
        en: 'Establish a quarterly inventory-review rhythm',
      },
      explanation: {
        pl: 'Wprowadźcie cykliczny przegląd (kwartalny/roczny), który wychwytuje nowe systemy, nowe arkusze i rotację właścicieli — inwentaryzacja bez rytmu degraduje się tak samo jak dane, które opisuje.',
        en: 'Introduce a recurring review (quarterly/annual) that catches new systems, new sheets and owner turnover — an inventory with no rhythm decays like the data it describes.',
      },
    },
  ],
  quality: [
    {
      rung: 'surface',
      title: {
        pl: 'Ocenić kluczowe domeny po 8 wymiarach jakości DAMA',
        en: 'Score key domains across the 8 DAMA quality dimensions',
      },
      explanation: {
        pl: 'Dla każdej krytycznej domeny oceńcie osobno kompletność, dokładność, spójność, aktualność, unikalność, integralność, poprawność formalną i rozsądność — wynik to profil, nie jedna liczba.',
        en: 'For each critical domain score completeness, accuracy, consistency, timeliness, uniqueness, integrity, validity and reasonableness separately — the result is a profile, not one number.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Zmierzyć spójność bytu między systemami (CRM vs ERP/fakturowanie)',
        en: 'Measure entity consistency across systems (CRM vs ERP/billing)',
      },
      explanation: {
        pl: 'Sprawdźcie, czy „ten sam klient" wygląda tak samo we wszystkich systemach — rozjazd między CRM a fakturowaniem to bezpośredni objaw braku master data i wspólnego identyfikatora.',
        en: 'Check whether "the same customer" looks identical across systems — divergence between CRM and billing is a direct symptom of missing master data and a shared identifier.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Policzyć duplikaty w krytycznej tabeli (deduplikacja)',
        en: 'Count duplicates in the critical table (deduplication)',
      },
      explanation: {
        pl: 'Zmierzcie % duplikatów tego samego bytu pod różnymi nazwami — każda analiza/model AI oparty na tej tabeli bez wcześniejszego czyszczenia będzie systematycznie zniekształcał metryki zależne od liczby unikalnych bytów.',
        en: 'Measure the % of duplicate entities under different names — any analysis/AI model built on this table without prior cleaning will systematically distort metrics that depend on unique-entity counts.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Wdrożyć walidację nowych rekordów przy wejściu',
        en: 'Deploy validation of new records at entry',
      },
      explanation: {
        pl: 'Zbudujcie kontrolę jakości na napływających rekordach (format, unikalność, kompletność wymaganych pól) — bez niej wyczyszczone dziś dane historyczne degradują się z każdym nowym, nieaudytowanym wpisem.',
        en: 'Build quality control on incoming records (format, uniqueness, completeness of required fields) — without it, historical data cleaned today degrades with every new unaudited entry.',
      },
    },
  ],
  governance: [
    {
      rung: 'surface',
      title: {
        pl: 'Zdefiniować polityki i role (właściciel + steward) dla kluczowych domen',
        en: 'Define policies and roles (owner + steward) for key domains',
      },
      explanation: {
        pl: 'Spiszcie polityki danych i powołajcie formalnych właścicieli biznesowych oraz stewardów operacyjnych — to przesuwa domenę z poziomu Aware/Reactive w stronę Proactive.',
        en: 'Write data policies and appoint formal business owners and operational stewards — this moves a domain from Aware/Reactive toward Proactive.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ocenić poziom dojrzałości (1-5) osobno dla każdej domeny',
        en: 'Assess maturity level (1-5) separately for each domain',
      },
      explanation: {
        pl: 'Przypiszcie każdej domenie poziom Gartner (Aware→Effective) — rozjazd (finanse 4, sprzedaż 2, produkcja 1) sam w sobie jest insightem o priorytetach historycznych firmy.',
        en: 'Assign each domain a Gartner level (Aware→Effective) — the spread (finance 4, sales 2, production 1) is itself an insight into the firm’s historical priorities.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wprowadzić metryki jakości mierzone regularnie jak KPI',
        en: 'Introduce quality metrics measured regularly as KPIs',
      },
      explanation: {
        pl: 'Zamieńcie anegdotyczne „raczej OK" na mierzone metryki jakości domeny — to warunek przejścia z poziomu Proactive (3) do Managed (4), gdzie jakość jest monitorowana, nie odczuwana.',
        en: 'Replace anecdotal "mostly fine" with measured domain-quality metrics — the condition for moving from Proactive (3) to Managed (4), where quality is monitored, not felt.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Przenieść wzorzec z domeny dojrzałej na domenę krytyczną',
        en: 'Replicate the mature domain’s pattern onto the critical domain',
      },
      explanation: {
        pl: 'Weźcie domenę o wysokiej dojrzałości (np. magazyn/finanse dzięki audytowi) jako wzorzec dyscypliny — replikacja jej rytmu przeglądu, jasnego właściciela i metryk na domenę krytyczną to najszybsza droga 2→3.',
        en: 'Take a high-maturity domain (e.g. warehouse/finance via audit) as a discipline template — replicating its review rhythm, clear owner and metrics onto the critical domain is the fastest 2→3 path.',
      },
    },
  ],
  aiReadiness: [
    {
      rung: 'surface',
      title: {
        pl: 'Zmapować przypadek użycia AI na wymagane domeny danych',
        en: 'Map the AI use-case to the data domains it requires',
      },
      explanation: {
        pl: 'Nazwijcie konkretny przypadek AI i wypiszcie domeny, na których musi stanąć — krytyczność każdej domeny oceniacie względem tego planu, nie dzisiejszego użycia.',
        en: 'Name the specific AI use-case and list the domains it must stand on — you assess each domain’s criticality against that plan, not today’s usage.',
      },
    },
    {
      rung: 'evidence',
      title: {
        pl: 'Ocenić 5 wymiarów gotowości AI dla domen krytycznych',
        en: 'Score the 5 AI-readiness dimensions for critical domains',
      },
      explanation: {
        pl: 'Oceńcie dostępność, jakość, strukturę, governance i dopasowanie do przypadku użycia — jeden wymiar na zerze (np. dane zamknięte w PDF) blokuje cały projekt niezależnie od reszty.',
        en: 'Score availability, quality, structure, governance and use-case alignment — one dimension at zero (e.g. data locked in PDFs) blocks the whole project regardless of the rest.',
      },
    },
    {
      rung: 'quantification',
      title: {
        pl: 'Wyznaczyć najsłabsze ogniwo i próg jakości pod AI',
        en: 'Identify the weakest link and the AI quality bar',
      },
      explanation: {
        pl: 'Znajdźcie najsłabszą krytyczną domenę (jakość % + poziom governance) — to ona wyznacza readiness całego projektu, bo AI potrzebuje wszystkich domen naraz, a jej próg jakości jest wyższy niż raportu dla ludzi.',
        en: 'Find the weakest critical domain (quality % + governance level) — it sets the whole project’s readiness, because AI needs all domains at once, and its quality bar is higher than a human report’s.',
      },
    },
    {
      rung: 'risk-capability',
      title: {
        pl: 'Ustawić sekwencję: naprawa master data PRZED pilotem AI',
        en: 'Sequence master-data repair BEFORE the AI pilot',
      },
      explanation: {
        pl: 'Zaplanujcie Fazę 0 (naprawa master data + domknięcie rejestru systemów) przed Fazą 1 (pilot AI na czystych danych) — start pilota równolegle na złych danych daje model, który ładnie prognozuje na złym gruncie.',
        en: 'Plan Phase 0 (master-data repair + closing the systems register) before Phase 1 (AI pilot on clean data) — launching the pilot in parallel on bad data yields a model forecasting neatly on bad ground.',
      },
    },
  ],
};
