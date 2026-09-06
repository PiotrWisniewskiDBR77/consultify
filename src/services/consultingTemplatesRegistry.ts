/**
 * Consulting Templates Registry — 60 classic consulting frameworks
 *
 * Archetypes:
 *   A = Blocks canvas        B = 2×2 matrix         C = Portfolio grid
 *   D = Tree / decomposition E = Scorecard           F = Map / flow
 *   G = Roadmap / waves      H = Economics
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateArchetype = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type TemplateCategory = 'strategy' | 'operations' | 'digital_transformation';

export interface OutputMapping {
  reportSections: string[];
  deckSlides: string[];
  initiativeCategories: string[];
}

export interface ConsultingTemplate {
  slug: string;
  name: string;
  namePL: string;
  category: TemplateCategory;
  archetype: TemplateArchetype;
  description: string;
  descriptionPL: string;
  tags: string[];
  outputMapping: OutputMapping;
}

// ---------------------------------------------------------------------------
// Strategy templates (20)
// ---------------------------------------------------------------------------

const STRATEGY_TEMPLATES: ConsultingTemplate[] = [
  {
    slug: 'mece-issue-tree',
    name: 'MECE Issue Tree',
    namePL: 'Drzewo problemów MECE',
    category: 'strategy',
    archetype: 'D',
    description:
      'Decompose a complex problem into mutually exclusive, collectively exhaustive branches to ensure complete coverage.',
    descriptionPL:
      'Dekompozycja złożonego problemu na wzajemnie wykluczające się, łącznie wyczerpujące gałęzie.',
    tags: ['problem-solving', 'decomposition', 'analysis'],
    outputMapping: {
      reportSections: ['Problem Statement', 'Issue Branches', 'Key Findings'],
      deckSlides: ['Issue Tree Overview', 'Priority Branches'],
      initiativeCategories: ['analysis', 'strategy'],
    },
  },
  {
    slug: 'hypothesis-driven-strategy',
    name: 'Hypothesis-Driven Strategy',
    namePL: 'Strategia oparta na hipotezach',
    category: 'strategy',
    archetype: 'D',
    description:
      'Structure strategic analysis around testable hypotheses with supporting/refuting evidence.',
    descriptionPL:
      'Strukturyzacja analizy strategicznej wokół testowalnych hipotez z dowodami za i przeciw.',
    tags: ['hypothesis', 'evidence', 'strategy'],
    outputMapping: {
      reportSections: ['Hypothesis Set', 'Evidence Matrix', 'Conclusions'],
      deckSlides: ['Hypothesis Overview', 'Evidence Summary'],
      initiativeCategories: ['strategy', 'validation'],
    },
  },
  {
    slug: 'pyramid-principle',
    name: 'Pyramid Principle',
    namePL: 'Zasada piramidy',
    category: 'strategy',
    archetype: 'D',
    description:
      'Structure communication top-down: answer first, then supporting arguments grouped logically.',
    descriptionPL:
      'Strukturyzacja komunikacji top-down: odpowiedź najpierw, potem argumenty pogrupowane logicznie.',
    tags: ['communication', 'structure', 'storytelling'],
    outputMapping: {
      reportSections: ['Governing Thought', 'Key Arguments', 'Supporting Detail'],
      deckSlides: ['Executive Summary', 'Argument Flow'],
      initiativeCategories: ['communication', 'strategy'],
    },
  },
  {
    slug: 'pestel',
    name: 'PESTEL Analysis',
    namePL: 'Analiza PESTEL',
    category: 'strategy',
    archetype: 'A',
    description:
      'Scan macro-environment across Political, Economic, Social, Technological, Environmental, and Legal factors.',
    descriptionPL:
      'Skan makrootoczenia: czynniki polityczne, ekonomiczne, społeczne, technologiczne, środowiskowe i prawne.',
    tags: ['macro', 'environment', 'scanning'],
    outputMapping: {
      reportSections: ['Factor Analysis', 'Impact Assessment', 'Strategic Implications'],
      deckSlides: ['PESTEL Dashboard', 'Top Factors'],
      initiativeCategories: ['strategy', 'risk'],
    },
  },
  {
    slug: 'market-sizing-tam-sam-som',
    name: 'Market Sizing (TAM/SAM/SOM)',
    namePL: 'Sizing rynku (TAM/SAM/SOM)',
    category: 'strategy',
    archetype: 'H',
    description:
      'Estimate total, serviceable, and obtainable market sizes using top-down and bottom-up approaches.',
    descriptionPL:
      'Szacowanie rynku całkowitego, adresowalnego i osiągalnego metodami top-down i bottom-up.',
    tags: ['market', 'sizing', 'economics'],
    outputMapping: {
      reportSections: ['Market Definition', 'Sizing Methodology', 'TAM/SAM/SOM Estimates'],
      deckSlides: ['Market Funnel', 'Sizing Assumptions'],
      initiativeCategories: ['growth', 'market-entry'],
    },
  },
  {
    slug: 'customer-segmentation',
    name: 'Customer Segmentation',
    namePL: 'Segmentacja klientów',
    category: 'strategy',
    archetype: 'C',
    description:
      'Divide customer base into actionable segments based on needs, value, and behavior.',
    descriptionPL: 'Podział bazy klientów na segmenty wg potrzeb, wartości i zachowań.',
    tags: ['customers', 'segmentation', 'targeting'],
    outputMapping: {
      reportSections: ['Segmentation Criteria', 'Segment Profiles', 'Targeting Recommendations'],
      deckSlides: ['Segment Map', 'Priority Segments'],
      initiativeCategories: ['marketing', 'growth'],
    },
  },
  {
    slug: 'jobs-to-be-done',
    name: 'Jobs To Be Done',
    namePL: 'Jobs To Be Done',
    category: 'strategy',
    archetype: 'A',
    description:
      'Identify the functional, emotional, and social jobs customers hire products to do.',
    descriptionPL:
      'Identyfikacja funkcjonalnych, emocjonalnych i społecznych zadań, do których klienci „zatrudniają" produkty.',
    tags: ['innovation', 'customer', 'needs'],
    outputMapping: {
      reportSections: ['Job Map', 'Unmet Needs', 'Opportunity Scoring'],
      deckSlides: ['JTBD Canvas', 'Opportunity Landscape'],
      initiativeCategories: ['innovation', 'product'],
    },
  },
  {
    slug: 'competitive-benchmarking',
    name: 'Competitive Benchmarking',
    namePL: 'Benchmarking konkurencyjny',
    category: 'strategy',
    archetype: 'E',
    description:
      'Compare performance against competitors across key dimensions to identify gaps and advantages.',
    descriptionPL:
      'Porównanie wyników z konkurencją w kluczowych wymiarach — identyfikacja luk i przewag.',
    tags: ['competition', 'benchmarking', 'analysis'],
    outputMapping: {
      reportSections: ['Benchmark Dimensions', 'Competitor Profiles', 'Gap Analysis'],
      deckSlides: ['Benchmark Scorecard', 'Competitive Positioning'],
      initiativeCategories: ['strategy', 'improvement'],
    },
  },
  {
    slug: 'porter-generic-strategies',
    name: 'Porter Generic Strategies',
    namePL: 'Strategie generyczne Portera',
    category: 'strategy',
    archetype: 'B',
    description:
      'Choose between cost leadership, differentiation, or focus as the basis for competitive advantage.',
    descriptionPL:
      'Wybór między przywództwem kosztowym, różnicowaniem lub koncentracją jako bazą przewagi.',
    tags: ['porter', 'competitive-advantage', 'positioning'],
    outputMapping: {
      reportSections: ['Strategic Options', 'Fit Assessment', 'Recommended Strategy'],
      deckSlides: ['Strategy Matrix', 'Fit Analysis'],
      initiativeCategories: ['strategy', 'positioning'],
    },
  },
  {
    slug: 'strategic-positioning',
    name: 'Strategic Positioning',
    namePL: 'Pozycjonowanie strategiczne',
    category: 'strategy',
    archetype: 'B',
    description:
      'Define where to play and how to win by mapping competitive position on key dimensions.',
    descriptionPL: 'Określenie „gdzie grać" i „jak wygrać" przez mapowanie pozycji konkurencyjnej.',
    tags: ['positioning', 'where-to-play', 'how-to-win'],
    outputMapping: {
      reportSections: ['Positioning Dimensions', 'Current vs Target Position', 'Strategic Moves'],
      deckSlides: ['Positioning Map', 'Strategic Choices'],
      initiativeCategories: ['strategy', 'growth'],
    },
  },
  {
    slug: 'vrio',
    name: 'VRIO Analysis',
    namePL: 'Analiza VRIO',
    category: 'strategy',
    archetype: 'E',
    description:
      'Evaluate resources for Value, Rarity, Imitability, and Organization to identify sustainable advantages.',
    descriptionPL:
      'Ocena zasobów pod kątem wartości, rzadkości, imitowalności i organizacji — trwałe przewagi.',
    tags: ['resources', 'competitive-advantage', 'capabilities'],
    outputMapping: {
      reportSections: ['Resource Inventory', 'VRIO Assessment', 'Advantage Map'],
      deckSlides: ['VRIO Scorecard', 'Key Resources'],
      initiativeCategories: ['strategy', 'capabilities'],
    },
  },
  {
    slug: 'core-competencies',
    name: 'Core Competencies',
    namePL: 'Kluczowe kompetencje',
    category: 'strategy',
    archetype: 'A',
    description:
      'Identify and leverage core competencies that provide access to markets, customer benefits, and are hard to imitate.',
    descriptionPL:
      'Identyfikacja kluczowych kompetencji dających dostęp do rynków, korzyści klientom i trudnych do imitacji.',
    tags: ['competencies', 'capabilities', 'advantage'],
    outputMapping: {
      reportSections: ['Competency Identification', 'Leverage Assessment', 'Development Plan'],
      deckSlides: ['Core Competency Map', 'Leverage Opportunities'],
      initiativeCategories: ['capabilities', 'strategy'],
    },
  },
  {
    slug: 'blue-ocean-strategy',
    name: 'Blue Ocean Strategy',
    namePL: 'Strategia błękitnego oceanu',
    category: 'strategy',
    archetype: 'A',
    description:
      'Create uncontested market space by simultaneously pursuing differentiation and low cost.',
    descriptionPL:
      'Tworzenie niekwestionowanej przestrzeni rynkowej przez jednoczesne różnicowanie i niski koszt.',
    tags: ['innovation', 'market-creation', 'differentiation'],
    outputMapping: {
      reportSections: ['Strategy Canvas', 'Value Innovation', 'New Market Space'],
      deckSlides: ['Strategy Canvas Comparison', 'Blue Ocean Moves'],
      initiativeCategories: ['innovation', 'growth'],
    },
  },
  {
    slug: 'errc-grid',
    name: 'ERRC Grid',
    namePL: 'Siatka ERRC',
    category: 'strategy',
    archetype: 'A',
    description:
      'Eliminate, Reduce, Raise, Create — four actions framework to reshape value curves.',
    descriptionPL:
      'Eliminuj, Redukuj, Podnieś, Stwórz — cztery akcje do przebudowy krzywej wartości.',
    tags: ['blue-ocean', 'value-curve', 'innovation'],
    outputMapping: {
      reportSections: ['Current Value Curve', 'ERRC Actions', 'New Value Curve'],
      deckSlides: ['ERRC Grid', 'Before/After Value Curve'],
      initiativeCategories: ['innovation', 'strategy'],
    },
  },
  {
    slug: 'ge-mckinsey-9-box',
    name: 'GE-McKinsey 9-Box Matrix',
    namePL: 'Macierz GE-McKinsey 9-Box',
    category: 'strategy',
    archetype: 'C',
    description:
      'Prioritize business units or products on industry attractiveness vs competitive strength.',
    descriptionPL:
      'Priorytetyzacja jednostek biznesowych wg atrakcyjności branży vs siły konkurencyjnej.',
    tags: ['portfolio', 'prioritization', 'matrix'],
    outputMapping: {
      reportSections: ['Scoring Criteria', 'Unit Placement', 'Investment Recommendations'],
      deckSlides: ['9-Box Matrix', 'Investment Priorities'],
      initiativeCategories: ['portfolio', 'investment'],
    },
  },
  {
    slug: 'experience-curve',
    name: 'Experience Curve',
    namePL: 'Krzywa doświadczenia',
    category: 'strategy',
    archetype: 'H',
    description: 'Model how unit costs decline predictably with cumulative production volume.',
    descriptionPL:
      'Modelowanie spadku kosztów jednostkowych wraz ze skumulowanym wolumenem produkcji.',
    tags: ['cost', 'scale', 'economics'],
    outputMapping: {
      reportSections: ['Cost Baseline', 'Experience Rate', 'Competitive Implications'],
      deckSlides: ['Experience Curve Chart', 'Cost Position'],
      initiativeCategories: ['cost-reduction', 'operations'],
    },
  },
  {
    slug: 'bcg-advantage-matrix',
    name: 'BCG Advantage Matrix',
    namePL: 'Macierz przewag BCG',
    category: 'strategy',
    archetype: 'B',
    description: 'Classify industries by size of advantage and number of approaches to achieve it.',
    descriptionPL: 'Klasyfikacja branż wg wielkości przewagi i liczby sposobów jej osiągnięcia.',
    tags: ['bcg', 'industry', 'advantage'],
    outputMapping: {
      reportSections: ['Industry Classification', 'Advantage Analysis', 'Strategic Implications'],
      deckSlides: ['Advantage Matrix', 'Industry Position'],
      initiativeCategories: ['strategy', 'positioning'],
    },
  },
  {
    slug: 'three-horizons',
    name: 'Three Horizons',
    namePL: 'Trzy horyzonty',
    category: 'strategy',
    archetype: 'G',
    description:
      'Balance investment across core business (H1), emerging opportunities (H2), and future bets (H3).',
    descriptionPL:
      'Balansowanie inwestycji: core business (H1), nowe szanse (H2), przyszłe zakłady (H3).',
    tags: ['horizons', 'innovation', 'portfolio'],
    outputMapping: {
      reportSections: ['Horizon Classification', 'Investment Balance', 'Migration Plan'],
      deckSlides: ['Three Horizons View', 'Portfolio Balance'],
      initiativeCategories: ['innovation', 'portfolio'],
    },
  },
  {
    slug: 'business-model-canvas',
    name: 'Business Model Canvas',
    namePL: 'Business Model Canvas',
    category: 'strategy',
    archetype: 'A',
    description: 'Map the nine building blocks of a business model on a single canvas.',
    descriptionPL: 'Mapowanie dziewięciu elementów modelu biznesowego na jednym kanvasie.',
    tags: ['business-model', 'canvas', 'design'],
    outputMapping: {
      reportSections: ['Canvas Overview', 'Block Analysis', 'Model Viability'],
      deckSlides: ['Business Model Canvas', 'Key Insights'],
      initiativeCategories: ['business-model', 'innovation'],
    },
  },
  {
    slug: 'balanced-scorecard',
    name: 'Balanced Scorecard',
    namePL: 'Zrównoważona karta wyników',
    category: 'strategy',
    archetype: 'E',
    description:
      'Translate strategy into objectives and measures across Financial, Customer, Process, and Learning perspectives.',
    descriptionPL:
      'Przełożenie strategii na cele i mierniki w perspektywach: finansowej, klienta, procesów i rozwoju.',
    tags: ['scorecard', 'kpi', 'strategy-execution'],
    outputMapping: {
      reportSections: ['Strategy Map', 'Perspective Objectives', 'KPI Definitions'],
      deckSlides: ['Balanced Scorecard', 'Strategy Map'],
      initiativeCategories: ['strategy-execution', 'measurement'],
    },
  },
];

// ---------------------------------------------------------------------------
// Operations templates (20)
// ---------------------------------------------------------------------------

const OPERATIONS_TEMPLATES: ConsultingTemplate[] = [
  {
    slug: 'value-stream-mapping-vsm',
    name: 'Value Stream Mapping (VSM)',
    namePL: 'Mapowanie strumienia wartości (VSM)',
    category: 'operations',
    archetype: 'F',
    description:
      'Visualize end-to-end material and information flow to identify waste and improvement opportunities.',
    descriptionPL:
      'Wizualizacja przepływu materiałów i informacji end-to-end — identyfikacja marnotrawstw.',
    tags: ['lean', 'flow', 'waste'],
    outputMapping: {
      reportSections: ['Current State Map', 'Waste Identification', 'Future State Design'],
      deckSlides: ['VSM Current vs Future', 'Improvement Priorities'],
      initiativeCategories: ['lean', 'process-improvement'],
    },
  },
  {
    slug: 'sipoc',
    name: 'SIPOC',
    namePL: 'SIPOC',
    category: 'operations',
    archetype: 'F',
    description: 'Define process scope through Suppliers, Inputs, Process, Outputs, and Customers.',
    descriptionPL: 'Definicja zakresu procesu: Dostawcy, Wejścia, Proces, Wyjścia, Klienci.',
    tags: ['process', 'scope', 'six-sigma'],
    outputMapping: {
      reportSections: ['SIPOC Diagram', 'Boundary Definition', 'Stakeholder Map'],
      deckSlides: ['SIPOC Overview', 'Process Boundaries'],
      initiativeCategories: ['process-improvement', 'quality'],
    },
  },
  {
    slug: 'dmaic',
    name: 'DMAIC',
    namePL: 'DMAIC',
    category: 'operations',
    archetype: 'G',
    description:
      'Define-Measure-Analyze-Improve-Control cycle for data-driven process improvement.',
    descriptionPL:
      'Cykl Define-Measure-Analyze-Improve-Control do doskonalenia procesów opartego na danych.',
    tags: ['six-sigma', 'improvement', 'data-driven'],
    outputMapping: {
      reportSections: [
        'Problem Definition',
        'Measurement Plan',
        'Root Cause Analysis',
        'Improvement Actions',
      ],
      deckSlides: ['DMAIC Phases', 'Results Summary'],
      initiativeCategories: ['quality', 'process-improvement'],
    },
  },
  {
    slug: 'kaizen-pdca',
    name: 'Kaizen / PDCA',
    namePL: 'Kaizen / PDCA',
    category: 'operations',
    archetype: 'G',
    description:
      'Plan-Do-Check-Act continuous improvement cycle for incremental operational gains.',
    descriptionPL:
      'Cykl Plan-Do-Check-Act ciągłego doskonalenia dla przyrostowych usprawnień operacyjnych.',
    tags: ['kaizen', 'continuous-improvement', 'pdca'],
    outputMapping: {
      reportSections: ['Current Condition', 'Target Condition', 'Action Plan'],
      deckSlides: ['PDCA Cycle', 'Improvement Results'],
      initiativeCategories: ['continuous-improvement', 'lean'],
    },
  },
  {
    slug: 'gemba-walk',
    name: 'Gemba Walk',
    namePL: 'Gemba Walk',
    category: 'operations',
    archetype: 'F',
    description:
      'Structured observation at the place where work happens to identify waste and improvement ideas.',
    descriptionPL:
      'Strukturyzowana obserwacja w miejscu pracy — identyfikacja marnotrawstw i pomysłów na usprawnienia.',
    tags: ['lean', 'observation', 'gemba'],
    outputMapping: {
      reportSections: ['Observation Log', 'Findings Summary', 'Action Items'],
      deckSlides: ['Gemba Findings', 'Quick Wins'],
      initiativeCategories: ['lean', 'engagement'],
    },
  },
  {
    slug: 'standard-work',
    name: 'Standard Work',
    namePL: 'Praca standardowa',
    category: 'operations',
    archetype: 'F',
    description:
      'Document the current best-known method for performing a task to ensure consistency and enable improvement.',
    descriptionPL:
      'Dokumentacja najlepszej znanej metody wykonania zadania — powtarzalność i baza do usprawnień.',
    tags: ['lean', 'standardization', 'sop'],
    outputMapping: {
      reportSections: ['Work Sequence', 'Takt Time Analysis', 'Standard Work Sheet'],
      deckSlides: ['Standard Work Overview', 'Cycle Time Comparison'],
      initiativeCategories: ['standardization', 'quality'],
    },
  },
  {
    slug: '5s',
    name: '5S Workplace Organization',
    namePL: '5S Organizacja stanowiska pracy',
    category: 'operations',
    archetype: 'A',
    description:
      'Sort, Set in Order, Shine, Standardize, Sustain — workplace organization methodology.',
    descriptionPL:
      'Selekcja, Systematyka, Sprzątanie, Standaryzacja, Samodyscyplina — metodologia organizacji.',
    tags: ['lean', '5s', 'workplace'],
    outputMapping: {
      reportSections: ['Current State Audit', '5S Action Plan', 'Sustain Checklist'],
      deckSlides: ['5S Assessment', 'Before/After'],
      initiativeCategories: ['lean', 'workplace'],
    },
  },
  {
    slug: 'root-cause-5whys-fishbone',
    name: 'Root Cause (5 Whys / Fishbone)',
    namePL: 'Analiza przyczyn źródłowych (5 Why / Ishikawa)',
    category: 'operations',
    archetype: 'D',
    description: 'Drill to root causes using 5 Whys and Ishikawa diagrams to prevent recurrence.',
    descriptionPL:
      'Dotarcie do przyczyn źródłowych metodą 5 Why i diagramem Ishikawy — zapobieganie nawrotom.',
    tags: ['root-cause', 'problem-solving', 'quality'],
    outputMapping: {
      reportSections: ['Problem Statement', 'Cause Analysis', 'Countermeasures'],
      deckSlides: ['Fishbone Diagram', 'Root Cause Summary'],
      initiativeCategories: ['quality', 'problem-solving'],
    },
  },
  {
    slug: 'kanban-wip-limits',
    name: 'Kanban & WIP Limits',
    namePL: 'Kanban i limity WIP',
    category: 'operations',
    archetype: 'F',
    description:
      'Visualize workflow, limit work-in-progress, and manage flow to improve lead time.',
    descriptionPL:
      'Wizualizacja przepływu pracy, limitowanie WIP i zarządzanie flow — poprawa lead time.',
    tags: ['kanban', 'flow', 'wip'],
    outputMapping: {
      reportSections: ['Board Design', 'WIP Policy', 'Flow Metrics'],
      deckSlides: ['Kanban Board', 'Flow Improvement'],
      initiativeCategories: ['agile', 'flow'],
    },
  },
  {
    slug: 'bottleneck-analysis-toc',
    name: 'Bottleneck Analysis (TOC)',
    namePL: 'Analiza wąskich gardeł (TOC)',
    category: 'operations',
    archetype: 'F',
    description:
      'Identify and exploit the system constraint using Theory of Constraints principles.',
    descriptionPL: 'Identyfikacja i eksploatacja ograniczenia systemowego wg Teorii Ograniczeń.',
    tags: ['toc', 'bottleneck', 'throughput'],
    outputMapping: {
      reportSections: ['Constraint Identification', 'Exploitation Plan', 'Subordination Rules'],
      deckSlides: ['Constraint Map', 'Throughput Impact'],
      initiativeCategories: ['throughput', 'operations'],
    },
  },
  {
    slug: 'smed',
    name: 'SMED (Single-Minute Exchange of Die)',
    namePL: 'SMED (przezbrojenie w jednocyfrowej liczbie minut)',
    category: 'operations',
    archetype: 'F',
    description:
      'Reduce changeover time by converting internal setup to external and streamlining steps.',
    descriptionPL:
      'Redukcja czasu przezbrojenia przez konwersję czynności wewnętrznych na zewnętrzne.',
    tags: ['smed', 'changeover', 'lean'],
    outputMapping: {
      reportSections: ['Step Classification', 'Conversion Plan', 'Time Reduction Estimate'],
      deckSlides: ['SMED Analysis', 'Before/After Timeline'],
      initiativeCategories: ['lean', 'efficiency'],
    },
  },
  {
    slug: 'oee',
    name: 'OEE (Overall Equipment Effectiveness)',
    namePL: 'OEE (Całkowita efektywność wyposażenia)',
    category: 'operations',
    archetype: 'E',
    description: 'Measure equipment effectiveness through Availability × Performance × Quality.',
    descriptionPL: 'Pomiar efektywności wyposażenia: Dostępność × Wydajność × Jakość.',
    tags: ['oee', 'equipment', 'manufacturing'],
    outputMapping: {
      reportSections: ['OEE Breakdown', 'Loss Categories', 'Improvement Priorities'],
      deckSlides: ['OEE Dashboard', 'Loss Waterfall'],
      initiativeCategories: ['maintenance', 'efficiency'],
    },
  },
  {
    slug: 'tpm',
    name: 'TPM (Total Productive Maintenance)',
    namePL: 'TPM (Totalne utrzymanie ruchu)',
    category: 'operations',
    archetype: 'A',
    description:
      'Engage all employees in proactive equipment maintenance to eliminate breakdowns and defects.',
    descriptionPL:
      'Zaangażowanie wszystkich pracowników w proaktywne utrzymanie ruchu — eliminacja awarii i defektów.',
    tags: ['tpm', 'maintenance', 'reliability'],
    outputMapping: {
      reportSections: ['Pillar Assessment', 'Loss Structure', 'Implementation Roadmap'],
      deckSlides: ['TPM Pillars', 'Loss Reduction Plan'],
      initiativeCategories: ['maintenance', 'reliability'],
    },
  },
  {
    slug: 'spc-control-charts',
    name: 'SPC Control Charts',
    namePL: 'Karty kontrolne SPC',
    category: 'operations',
    archetype: 'E',
    description:
      'Monitor process stability using statistical control charts to distinguish common from special cause variation.',
    descriptionPL:
      'Monitorowanie stabilności procesu kartami kontrolnymi — rozróżnienie przyczyn zwykłych od specjalnych.',
    tags: ['spc', 'quality', 'statistics'],
    outputMapping: {
      reportSections: ['Control Chart Setup', 'Stability Analysis', 'Out-of-Control Actions'],
      deckSlides: ['Control Chart Summary', 'Process Stability'],
      initiativeCategories: ['quality', 'measurement'],
    },
  },
  {
    slug: 'process-capability-cpk',
    name: 'Process Capability (Cpk)',
    namePL: 'Zdolność procesu (Cpk)',
    category: 'operations',
    archetype: 'E',
    description: 'Quantify how well a process meets specification limits using Cp and Cpk indices.',
    descriptionPL:
      'Kwantyfikacja zdolności procesu do spełnienia limitów specyfikacji wskaźnikami Cp i Cpk.',
    tags: ['capability', 'quality', 'six-sigma'],
    outputMapping: {
      reportSections: ['Specification Limits', 'Capability Indices', 'Improvement Targets'],
      deckSlides: ['Capability Summary', 'Distribution Chart'],
      initiativeCategories: ['quality', 'process-improvement'],
    },
  },
  {
    slug: 'fmea',
    name: 'FMEA (Failure Mode & Effects Analysis)',
    namePL: 'FMEA (Analiza przyczyn i skutków wad)',
    category: 'operations',
    archetype: 'E',
    description:
      'Systematically identify potential failure modes, assess risk, and prioritize preventive actions.',
    descriptionPL:
      'Systematyczna identyfikacja potencjalnych wad, ocena ryzyka i priorytetyzacja działań zapobiegawczych.',
    tags: ['fmea', 'risk', 'quality'],
    outputMapping: {
      reportSections: ['Failure Mode Inventory', 'RPN Scoring', 'Mitigation Plan'],
      deckSlides: ['FMEA Risk Matrix', 'Top Risks & Actions'],
      initiativeCategories: ['quality', 'risk'],
    },
  },
  {
    slug: 'abc-xyz-inventory',
    name: 'ABC-XYZ Inventory Analysis',
    namePL: 'Analiza zapasów ABC-XYZ',
    category: 'operations',
    archetype: 'C',
    description:
      'Classify inventory by value (ABC) and demand variability (XYZ) to set differentiated policies.',
    descriptionPL:
      'Klasyfikacja zapasów wg wartości (ABC) i zmienności popytu (XYZ) — zróżnicowane polityki.',
    tags: ['inventory', 'classification', 'supply-chain'],
    outputMapping: {
      reportSections: ['Classification Matrix', 'Policy Recommendations', 'Financial Impact'],
      deckSlides: ['ABC-XYZ Grid', 'Policy Summary'],
      initiativeCategories: ['supply-chain', 'inventory'],
    },
  },
  {
    slug: 'safety-stock-reorder-point',
    name: 'Safety Stock & Reorder Point',
    namePL: 'Zapas bezpieczeństwa i punkt zamawiania',
    category: 'operations',
    archetype: 'H',
    description:
      'Calculate optimal safety stock levels and reorder points balancing service level and inventory cost.',
    descriptionPL:
      'Obliczanie optymalnych zapasów bezpieczeństwa i punktów zamawiania — balans poziomu obsługi i kosztów.',
    tags: ['inventory', 'replenishment', 'optimization'],
    outputMapping: {
      reportSections: ['Demand Analysis', 'Safety Stock Calculation', 'Policy Parameters'],
      deckSlides: ['Inventory Policy', 'Service Level Trade-off'],
      initiativeCategories: ['supply-chain', 'cost-reduction'],
    },
  },
  {
    slug: 'sales-and-operations-planning-sn-op',
    name: 'Sales & Operations Planning (S&OP)',
    namePL: 'Planowanie sprzedaży i operacji (S&OP)',
    category: 'operations',
    archetype: 'G',
    description: 'Align demand, supply, and financial plans in a monthly cross-functional cadence.',
    descriptionPL:
      'Wyrównanie planów popytu, podaży i finansów w miesięcznym cyklu cross-funkcyjnym.',
    tags: ['s&op', 'planning', 'alignment'],
    outputMapping: {
      reportSections: ['Process Design', 'Cadence Definition', 'KPI Framework'],
      deckSlides: ['S&OP Process', 'Alignment Dashboard'],
      initiativeCategories: ['planning', 'operations'],
    },
  },
  {
    slug: 'scor-model',
    name: 'SCOR Model',
    namePL: 'Model SCOR',
    category: 'operations',
    archetype: 'F',
    description:
      'Map supply chain processes using Plan-Source-Make-Deliver-Return-Enable framework.',
    descriptionPL:
      'Mapowanie procesów łańcucha dostaw wg frameworka Plan-Source-Make-Deliver-Return-Enable.',
    tags: ['scor', 'supply-chain', 'process'],
    outputMapping: {
      reportSections: ['Process Mapping', 'Performance Attributes', 'Best Practice Gaps'],
      deckSlides: ['SCOR Process Map', 'Performance Benchmarks'],
      initiativeCategories: ['supply-chain', 'process-improvement'],
    },
  },
];

// ---------------------------------------------------------------------------
// Digital Transformation templates (20)
// ---------------------------------------------------------------------------

const DIGITAL_TRANSFORMATION_TEMPLATES: ConsultingTemplate[] = [
  {
    slug: 'digital-transformation-assessment',
    name: 'Digital Transformation Assessment',
    namePL: 'Ocena transformacji cyfrowej',
    category: 'digital_transformation',
    archetype: 'E',
    description:
      'Assess organizational digital maturity across key dimensions to set transformation priorities.',
    descriptionPL:
      'Ocena dojrzałości cyfrowej organizacji w kluczowych wymiarach — priorytetyzacja transformacji.',
    tags: ['assessment', 'maturity', 'digital'],
    outputMapping: {
      reportSections: ['Maturity Scores', 'Gap Analysis', 'Priority Roadmap'],
      deckSlides: ['Maturity Radar', 'Transformation Priorities'],
      initiativeCategories: ['digital', 'transformation'],
    },
  },
  {
    slug: 'target-operating-model-tom',
    name: 'Target Operating Model (TOM)',
    namePL: 'Docelowy model operacyjny (TOM)',
    category: 'digital_transformation',
    archetype: 'A',
    description:
      'Design the future-state operating model covering people, process, technology, and governance.',
    descriptionPL:
      'Projektowanie docelowego modelu operacyjnego: ludzie, procesy, technologia, governance.',
    tags: ['operating-model', 'design', 'transformation'],
    outputMapping: {
      reportSections: ['Current vs Target Model', 'Design Principles', 'Transition Plan'],
      deckSlides: ['TOM Blueprint', 'Transition Roadmap'],
      initiativeCategories: ['transformation', 'operating-model'],
    },
  },
  {
    slug: 'transformation-roadmap',
    name: 'Transformation Roadmap',
    namePL: 'Roadmapa transformacji',
    category: 'digital_transformation',
    archetype: 'G',
    description:
      'Sequence transformation initiatives into waves with dependencies, milestones, and value checkpoints.',
    descriptionPL:
      'Sekwencjonowanie inicjatyw transformacyjnych w fale z zależnościami, kamieniami milowymi i checkpointami wartości.',
    tags: ['roadmap', 'sequencing', 'transformation'],
    outputMapping: {
      reportSections: ['Wave Design', 'Dependencies', 'Value Milestones'],
      deckSlides: ['Roadmap Timeline', 'Wave Summary'],
      initiativeCategories: ['transformation', 'planning'],
    },
  },
  {
    slug: 'benefits-case-value-tracking',
    name: 'Benefits Case & Value Tracking',
    namePL: 'Business case korzyści i śledzenie wartości',
    category: 'digital_transformation',
    archetype: 'H',
    description:
      'Build benefits cases and track value realization throughout the transformation lifecycle.',
    descriptionPL:
      'Budowanie business case korzyści i śledzenie realizacji wartości w cyklu transformacji.',
    tags: ['benefits', 'value', 'tracking'],
    outputMapping: {
      reportSections: ['Benefits Register', 'Value Tracking Framework', 'Realization Report'],
      deckSlides: ['Benefits Overview', 'Value Realization'],
      initiativeCategories: ['value-management', 'governance'],
    },
  },
  {
    slug: 'current-state-architecture-map',
    name: 'Current-State Architecture Map',
    namePL: 'Mapa architektury stanu obecnego',
    category: 'digital_transformation',
    archetype: 'F',
    description:
      'Document the current application, data, and technology landscape as a baseline for transformation.',
    descriptionPL:
      'Dokumentacja obecnego krajobrazu aplikacji, danych i technologii jako bazy do transformacji.',
    tags: ['architecture', 'current-state', 'mapping'],
    outputMapping: {
      reportSections: ['Application Landscape', 'Integration Map', 'Technical Debt Assessment'],
      deckSlides: ['Architecture Overview', 'Debt Hotspots'],
      initiativeCategories: ['architecture', 'modernization'],
    },
  },
  {
    slug: 'target-architecture-blueprint',
    name: 'Target Architecture Blueprint',
    namePL: 'Blueprint architektury docelowej',
    category: 'digital_transformation',
    archetype: 'F',
    description:
      'Design the target-state architecture aligned with business strategy and technology standards.',
    descriptionPL:
      'Projektowanie architektury docelowej zgodnej ze strategią biznesową i standardami technologicznymi.',
    tags: ['architecture', 'target-state', 'blueprint'],
    outputMapping: {
      reportSections: ['Architecture Principles', 'Target Blueprint', 'Migration Path'],
      deckSlides: ['Target Architecture', 'Migration Phases'],
      initiativeCategories: ['architecture', 'transformation'],
    },
  },
  {
    slug: 'application-portfolio-rationalization',
    name: 'Application Portfolio Rationalization',
    namePL: 'Racjonalizacja portfela aplikacji',
    category: 'digital_transformation',
    archetype: 'C',
    description:
      'Assess and rationalize the application portfolio using TIME (Tolerate, Invest, Migrate, Eliminate).',
    descriptionPL:
      'Ocena i racjonalizacja portfela aplikacji metodą TIME (Toleruj, Inwestuj, Migruj, Eliminuj).',
    tags: ['applications', 'rationalization', 'portfolio'],
    outputMapping: {
      reportSections: ['Portfolio Inventory', 'TIME Classification', 'Rationalization Plan'],
      deckSlides: ['Portfolio Heat Map', 'Rationalization Roadmap'],
      initiativeCategories: ['architecture', 'cost-reduction'],
    },
  },
  {
    slug: 'technology-standards-guardrails',
    name: 'Technology Standards & Guardrails',
    namePL: 'Standardy technologiczne i guardrails',
    category: 'digital_transformation',
    archetype: 'A',
    description:
      'Define technology standards, approved patterns, and guardrails to guide consistent technology decisions.',
    descriptionPL:
      'Definicja standardów technologicznych, zatwierdzonych wzorców i guardrails dla spójnych decyzji.',
    tags: ['standards', 'governance', 'technology'],
    outputMapping: {
      reportSections: ['Standards Catalog', 'Decision Framework', 'Compliance Checklist'],
      deckSlides: ['Standards Overview', 'Governance Model'],
      initiativeCategories: ['governance', 'standards'],
    },
  },
  {
    slug: 'data-strategy-data-operating-model',
    name: 'Data Strategy & Data Operating Model',
    namePL: 'Strategia danych i model operacyjny danych',
    category: 'digital_transformation',
    archetype: 'A',
    description:
      'Define how the organization will collect, manage, and leverage data as a strategic asset.',
    descriptionPL:
      'Określenie jak organizacja będzie zbierać, zarządzać i wykorzystywać dane jako zasób strategiczny.',
    tags: ['data', 'strategy', 'operating-model'],
    outputMapping: {
      reportSections: ['Data Vision', 'Operating Model Design', 'Capability Roadmap'],
      deckSlides: ['Data Strategy Canvas', 'Operating Model'],
      initiativeCategories: ['data', 'strategy'],
    },
  },
  {
    slug: 'data-governance',
    name: 'Data Governance',
    namePL: 'Zarządzanie danymi (Data Governance)',
    category: 'digital_transformation',
    archetype: 'A',
    description:
      'Establish roles, policies, and processes for managing data quality, access, and lifecycle.',
    descriptionPL:
      'Ustanowienie ról, polityk i procesów zarządzania jakością, dostępem i cyklem życia danych.',
    tags: ['data', 'governance', 'quality'],
    outputMapping: {
      reportSections: ['Governance Framework', 'Roles & Responsibilities', 'Policy Catalog'],
      deckSlides: ['Governance Model', 'Implementation Plan'],
      initiativeCategories: ['data', 'governance'],
    },
  },
  {
    slug: 'data-quality-management',
    name: 'Data Quality Management',
    namePL: 'Zarządzanie jakością danych',
    category: 'digital_transformation',
    archetype: 'E',
    description: 'Assess, measure, and improve data quality across critical data domains.',
    descriptionPL: 'Ocena, pomiar i poprawa jakości danych w krytycznych domenach danych.',
    tags: ['data', 'quality', 'measurement'],
    outputMapping: {
      reportSections: ['Quality Dimensions', 'Assessment Results', 'Improvement Plan'],
      deckSlides: ['Data Quality Scorecard', 'Priority Domains'],
      initiativeCategories: ['data', 'quality'],
    },
  },
  {
    slug: 'ai-use-case-factory',
    name: 'AI Use-Case Factory',
    namePL: "Fabryka use-case'ów AI",
    category: 'digital_transformation',
    archetype: 'C',
    description:
      'Systematically identify, prioritize, and pipeline AI use cases from ideation to production.',
    descriptionPL:
      "Systematyczna identyfikacja, priorytetyzacja i pipeline use-case'ów AI od idei do produkcji.",
    tags: ['ai', 'use-cases', 'pipeline'],
    outputMapping: {
      reportSections: ['Use Case Inventory', 'Feasibility Scoring', 'Pipeline Design'],
      deckSlides: ['Use Case Portfolio', 'Pipeline Roadmap'],
      initiativeCategories: ['ai', 'innovation'],
    },
  },
  {
    slug: 'process-mining',
    name: 'Process Mining',
    namePL: 'Process Mining',
    category: 'digital_transformation',
    archetype: 'F',
    description:
      'Discover actual process flows from event logs to identify deviations, bottlenecks, and automation opportunities.',
    descriptionPL:
      'Odkrywanie rzeczywistych przepływów procesów z logów zdarzeń — odchylenia, wąskie gardła, automatyzacja.',
    tags: ['process-mining', 'discovery', 'automation'],
    outputMapping: {
      reportSections: ['Process Discovery', 'Conformance Analysis', 'Optimization Opportunities'],
      deckSlides: ['Process Map', 'Deviation Analysis'],
      initiativeCategories: ['process-improvement', 'automation'],
    },
  },
  {
    slug: 'automation-opportunity-assessment',
    name: 'Automation Opportunity Assessment',
    namePL: 'Ocena potencjału automatyzacji',
    category: 'digital_transformation',
    archetype: 'C',
    description:
      'Scan processes for automation potential, score feasibility, and build a prioritized automation backlog.',
    descriptionPL:
      'Skanowanie procesów pod potencjał automatyzacji, scoring wykonalności i priorytetyzowany backlog.',
    tags: ['automation', 'assessment', 'backlog'],
    outputMapping: {
      reportSections: ['Opportunity Scan', 'Feasibility Scoring', 'Automation Backlog'],
      deckSlides: ['Automation Heat Map', 'Priority Backlog'],
      initiativeCategories: ['automation', 'efficiency'],
    },
  },
  {
    slug: 'customer-journey-digitization-map',
    name: 'Customer Journey Digitization Map',
    namePL: 'Mapa cyfryzacji ścieżki klienta',
    category: 'digital_transformation',
    archetype: 'F',
    description:
      'Map the customer journey and identify digitization opportunities at each touchpoint.',
    descriptionPL:
      'Mapowanie ścieżki klienta i identyfikacja możliwości cyfryzacji w każdym punkcie styku.',
    tags: ['customer-journey', 'digitization', 'experience'],
    outputMapping: {
      reportSections: ['Journey Map', 'Digital Opportunities', 'Experience Improvements'],
      deckSlides: ['Journey Overview', 'Digitization Priorities'],
      initiativeCategories: ['customer-experience', 'digital'],
    },
  },
  {
    slug: 'product-operating-model',
    name: 'Product Operating Model',
    namePL: 'Produktowy model operacyjny',
    category: 'digital_transformation',
    archetype: 'A',
    description:
      'Shift from project to product mindset with persistent teams, backlogs, and outcome metrics.',
    descriptionPL:
      'Przejście z myślenia projektowego na produktowe: stałe zespoły, backlogi i metryki wyników.',
    tags: ['product', 'operating-model', 'agile'],
    outputMapping: {
      reportSections: ['Product Taxonomy', 'Team Topology', 'Metrics Framework'],
      deckSlides: ['Product Model', 'Team Design'],
      initiativeCategories: ['product', 'organization'],
    },
  },
  {
    slug: 'agile-at-scale',
    name: 'Agile at Scale',
    namePL: 'Agile w skali',
    category: 'digital_transformation',
    archetype: 'G',
    description:
      'Scale agile practices across the organization with appropriate frameworks, cadences, and governance.',
    descriptionPL:
      'Skalowanie praktyk agile w organizacji z odpowiednimi frameworkami, kadencjami i governance.',
    tags: ['agile', 'scaling', 'organization'],
    outputMapping: {
      reportSections: ['Scaling Framework Selection', 'Implementation Plan', 'Governance Design'],
      deckSlides: ['Agile at Scale Blueprint', 'Implementation Waves'],
      initiativeCategories: ['agile', 'transformation'],
    },
  },
  {
    slug: 'capability-skills-gap-analysis',
    name: 'Capability & Skills Gap Analysis',
    namePL: 'Analiza luk kompetencyjnych',
    category: 'digital_transformation',
    archetype: 'E',
    description:
      'Map current vs required capabilities and skills to build targeted development and hiring plans.',
    descriptionPL:
      'Mapowanie obecnych vs wymaganych kompetencji i umiejętności — plany rozwoju i rekrutacji.',
    tags: ['skills', 'capabilities', 'gap-analysis'],
    outputMapping: {
      reportSections: ['Capability Map', 'Gap Assessment', 'Development Plan'],
      deckSlides: ['Skills Gap Heat Map', 'Action Plan'],
      initiativeCategories: ['people', 'capabilities'],
    },
  },
  {
    slug: 'change-management-plan-adkar',
    name: 'Change Management Plan (ADKAR)',
    namePL: 'Plan zarządzania zmianą (ADKAR)',
    category: 'digital_transformation',
    archetype: 'G',
    description:
      'Plan organizational change using ADKAR: Awareness, Desire, Knowledge, Ability, Reinforcement.',
    descriptionPL:
      'Planowanie zmiany organizacyjnej wg ADKAR: Świadomość, Chęć, Wiedza, Umiejętność, Utrwalenie.',
    tags: ['change-management', 'adkar', 'people'],
    outputMapping: {
      reportSections: ['Stakeholder Analysis', 'ADKAR Assessment', 'Change Plan'],
      deckSlides: ['ADKAR Dashboard', 'Change Roadmap'],
      initiativeCategories: ['change-management', 'people'],
    },
  },
  {
    slug: 'digital-risk-assessment',
    name: 'Digital Risk Assessment',
    namePL: 'Ocena ryzyk cyfrowych',
    category: 'digital_transformation',
    archetype: 'E',
    description:
      'Identify and assess digital-specific risks across cyber, data, technology, and third-party domains.',
    descriptionPL:
      'Identyfikacja i ocena ryzyk cyfrowych: cyber, dane, technologia, dostawcy zewnętrzni.',
    tags: ['risk', 'digital', 'cybersecurity'],
    outputMapping: {
      reportSections: ['Risk Inventory', 'Impact Assessment', 'Mitigation Plan'],
      deckSlides: ['Risk Heat Map', 'Top Risks & Controls'],
      initiativeCategories: ['risk', 'security'],
    },
  },
];

// ---------------------------------------------------------------------------
// Combined registry
// ---------------------------------------------------------------------------

const ALL_TEMPLATES: ConsultingTemplate[] = [
  ...STRATEGY_TEMPLATES,
  ...OPERATIONS_TEMPLATES,
  ...DIGITAL_TRANSFORMATION_TEMPLATES,
];

const SLUG_INDEX = new Map<string, ConsultingTemplate>(ALL_TEMPLATES.map((t) => [t.slug, t]));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTemplate(slug: string): ConsultingTemplate | undefined {
  return SLUG_INDEX.get(slug);
}

export function getTemplatesByCategory(category: TemplateCategory): ConsultingTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByArchetype(archetype: TemplateArchetype): ConsultingTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.archetype === archetype);
}

export function getAllTemplates(): ConsultingTemplate[] {
  return [...ALL_TEMPLATES];
}

export {
  ALL_TEMPLATES,
  DIGITAL_TRANSFORMATION_TEMPLATES,
  OPERATIONS_TEMPLATES,
  STRATEGY_TEMPLATES,
};

// ---------------------------------------------------------------------------
// API-backed functions (DB first, in-memory fallback)
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env as any)?.VITE_API_URL || '/api';

async function fetchFromApi<T>(url: string): Promise<T | null> {
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTemplatesFromDB(params?: {
  lang?: string;
  category?: TemplateCategory;
  search?: string;
}): Promise<ConsultingTemplate[]> {
  const sp = new URLSearchParams();
  if (params?.lang) sp.append('lang', params.lang);
  if (params?.category) sp.append('category', params.category);
  if (params?.search) sp.append('search', params.search);
  sp.append('limit', '100');

  const result = await fetchFromApi<{ templates: any[] }>(
    `${API_URL}/consulting-templates?${sp.toString()}`
  );
  if (result?.templates?.length) {
    return result.templates.map((t: any) => ({
      slug: t.slug,
      name: t.name,
      namePL: t.name,
      category: t.category as TemplateCategory,
      archetype: t.archetype as TemplateArchetype,
      description: t.description,
      descriptionPL: t.description,
      tags: t.tags || [],
      outputMapping: t.outputMapping || {
        reportSections: [],
        deckSlides: [],
        initiativeCategories: [],
      },
    }));
  }
  return getAllTemplates();
}

export async function fetchTemplateFromDB(
  slug: string,
  lang?: string
): Promise<ConsultingTemplate | null> {
  const sp = new URLSearchParams();
  if (lang) sp.append('lang', lang);

  const result = await fetchFromApi<{ template: any }>(
    `${API_URL}/consulting-templates/${slug}?${sp.toString()}`
  );
  if (result?.template) {
    const t = result.template;
    return {
      slug: t.slug,
      name: t.name,
      namePL: t.name,
      category: t.category as TemplateCategory,
      archetype: t.archetype as TemplateArchetype,
      description: t.description,
      descriptionPL: t.description,
      tags: t.tags || [],
      outputMapping: t.outputMapping || {
        reportSections: [],
        deckSlides: [],
        initiativeCategories: [],
      },
    };
  }
  return getTemplate(slug) || null;
}
