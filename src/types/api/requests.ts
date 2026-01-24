/**
 * API Request Types
 * Enterprise SaaS Architecture - Typed API Requests
 *
 * This file contains all API request types to eliminate `: any` usage.
 */

// ==========================================
// GENERIC REQUEST HELPERS
// ==========================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Date range filter
 */
export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Combined list params
 */
export interface ListParams extends PaginationParams, SortParams, DateRangeParams {
  search?: string;
  filter?: Record<string, string | number | boolean>;
}

// ==========================================
// AUTH REQUESTS
// ==========================================

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone?: string;
  referralCode?: string;
  acceptTerms: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ==========================================
// PROJECT REQUESTS
// ==========================================

export interface CreateProjectRequest {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  methodology?: string;
  templateId?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  methodology?: string;
}

export interface AddProjectMemberRequest {
  userId: string;
  role?: string;
}

export interface ProjectFilterParams extends ListParams {
  status?: string;
  ownerId?: string;
  memberId?: string;
}

// ==========================================
// TASK REQUESTS
// ==========================================

export interface CreateTaskRequest {
  projectId: string;
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  tags?: string[];
  initiativeId?: string;
  parentTaskId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  tags?: string[];
  initiativeId?: string;
}

export interface BulkUpdateTaskRequest {
  taskIds: string[];
  updates: Partial<UpdateTaskRequest>;
}

export interface CreateTaskCommentRequest {
  content: string;
  mentionedUserIds?: string[];
}

export interface TaskFilterParams extends ListParams {
  projectId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  initiativeId?: string;
  dueBefore?: string;
  dueAfter?: string;
  tags?: string[];
}

// ==========================================
// INITIATIVE REQUESTS
// ==========================================

export interface CreateInitiativeRequest {
  projectId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  owner?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  category?: string;
  tags?: string[];
}

export interface UpdateInitiativeRequest {
  title?: string;
  description?: string;
  status?: 'draft' | 'planning' | 'active' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  owner?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  actualCost?: number;
  category?: string;
  tags?: string[];
}

export interface CreateInitiativeKPIRequest {
  name: string;
  target: number;
  unit: string;
  description?: string;
}

export interface UpdateInitiativeKPIRequest {
  name?: string;
  target?: number;
  current?: number;
  unit?: string;
}

export interface InitiativeFilterParams extends ListParams {
  projectId?: string;
  status?: string;
  priority?: string;
  owner?: string;
  category?: string;
  tags?: string[];
}

// ==========================================
// ORGANIZATION REQUESTS
// ==========================================

export interface CreateOrganizationRequest {
  name: string;
  slug?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  settings?: Partial<OrganizationSettingsRequest>;
  branding?: Partial<OrganizationBrandingRequest>;
}

export interface OrganizationSettingsRequest {
  timezone: string;
  locale: string;
  dateFormat: string;
  currency: string;
}

