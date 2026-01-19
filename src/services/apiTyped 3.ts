/**
 * Typed API Client
 * Enterprise SaaS Architecture - Strongly Typed API Methods
 *
 * This file provides properly typed wrappers for API operations.
 * Use these instead of the generic Api.get/post/put/delete methods.
 */

import type {
  CreateAIProviderRequest,
  CreateApiKeyRequest,
  CreateAssessmentRequest,
  CreateDecisionRequest,
  CreateFeedbackRequest,
  CreateInitiativeRequest,
  CreateIntegrationRequest,
  CreateKnowledgeDocumentRequest,
  CreateOrganizationRequest,
  CreateProjectRequest,
  CreateRAIDItemRequest,
  CreateStageGateRequest,
  CreateTaskRequest,
  CreateTeamRequest,
  CreateWebhookRequest,
  InviteMemberRequest,
  ListParams,
  // API Request Types
  LoginRequest,
  RegisterRequest,
  SearchKnowledgeRequest,
  SendAIMessageRequest,
  TaskFilterParams,
  UpdateAIProviderRequest,
  UpdateAssessmentRequest,
  UpdateDecisionRequest,
  UpdateFeedbackStatusRequest,
  UpdateInitiativeRequest,
  UpdateKnowledgeDocumentRequest,
  UpdateNotificationPreferencesRequest,
  UpdateOrganizationRequest,
  UpdateProjectRequest,
  UpdateRAIDItemRequest,
  UpdateStageGateRequest,
  UpdateTaskRequest,
  UpdateTeamRequest,
  UpdateWebhookRequest,
} from '../types/api/requests';
import type {
  AIConversationResponse,
  AIHealthResponse,
  AIMessageResponse,
  AIProviderListResponse,
  AIProviderResponse,
  AIStatsResponse,
  AnalyticsResponse,
  ApiKeyResponse,
  // API Response Types
  ApiResponse,
  AssessmentResponse,
  BillingInfoResponse,
  DecisionResponse,
  FeedbackListResponse,
  FeedbackResponse,
  InitiativeListResponse,
  InitiativeResponse,
  IntegrationResponse,
  InvoiceListResponse,
  InvoiceResponse,
  KnowledgeDocumentResponse,
  KnowledgeSearchResponse,
  LoginResponse,
  MetricsOverviewResponse,
  NotificationListResponse,
  NotificationResponse,
  OrganizationResponse,
  PaginatedResponse,
  PMOContextResponse,
  ProjectListResponse,
  ProjectResponse,
  RAIDItemResponse,
  StageGateResponse,
  SubscriptionResponse,
  SuperAdminDashboardResponse,
  SystemHealthResponse,
  TaskListResponse,
  TaskResponse,
  TeamListResponse,
  TeamResponse,
  TokenBalanceResponse,
  UsageResponse,
  UserResponse,
  WebhookResponse,
} from '../types/api/responses';
import {
  API_URL,
  fetchWithRetry,
  getHeaders,
  handleBlobResponse,
  handleResponse,
} from './apiUtils';

// ==========================================
// TYPED BASE CLIENT
// ==========================================

/**
 * Strongly typed HTTP client
 */
export const TypedApi = {
  /**
   * GET request with typed response
   */
  get: async <T>(url: string): Promise<T> => {
    const res = await fetchWithRetry(`${API_URL}${url}`, { headers: getHeaders() });
    return handleResponse(res, `GET ${url} failed`);
  },

  /**
   * POST request with typed request/response
   */
  post: async <TResponse, TRequest = unknown>(url: string, data: TRequest): Promise<TResponse> => {
    const res = await fetchWithRetry(`${API_URL}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, `POST ${url} failed`);
  },

  /**
   * PUT request with typed request/response
   */
  put: async <TResponse, TRequest = unknown>(url: string, data: TRequest): Promise<TResponse> => {
    const res = await fetchWithRetry(`${API_URL}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, `PUT ${url} failed`);
  },

  /**
   * PATCH request with typed request/response
   */
  patch: async <TResponse, TRequest = unknown>(url: string, data: TRequest): Promise<TResponse> => {
    const res = await fetchWithRetry(`${API_URL}${url}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, `PATCH ${url} failed`);
  },

  /**
   * DELETE request with typed response
   */
  delete: async <T = void>(url: string): Promise<T> => {
    const res = await fetchWithRetry(`${API_URL}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, `DELETE ${url} failed`);
  },

  /**
   * Upload file with typed response
   */
  upload: async <T>(url: string, formData: FormData): Promise<T> => {
    const headers = { ...getHeaders() };
    delete (headers as Record<string, string>)['Content-Type'];
    const res = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(res, `Upload to ${url} failed`);
  },

  /**
   * Download file as blob
   */
  download: async (url: string): Promise<Blob> => {
    const res = await fetchWithRetry(`${API_URL}${url}`, { headers: getHeaders() });
    return handleBlobResponse(res, `Download from ${url} failed`);
  },
};

