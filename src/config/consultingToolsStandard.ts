export const CONSULTING_TOOL_LIFECYCLE = ['library', 'session', 'outputs', 'initiatives'] as const;

export type ConsultingToolLifecycleStage = (typeof CONSULTING_TOOL_LIFECYCLE)[number];

export const CONSULTING_TOOL_RUNTIME_STAGES = [
  'entry',
  'conversation',
  'context',
  'analysis',
  'conclusions',
  'summary',
  'outputs',
] as const;

export type ConsultingToolRuntimeStage = (typeof CONSULTING_TOOL_RUNTIME_STAGES)[number];

export const CONSULTING_TOOL_SESSION_SECTIONS = [
  'work',
  'review',
  'outputs',
  'comments',
  'activity',
  'used-in',
] as const;

export type ConsultingToolSessionSection = (typeof CONSULTING_TOOL_SESSION_SECTIONS)[number];

// RB-025: narrowed to the one output type ToolDocumentView actually delivers
// end-to-end (generate → generatedInitiatives list → reopen via
// onOpenInitiative → lineage back to the source session). 'report',
// 'presentation' and 'idea' were declared here but had no generating,
// created, failed/retry, reopen or lineage implementation anywhere in the
// codebase (outputsScaffolding.ts's report/deck outlines have zero callers) —
// advertising them let the UI promise output types it could not deliver.
export const CONSULTING_TOOL_STANDARD_OUTPUTS = ['initiative'] as const;

export type ConsultingToolOutputType = (typeof CONSULTING_TOOL_STANDARD_OUTPUTS)[number];

export type ConsultingToolTimeframe = 'short' | 'medium' | 'long';

export interface ConsultingMissionContext {
  goal: string;
  scope: string;
  timeframe: ConsultingToolTimeframe;
  successSignal?: string;
  assumptions?: string;
  constraints?: string;
  kpiTarget?: string;
  understanding?: string;
  directionChoice?: string;
  scopeChoice?: string;
  successChoice?: string;
  directionChoices?: string[];
  scopeChoices?: string[];
  successChoices?: string[];
  question4Choices?: string[];
  question5Choices?: string[];
  question1Confirmed?: boolean;
  question2Confirmed?: boolean;
  question3Confirmed?: boolean;
  question4Confirmed?: boolean;
  question5Confirmed?: boolean;
  understandingComment?: string;
  directionComment?: string;
  scopeComment?: string;
  horizonComment?: string;
  successComment?: string;
  constraintsComment?: string;
}

export function createConsultingMissionContext(
  overrides: Partial<ConsultingMissionContext> = {}
): ConsultingMissionContext {
  return {
    goal: '',
    scope: '',
    timeframe: 'medium',
    successSignal: '',
    assumptions: '',
    constraints: '',
    kpiTarget: '',
    understanding: '',
    directionChoice: '',
    scopeChoice: '',
    successChoice: '',
    directionChoices: [],
    scopeChoices: [],
    successChoices: [],
    question4Choices: [],
    question5Choices: [],
    question1Confirmed: false,
    question2Confirmed: false,
    question3Confirmed: false,
    question4Confirmed: false,
    question5Confirmed: false,
    understandingComment: '',
    directionComment: '',
    scopeComment: '',
    horizonComment: '',
    successComment: '',
    constraintsComment: '',
    ...overrides,
  };
}

export interface ConsultingSummarySnapshot {
  executiveSummary?: string;
  keyInsights: string[];
  appliedConclusions?: string[];
  /**
   * CONCLUSION_LAYER_STANDARD variant-W2 finishing fields (optional, additive).
   * Populated when the tool's conclusion prompt returns them nested under
   * `summary`; consumed by the Conclusions bridge (answers.summary.verdict).
   */
  verdict?: string;
  tradeoffs?: { chosen: string; rejected: string; why: string }[];
  expectedEffect?: { text: string; horizon: string };
}

export interface ConsultingEvidenceItem {
  id: string;
  text: string;
  source?: 'user' | 'ai' | 'imported';
  confidence?: number;
}

