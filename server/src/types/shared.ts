/**
 * Shared Types between Frontend and Backend
 * Enterprise SaaS Architecture
 * 
 * Re-exports types from server/src/types/index.ts for use across the stack.
 * These types ensure consistency between frontend and backend.
 */

// Re-export from backend types (which should align with frontend types)
export type {
    User,
    UserRole,
    UserStatus,
    Organization,
    OrganizationPlan,
    OrganizationStatus,
    OrganizationBranding,
    Project,
    ProjectStatus,
    Task,
    TaskStatus,
    TaskPriority,
    Initiative,
    InitiativeStatus,
    RAIDItem,
    RAIDType,
    RAIDSeverity,
    RAIDStatus,
    Decision,
    DecisionStatus,
    StageGate,
    StageGateStatus,
    PMODomain,
    LLMProvider,
    LLMConfig,
    AIMessage,
    AIConversation,
    Subscription,
    SubscriptionStatus,
    TokenUsage,
    Notification,
    NotificationType,
    NotificationCategory,
    ApiResponse,
    PaginatedResponse,
    AuthenticatedUser,
    AuthenticatedRequest,
    AsyncHandler,
} from './index.js';

