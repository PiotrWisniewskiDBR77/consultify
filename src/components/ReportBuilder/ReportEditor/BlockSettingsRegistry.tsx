/**
 * BlockSettingsRegistry
 *
 * Maps block types to their available settings.
 * These settings are sent to the backend as `blockSettings` and translated
 * into AI prompt guidance by `buildSettingsGuidance()` in reportGenerationService.
 *
 * Each setting definition includes UI metadata (type, label, options)
 * so the BlockCard can render dynamic settings panels.
 */

// ==========================================
// TYPES
// ==========================================

export type SettingType = 'select' | 'number' | 'toggle' | 'text' | 'textarea' | 'button-group';

export interface SettingOption {
  value: string;
  label: string;
  labelPl: string;
  icon?: string;
}

export interface SettingDefinition {
  key: string;
  type: SettingType;
  label: string;
  labelPl: string;
  description?: string;
  descriptionPl?: string;
  options?: SettingOption[];
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  /** Placeholder for text/textarea */
  placeholder?: string;
  placeholderPl?: string;
  /** Settings group for visual organization */
  group: 'content' | 'format' | 'filters' | 'display' | 'advanced' | 'blueprint' | 'quality';
}

export interface BlockSettingsDefinition {
  blockType: string;
  /** Also match on blockTypeId from the library */
  blockTypeIds?: string[];
  settings: SettingDefinition[];
  /** Quick presets - named combinations of settings */
  presets?: {
    id: string;
    label: string;
    labelPl: string;
    values: Record<string, unknown>;
  }[];
}

// ==========================================
// SETTING GROUP LABELS
// ==========================================

export const SETTING_GROUP_LABELS: Record<string, { label: string; labelPl: string }> = {
  blueprint: { label: 'Block Blueprint', labelPl: 'Schemat bloku' },
  content: { label: 'Content', labelPl: 'Treść' },
  format: { label: 'Format', labelPl: 'Format' },
  filters: { label: 'Filters', labelPl: 'Filtry' },
  display: { label: 'Display', labelPl: 'Wyświetlanie' },
  advanced: { label: 'Advanced', labelPl: 'Zaawansowane' },
  quality: { label: 'Quality & Structure', labelPl: 'Jakość i struktura' },
};

// ==========================================
// SHARED SETTINGS (reusable across block types)
// ==========================================

const OUTPUT_FORMAT: SettingDefinition = {
  key: 'outputFormat',
  type: 'button-group',
  label: 'Output Format',
  labelPl: 'Format wyjścia',
  group: 'format',
  defaultValue: 'mixed',
  options: [
    { value: 'prose', label: 'Prose', labelPl: 'Tekst ciągły' },
    { value: 'bullets', label: 'Bullets', labelPl: 'Punkty' },
    { value: 'mixed', label: 'Mixed', labelPl: 'Mieszany' },
  ],
};

const ANALYSIS_DEPTH: SettingDefinition = {
  key: 'analysisDepth',
  type: 'button-group',
  label: 'Analysis Depth',
  labelPl: 'Głębokość analizy',
  group: 'content',
  defaultValue: 'detailed',
  options: [
    { value: 'overview', label: 'Overview', labelPl: 'Przegląd' },
    { value: 'detailed', label: 'Detailed', labelPl: 'Szczegółowa' },
    { value: 'comprehensive', label: 'Comprehensive', labelPl: 'Kompleksowa' },
  ],
};

const TIME_HORIZON: SettingDefinition = {
  key: 'timeHorizon',
  type: 'button-group',
  label: 'Time Horizon',
  labelPl: 'Horyzont czasowy',
  group: 'content',
  defaultValue: 'medium',
  options: [
    { value: 'short', label: '0-3 mo', labelPl: '0-3 mies.' },
    { value: 'medium', label: '3-12 mo', labelPl: '3-12 mies.' },
    { value: 'long', label: '12+ mo', labelPl: '12+ mies.' },
  ],
};

