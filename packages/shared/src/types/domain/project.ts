/**
 * Project Domain Types
 * Enterprise SaaS Architecture - Core Project Types
 */
import type { InitiativeStatus as CanonicalInitiativeStatus } from '../../constants/initiativeStatuses.generated';

// ==========================================
// PROJECT CORE TYPES
// ==========================================

export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';

export type ProjectMethodology =
  | 'agile'
  | 'waterfall'
  | 'hybrid'
  | 'kanban'
  | 'scrum'
  | 'prince2'
  | 'pmbok'
  | 'custom';

export type ProjectPhase = 'initiation' | 'planning' | 'execution' | 'monitoring' | 'closure';

/**
 * Core Project entity
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  phase?: ProjectPhase;
  organizationId: string;
  ownerId: string;
  ownerName?: string;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  budget?: number;
  actualCost?: number;
  currency?: string;
  methodology?: ProjectMethodology;
  progress?: number;
  health?: ProjectHealth;
  settings?: ProjectSettings;
  metadata?: ProjectMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project health indicators
 */
export interface ProjectHealth {
  overall: 'green' | 'yellow' | 'red';
  schedule: 'green' | 'yellow' | 'red';
  budget: 'green' | 'yellow' | 'red';
  scope: 'green' | 'yellow' | 'red';
  resources: 'green' | 'yellow' | 'red';
  quality: 'green' | 'yellow' | 'red';
}

/**
 * Project settings
 */
export interface ProjectSettings {
  isPrivate: boolean;
  allowGuestAccess: boolean;
  enableTimeTracking: boolean;
  enableBudgetTracking: boolean;
  defaultTaskPriority?: TaskPriority;
  workingDays?: number[];
  workingHoursPerDay?: number;
  timezone?: string;
}

/**
 * Project metadata
 */
export interface ProjectMetadata {
  externalId?: string;
  source?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
}

// ==========================================
// TASK TYPES
// ==========================================

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskType = 'task' | 'bug' | 'story' | 'epic' | 'subtask' | 'pilot';

/**
 * Core Task entity
 */
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  reporterId?: string;
  reporterName?: string;
  dueDate?: string;
  startDate?: string;
  completedAt?: string;
  estimatedHours?: number;
  actualHours?: number;
  remainingHours?: number;
  tags?: string[];
  labels?: TaskLabel[];
  checklist?: TaskChecklistItem[];
  attachments?: TaskAttachment[];
  dependencies?: TaskDependency[];
  initiativeId?: string;
  initiativeName?: string;
  parentTaskId?: string;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  commentCount?: number;
  pmoCategory?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Task label
 */
export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

/**
 * Task checklist item
 */
export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  order: number;
}

/**
 * Task attachment
 */
export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

/**
 * Task dependency
 */
export interface TaskDependency {
  id: string;
  targetTaskId: string;
  targetTaskTitle?: string;
  type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates';
}

/**
 * Task comment
 */
export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions?: string[];
  attachments?: TaskAttachment[];
  reactions?: CommentReaction[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * Comment reaction
 */
export interface CommentReaction {
  emoji: string;
  users: string[];
  count: number;
}

// ==========================================
// INITIATIVE TYPES
// ==========================================

export type InitiativeStatus = CanonicalInitiativeStatus;

export type InitiativeCategory =
  | 'digital_transformation'
  | 'process_improvement'
  | 'cost_reduction'
  | 'revenue_growth'
  | 'compliance'
  | 'innovation'
  | 'infrastructure'
  | 'other';

/**
 * Core Initiative entity
 */
export interface Initiative {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: InitiativeStatus;
  priority: TaskPriority;
  category?: InitiativeCategory;
  owner?: string;
  ownerName?: string;
  sponsor?: string;
  sponsorName?: string;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  budget?: number;
  actualCost?: number;
  currency?: string;
  roi?: number;
  npv?: number;
  paybackPeriod?: number;
  strategicAlignment?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  complexity?: 'low' | 'medium' | 'high';
  tags?: string[];
  kpis?: InitiativeKPI[];
  benefits?: InitiativeBenefit[];
  progress?: number;
  taskCount?: number;
  completedTaskCount?: number;
  gateStatus?: 'passed' | 'pending' | 'failed';
  currentPhase?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Initiative KPI
 */
export interface InitiativeKPI {
  id: string;
  initiativeId: string;
  name: string;
  description?: string;
  target: number;
  current: number;
  baseline?: number;
  unit: string;
  direction: 'increase' | 'decrease' | 'maintain';
  trend?: 'up' | 'down' | 'stable';
  measurements?: KPIMeasurement[];
  createdAt: string;
  updatedAt: string;
}

/**
 * KPI measurement
 */
export interface KPIMeasurement {
  id: string;
  value: number;
  date: string;
  notes?: string;
  createdBy?: string;
}

/**
 * Initiative benefit
 */
export interface InitiativeBenefit {
  id: string;
  initiativeId: string;
  name: string;
  description?: string;
  type: 'financial' | 'operational' | 'strategic' | 'compliance' | 'other';
  category: 'cost_reduction' | 'revenue_increase' | 'efficiency' | 'quality' | 'risk_mitigation';
  value?: number;
  currency?: string;
  realizedValue?: number;
  realizationDate?: string;
  status: 'planned' | 'in_progress' | 'realized' | 'not_realized';
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// PROJECT MEMBER TYPES
// ==========================================

export type ProjectRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'guest';

/**
 * Project member
 */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  email: string;
  avatarUrl?: string;
  role: ProjectRole;
  permissions?: string[];
  joinedAt: string;
  lastActive?: string;
}

// ==========================================
// PROJECT TIMELINE TYPES
// ==========================================

/**
 * Project milestone
 */
export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  dueDate: string;
  completedDate?: string;
  status: 'pending' | 'completed' | 'missed' | 'cancelled';
  owner?: string;
  ownerName?: string;
  linkedTasks?: string[];
  linkedInitiatives?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Project activity log entry
 */
export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  entityType: 'project' | 'task' | 'initiative' | 'milestone' | 'member' | 'comment';
  entityId: string;
  entityTitle?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// ==========================================
// EXPORT INDEX
// ==========================================
