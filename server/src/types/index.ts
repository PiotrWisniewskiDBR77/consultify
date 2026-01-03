/**
 * Backend TypeScript Types
 * Enterprise SaaS Architecture - Core Type Definitions
 */

import type { Request, Response, NextFunction } from 'express';

// ==========================================
// EXPRESS EXTENSIONS
// ==========================================

export interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
    isSuperAdmin?: boolean;
    isDemo?: boolean;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
    correlationId?: string;
}

export type AsyncHandler = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => Promise<void | Response>;

// ==========================================
// USER & ORGANIZATION
// ==========================================

export type UserRole = 
    | 'owner'
    | 'administrator'
    | 'project_manager'
    | 'team_member'
    | 'viewer'
    | 'guest'
    | 'consultant';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    organizationId: string;
    avatarUrl?: string;
    timezone?: string;
    locale?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type OrganizationPlan = 'free' | 'starter' | 'professional' | 'enterprise';
export type OrganizationStatus = 'active' | 'suspended' | 'cancelled';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    plan: OrganizationPlan;
    status: OrganizationStatus;
    ownerId: string;
    settings?: Record<string, unknown>;
    branding?: OrganizationBranding;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrganizationBranding {
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
    faviconUrl?: string;
}

// ==========================================
// PROJECT & TASK
// ==========================================

export type ProjectStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
    id: string;
    name: string;
    description?: string;
    status: ProjectStatus;
    organizationId: string;
    ownerId: string;
    startDate?: Date;
    endDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId?: string;
    dueDate?: Date;
    estimatedHours?: number;
    actualHours?: number;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// INITIATIVE
// ==========================================

export type InitiativeStatus = 'draft' | 'planning' | 'active' | 'completed' | 'cancelled';

export interface Initiative {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    status: InitiativeStatus;
    priority: TaskPriority;
    owner?: string;
    startDate?: Date;
    endDate?: Date;
    budget?: number;
    roi?: number;
    strategicAlignment?: number;
    riskLevel?: 'low' | 'medium' | 'high';
    category?: string;
    tags?: string[];
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// PMO (ISO 21500, PMBOK, PRINCE2 Aligned)
// ==========================================

export type PMODomain = 
    | 'GOVERNANCE_DECISION_MAKING'
    | 'SCOPE_CHANGE_CONTROL'
    | 'SCHEDULE_MILESTONES'
    | 'RISK_ISSUE_MANAGEMENT'
    | 'RESOURCE_RESPONSIBILITY'
    | 'PERFORMANCE_MONITORING'
    | 'BENEFITS_REALIZATION';

export type RAIDType = 'risk' | 'assumption' | 'issue' | 'dependency';
export type RAIDSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RAIDStatus = 'open' | 'in_progress' | 'mitigated' | 'closed';

export interface RAIDItem {
    id: string;
    projectId: string;
    type: RAIDType;
    title: string;
    description: string;
    severity: RAIDSeverity;
    status: RAIDStatus;
    owner?: string;
    dueDate?: Date;
    mitigationPlan?: string;
    isoMapping?: string;
    pmbokMapping?: string;
    prince2Mapping?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

export interface Decision {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: DecisionStatus;
    deciderId?: string;
    decisionDate?: Date;
    rationale?: string;
    impact?: string;
    pmoDomain: PMODomain;
    createdAt: Date;
    updatedAt: Date;
}

export type StageGateStatus = 'not_started' | 'in_progress' | 'passed' | 'failed';

export interface StageGate {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    phase: number;
    status: StageGateStatus;
    criteria: string[];
    approver?: string;
    approvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// AI & LLM
// ==========================================

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama';

export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
}

export interface AIConversation {
    id: string;
    userId: string;
    projectId?: string;
    messages: AIMessage[];
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// BILLING
// ==========================================

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface Subscription {
    id: string;
    organizationId: string;
    planId: string;
    status: SubscriptionStatus;
    stripeSubscriptionId?: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface TokenUsage {
    id: string;
    organizationId: string;
    userId: string;
    provider: LLMProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    createdAt: Date;
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationCategory = 'ai' | 'task' | 'system' | 'billing' | 'pmo';

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    message: string;
    isRead: boolean;
    link?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    metadata?: {
        page?: number;
        limit?: number;
        total?: number;
        hasMore?: boolean;
    };
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

// ==========================================
// SERVICE INTERFACES
// ==========================================

export interface BaseService<T> {
    findById(id: string): Promise<T | null>;
    findMany(filters?: Record<string, unknown>): Promise<T[]>;
    create(data: Partial<T>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T>;
    delete(id: string): Promise<boolean>;
}

export interface CacheService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    flush(): Promise<void>;
}

// ==========================================
// ERROR TYPES
// ==========================================

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(400, message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends AppError {
    constructor(message = 'Authentication required') {
        super(401, message, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(403, message, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super(404, `${resource} not found`, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, message, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(429, message, 'RATE_LIMIT_EXCEEDED');
        this.name = 'RateLimitError';
    }
}


