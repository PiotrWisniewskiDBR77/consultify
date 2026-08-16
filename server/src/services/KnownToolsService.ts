import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import { QueryAdapter } from '../utils/QueryAdapter.js';
import { APPROVED_MVP_TOOL_TYPES } from './toolCatalog/approvedMvpToolTypes.js';
import { mergeLibraryContentJson } from './libraryContentMerge.js';

type ToolRow = {
  id: string;
  name: string;
  tool_type?: string | null;
  display_name: string;
  category: string;
  library_category?: string | null;
  description?: string | null;
  description_translations?: string | null;
  library_content_translations?: string | null;
  icon?: string | null;
  is_licensed?: number | null;
  is_active?: number | null;
  is_coming_soon?: number | null;
  tags_json?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

export type KnownToolListItem = {
  id: string;
  toolType: string;
  name: string;
  libraryCategory: string | null;
  description: string;
  whatYouGet: string[];
  tags: string[];
  icon: string | null;
  isLicensed: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  createdAt: string | null;
};

export type KnownToolDetail = KnownToolListItem & {
  whenToUse: string;
  inputs: string[];
  steps: string[];
  outputs: string[];
  commonMistakes: string[];
  example: string;
  nextSteps: string[];
  kbArticleSlug: string;
};

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeLanguage(lang: string | undefined): 'en' | 'pl' {
  return lang === 'pl' ? 'pl' : 'en';
}

function pickTranslation(
  rawTranslationsJson: string | null | undefined,
  lang: 'en' | 'pl',
  fallback: string
): string {
  const translations = safeJsonParse<Record<string, string>>(rawTranslationsJson, {});
  return translations[lang] || translations.en || fallback;
}

function pickLibraryContent(rawJson: string | null | undefined, lang: 'en' | 'pl') {
  const translations = safeJsonParse<Record<string, unknown>>(rawJson, {});
  const en =
    translations?.en && typeof translations.en === 'object' ? (translations.en as object) : {};
  const picked =
    translations?.[lang] && typeof translations[lang] === 'object'
      ? (translations[lang] as object)
      : {};
  return { ...(en as Record<string, unknown>), ...(picked as Record<string, unknown>) };
}

function getFallbackLibraryContent(toolType: string, lang: 'en' | 'pl') {
  if (toolType === 'dynamic-swot') {
    return lang === 'pl'
      ? {
          whatYouGet: [
            'Decision-grade diagnozę sytuacji i pola decyzji',
            'Napięcia strategiczne z widoczną logiką evidence',
            'Rekomendowane ruchy, ich kolejność i sens biznesowy',
            'Źródło do raportu, decka, inicjatyw i dalszej eksploracji',
          ],
          whenToUse:
            'Użyj Dynamic SWOT, gdy musisz zamienić rozproszoną rozmowę strategiczną w uporządkowaną diagnozę, zderzyć realia wewnętrzne z rynkiem i dojść do jasnej decyzji, a nie tylko do długiej listy obserwacji.',
          inputs: [
            'Pytanie strategiczne, które naprawdę ma zostać rozstrzygnięte',
            'Zakres, horyzont czasu, success signal i constraints',
            'Sygnały wewnętrzne i zewnętrzne: fakty, obserwacje i hipotezy',
            'Pliki, linki, benchmarki, wcześniejsze analizy lub notatki',
          ],
          steps: [
            'Ustal mission brief: decyzję, zakres, success signal, horyzont i ograniczenia',
            'Zbierz evidence i sygnały z wnętrza firmy, materiałów oraz z rynku',
            'Przejdź drabinkowy wywiad per kwadrant: pytania poziomowane z rozgałęzieniami odróżniają siłę niszową od core competency i wymuszają dowód albo jawną deklarację',
            'Każdy element macierzy niesie drabinę wniosku: fakt z sesji, interpretacja biznesowa i implikacja dla decyzji; tezy parasolowe (np. „brak zwinności") są dekomponowane na procesy, narzędzia, kompetencje i bodźce',
            'Napięcia SO/WO/ST/WT liczone są z zaakceptowanych elementów — attack, repair, defend, protect z jawnymi powiązaniami',
            'Każdy rekomendowany ruch ma rationale, obowiązkowy trade-off (co odkładamy i kosztem czego) oraz odrzucony wariant z powodem',
            'Zamknij sesję werdyktem answer-first i source summary gotowym do raportu, decka i inicjatyw',
          ],
          outputs: [
            'Executive summary sytuacji, pytania decyzyjnego i logiki wyboru',
            'Rekomendowane ruchy strategiczne z priorytetami i sekwencją',
            'Source summary do raportu, prezentacji lub briefu sponsorskiego',
            'Kandydatów na inicjatywy, dalsze pomysły i kolejne analizy',
          ],
          commonMistakes: [
            'Wpisywanie ogólników zamiast krótkich, konkretnych sygnałów',
            'Mieszanie faktów, obserwacji i hipotez bez oznaczenia jakości evidence',
            'Sprzedawanie siły niszowej jako core competency — bez testu zasięgu i kopiowalności',
            'Traktowanie macierzy SWOT jako końca pracy zamiast etapu przejścia do napięć i ruchów',
            'Rekomendacje bez trade-offu i odrzuconego wariantu — lista życzeń zamiast decyzji',
            'Proponowanie inwestycji lub CAPEX-u zanim wiadomo, gdzie naprawdę leży problem',
          ],
          example:
            'Przykład: firma premium po kryzysie marży rozważa kosztowną automatyzację. Dynamic SWOT pokazuje, że sednem problemu nie jest jeszcze brak technologii, ale brak wspólnej diagnozy strat, priorytetów i realnych wąskich gardeł. Efektem są napięcia strategiczne, kolejność ruchów i materiał gotowy do decyzji zarządu.',
          nextSteps: [
            'Uruchom sesję od ostrego mission briefu, nie od samej macierzy',
            'Zbieraj sygnały w trybie evidence-first i czyść ogólniki razem z AI',
            'Domknij napięcia oraz ruchy zanim przejdziesz do outputów',
            'Wygeneruj raport, deck, brief inicjatywy albo dalsze artefakty z jednego źródła prawdy',
          ],
        }
      : {
          whatYouGet: [
            'A decision-grade diagnosis of the situation and choice space',
            'Strategic tensions with visible evidence logic',
            'Recommended moves, sequencing, and business rationale',
            'A source package for reports, decks, initiatives, and follow-on exploration',
          ],
          whenToUse:
            'Use Dynamic SWOT when you need to turn a fragmented strategic conversation into a structured diagnosis, connect internal reality with market evidence, and arrive at a clear choice rather than a long list of observations.',
          inputs: [
            'The strategic question that truly needs a decision',
            'Scope, time horizon, success signal, and key constraints',
            'Internal and external signals: facts, observations, and hypotheses',
            'Files, links, benchmarks, and prior analyses or notes',
          ],
          steps: [
            'Define the mission brief: decision, scope, success signal, time horizon, and constraints',
            'Collect evidence and signals from inside the company, from materials, and from the market',
            'Run the laddered interview per quadrant: leveled, branching questions separate a niche strength from a core competency and force proof or an explicit "declared, unconfirmed"',
            'Every matrix element carries an insight staircase: session fact, business interpretation, and decision implication; umbrella claims (e.g. "lack of agility") are decomposed into process, tools, skills, and incentives',
            'SO/WO/ST/WT tensions are computed from accepted elements — attack, repair, defend, protect with explicit item links',
            'Every recommended move carries a rationale, a mandatory trade-off (what we defer and at what cost), and a rejected alternative with a reason',
            'Close with an answer-first verdict and a source summary ready for reports, decks, and initiatives',
          ],
          outputs: [
            'An executive summary of the situation, the decision question, and the choice logic',
            'Recommended strategic moves with priorities and sequence',
            'A source summary for a report, presentation, or sponsor brief',
            'Initiative candidates, follow-on ideas, and next analyses',
          ],
          commonMistakes: [
            'Writing generic statements instead of short evidence-backed signals',
            'Mixing facts, observations, and hypotheses without marking evidence quality',
            'Selling a niche strength as a core competency — without testing scope and imitability',
            'Treating the SWOT matrix as the finish line instead of a bridge to tensions and moves',
            'Recommendations without a trade-off and a rejected alternative — a wish list, not a decision',
            'Jumping to investments or CAPEX before understanding the real problem',
          ],
          example:
            'Example: a premium company facing margin pressure is considering expensive automation. Dynamic SWOT shows that the real issue is not missing technology yet, but the absence of a shared diagnosis of losses, priorities, and bottlenecks. The output is a set of tensions, a move sequence, and a board-ready narrative.',
          nextSteps: [
            'Start from a sharp mission brief, not from the matrix itself',
            'Use AI to clean signals and strengthen evidence quality',
            'Close tensions and moves before jumping into outputs',
            'Generate a report, deck, initiative brief, or follow-on artifacts from one source of truth',
          ],
        };
  }

  return {};
}

type SeedKnownTool = {
  id: string;
  toolType: string;
  displayName: string;
  libraryCategory: 'strategic' | 'operational' | 'digital' | 'automation';
  descriptionEn: string;
  descriptionPl: string;
  whatYouGetEn: string[];
  whatYouGetPl: string[];
  tags: string[];
  icon: string | null;
  sortOrder: number;
  /** When true the tool shows a "Coming soon" badge and cannot be launched. */
  isComingSoon?: boolean;
};

// Compatibility export for existing callers. The owner-approved MVP registry is
// the single source of truth: only tools with a provenance/rights packet may be
// launchable. Seed rows outside this set remain visible as coming-soon but the
// session writer fails closed even if their database is_active flag is true.
export const ACTIVE_KNOWN_TOOL_TYPES = new Set<string>(APPROVED_MVP_TOOL_TYPES);

export const SQLITE_KNOWN_TOOLS_SEED: SeedKnownTool[] = [
  {
    id: 'tool-known-dynamic-swot',
    toolType: 'dynamic-swot',
    displayName: 'Dynamic SWOT',
    libraryCategory: 'strategic',
    descriptionEn:
      'AI-guided strategic SWOT that starts with conversation and ends with tensions, moves, and traceable outputs.',
    descriptionPl:
      'SWOT prowadzony przez AI, który zaczyna się rozmową i kończy napięciami strategicznymi, ruchami oraz traceable outputami.',
    whatYouGetEn: [
      'Strategic tensions',
      'Recommended moves',
      'Initiative and idea candidates',
      'Report and presentation path',
    ],
    whatYouGetPl: [
      'Napięcia strategiczne',
      'Rekomendowane ruchy',
      'Kandydaci na inicjatywy i pomysły',
      'Ścieżka do raportu i prezentacji',
    ],
    tags: ['strategy', 'swot', 'diagnosis'],
    icon: 'Target',
    sortOrder: 101,
  },
  {
    id: 'tool-known-market-forces',
    toolType: 'market-forces',
    displayName: 'Market Forces (Porter)',
    libraryCategory: 'strategic',
    descriptionEn:
      'AI-guided Porter analysis that turns market structure into applied conclusions, strategic levers, and downstream outputs.',
    descriptionPl:
      'Analiza 5 sił Portera prowadzona przez AI, która zamienia strukturę rynku w praktyczne wnioski, dźwignie strategiczne i dalsze outputy.',
    whatYouGetEn: ['Force scorecard', 'Applied conclusions', 'Initiative, report, and deck path'],
    whatYouGetPl: [
      'Scorecard 5 sił',
      'Wnioski praktyczne',
      'Ścieżka do inicjatywy, raportu i decka',
    ],
    tags: ['strategy', 'porter', 'competition'],
    icon: 'TrendingUp',
    sortOrder: 102,
  },
  {
    id: 'tool-known-growth-paths',
    toolType: 'growth-paths',
    displayName: 'Growth Paths (Ansoff)',
    libraryCategory: 'strategic',
    descriptionEn:
      'AI-guided Ansoff workflow that compares growth options, frames risk, and prepares presentation-ready recommendations.',
    descriptionPl:
      'Przepływ Ansoffa prowadzony przez AI, który porównuje opcje wzrostu, ramuje ryzyko i przygotowuje rekomendacje gotowe do prezentacji.',
    whatYouGetEn: ['Option map', 'Applied conclusions', 'Initiative, report, and deck path'],
    whatYouGetPl: ['Mapa opcji', 'Wnioski praktyczne', 'Ścieżka do inicjatywy, raportu i decka'],
    tags: ['strategy', 'ansoff', 'growth'],
    icon: 'ArrowRight',
    sortOrder: 103,
  },
  {
    id: 'tool-known-value-chain',
    toolType: 'value-chain',
    displayName: 'Value Chain Analysis',
    libraryCategory: 'strategic',
    descriptionEn:
      'Map activities and identify cost/value drivers to target improvements and initiatives.',
    descriptionPl: 'Mapa łańcucha wartości i identyfikacja dźwigni kosztu/wartości pod inicjatywy.',
    whatYouGetEn: ['Activity map', 'Hotspots', 'Draft initiatives'],
    whatYouGetPl: ['Mapa aktywności', 'Hotspoty', 'Draft inicjatyw'],
    tags: ['strategy', 'value-chain', 'operating-model'],
    icon: 'Map',
    sortOrder: 104,
    isComingSoon: false,
  },
  {
    id: 'tool-known-portfolio-priority',
    toolType: 'portfolio-priority',
    displayName: 'Portfolio Prioritization',
    libraryCategory: 'strategic',
    descriptionEn:
      'AI-guided prioritization that turns portfolio discussion into explicit trade-offs, top bets, and traceable outputs.',
    descriptionPl:
      'Priorytetyzacja prowadzona przez AI, która zamienia rozmowę o portfolio w jawne trade-offy, top bety i traceable outputy.',
    whatYouGetEn: ['Priority matrix', 'Trade-off view', 'Initiative, report, and idea path'],
    whatYouGetPl: [
      'Macierz priorytetów',
      'Widok trade-offów',
      'Ścieżka do inicjatywy, raportu i idei',
    ],
    tags: ['strategy', 'prioritization', 'portfolio'],
    icon: 'ListTodo',
    sortOrder: 105,
  },
  {
    id: 'tool-known-risk-uncertainty',
    toolType: 'risk-uncertainty',
    displayName: 'Risk & Uncertainty',
    libraryCategory: 'strategic',
    descriptionEn:
      'AI-guided risk framing that structures assumptions, scenarios, and mitigations before decisions and outputs are created.',
    descriptionPl:
      'Ramowanie ryzyk prowadzone przez AI, które porządkuje założenia, scenariusze i mitigacje przed decyzjami oraz tworzeniem outputów.',
    whatYouGetEn: ['Risk register', 'Scenario view', 'Initiative, report, and idea path'],
    whatYouGetPl: ['Rejestr ryzyk', 'Widok scenariuszy', 'Ścieżka do inicjatywy, raportu i idei'],
    tags: ['strategy', 'risk', 'uncertainty'],
    icon: 'AlertTriangle',
    sortOrder: 106,
  },
  {
    id: 'tool-known-capability-mapper',
    toolType: 'capability-mapper',
    displayName: 'Capability Mapper',
    libraryCategory: 'strategic',
    descriptionEn:
      'Map capabilities, maturity, and gaps to build a focused transformation roadmap.',
    descriptionPl: 'Mapa kompetencji i luk do zbudowania ukierunkowanego roadmapu transformacji.',
    whatYouGetEn: ['Capability map', 'Gap analysis', 'Draft initiatives'],
    whatYouGetPl: ['Mapa kompetencji', 'Analiza luk', 'Draft inicjatyw'],
    tags: ['strategy', 'capabilities', 'roadmap'],
    icon: 'Users',
    sortOrder: 107,
    isComingSoon: false,
  },
  {
    id: 'tool-known-ambition-decomposer',
    toolType: 'ambition-decomposer',
    displayName: 'Ambition Decomposer',
    libraryCategory: 'strategic',
    descriptionEn: 'Translate vision into measurable dimensions, targets, and initiative clusters.',
    descriptionPl: 'Przełóż wizję na mierzalne wymiary, cele i klastry inicjatyw.',
    whatYouGetEn: ['Ambition tree', 'Targets & metrics', 'Initiative themes'],
    whatYouGetPl: ['Drzewo ambicji', 'Cele i metryki', 'Tematy inicjatyw'],
    tags: ['strategy', 'targets', 'roadmap'],
    icon: 'Target',
    sortOrder: 108,
    isComingSoon: false,
  },
  {
    id: 'tool-known-focus-tradeoff',
    toolType: 'focus-tradeoff',
    displayName: 'Focus & Trade-offs',
    libraryCategory: 'strategic',
    descriptionEn: 'Make trade-offs explicit and decide what NOT to do.',
    descriptionPl: 'Uczyń trade-offy jawne i zdecyduj czego NIE robić.',
    whatYouGetEn: ['Trade-off map', 'Stop-doing list', 'Decision rationale'],
    whatYouGetPl: ['Mapa trade-offów', 'Lista stop-doing', 'Uzasadnienie decyzji'],
    tags: ['strategy', 'tradeoffs', 'focus'],
    icon: 'GitBranch',
    sortOrder: 109,
    isComingSoon: false,
  },
  {
    id: 'tool-known-narrative-engine',
    toolType: 'narrative-engine',
    displayName: 'Narrative & Alignment',
    libraryCategory: 'strategic',
    descriptionEn: 'Create a coherent strategy narrative and test alignment.',
    descriptionPl: 'Zbuduj spójną narrację strategii i sprawdź alignment.',
    whatYouGetEn: ['Storyline outline', 'Alignment checklist', 'Messaging gaps'],
    whatYouGetPl: ['Szkic narracji', 'Checklist alignmentu', 'Luki w komunikacji'],
    tags: ['strategy', 'narrative', 'alignment'],
    icon: 'FileText',
    sortOrder: 110,
    isComingSoon: false,
  },
  {
    id: 'tool-known-sop-builder',
    toolType: 'sop-builder',
    displayName: 'SOP Builder',
    libraryCategory: 'operational',
    descriptionEn:
      'Create clear standard operating procedures that improve repeatability and quality.',
    descriptionPl: 'Tworzenie SOP (standardów pracy) zwiększających powtarzalność i jakość.',
    whatYouGetEn: ['SOP draft', 'Checklist', 'Training-ready steps'],
    whatYouGetPl: ['Draft SOP', 'Checklist', 'Kroki do szkolenia'],
    tags: ['operations', 'sop', 'standard-work'],
    icon: 'CheckCircle2',
    sortOrder: 203,
  },
  {
    id: 'tool-known-a3-problem-solving',
    toolType: 'a3-problem-solving',
    displayName: 'A3 Problem Solving',
    libraryCategory: 'operational',
    descriptionEn: 'A3/PDCA problem solving translated into a concrete improvement plan.',
    descriptionPl: 'Rozwiązywanie problemów A3/PDCA przełożone na konkretny plan usprawnień.',
    whatYouGetEn: ['A3 summary', 'Root causes', 'Countermeasures'],
    whatYouGetPl: ['Podsumowanie A3', 'Przyczyny źródłowe', 'Countermeasures'],
    tags: ['operations', 'a3', 'root-cause'],
    icon: 'FileText',
    sortOrder: 201,
  },
  {
    id: 'tool-known-vsm-builder',
    toolType: 'vsm-builder',
    displayName: 'VSM Builder',
    libraryCategory: 'operational',
    descriptionEn: 'Value Stream Mapping to visualize flow, waste, and improvement priorities.',
    descriptionPl:
      'Mapowanie strumienia wartości (VSM) do wizualizacji przepływu, marnotrawstw i priorytetów usprawnień.',
    whatYouGetEn: ['Current-state map', 'Waste hotspots', 'Future-state actions'],
    whatYouGetPl: ['Mapa stanu obecnego', 'Hotspoty marnotrawstw', 'Akcje stanu przyszłego'],
    tags: ['operations', 'lean', 'vsm'],
    icon: 'Workflow',
    sortOrder: 202,
    isComingSoon: true,
  },
  // Toolsets from Bundle 05 (T022–T024) — keep short/usable for SQLite demo
  {
    id: 'tool-known-constraint-control',
    toolType: 'constraint-control',
    displayName: 'Constraint Control (TOC)',
    libraryCategory: 'operational',
    descriptionEn: 'Identify and manage the system constraint to improve throughput and delivery.',
    descriptionPl:
      'Identyfikuj i zarządzaj wąskim gardłem (TOC), aby poprawić przepustowość i terminowość.',
    whatYouGetEn: ['Constraint hypothesis', 'Buffer policy', 'Action list'],
    whatYouGetPl: ['Hipoteza constraintu', 'Polityka buforów', 'Lista działań'],
    tags: ['operations', 'toc', 'throughput'],
    icon: 'Shield',
    sortOrder: 204,
    isComingSoon: true,
  },
  {
    id: 'tool-known-decision-engine',
    toolType: 'decision-engine',
    displayName: 'Decision Engine',
    libraryCategory: 'operational',
    descriptionEn: 'Make trade-offs explicit with criteria, weights, and defensible decisions.',
    descriptionPl: 'Uczyń trade-offy jawne przez kryteria, wagi i obronne decyzje.',
    whatYouGetEn: ['Criteria set', 'Scored options', 'Decision rationale'],
    whatYouGetPl: ['Zestaw kryteriów', 'Scoring opcji', 'Uzasadnienie decyzji'],
    tags: ['operations', 'decision', 'prioritization'],
    icon: 'GitBranch',
    sortOrder: 205,
    isComingSoon: true,
  },
  {
    id: 'tool-known-control-tower',
    toolType: 'control-tower',
    displayName: 'Control Tower',
    libraryCategory: 'operational',
    descriptionEn: 'Build an operational control tower: KPIs, thresholds, ownership, and cadence.',
    descriptionPl: 'Zbuduj control tower: KPI, progi, ownership i rytm zarządzania.',
    whatYouGetEn: ['KPI set', 'Thresholds', 'Operating cadence'],
    whatYouGetPl: ['Zestaw KPI', 'Progi', 'Cadence'],
    tags: ['operations', 'kpi', 'governance'],
    icon: 'Radar',
    sortOrder: 206,
    isComingSoon: true,
  },
  {
    id: 'tool-known-automation-pipeline',
    toolType: 'automation-pipeline',
    displayName: 'Automation Pipeline',
    libraryCategory: 'operational',
    descriptionEn: 'Create a repeatable pipeline for spotting, sizing, and delivering automation.',
    descriptionPl: 'Zbuduj powtarzalny pipeline wykrywania, sizingu i dostarczania automatyzacji.',
    whatYouGetEn: ['Automation backlog', 'Sizing rules', 'Delivery checklist'],
    whatYouGetPl: ['Backlog automatyzacji', 'Reguły sizingu', 'Checklist delivery'],
    tags: ['operations', 'automation', 'pipeline'],
    icon: 'Zap',
    sortOrder: 207,
    isComingSoon: true,
  },
  {
    id: 'tool-known-smed-planner',
    toolType: 'smed-planner',
    displayName: 'SMED Planner',
    libraryCategory: 'operational',
    descriptionEn:
      'Reduce changeover time by classifying steps and converting internal to external.',
    descriptionPl:
      'Redukuj czas przezbrojenia przez klasyfikację kroków i konwersję internal→external.',
    whatYouGetEn: ['Step list (internal/external)', 'Conversion plan', 'Improvement backlog'],
    whatYouGetPl: ['Lista kroków (internal/external)', 'Plan konwersji', 'Backlog usprawnień'],
    tags: ['operations', 'smed', 'setup'],
    icon: 'Clock',
    sortOrder: 208,
  },
  {
    id: 'tool-known-dms-builder',
    toolType: 'dms-builder',
    displayName: 'Daily Management System',
    libraryCategory: 'operational',
    descriptionEn:
      'Define daily/weekly cadence, KPIs, and escalation to drive predictable execution.',
    descriptionPl: 'Zdefiniuj rytm daily/weekly, KPI i eskalację dla przewidywalnej realizacji.',
    whatYouGetEn: ['Tier cadence', 'KPI board', 'Escalation rules'],
    whatYouGetPl: ['Cadence tierów', 'Tablica KPI', 'Reguły eskalacji'],
    tags: ['operations', 'cadence', 'kpi'],
    icon: 'Radar',
    sortOrder: 209,
  },
  {
    id: 'tool-known-inventory-autopilot',
    toolType: 'inventory-autopilot',
    displayName: 'Inventory Autopilot',
    libraryCategory: 'operational',
    descriptionEn: 'Define replenishment policies and simulate cash/stockout trade-offs.',
    descriptionPl: 'Zdefiniuj polityki uzupełnień i zasymuluj trade-off cash/stockout.',
    whatYouGetEn: ['SKU segmentation', 'Policy table', 'Simulation assumptions'],
    whatYouGetPl: ['Segmentacja SKU', 'Tabela polityk', 'Założenia symulacji'],
    tags: ['operations', 'inventory', 'policy'],
    icon: 'Boxes',
    sortOrder: 210,
  },
  // Digital examples (T023)
  {
    id: 'tool-known-robotics-feasibility',
    toolType: 'robotics-feasibility',
    displayName: 'Robotics Feasibility',
    libraryCategory: 'digital',
    descriptionEn: 'Assess feasibility, prerequisites, and ROI for robotics in operations.',
    descriptionPl: 'Oceń wykonalność, prerekwizyty i ROI robotyki w operacjach.',
    whatYouGetEn: ['Feasibility score', 'Prerequisites', 'Pilot plan'],
    whatYouGetPl: ['Feasibility score', 'Prerekwizyty', 'Plan pilota'],
    tags: ['digital', 'robotics', 'automation'],
    icon: 'Bot',
    sortOrder: 301,
    isComingSoon: true,
  },
  {
    id: 'tool-known-logistics-automation',
    toolType: 'logistics-automation',
    displayName: 'Logistics Automation',
    libraryCategory: 'digital',
    descriptionEn: 'Identify automation opportunities across warehousing and logistics flows.',
    descriptionPl: 'Zidentyfikuj możliwości automatyzacji w magazynie i logistyce.',
    whatYouGetEn: ['Opportunity map', 'Prerequisites', 'Roadmap'],
    whatYouGetPl: ['Mapa okazji', 'Prerekwizyty', 'Roadmapa'],
    tags: ['digital', 'logistics', 'warehouse'],
    icon: 'Truck',
    sortOrder: 302,
    isComingSoon: true,
  },
  {
    id: 'tool-known-rpa-scanner',
    toolType: 'rpa-scanner',
    displayName: 'RPA Scanner',
    libraryCategory: 'digital',
    descriptionEn: 'Scan processes for RPA suitability and build a prioritized automation backlog.',
    descriptionPl: 'Skanuj procesy pod RPA i zbuduj priorytetyzowany backlog automatyzacji.',
    whatYouGetEn: ['Candidate list', 'Sizing fields', 'Backlog'],
    whatYouGetPl: ['Lista kandydatów', 'Sizing', 'Backlog'],
    tags: ['digital', 'rpa', 'backoffice'],
    icon: 'Scan',
    sortOrder: 303,
  },
  {
    id: 'tool-known-ai-discovery',
    toolType: 'ai-discovery',
    displayName: 'AI Discovery',
    libraryCategory: 'digital',
    descriptionEn:
      'Identify AI use-cases, prerequisites, and risk controls to move from idea to pilot.',
    descriptionPl: 'Zidentyfikuj use-case’y AI, prerekwizyty i kontrolę ryzyk — od idei do pilota.',
    whatYouGetEn: ['Use-case shortlist', 'Prerequisites', 'Pilot plan'],
    whatYouGetPl: ['Shortlista use-case', 'Prerekwizyty', 'Plan pilota'],
    tags: ['digital', 'ai', 'use-cases'],
    icon: 'Sparkles',
    sortOrder: 304,
  },
  {
    id: 'tool-known-integration-diagnostic',
    toolType: 'integration-diagnostic',
    displayName: 'Integration Diagnostic',
    libraryCategory: 'digital',
    descriptionEn: 'Map integration debt and build an architecture remediation roadmap.',
    descriptionPl: 'Zmapuj dług integracyjny i zbuduj roadmapę naprawy architektury.',
    whatYouGetEn: ['Integration debt map', 'Architecture roadmap', 'Priority actions'],
    whatYouGetPl: ['Mapa długu integracyjnego', 'Roadmapa architektury', 'Priorytetowe akcje'],
    tags: ['digital', 'integration', 'architecture'],
    icon: 'Network',
    sortOrder: 305,
    isComingSoon: true,
  },
  {
    id: 'tool-known-digital-value-pool',
    toolType: 'digital-value-pool',
    displayName: 'Digital Value Pool',
    libraryCategory: 'digital',
    descriptionEn: 'Identify where digital changes the economics of the business.',
    descriptionPl: 'Wskaż, gdzie cyfryzacja zmienia ekonomię biznesu.',
    whatYouGetEn: ['Value pool map', 'Economic levers', 'Initiative shortlist'],
    whatYouGetPl: ['Mapa pul wartości', 'Dźwignie ekonomiczne', 'Shortlista inicjatyw'],
    tags: ['digital', 'value', 'economics'],
    icon: 'DollarSign',
    sortOrder: 306,
    isComingSoon: true,
  },
  {
    id: 'tool-known-legacy-analyzer',
    toolType: 'legacy-analyzer',
    displayName: 'Legacy Analyzer',
    libraryCategory: 'digital',
    descriptionEn: 'Quantify the drag of legacy systems on speed, cost, and risk.',
    descriptionPl: 'Zmierz obciążenie legacy systemów na szybkość, koszt i ryzyko.',
    whatYouGetEn: ['Legacy drag scorecard', 'Risk heatmap', 'Modernization backlog'],
    whatYouGetPl: ['Scorecard obciążenia legacy', 'Heatmapa ryzyk', 'Backlog modernizacji'],
    tags: ['digital', 'legacy', 'modernization'],
    icon: 'HardDrive',
    sortOrder: 307,
    isComingSoon: true,
  },
  {
    id: 'tool-known-data-inventory',
    toolType: 'data-inventory',
    displayName: 'Data Inventory',
    libraryCategory: 'digital',
    descriptionEn: 'Map decisions to data needs and identify gaps in availability and quality.',
    descriptionPl: 'Zmapuj decyzje na potrzeby danych i wskaż luki w dostępności i jakości.',
    whatYouGetEn: ['Decision→data map', 'Gap register', 'Data initiative backlog'],
    whatYouGetPl: ['Mapa decyzja→dane', 'Rejestr luk', 'Backlog inicjatyw danych'],
    tags: ['digital', 'data', 'governance'],
    icon: 'Database',
    sortOrder: 308,
    isComingSoon: true,
  },
  {
    id: 'tool-known-pain-to-solution',
    toolType: 'pain-to-solution',
    displayName: 'Pain-to-Solution Mapper',
    libraryCategory: 'digital',
    descriptionEn: 'Map pains to solution archetypes and build a prioritized solution backlog.',
    descriptionPl:
      'Zmapuj bóle na archetypy rozwiązań i zbuduj priorytetyzowany backlog rozwiązań.',
    whatYouGetEn: ['Pain→archetype map', 'Solution backlog', 'Feasibility notes'],
    whatYouGetPl: ['Mapa ból→archetyp', 'Backlog rozwiązań', 'Notatki wykonalności'],
    tags: ['digital', 'solutions', 'mapping'],
    icon: 'Lightbulb',
    sortOrder: 309,
    isComingSoon: true,
  },
  {
    id: 'tool-known-pain-explorer',
    toolType: 'pain-explorer',
    displayName: 'Pain Explorer',
    libraryCategory: 'digital',
    descriptionEn: 'Turn chaotic pains into structured problems with hypotheses and evidence tags.',
    descriptionPl:
      'Zamień chaotyczne bóle w ustrukturyzowane problemy z hipotezami i tagami evidence.',
    whatYouGetEn: ['Structured problem list', 'Hypotheses', 'Evidence gaps'],
    whatYouGetPl: ['Lista ustrukturyzowanych problemów', 'Hipotezy', 'Luki w evidence'],
    tags: ['digital', 'discovery', 'problems'],
    icon: 'Search',
    sortOrder: 310,
  },
  {
    id: 'tool-known-process-automation',
    toolType: 'process-automation',
    displayName: 'Process Automation (Speed Tool)',
    libraryCategory: 'automation',
    descriptionEn:
      'Canonical method to identify, map, measure, redesign and justify process automation.',
    descriptionPl:
      'Kanoniczna metoda identyfikacji, mapowania, pomiaru, redesignu i uzasadnienia automatyzacji procesu.',
    whatYouGetEn: ['Process map', 'Baseline vs target', 'Economics & payback', 'Initiative set'],
    whatYouGetPl: ['Mapa procesu', 'Baseline vs target', 'Ekonomia i payback', 'Zestaw inicjatyw'],
    tags: ['automation', 'process', 'roi'],
    icon: 'Zap',
    sortOrder: 401,
  },
];

class KnownToolsService {
  private db: IDatabase | null = null;
  private ensuredSqliteSeed = false;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  private async ensureToolsSeedOnce(): Promise<void> {
    if (this.ensuredSqliteSeed) return;

    const db = await this.getDb();
    const q = new QueryAdapter(db);

    // NOTE: Always run the upsert loop once per process. The INSERT ... ON CONFLICT
    // (name) DO UPDATE below is idempotent, so re-running it on an already-populated DB
    // is safe and is required to propagate corrections (e.g. Wave 1 is_coming_soon flags)
    // to existing production DBs that already have all rows. A count-guard here would skip
    // those corrections whenever the row count already met the seed length.
    for (const seed of SQLITE_KNOWN_TOOLS_SEED) {
      const descTranslations = JSON.stringify({
        en: seed.descriptionEn,
        pl: seed.descriptionPl,
      });

      /*
       * NAPRAWA L11 — treść Library scalamy, nie nadpisujemy.
       *
       * Wcześniej ta wartość szła prosto do
       * `library_content_translations = EXCLUDED.library_content_translations`,
       * przez co raz na proces kasowała 7 z 8 pól wniesionych przez migracje
       * 559 i 562 (whenToUse, inputs, steps, outputs, commonMistakes, example,
       * nextSteps) dla wszystkich 31 narzędzi.
       *
       * Teraz czytamy stan istniejący i scalamy per locale i per pole:
       * niepusta wartość w bazie wygrywa, seed uzupełnia wyłącznie braki,
       * nieznane pola i locale zostają nietknięte. Operacja jest idempotentna,
       * więc kolejne restarty niczego nie degradują.
       */
      const seedLibraryContent = JSON.stringify({
        en: { whatYouGet: seed.whatYouGetEn },
        pl: { whatYouGet: seed.whatYouGetPl },
      });

      // Klucz konfliktu to kolumna `name`, która trzyma slug narzędzia
      // (w VALUES idzie tam `seed.toolType`, nie `seed.id`). Odczyt musi
      // używać tego samego klucza, inaczej merge nigdy nie zobaczy
      // istniejącego wiersza i cicho straciłby ochronę treści.
      const existingRow = await q.get<Pick<ToolRow, 'library_content_translations'>>(
        `SELECT library_content_translations FROM tools WHERE name = ? OR tool_type = ? LIMIT 1`,
        [seed.toolType, seed.toolType]
      );

      const libraryContentTranslations = mergeLibraryContentJson(
        existingRow?.library_content_translations ?? null,
        seedLibraryContent
      );

      const tagsJson = JSON.stringify(seed.tags);

      await q.run(
        `INSERT INTO tools (id, name, tool_type, display_name, category, library_category,
                            description, description_translations, library_content_translations,
                            icon, is_active, is_licensed, is_coming_soon, tags_json, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (name) DO UPDATE SET
           tool_type = EXCLUDED.tool_type,
           display_name = EXCLUDED.display_name,
           library_category = EXCLUDED.library_category,
           description = EXCLUDED.description,
           description_translations = EXCLUDED.description_translations,
           library_content_translations = EXCLUDED.library_content_translations,
           icon = EXCLUDED.icon,
           is_active = EXCLUDED.is_active,
           is_coming_soon = EXCLUDED.is_coming_soon,
           tags_json = EXCLUDED.tags_json,
           sort_order = EXCLUDED.sort_order`,
        [
          seed.id,
          seed.toolType,
          seed.toolType,
          seed.displayName,
          seed.libraryCategory,
          seed.libraryCategory,
          seed.descriptionEn,
          descTranslations,
          libraryContentTranslations,
          seed.icon,
          1,
          0,
          seed.isComingSoon ? 1 : 0,
          tagsJson,
          seed.sortOrder,
          new Date().toISOString(),
        ]
      );
    }

    this.ensuredSqliteSeed = true;
  }

  private isKnownToolActive(toolTypeRaw: string, rowIsActive?: number | null): boolean {
    const toolType = String(toolTypeRaw || '')
      .trim()
      .toLowerCase();
    if (!toolType) return false;
    return Boolean(rowIsActive) && ACTIVE_KNOWN_TOOL_TYPES.has(toolType);
  }

  async getKnownToolAvailability(
    toolTypeOrName: string
  ): Promise<{ exists: boolean; isActive: boolean }> {
    await this.ensureToolsSeedOnce();
    const db = await this.getDb();
    const q = new QueryAdapter(db);
    const toolType = String(toolTypeOrName || '').trim();
    if (!toolType) return { exists: false, isActive: false };

    const row = await q.get<Pick<ToolRow, 'name' | 'tool_type' | 'is_active'>>(
      `SELECT name, tool_type, is_active
         FROM tools
        WHERE tool_type IS NOT NULL
          AND (tool_type = ? OR name = ?)
        LIMIT 1`,
      [toolType, toolType]
    );

    if (!row) return { exists: false, isActive: false };
    const resolvedToolType = row.tool_type || row.name || toolType;
    return {
      exists: true,
      isActive: this.isKnownToolActive(resolvedToolType, row.is_active),
    };
  }

  async listKnownTools(params: {
    lang?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: KnownToolListItem[]; total: number; limit: number; offset: number }> {
    await this.ensureToolsSeedOnce();
    const db = await this.getDb();
    const q = new QueryAdapter(db);
    const lang = normalizeLanguage(params.lang);
    const limit = Math.min(50, Math.max(1, Number(params.limit || 20)));
    const offset = Math.max(0, Number(params.offset || 0));

    const where: string[] = ['tool_type IS NOT NULL'];
    const args: unknown[] = [];

    if (params.category) {
      where.push('library_category = ?');
      args.push(params.category);
    }

    if (params.search && params.search.trim()) {
      where.push('(LOWER(display_name) LIKE ? OR LOWER(name) LIKE ?)');
      const q = `%${params.search.toLowerCase().trim()}%`;
      args.push(q, q);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = await q.get<{ total: number | string }>(
      `SELECT COUNT(*) as total FROM tools ${whereSql}`,
      args
    );
    const total = Number(countRow?.total ?? 0);

    const rows = await q.all<ToolRow>(
      `SELECT id, name, tool_type, display_name, library_category, description, description_translations,
              library_content_translations, icon, is_licensed, is_active, is_coming_soon, tags_json, sort_order, created_at
         FROM tools
         ${whereSql}
         ORDER BY sort_order ASC, display_name ASC
         LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );

    const items: KnownToolListItem[] = (rows || []).map((row) => {
      const toolType = row.tool_type || row.name;
      const isActive = this.isKnownToolActive(toolType, row.is_active);
      const description = pickTranslation(
        row.description_translations,
        lang,
        row.description || ''
      );
      const content = pickLibraryContent(row.library_content_translations, lang);
      const whatYouGet = Array.isArray(content.whatYouGet) ? content.whatYouGet : [];
      const tags = safeJsonParse<string[]>(row.tags_json, []);
      return {
        id: row.id,
        toolType,
        name: row.display_name,
        libraryCategory: row.library_category || null,
        description,
        whatYouGet,
        tags,
        icon: row.icon || null,
        isLicensed: Boolean(row.is_licensed),
        isActive,
        isComingSoon: !isActive || Boolean(row.is_coming_soon),
        sortOrder: Number(row.sort_order || 0),
        createdAt: row.created_at || null,
      };
    });

    return { items, total, limit, offset };
  }

  async getKnownTool(toolTypeOrName: string, langRaw?: string): Promise<KnownToolDetail | null> {
    await this.ensureToolsSeedOnce();
    const db = await this.getDb();
    const q = new QueryAdapter(db);
    const lang = normalizeLanguage(langRaw);
    const toolType = String(toolTypeOrName || '').trim();
    if (!toolType) return null;

    const row = await q.get<ToolRow>(
      `SELECT id, name, tool_type, display_name, library_category, description, description_translations,
              library_content_translations, icon, is_licensed, is_active, is_coming_soon, tags_json, sort_order, created_at
         FROM tools
        WHERE tool_type IS NOT NULL
          AND (tool_type = ? OR name = ?)
        LIMIT 1`,
      [toolType, toolType]
    );

    if (!row) return null;

    const resolvedToolType = row.tool_type || row.name;
    const isActive = this.isKnownToolActive(resolvedToolType, row.is_active);
    if (!isActive) return null;
    const description = pickTranslation(row.description_translations, lang, row.description || '');
    const content = {
      ...getFallbackLibraryContent(resolvedToolType, lang),
      ...pickLibraryContent(row.library_content_translations, lang),
    };

    const detail: KnownToolDetail = {
      id: row.id,
      toolType: resolvedToolType,
      name: row.display_name,
      libraryCategory: row.library_category || null,
      description,
      whatYouGet: Array.isArray(content.whatYouGet) ? content.whatYouGet : [],
      tags: safeJsonParse<string[]>(row.tags_json, []),
      icon: row.icon || null,
      isLicensed: Boolean(row.is_licensed),
      isActive,
      isComingSoon: Boolean(row.is_coming_soon),
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at || null,
      whenToUse: typeof content.whenToUse === 'string' ? content.whenToUse : '',
      inputs: Array.isArray(content.inputs) ? content.inputs : [],
      steps: Array.isArray(content.steps) ? content.steps : [],
      outputs: Array.isArray(content.outputs) ? content.outputs : [],
      commonMistakes: Array.isArray(content.commonMistakes) ? content.commonMistakes : [],
      example: typeof content.example === 'string' ? content.example : '',
      nextSteps: Array.isArray(content.nextSteps) ? content.nextSteps : [],
      kbArticleSlug: `tools-${resolvedToolType}-how-to`,
    };

    return detail;
  }
}

export default new KnownToolsService();