const PRIORITIZATION: SettingDefinition = {
  key: 'prioritization',
  type: 'button-group',
  label: 'Prioritization',
  labelPl: 'Priorytetyzacja',
  group: 'content',
  defaultValue: 'impact',
  options: [
    { value: 'impact', label: 'By Impact', labelPl: 'Wg wpływu' },
    { value: 'effort', label: 'By Effort', labelPl: 'Wg nakładu' },
    { value: 'quick_wins', label: 'Quick Wins', labelPl: 'Szybkie wygrane' },
  ],
};

const INCLUDE_EVIDENCE: SettingDefinition = {
  key: 'includeEvidence',
  type: 'toggle',
  label: 'Include Evidence',
  labelPl: 'Dodaj dowody',
  descriptionPl: 'Podaj uzasadnienia i przykłady dla każdego wniosku',
  group: 'content',
  defaultValue: false,
};

const INCLUDE_KEY_METRICS: SettingDefinition = {
  key: 'includeKeyMetrics',
  type: 'toggle',
  label: 'Include Metrics',
  labelPl: 'Dodaj metryki',
  group: 'content',
  defaultValue: false,
};

const HIGHLIGHT_GAPS: SettingDefinition = {
  key: 'highlightGaps',
  type: 'toggle',
  label: 'Highlight Gaps',
  labelPl: 'Podkreśl luki',
  group: 'display',
  defaultValue: false,
};

const INCLUDE_COMPARISONS: SettingDefinition = {
  key: 'includeComparisons',
  type: 'toggle',
  label: 'Benchmark Comparisons',
  labelPl: 'Porównania z benchmarkami',
  group: 'content',
  defaultValue: false,
};

const EXECUTIVE_STYLE: SettingDefinition = {
  key: 'executiveStyle',
  type: 'toggle',
  label: 'Executive Style',
  labelPl: 'Styl zarządczy',
  descriptionPl: 'Zwięzły, nastawiony na działanie',
  group: 'format',
  defaultValue: false,
};

// ==========================================
// BLUEPRINT SETTINGS (REQ-1)
// ==========================================

const CONTENT_INSTRUCTIONS: SettingDefinition = {
  key: 'contentInstructions',
  type: 'textarea',
  label: 'Content Instructions',
  labelPl: 'Instrukcje treści',
  description: 'Tell AI exactly what to include in this block',
  descriptionPl: 'Powiedz AI dokładnie co ma zawierać ten blok',
  placeholder: 'E.g., "Start with a brief overview of current state, then list 5 key gaps with evidence, conclude with a priority ranking"',
  placeholderPl: 'Np. "Zacznij od przeglądu stanu obecnego, wymień 5 kluczowych luk z uzasadnieniem, zakończ rankingiem priorytetów"',
  group: 'quality',
  defaultValue: '',
};

const REQUIRED_SECTIONS_LIST: SettingDefinition = {
  key: 'requiredSectionsList',
  type: 'textarea',
  label: 'Required Sub-sections',
  labelPl: 'Wymagane podsekcje',
  description: 'List of sub-sections that must appear (one per line)',
  descriptionPl: 'Lista podsekcji które muszą się pojawić (jedna na linię)',
  placeholder: 'Key Findings\nStrategic Implications\nRecommended Actions\nRisk Assessment',
  placeholderPl: 'Kluczowe wnioski\nImplikacje strategiczne\nRekomendowane działania\nOcena ryzyka',
  group: 'quality',
  defaultValue: '',
};

const OUTPUT_STRUCTURE: SettingDefinition = {
  key: 'outputStructure',
  type: 'button-group',
  label: 'Output Structure',
  labelPl: 'Struktura wyjścia',
  description: 'Expected structure of the generated content',
  descriptionPl: 'Oczekiwana struktura wygenerowanej treści',
  group: 'quality',
  defaultValue: 'auto',
  options: [
    { value: 'auto', label: 'Auto', labelPl: 'Automatycznie' },
    { value: 'narrative', label: 'Narrative', labelPl: 'Narracja' },
    { value: 'structured', label: 'Structured', labelPl: 'Uporządkowane' },
    { value: 'data_driven', label: 'Data-driven', labelPl: 'Oparte o dane' },
  ],
};

const MIN_ITEMS_COUNT: SettingDefinition = {
  key: 'minItemsCount',
  type: 'number',
  label: 'Min Items/Points',
  labelPl: 'Min. liczba punktów',
  description: 'Minimum number of items, findings, or recommendations',
  descriptionPl: 'Minimalna liczba elementów, wniosków lub rekomendacji',
  group: 'blueprint',
  defaultValue: 3,
  min: 1,
  max: 20,
};

