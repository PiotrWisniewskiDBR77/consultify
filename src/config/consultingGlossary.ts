/**
 * Consulting Terms Glossary (Paczka1 #10)
 *
 * Goal (Spotify-democratization): a non-consultant using the 19 tools / DRD / SIRI / ADMA
 * assessments should never hit a piece of jargon without a plain-language explanation
 * one click/hover away. HBS-consultant quality definitions, PL+EN.
 *
 * This is a plain data module — no React/i18n dependency — so it can be imported from
 * any surface (tooltips, a glossary panel, report generation, chat context, etc.).
 */

export type GlossaryCategory =
  | 'strategy'
  | 'operations'
  | 'finance'
  | 'data-ai'
  | 'prioritization'
  | 'general';

export interface GlossaryTerm {
  /** Stable id, kebab-case, used for lookups/anchors (e.g. "swot"). */
  id: string;
  /** Short display term/acronym, as commonly written (e.g. "SWOT", "MECE"). */
  term: string;
  category: GlossaryCategory;
  /** One or two sentence plain-language definition, no jargon-on-jargon. */
  definition: {
    en: string;
    pl: string;
  };
  /** Optional: alternate names/acronyms that should resolve to this entry. */
  aliases?: string[];
}

export const CONSULTING_GLOSSARY: GlossaryTerm[] = [
  {
    id: 'swot',
    term: 'SWOT',
    category: 'strategy',
    definition: {
      en: 'A simple 2x2 map of your Strengths, Weaknesses (internal) and Opportunities, Threats (external/market). Used to get a quick, shared picture of where you stand before deciding what to do next.',
      pl: 'Prosta mapa 2x2: Mocne i Słabe strony (wewnętrzne) oraz Szanse i Zagrożenia (zewnętrzne/rynkowe). Służy do szybkiego, wspólnego spojrzenia na sytuację firmy, zanim zdecydujecie, co robić dalej.',
    },
  },
  {
    id: 'porters-five-forces',
    term: "Porter's Five Forces",
    category: 'strategy',
    aliases: ['five forces', '5 forces'],
    definition: {
      en: 'A framework for judging how attractive (profitable) an industry is, by looking at 5 pressures: rivalry among competitors, threat of new entrants, threat of substitute products, and the bargaining power of suppliers and of customers.',
      pl: 'Model do oceny, jak atrakcyjna (rentowna) jest branża, poprzez analizę 5 sił: rywalizacji między konkurentami, zagrożenia ze strony nowych graczy, zagrożenia substytutami oraz siły przetargowej dostawców i klientów.',
    },
  },
  {
    id: 'value-chain',
    term: 'Value Chain',
    category: 'strategy',
    definition: {
      en: 'The full sequence of activities a company performs to create and deliver its product or service (e.g. inbound logistics, operations, marketing, service). Used to find exactly where value — or cost — is created along the way.',
      pl: 'Pełna sekwencja działań, jakie firma wykonuje, aby stworzyć i dostarczyć produkt lub usługę (np. logistyka wejściowa, operacje, marketing, serwis). Pomaga znaleźć dokładnie, gdzie po drodze powstaje wartość — albo koszt.',
    },
  },
  {
    id: 'wacc',
    term: 'WACC (Weighted Average Cost of Capital)',
    category: 'finance',
    aliases: ['weighted average cost of capital'],
    definition: {
      en: 'The average rate a company must pay to fund itself, blending the cost of debt (loans) and the cost of equity (shareholder returns expected). Used as the "hurdle rate" — an investment should only be made if it returns more than this.',
      pl: 'Średni koszt, jaki firma musi ponieść, aby się finansować — łącząc koszt długu (kredyty) i koszt kapitału własnego (oczekiwany zwrot dla właścicieli). Używany jako "próg opłacalności" — inwestycję warto zrobić tylko wtedy, gdy zwraca więcej niż ten koszt.',
    },
  },
  {
    id: 'oee',
    term: 'OEE (Overall Equipment Effectiveness)',
    category: 'operations',
    aliases: ['overall equipment effectiveness'],
    definition: {
      en: 'A single percentage score for how well a machine or production line is actually used, combining Availability (uptime), Performance (speed vs. ideal) and Quality (good units vs. total). 100% = perfect production, no losses.',
      pl: 'Jeden wskaźnik procentowy pokazujący, jak dobrze faktycznie wykorzystywana jest maszyna lub linia produkcyjna — łączy Dostępność (czas pracy), Wydajność (szybkość vs. idealna) i Jakość (dobre sztuki vs. wszystkie). 100% = idealna produkcja, brak strat.',
    },
  },
  {
    id: 'mece',
    term: 'MECE (Mutually Exclusive, Collectively Exhaustive)',
    category: 'strategy',
    aliases: ['mutually exclusive collectively exhaustive'],
    definition: {
      en: 'A rule for structuring a list or breakdown so that categories never overlap ("mutually exclusive") and together cover everything relevant ("collectively exhaustive"). Used constantly by consultants to make sure an analysis has no gaps and no double-counting.',
      pl: 'Zasada porządkowania listy lub podziału tak, aby kategorie się nie nakładały ("wzajemnie rozłączne") i razem obejmowały wszystko istotne ("łącznie wyczerpujące"). Konsultanci stosują ją stale, by analiza nie miała luk ani podwójnego liczenia tych samych rzeczy.',
    },
  },
  {
    id: 'impact-effort',
    term: 'Impact x Effort Matrix',
    category: 'prioritization',
    aliases: ['impact effort matrix', 'impact/effort'],
    definition: {
      en: 'A simple 2x2 chart for prioritizing initiatives: how much business impact each one has vs. how much effort it takes. "Quick wins" (high impact, low effort) go first; "money pits" (low impact, high effort) get deprioritized.',
      pl: 'Prosty wykres 2x2 do priorytetyzacji inicjatyw: jak duży wpływ biznesowy ma dana inicjatywa vs. ile wysiłku wymaga. "Szybkie zwycięstwa" (duży wpływ, mały wysiłek) robimy najpierw; "studnie bez dna" (mały wpływ, duży wysiłek) spadają w priorytecie.',
    },
  },
  {
    id: 'fof',
    term: 'FoF (Factory of the Future)',
    category: 'operations',
    aliases: ['factory of the future'],
    definition: {
      en: 'A vision/benchmark for a highly digitized, automated and connected manufacturing plant — where machines, data and people work together in real time. Used as a north star when planning Industry 4.0 investments.',
      pl: 'Wizja/wzorzec wysoko ucyfrowionego, zautomatyzowanego i połączonego zakładu produkcyjnego — gdzie maszyny, dane i ludzie współpracują w czasie rzeczywistym. Używana jako drogowskaz przy planowaniu inwestycji w Przemysł 4.0.',
    },
  },
  {
    id: 'kpi',
    term: 'KPI (Key Performance Indicator)',
    category: 'general',
    aliases: ['key performance indicator'],
    definition: {
      en: 'A specific, measurable number tracked over time to tell you if you are succeeding at a goal (e.g. on-time delivery %, customer churn rate). Good KPIs are few, clear, and tied directly to a decision.',
      pl: 'Konkretna, mierzalna liczba śledzona w czasie, która mówi, czy realizujesz cel (np. % dostaw na czas, wskaźnik odejść klientów). Dobre KPI jest ich niewiele, są jasne i wprost powiązane z jakąś decyzją.',
    },
  },
  {
    id: 'roi',
    term: 'ROI (Return on Investment)',
    category: 'finance',
    aliases: ['return on investment'],
    definition: {
      en: 'How much you get back relative to what you spent, usually as a percentage: (gain − cost) / cost. Used to compare very different initiatives on the same scale.',
      pl: 'Ile zyskujesz w stosunku do tego, ile wydałeś, zwykle jako procent: (zysk − koszt) / koszt. Służy do porównywania bardzo różnych inicjatyw na tej samej skali.',
    },
  },
  {
    id: 'digital-twin',
    term: 'Digital Twin',
    category: 'data-ai',
    definition: {
      en: 'A live, virtual copy of a real machine, process or product, fed by real sensor/system data, used to simulate, monitor or predict what the real thing will do — without touching it.',
      pl: 'Żywa, wirtualna kopia realnej maszyny, procesu lub produktu, zasilana danymi z rzeczywistych czujników/systemów, używana do symulowania, monitorowania lub przewidywania zachowania rzeczywistego obiektu — bez ingerencji w niego.',
    },
  },
  {
    id: 'erp',
    term: 'ERP (Enterprise Resource Planning)',
    category: 'operations',
    aliases: ['enterprise resource planning'],
    definition: {
      en: 'One integrated system that runs core business processes together (finance, sales, purchasing, production, inventory) instead of separate disconnected tools, so data stays consistent across the company.',
      pl: 'Jeden zintegrowany system obsługujący razem kluczowe procesy biznesowe (finanse, sprzedaż, zakupy, produkcja, magazyn) zamiast osobnych, niepołączonych narzędzi — dzięki czemu dane w firmie są spójne.',
    },
  },
  {
    id: 'mes',
    term: 'MES (Manufacturing Execution System)',
    category: 'operations',
    aliases: ['manufacturing execution system'],
    definition: {
      en: 'Software that tracks and controls production on the shop floor in real time — what is being made, by which machine, at what speed, with what quality — sitting between the plant floor and the ERP.',
      pl: 'Oprogramowanie śledzące i sterujące produkcją na hali w czasie rzeczywistym — co jest wytwarzane, na jakiej maszynie, z jaką prędkością i jakością — działające pomiędzy halą produkcyjną a systemem ERP.',
    },
  },
  {
    id: 'wms',
    term: 'WMS (Warehouse Management System)',
    category: 'operations',
    aliases: ['warehouse management system'],
    definition: {
      en: 'Software that manages warehouse operations: where stock is located, how it moves in and out, and how picking/packing tasks are assigned — usually paired with barcode or RFID scanning.',
      pl: 'Oprogramowanie zarządzające operacjami magazynowymi: gdzie znajduje się towar, jak się przemieszcza, jak przydzielane są zadania kompletacji/pakowania — zwykle powiązane ze skanowaniem kodów kreskowych lub RFID.',
    },
  },
  {
    id: 'crm',
    term: 'CRM (Customer Relationship Management)',
    category: 'operations',
    aliases: ['customer relationship management'],
    definition: {
      en: 'A system for tracking every interaction with customers and prospects (calls, emails, deals, support tickets) in one place, so sales and service teams work from the same up-to-date picture of the relationship.',
      pl: 'System śledzący każdą interakcję z klientami i potencjalnymi klientami (rozmowy, e-maile, transakcje, zgłoszenia) w jednym miejscu, dzięki czemu zespoły sprzedaży i obsługi pracują na tym samym, aktualnym obrazie relacji.',
    },
  },
  {
    id: 'rpa',
    term: 'RPA (Robotic Process Automation)',
    category: 'data-ai',
    aliases: ['robotic process automation'],
    definition: {
      en: 'Software "bots" that mimic repetitive manual computer tasks (copying data between systems, filling forms) without changing the underlying systems — a fast way to automate before a bigger system upgrade.',
      pl: '"Roboty" programowe naśladujące powtarzalne, ręczne czynności komputerowe (przenoszenie danych między systemami, wypełnianie formularzy) bez zmiany systemów źródłowych — szybki sposób na automatyzację przed większą modernizacją.',
    },
  },
  {
    id: 'digital-maturity',
    term: 'Digital Maturity',
    category: 'general',
    definition: {
      en: 'How far an organization has progressed from manual, ad-hoc ways of working toward digitized, integrated, data-driven and (eventually) AI-supported ways of working. Assessed level by level, not as a yes/no state.',
      pl: 'Jak daleko organizacja przeszła od ręcznych, doraźnych sposobów pracy w kierunku pracy ucyfrowionej, zintegrowanej, opartej na danych i (docelowo) wspieranej przez AI. Oceniana poziom po poziomie, a nie jako stan tak/nie.',
    },
  },
  {
    id: 'gap-analysis',
    term: 'Gap Analysis',
    category: 'strategy',
    definition: {
      en: 'Comparing where you are now ("as-is") to where you want to be ("to-be") to see exactly what is missing — the "gap" — which becomes the basis for an action plan.',
      pl: 'Porównanie stanu obecnego ("as-is") z pożądanym stanem docelowym ("to-be"), aby dokładnie zobaczyć, czego brakuje — czyli "lukę" — która staje się podstawą planu działań.',
    },
  },
  {
    id: 'benchmark',
    term: 'Benchmark',
    category: 'strategy',
    definition: {
      en: "A reference point — often an industry average or a best-in-class competitor — used to judge whether your own performance is good, average, or lagging.",
      pl: 'Punkt odniesienia — często średnia branżowa lub najlepszy konkurent — używany do oceny, czy Twoje wyniki są dobre, przeciętne, czy słabsze od rynku.',
    },
  },
  {
    id: 'business-case',
    term: 'Business Case',
    category: 'finance',
    definition: {
      en: 'A structured argument for why an initiative is worth doing: expected costs, expected benefits, risks, and the timeline to pay back the investment — used to get buy-in and funding.',
      pl: 'Uporządkowane uzasadnienie, dlaczego warto zrealizować daną inicjatywę: oczekiwane koszty, korzyści, ryzyka i czas zwrotu inwestycji — używane do uzyskania akceptacji i finansowania.',
    },
  },
  {
    id: 'north-star-metric',
    term: 'North Star Metric',
    category: 'strategy',
    aliases: ['north star'],
    definition: {
      en: 'The single metric that best captures the core value your product/business delivers to customers, used to align teams around one shared measure of success instead of dozens of competing KPIs.',
      pl: 'Jeden wskaźnik, który najlepiej oddaje kluczową wartość, jaką produkt/biznes dostarcza klientom — używany do zjednoczenia zespołów wokół jednej wspólnej miary sukcesu zamiast dziesiątek konkurujących ze sobą KPI.',
    },
  },
  {
    id: 'roadmap',
    term: 'Roadmap',
    category: 'general',
    definition: {
      en: 'A visual, time-ordered plan showing which initiatives happen when (e.g. this quarter, next 6 months, next year), used to sequence work and communicate priorities.',
      pl: 'Wizualny plan uporządkowany w czasie, pokazujący, kiedy realizowane są poszczególne inicjatywy (np. w tym kwartale, w ciągu 6 miesięcy, w przyszłym roku), używany do sekwencjonowania prac i komunikowania priorytetów.',
    },
  },
  {
    id: 'change-management',
    term: 'Change Management',
    category: 'general',
    definition: {
      en: 'The discipline of helping people actually adopt a new process, tool, or way of working — through communication, training and addressing resistance — because technology alone rarely changes behavior.',
      pl: 'Dyscyplina pomagająca ludziom realnie przyjąć nowy proces, narzędzie czy sposób pracy — poprzez komunikację, szkolenia i adresowanie oporu — ponieważ sama technologia rzadko zmienia zachowania.',
    },
  },
  {
    id: 'quick-win',
    term: 'Quick Win',
    category: 'prioritization',
    definition: {
      en: 'An initiative that delivers visible value fast and with little effort — used early in a transformation to build momentum and credibility before tackling bigger, slower initiatives.',
      pl: 'Inicjatywa, która szybko i niewielkim wysiłkiem przynosi widoczną wartość — stosowana na wczesnym etapie transformacji, by zbudować impet i wiarygodność przed podjęciem większych, wolniejszych inicjatyw.',
    },
  },
  {
    id: 'data-governance',
    term: 'Data Governance',
    category: 'data-ai',
    definition: {
      en: 'The rules and responsibilities for who owns data, how it is defined, kept accurate, and who is allowed to access or change it — the foundation that makes analytics and AI trustworthy.',
      pl: 'Zasady i odpowiedzialności dotyczące tego, kto jest właścicielem danych, jak są definiowane, utrzymywane w poprawności i kto ma prawo je przeglądać lub zmieniać — fundament, który czyni analitykę i AI wiarygodnymi.',
    },
  },
  {
    id: 'iot',
    term: 'IoT (Internet of Things)',
    category: 'data-ai',
    aliases: ['internet of things'],
    definition: {
      en: 'Physical devices (sensors, machines, products) connected to the internet/network so they can send data and, sometimes, be controlled remotely — the raw data source behind most Industry 4.0 use cases.',
      pl: 'Fizyczne urządzenia (czujniki, maszyny, produkty) podłączone do internetu/sieci, dzięki czemu mogą przesyłać dane, a czasem być zdalnie sterowane — surowe źródło danych dla większości zastosowań Przemysłu 4.0.',
    },
  },
];

