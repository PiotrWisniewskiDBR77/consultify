/**
 * API Types
 * Enterprise SaaS Architecture - Shared API response types
 */

// Generic API response wrapper
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Filter types
export interface DateRangeFilter {
    startDate?: string;
    endDate?: string;
}

export interface TaskFilters {
    projectId?: string;
    status?: string;
    assigneeId?: string;
    priority?: string;
    initiativeId?: string;
}

export interface NotificationFilters {
    unreadOnly?: boolean;
    category?: string;
    limit?: number;
}

// Billing types
export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
    limits: Record<string, number>;
}

export interface PaymentMethod {
    id: string;
    type: 'card' | 'bank_account';
    last4: string;
    brand?: string;
    isDefault: boolean;
    expiryMonth?: number;
    expiryYear?: number;
}

export interface Invoice {
    id: string;
    amount: number;
    currency: string;
    status: 'draft' | 'open' | 'paid' | 'void';
    createdAt: string;
    dueDate?: string;
    pdfUrl?: string;
}

// Token/Usage types
export interface TokenBalance {
    available: number;
    used: number;
    limit: number;
    resetDate?: string;
}

export interface TokenTransaction {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}

// Health check types
export interface HealthStatus {
    status: 'ok' | 'degraded' | 'error';
    latency: number;
    timestamp: string;
    services?: Record<string, ServiceHealth>;
}

export interface ServiceHealth {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    lastCheck?: string;
    error?: string;
}