const MAX_ITEMS_COUNT: SettingDefinition = {
  key: 'maxItemsCount',
  type: 'number',
  label: 'Max Items/Points',
  labelPl: 'Maks. liczba punktów',
  group: 'blueprint',
  defaultValue: 10,
  min: 1,
  max: 30,
};

const REQUIRE_DATA_REFERENCES: SettingDefinition = {
  key: 'requireDataReferences',
  type: 'toggle',
  label: 'Require Data References',
  labelPl: 'Wymagaj odniesień do danych',
  description: 'Force AI to cite specific scores and data points',
  descriptionPl: 'Wymuś cytowanie konkretnych wyników i danych',
  group: 'quality',
  defaultValue: false,
};

const REQUIRE_ACTIONABLE: SettingDefinition = {
  key: 'requireActionable',
  type: 'toggle',
  label: 'Require Actionable Conclusions',
  labelPl: 'Wymagaj wniosków praktycznych',
  description: 'Each section must end with concrete next steps',
  descriptionPl: 'Każda sekcja musi kończyć się konkretnymi krokami',
  group: 'quality',
  defaultValue: false,
};

const FORBIDDEN_TOPICS: SettingDefinition = {
  key: 'forbiddenTopics',
  type: 'text',
  label: 'Excluded Topics',
  labelPl: 'Wykluczone tematy',
  description: 'Comma-separated topics to avoid',
  descriptionPl: 'Tematy do uniknięcia, oddzielone przecinkami',
  placeholder: 'e.g., costs, budget, pricing',
  placeholderPl: 'np. koszty, budżet, ceny',
  group: 'quality',
  defaultValue: '',
};

const COMPACT_MODE: SettingDefinition = {
  key: 'compactMode',
  type: 'toggle',
  label: 'Compact Mode',
  labelPl: 'Tryb kompaktowy',
  group: 'format',
  defaultValue: false,
};

// ==========================================
// BLOCK TYPE DEFINITIONS
// ==========================================

