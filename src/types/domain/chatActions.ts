/**
 * Chat Actions (V3-B02)
 * Central action type registry: one catalog of action types + payload schemas + capabilities.
 * Zero "dead" actions — all types are defined here and used by chat components.
 */

export const ACTION_SCHEMA_VERSION = '1.0';

export type ChatActionType =
  | 'NAVIGATE'
  // Task, decision and initiative creation use the governed CREATE_DRAFT_* proposal
  // lifecycle in server/src/services/aiActionExecutor.ts (cases at marker lines 911-920).
  | 'GENERATE_REPORT'
  | 'GENERATE_PRESENTATION'
  | 'USE_TEMPLATE'
  | 'BROWSE_TEMPLATES'
  | 'START_TOOL'
  | 'OPEN_PREVIEW'
  | 'ASSIGN_INTERVIEW'
  | 'RECORD_KPI'
  | 'START_ARTIFACT_REVIEW'
  | 'CHECK_TRUST_STATE'
  | 'ANALYZE_STATEMENT'
  | 'REVIEW_MODEL'
  | 'CHECK_LANE_STATUS';

export type ActionCategory = 'navigation' | 'creation' | 'generation' | 'assignment' | 'recording';

export type ActionStyling = 'primary' | 'secondary';

export interface PayloadField {
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description: string;
}

export interface ChatActionDefinition {
  type: ChatActionType;
  label: string;
  description: string;
  icon: string;
  category: ActionCategory;
  payloadSchema: Record<string, PayloadField>;
  requiredCapabilities: string[];
  styling: ActionStyling;
}

export interface ChatActionPayload {
  type: ChatActionType;
  version: string;
  params: Record<string, unknown>;
}

export interface ChatActionCapability {
  action: ChatActionType;
  allowed: boolean;
  reason?: string;
}

