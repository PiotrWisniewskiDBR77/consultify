/**
 * Default tool configurations for the V3 Tool Wizard Standard.
 * Each tool overrides steps and input fields as needed.
 *
 * Reference tool: Dynamic SWOT (demonstrates full wizard flow)
 */

import type { WizardInputField, WizardStepConfig, WizardStepId, WizardToolConfig } from './types';

/** Canonical 6-step wizard flow */
export const DEFAULT_WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 'define',
    label: { en: 'Define', pl: 'Określ' },
    description: { en: 'Intent, scope, and audience', pl: 'Cel, zakres i odbiorcy' },
  },
  {
    id: 'inputs',
    label: { en: 'Inputs & Assumptions', pl: 'Dane i założenia' },
    description: {
      en: 'Client data and consultant assumptions',
      pl: 'Dane klienta i założenia konsultanta',
    },
  },
  {
    id: 'work',
    label: { en: 'Work', pl: 'Praca' },
    description: { en: 'Analysis work surface', pl: 'Powierzchnia robocza analizy' },
  },
  {
    id: 'review',
    label: { en: 'Review', pl: 'Przegląd' },
    description: {
      en: 'Summaries, missing items, improvements',
      pl: 'Podsumowania, braki, ulepszenia',
    },
  },
  {
    id: 'finalize',
    label: { en: 'Finalize', pl: 'Finalizacja' },
    description: {
      en: 'Lock session for output creation',
      pl: 'Zablokuj sesję do tworzenia outputów',
    },
  },
  {
    id: 'outputs',
    label: { en: 'Outputs', pl: 'Wyniki' },
    description: {
      en: 'Create initiatives, reports, presentations',
      pl: 'Twórz inicjatywy, raporty, prezentacje',
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reusable input field fragments
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_COMPANY_NAME: WizardInputField = {
  id: 'companyName',
  label: { en: 'Company / Business Unit', pl: 'Firma / Jednostka biznesowa' },
  type: 'text',
  required: true,
  placeholder: { en: 'e.g. Acme Corp, EMEA Division', pl: 'np. Acme Corp, Dywizja EMEA' },
};

const FIELD_INDUSTRY: WizardInputField = {
  id: 'industry',
  label: { en: 'Industry', pl: 'Branża' },
  type: 'text',
  required: true,
  placeholder: { en: 'e.g. Manufacturing, Healthcare', pl: 'np. Produkcja, Ochrona zdrowia' },
};

const FIELD_STRATEGIC_CONTEXT: WizardInputField = {
  id: 'strategicContext',
  label: { en: 'Strategic Context', pl: 'Kontekst strategiczny' },
  type: 'textarea',
  placeholder: {
    en: 'Current strategy, key challenges, market position...',
    pl: 'Obecna strategia, kluczowe wyzwania, pozycja rynkowa...',
  },
  helpText: {
    en: 'Provide context to help AI generate better suggestions',
    pl: 'Podaj kontekst aby AI generowało lepsze sugestie',
  },
};

const FIELD_TIME_HORIZON: WizardInputField = {
  id: 'timeHorizon',
  label: { en: 'Time Horizon', pl: 'Horyzont czasowy' },
  type: 'select',
  required: true,
  options: [
    { value: '6m', label: { en: '6 months', pl: '6 miesięcy' } },
    { value: '1y', label: { en: '1 year', pl: '1 rok' } },
    { value: '3y', label: { en: '3 years', pl: '3 lata' } },
    { value: '5y', label: { en: '5+ years', pl: '5+ lat' } },
  ],
};

const FIELD_PROCESS_NAME: WizardInputField = {
  id: 'processName',
  label: { en: 'Process Name', pl: 'Nazwa procesu' },
  type: 'text',
  required: true,
  placeholder: { en: 'e.g. Order Fulfillment', pl: 'np. Realizacja zamówień' },
};

const FIELD_DEPARTMENT: WizardInputField = {
  id: 'department',
  label: { en: 'Department', pl: 'Dział' },
  type: 'text',
  placeholder: { en: 'e.g. Supply Chain, Finance', pl: 'np. Łańcuch dostaw, Finanse' },
};

const FIELD_CURRENT_STATE: WizardInputField = {
  id: 'currentState',
  label: { en: 'Current State', pl: 'Stan obecny' },
  type: 'textarea',
  placeholder: {
    en: 'Describe the current process, system, or situation...',
    pl: 'Opisz obecny proces, system lub sytuację...',
  },
};

const FIELD_TARGET_STATE: WizardInputField = {
  id: 'targetState',
  label: { en: 'Target State', pl: 'Stan docelowy' },
  type: 'textarea',
  placeholder: {
    en: 'Describe the desired future state...',
    pl: 'Opisz pożądany stan docelowy...',
  },
};

const FIELD_TECHNOLOGY_LANDSCAPE: WizardInputField = {
  id: 'technologyLandscape',
  label: { en: 'Technology Landscape', pl: 'Krajobraz technologiczny' },
  type: 'textarea',
  placeholder: {
    en: 'Key systems, platforms, and tools currently in use...',
    pl: 'Kluczowe systemy, platformy i narzędzia w użyciu...',
  },
};

const FIELD_BUDGET: WizardInputField = {
  id: 'budget',
  label: { en: 'Budget Range', pl: 'Zakres budżetu' },
  type: 'text',
  placeholder: { en: 'e.g. $100K–$500K', pl: 'np. 400K–2M PLN' },
};

const FIELD_DIGITAL_MATURITY: WizardInputField = {
  id: 'digitalMaturity',
  label: { en: 'Digital Maturity', pl: 'Dojrzałość cyfrowa' },
  type: 'select',
  options: [
    { value: 'low', label: { en: 'Low — mostly manual', pl: 'Niska — głównie manualne' } },
    {
      value: 'medium',
      label: { en: 'Medium — partial automation', pl: 'Średnia — częściowa automatyzacja' },
    },
    {
      value: 'high',
      label: { en: 'High — advanced digital', pl: 'Wysoka — zaawansowane cyfrowo' },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY TOOLS (surfaceType: 'workspace')
// ─────────────────────────────────────────────────────────────────────────────

/** Reference tool: Dynamic SWOT */
export const DYNAMIC_SWOT_CONFIG: WizardToolConfig = {
  toolType: 'dynamic-swot',
  toolName: { en: 'Dynamic SWOT', pl: 'Dynamiczny SWOT' },
  toolDescription: {
    en: 'AI-driven SWOT analysis with correlation matrix and initiative generation',
    pl: 'Analiza SWOT wspomagana AI z macierzą korelacji i generowaniem inicjatyw',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [FIELD_COMPANY_NAME, FIELD_INDUSTRY, FIELD_STRATEGIC_CONTEXT, FIELD_TIME_HORIZON],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const MARKET_FORCES_CONFIG: WizardToolConfig = {
  toolType: 'market-forces',
  toolName: { en: 'Market Forces', pl: 'Siły rynkowe' },
  toolDescription: {
    en: 'Analyze competitive forces, market dynamics, and industry trends',
    pl: 'Analiza sił konkurencyjnych, dynamiki rynku i trendów branżowych',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'marketScope',
      label: { en: 'Market Scope', pl: 'Zakres rynku' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Geographic regions, segments, customer types...',
        pl: 'Regiony, segmenty, typy klientów...',
      },
    },
    {
      id: 'keyCompetitors',
      label: { en: 'Key Competitors', pl: 'Kluczowi konkurenci' },
      type: 'textarea',
      placeholder: {
        en: 'List main competitors and their positioning...',
        pl: 'Wymień głównych konkurentów i ich pozycjonowanie...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const GROWTH_PATHS_CONFIG: WizardToolConfig = {
  toolType: 'growth-paths',
  toolName: { en: 'Growth Paths', pl: 'Ścieżki wzrostu' },
  toolDescription: {
    en: 'Identify and evaluate organic and inorganic growth opportunities',
    pl: 'Identyfikacja i ocena organicznych i nieorganicznych szans wzrostu',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'currentRevenue',
      label: { en: 'Current Revenue / Scale', pl: 'Obecne przychody / skala' },
      type: 'text',
      placeholder: { en: 'e.g. $50M ARR, 200 employees', pl: 'np. 200M PLN, 200 pracowników' },
    },
    {
      id: 'growthAmbition',
      label: { en: 'Growth Ambition', pl: 'Ambicja wzrostu' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Revenue targets, market share goals, expansion plans...',
        pl: 'Cele przychodowe, udział w rynku, plany ekspansji...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const VALUE_CHAIN_CONFIG: WizardToolConfig = {
  toolType: 'value-chain',
  toolName: { en: 'Value Chain', pl: 'Łańcuch wartości' },
  toolDescription: {
    en: 'Map and analyze the value chain to identify competitive advantages',
    pl: 'Mapowanie i analiza łańcucha wartości w celu identyfikacji przewag konkurencyjnych',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'valueChainScope',
      label: { en: 'Value Chain Scope', pl: 'Zakres łańcucha wartości' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Which activities to analyze: inbound, operations, outbound, marketing, service...',
        pl: 'Które aktywności analizować: logistyka, operacje, dystrybucja, marketing, serwis...',
      },
    },
    {
      id: 'costStructure',
      label: { en: 'Cost Structure Overview', pl: 'Przegląd struktury kosztów' },
      type: 'textarea',
      placeholder: {
        en: 'Key cost drivers and approximate breakdown...',
        pl: 'Kluczowe czynniki kosztowe i przybliżony podział...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const PORTFOLIO_PRIORITY_CONFIG: WizardToolConfig = {
  toolType: 'portfolio-priority',
  toolName: { en: 'Portfolio Priority', pl: 'Priorytetyzacja portfela' },
  toolDescription: {
    en: 'Prioritize products, projects, or investments using multi-criteria scoring',
    pl: 'Priorytetyzacja produktów, projektów lub inwestycji za pomocą wielokryterialnej oceny',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'portfolioItems',
      label: { en: 'Portfolio Items', pl: 'Elementy portfela' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List products, projects, or investments to prioritize...',
        pl: 'Wymień produkty, projekty lub inwestycje do priorytetyzacji...',
      },
    },
    {
      id: 'evaluationCriteria',
      label: { en: 'Evaluation Criteria', pl: 'Kryteria oceny' },
      type: 'textarea',
      placeholder: {
        en: 'e.g. ROI, strategic fit, risk, resource requirements...',
        pl: 'np. ROI, dopasowanie strategiczne, ryzyko, wymagane zasoby...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const RISK_UNCERTAINTY_CONFIG: WizardToolConfig = {
  toolType: 'risk-uncertainty',
  toolName: { en: 'Risk & Uncertainty', pl: 'Ryzyko i niepewność' },
  toolDescription: {
    en: 'Identify, assess, and plan mitigation for strategic risks and uncertainties',
    pl: 'Identyfikacja, ocena i planowanie mitygacji ryzyk strategicznych i niepewności',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'riskDomains',
      label: { en: 'Risk Domains', pl: 'Domeny ryzyka' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'e.g. market, regulatory, technology, operational, financial...',
        pl: 'np. rynkowe, regulacyjne, technologiczne, operacyjne, finansowe...',
      },
    },
    {
      id: 'riskTolerance',
      label: { en: 'Risk Tolerance', pl: 'Tolerancja ryzyka' },
      type: 'select',
      options: [
        { value: 'conservative', label: { en: 'Conservative', pl: 'Konserwatywna' } },
        { value: 'moderate', label: { en: 'Moderate', pl: 'Umiarkowana' } },
        { value: 'aggressive', label: { en: 'Aggressive', pl: 'Agresywna' } },
      ],
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const CAPABILITY_MAPPER_CONFIG: WizardToolConfig = {
  toolType: 'capability-mapper',
  toolName: { en: 'Capability Mapper', pl: 'Mapa zdolności' },
  toolDescription: {
    en: 'Map organizational capabilities and identify gaps versus strategic needs',
    pl: 'Mapowanie zdolności organizacyjnych i identyfikacja luk względem potrzeb strategicznych',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'capabilityDomains',
      label: { en: 'Capability Domains', pl: 'Domeny zdolności' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'e.g. technology, talent, processes, data, partnerships...',
        pl: 'np. technologia, talenty, procesy, dane, partnerstwa...',
      },
    },
    {
      id: 'strategicPriorities',
      label: { en: 'Strategic Priorities', pl: 'Priorytety strategiczne' },
      type: 'textarea',
      placeholder: {
        en: 'Key strategic goals that require specific capabilities...',
        pl: 'Kluczowe cele strategiczne wymagające określonych zdolności...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const AMBITION_DECOMPOSER_CONFIG: WizardToolConfig = {
  toolType: 'ambition-decomposer',
  toolName: { en: 'Ambition Decomposer', pl: 'Dekompozycja ambicji' },
  toolDescription: {
    en: 'Break down high-level ambitions into actionable strategic objectives and initiatives',
    pl: 'Rozbicie ambicji na konkretne cele strategiczne i inicjatywy',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'ambitionStatement',
      label: { en: 'Ambition Statement', pl: 'Deklaracja ambicji' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'e.g. Become the #1 digital-first insurer in CEE by 2028...',
        pl: 'np. Zostać liderem cyfrowych ubezpieczeń w CEE do 2028...',
      },
    },
    {
      id: 'constraints',
      label: { en: 'Constraints & Boundaries', pl: 'Ograniczenia i granice' },
      type: 'textarea',
      placeholder: {
        en: 'Budget limits, regulatory constraints, organizational boundaries...',
        pl: 'Limity budżetowe, ograniczenia regulacyjne, granice organizacyjne...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const FOCUS_TRADEOFF_CONFIG: WizardToolConfig = {
  toolType: 'focus-tradeoff',
  toolName: { en: 'Focus & Trade-off', pl: 'Fokus i kompromisy' },
  toolDescription: {
    en: 'Clarify strategic focus by making explicit trade-offs between competing priorities',
    pl: 'Wyjaśnienie fokusu strategicznego poprzez jawne kompromisy między konkurującymi priorytetami',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'competingPriorities',
      label: { en: 'Competing Priorities', pl: 'Konkurujące priorytety' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List the priorities that compete for resources and attention...',
        pl: 'Wymień priorytety konkurujące o zasoby i uwagę...',
      },
    },
    {
      id: 'decisionCriteria',
      label: { en: 'Decision Criteria', pl: 'Kryteria decyzyjne' },
      type: 'textarea',
      placeholder: {
        en: 'What matters most when choosing where to focus?',
        pl: 'Co jest najważniejsze przy wyborze fokusu?',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
    FIELD_TIME_HORIZON,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const NARRATIVE_ENGINE_CONFIG: WizardToolConfig = {
  toolType: 'narrative-engine',
  toolName: { en: 'Narrative Engine', pl: 'Silnik narracji' },
  toolDescription: {
    en: 'Craft a compelling strategic narrative that aligns stakeholders around a shared vision',
    pl: 'Tworzenie przekonującej narracji strategicznej łączącej interesariuszy wokół wspólnej wizji',
  },
  category: 'strategic',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'targetAudience',
      label: { en: 'Target Audience', pl: 'Grupa docelowa' },
      type: 'text',
      required: true,
      placeholder: {
        en: 'e.g. Board, investors, all-hands, customers',
        pl: 'np. Zarząd, inwestorzy, cała firma, klienci',
      },
    },
    {
      id: 'coreMessage',
      label: { en: 'Core Message / Thesis', pl: 'Główny przekaz / teza' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'The central idea you want the audience to take away...',
        pl: 'Główna idea, którą odbiorca ma zapamiętać...',
      },
    },
    {
      id: 'supportingEvidence',
      label: { en: 'Supporting Evidence', pl: 'Dowody wspierające' },
      type: 'textarea',
      placeholder: {
        en: 'Key data points, case studies, or achievements to include...',
        pl: 'Kluczowe dane, studia przypadków lub osiągnięcia do uwzględnienia...',
      },
    },
    FIELD_STRATEGIC_CONTEXT,
  ],
  outputCapabilities: ['report', 'presentation'],
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATIONS TOOLS (surfaceType: 'table' or 'hybrid')
// ─────────────────────────────────────────────────────────────────────────────

export const VSM_BUILDER_CONFIG: WizardToolConfig = {
  toolType: 'vsm-builder',
  toolName: { en: 'VSM Builder', pl: 'Kreator VSM' },
  toolDescription: {
    en: 'Build Value Stream Maps to visualize and optimize end-to-end process flow',
    pl: 'Tworzenie map strumienia wartości do wizualizacji i optymalizacji przepływu procesów',
  },
  category: 'operational',
  surfaceType: 'hybrid',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    FIELD_PROCESS_NAME,
    {
      id: 'valueStreamScope',
      label: { en: 'Value Stream Scope', pl: 'Zakres strumienia wartości' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'From trigger (e.g. customer order) to end (e.g. delivery)...',
        pl: 'Od wyzwalacza (np. zamówienie klienta) do końca (np. dostawa)...',
      },
    },
    FIELD_CURRENT_STATE,
    FIELD_TARGET_STATE,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const SOP_BUILDER_CONFIG: WizardToolConfig = {
  toolType: 'sop-builder',
  toolName: { en: 'SOP Builder', pl: 'Kreator SOP' },
  toolDescription: {
    en: 'Create and standardize Standard Operating Procedures for repeatable processes',
    pl: 'Tworzenie i standaryzacja procedur operacyjnych dla powtarzalnych procesów',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_PROCESS_NAME,
    FIELD_DEPARTMENT,
    {
      id: 'processOwner',
      label: { en: 'Process Owner', pl: 'Właściciel procesu' },
      type: 'text',
      placeholder: { en: 'e.g. Operations Manager', pl: 'np. Kierownik operacji' },
    },
    {
      id: 'processSteps',
      label: { en: 'Known Process Steps', pl: 'Znane kroki procesu' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List the main steps of the process as you know them...',
        pl: 'Wymień główne kroki procesu w obecnej formie...',
      },
    },
    {
      id: 'qualityRequirements',
      label: { en: 'Quality / Compliance Requirements', pl: 'Wymagania jakościowe / compliance' },
      type: 'textarea',
      placeholder: {
        en: 'ISO, regulatory, or internal quality standards...',
        pl: 'ISO, regulacje lub wewnętrzne standardy jakości...',
      },
    },
  ],
  outputCapabilities: ['report'],
};

export const A3_PROBLEM_SOLVING_CONFIG: WizardToolConfig = {
  toolType: 'a3-problem-solving',
  toolName: { en: 'A3 Problem Solving', pl: 'Rozwiązywanie problemów A3' },
  toolDescription: {
    en: 'Structured A3 problem-solving methodology for root cause analysis and countermeasures',
    pl: 'Strukturalna metodologia A3 do analizy przyczyn źródłowych i działań naprawczych',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_DEPARTMENT,
    {
      id: 'problemStatement',
      label: { en: 'Problem Statement', pl: 'Opis problemu' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Describe the problem clearly: what, where, when, magnitude...',
        pl: 'Opisz problem jasno: co, gdzie, kiedy, skala...',
      },
    },
    {
      id: 'businessImpact',
      label: { en: 'Business Impact', pl: 'Wpływ biznesowy' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Cost, quality, delivery, safety, or morale impact...',
        pl: 'Wpływ na koszty, jakość, dostawy, bezpieczeństwo lub morale...',
      },
    },
    FIELD_CURRENT_STATE,
    FIELD_TARGET_STATE,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const SMED_PLANNER_CONFIG: WizardToolConfig = {
  toolType: 'smed-planner',
  toolName: { en: 'SMED Planner', pl: 'Planer SMED' },
  toolDescription: {
    en: 'Plan Single-Minute Exchange of Die to reduce changeover times',
    pl: 'Planowanie szybkich przezbrojeń (SMED) w celu redukcji czasów przezbrojenia',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_PROCESS_NAME,
    {
      id: 'equipmentLine',
      label: { en: 'Equipment / Line', pl: 'Urządzenie / Linia' },
      type: 'text',
      required: true,
      placeholder: {
        en: 'e.g. CNC Mill #3, Packaging Line A',
        pl: 'np. Frezarka CNC #3, Linia pakowania A',
      },
    },
    {
      id: 'currentChangeoverTime',
      label: { en: 'Current Changeover Time', pl: 'Obecny czas przezbrojenia' },
      type: 'text',
      required: true,
      placeholder: { en: 'e.g. 45 minutes', pl: 'np. 45 minut' },
    },
    {
      id: 'targetChangeoverTime',
      label: { en: 'Target Changeover Time', pl: 'Docelowy czas przezbrojenia' },
      type: 'text',
      placeholder: { en: 'e.g. 10 minutes', pl: 'np. 10 minut' },
    },
    FIELD_CURRENT_STATE,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const DMS_BUILDER_CONFIG: WizardToolConfig = {
  toolType: 'dms-builder',
  toolName: { en: 'DMS Builder', pl: 'Kreator DMS' },
  toolDescription: {
    en: 'Design a Daily Management System with tiered meeting cadences and escalation paths',
    pl: 'Projektowanie systemu zarządzania dziennego z kaskadą spotkań i ścieżkami eskalacji',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_DEPARTMENT,
    {
      id: 'organizationLevels',
      label: { en: 'Organization Levels', pl: 'Poziomy organizacji' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'e.g. Team → Shift → Department → Plant → VP...',
        pl: 'np. Zespół → Zmiana → Dział → Zakład → VP...',
      },
    },
    {
      id: 'keyMetrics',
      label: { en: 'Key Metrics (KPIs)', pl: 'Kluczowe wskaźniki (KPI)' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Safety, Quality, Delivery, Cost, Morale...',
        pl: 'Bezpieczeństwo, Jakość, Dostawy, Koszty, Morale...',
      },
    },
    FIELD_CURRENT_STATE,
    FIELD_TARGET_STATE,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const CONSTRAINT_CONTROL_CONFIG: WizardToolConfig = {
  toolType: 'constraint-control',
  toolName: { en: 'Constraint Control', pl: 'Kontrola ograniczeń' },
  toolDescription: {
    en: 'Identify and manage system constraints using Theory of Constraints principles',
    pl: 'Identyfikacja i zarządzanie ograniczeniami systemu wg Teorii Ograniczeń',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_PROCESS_NAME,
    {
      id: 'systemBoundary',
      label: { en: 'System Boundary', pl: 'Granica systemu' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Define the system: from input to output, which stages are included...',
        pl: 'Zdefiniuj system: od wejścia do wyjścia, które etapy są uwzględnione...',
      },
    },
    {
      id: 'knownBottlenecks',
      label: { en: 'Known Bottlenecks', pl: 'Znane wąskie gardła' },
      type: 'textarea',
      placeholder: {
        en: 'Suspected or confirmed constraints in the system...',
        pl: 'Podejrzewane lub potwierdzone ograniczenia w systemie...',
      },
    },
    {
      id: 'throughputGoal',
      label: { en: 'Throughput Goal', pl: 'Cel przepustowości' },
      type: 'text',
      placeholder: { en: 'e.g. 500 units/day', pl: 'np. 500 sztuk/dzień' },
    },
    FIELD_CURRENT_STATE,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const DECISION_ENGINE_CONFIG: WizardToolConfig = {
  toolType: 'decision-engine',
  toolName: { en: 'Decision Engine', pl: 'Silnik decyzyjny' },
  toolDescription: {
    en: 'Structure complex operational decisions with multi-criteria analysis and scenario modeling',
    pl: 'Strukturyzacja złożonych decyzji operacyjnych z analizą wielokryterialną i modelowaniem scenariuszy',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_DEPARTMENT,
    {
      id: 'decisionStatement',
      label: { en: 'Decision Statement', pl: 'Opis decyzji' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'What decision needs to be made? What are the options?',
        pl: 'Jaka decyzja musi zostać podjęta? Jakie są opcje?',
      },
    },
    {
      id: 'evaluationCriteria',
      label: { en: 'Evaluation Criteria', pl: 'Kryteria oceny' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Cost, speed, risk, quality, strategic alignment...',
        pl: 'Koszt, szybkość, ryzyko, jakość, dopasowanie strategiczne...',
      },
    },
    {
      id: 'stakeholders',
      label: { en: 'Key Stakeholders', pl: 'Kluczowi interesariusze' },
      type: 'textarea',
      placeholder: {
        en: 'Who is affected and who decides?',
        pl: 'Kogo dotyczy i kto podejmuje decyzję?',
      },
    },
    FIELD_CURRENT_STATE,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const CONTROL_TOWER_CONFIG: WizardToolConfig = {
  toolType: 'control-tower',
  toolName: { en: 'Control Tower', pl: 'Wieża kontrolna' },
  toolDescription: {
    en: 'Design an operations control tower for real-time visibility and exception management',
    pl: 'Projektowanie wieży kontrolnej operacji do monitoringu w czasie rzeczywistym i zarządzania wyjątkami',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_DEPARTMENT,
    {
      id: 'monitoringScope',
      label: { en: 'Monitoring Scope', pl: 'Zakres monitoringu' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Which processes, KPIs, and data sources to monitor...',
        pl: 'Które procesy, KPI i źródła danych monitorować...',
      },
    },
    {
      id: 'escalationRules',
      label: { en: 'Escalation Rules', pl: 'Reguły eskalacji' },
      type: 'textarea',
      placeholder: {
        en: 'When and how should issues be escalated?',
        pl: 'Kiedy i jak powinny być eskalowane problemy?',
      },
    },
    {
      id: 'dataSources',
      label: { en: 'Data Sources', pl: 'Źródła danych' },
      type: 'textarea',
      placeholder: {
        en: 'ERP, MES, IoT sensors, manual inputs...',
        pl: 'ERP, MES, czujniki IoT, dane ręczne...',
      },
    },
    FIELD_CURRENT_STATE,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const AUTOMATION_PIPELINE_CONFIG: WizardToolConfig = {
  toolType: 'automation-pipeline',
  toolName: { en: 'Automation Pipeline', pl: 'Pipeline automatyzacji' },
  toolDescription: {
    en: 'Build and prioritize a pipeline of automation opportunities across operations',
    pl: "Budowa i priorytetyzacja pipeline'u możliwości automatyzacji w operacjach",
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    FIELD_DEPARTMENT,
    {
      id: 'automationCandidates',
      label: { en: 'Automation Candidates', pl: 'Kandydaci do automatyzacji' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List processes or tasks that could be automated...',
        pl: 'Wymień procesy lub zadania, które mogą być zautomatyzowane...',
      },
    },
    {
      id: 'technologyConstraints',
      label: { en: 'Technology Constraints', pl: 'Ograniczenia technologiczne' },
      type: 'textarea',
      placeholder: {
        en: 'Existing systems, integration limits, IT policies...',
        pl: 'Istniejące systemy, limity integracji, polityki IT...',
      },
    },
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const INVENTORY_AUTOPILOT_CONFIG: WizardToolConfig = {
  toolType: 'inventory-autopilot',
  toolName: { en: 'Inventory Autopilot', pl: 'Autopilot zapasów' },
  toolDescription: {
    en: 'Optimize inventory levels with demand forecasting and replenishment strategies',
    pl: 'Optymalizacja poziomów zapasów z prognozowaniem popytu i strategiami uzupełniania',
  },
  category: 'operational',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'inventoryScope',
      label: { en: 'Inventory Scope', pl: 'Zakres zapasów' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'SKU categories, warehouses, product families...',
        pl: 'Kategorie SKU, magazyny, rodziny produktów...',
      },
    },
    {
      id: 'currentInventoryValue',
      label: { en: 'Current Inventory Value', pl: 'Obecna wartość zapasów' },
      type: 'text',
      placeholder: { en: 'e.g. $5M across 3 warehouses', pl: 'np. 20M PLN w 3 magazynach' },
    },
    {
      id: 'demandPattern',
      label: { en: 'Demand Pattern', pl: 'Wzorzec popytu' },
      type: 'select',
      options: [
        { value: 'stable', label: { en: 'Stable / Predictable', pl: 'Stabilny / Przewidywalny' } },
        { value: 'seasonal', label: { en: 'Seasonal', pl: 'Sezonowy' } },
        {
          value: 'volatile',
          label: { en: 'Volatile / Unpredictable', pl: 'Zmienny / Nieprzewidywalny' },
        },
        { value: 'mixed', label: { en: 'Mixed', pl: 'Mieszany' } },
      ],
    },
    FIELD_CURRENT_STATE,
  ],
  outputCapabilities: ['initiative', 'report'],
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATION TOOL (surfaceType: 'hybrid') — already defined above
// ─────────────────────────────────────────────────────────────────────────────

/** Process Automation — hybrid workspace+table (V3-E05 reference) */
export const PROCESS_AUTOMATION_CONFIG: WizardToolConfig = {
  toolType: 'process-automation',
  toolName: { en: 'Process Automation', pl: 'Automatyzacja Procesów' },
  toolDescription: {
    en: 'Map, analyze, and optimize business processes for automation',
    pl: 'Mapuj, analizuj i optymalizuj procesy biznesowe pod kątem automatyzacji',
  },
  category: 'automation',
  surfaceType: 'hybrid',
  steps: [
    {
      id: 'define',
      label: { en: 'Define', pl: 'Określ' },
      description: { en: 'Intent, scope, and audience', pl: 'Cel, zakres i odbiorcy' },
    },
    {
      id: 'inputs',
      label: { en: 'Inputs & Assumptions', pl: 'Dane i założenia' },
      description: {
        en: 'Process context, pain points, automation goals',
        pl: 'Kontekst procesu, problemy, cele automatyzacji',
      },
    },
    {
      id: 'work',
      label: { en: 'Process Map', pl: 'Mapa procesu' },
      description: {
        en: 'Editable process steps table + flow visualization',
        pl: 'Edytowalna tabela kroków + wizualizacja przepływu',
      },
    },
    {
      id: 'review',
      label: { en: 'Review', pl: 'Przegląd' },
      description: {
        en: 'Summaries, missing items, improvements',
        pl: 'Podsumowania, braki, ulepszenia',
      },
    },
    {
      id: 'finalize',
      label: { en: 'Finalize', pl: 'Finalizacja' },
      description: {
        en: 'Lock session for output creation',
        pl: 'Zablokuj sesję do tworzenia outputów',
      },
    },
    {
      id: 'outputs',
      label: { en: 'Outputs', pl: 'Wyniki' },
      description: {
        en: 'Process map report, feasibility matrix, ROI, recommended tools',
        pl: 'Raport mapy procesu, macierz wykonalności, ROI, rekomendowane narzędzia',
      },
    },
  ],
  inputFields: [
    FIELD_PROCESS_NAME,
    {
      id: 'processOwner',
      label: { en: 'Process Owner', pl: 'Właściciel procesu' },
      type: 'text',
      placeholder: { en: 'e.g. Operations Manager', pl: 'np. Kierownik operacji' },
    },
    FIELD_DEPARTMENT,
    {
      id: 'scope',
      label: { en: 'Scope (which areas)', pl: 'Zakres (które obszary)' },
      type: 'textarea',
      placeholder: {
        en: 'Which parts of the process are in scope?',
        pl: 'Które części procesu są w zakresie?',
      },
    },
    {
      id: 'currentPainPoints',
      label: { en: 'Current Pain Points', pl: 'Obecne problemy' },
      type: 'textarea',
      placeholder: {
        en: 'Bottlenecks, manual steps, errors, delays...',
        pl: 'Wąskie gardła, manualne kroki, błędy, opóźnienia...',
      },
    },
    {
      id: 'automationGoals',
      label: { en: 'Automation Goals', pl: 'Cele automatyzacji' },
      type: 'textarea',
      placeholder: {
        en: 'What do you want to achieve with automation?',
        pl: 'Co chcesz osiągnąć dzięki automatyzacji?',
      },
    },
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL TOOLS
// ─────────────────────────────────────────────────────────────────────────────

export const ROBOTICS_FEASIBILITY_CONFIG: WizardToolConfig = {
  toolType: 'robotics-feasibility',
  toolName: { en: 'Robotics Feasibility', pl: 'Wykonalność robotyzacji' },
  toolDescription: {
    en: 'Assess feasibility and ROI of robotic automation for physical processes',
    pl: 'Ocena wykonalności i ROI automatyzacji robotycznej dla procesów fizycznych',
  },
  category: 'digital',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'processesToAutomate',
      label: { en: 'Processes to Automate', pl: 'Procesy do automatyzacji' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Describe physical tasks or processes considered for robotics...',
        pl: 'Opisz zadania fizyczne lub procesy rozważane do robotyzacji...',
      },
    },
    {
      id: 'currentLabourCost',
      label: { en: 'Current Labour Cost', pl: 'Obecny koszt pracy' },
      type: 'text',
      placeholder: { en: 'e.g. $200K/year for 5 FTEs', pl: 'np. 800K PLN/rok dla 5 FTE' },
    },
    FIELD_TECHNOLOGY_LANDSCAPE,
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const LOGISTICS_AUTOMATION_CONFIG: WizardToolConfig = {
  toolType: 'logistics-automation',
  toolName: { en: 'Logistics Automation', pl: 'Automatyzacja logistyki' },
  toolDescription: {
    en: 'Identify and plan automation opportunities across the logistics chain',
    pl: 'Identyfikacja i planowanie możliwości automatyzacji w łańcuchu logistycznym',
  },
  category: 'digital',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'logisticsScope',
      label: { en: 'Logistics Scope', pl: 'Zakres logistyki' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Warehousing, transport, last-mile, returns...',
        pl: 'Magazynowanie, transport, ostatnia mila, zwroty...',
      },
    },
    {
      id: 'volumeMetrics',
      label: { en: 'Volume Metrics', pl: 'Metryki wolumenu' },
      type: 'textarea',
      placeholder: {
        en: 'Orders/day, SKUs, warehouse size, fleet size...',
        pl: 'Zamówienia/dzień, SKU, wielkość magazynu, flota...',
      },
    },
    FIELD_TECHNOLOGY_LANDSCAPE,
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const RPA_SCANNER_CONFIG: WizardToolConfig = {
  toolType: 'rpa-scanner',
  toolName: { en: 'RPA Scanner', pl: 'Skaner RPA' },
  toolDescription: {
    en: 'Scan business processes to identify and score RPA automation candidates',
    pl: 'Skanowanie procesów biznesowych w celu identyfikacji i oceny kandydatów do RPA',
  },
  category: 'digital',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_DEPARTMENT,
    {
      id: 'candidateProcesses',
      label: { en: 'Candidate Processes', pl: 'Procesy kandydujące' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List repetitive, rule-based processes to evaluate for RPA...',
        pl: 'Wymień powtarzalne, oparte na regułach procesy do oceny RPA...',
      },
    },
    {
      id: 'currentFTEs',
      label: { en: 'Current FTEs Involved', pl: 'Obecne FTE zaangażowane' },
      type: 'text',
      placeholder: { en: 'e.g. 12 FTEs across 3 departments', pl: 'np. 12 FTE w 3 działach' },
    },
    FIELD_TECHNOLOGY_LANDSCAPE,
    FIELD_DIGITAL_MATURITY,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const AI_DISCOVERY_CONFIG: WizardToolConfig = {
  toolType: 'ai-discovery',
  toolName: { en: 'AI Discovery', pl: 'Odkrywanie AI' },
  toolDescription: {
    en: 'Discover and prioritize AI/ML use cases across the organization',
    pl: 'Odkrywanie i priorytetyzacja przypadków użycia AI/ML w organizacji',
  },
  category: 'digital',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'businessChallenges',
      label: { en: 'Business Challenges', pl: 'Wyzwania biznesowe' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Key business problems where AI could help...',
        pl: 'Kluczowe problemy biznesowe, w których AI mogłoby pomóc...',
      },
    },
    {
      id: 'dataAvailability',
      label: { en: 'Data Availability', pl: 'Dostępność danych' },
      type: 'textarea',
      placeholder: {
        en: 'What data is available? Quality, volume, accessibility...',
        pl: 'Jakie dane są dostępne? Jakość, wolumen, dostępność...',
      },
    },
    FIELD_DIGITAL_MATURITY,
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const INTEGRATION_DIAGNOSTIC_CONFIG: WizardToolConfig = {
  toolType: 'integration-diagnostic',
  toolName: { en: 'Integration Diagnostic', pl: 'Diagnostyka integracji' },
  toolDescription: {
    en: 'Diagnose integration gaps and design target integration architecture',
    pl: 'Diagnoza luk integracyjnych i projektowanie docelowej architektury integracji',
  },
  category: 'digital',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    FIELD_TECHNOLOGY_LANDSCAPE,
    {
      id: 'integrationPainPoints',
      label: { en: 'Integration Pain Points', pl: 'Problemy integracyjne' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Data silos, manual transfers, sync issues, API gaps...',
        pl: 'Silosy danych, ręczne transfery, problemy z synchronizacją, braki API...',
      },
    },
    {
      id: 'keySystemsCount',
      label: { en: 'Number of Key Systems', pl: 'Liczba kluczowych systemów' },
      type: 'number',
      placeholder: { en: 'e.g. 15', pl: 'np. 15' },
    },
    FIELD_DIGITAL_MATURITY,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const DIGITAL_VALUE_POOL_CONFIG: WizardToolConfig = {
  toolType: 'digital-value-pool',
  toolName: { en: 'Digital Value Pool', pl: 'Pula wartości cyfrowej' },
  toolDescription: {
    en: 'Quantify the value potential of digital initiatives across the organization',
    pl: 'Kwantyfikacja potencjału wartości inicjatyw cyfrowych w organizacji',
  },
  category: 'digital',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'digitalInitiatives',
      label: { en: 'Digital Initiatives', pl: 'Inicjatywy cyfrowe' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List planned or potential digital initiatives...',
        pl: 'Wymień planowane lub potencjalne inicjatywy cyfrowe...',
      },
    },
    {
      id: 'revenueBase',
      label: { en: 'Revenue Base', pl: 'Baza przychodowa' },
      type: 'text',
      placeholder: { en: 'e.g. $100M annual revenue', pl: 'np. 400M PLN rocznych przychodów' },
    },
    FIELD_DIGITAL_MATURITY,
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const LEGACY_ANALYZER_CONFIG: WizardToolConfig = {
  toolType: 'legacy-analyzer',
  toolName: { en: 'Legacy Analyzer', pl: 'Analizator systemów legacy' },
  toolDescription: {
    en: 'Assess legacy systems for modernization readiness and migration planning',
    pl: 'Ocena systemów legacy pod kątem gotowości do modernizacji i planowania migracji',
  },
  category: 'digital',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'legacySystems',
      label: { en: 'Legacy Systems', pl: 'Systemy legacy' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List systems to assess: name, age, technology, criticality...',
        pl: 'Wymień systemy do oceny: nazwa, wiek, technologia, krytyczność...',
      },
    },
    {
      id: 'modernizationDrivers',
      label: { en: 'Modernization Drivers', pl: 'Czynniki modernizacji' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Why modernize? End of support, performance, cost, compliance...',
        pl: 'Dlaczego modernizować? Koniec wsparcia, wydajność, koszty, compliance...',
      },
    },
    FIELD_TECHNOLOGY_LANDSCAPE,
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const DATA_INVENTORY_CONFIG: WizardToolConfig = {
  toolType: 'data-inventory',
  toolName: { en: 'Data Inventory', pl: 'Inwentaryzacja danych' },
  toolDescription: {
    en: 'Catalog and assess data assets for quality, governance, and monetization potential',
    pl: 'Katalogowanie i ocena zasobów danych pod kątem jakości, governance i potencjału monetyzacji',
  },
  category: 'digital',
  surfaceType: 'table',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'dataDomains',
      label: { en: 'Data Domains', pl: 'Domeny danych' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'Customer, product, financial, operational, IoT...',
        pl: 'Klient, produkt, finansowe, operacyjne, IoT...',
      },
    },
    {
      id: 'dataGovernanceStatus',
      label: { en: 'Data Governance Status', pl: 'Status governance danych' },
      type: 'select',
      options: [
        { value: 'none', label: { en: 'No formal governance', pl: 'Brak formalnego governance' } },
        { value: 'basic', label: { en: 'Basic policies in place', pl: 'Podstawowe polityki' } },
        {
          value: 'mature',
          label: { en: 'Mature governance framework', pl: 'Dojrzały framework governance' },
        },
      ],
    },
    FIELD_TECHNOLOGY_LANDSCAPE,
    FIELD_DIGITAL_MATURITY,
  ],
  outputCapabilities: ['initiative', 'report'],
};

export const PAIN_TO_SOLUTION_CONFIG: WizardToolConfig = {
  toolType: 'pain-to-solution',
  toolName: { en: 'Pain-to-Solution', pl: 'Od problemu do rozwiązania' },
  toolDescription: {
    en: 'Map business pain points to digital solutions with feasibility and impact scoring',
    pl: 'Mapowanie problemów biznesowych na rozwiązania cyfrowe z oceną wykonalności i wpływu',
  },
  category: 'digital',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'painPoints',
      label: { en: 'Pain Points', pl: 'Problemy' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'List the top business pain points to address...',
        pl: 'Wymień najważniejsze problemy biznesowe do rozwiązania...',
      },
    },
    {
      id: 'solutionConstraints',
      label: { en: 'Solution Constraints', pl: 'Ograniczenia rozwiązań' },
      type: 'textarea',
      placeholder: {
        en: 'Technology, budget, timeline, or organizational constraints...',
        pl: 'Ograniczenia technologiczne, budżetowe, czasowe lub organizacyjne...',
      },
    },
    FIELD_DIGITAL_MATURITY,
    FIELD_BUDGET,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

export const PAIN_EXPLORER_CONFIG: WizardToolConfig = {
  toolType: 'pain-explorer',
  toolName: { en: 'Pain Explorer', pl: 'Eksplorator problemów' },
  toolDescription: {
    en: 'Deep-dive into organizational pain points with root cause analysis and impact mapping',
    pl: 'Pogłębiona analiza problemów organizacyjnych z analizą przyczyn źródłowych i mapowaniem wpływu',
  },
  category: 'digital',
  surfaceType: 'workspace',
  steps: DEFAULT_WIZARD_STEPS,
  inputFields: [
    FIELD_COMPANY_NAME,
    FIELD_INDUSTRY,
    {
      id: 'painArea',
      label: { en: 'Pain Area', pl: 'Obszar problemu' },
      type: 'text',
      required: true,
      placeholder: {
        en: 'e.g. Customer onboarding, Invoice processing',
        pl: 'np. Onboarding klienta, Przetwarzanie faktur',
      },
    },
    {
      id: 'symptoms',
      label: { en: 'Observed Symptoms', pl: 'Obserwowane objawy' },
      type: 'textarea',
      required: true,
      placeholder: {
        en: 'What problems are visible? Delays, errors, complaints...',
        pl: 'Jakie problemy są widoczne? Opóźnienia, błędy, skargi...',
      },
    },
    {
      id: 'affectedStakeholders',
      label: { en: 'Affected Stakeholders', pl: 'Dotknięci interesariusze' },
      type: 'textarea',
      placeholder: {
        en: 'Who is impacted? Customers, employees, partners...',
        pl: 'Kogo to dotyczy? Klienci, pracownicy, partnerzy...',
      },
    },
    FIELD_DIGITAL_MATURITY,
  ],
  outputCapabilities: ['initiative', 'report', 'presentation'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

/** Registry of all tool configs — tools not listed here get a generic config */
export const TOOL_WIZARD_CONFIGS: Record<string, WizardToolConfig> = {
  // Strategy
  'dynamic-swot': DYNAMIC_SWOT_CONFIG,
  'market-forces': MARKET_FORCES_CONFIG,
  'growth-paths': GROWTH_PATHS_CONFIG,
  'value-chain': VALUE_CHAIN_CONFIG,
  'portfolio-priority': PORTFOLIO_PRIORITY_CONFIG,
  'risk-uncertainty': RISK_UNCERTAINTY_CONFIG,
  'capability-mapper': CAPABILITY_MAPPER_CONFIG,
  'ambition-decomposer': AMBITION_DECOMPOSER_CONFIG,
  'focus-tradeoff': FOCUS_TRADEOFF_CONFIG,
  'narrative-engine': NARRATIVE_ENGINE_CONFIG,
  // Operations
  'vsm-builder': VSM_BUILDER_CONFIG,
  'sop-builder': SOP_BUILDER_CONFIG,
  'a3-problem-solving': A3_PROBLEM_SOLVING_CONFIG,
  'smed-planner': SMED_PLANNER_CONFIG,
  'dms-builder': DMS_BUILDER_CONFIG,
  'constraint-control': CONSTRAINT_CONTROL_CONFIG,
  'decision-engine': DECISION_ENGINE_CONFIG,
  'control-tower': CONTROL_TOWER_CONFIG,
  'automation-pipeline': AUTOMATION_PIPELINE_CONFIG,
  'inventory-autopilot': INVENTORY_AUTOPILOT_CONFIG,
  // Automation
  'process-automation': PROCESS_AUTOMATION_CONFIG,
  // Digital
  'robotics-feasibility': ROBOTICS_FEASIBILITY_CONFIG,
  'logistics-automation': LOGISTICS_AUTOMATION_CONFIG,
  'rpa-scanner': RPA_SCANNER_CONFIG,
  'ai-discovery': AI_DISCOVERY_CONFIG,
  'integration-diagnostic': INTEGRATION_DIAGNOSTIC_CONFIG,
  'digital-value-pool': DIGITAL_VALUE_POOL_CONFIG,
  'legacy-analyzer': LEGACY_ANALYZER_CONFIG,
  'data-inventory': DATA_INVENTORY_CONFIG,
  'pain-to-solution': PAIN_TO_SOLUTION_CONFIG,
  'pain-explorer': PAIN_EXPLORER_CONFIG,
};

/** Create a generic config for tools not in the registry */
export function getToolWizardConfig(toolType: string, toolName?: string): WizardToolConfig {
  if (TOOL_WIZARD_CONFIGS[toolType]) {
    return TOOL_WIZARD_CONFIGS[toolType];
  }

  return {
    toolType,
    toolName: { en: toolName || toolType, pl: toolName || toolType },
    category: 'strategic',
    surfaceType: 'workspace',
    steps: DEFAULT_WIZARD_STEPS,
    inputFields: [],
    outputCapabilities: ['initiative', 'report'],
  };
}
