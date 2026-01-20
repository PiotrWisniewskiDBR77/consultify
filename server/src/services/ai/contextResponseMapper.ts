/**
 * Context Response Mapper
 * FLOW-AI-ADAPTIVE-001: Maps screen contexts to optimal response formats
 *
 * This module defines how AI responses should be formatted based on:
 * - Current screen/view the user is on
 * - Type of content being viewed (task, initiative, etc.)
 * - User's workflow phase
 *
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type ScreenContextType =
  | 'task_detail'
  | 'task_list'
  | 'initiative_detail'
  | 'initiative_list'
  | 'dashboard'
  | 'assessment'
  | 'assessment_axis'
  | 'roadmap'
  | 'roi_calculator'
  | 'reports'
  | 'chat_full'
  | 'chat_split'
  | 'settings'
  | 'admin'
  | 'knowledge_base'
  | 'context_builder'
  | 'execution'
  | 'pilot'
  | 'rollout'
  | 'unknown';

export type ResponseFormat = 'bullets' | 'paragraphs' | 'structured' | 'conversational' | 'table';
export type ResponseLength = 'concise' | 'medium' | 'comprehensive' | 'adaptive';
export type ResponseFocus =
  | 'actionable'
  | 'strategic'
  | 'analytical'
  | 'summary'
  | 'planning'
  | 'helpful'
  | 'technical'
  | 'executive';

export interface ResponseFormatConfig {
  format: ResponseFormat;
  length: ResponseLength;
  focus: ResponseFocus;
  includeExamples?: boolean;
  includeMetrics?: boolean;
  includeNextSteps?: boolean;
  maxParagraphs?: number;
  maxBulletPoints?: number;
  prioritizeActionItems?: boolean;
}

export interface ContextFormatMapping {
  config: ResponseFormatConfig;
  systemPromptAdditions: string[];
  responseGuidelines: string[];
}

// ==========================================
// CONTEXT FORMAT MAPPINGS
// ==========================================

/**
 * Default format configurations for each screen context
 */
