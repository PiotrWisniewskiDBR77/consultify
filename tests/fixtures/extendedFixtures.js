/**
 * Extended Test Fixtures
 * Comprehensive test data for various testing scenarios
 * 
 * @module tests/fixtures/extendedFixtures.js
 */

// ═══════════════════════════════════════════════════════════════════════════
// USER FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

export const users = {
    superadmin: {
        id: 'user-superadmin',
        email: 'superadmin@test.com',
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPERADMIN',
        organizationId: null,
        status: 'active',
        permissions: ['*'],
    },
    admin: {
        id: 'user-admin',
        email: 'admin@test.com',
        firstName: 'Organization',
        lastName: 'Admin',
        role: 'ADMIN',
        organizationId: 'org-1',
        status: 'active',
        permissions: ['org:manage', 'users:manage', 'projects:manage'],
    },
    manager: {
        id: 'user-manager',
        email: 'manager@test.com',
        firstName: 'Project',
        lastName: 'Manager',
        role: 'MANAGER',
        organizationId: 'org-1',
        status: 'active',
        permissions: ['projects:manage', 'users:read'],
    },
    user: {
        id: 'user-regular',
        email: 'user@test.com',
        firstName: 'Regular',
        lastName: 'User',
        role: 'USER',
        organizationId: 'org-1',
        status: 'active',
        permissions: ['projects:read'],
    },
    inactive: {
        id: 'user-inactive',
        email: 'inactive@test.com',
        firstName: 'Inactive',
        lastName: 'User',
        role: 'USER',
        organizationId: 'org-1',
        status: 'inactive',
        permissions: [],
    },
    pending: {
        id: 'user-pending',
        email: 'pending@test.com',
        firstName: 'Pending',
        lastName: 'User',
        role: 'USER',
        organizationId: 'org-1',
        status: 'pending',
        permissions: [],
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIZATION FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

export const organizations = {
    enterprise: {
        id: 'org-enterprise',
        name: 'Enterprise Company',
        status: 'active',
        plan: 'enterprise',
        userCount: 150,
        features: ['ai', 'analytics', 'api', 'sso'],
        billing: {
            mrr: 5000,
            currency: 'USD',
        },
    },
    professional: {
        id: 'org-professional',
        name: 'Professional LLC',
        status: 'active',
        plan: 'professional',
        userCount: 25,
        features: ['ai', 'analytics'],
        billing: {
            mrr: 500,
            currency: 'USD',
        },
    },
    starter: {
        id: 'org-starter',
        name: 'Startup Inc',
        status: 'active',
        plan: 'starter',
        userCount: 5,
        features: ['ai'],
        billing: {
            mrr: 50,
            currency: 'USD',
        },
    },
    trial: {
        id: 'org-trial',
        name: 'Trial Company',
        status: 'trial',
        plan: 'trial',
        userCount: 3,
        features: ['ai'],
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    suspended: {
        id: 'org-suspended',
        name: 'Suspended Corp',
        status: 'suspended',
        plan: 'professional',
        userCount: 10,
        suspendedReason: 'Non-payment',
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

export const projects = {
    active: {
        id: 'project-active',
        name: 'Active Project',
        description: 'An active project for testing',
        status: 'active',
        organizationId: 'org-1',
        createdBy: 'user-admin',
        progress: 45,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
    },
    completed: {
        id: 'project-completed',
        name: 'Completed Project',
        description: 'A completed project',
        status: 'completed',
        organizationId: 'org-1',
        createdBy: 'user-admin',
        progress: 100,
        completedAt: '2024-06-15',
    },
    onHold: {
        id: 'project-onhold',
        name: 'On Hold Project',
        description: 'A project on hold',
        status: 'on_hold',
        organizationId: 'org-1',
        createdBy: 'user-admin',
        progress: 30,
        holdReason: 'Awaiting approval',
    },
    archived: {
        id: 'project-archived',
        name: 'Archived Project',
        description: 'An archived project',
        status: 'archived',
        organizationId: 'org-1',
        createdBy: 'user-admin',
        progress: 100,
        archivedAt: '2023-12-31',
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// AI FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

export const aiProviders = {
    openai: {
        id: 'openai',
        name: 'OpenAI',
        status: 'active',
        models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o',
        costPer1kTokens: 0.01,
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        status: 'active',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        defaultModel: 'claude-3-sonnet',
        costPer1kTokens: 0.015,
    },
    google: {
        id: 'google',
        name: 'Google AI',
        status: 'active',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
        defaultModel: 'gemini-1.5-pro',
        costPer1kTokens: 0.007,
    },
    disabled: {
        id: 'disabled-provider',
        name: 'Disabled Provider',
        status: 'disabled',
        models: [],
    },
};

export const aiConversations = {
    simple: {
        id: 'conv-simple',
        userId: 'user-regular',
        messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hello! How can I help you today?' },
        ],
        tokenCount: 50,
    },
    complex: {
        id: 'conv-complex',
        userId: 'user-regular',
        messages: [
            { role: 'user', content: 'Tell me about project management' },
            { role: 'assistant', content: 'Project management is...' },
            { role: 'user', content: 'What about Agile?' },
            { role: 'assistant', content: 'Agile is a methodology...' },
        ],
        tokenCount: 500,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// BILLING FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

export const invoices = {
    paid: {
        id: 'inv-paid',
        organizationId: 'org-1',
        amount: 500,
        currency: 'USD',
        status: 'paid',
        dueDate: '2024-01-15',
        paidAt: '2024-01-10',
    },
    pending: {
        id: 'inv-pending',
        organizationId: 'org-1',
        amount: 500,
        currency: 'USD',
        status: 'pending',
        dueDate: '2024-02-15',
    },
    overdue: {
        id: 'inv-overdue',
        organizationId: 'org-2',
        amount: 1000,
        currency: 'USD',
        status: 'overdue',
        dueDate: '2024-01-01',
        daysOverdue: 30,
    },
    refunded: {
        id: 'inv-refunded',
        organizationId: 'org-1',
        amount: 200,
        currency: 'USD',
        status: 'refunded',
        refundedAt: '2024-01-20',
        refundReason: 'Customer request',
    },
};

export const subscriptions = {
    active: {
        id: 'sub-active',
        organizationId: 'org-1',
        plan: 'professional',
        status: 'active',
        amount: 500,
        interval: 'month',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    canceled: {
        id: 'sub-canceled',
        organizationId: 'org-2',
        plan: 'starter',
        status: 'canceled',
        canceledAt: '2024-01-15',
        cancelReason: 'Too expensive',
    },
    pastDue: {
        id: 'sub-pastdue',
        organizationId: 'org-3',
        plan: 'professional',
        status: 'past_due',
        amount: 500,
        retryCount: 2,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// API RESPONSE FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

export const apiResponses = {
    success: {
        success: true,
        data: {},
    },
    successWithData: (data) => ({
        success: true,
        data,
    }),
    successPaginated: (data, pagination) => ({
        success: true,
        data,
        pagination,
    }),
    error: (message, code) => ({
        success: false,
        error: message,
        code,
    }),
    validationError: (field, message) => ({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { field, message },
    }),
    notFound: {
        success: false,
        error: 'Resource not found',
        code: 'NOT_FOUND',
    },
    unauthorized: {
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
    },
    forbidden: {
        success: false,
        error: 'Access denied',
        code: 'FORBIDDEN',
    },
    rateLimited: {
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: 60,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all fixtures for a category
 */
export function getAllFixtures(category) {
    const categories = {
        users,
        organizations,
        projects,
        aiProviders,
        aiConversations,
        invoices,
        subscriptions,
    };
    return categories[category] || {};
}

/**
 * Create fixture with overrides
 */
export function createFixture(category, name, overrides = {}) {
    const base = getAllFixtures(category)[name];
    if (!base) {
        throw new Error(`Fixture not found: ${category}.${name}`);
    }
    return { ...base, ...overrides };
}

export default {
    users,
    organizations,
    projects,
    aiProviders,
    aiConversations,
    invoices,
    subscriptions,
    apiResponses,
    getAllFixtures,
    createFixture,
};
