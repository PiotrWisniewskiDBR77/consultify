/**
 * My Work Module - TypeScript Definitions
 * Part of PMO Upgrade to World-Class Standards
 * 
 * @module types/myWork
 */

import { Task, User, TaskStatus, TaskPriority } from '../types';

// ============================================================================
// CORE ENUMS & TYPES
// ============================================================================

/**
 * Time blocks for Focus view - organize daily tasks
 */
export type TimeBlock = 'morning' | 'afternoon' | 'buffer';

/**
 * Triage actions for Inbox items
 */
export type TriageAction = 
  | 'accept_today'    // Add to today's focus
  | 'schedule'        // Schedule for a specific date
  | 'delegate'        // Delegate to another user
  | 'archive'         // Archive/hide from inbox
  | 'reject';         // Reject with reason

/**
 * PMO Priority Categories - strategic task grouping
 */
export type PMOCategory = 
  | 'blocking_phase'       // 🔴 Blocking phase gate transition
  | 'blocking_initiative'  // 🟠 Blocking initiative progress
  | 'decision_required'    // 🟡 Awaiting decision
  | 'deadline_critical'    // ⚫ Critical deadline (<48h)
  | 'high_strategic'       // 🔵 High strategic value
  | 'routine';             // ⚪ Standard tasks

/**
 * Inbox item types
 */
export type InboxItemType = 
  | 'new_assignment'    // New task assigned to user
  | 'mention'           // @mentioned in comment/task
  | 'escalation'        // Escalated from team/manager
  | 'review_request'    // Review/approval request
  | 'decision_request'  // Decision required
  | 'ai_suggestion';    // AI-generated suggestion

/**
 * Notification channels
 */
export type NotificationChannel = 'inapp' | 'push' | 'email';

/**
 * Notification categories for preferences
 */
export type NotificationCategory = 
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'decision_required'
  | 'mention'
  | 'comment'
  | 'status_change'
  | 'ai_insight'
  | 'phase_transition'
  | 'blocking_alert';

/**
 * Bottleneck types for dashboard alerts
 */
export type BottleneckType = 
  | 'stalled_tasks'     // Tasks with no activity > X days
  | 'overdue_cluster'   // Multiple overdue tasks
  | 'blocked_chain'     // Chain of blocked items
  | 'missing_assignment' // Unassigned critical tasks
  | 'decision_delay';   // Pending decisions too long

/**
 * Trend direction for metrics
 */
export type TrendDirection = 'up' | 'down' | 'stable';

// ============================================================================
// FOCUS VIEW TYPES
// ============================================================================

/**
 * Task item in Focus view
 */
export interface FocusTask {
  id: string;
  taskId: string;
  title: string;
  timeBlock: TimeBlock;
  position: number;
  priority: TaskPriority;
  dueTime?: string;
  dueDate?: string;
  initiativeId?: string;
  initiativeName?: string;
  projectName?: string;
  estimatedMinutes?: number;
  isCompleted: boolean;
  completedAt?: string;
  pmoCategory?: PMOCategory;
}

/**
 * Focus board state for a specific date
 */
export interface FocusBoard {
  date: string; // ISO date YYYY-MM-DD
  userId: string;
  tasks: FocusTask[];
  maxTasks: number; // Default: 5
  executionScore: number;
  completedCount: number;
}

/**
 * AI suggestion for Focus tasks
 */
export interface FocusSuggestion {
  suggestedTasks: Array<{
    taskId: string;
    title: string;
    reason: string;
    suggestedTimeBlock: TimeBlock;
    priority: TaskPriority;
  }>;
  reasoning: string;
  generatedAt: string;
}

// ============================================================================
// INBOX TYPES
// ============================================================================

/**
 * Source of inbox item (who/what created it)
 */
export interface InboxItemSource {
  type: 'user' | 'system' | 'ai';
  userId?: string;
  userName?: string;
  avatarUrl?: string;
}

/**
 * Single inbox item requiring triage
 */
export interface InboxItem {
  id: string;
  type: InboxItemType;
  title: string;
  description?: string;
  source: InboxItemSource;
  receivedAt: string;
  urgency: 'critical' | 'high' | 'normal' | 'low';
  
  // Related entities
  linkedTaskId?: string;
  linkedTask?: Pick<Task, 'id' | 'title' | 'status' | 'priority' | 'dueDate'>;
  linkedInitiativeId?: string;
  linkedDecisionId?: string;
  
