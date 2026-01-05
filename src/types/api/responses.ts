/**
 * API Response Types
 * Enterprise SaaS Architecture - Typed API Responses
 *
 * This file contains all API response types to eliminate `: any` usage.
 */

// ==========================================
// GENERIC RESPONSE WRAPPERS
// ==========================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    code?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

/**
 * List response (legacy format)
 */
export interface ListResponse<T> {
    data?: T[];
    items?: T[];
    total?: number;
}

// ==========================================
// AUTH RESPONSES
// ==========================================

export interface LoginResponse {
    token: string;
    refreshToken: string;
    user: UserResponse;
}

export interface UserResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    role: string;
    status: 'active' | 'inactive' | 'suspended';
    accessLevel: 'free' | 'full';
    organizationId?: string;
    organizationName?: string;
    avatarUrl?: string;
    tokenUsage?: number;
    tokenLimit?: number;
    timezone?: string;
    locale?: string;
    isAuthenticated: boolean;
    isSuperAdmin?: boolean;
    impersonatorId?: string;
}

export interface SessionResponse {
    sessions: SessionInfo[];
}

export interface SessionInfo {
    id: string;
    device: string;
    browser: string;
    ip: string;
    lastActive: string;
    isCurrent: boolean;
}

export interface LoginHistoryEntry {
    id: string;
    timestamp: string;
    ip: string;
    device: string;
    browser: string;
    location?: string;
    success: boolean;
}

// ==========================================
// PROJECT RESPONSES
// ==========================================