const CONTEXT_FORMAT_MAP: Record<ScreenContextType, ContextFormatMapping> = {
  // Task-related contexts
  task_detail: {
    config: {
      format: 'bullets',
      length: 'concise',
      focus: 'actionable',
      includeNextSteps: true,
      prioritizeActionItems: true,
      maxBulletPoints: 7,
    },
    systemPromptAdditions: [
      'User is viewing a specific task. Focus on actionable guidance.',
      'Keep responses focused and task-specific.',
      'Prioritize clear next steps and practical advice.',
    ],
    responseGuidelines: [
      'Start with the most important action item',
      'Use bullet points for clarity',
      'Include specific, measurable steps where possible',
      'Mention relevant blockers or dependencies if applicable',
    ],
  },

  task_list: {
    config: {
      format: 'bullets',
      length: 'concise',
      focus: 'summary',
      maxBulletPoints: 5,
    },
    systemPromptAdditions: [
      'User is viewing a list of tasks.',
      'Provide high-level summaries rather than deep details.',
    ],
    responseGuidelines: [
      'Focus on priorities and status',
      'Highlight urgent items first',
      'Keep explanations brief',
    ],
  },

  // Initiative-related contexts
  initiative_detail: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'strategic',
      includeMetrics: true,
      includeNextSteps: true,
    },
    systemPromptAdditions: [
      'User is reviewing an initiative in detail.',
      'Provide strategic perspective with business value context.',
      'Include ROI considerations and success metrics where relevant.',
    ],
    responseGuidelines: [
      'Structure response with clear sections',
      'Include business impact and value proposition',
      'Reference relevant KPIs and metrics',
      'Connect to broader organizational goals',
    ],
  },

  initiative_list: {
    config: {
      format: 'structured',
      length: 'concise',
      focus: 'summary',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is browsing initiatives.',
      'Summarize key information efficiently.',
    ],
    responseGuidelines: [
      'Highlight status and progress',
      'Note any initiatives requiring attention',
    ],
  },

  // Dashboard context
  dashboard: {
    config: {
      format: 'bullets',
      length: 'concise',
      focus: 'summary',
      includeMetrics: true,
      maxBulletPoints: 5,
    },
    systemPromptAdditions: [
      'User is on the dashboard seeking an overview.',
      'Provide high-level summaries and key highlights.',
      'Focus on actionable insights and important updates.',
    ],
    responseGuidelines: [
      'Lead with most important information',
      'Use metrics and numbers where helpful',
      'Flag items requiring immediate attention',
      'Keep explanations brief and scannable',
    ],
  },

  // Assessment contexts
  assessment: {
    config: {
      format: 'structured',
      length: 'comprehensive',
      focus: 'analytical',
      includeExamples: true,
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is in the assessment module.',
      'Provide detailed analytical responses with evidence-based insights.',
      'Reference PMO standards (ISO 21500, PMBOK, PRINCE2) where relevant.',
      'Include specific recommendations based on maturity level.',
    ],
    responseGuidelines: [
      'Structure analysis clearly with sections',
      'Cite relevant standards and best practices',
      'Provide specific, measurable recommendations',
      'Include examples of improvement actions',
      "Consider the organization's current maturity level",
    ],
  },

  assessment_axis: {
    config: {
      format: 'structured',
      length: 'comprehensive',
      focus: 'analytical',
      includeExamples: true,
    },
    systemPromptAdditions: [
      'User is evaluating a specific assessment axis.',
      'Provide detailed guidance for scoring and justification.',
      'Include concrete examples for each maturity level.',
    ],
    responseGuidelines: [
      'Explain criteria clearly',
      'Provide examples for different score levels',
      'Guide toward objective assessment',
    ],
  },

  // Planning contexts
  roadmap: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'planning',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is viewing or planning the roadmap.',
      'Focus on timeline, dependencies, and resource considerations.',
      'Highlight critical path items and potential risks.',
    ],
    responseGuidelines: [
      'Consider timeline and sequencing',
      'Identify dependencies between items',
      'Flag potential bottlenecks or risks',
      'Suggest optimal ordering when relevant',
    ],
  },

  roi_calculator: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'analytical',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is working with ROI calculations.',
      'Provide data-driven analysis and financial insights.',
      'Explain assumptions and methodology clearly.',
    ],
    responseGuidelines: [
      'Show calculations transparently',
      'Explain key assumptions',
      'Compare alternatives when relevant',
      'Highlight key decision factors',
    ],
  },

  // Reporting context
  reports: {
    config: {
      format: 'structured',
      length: 'comprehensive',
      focus: 'executive',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is viewing or generating reports.',
      'Provide executive-level summaries with supporting details.',
      'Structure information for stakeholder communication.',
    ],
    responseGuidelines: [
      'Lead with key findings',
      'Support claims with data',
      'Structure for readability',
      'Include actionable recommendations',
    ],
  },

  // Chat contexts
  chat_full: {
    config: {
      format: 'conversational',
      length: 'adaptive',
      focus: 'helpful',
      includeExamples: true,
    },
    systemPromptAdditions: [
      'User is in full chat mode for general conversation.',
      'Adapt response length and format to the question type.',
      'Be helpful and thorough while remaining accessible.',
    ],
    responseGuidelines: [
      'Match response complexity to question complexity',
      'Use examples when explaining concepts',
      'Be conversational but professional',
      'Offer follow-up suggestions when appropriate',
    ],
  },

  chat_split: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'helpful',
    },
    systemPromptAdditions: [
      'User is in split-screen mode with content visible.',
      'Responses should complement the visible content.',
      'Keep responses focused on the visible context.',
    ],
    responseGuidelines: [
      'Reference visible content when relevant',
      'Keep responses contextual',
      'Provide actionable guidance',
    ],
  },

  // Other contexts
  settings: {
    config: {
      format: 'bullets',
      length: 'concise',
      focus: 'technical',
    },
    systemPromptAdditions: [
      'User is in settings/configuration.',
      'Provide clear, technical guidance.',
      'Explain implications of configuration choices.',
    ],
    responseGuidelines: [
      'Be precise and technical',
      'Explain consequences of changes',
      'Provide step-by-step guidance when needed',
    ],
  },

  admin: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'technical',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is in admin panel.',
      'Provide administrative guidance and system insights.',
      'Include relevant metrics and diagnostics.',
    ],
    responseGuidelines: [
      'Focus on system health and management',
      'Include relevant statistics',
      'Suggest optimizations when appropriate',
    ],
  },

  knowledge_base: {
    config: {
      format: 'paragraphs',
      length: 'comprehensive',
      focus: 'analytical',
      includeExamples: true,
    },
    systemPromptAdditions: [
      'User is working with knowledge base content.',
      'Provide thorough, well-organized information.',
      'Reference and cite sources when available.',
    ],
    responseGuidelines: [
      'Structure information logically',
      'Cite sources and references',
      'Provide comprehensive coverage',
    ],
  },

  context_builder: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'helpful',
    },
    systemPromptAdditions: [
      'User is setting up organizational context.',
      'Guide through the setup process clearly.',
      'Explain how context affects AI responses.',
    ],
    responseGuidelines: [
      'Provide clear guidance',
      'Explain benefits of each setting',
      'Use examples of good configurations',
    ],
  },

  execution: {
    config: {
      format: 'bullets',
      length: 'concise',
      focus: 'actionable',
      prioritizeActionItems: true,
    },
    systemPromptAdditions: [
      'User is in execution/implementation phase.',
      'Focus on practical, actionable guidance.',
      'Help track progress and manage blockers.',
    ],
    responseGuidelines: [
      'Prioritize immediate actions',
      'Track progress against goals',
      'Identify and address blockers',
    ],
  },

  pilot: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'actionable',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is in pilot phase.',
      'Focus on testing, validation, and quick wins.',
      'Help measure success and gather feedback.',
    ],
    responseGuidelines: [
      'Focus on validation criteria',
      'Track pilot metrics',
      'Gather and analyze feedback',
    ],
  },

  rollout: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'planning',
      includeMetrics: true,
    },
    systemPromptAdditions: [
      'User is planning or executing rollout.',
      'Focus on scaling, change management, and adoption.',
      'Address organizational readiness.',
    ],
    responseGuidelines: [
      'Consider scaling challenges',
      'Address change management',
      'Track adoption metrics',
    ],
  },

  unknown: {
    config: {
      format: 'structured',
      length: 'medium',
      focus: 'helpful',
    },
    systemPromptAdditions: [],
    responseGuidelines: ['Provide balanced, helpful response', "Adapt to user's apparent needs"],
  },
};

