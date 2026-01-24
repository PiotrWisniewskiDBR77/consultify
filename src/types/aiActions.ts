/**
 * AI Actions Types
 *
 * Defines types for AI-proposed actions that users can approve, edit, or dismiss.
 * Actions allow AI to propose changes in the system that require user confirmation.
 *
 * @version 1.0.0
 */

// ============================================================================
// Action Types
// ============================================================================

/**
 * Types of actions AI can propose
 */
export type AIActionType =
  | 'create_task'
  | 'update_task'
  | 'create_initiative'
  | 'update_initiative'
  | 'create_decision'
  | 'schedule_meeting'
  | 'generate_report'
  | 'send_notification'
  | 'update_assessment'
  | 'create_milestone'
  | 'assign_resource'
  | 'navigate'
  | 'custom';

/**
 * Action status in the approval workflow
 */
export type AIActionStatus =
  | 'proposed' // AI proposed, waiting for user decision
  | 'approved' // User approved, executing
  | 'executed' // Successfully executed
  | 'edited' // User edited before approval
  | 'dismissed' // User dismissed/rejected
  | 'failed' // Execution failed
  | 'expired'; // Action expired without decision

/**
 * Risk level of the action
 */
export type AIActionRisk = 'low' | 'medium' | 'high';

// ============================================================================
// Action Interfaces
// ============================================================================

/**
 * Base AI Action interface
 */
export interface AIAction {
  id: string;
  type: AIActionType;
  status: AIActionStatus;

  // Display info
  title: string;
  description: string;
  icon?: string;

  // Action payload
  payload: AIActionPayload;

  // Context
  conversationId: string;
  messageId: string;
  projectId?: string;

  // Risk assessment
  risk: AIActionRisk;
  requiresConfirmation: boolean;

  // Timestamps
  proposedAt: Date;
  decidedAt?: Date;
  executedAt?: Date;
  expiresAt?: Date;

  // User who made decision
  decidedBy?: string;

  // Edit history
  originalPayload?: AIActionPayload;
  editedPayload?: AIActionPayload;

  // Execution result
  result?: AIActionResult;
}

/**
 * Action payload - varies by action type
 */
export interface AIActionPayload {
  // Common fields
  targetType?: string;
  targetId?: string;

  // Task creation/update
  task?: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    dueDate?: string;
    assigneeId?: string;
    projectId?: string;
    initiativeId?: string;
    tags?: string[];
  };

  // Initiative creation/update
  initiative?: {
    title: string;
    description?: string;
    category?: string;
    priority?: number;
    estimatedEffort?: number;
    projectId?: string;
  };

  // Decision creation
  decision?: {
    title: string;
    description?: string;
    options?: string[];
    deadline?: string;
    stakeholders?: string[];
  };

  // Meeting scheduling
  meeting?: {
    title: string;
    description?: string;
    startTime?: string;
    duration?: number;
    attendees?: string[];
  };

  // Report generation
  report?: {
    type: string;
    title?: string;
    sections?: string[];
    format?: 'pdf' | 'docx' | 'html';
  };

  // Navigation
  navigation?: {
    view: string;
    params?: Record<string, string>;
  };

  // Custom action
  custom?: Record<string, unknown>;
}

/**
 * Action execution result
 */
export interface AIActionResult {
  success: boolean;
  message?: string;
  createdId?: string;
  redirectUrl?: string;
  error?: string;
}

// ============================================================================
// Action Card Props
// ============================================================================

/**
 * Props for ActionCard component
 */
