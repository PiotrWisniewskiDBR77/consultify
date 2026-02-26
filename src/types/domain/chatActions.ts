/**
 * Chat Actions (V3-B02)
 * Central action type registry: one catalog of action types + payload schemas + capabilities.
 * Zero "dead" actions — all types are defined here and used by chat components.
 */

export const ACTION_SCHEMA_VERSION = '1.0';

export type ChatActionType =
  | 'NAVIGATE'
  | 'CREATE_TASK'
  | 'CREATE_DECISION'
  | 'CREATE_INITIATIVE'
  | 'GENERATE_REPORT'
  | 'GENERATE_PRESENTATION'
  | 'START_TOOL'
  | 'OPEN_PREVIEW'
  | 'ASSIGN_INTERVIEW'
  | 'RECORD_KPI';

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
    type: 'CREATE_TASK',
    label: 'chat.actions.createTask.label',
    description: 'chat.actions.createTask.description',
    icon: 'CheckSquare',
    category: 'creation',
    payloadSchema: {
      title: { type: 'string', required: true, description: 'Task title' },
      description: { type: 'string', required: false, description: 'Task description' },
      priority: { type: 'string', required: false, description: 'Priority: low, medium, high' },
      dueDate: { type: 'string', required: false, description: 'ISO date string' },
      initiativeId: { type: 'string', required: false, description: 'Related initiative ID' },
    },
    requiredCapabilities: ['create_task'],
    styling: 'primary',
  },
  {
    type: 'CREATE_DECISION',
    label: 'chat.actions.createDecision.label',
    description: 'chat.actions.createDecision.description',
    icon: 'Scale',
    category: 'creation',
    payloadSchema: {
      title: { type: 'string', required: true, description: 'Decision title' },
      description: { type: 'string', required: false, description: 'Decision description' },
      priority: { type: 'string', required: false, description: 'Priority: low, medium, high' },
      dueDate: { type: 'string', required: false, description: 'ISO date string' },
      initiativeId: { type: 'string', required: false, description: 'Related initiative ID' },
    },
    requiredCapabilities: ['create_decision'],
    styling: 'primary',
  },
  {
    type: 'CREATE_INITIATIVE',
    label: 'chat.actions.createInitiative.label',
    description: 'chat.actions.createInitiative.description',
    icon: 'Target',
    category: 'creation',
    payloadSchema: {
      title: { type: 'string', required: true, description: 'Initiative title' },
      description: { type: 'string', required: false, description: 'Initiative description' },
      templateId: { type: 'string', required: false, description: 'Template ID to use' },
    },
    requiredCapabilities: ['create_initiative'],
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
];