// ==========================================
// SERVICE FUNCTIONS
// ==========================================

/**
 * Get response format configuration for a given screen context
 */
export function getContextFormat(screenContext: string | ScreenContextType): ContextFormatMapping {
  const normalizedContext = normalizeContextType(screenContext);
  return CONTEXT_FORMAT_MAP[normalizedContext] || CONTEXT_FORMAT_MAP.unknown;
}

/**
 * Get all available screen context types
 */
export function getAvailableContextTypes(): ScreenContextType[] {
  return Object.keys(CONTEXT_FORMAT_MAP) as ScreenContextType[];
}

/**
 * Build system prompt additions for a context
 */
export function buildContextPromptAdditions(screenContext: string): string[] {
  const mapping = getContextFormat(screenContext);
  return [
    ...mapping.systemPromptAdditions,
    ...mapping.responseGuidelines.map((g) => `Guideline: ${g}`),
  ];
}

/**
 * Get optimal response format for a context
 */
export function getOptimalFormat(screenContext: string): ResponseFormatConfig {
  const mapping = getContextFormat(screenContext);
  return mapping.config;
}

/**
 * Normalize various context strings to ScreenContextType
 */
function normalizeContextType(context: string): ScreenContextType {
  const contextLower = context.toLowerCase().replace(/[\s-_]/g, '_');

  // Direct matches
  if (contextLower in CONTEXT_FORMAT_MAP) {
    return contextLower as ScreenContextType;
  }

  // Pattern matching for common variations
  const patterns: [RegExp, ScreenContextType][] = [
    [/task.*detail|task.*view|single.*task/i, 'task_detail'],
    [/task.*list|tasks.*view|all.*tasks/i, 'task_list'],
    [/initiative.*detail|initiative.*view|single.*initiative/i, 'initiative_detail'],
    [/initiative.*list|initiatives.*view|all.*initiatives/i, 'initiative_list'],
    [/dashboard|overview|home/i, 'dashboard'],
    [/assessment.*axis|axis.*detail|drd.*axis/i, 'assessment_axis'],
    [/assessment|maturity|drd/i, 'assessment'],
    [/roadmap|timeline|planning/i, 'roadmap'],
    [/roi|calculator|business.*case/i, 'roi_calculator'],
    [/report|reporting/i, 'reports'],
    [/chat.*full|full.*chat|chat.*standalone/i, 'chat_full'],
    [/chat.*split|split.*chat|side.*chat/i, 'chat_split'],
    [/settings|config|preferences/i, 'settings'],
    [/admin|administration|management/i, 'admin'],
    [/knowledge|docs|documentation/i, 'knowledge_base'],
    [/context.*builder|setup|onboard/i, 'context_builder'],
    [/execution|execute|implement/i, 'execution'],
    [/pilot|test|trial/i, 'pilot'],
    [/rollout|deploy|scale/i, 'rollout'],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(context)) {
      return type;
    }
  }

  logger.debug(`[ContextResponseMapper] Unknown context: ${context}, using 'unknown'`);
  return 'unknown';
}

/**
 * Merge user preferences with context defaults
 * User preferences take priority over context defaults
 */
export function mergeWithUserPreferences(
  contextConfig: ResponseFormatConfig,
  userPreferences: Partial<ResponseFormatConfig>
): ResponseFormatConfig {
  return {
    ...contextConfig,
    ...Object.fromEntries(
      Object.entries(userPreferences).filter(([_, v]) => v !== undefined && v !== null)
    ),
  } as ResponseFormatConfig;
}

// ==========================================
// EXPORTS
// ==========================================

export { CONTEXT_FORMAT_MAP, normalizeContextType };
