/**
 * Test Data Fixtures
 * 
 * Standardized test data for use across all tests.
 * Ensures consistency and makes tests easier to maintain.
 */

/**
 * Test users with different roles
 */
export const testUsers = {
    admin: {
        id: 'user-admin-123',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'ADMIN',
        organizationId: 'org-test-123',
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    user: {
        id: 'user-123',
        email: 'user@test.com',
        name: 'Test User',
        role: 'USER',
        organizationId: 'org-test-123',
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    superadmin: {
        id: 'user-superadmin-123',
        email: 'superadmin@test.com',
        name: 'Test Superadmin',
        role: 'SUPERADMIN',
        organizationId: null,
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    org2Admin: {
        id: 'user-org2-admin-123',
        email: 'admin2@test.com',
        name: 'Test Admin 2',
        role: 'ADMIN',
        organizationId: 'org-test-456',
        createdAt: '2024-01-01T00:00:00Z'
    }
};

/**
 * Test organizations
 */
export const testOrganizations = {
    org1: {
        id: 'org-test-123',
        name: 'Test Organization 1',
        plan: 'enterprise',
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    org2: {
        id: 'org-test-456',
        name: 'Test Organization 2',
        plan: 'professional',
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    trialOrg: {
        id: 'org-trial-123',
        name: 'Trial Organization',
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: '2024-01-01T00:00:00Z'
    }
};

/**
 * Test projects
 */
export const testProjects = {
    project1: {
        id: 'proj-test-123',
        name: 'Test Project 1',
        organizationId: 'org-test-123',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    project2: {
        id: 'proj-test-456',
        name: 'Test Project 2',
        organizationId: 'org-test-123',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z'
    },
    
    org2Project: {
        id: 'proj-org2-123',
        name: 'Org 2 Project',
        organizationId: 'org-test-456',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z'
    }
};

/**
 * Test initiatives
 */
export const testInitiatives = {
    initiative1: {
        id: 'init-test-123',
        name: 'Test Initiative 1',
        projectId: 'proj-test-123',
        organizationId: 'org-test-123',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z'
    }
};

/**
 * Test tokens/JWT
 */
export const testTokens = {
    admin: 'mock-jwt-token-admin-123',
    user: 'mock-jwt-token-user-123',
    superadmin: 'mock-jwt-token-superadmin-123',
    org2Admin: 'mock-jwt-token-org2-admin-123'
};

/**
 * Test LLM providers
 */
export const testLLMProviders = {
    openai: {
        id: 'provider-openai-123',
        provider: 'openai',
        model_id: 'gpt-4',
        api_key: 'sk-test-key-123',
        is_active: 1,
        organizationId: 'org-test-123'
    },
    
    gemini: {
        id: 'provider-gemini-123',
        provider: 'gemini',
        model_id: 'gemini-1.5-pro',
        api_key: 'test-gemini-key-123',
        is_active: 1,
        organizationId: 'org-test-123'
    }
};

/**
 * Test budgets
 */
export const testBudgets = {
    global: {
        id: 'budget-global',
        scope_type: 'global',
        scope_id: null,
        monthly_limit_usd: 10000,
        current_month_usage: 5000,
        auto_downgrade: 1
    },
    
    tenant: {
        id: 'budget-tenant-org-test-123',
        scope_type: 'tenant',
        scope_id: 'org-test-123',
        monthly_limit_usd: 1000,
        current_month_usage: 500,
        auto_downgrade: 1
    },
    
    project: {
        id: 'budget-project-proj-test-123',
        scope_type: 'project',
        scope_id: 'proj-test-123',
        monthly_limit_usd: 100,
        current_month_usage: 50,
        auto_downgrade: 0
    }
};

/**
 * Test permissions
 */
export const testPermissions = {
    playbookPublish: {
        key: 'PLAYBOOK_PUBLISH',
        name: 'Publish Playbook',
        category: 'ai'
    },
    
    aiActionApprove: {
        key: 'AI_ACTION_APPROVE',
        name: 'Approve AI Actions',
        category: 'ai'
    },
    
    orgManage: {
        key: 'ORG_MANAGE',
        name: 'Manage Organization',
        category: 'governance'
    }
};

/**
 * Helper function to create a test request object
 * @param {Object} options - Request options
 * @returns {Object} Mock Express request object
 */
export const createMockRequest = (options = {}) => {
    const user = options.user || testUsers.user;
    const organizationId = options.organizationId || user.organizationId;
    
    return {
        userId: user.id,
        organizationId,
        user,
        body: options.body || {},
        query: options.query || {},
        params: options.params || {},
        headers: {
            authorization: `Bearer ${testTokens[user.role.toLowerCase()] || testTokens.user}`,
            ...options.headers
        }
    };
};

/**
 * Helper function to create a test response object
 * @returns {Object} Mock Express response object
 */
export const createMockResponse = () => {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        write: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        flushHeaders: vi.fn().mockReturnThis()
    };
    return res;
};

// Import vi if not already imported
import { vi } from 'vitest';

export default {
    testUsers,
    testOrganizations,
    testProjects,
    testInitiatives,
    testTokens,
    testLLMProviders,
    testBudgets,
    testPermissions,
    createMockRequest,
    createMockResponse
};