export interface OrganizationBrandingRequest {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface InviteMemberRequest {
  email: string;
  role?: string;
  message?: string;
}

export interface UpdateMemberRoleRequest {
  role: string;
}

// ==========================================
// TEAM REQUESTS
// ==========================================

export interface CreateTeamRequest {
  name: string;
  description?: string;
  leadId?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  leadId?: string;
}

export interface AddTeamMemberRequest {
  userId: string;
  role?: 'lead' | 'member';
}

// ==========================================
// BILLING REQUESTS
// ==========================================

export interface CreateSubscriptionRequest {
  planId: string;
  paymentMethodId?: string;
  seatCount?: number;
  promoCode?: string;
}

export interface UpdateSubscriptionRequest {
  planId?: string;
  seatCount?: number;
}

export interface AddPaymentMethodRequest {
  type: 'card';
  token: string;
  setAsDefault?: boolean;
}

export interface UpdateBillingAddressRequest {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface PurchaseTokensRequest {
  packageId: string;
  paymentMethodId?: string;
}

export interface SetBudgetRequest {
  amount: number;
  period: 'daily' | 'weekly' | 'monthly';
  alertThreshold?: number;
}

// ==========================================
// AI REQUESTS
// ==========================================

export interface SendAIMessageRequest {
  message: string;
  conversationId?: string;
  projectId?: string;
  context?: AIMessageContext;
  model?: string;
  stream?: boolean;
}

export interface AIMessageContext {
  screenId?: string;
  selectedText?: string;
  attachments?: AIAttachment[];
  persona?: 'consultant' | 'project_manager' | 'architect' | 'analyst' | 'auditor';
  focusMode?: string;
}

export interface AIAttachment {
  type: 'file' | 'url' | 'code' | 'document';
  name: string;
  content?: string;
  url?: string;
  mimeType?: string;
}

export interface CreateAIProviderRequest {
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  isDefault?: boolean;
  tier?: 'free' | 'standard' | 'premium';
  maxTokens?: number;
}

export interface UpdateAIProviderRequest {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  tier?: 'free' | 'standard' | 'premium';
  maxTokens?: number;
}

export interface AIFeedbackRequest {
  messageId: string;
  rating: 'positive' | 'negative';
  feedback?: string;
}

// ==========================================
// NOTIFICATION REQUESTS
// ==========================================

export interface UpdateNotificationPreferencesRequest {
  categories?: Record<
    string,
    {
      inapp?: boolean;
      push?: boolean;
      email?: boolean;
    }
  >;
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  weekendSettings?: {
    criticalOnly?: boolean;
    digestOnly?: boolean;
  };
  dailyDigest?: {
    enabled?: boolean;
    time?: string;
  };
  weeklyDigest?: {
    enabled?: boolean;
    day?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
    time?: string;
  };
}

export interface MarkNotificationsReadRequest {
  notificationIds: string[];
}

// ==========================================
// PMO REQUESTS
// ==========================================

export interface CreateDecisionRequest {
  projectId: string;
  title: string;
  description: string;
  deciderId?: string;
  pmoDomain: string;
  dueDate?: string;
}

export interface UpdateDecisionRequest {
  title?: string;
  description?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'deferred';
  deciderId?: string;
  rationale?: string;
  impact?: string;
}

export interface CreateRAIDItemRequest {
  projectId: string;
  type: 'risk' | 'assumption' | 'issue' | 'dependency';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  owner?: string;
  dueDate?: string;
  probability?: number;
  impact?: number;
  mitigationPlan?: string;
}

export interface UpdateRAIDItemRequest {
  title?: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'in_progress' | 'mitigated' | 'closed';
  owner?: string;
  dueDate?: string;
  probability?: number;
  impact?: number;
  mitigationPlan?: string;
}

export interface CreateStageGateRequest {
  projectId: string;
  name: string;
  description?: string;
  phase: number;
  criteria: { description: string }[];
}

export interface UpdateStageGateRequest {
  name?: string;
  description?: string;
  status?: 'not_started' | 'in_progress' | 'passed' | 'failed';
  criteria?: { id?: string; description: string; isMet?: boolean; evidence?: string }[];
}

export interface ApproveStageGateRequest {
  rationale?: string;
  conditions?: string[];
}

// ==========================================
// ASSESSMENT REQUESTS
// ==========================================

export interface CreateAssessmentRequest {
  projectId: string;
  framework: string;
  title?: string;
}

export interface UpdateAssessmentRequest {
  status?: 'draft' | 'in_progress' | 'completed' | 'archived';
  title?: string;
}

export interface SubmitAxisScoreRequest {
  axisId: string;
  score: number;
  level: number;
  notes?: string;
  evidence?: string[];
}

export interface GenerateAssessmentReportRequest {
  assessmentId: string;
  type: 'executive_summary' | 'detailed' | 'gap_analysis' | 'action_plan';
  options?: {
    includeCharts?: boolean;
    includeBenchmarks?: boolean;
    language?: string;
  };
}

// ==========================================
// SETTINGS REQUESTS
// ==========================================

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  avatarUrl?: string;
  bio?: string;
  title?: string;
  linkedinUrl?: string;
}

export interface CreateIntegrationRequest {
  type: string;
  config: Record<string, string | number | boolean>;
}

export interface UpdateIntegrationRequest {
  config?: Record<string, string | number | boolean>;
  status?: 'active' | 'inactive';
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  status?: 'active' | 'inactive';
  secret?: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresAt?: string;
}

// ==========================================
// KNOWLEDGE BASE REQUESTS
// ==========================================

export interface CreateKnowledgeDocumentRequest {
  title: string;
  content?: string;
  type: 'markdown' | 'pdf' | 'url' | 'text';
  category?: string;
  tags?: string[];
  url?: string;
}

export interface UpdateKnowledgeDocumentRequest {
  title?: string;
  content?: string;
  category?: string;
  tags?: string[];
}

export interface IndexKnowledgeDocumentRequest {
  documentId: string;
  forceReindex?: boolean;
}

export interface SearchKnowledgeRequest {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
}

// ==========================================
// FEEDBACK REQUESTS
// ==========================================

export interface CreateFeedbackRequest {
  type: 'bug' | 'feature' | 'general' | 'complaint';
  message: string;
  screenshot?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateFeedbackStatusRequest {
  status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
  response?: string;
}

// ==========================================
// EXPORT/IMPORT REQUESTS
// ==========================================

export interface ExportDataRequest {
  format: 'json' | 'csv' | 'xlsx';
  entities: string[];
  filters?: Record<string, unknown>;
  dateRange?: DateRangeParams;
}

export interface ImportDataRequest {
  type: 'projects' | 'tasks' | 'initiatives';
  mappings: Record<string, string>;
  options?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  };
}