export interface ProjectResponse {
    id: string;
    name: string;
    description?: string;
    status: 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';
    organizationId: string;
    ownerId: string;
    ownerName?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    currency?: string;
    methodology?: string;
    progress?: number;
    memberCount?: number;
    taskCount?: number;
    completedTaskCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectListResponse {
    projects: ProjectResponse[];
    total: number;
}

export interface ProjectMemberResponse {
    id: string;
    userId: string;
    userName: string;
    email: string;
    avatarUrl?: string;
    role: string;
    joinedAt: string;
}

// ==========================================
// TASK RESPONSES
// ==========================================

export interface TaskResponse {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'critical';
    assigneeId?: string;
    assigneeName?: string;
    assigneeAvatar?: string;
    dueDate?: string;
    estimatedHours?: number;
    actualHours?: number;
    tags?: string[];
    checklist?: TaskChecklistItemResponse;
    initiativeId?: string;
    initiativeName?: string;
    projectName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TaskChecklistItemResponse {
    id: string;
    text: string;
    completed: boolean;
}

export interface TaskListResponse {
    tasks: TaskResponse[];
    total: number;
}

export interface TaskCommentResponse {
    id: string;
    taskId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    content: string;
    createdAt: string;
}

// ==========================================
// INITIATIVE RESPONSES
// ==========================================

export interface InitiativeResponse {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    status: 'draft' | 'planning' | 'active' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';
    owner?: string;
    ownerName?: string;
    startDate?: string;
    endDate?: string;
    budget?: number;
    actualCost?: number;
    roi?: number;
    strategicAlignment?: number;
    riskLevel?: 'low' | 'medium' | 'high';
    category?: string;
    tags?: string[];
    kpis?: InitiativeKPIResponse[];
    progress?: number;
    taskCount?: number;
    completedTaskCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface InitiativeKPIResponse {
    id: string;
    name: string;
    target: number;
    current: number;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
}

export interface InitiativeListResponse {
    initiatives: InitiativeResponse[];
    total: number;
}

// ==========================================
// ORGANIZATION RESPONSES
// ==========================================

export interface OrganizationResponse {
    id: string;
    name: string;
    slug: string;
    plan: 'free' | 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'suspended' | 'cancelled';
    ownerId: string;
    ownerName?: string;
    memberCount?: number;
    projectCount?: number;
    settings?: OrganizationSettingsResponse;
    branding?: OrganizationBrandingResponse;
    createdAt: string;
    updatedAt: string;
}

export interface OrganizationSettingsResponse {
    timezone: string;
    locale: string;
    dateFormat: string;
    currency: string;
}

export interface OrganizationBrandingResponse {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    faviconUrl?: string;
}

export interface OrganizationMemberResponse {
    id: string;
    userId: string;
    email: string;
    name: string;
    avatarUrl?: string;
    role: string;
    status: 'active' | 'invited' | 'suspended';
    joinedAt: string;
    lastActive?: string;
}

// ==========================================
// TEAM RESPONSES
// ==========================================

export interface TeamResponse {
    id: string;
    name: string;
    description?: string;
    leadId?: string;
    leadName?: string;
    organizationId: string;
    memberCount: number;
    members?: TeamMemberResponse[];
    createdAt: string;
    updatedAt: string;
}

export interface TeamMemberResponse {
    userId: string;
    userName: string;
    email: string;
    avatarUrl?: string;
    role: 'lead' | 'member';
    joinedAt: string;
}

export interface TeamListResponse {
    teams: TeamResponse[];
    total: number;
}

// ==========================================
// BILLING RESPONSES
// ==========================================

export interface SubscriptionResponse {
    id: string;
    organizationId: string;
    planId: string;
    planName: string;
    status: 'active' | 'past_due' | 'cancelled' | 'trialing';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    seatCount?: number;
    usedSeats?: number;
}

export interface BillingInfoResponse {
    subscription?: SubscriptionResponse;
    paymentMethods: PaymentMethodResponse[];
    defaultPaymentMethodId?: string;
    billingEmail?: string;
    billingAddress?: BillingAddressResponse;
}

export interface PaymentMethodResponse {
    id: string;
    type: 'card' | 'bank_account';
    last4: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
}

export interface BillingAddressResponse {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
}

export interface InvoiceResponse {
    id: string;
    number: string;
    status: 'draft' | 'open' | 'paid' | 'void';
    amount: number;
    currency: string;
    createdAt: string;
    dueDate?: string;
    paidAt?: string;
    downloadUrl?: string;
    items?: InvoiceItemResponse[];
}

export interface InvoiceItemResponse {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface InvoiceListResponse {
    invoices: InvoiceResponse[];
    total: number;
}

export interface TokenBalanceResponse {
    available: number;
    used: number;
    limit: number;
    resetDate?: string;
}

export interface TokenTransactionResponse {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    provider?: string;
    model?: string;
    createdAt: string;
}

export interface UsageResponse {
    period: {
        start: string;
        end: string;
    };
    aiTokens: {
        used: number;
        limit: number;
        percentage: number;
    };
    storage: {
        used: number;
        limit: number;
        percentage: number;
    };
    seats: {
        used: number;
        limit: number;
    };
}

// ==========================================
// AI RESPONSES
// ==========================================

export interface AIMessageResponse {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    model?: string;
    tokensUsed?: number;
    artifacts?: AIArtifactResponse[];
    metadata?: Record<string, unknown>;
}

export interface AIArtifactResponse {
    id: string;
    type: 'code' | 'document' | 'diagram' | 'table' | 'chart';
    title?: string;
    content: string;
    language?: string;
    metadata?: Record<string, unknown>;
}

export interface AIConversationResponse {
    id: string;
    title?: string;
    projectId?: string;
    messages: AIMessageResponse[];
    createdAt: string;
    updatedAt: string;
}

export interface AIProviderResponse {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama';
    model: string;
    isEnabled: boolean;
    isDefault?: boolean;
    tier?: 'free' | 'standard' | 'premium';
    maxTokens?: number;
    supportsStreaming?: boolean;
    supportsVision?: boolean;
}

export interface AIProviderListResponse {
    providers: AIProviderResponse[];
}

export interface AIStatsResponse {
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime: number;
    successRate: number;
    byProvider: Record<
        string,
        {
            calls: number;
            tokens: number;
            cost: number;
        }
    >;
    byModel: Record<
        string,
        {
            calls: number;
            tokens: number;
            cost: number;
        }
    >;
}

export interface AIHealthResponse {
    status: 'healthy' | 'degraded' | 'error';
    providers: {
        [key: string]: {
            status: 'healthy' | 'unhealthy';
            latency?: number;
            lastCheck?: string;
            error?: string;
        };
    };
    lastCheck: string;
}

// ==========================================
// NOTIFICATION RESPONSES
// ==========================================

export interface NotificationResponse {
    id: string;
    userId: string;
    type: 'info' | 'warning' | 'error' | 'success';
    category: 'ai' | 'task' | 'system' | 'billing' | 'pmo';
    title: string;
    message: string;
    isRead: boolean;
    link?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

export interface NotificationListResponse {
    notifications: NotificationResponse[];
    unreadCount: number;
    total: number;
}

// ==========================================
// ANALYTICS RESPONSES
// ==========================================

export interface MetricsOverviewResponse {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    completedTasks: number;
    aiCalls: number;
    tokensUsed: number;
    revenue?: number;
}

export interface FunnelMetricResponse {
    stage: string;
    count: number;
    conversionRate: number;
    dropoffRate: number;
}

export interface CohortMetricResponse {
    cohort: string;
    week: number;
    retention: number;
    count: number;
}

export interface AnalyticsResponse {
    overview: MetricsOverviewResponse;
    funnels?: FunnelMetricResponse[];
    cohorts?: CohortMetricResponse[];
}

// ==========================================
// PMO RESPONSES
// ==========================================

export interface PMOContextResponse {
    projectId: string;
    currentPhase: string;
    gateStatus: 'open' | 'blocked' | 'pending';
    healthScore: number;
    blockingIssues: PMOIssueResponse[];
    lastUpdated: string;
}

export interface PMOIssueResponse {
    id: string;
    type: 'risk' | 'issue' | 'dependency' | 'blocker';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    owner?: string;
    ownerName?: string;
    dueDate?: string;
    createdAt: string;
}

export interface DecisionResponse {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'deferred';
    deciderId?: string;
    deciderName?: string;
    decisionDate?: string;
    rationale?: string;
    impact?: string;
    pmoDomain: string;
    createdAt: string;
    updatedAt: string;
}

export interface StageGateResponse {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    phase: number;
    status: 'not_started' | 'in_progress' | 'passed' | 'failed';
    criteria: StageGateCriterion[];
    approver?: string;
    approverName?: string;
    approvedAt?: string;
    createdAt: string;
}

export interface StageGateCriterion {
    id: string;
    description: string;
    isMet: boolean;
    evidence?: string;
}

export interface RAIDItemResponse {
    id: string;
    projectId: string;
    type: 'risk' | 'assumption' | 'issue' | 'dependency';
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'mitigated' | 'closed';
    owner?: string;
    ownerName?: string;
    dueDate?: string;
    probability?: number;
    impact?: number;
    mitigationPlan?: string;
    createdAt: string;
    updatedAt: string;
}

// ==========================================
// SUPERADMIN RESPONSES
// ==========================================

export interface SuperAdminDashboardResponse {
    activity: {
        total: number;
        last_hour: number;
        last_24h: number;
        last_7d: number;
    };
    ai: {
        total_ai_calls: number;
        total_tokens: number;
        active_users: number;
    };
    counts: {
        total_users: number;
        total_orgs: number;
        active_users_7d: number;
    };
    live?: {
        total_active_connections: number;
    };
    activities: ActivityLogEntry[];
}

export interface ActivityLogEntry {
    id: string;
    userId: string;
    userName?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ip?: string;
    timestamp: string;
}

export interface SystemHealthResponse {
    status: 'healthy' | 'degraded' | 'error';
    uptime: number;
    latency: number;
    services: {
        database: ServiceStatus;
        redis: ServiceStatus;
        ai: ServiceStatus;
        email: ServiceStatus;
        storage: ServiceStatus;
    };
    lastCheck: string;
}

export interface ServiceStatus {
    status: 'healthy' | 'unhealthy' | 'unknown';
    latency?: number;
    error?: string;
    lastCheck?: string;
}

// ==========================================
// ASSESSMENT RESPONSES
// ==========================================

export interface AssessmentResponse {
    id: string;
    projectId: string;
    framework: string;
    status: 'draft' | 'in_progress' | 'completed' | 'archived';
    overallScore?: number;
    maxScore?: number;
    completionPercentage: number;
    axes?: AssessmentAxisResponse[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export interface AssessmentAxisResponse {
    id: string;
    name: string;
    code: string;
    score: number;
    maxScore: number;
    level: number;
    targetLevel?: number;
    recommendations?: string[];
}

export interface AssessmentReportResponse {
    id: string;
    assessmentId: string;
    type: string;
    title: string;
    status: 'draft' | 'published';
    content?: string;
    generatedAt: string;
    downloadUrl?: string;
}

// ==========================================
// SETTINGS RESPONSES
// ==========================================

export interface IntegrationResponse {
    id: string;
    name: string;
    type: string;
    status: 'active' | 'inactive' | 'error';
    config?: Record<string, unknown>;
    lastSyncAt?: string;
    error?: string;
}

export interface WebhookResponse {
    id: string;
    url: string;
    events: string[];
    status: 'active' | 'inactive';
    secret?: string;
    lastTriggeredAt?: string;
    failureCount?: number;
}

export interface ApiKeyResponse {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt?: string;
    expiresAt?: string;
    createdAt: string;
}

// ==========================================
// KNOWLEDGE BASE RESPONSES
// ==========================================

export interface KnowledgeDocumentResponse {
    id: string;
    title: string;
    content?: string;
    type: 'markdown' | 'pdf' | 'url' | 'text';
    category?: string;
    tags?: string[];
    isIndexed: boolean;
    indexedAt?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface KnowledgeSearchResponse {
    results: KnowledgeSearchResult[];
    total: number;
    query: string;
}

export interface KnowledgeSearchResult {
    documentId: string;
    title: string;
    excerpt: string;
    score: number;
    highlights?: string[];
}

// ==========================================
// FEEDBACK RESPONSES
// ==========================================

export interface FeedbackResponse {
    id: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    type: 'bug' | 'feature' | 'general' | 'complaint';
    status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';
    message: string;
    screenshot?: string;
    url?: string;
    response?: string;
    respondedAt?: string;
    createdAt: string;
}

export interface FeedbackListResponse {
    feedback: FeedbackResponse[];
    total: number;
}