// ==========================================
// AUTH API
// ==========================================

export const AuthApi = {
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    TypedApi.post('/auth/login', credentials),

  register: (data: RegisterRequest): Promise<LoginResponse> =>
    TypedApi.post('/auth/register', data),

  logout: (): Promise<void> => TypedApi.post('/auth/logout', {}),

  getMe: (): Promise<UserResponse | null> =>
    TypedApi.get<UserResponse>('/auth/me').catch(() => null),

  refreshToken: (refreshToken: string): Promise<{ token: string; refreshToken: string }> =>
    TypedApi.post('/auth/refresh', { refreshToken }),

  verifyEmail: (token: string): Promise<{ success: boolean }> =>
    TypedApi.post('/auth/verify-email', { token }),

  resetPassword: (email: string): Promise<void> => TypedApi.post('/auth/reset-password', { email }),

  changePassword: (currentPassword: string, newPassword: string): Promise<void> =>
    TypedApi.post('/auth/change-password', { currentPassword, newPassword }),
};

// ==========================================
// PROJECTS API
// ==========================================

export const ProjectsApi = {
  list: (params?: ListParams): Promise<ProjectListResponse> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/projects${query}`);
  },

  get: (id: string): Promise<ProjectResponse> => TypedApi.get(`/projects/${id}`),

  create: (data: CreateProjectRequest): Promise<ProjectResponse> =>
    TypedApi.post('/projects', data),

  update: (id: string, data: UpdateProjectRequest): Promise<ProjectResponse> =>
    TypedApi.put(`/projects/${id}`, data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/projects/${id}`),

  getMembers: (id: string): Promise<UserResponse[]> => TypedApi.get(`/projects/${id}/members`),

  addMember: (projectId: string, userId: string, role?: string): Promise<void> =>
    TypedApi.post(`/projects/${projectId}/members`, { userId, role }),

  removeMember: (projectId: string, userId: string): Promise<void> =>
    TypedApi.delete(`/projects/${projectId}/members/${userId}`),
};

// ==========================================
// TASKS API
// ==========================================

export const TasksApi = {
  list: (params?: TaskFilterParams): Promise<TaskListResponse> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/tasks${query}`);
  },

  get: (id: string): Promise<TaskResponse> => TypedApi.get(`/tasks/${id}`),

  create: (data: CreateTaskRequest): Promise<TaskResponse> => TypedApi.post('/tasks', data),

  update: (id: string, data: UpdateTaskRequest): Promise<TaskResponse> =>
    TypedApi.put(`/tasks/${id}`, data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/tasks/${id}`),

  updateStatus: (id: string, status: string): Promise<TaskResponse> =>
    TypedApi.patch(`/tasks/${id}/status`, { status }),

  assign: (id: string, assigneeId: string): Promise<TaskResponse> =>
    TypedApi.patch(`/tasks/${id}/assign`, { assigneeId }),

  bulkUpdate: (taskIds: string[], updates: Partial<UpdateTaskRequest>): Promise<TaskResponse[]> =>
    TypedApi.post('/tasks/bulk-update', { taskIds, updates }),

  getComments: (taskId: string): Promise<{ comments: unknown[] }> =>
    TypedApi.get(`/tasks/${taskId}/comments`),

  addComment: (taskId: string, content: string): Promise<unknown> =>
    TypedApi.post(`/tasks/${taskId}/comments`, { content }),
};

// ==========================================
// INITIATIVES API
// ==========================================

export const InitiativesApi = {
  list: (params?: { projectId?: string; status?: string }): Promise<InitiativeListResponse> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/initiatives${query}`);
  },

  get: (id: string): Promise<InitiativeResponse> => TypedApi.get(`/initiatives/${id}`),

  create: (data: CreateInitiativeRequest): Promise<InitiativeResponse> =>
    TypedApi.post('/initiatives', data),

  update: (id: string, data: UpdateInitiativeRequest): Promise<InitiativeResponse> =>
    TypedApi.put(`/initiatives/${id}`, data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/initiatives/${id}`),

  getTasks: (id: string): Promise<TaskListResponse> => TypedApi.get(`/initiatives/${id}/tasks`),
};