  // Triage state
  triaged: boolean;
  triagedAt?: string;
  triageAction?: TriageAction;
  triageParams?: Record<string, unknown>;
}

/**
 * Triage action parameters
 */
export interface TriageParams {
  accept_today: Record<string, never>; // No params
  schedule: { date: string; timeBlock?: TimeBlock };
  delegate: { userId: string; message?: string };
  archive: { reason?: string };
  reject: { reason: string };
}

/**
 * Inbox state summary
 */
export interface InboxSummary {
  total: number;
  critical: number;
  newToday: number;
  groups: {
    urgent: InboxItem[];
    new_assignments: InboxItem[];
    mentions: InboxItem[];
    review_requests: InboxItem[];
    other: InboxItem[];
  };
}

// ============================================================================
// EXECUTION SCORE & METRICS
// ============================================================================

/**
 * Personal execution score with breakdown
 */
export interface ExecutionScore {
  current: number; // 0-100
  trend: TrendDirection;
  vsLastWeek: number; // Difference from last week
  breakdown: {
    completionRate: number; // % of tasks completed on time
    onTimeRate: number;     // % completed before due date
    velocityScore: number;  // Tasks completed per week
    qualityScore: number;   // Based on reopened/blocked
  };
  rank: {
    position: number;
    totalInTeam: number;
    percentile: number;
  };
  streak: {
    current: number; // Days of consecutive goal achievement
    best: number;
    lastBreak?: string;
  };
}

/**
 * Execution score history entry
 */
export interface ExecutionScoreHistory {
  date: string;
  score: number;
  completedCount: number;
  overdueCount: number;
  onTimeRate: number;
}

/**
 * Bottleneck alert item
 */
export interface Bottleneck {
  type: BottleneckType;
  count: number;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
  affectedTasks?: string[];
  affectedInitiatives?: string[];
}

/**
 * Task velocity metrics
 */
export interface VelocityMetrics {
  period: 'week' | 'month';
  data: Array<{
    date: string;
    completed: number;
    created: number;
    netVelocity: number;
  }>;
  averageVelocity: number;
  teamAverageVelocity: number;
  trend: TrendDirection;
}

// ============================================================================
// WORKLOAD & TEAM
// ============================================================================

/**
 * User workload for heatmap
 */
export interface UserWorkload {
  userId: string;
  userName: string;
  avatarUrl?: string;
  allocation: number; // 0-100%
  status: 'overloaded' | 'at_capacity' | 'available' | 'underutilized';
  taskCount: number;
  hoursAllocated: number;
  hoursCapacity: number;
  dailyBreakdown: Array<{
    date: string;
    allocation: number;
    taskCount: number;
  }>;
}

/**
 * Team workload summary
 */
export interface TeamWorkload {
  period: { start: string; end: string };
  members: UserWorkload[];
  teamAverage: number;
  overloadedCount: number;
  underutilizedCount: number;
}

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * Channel settings for a notification category
 */
export interface ChannelSettings {
  inapp: boolean;
  push: boolean;
  email: boolean;
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  
  // Per-category settings
  categories: Record<NotificationCategory, ChannelSettings>;
  
  // Quiet hours
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
  
  // Weekend settings
  weekendSettings: {
    criticalOnly: boolean;
    digestOnly: boolean;
  };
  
  // Digest settings
  dailyDigest: {
    enabled: boolean;
    time: string; // HH:mm
  };
  
  weeklyDigest: {
    enabled: boolean;
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
    time: string; // HH:mm
  };
}

/**
 * Notification digest content
 */