const BLOCK_SETTINGS: BlockSettingsDefinition[] = [
  // ── Summary / Executive Summary ──
  {
    blockType: 'summary',
    settings: [
      OUTPUT_FORMAT,
      ANALYSIS_DEPTH,
      EXECUTIVE_STYLE,
      {
        key: 'maxFindings',
        type: 'number',
        label: 'Max Key Findings',
        labelPl: 'Maks. kluczowych wniosków',
        group: 'content',
        defaultValue: 5,
        min: 2,
        max: 10,
      },
      INCLUDE_KEY_METRICS,
      INCLUDE_COMPARISONS,
    ],
    presets: [
      {
        id: 'executive_brief',
        label: 'Executive Brief',
        labelPl: 'Brief zarządczy',
        values: { outputFormat: 'mixed', executiveStyle: true, maxFindings: 3, analysisDepth: 'overview' },
      },
      {
        id: 'detailed_summary',
        label: 'Detailed Summary',
        labelPl: 'Szczegółowe podsumowanie',
        values: { outputFormat: 'mixed', executiveStyle: false, maxFindings: 7, analysisDepth: 'detailed', includeKeyMetrics: true },
      },
    ],
  },

  // ── Recommendations ──
  {
    blockType: 'recommendations',
    settings: [
      {
        key: 'maxRecommendations',
        type: 'number',
        label: 'Max Recommendations',
        labelPl: 'Maks. rekomendacji',
        group: 'content',
        defaultValue: 5,
        min: 3,
        max: 15,
      },
      PRIORITIZATION,
      TIME_HORIZON,
      OUTPUT_FORMAT,
      {
        key: 'includeTimeline',
        type: 'toggle',
        label: 'Include Timeline',
        labelPl: 'Dodaj harmonogram',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeOwners',
        type: 'toggle',
        label: 'Suggest Owners',
        labelPl: 'Sugeruj odpowiedzialnych',
        group: 'content',
        defaultValue: false,
      },
      {
        key: 'includeResources',
        type: 'toggle',
        label: 'Include Resources',
        labelPl: 'Dodaj zasoby',
        group: 'content',
        defaultValue: false,
      },
      {
        key: 'highlightQuickWins',
        type: 'toggle',
        label: 'Highlight Quick Wins',
        labelPl: 'Podkreśl szybkie wygrane',
        group: 'display',
        defaultValue: true,
      },
      {
        key: 'highlightCritical',
        type: 'toggle',
        label: 'Highlight Critical',
        labelPl: 'Podkreśl krytyczne',
        group: 'display',
        defaultValue: false,
      },
    ],
    presets: [
      {
        id: 'quick_wins',
        label: 'Quick Wins Focus',
        labelPl: 'Szybkie wygrane',
        values: { maxRecommendations: 5, prioritization: 'quick_wins', timeHorizon: 'short', highlightQuickWins: true },
      },
      {
        id: 'strategic',
        label: 'Strategic Deep Dive',
        labelPl: 'Strategia pogłębiona',
        values: { maxRecommendations: 10, prioritization: 'impact', timeHorizon: 'long', includeTimeline: true, includeOwners: true, includeResources: true },
      },
      {
        id: 'board_ready',
        label: 'Board Ready',
        labelPl: 'Na zarząd',
        values: { maxRecommendations: 5, prioritization: 'impact', executiveStyle: true, outputFormat: 'mixed', highlightCritical: true },
      },
    ],
  },

  // ── Analysis / Detailed Analysis ──
  {
    blockType: 'analysis',
    settings: [
      ANALYSIS_DEPTH,
      OUTPUT_FORMAT,
      INCLUDE_EVIDENCE,
      INCLUDE_KEY_METRICS,
      HIGHLIGHT_GAPS,
      INCLUDE_COMPARISONS,
      {
        key: 'focusAreas',
        type: 'text',
        label: 'Focus Areas',
        labelPl: 'Obszary fokusowe',
        descriptionPl: 'Np. "cyberbezpieczeństwo, AI, dane"',
        group: 'filters',
      },
    ],
    presets: [
      {
        id: 'gap_focused',
        label: 'Gap-Focused',
        labelPl: 'Fokus na lukach',
        values: { analysisDepth: 'detailed', highlightGaps: true, includeEvidence: true },
      },
      {
        id: 'executive_overview',
        label: 'Executive Overview',
        labelPl: 'Przegląd zarządczy',
        values: { analysisDepth: 'overview', executiveStyle: true, outputFormat: 'mixed' },
      },
    ],
  },

  // ── Axis / Topic Analysis ──
  {
    blockType: 'axis_analysis',
    settings: [
      ANALYSIS_DEPTH,
      OUTPUT_FORMAT,
      INCLUDE_EVIDENCE,
      INCLUDE_KEY_METRICS,
      HIGHLIGHT_GAPS,
      {
        key: 'includeRisks',
        type: 'toggle',
        label: 'Include Risks',
        labelPl: 'Dodaj ryzyka',
        group: 'content',
        defaultValue: false,
      },
      {
        key: 'showTrends',
        type: 'toggle',
        label: 'Show Trends',
        labelPl: 'Pokaż trendy',
        group: 'display',
        defaultValue: false,
      },
    ],
  },

  // ── Action Plan ──
  {
    blockType: 'action_plan',
    settings: [
      TIME_HORIZON,
      PRIORITIZATION,
      {
        key: 'maxSteps',
        type: 'number',
        label: 'Max Steps',
        labelPl: 'Maks. kroków',
        group: 'content',
        defaultValue: 10,
        min: 3,
        max: 20,
      },
      {
        key: 'includeTimeline',
        type: 'toggle',
        label: 'Include Timeline',
        labelPl: 'Dodaj harmonogram',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeOwners',
        type: 'toggle',
        label: 'Suggest Owners',
        labelPl: 'Sugeruj odpowiedzialnych',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeMilestones',
        type: 'toggle',
        label: 'Include Milestones',
        labelPl: 'Dodaj kamienie milowe',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeResources',
        type: 'toggle',
        label: 'Include Resources',
        labelPl: 'Dodaj zasoby',
        group: 'content',
        defaultValue: false,
      },
      OUTPUT_FORMAT,
    ],
  },

  // ── Matrix ──
  {
    blockType: 'matrix',
    settings: [
      {
        key: 'levels',
        type: 'number',
        label: 'Maturity Levels',
        labelPl: 'Poziomy dojrzałości',
        group: 'display',
        defaultValue: 7,
        min: 3,
        max: 10,
      },
      HIGHLIGHT_GAPS,
      {
        key: 'showTrends',
        type: 'toggle',
        label: 'Show Trends',
        labelPl: 'Pokaż trendy',
        group: 'display',
        defaultValue: false,
      },
    ],
  },

  // ── Findings ──
  {
    blockType: 'findings',
    settings: [
      {
        key: 'maxFindings',
        type: 'number',
        label: 'Max Findings',
        labelPl: 'Maks. wniosków',
        group: 'content',
        defaultValue: 8,
        min: 3,
        max: 15,
      },
      INCLUDE_EVIDENCE,
      PRIORITIZATION,
      OUTPUT_FORMAT,
      {
        key: 'highlightCritical',
        type: 'toggle',
        label: 'Highlight Critical',
        labelPl: 'Podkreśl krytyczne',
        group: 'display',
        defaultValue: true,
      },
    ],
  },

  // ── Methodology ──
  {
    blockType: 'methodology',
    settings: [
      ANALYSIS_DEPTH,
      OUTPUT_FORMAT,
      {
        key: 'includeFramework',
        type: 'toggle',
        label: 'Describe Framework',
        labelPl: 'Opisz framework',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeDataSources',
        type: 'toggle',
        label: 'Data Sources',
        labelPl: 'Źródła danych',
        group: 'content',
        defaultValue: false,
      },
    ],
  },

  // ── Table (data) ──
  {
    blockType: 'table',
    settings: [
      {
        key: 'maxRows',
        type: 'number',
        label: 'Max Rows',
        labelPl: 'Maks. wierszy',
        group: 'content',
        defaultValue: 10,
        min: 3,
        max: 30,
      },
      {
        key: 'sortBy',
        type: 'text',
        label: 'Sort By',
        labelPl: 'Sortuj wg',
        descriptionPl: 'Np. "score", "priority", "name"',
        group: 'filters',
      },
      {
        key: 'groupBy',
        type: 'text',
        label: 'Group By',
        labelPl: 'Grupuj wg',
        descriptionPl: 'Np. "category", "axis", "priority"',
        group: 'filters',
      },
      COMPACT_MODE,
    ],
  },

  // ── Scorecard ──
  {
    blockType: 'scorecard',
    settings: [
      HIGHLIGHT_GAPS,
      {
        key: 'showTrends',
        type: 'toggle',
        label: 'Show Trends',
        labelPl: 'Pokaż trendy',
        group: 'display',
        defaultValue: true,
      },
      INCLUDE_KEY_METRICS,
      COMPACT_MODE,
    ],
  },

  // ── Gap Analysis ──
  {
    blockType: 'gap_analysis',
    settings: [
      ANALYSIS_DEPTH,
      HIGHLIGHT_GAPS,
      {
        key: 'maxItems',
        type: 'number',
        label: 'Max Items',
        labelPl: 'Maks. elementów',
        group: 'content',
        defaultValue: 10,
        min: 3,
        max: 20,
      },
      INCLUDE_KEY_METRICS,
      OUTPUT_FORMAT,
    ],
  },

  // ── Dashboard ──
  {
    blockType: 'dashboard',
    settings: [
      {
        key: 'maxItems',
        type: 'number',
        label: 'Max KPIs',
        labelPl: 'Maks. KPI',
        group: 'content',
        defaultValue: 6,
        min: 3,
        max: 12,
      },
      {
        key: 'showTrends',
        type: 'toggle',
        label: 'Show Trends',
        labelPl: 'Pokaż trendy',
        group: 'display',
        defaultValue: true,
      },
      HIGHLIGHT_GAPS,
      {
        key: 'layout',
        type: 'button-group',
        label: 'Layout',
        labelPl: 'Układ',
        group: 'display',
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: 'Grid', labelPl: 'Siatka' },
          { value: 'list', label: 'List', labelPl: 'Lista' },
          { value: 'compact', label: 'Compact', labelPl: 'Kompaktowy' },
        ],
      },
    ],
  },

  // ── Roadmap ──
  {
    blockType: 'roadmap',
    settings: [
      TIME_HORIZON,
      {
        key: 'maxSteps',
        type: 'number',
        label: 'Max Phases',
        labelPl: 'Maks. faz',
        group: 'content',
        defaultValue: 5,
        min: 2,
        max: 8,
      },
      {
        key: 'includeMilestones',
        type: 'toggle',
        label: 'Include Milestones',
        labelPl: 'Kamienie milowe',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeOwners',
        type: 'toggle',
        label: 'Include Owners',
        labelPl: 'Odpowiedzialni',
        group: 'content',
        defaultValue: false,
      },
      {
        key: 'orientation',
        type: 'button-group',
        label: 'Orientation',
        labelPl: 'Orientacja',
        group: 'display',
        defaultValue: 'horizontal',
        options: [
          { value: 'horizontal', label: 'Horizontal', labelPl: 'Pozioma' },
          { value: 'vertical', label: 'Vertical', labelPl: 'Pionowa' },
        ],
      },
    ],
  },

  // ── KPIs ──
  {
    blockType: 'kpis',
    settings: [
      {
        key: 'maxItems',
        type: 'number',
        label: 'Max KPIs',
        labelPl: 'Maks. KPI',
        group: 'content',
        defaultValue: 6,
        min: 2,
        max: 12,
      },
      {
        key: 'showTrends',
        type: 'toggle',
        label: 'Show Trends',
        labelPl: 'Pokaż trendy',
        group: 'display',
        defaultValue: true,
      },
      {
        key: 'columns',
        type: 'button-group',
        label: 'Columns',
        labelPl: 'Kolumny',
        group: 'display',
        defaultValue: '3',
        options: [
          { value: '2', label: '2', labelPl: '2' },
          { value: '3', label: '3', labelPl: '3' },
          { value: '4', label: '4', labelPl: '4' },
        ],
      },
    ],
  },

  // ── Risk ──
  {
    blockType: 'risk',
    settings: [
      {
        key: 'maxItems',
        type: 'number',
        label: 'Max Risks',
        labelPl: 'Maks. ryzyk',
        group: 'content',
        defaultValue: 8,
        min: 3,
        max: 15,
      },
      {
        key: 'showImpact',
        type: 'toggle',
        label: 'Show Impact',
        labelPl: 'Pokaż wpływ',
        group: 'display',
        defaultValue: true,
      },
      {
        key: 'includeRisks',
        type: 'toggle',
        label: 'Include Mitigations',
        labelPl: 'Dodaj mitygacje',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'highlightCritical',
        type: 'toggle',
        label: 'Highlight Critical',
        labelPl: 'Podkreśl krytyczne',
        group: 'display',
        defaultValue: true,
      },
    ],
  },

  // ── Prioritization ──
  {
    blockType: 'prioritization',
    settings: [
      {
        key: 'maxItemsPerQuadrant',
        type: 'number',
        label: 'Max per Quadrant',
        labelPl: 'Maks. na kwadrant',
        group: 'content',
        defaultValue: 5,
        min: 2,
        max: 10,
      },
      {
        key: 'xAxisLabel',
        type: 'text',
        label: 'X-Axis Label',
        labelPl: 'Etykieta osi X',
        descriptionPl: 'Np. "Effort", "Cost"',
        group: 'display',
        defaultValue: 'Effort',
      },
      {
        key: 'yAxisLabel',
        type: 'text',
        label: 'Y-Axis Label',
        labelPl: 'Etykieta osi Y',
        descriptionPl: 'Np. "Impact", "Value"',
        group: 'display',
        defaultValue: 'Impact',
      },
      {
        key: 'gridSize',
        type: 'button-group',
        label: 'Grid Size',
        labelPl: 'Rozmiar siatki',
        group: 'display',
        defaultValue: '2',
        options: [
          { value: '2', label: '2×2', labelPl: '2×2' },
          { value: '3', label: '3×3', labelPl: '3×3' },
        ],
      },
    ],
  },

  // ── Initiative Cards ──
  {
    blockType: 'initiatives',
    settings: [
      {
        key: 'maxItems',
        type: 'number',
        label: 'Max Initiatives',
        labelPl: 'Maks. inicjatyw',
        group: 'content',
        defaultValue: 8,
        min: 3,
        max: 20,
      },
      PRIORITIZATION,
      TIME_HORIZON,
      {
        key: 'layout',
        type: 'button-group',
        label: 'Layout',
        labelPl: 'Układ',
        group: 'display',
        defaultValue: 'grid',
        options: [
          { value: 'grid', label: 'Grid', labelPl: 'Siatka' },
          { value: 'list', label: 'List', labelPl: 'Lista' },
        ],
      },
      {
        key: 'columns',
        type: 'button-group',
        label: 'Columns',
        labelPl: 'Kolumny',
        group: 'display',
        defaultValue: '2',
        options: [
          { value: '1', label: '1', labelPl: '1' },
          { value: '2', label: '2', labelPl: '2' },
          { value: '3', label: '3', labelPl: '3' },
        ],
      },
      {
        key: 'showEffortBars',
        type: 'toggle',
        label: 'Effort Profile Bars',
        labelPl: 'Paski profilu wysiłku',
        descriptionPl: 'Pokaż Analytical / Operational / Change',
        group: 'display',
        defaultValue: true,
      },
      {
        key: 'includeMetrics',
        type: 'toggle',
        label: 'Include Metrics',
        labelPl: 'Pokaż metryki',
        descriptionPl: 'Budżet, ROI, timeline',
        group: 'display',
        defaultValue: true,
      },
      {
        key: 'groupBy',
        type: 'button-group',
        label: 'Group By',
        labelPl: 'Grupuj wg',
        group: 'content',
        defaultValue: 'none',
        options: [
          { value: 'none', label: 'None', labelPl: 'Brak' },
          { value: 'intent', label: 'Intent', labelPl: 'Intencja' },
          { value: 'priority', label: 'Priority', labelPl: 'Priorytet' },
          { value: 'axis', label: 'Axis', labelPl: 'Oś' },
        ],
      },
      INCLUDE_EVIDENCE,
      EXECUTIVE_STYLE,
    ],
    presets: [
      {
        id: 'executive_portfolio',
        label: 'Executive Portfolio',
        labelPl: 'Portfel zarządczy',
        values: { layout: 'grid', columns: '2', maxItems: 6, showEffortBars: false, executiveStyle: true, includeMetrics: true },
      },
      {
        id: 'detailed_catalog',
        label: 'Detailed Catalog',
        labelPl: 'Szczegółowy katalog',
        values: { layout: 'list', columns: '1', maxItems: 12, showEffortBars: true, includeMetrics: true, includeEvidence: true },
      },
      {
        id: 'quick_wins_focus',
        label: 'Quick Wins Focus',
        labelPl: 'Szybkie wygrane',
        values: { layout: 'grid', columns: '3', maxItems: 6, prioritization: 'quick_wins', showEffortBars: true, includeMetrics: false },
      },
    ],
  },

  // ── Context / Company Profile ──
  {
    blockType: 'context',
    settings: [
      ANALYSIS_DEPTH,
      OUTPUT_FORMAT,
      {
        key: 'focusAreas',
        type: 'text',
        label: 'Focus Areas',
        labelPl: 'Obszary fokusowe',
        descriptionPl: 'Np. "branża, wielkość, specyfika"',
        group: 'content',
      },
    ],
  },

  // ── Chart (bar) ──
  {
    blockType: 'chart',
    settings: [
      {
        key: 'maxItems',
        type: 'number',
        label: 'Max Data Points',
        labelPl: 'Maks. punktów danych',
        group: 'content',
        defaultValue: 7,
        min: 3,
        max: 15,
      },
      {
        key: 'orientation',
        type: 'button-group',
        label: 'Orientation',
        labelPl: 'Orientacja',
        group: 'display',
        defaultValue: 'vertical',
        options: [
          { value: 'vertical', label: 'Vertical', labelPl: 'Pionowa' },
          { value: 'horizontal', label: 'Horizontal', labelPl: 'Pozioma' },
        ],
      },
      {
        key: 'showTrends',
        type: 'toggle',
        label: 'Show Trend Line',
        labelPl: 'Linia trendu',
        group: 'display',
        defaultValue: false,
      },
    ],
  },

  // ── Quote ──
  {
    blockType: 'quote',
    settings: [
      {
        key: 'variant',
        type: 'button-group',
        label: 'Style',
        labelPl: 'Styl',
        group: 'display',
        defaultValue: 'highlight',
        options: [
          { value: 'highlight', label: 'Highlight', labelPl: 'Wyróżnienie' },
          { value: 'minimal', label: 'Minimal', labelPl: 'Minimalistyczny' },
          { value: 'bordered', label: 'Bordered', labelPl: 'Z ramką' },
        ],
      },
    ],
  },

  // ── Custom / generic fallback ──
  {
    blockType: 'custom',
    settings: [
      OUTPUT_FORMAT,
      ANALYSIS_DEPTH,
      {
        key: 'focusAreas',
        type: 'text',
        label: 'Focus Areas',
        labelPl: 'Obszary fokusowe',
        group: 'content',
      },
      EXECUTIVE_STYLE,
    ],
  },

  // ── Appendix ──
  {
    blockType: 'appendix',
    settings: [
      OUTPUT_FORMAT,
      COMPACT_MODE,
      {
        key: 'includeFramework',
        type: 'toggle',
        label: 'Include Framework Ref',
        labelPl: 'Odniesienie do frameworka',
        group: 'content',
        defaultValue: true,
      },
      {
        key: 'includeDataSources',
        type: 'toggle',
        label: 'Include Data Sources',
        labelPl: 'Źródła danych',
        group: 'content',
        defaultValue: true,
      },
    ],
  },

  // ── Cover Page ──
  {
    blockType: 'cover',
    settings: [
      {
        key: 'variant',
        type: 'button-group',
        label: 'Style',
        labelPl: 'Styl',
        group: 'display',
        defaultValue: 'corporate',
        options: [
          { value: 'corporate', label: 'Corporate', labelPl: 'Korporacyjny' },
          { value: 'modern', label: 'Modern', labelPl: 'Nowoczesny' },
          { value: 'minimal', label: 'Minimal', labelPl: 'Minimalistyczny' },
        ],
      },
    ],
  },
];