// ==========================================
// ORGANIZATIONS API
// ==========================================

export const OrganizationsApi = {
  get: (id: string): Promise<OrganizationResponse> => TypedApi.get(`/organizations/${id}`),

  create: (data: CreateOrganizationRequest): Promise<OrganizationResponse> =>
    TypedApi.post('/organizations', data),

  update: (id: string, data: UpdateOrganizationRequest): Promise<OrganizationResponse> =>
    TypedApi.put(`/organizations/${id}`, data),

  getMembers: (id: string): Promise<UserResponse[]> => TypedApi.get(`/organizations/${id}/members`),

  inviteMember: (orgId: string, data: InviteMemberRequest): Promise<void> =>
    TypedApi.post(`/organizations/${orgId}/invitations`, data),

  removeMember: (orgId: string, userId: string): Promise<void> =>
    TypedApi.delete(`/organizations/${orgId}/members/${userId}`),

  updateMemberRole: (orgId: string, userId: string, role: string): Promise<void> =>
    TypedApi.patch(`/organizations/${orgId}/members/${userId}`, { role }),
};

// ==========================================
// TEAMS API
// ==========================================

export const TeamsApi = {
  list: (orgId: string): Promise<TeamListResponse> => TypedApi.get(`/organizations/${orgId}/teams`),

  get: (id: string): Promise<TeamResponse> => TypedApi.get(`/teams/${id}`),

  create: (data: CreateTeamRequest): Promise<TeamResponse> => TypedApi.post('/teams', data),

  update: (id: string, data: UpdateTeamRequest): Promise<TeamResponse> =>
    TypedApi.put(`/teams/${id}`, data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/teams/${id}`),

  addMember: (teamId: string, userId: string): Promise<void> =>
    TypedApi.post(`/teams/${teamId}/members`, { userId }),

  removeMember: (teamId: string, userId: string): Promise<void> =>
    TypedApi.delete(`/teams/${teamId}/members/${userId}`),
};

// ==========================================
// BILLING API
// ==========================================

export const BillingApi = {
  getSubscription: (): Promise<SubscriptionResponse | null> =>
    TypedApi.get<SubscriptionResponse>('/billing/subscription').catch(() => null),

  getBillingInfo: (): Promise<BillingInfoResponse> => TypedApi.get('/billing/info'),

  getInvoices: (params?: ListParams): Promise<InvoiceListResponse> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/billing/invoices${query}`);
  },

  getInvoice: (id: string): Promise<InvoiceResponse> => TypedApi.get(`/billing/invoices/${id}`),

  downloadInvoice: (id: string): Promise<Blob> =>
    TypedApi.download(`/billing/invoices/${id}/download`),

  getTokenBalance: (): Promise<TokenBalanceResponse> => TypedApi.get('/billing/tokens'),

  getUsage: (): Promise<UsageResponse> => TypedApi.get('/billing/usage'),

  changePlan: (planId: string): Promise<SubscriptionResponse> =>
    TypedApi.post('/billing/change-plan', { planId }),

  cancelSubscription: (reason?: string): Promise<void> =>
    TypedApi.post('/billing/cancel', { reason }),
};

// ==========================================
// AI API
// ==========================================

export const AIApi = {
  chat: (message: SendAIMessageRequest): Promise<AIMessageResponse> =>
    TypedApi.post('/ai/chat', message),

  getConversations: (): Promise<AIConversationResponse[]> => TypedApi.get('/ai/conversations'),

  getConversation: (id: string): Promise<AIConversationResponse> =>
    TypedApi.get(`/ai/conversations/${id}`),

  deleteConversation: (id: string): Promise<void> => TypedApi.delete(`/ai/conversations/${id}`),

  getProviders: (): Promise<AIProviderListResponse> => TypedApi.get('/ai/providers'),

  createProvider: (data: CreateAIProviderRequest): Promise<AIProviderResponse> =>
    TypedApi.post('/ai/providers', data),

  updateProvider: (id: string, data: UpdateAIProviderRequest): Promise<AIProviderResponse> =>
    TypedApi.put(`/ai/providers/${id}`, data),

  deleteProvider: (id: string): Promise<void> => TypedApi.delete(`/ai/providers/${id}`),

  testProvider: (id: string): Promise<{ success: boolean; latency?: number; error?: string }> =>
    TypedApi.post(`/ai/providers/${id}/test`, {}),

  getStats: (): Promise<AIStatsResponse> => TypedApi.get('/ai/stats'),

  getHealth: (): Promise<AIHealthResponse> => TypedApi.get('/ai/health'),

  submitFeedback: (
    messageId: string,
    rating: 'positive' | 'negative',
    comment?: string
  ): Promise<void> => TypedApi.post('/ai/feedback', { messageId, rating, comment }),
};