const GLOSSARY_BY_ID: Map<string, GlossaryTerm> = new Map(
  CONSULTING_GLOSSARY.map((t) => [t.id, t])
);

const GLOSSARY_BY_ALIAS: Map<string, GlossaryTerm> = new Map();
for (const term of CONSULTING_GLOSSARY) {
  GLOSSARY_BY_ALIAS.set(term.term.toLowerCase(), term);
  for (const alias of term.aliases || []) {
    GLOSSARY_BY_ALIAS.set(alias.toLowerCase(), term);
  }
}

export function getGlossaryTermById(id: string): GlossaryTerm | undefined {
  return GLOSSARY_BY_ID.get(id);
}

/** Looks up a term by its display name or any known alias (case-insensitive). */
export function findGlossaryTerm(nameOrAlias: string): GlossaryTerm | undefined {
  const key = String(nameOrAlias || '').toLowerCase().trim();
  return GLOSSARY_BY_ALIAS.get(key) || GLOSSARY_BY_ID.get(key);
}

export function getGlossaryByCategory(category: GlossaryCategory): GlossaryTerm[] {
  return CONSULTING_GLOSSARY.filter((t) => t.category === category);
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  'strategy',
  'operations',
  'finance',
  'data-ai',
  'prioritization',
  'general',
];