// ==========================================
// LOOKUP FUNCTIONS
// ==========================================

// ==========================================
// UNIVERSAL BLUEPRINT SETTINGS (appended to every block)
// ==========================================

const BLUEPRINT_SETTINGS: SettingDefinition[] = [
  // CONTENT_INSTRUCTIONS removed per Faza 3B -- merged into customPrompt field
  REQUIRED_SECTIONS_LIST,
  OUTPUT_STRUCTURE,
  MIN_ITEMS_COUNT,
  MAX_ITEMS_COUNT,
  REQUIRE_DATA_REFERENCES,
  REQUIRE_ACTIONABLE,
  FORBIDDEN_TOPICS,
];

/**
 * Get settings definition for a block type.
 * Falls back to 'custom' if no specific definition exists.
 * Automatically appends Blueprint settings (REQ-1) to every block.
 */
export function getBlockSettings(blockType: string, blockTypeId?: string): BlockSettingsDefinition | null {
  // First try exact blockType match
  let base = BLOCK_SETTINGS.find(
    (def) => def.blockType === blockType || def.blockTypeIds?.includes(blockTypeId || '')
  );

  // For library blocks (bt_ prefix or unknown types), use custom fallback
  if (!base) {
    if (blockTypeId || !BLOCK_SETTINGS.some((d) => d.blockType === blockType)) {
      base = BLOCK_SETTINGS.find((d) => d.blockType === 'custom') || null;
    }
  }

  if (!base) return null;

  // Append blueprint settings to every block (avoid duplicates)
  const existingKeys = new Set(base.settings.map((s) => s.key));
  const blueprintToAdd = BLUEPRINT_SETTINGS.filter((s) => !existingKeys.has(s.key));

  return {
    ...base,
    settings: [...base.settings, ...blueprintToAdd],
  };
}

/**
 * Get all available block types that have settings
 */
export function getBlockTypesWithSettings(): string[] {
  return BLOCK_SETTINGS.map((d) => d.blockType);
}