export interface AIActionCardProps {
  action: AIAction;
  onApprove: (actionId: string) => void;
  onEdit: (actionId: string, editedPayload: AIActionPayload) => void;
  onDismiss: (actionId: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Props for ActionList component
 */
export interface AIActionListProps {
  actions: AIAction[];
  onApprove: (actionId: string) => void;
  onEdit: (actionId: string, editedPayload: AIActionPayload) => void;
  onDismiss: (actionId: string) => void;
  onDismissAll?: () => void;
  maxVisible?: number;
  compact?: boolean;
}

// ============================================================================
// Action Configuration
// ============================================================================

/**
 * Configuration for action types
 */
export interface AIActionTypeConfig {
  type: AIActionType;
  label: string;
  icon: string;
  color: string;
  defaultRisk: AIActionRisk;
  requiresConfirmation: boolean;
  expiresInMinutes?: number;
}

/**
 * Default configurations for action types
 */
export const ACTION_TYPE_CONFIGS: Record<AIActionType, AIActionTypeConfig> = {
  create_task: {
    type: 'create_task',
    label: 'Utwórz zadanie',
    icon: 'CheckSquare',
    color: 'green',
    defaultRisk: 'low',
    requiresConfirmation: true,
  },
  update_task: {
    type: 'update_task',
    label: 'Aktualizuj zadanie',
    icon: 'Edit',
    color: 'blue',
    defaultRisk: 'low',
    requiresConfirmation: true,
  },
  create_initiative: {
    type: 'create_initiative',
    label: 'Utwórz inicjatywę',
    icon: 'Lightbulb',
    color: 'amber',
    defaultRisk: 'medium',
    requiresConfirmation: true,
  },
  update_initiative: {
    type: 'update_initiative',
    label: 'Aktualizuj inicjatywę',
    icon: 'Edit',
    color: 'amber',
    defaultRisk: 'low',
    requiresConfirmation: true,
  },
  create_decision: {
    type: 'create_decision',
    label: 'Utwórz decyzję',
    icon: 'GitBranch',
    color: 'purple',
    defaultRisk: 'medium',
    requiresConfirmation: true,
  },
  schedule_meeting: {
    type: 'schedule_meeting',
    label: 'Zaplanuj spotkanie',
    icon: 'Calendar',
    color: 'cyan',
    defaultRisk: 'low',
    requiresConfirmation: true,
  },
  generate_report: {
    type: 'generate_report',
    label: 'Generuj raport',
    icon: 'FileText',
    color: 'indigo',
    defaultRisk: 'low',
    requiresConfirmation: false,
  },
  send_notification: {
    type: 'send_notification',
    label: 'Wyślij powiadomienie',
    icon: 'Bell',
    color: 'orange',
    defaultRisk: 'medium',
    requiresConfirmation: true,
  },
  update_assessment: {
    type: 'update_assessment',
    label: 'Aktualizuj assessment',
    icon: 'Target',
    color: 'red',
    defaultRisk: 'high',
    requiresConfirmation: true,
  },
  create_milestone: {
    type: 'create_milestone',
    label: 'Utwórz milestone',
    icon: 'Flag',
    color: 'emerald',
    defaultRisk: 'medium',
    requiresConfirmation: true,
  },
  assign_resource: {
    type: 'assign_resource',
    label: 'Przypisz zasób',
    icon: 'Users',
    color: 'slate',
    defaultRisk: 'medium',
    requiresConfirmation: true,
  },
  navigate: {
    type: 'navigate',
    label: 'Nawiguj do',
    icon: 'ExternalLink',
    color: 'slate',
    defaultRisk: 'low',
    requiresConfirmation: false,
  },
  custom: {
    type: 'custom',
    label: 'Akcja niestandardowa',
    icon: 'Zap',
    color: 'violet',
    defaultRisk: 'medium',
    requiresConfirmation: true,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get action type configuration
 */
export function getActionTypeConfig(type: AIActionType): AIActionTypeConfig {
  return ACTION_TYPE_CONFIGS[type] || ACTION_TYPE_CONFIGS.custom;
}

/**
 * Check if action is pending (waiting for user decision)
 */
export function isActionPending(action: AIAction): boolean {
  return action.status === 'proposed';
}

/**
 * Check if action has expired
 */
export function isActionExpired(action: AIAction): boolean {
  if (!action.expiresAt) return false;
  return new Date() > new Date(action.expiresAt);
}

/**
 * Get risk level color
 */
export function getRiskColor(risk: AIActionRisk): string {
  switch (risk) {
    case 'low':
      return 'green';
    case 'medium':
      return 'amber';
    case 'high':
      return 'red';
    default:
      return 'slate';
  }
}