// ==========================================
// NOTIFICATIONS API
// ==========================================

export const NotificationsApi = {
  list: (): Promise<NotificationListResponse> => TypedApi.get('/notifications'),

  markRead: (id: string): Promise<void> => TypedApi.patch(`/notifications/${id}/read`, {}),

  markAllRead: (): Promise<void> => TypedApi.post('/notifications/mark-all-read', {}),

  delete: (id: string): Promise<void> => TypedApi.delete(`/notifications/${id}`),

  updatePreferences: (preferences: UpdateNotificationPreferencesRequest): Promise<void> =>
    TypedApi.put('/notifications/preferences', preferences),
};

// ==========================================
// ANALYTICS API
// ==========================================

export const AnalyticsApi = {
  getOverview: (): Promise<MetricsOverviewResponse> => TypedApi.get('/analytics/overview'),

  getAnalytics: (params?: { period?: string }): Promise<AnalyticsResponse> => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return TypedApi.get(`/analytics${query}`);
  },
};

// ==========================================
// PMO API
// ==========================================

export const PMOApi = {
  getContext: (projectId: string): Promise<PMOContextResponse> =>
    TypedApi.get(`/pmo/projects/${projectId}/context`),

  // Decisions
  getDecisions: (projectId: string): Promise<DecisionResponse[]> =>
    TypedApi.get(`/pmo/projects/${projectId}/decisions`),

  createDecision: (data: CreateDecisionRequest): Promise<DecisionResponse> =>
    TypedApi.post('/pmo/decisions', data),

  updateDecision: (id: string, data: UpdateDecisionRequest): Promise<DecisionResponse> =>
    TypedApi.put(`/pmo/decisions/${id}`, data),

  // Stage Gates
  getStageGates: (projectId: string): Promise<StageGateResponse[]> =>
    TypedApi.get(`/pmo/projects/${projectId}/gates`),

  createStageGate: (data: CreateStageGateRequest): Promise<StageGateResponse> =>
    TypedApi.post('/pmo/gates', data),

  updateStageGate: (id: string, data: UpdateStageGateRequest): Promise<StageGateResponse> =>
    TypedApi.put(`/pmo/gates/${id}`, data),

  // RAID
  getRAIDItems: (projectId: string, type?: string): Promise<RAIDItemResponse[]> => {
    const query = type ? `?type=${type}` : '';
    return TypedApi.get(`/pmo/projects/${projectId}/raid${query}`);
  },

  createRAIDItem: (data: CreateRAIDItemRequest): Promise<RAIDItemResponse> =>
    TypedApi.post('/pmo/raid', data),

  updateRAIDItem: (id: string, data: UpdateRAIDItemRequest): Promise<RAIDItemResponse> =>
    TypedApi.put(`/pmo/raid/${id}`, data),

  deleteRAIDItem: (id: string): Promise<void> => TypedApi.delete(`/pmo/raid/${id}`),
};

// ==========================================
// ASSESSMENTS API
// ==========================================

export const AssessmentsApi = {
  list: (projectId?: string): Promise<AssessmentResponse[]> => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return TypedApi.get(`/assessments${query}`);
  },

  get: (id: string): Promise<AssessmentResponse> => TypedApi.get(`/assessments/${id}`),

  create: (data: CreateAssessmentRequest): Promise<AssessmentResponse> =>
    TypedApi.post('/assessments', data),

  update: (id: string, data: UpdateAssessmentRequest): Promise<AssessmentResponse> =>
    TypedApi.put(`/assessments/${id}`, data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/assessments/${id}`),
};

// ==========================================
// INTEGRATIONS API
// ==========================================

export const IntegrationsApi = {
  list: (orgId: string): Promise<IntegrationResponse[]> =>
    TypedApi.get(`/integrations?organizationId=${orgId}`),

  create: (data: CreateIntegrationRequest): Promise<IntegrationResponse> =>
    TypedApi.post('/integrations', data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/integrations/${id}`),

  // Webhooks
  getWebhooks: (): Promise<WebhookResponse[]> => TypedApi.get('/integrations/webhooks'),

  createWebhook: (data: CreateWebhookRequest): Promise<WebhookResponse> =>
    TypedApi.post('/integrations/webhooks', data),

  updateWebhook: (id: string, data: UpdateWebhookRequest): Promise<WebhookResponse> =>
    TypedApi.put(`/integrations/webhooks/${id}`, data),

  deleteWebhook: (id: string): Promise<void> => TypedApi.delete(`/integrations/webhooks/${id}`),

  testWebhook: (id: string): Promise<{ success: boolean; error?: string }> =>
    TypedApi.post(`/integrations/webhooks/${id}/test`, {}),

  // API Keys
  getApiKeys: (): Promise<ApiKeyResponse[]> => TypedApi.get('/user/api-keys'),

  createApiKey: (data: CreateApiKeyRequest): Promise<ApiKeyResponse & { key: string }> =>
    TypedApi.post('/user/api-keys', data),

  deleteApiKey: (id: string): Promise<void> => TypedApi.delete(`/user/api-keys/${id}`),

  rotateApiKey: (id: string): Promise<{ key: string }> =>
    TypedApi.put(`/user/api-keys/${id}/rotate`, {}),
};