/** Context passed to capability checks and handler. */
export interface ActionContext {
  projectId?: string;
  initiativeId?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Action definitions catalog
// ---------------------------------------------------------------------------

export const CHAT_ACTION_DEFINITIONS: ChatActionDefinition[] = [
  {
    type: 'NAVIGATE',
    label: 'chat.actions.navigate.label',
    description: 'chat.actions.navigate.description',
    icon: 'ExternalLink',
    category: 'navigation',
    payloadSchema: {
      targetModule: {
        type: 'string',
        required: true,
        description:
          'Target module: tools, initiatives, reports, presentations, results, assessment, interview, mywork',
      },
      entityType: { type: 'string', required: false, description: 'Entity type within module' },
      entityId: { type: 'string', required: false, description: 'Entity ID to open' },
      surface: {
        type: 'string',
        required: false,
        description: 'Surface: list, detail, wizard, builder, dashboard',
      },
      params: { type: 'object', required: false, description: 'Additional route params' },
    },
    requiredCapabilities: ['read'],
    styling: 'primary',
  },
  {
    type: 'GENERATE_REPORT',
    label: 'chat.actions.generateReport.label',
    description: 'chat.actions.generateReport.description',
    icon: 'FileText',
    category: 'generation',
    payloadSchema: {
      sourceType: { type: 'string', required: false, description: 'Report source type' },
      sourceId: { type: 'string', required: false, description: 'Source entity ID' },
      templateId: { type: 'string', required: false, description: 'Report template ID' },
    },
    requiredCapabilities: ['create_report'],
    styling: 'primary',
  },
  {
    type: 'GENERATE_PRESENTATION',
    label: 'chat.actions.generatePresentation.label',
    description: 'chat.actions.generatePresentation.description',
    icon: 'Presentation',
    category: 'generation',
    payloadSchema: {
      sourceType: { type: 'string', required: false, description: 'Presentation source type' },
      sourceId: { type: 'string', required: false, description: 'Source entity ID' },
      templateId: { type: 'string', required: false, description: 'Deck template ID' },
    },
    requiredCapabilities: ['create_presentation'],
    styling: 'primary',
  },
  {
    type: 'START_TOOL',
    label: 'chat.actions.startTool.label',
    description: 'chat.actions.startTool.description',
    icon: 'Wrench',
    category: 'generation',
    payloadSchema: {
      toolType: { type: 'string', required: true, description: 'Tool type identifier' },
      context: { type: 'object', required: false, description: 'Pre-filled context for the tool' },
    },
    requiredCapabilities: ['use_tools'],
    styling: 'primary',
  },
  {
    type: 'OPEN_PREVIEW',
    label: 'chat.actions.openPreview.label',
    description: 'chat.actions.openPreview.description',
    icon: 'Eye',
    category: 'navigation',
    payloadSchema: {
      entityType: {
        type: 'string',
        required: true,
        description: 'Entity type: initiative, task, decision, report, etc.',
      },
      entityId: { type: 'string', required: true, description: 'Entity ID to preview' },
    },
    requiredCapabilities: ['read'],
    styling: 'secondary',
  },
  {
    type: 'ASSIGN_INTERVIEW',
    label: 'chat.actions.assignInterview.label',
    description: 'chat.actions.assignInterview.description',
    icon: 'ClipboardList',
    category: 'assignment',
    payloadSchema: {
      templateId: { type: 'string', required: true, description: 'Interview template ID' },
      assigneeUserIds: {
        type: 'object',
        required: true,
        description: 'Array of user IDs to assign',
      },
      dueAt: { type: 'string', required: false, description: 'ISO date for due date' },
      projectId: { type: 'string', required: false, description: 'Project ID' },
    },
    requiredCapabilities: ['assign_interview'],
    styling: 'primary',
  },
  {
    type: 'RECORD_KPI',
    label: 'chat.actions.recordKpi.label',
    description: 'chat.actions.recordKpi.description',
    icon: 'TrendingUp',
    category: 'recording',
    payloadSchema: {
      kpiId: { type: 'string', required: true, description: 'KPI ID to record value for' },
      initiativeId: { type: 'string', required: false, description: 'Initiative context' },
    },
    requiredCapabilities: ['record_kpi'],
    styling: 'secondary',
  },
  {
    type: 'START_ARTIFACT_REVIEW',
    label: 'chat.actions.startArtifactReview.label',
    description: 'chat.actions.startArtifactReview.description',
    icon: 'ShieldCheck',
    category: 'creation',
    payloadSchema: {
      artifactId: {
        type: 'string',
        required: true,
        description: 'Artifact ID to start review for',
      },
    },
    requiredCapabilities: ['create_report'],
    styling: 'primary',
  },
  {
    type: 'CHECK_TRUST_STATE',
    label: 'chat.actions.checkTrustState.label',
    description: 'chat.actions.checkTrustState.description',
    icon: 'Eye',
    category: 'navigation',
    payloadSchema: {
      artifactId: {
        type: 'string',
        required: true,
        description: 'Artifact ID to inspect trust state',
      },
    },
    requiredCapabilities: ['read'],
    styling: 'secondary',
  },
  {
    type: 'USE_TEMPLATE',
    label: 'chat.actions.useTemplate.label',
    description: 'chat.actions.useTemplate.description',
    icon: 'BookTemplate',
    category: 'generation',
    payloadSchema: {
      templateArtifactId: {
        type: 'string',
        required: true,
        description: 'Template artifact ID to use',
      },
      outputType: { type: 'string', required: false, description: 'report or presentation' },
    },
    requiredCapabilities: ['create_report'],
    styling: 'primary',
  },
  {
    type: 'BROWSE_TEMPLATES',
    label: 'chat.actions.browseTemplates.label',
    description: 'chat.actions.browseTemplates.description',
    icon: 'LayoutGrid',
    category: 'navigation',
    payloadSchema: {
      templateType: {
        type: 'string',
        required: false,
        description: 'Filter: report or presentation',
      },
      category: { type: 'string', required: false, description: 'Filter: R1, R2, R3, R4, etc.' },
    },
    requiredCapabilities: ['read'],
    styling: 'secondary',
  },
  {
    type: 'ANALYZE_STATEMENT',
    label: 'chat.actions.analyzeStatement.label',
    description: 'chat.actions.analyzeStatement.description',
    icon: 'FileText',
    category: 'recording',
    payloadSchema: {
      statementPackId: {
        type: 'string',
        required: true,
        description: 'Financial statement pack ID to analyze',
      },
    },
    requiredCapabilities: ['read'],
    styling: 'primary',
  },
  {
    type: 'REVIEW_MODEL',
    label: 'chat.actions.reviewModel.label',
    description: 'chat.actions.reviewModel.description',
    icon: 'Calculator',
    category: 'recording',
    payloadSchema: {
      modelId: { type: 'string', required: true, description: 'Financial model ID to review' },
    },
    requiredCapabilities: ['read'],
    styling: 'primary',
  },
  {
    type: 'CHECK_LANE_STATUS',
    label: 'chat.actions.checkLaneStatus.label',
    description: 'chat.actions.checkLaneStatus.description',
    icon: 'GitBranch',
    category: 'navigation',
    payloadSchema: {
      runId: { type: 'string', required: false, description: 'Specific lane run ID (optional)' },
    },
    requiredCapabilities: ['read'],
    styling: 'secondary',
  },
];
