/**
 * Shared Types between Frontend and Backend
 * Enterprise SaaS Architecture
 *
 * Re-exports types from server/src/types/index.ts for use across the stack.
 * These types ensure consistency between frontend and backend.
 */

// Re-export from backend types (which should align with frontend types)
export type {
  AIConversation,
  AIMessage,
  ApiResponse,
  AsyncHandler,
  AuthenticatedRequest,
  AuthenticatedUser,
  Decision,
  DecisionStatus,
  Initiative,
  InitiativeStatus,
  LLMConfig,
  LLMProvider,
  Notification,
  NotificationCategory,
  NotificationType,
  Organization,
  OrganizationBranding,
  OrganizationPlan,
  OrganizationStatus,
  PaginatedResponse,
  PMODomain,
  Project,
  ProjectStatus,
  RAIDItem,
  RAIDSeverity,
  RAIDStatus,
  RAIDType,
  StageGate,
  StageGateStatus,
  Subscription,
  SubscriptionStatus,
  Task,
  TaskPriority,
  TaskStatus,
  TokenUsage,
  User,
  UserRole,
  UserStatus,
} from './index.js';