// ==========================================
// KNOWLEDGE BASE API
// ==========================================

export const KnowledgeApi = {
  list: (params?: { category?: string; tags?: string[] }): Promise<KnowledgeDocumentResponse[]> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/knowledge/documents${query}`);
  },

  get: (id: string): Promise<KnowledgeDocumentResponse> =>
    TypedApi.get(`/knowledge/documents/${id}`),

  create: (data: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentResponse> =>
    TypedApi.post('/knowledge/documents', data),

  update: (id: string, data: UpdateKnowledgeDocumentRequest): Promise<KnowledgeDocumentResponse> =>
    TypedApi.put(`/knowledge/documents/${id}`, data),

  delete: (id: string): Promise<void> => TypedApi.delete(`/knowledge/documents/${id}`),

  upload: (
    file: File,
    metadata?: Partial<CreateKnowledgeDocumentRequest>
  ): Promise<KnowledgeDocumentResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return TypedApi.upload('/knowledge/upload', formData);
  },

  search: (query: SearchKnowledgeRequest): Promise<KnowledgeSearchResponse> =>
    TypedApi.post('/knowledge/search', query),

  index: (id: string): Promise<void> => TypedApi.post(`/knowledge/documents/${id}/index`, {}),
};

// ==========================================
// FEEDBACK API
// ==========================================

export const FeedbackApi = {
  list: (params?: ListParams): Promise<FeedbackListResponse> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/feedback${query}`);
  },

  submit: (data: CreateFeedbackRequest): Promise<FeedbackResponse> =>
    TypedApi.post('/feedback', data),

  updateStatus: (id: string, data: UpdateFeedbackStatusRequest): Promise<FeedbackResponse> =>
    TypedApi.patch(`/feedback/${id}/status`, data),

  respond: (id: string, response: string): Promise<FeedbackResponse> =>
    TypedApi.post(`/feedback/${id}/respond`, { response }),
};

// ==========================================
// ADMIN API
// ==========================================

export const AdminApi = {
  getDashboard: (): Promise<SuperAdminDashboardResponse> => TypedApi.get('/admin/dashboard'),

  getSystemHealth: (): Promise<SystemHealthResponse> => TypedApi.get('/admin/system/health'),

  getUsers: (params?: ListParams): Promise<{ users: UserResponse[]; total: number }> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/admin/users${query}`);
  },

  getUser: (id: string): Promise<UserResponse> => TypedApi.get(`/admin/users/${id}`),

  updateUser: (id: string, data: Partial<UserResponse>): Promise<UserResponse> =>
    TypedApi.put(`/admin/users/${id}`, data),

  suspendUser: (id: string, reason?: string): Promise<void> =>
    TypedApi.post(`/admin/users/${id}/suspend`, { reason }),

  unsuspendUser: (id: string): Promise<void> => TypedApi.post(`/admin/users/${id}/unsuspend`, {}),

  impersonateUser: (id: string): Promise<{ token: string }> =>
    TypedApi.post(`/admin/users/${id}/impersonate`, {}),

  getOrganizations: (
    params?: ListParams
  ): Promise<{ organizations: OrganizationResponse[]; total: number }> => {
    const query = params ? `?${new URLSearchParams(params as Record<string, string>)}` : '';
    return TypedApi.get(`/admin/organizations${query}`);
  },
};

// ==========================================
// EXPORT ALL
// ==========================================