export interface ConsultingSynthesisItem {
  id: string;
  title: string;
  insight: string;
  linkedItemIds: string[];
  confidence?: number;
}

export interface ConsultingMoveCandidate {
  id: string;
  title: string;
  rationale: string;
  linkedItemIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
}

export interface ConsultingOutputCandidateBase {
  id: string;
  outputType: ConsultingToolOutputType;
  title: string;
  description: string;
  rationale: string;
}

export const CONSULTING_TOOL_BUILD_SEQUENCE = [
  'spec',
  'kbArticle',
  'libraryPreview',
  'runtimeConfig',
  'outputsMapping',
  'assets',
  'implementation',
] as const;

export const CONSULTING_TOOL_AI_BEHAVIOR_RULES = [
  'conversation-first, structure-backed',
  'ai-acts-as-mentor-consultant-and-challenger',
  'propose-never-silently-overwrite',
  'materialize-into-explicit-session-state',
  'support-discussion-on-input-analysis-and-conclusions',
  'preserve-traceability-into-outputs',
] as const;

export const CONSULTING_TOOL_EXPERIENCE_PRINCIPLES = [
  'light-entry-before-methodology-depth',
  'conversation-is-the-primary-interface',
  'multi-source-context-is-required',
  'analysis-must-lead-to-applied-conclusions',
  'finish-must-be-presentation-ready',
] as const;

export const CONSULTING_TOOL_CONTEXT_SOURCES = [
  'conversation',
  'attachments-and-links',
  'organization-knowledge',
  'platform-artifacts',
  'web-benchmarks',
] as const;

export const CONSULTING_TOOL_CONVERSATION_LAYERS = [
  'capture-conversation',
  'analysis-conversation',
  'conclusion-discussion',
] as const;

export const CONSULTING_TOOL_SOURCE_ARTIFACTS = ['final-source-summary', 'tool-session'] as const;

export const DYNAMIC_SWOT_REFERENCE_CONTRACT = {
  toolType: 'dynamic-swot',
  lifecycle: CONSULTING_TOOL_LIFECYCLE,
  runtimeStages: CONSULTING_TOOL_RUNTIME_STAGES,
  sessionSections: CONSULTING_TOOL_SESSION_SECTIONS,
  outputs: CONSULTING_TOOL_STANDARD_OUTPUTS,
  swotSpecificElements: [
    'strengths',
    'weaknesses',
    'opportunities',
    'threats',
    'SO/WO/ST/WT correlations',
    'attack/repair/defend/protect tensions',
  ],
  reusableElements: [
    'light entry and purpose framing',
    'conversation capture',
    'multi-source context ingestion',
    'analysis into tensions or priorities',
    'applied conclusions',
    'final source summary',
    'output candidates and traceability gates',
  ],
} as const;

export const CONSULTING_TOOL_ROLLOUT_PRIORITY = [
  {
    wave: 'wave-1',
    label: 'Strategic tools closest to SWOT',
    toolTypes: ['market-forces', 'growth-paths', 'portfolio-priority', 'risk-uncertainty'],
  },
  {
    wave: 'wave-2',
    label: 'Remaining strategic synthesis tools',
    toolTypes: [
      'value-chain',
      'ambition-decomposer',
      'focus-tradeoff',
      'capability-mapper',
      'narrative-engine',
    ],
  },
  {
    wave: 'wave-3',
    label: 'Operational and automation tools',
    toolTypes: [
      'sop-builder',
      'a3-problem-solving',
      'smed-planner',
      'dms-builder',
      'inventory-autopilot',
      'vsm-builder',
      'constraint-control',
      'decision-engine',
      'control-tower',
      'automation-pipeline',
      'robotics-feasibility',
      'logistics-automation',
      'rpa-scanner',
      'ai-discovery',
      'integration-diagnostic',
      'digital-value-pool',
      'legacy-analyzer',
      'data-inventory',
      'pain-to-solution',
      'pain-explorer',
      'process-automation',
    ],
  },
] as const;

export function buildToolKbArticleSlug(toolType: string): string {
  return `tools-${toolType}-how-to`;
}