export interface NotificationDigest {
  period: 'daily' | 'weekly';
  generatedAt: string;
  summary: {
    tasksCompleted: number;
    tasksCreated: number;
    overdueCount: number;
    decisionsRequired: number;
    executionScore: number;
    scoreChange: number;
  };
  highlights: Array<{
    type: string;
    title: string;
    description: string;
  }>;
  upcomingDeadlines: Array<{
    taskId: string;
    title: string;
    dueDate: string;
  }>;
  aiInsights?: string[];
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * GET /api/my-work/focus request params
 */
export interface GetFocusParams {
  date?: string; // ISO date, defaults to today
}

/**
 * GET /api/my-work/focus response
 */
export interface GetFocusResponse {
  board: FocusBoard;
  suggestions?: FocusSuggestion;
}

/**
 * PUT /api/my-work/focus request body
 */
export interface SetFocusRequest {
  date: string;
  tasks: Array<{
    taskId: string;
    timeBlock: TimeBlock;
    position: number;
  }>;
}

/**
 * POST /api/my-work/focus/reorder request body
 */
export interface ReorderFocusRequest {
  date: string;
  fromIndex: number;
  toIndex: number;
}

/**
 * GET /api/my-work/inbox response
 */
export interface GetInboxResponse {
  summary: InboxSummary;
  items: InboxItem[];
}

/**
 * POST /api/my-work/inbox/:id/triage request body
 */
export interface TriageRequest {
  action: TriageAction;
  params?: TriageParams[TriageAction];
}

/**
 * POST /api/my-work/inbox/bulk-triage request body
 */
export interface BulkTriageRequest {
  itemIds: string[];
  action: TriageAction;
  params?: TriageParams[TriageAction];
}

/**
 * GET /api/my-work/execution-score response
 */
export interface GetExecutionScoreResponse {
  score: ExecutionScore;
  history: ExecutionScoreHistory[];
  bottlenecks: Bottleneck[];
}

/**
 * GET /api/my-work/velocity response
 */
export interface GetVelocityResponse {
  metrics: VelocityMetrics;
}

/**
 * GET /api/my-work/workload response
 */
export interface GetWorkloadResponse {
  workload: TeamWorkload;
}

/**
 * GET /api/notifications/preferences response
 */
export interface GetNotificationPrefsResponse {
  preferences: NotificationPreferences;
}

/**
 * PUT /api/notifications/preferences request body
 */
export interface SetNotificationPrefsRequest {
  preferences: Partial<NotificationPreferences>;
}

/**
 * GET /api/notifications/digest response
 */
export interface GetDigestPreviewResponse {
  digest: NotificationDigest;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

/**
 * Props for FocusBoard component
 */
export interface FocusBoardProps {
  date?: Date;
  onTaskComplete: (taskId: string) => void;
  onTaskClick: (taskId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddToFocus: (taskId: string, timeBlock: TimeBlock) => void;
  onRemoveFromFocus: (taskId: string) => void;
  onRequestAISuggestion: () => void;
}

/**
 * Props for InboxTriage component
 */
export interface InboxTriageProps {
  onTriage: (itemId: string, action: TriageAction, params?: TriageParams[TriageAction]) => void;
  onBulkTriage: (itemIds: string[], action: TriageAction, params?: TriageParams[TriageAction]) => void;
  onItemClick: (item: InboxItem) => void;
}

/**
 * Props for ExecutionScoreCard component
 */
export interface ExecutionScoreCardProps {
  score: ExecutionScore;
  showTrend?: boolean;
  showRank?: boolean;
  showStreak?: boolean;
  compact?: boolean;
}

/**
 * Props for WorkloadHeatmap component
 */
export interface WorkloadHeatmapProps {
  workload: TeamWorkload;
  onUserClick?: (userId: string) => void;
  showLegend?: boolean;
}

/**
 * Props for BottleneckAlerts component
 */
export interface BottleneckAlertsProps {
  bottlenecks: Bottleneck[];
  onBottleneckClick?: (bottleneck: Bottleneck) => void;
  maxVisible?: number;
}

/**
 * Props for VelocityChart component
 */
export interface VelocityChartProps {
  metrics: VelocityMetrics;
  showTeamAverage?: boolean;
  height?: number;
}

/**
 * Props for NotificationPreferences component
 */
export interface NotificationPreferencesProps {
  preferences: NotificationPreferences;
  onSave: (prefs: Partial<NotificationPreferences>) => void;
  isLoading?: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS TYPE HELPERS
// ============================================================================

/**
 * Helper to get PMO category color
 */
export type PMOCategoryColor = {
  border: string;
  bg: string;
  text: string;
  icon: string;
};

/**
 * PMO Category configuration
 */
export interface PMOCategoryConfig {
  key: PMOCategory;
  label: string;
  emoji: string;
  color: PMOCategoryColor;
  priority: number; // Sort order
}

/**
 * Export all types
 */
export type {
  Task,
  User,
  TaskStatus,
  TaskPriority
};

